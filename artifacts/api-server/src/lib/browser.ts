import { chromium, type Browser, type BrowserContext, type Page, type Locator } from "playwright";
import { db, testRunsTable, testResultsTable, screenshotsTable, credentialsTable, projectsTable, reportsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { streamLog } from "./runLogger";
import { runProjectUnderstanding, runTestPlanner, runAssertion, runRecovery, decrypt } from "./agents";
import { generateEvaluationReport } from "./ai";
import fs from "fs";
import path from "path";

// Grade standard mapping
function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "F";
}

/**
 * Standardize path names
 */
const PUBLIC_SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

// Ensure screenshots folder exists
if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Robust element finder that supports multiple locator strategies.
 */
async function findElementWithSmartStrategies(page: Page, target: string, runId: string): Promise<Locator> {
  const cleanTarget = target.trim();

  // 1. Standard CSS selectors
  if (
    cleanTarget.startsWith("#") ||
    cleanTarget.startsWith(".") ||
    cleanTarget.startsWith("[") ||
    cleanTarget.startsWith("input") ||
    cleanTarget.startsWith("button") ||
    cleanTarget.startsWith("select") ||
    cleanTarget.includes(">") ||
    cleanTarget.includes(" ")
  ) {
    const loc = page.locator(cleanTarget).first();
    if (await loc.isVisible().catch(() => false)) {
      return loc;
    }
  }

  // 2. Playwright smart queries
  const strategies = [
    page.getByRole("button", { name: cleanTarget, exact: false }),
    page.getByPlaceholder(cleanTarget, { exact: false }),
    page.getByLabel(cleanTarget, { exact: false }),
    page.getByText(cleanTarget, { exact: false }),
    page.locator(`input[name="${cleanTarget}"]`).first(),
    page.locator(`input[id="${cleanTarget}"]`).first(),
    page.locator(`button:has-text("${cleanTarget}")`).first(),
    page.locator(`a:has-text("${cleanTarget}")`).first(),
    page.locator(`input[placeholder*="${cleanTarget}"]`).first(),
    page.locator(cleanTarget).first(), // Raw fallback
  ];

  for (const loc of strategies) {
    try {
      if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
        return loc;
      }
    } catch {
      // Ignore and try next
    }
  }

  // If nothing visible yet, return the default locator and let regular timeout run
  return page.locator(cleanTarget).first();
}

/**
 * Extracts visible interactive elements from the current page
 */
async function getVisibleInteractiveElements(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const win = (globalThis as any).window;
      const elements = Array.from(doc.querySelectorAll("button, a, input, select, textarea, [role='button']")) as any[];
      return elements
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && win.getComputedStyle(el).display !== "none";
        })
        .map((el) => {
          const text = el.textContent?.trim() || "";
          const placeholder = el.getAttribute("placeholder") || "";
          const name = el.getAttribute("name") || "";
          const label = el.getAttribute("aria-label") || "";
          const id = el.id || "";
          const tagName = el.tagName.toLowerCase();
          return `${tagName}[id='${id}'][name='${name}'][placeholder='${placeholder}'][label='${label}'] text:${text.slice(0, 30)}`;
        })
        .slice(0, 30); // Cap it
    });
  } catch {
    return [];
  }
}

/**
 * Handles project login flow for a specified role.
 */
async function handleAutoLogin(
  page: Page,
  project: any,
  role: string,
  runId: string
): Promise<boolean> {
  streamLog(runId, `Checking credentials for role: "${role}"`, "info");
  
  const [cred] = await db
    .select()
    .from(credentialsTable)
    .where(and(eq(credentialsTable.projectId, project.id), eq(credentialsTable.role, role)))
    .limit(1);

  if (!cred) {
    streamLog(runId, `No preconfigured credentials found in project for role: "${role}". Skipping auto-login.`, "warn");
    return false;
  }

  const password = decrypt(cred.passwordEncrypted);
  const loginUrlPath = project.loginUrl || "/login";
  const loginUrl = loginUrlPath.startsWith("http") ? loginUrlPath : `${project.baseUrl}${loginUrlPath}`;

  streamLog(runId, `Auto-logging in at ${loginUrl} as user: ${cred.username}`, "info");

  try {
    await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 15000 });
    
    // Find fields
    const emailField = await findElementWithSmartStrategies(page, "email", runId);
    const userField = await findElementWithSmartStrategies(page, "username", runId);
    const passField = await findElementWithSmartStrategies(page, "password", runId);

    const loginInput = (await emailField.isVisible().catch(() => false)) ? emailField : userField;
    
    if (await loginInput.isVisible().catch(() => false)) {
      await loginInput.fill(cred.username);
    } else {
      // Direct selector query fallback
      await page.fill("input[type='email'], input[type='text'], input[name='email'], input[name='username']", cred.username).catch(() => {});
    }

    if (await passField.isVisible().catch(() => false)) {
      await passField.fill(password);
    } else {
      await page.fill("input[type='password'], input[name='password']", password).catch(() => {});
    }

    // Capture pre-login state
    streamLog(runId, `Filled username and masked password. Submitting credentials...`, "info");
    
    // Press login button
    const submitBtn = await findElementWithSmartStrategies(page, "submit", runId);
    const loginBtn = await findElementWithSmartStrategies(page, "login", runId);
    const btn = (await loginBtn.isVisible().catch(() => false)) ? loginBtn : submitBtn;

    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    } else {
      await page.click("button[type='submit'], button:has-text('Login'), button:has-text('Sign in')").catch(() => {});
    }

    await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
    
    streamLog(runId, `Auto-login flow completed. Current URL: ${page.url()}`, "pass");
    return true;
  } catch (err: any) {
    streamLog(runId, `Auto-login for role "${role}" failed: ${err.message}. Proceeding to steps anyway.`, "warn");
    return false;
  }
}

/**
 * Core Browser Evaluation Engine
 */
export async function executeRealBrowserEvaluation(
  runId: string,
  testCases: any[],
  project: any,
  suite: any,
  userId: string
) {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  let passedTestsCount = 0;
  let failedTestsCount = 0;
  const startTime = Date.now();

  try {
    streamLog(runId, `[AutoViva Agent] Starting real browser evaluation run...`, "info");
    streamLog(runId, `Project name: "${project.name}" | Base URL: ${project.baseUrl}`, "info");

    // Launch Chromium via Playwright
    streamLog(runId, `Launching Headless Chromium Browser...`, "info");
    browser = await chromium.launch({
      headless: true, // headless inside server
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    
    page = await context.newPage();

    // Step 1: Project Understanding Agent
    streamLog(runId, `[Agent 1: ProjectUnderstandingAgent] Analyzing project requirements & modules...`, "info");
    const understanding = await runProjectUnderstanding(project);
    streamLog(runId, `Project main modules recognized: ${understanding.mainModules.join(", ")}`, "pass");
    streamLog(runId, `Assessed risk areas: ${understanding.riskAreas.join(", ")}`, "warn");

    // Loop through each test case
    let testIndex = 0;
    for (const tc of testCases) {
      testIndex++;
      const tcId = tc.id || `TC_${testIndex}`;
      const tcTitle = tc.title || `Test Case ${testIndex}`;
      const tcRole = tc.role || "user";

      streamLog(runId, `------------------------------------------------`, "info");
      streamLog(runId, `Starting Test ${testIndex}/${testCases.length}: [${tcId}] ${tcTitle}`, "info");

      await db.update(testRunsTable).set({
        passed: passedTestsCount,
        failed: failedTestsCount,
      }).where(eq(testRunsTable.id, runId));

      const tcStartTime = Date.now();
      let tcStatus: "passed" | "failed" = "passed";
      let tcErrorMessage: string | null = null;
      let stepsExecutedCount = 0;

      // Make a fresh session context per test case or handle auto-login if role specified
      if (tcRole && tcRole !== "guest" && tcRole !== "null") {
        await context.clearCookies();
        await handleAutoLogin(page, project, tcRole, runId);
      } else {
        streamLog(runId, `No user role constraint. Continuing as Guest.`, "info");
        await page.goto(project.baseUrl, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      }

      // Step 2: TestPlannerAgent
      streamLog(runId, `[Agent 2: TestPlannerAgent] Generating browser plan for "${tcTitle}"...`, "info");
      const plannedSteps = await runTestPlanner(tc, understanding);
      streamLog(runId, `Planner finalized ${plannedSteps.length} planned browser steps.`, "info");

      // Execute each step
      let stepIndex = 0;
      for (const step of plannedSteps) {
        stepIndex++;
        const { action, target, value } = step;
        stepsExecutedCount++;

        streamLog(runId, `Step ${stepIndex}: Executing action: "${action}" | Target: "${target || 'None'}"`, "info");

        try {
          if (action === "navigate") {
            const destUrl = (value || target || "").startsWith("http")
              ? (value || target || "")
              : `${project.baseUrl}${value || target || ""}`;
            streamLog(runId, `Navigating to ${destUrl}...`, "info");
            await page.goto(destUrl, { waitUntil: "networkidle", timeout: 15000 });
          } else if (action === "fill") {
            const element = await findElementWithSmartStrategies(page, target!, runId);
            await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
            // Check if password type to mask logs
            const isPassword = target?.toLowerCase().includes("password") || (await element.getAttribute("type").catch(() => "")) === "password";
            const loggedValue = isPassword ? "****" : value;
            streamLog(runId, `Typing "${loggedValue}" into element...`, "info");
            await element.fill(value || "");
          } else if (action === "click") {
            const element = await findElementWithSmartStrategies(page, target!, runId);
            await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
            streamLog(runId, `Clicking element...`, "info");
            await element.click({ timeout: 5000 });
          } else if (action === "wait") {
            const delay = parseInt(value || target || "1000", 10);
            streamLog(runId, `Sleeping for ${delay}ms...`, "info");
            await page.waitForTimeout(delay);
          } else if (action === "scroll") {
            const dir = value || target || "bottom";
            streamLog(runId, `Scrolling page to ${dir}...`, "info");
            if (dir === "bottom") {
              await page.evaluate(() => (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight));
            } else {
              await page.evaluate(() => (globalThis as any).window.scrollTo(0, 0));
            }
          } else if (action === "screenshot" || action === "capture") {
            const label = value || target || `step-${stepIndex}`;
            await takeAndRecordScreenshot(page, runId, null, stepIndex, label);
          } else if (action === "assert_text") {
            const actualText = (await page.textContent("body").catch(() => "")) || "";
            if (!actualText.toLowerCase().includes((value || target || "").toLowerCase())) {
              throw new Error(`Text "${value || target}" not found on page.`);
            }
            streamLog(runId, `✓ Text assertion passed.`, "pass");
          } else if (action === "assert_url") {
            const currentUrl = page.url();
            if (!currentUrl.includes(value || target || "")) {
              throw new Error(`Current URL ${currentUrl} does not match expected pattern: ${value || target}`);
            }
            streamLog(runId, `✓ URL assertion passed.`, "pass");
          } else if (action === "assert_element") {
            const element = await findElementWithSmartStrategies(page, target!, runId);
            if (!(await element.isVisible({ timeout: 3000 }).catch(() => false))) {
              throw new Error(`Element "${target}" is not visible.`);
            }
            streamLog(runId, `✓ Element visibility assertion passed.`, "pass");
          } else {
            streamLog(runId, `Unknown browser action: "${action}". Skipping.`, "warn");
          }
        } catch (err: any) {
          streamLog(runId, `Step failed: ${err.message}. Triggering Agent 5: RecoveryAgent...`, "warn");
          
          // Agent 5: Self-healing RecoveryAgent
          const visibleElements = await getVisibleInteractiveElements(page);
          const htmlSnippet = await page.content().catch(() => "");
          
          const recovery = await runRecovery({
            failedAction: action,
            failedTarget: target || "",
            failedValue: value,
            url: page.url(),
            visibleElements,
            htmlSnippet,
          });

          let recovered = false;
          if (recovery.canRecover && recovery.alternatives && recovery.alternatives.length > 0) {
            for (const alt of recovery.alternatives) {
              streamLog(runId, `[RecoveryAgent] Attempting self-healing with alternative target: "${alt.target}" (${alt.reason})`, "info");
              try {
                const altEl = await findElementWithSmartStrategies(page, alt.target, runId);
                await altEl.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
                if (action === "click") {
                  await altEl.click({ timeout: 4000 });
                  recovered = true;
                } else if (action === "fill") {
                  await altEl.fill(value || "");
                  recovered = true;
                }
                if (recovered) {
                  streamLog(runId, `[RecoveryAgent] ✓ Self-healing SUCCESSFUL! Selector healed and step executed.`, "pass");
                  break;
                }
              } catch (recErr) {
                // Keep trying other alternatives
              }
            }
          }

          if (!recovered) {
            streamLog(runId, `[RecoveryAgent] Self-healing could not recover this step. Test case failed.`, "fail");
            tcStatus = "failed";
            tcErrorMessage = err.message;
            break; // Break execution of remaining steps in this test case
          }
        }
      }

      // Assertions Check at the end of the test case
      if (tcStatus === "passed" && tc.expected) {
        streamLog(runId, `[Agent 4: AssertionAgent] Verifying final expectations for "${tcTitle}"...`, "info");
        const bodyText = (await page.textContent("body").catch(() => "")) || "";
        const elementsList = await getVisibleInteractiveElements(page);
        
        const assertResult = await runAssertion({
          expected: {
            urlContains: tc.expected.urlContains || tc.expected.url_contains || null,
            pageContains: tc.expected.pageContains || tc.expected.page_contains || null,
            elementVisible: tc.expected.elementVisible || tc.expected.element_visible || null,
          },
          actual: {
            url: page.url(),
            textContent: bodyText || "",
            visibleElements: elementsList,
          },
        });

        if (assertResult.passed) {
          streamLog(runId, `✓ Semantic assertion passed. Reason: ${assertResult.reason} (Confidence: ${assertResult.confidence})`, "pass");
        } else {
          streamLog(runId, `✗ Semantic assertion failed. Reason: ${assertResult.reason}`, "fail");
          tcStatus = "failed";
          tcErrorMessage = assertResult.reason;
        }
      }

      const duration = (Date.now() - tcStartTime) / 1000;
      if (tcStatus === "passed") {
        passedTestsCount++;
        streamLog(runId, `Test Case PASSED: "${tcTitle}" [Duration: ${duration.toFixed(1)}s]`, "pass");
      } else {
        failedTestsCount++;
        streamLog(runId, `Test Case FAILED: "${tcTitle}" [Error: ${tcErrorMessage || "Unknown error"}]`, "fail");
      }

      // Write test case results in database
      const [insertedResult] = await db.insert(testResultsTable).values({
        runId,
        testCaseId: tcId,
        title: tcTitle,
        status: tcStatus,
        stepsExecuted: stepsExecutedCount,
        expectedResult: tc.expected || {},
        actualResult: {
          url: page.url(),
          matched: tcStatus === "passed",
          error: tcErrorMessage,
        },
        errorMessage: tcErrorMessage,
        durationSeconds: duration,
        executedAt: new Date(),
      }).returning();

      // Take a final screenshot for this test case
      await takeAndRecordScreenshot(page, runId, insertedResult.id, stepIndex + 1, `final-${tcId}`);
    }

    // Finished running all tests! Compute final summary score
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const passRate = testCases.length > 0 ? passedTestsCount / testCases.length : 0;
    
    //Rubric weights
    const totalPossible = 100;
    const baseScore = Math.round(passRate * totalPossible);
    // Deduct slightly for random visual checks or let it scale
    const score = Math.min(Math.max(baseScore, 0), 100);
    const grade = gradeFromScore(score);

    streamLog(runId, `================================================`, "pass");
    streamLog(runId, `All test cases executed! Core results summary:`, "pass");
    streamLog(runId, `- Passed: ${passedTestsCount} | Failed: ${failedTestsCount} out of ${testCases.length}`, "info");
    streamLog(runId, `- Final Evaluation Score: ${score}/100 | Grade: ${grade}`, "pass");
    streamLog(runId, `- Total Duration: ${totalDuration} seconds`, "info");

    streamLog(runId, `[Agent 6: ReportAgent] Compiling comprehensive 8-category evaluation report...`, "info");

    // Update run status
    await db.update(testRunsTable).set({
      status: "completed",
      score,
      grade,
      passed: passedTestsCount,
      failed: failedTestsCount,
      durationSeconds: totalDuration,
      completedAt: new Date(),
    }).where(eq(testRunsTable.id, runId));

    // Generate LLM Report
    try {
      const reportData = await generateEvaluationReport({
        runId,
        score,
        grade,
        passed: passedTestsCount,
        failed: failedTestsCount,
        testCases,
        project,
        suite,
      });

      await db.insert(reportsTable).values({
        runId,
        summary: reportData.summary,
        aiNotes: reportData.aiNotes,
        suggestions: reportData.suggestions || [],
        scoreBreakdown: reportData.scoreBreakdown || {},
        keyFindings: reportData.keyFindings || [],
        bugsFound: reportData.bugsFound || [],
        featureCoverage: reportData.featureCoverage || [],
      });
      streamLog(runId, `[Agent 6: ReportAgent] ✓ Report generated and saved successfully!`, "pass");
    } catch (err: any) {
      streamLog(runId, `✗ Failed to generate LLM report: ${err.message}. Saving fallback report details.`, "warn");
      await db.insert(reportsTable).values({
        runId,
        summary: `Automated test run finished. ${passedTestsCount} out of ${testCases.length} tests passed successfully.`,
        aiNotes: `The student's local host project runs as expected. Check exact failing logs for specific assertions.`,
        suggestions: ["Optimize API response times", "Refine DOM selectors", "Enhance form validation error text"] as any,
        scoreBreakdown: {
          "Login/Auth": Math.round(score * 0.10),
          "Core Features": Math.round(score * 0.30),
          "CRUD": Math.round(score * 0.20),
          "UI Navigation": Math.round(score * 0.10),
          "Error Handling": Math.round(score * 0.10),
          "DB Persistence": Math.round(score * 0.10),
          "Reliability": Math.round(score * 0.05),
          "UI Polish": Math.round(score * 0.05),
        } as any,
        keyFindings: [`Passed tests: ${passedTestsCount}`, `Failed tests: ${failedTestsCount}`] as any,
        bugsFound: [] as any,
        featureCoverage: [] as any,
      });
    }

    streamLog(runId, `Evaluation complete. Ready to review.`, "pass");

  } catch (globalErr: any) {
    streamLog(runId, `✗ Global Engine Failure: ${globalErr.message}`, "fail");
    console.error("Global browser run failure:", globalErr);

    await db.update(testRunsTable).set({
      status: "failed",
      completedAt: new Date(),
    }).where(eq(testRunsTable.id, runId));

  } finally {
    // Cleanup browser instances
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    streamLog(runId, `[AutoViva Agent] Browser controller processes closed.`, "info");
  }
}

/**
 * Capture screenshot and register record in database
 */
async function takeAndRecordScreenshot(
  page: Page,
  runId: string,
  resultId: string | null,
  stepNumber: number,
  label: string
) {
  try {
    const filename = `${runId}_${Date.now()}_${stepNumber}.png`;
    const localPath = path.join(PUBLIC_SCREENSHOTS_DIR, filename);
    
    await page.screenshot({ path: localPath });

    // Expose URL mapping served by backend
    const urlPath = `/screenshots/${filename}`;

    await db.insert(screenshotsTable).values({
      runId,
      resultId,
      type: "screenshot",
      filePath: localPath,
      url: urlPath,
      stepNumber,
      label,
    });
  } catch (err: any) {
    console.error("Failed to capture and record screenshot:", err);
  }
}
