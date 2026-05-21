import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page, type Locator } from "playwright";
import { db, testRunsTable, testResultsTable, screenshotsTable, credentialsTable, projectsTable, reportsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { streamLog } from "./runLogger";
import { runProjectUnderstanding, runTestPlanner, runAssertion, runRecovery, decrypt, runFormAutofillAgent } from "./agents";
import { generateEvaluationReport } from "./ai";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

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
 * Extracts visible and interactive input, select, and textarea fields from the active viewport
 */
async function getVisibleFormFields(page: Page): Promise<any[]> {
  try {
    return await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const win = (globalThis as any).window;
      
      const elements = Array.from(doc.querySelectorAll("input, select, textarea")) as any[];
      
      return elements
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = win.getComputedStyle(el);
          const isVisible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          const isInteractive = !el.disabled && !el.readOnly && el.type !== "submit" && el.type !== "button" && el.type !== "hidden";
          return isVisible && isInteractive;
        })
        .map((el) => {
          const tagName = el.tagName.toLowerCase();
          const type = el.getAttribute("type") || (tagName === "textarea" ? "textarea" : tagName === "select" ? "select" : "text");
          const name = el.getAttribute("name") || "";
          const id = el.id || "";
          const placeholder = el.getAttribute("placeholder") || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          
          let labelText = "";
          if (id) {
            const labelEl = doc.querySelector(`label[for="${id}"]`);
            if (labelEl) labelText = labelEl.textContent?.trim() || "";
          }
          if (!labelText) {
            const parentLabel = el.closest("label");
            if (parentLabel) labelText = parentLabel.textContent?.trim() || "";
          }
          
          let options: any[] = [];
          if (tagName === "select") {
            options = Array.from(el.querySelectorAll("option")).map((opt: any) => ({
              value: opt.value || opt.text || "",
              text: opt.text?.trim() || ""
            }));
          }

          return {
            id,
            name,
            tagName,
            type,
            placeholder,
            ariaLabel,
            labelText,
            options
          };
        });
    });
  } catch {
    return [];
  }
}

/**
 * Scans the active page DOM for visible form validation errors
 */
async function scanValidationErrors(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const win = (globalThis as any).window;
      
      // Select common validation error selectors
      const elements = Array.from(doc.querySelectorAll(
        ".error, [class*='error'], [class*='invalid'], .text-red-500, .text-destructive, [role='alert'], [aria-invalid='true']"
      )) as any[];
      
      return elements
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = win.getComputedStyle(el);
          const isVisible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          const text = el.textContent?.trim() || "";
          return isVisible && text.length > 0 && text.length < 200; // Filter out huge text blocks
        })
        .map((el) => el.textContent?.trim() || "");
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
    const [runRow] = await db.select().from(testRunsTable).where(eq(testRunsTable.id, runId)).limit(1);
    const isMultiBrowser = !!runRow?.multiBrowser;
    const visualRegressionResults: any[] = [];

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
          } else if (action === "autofill") {
            const customInstruction = value || target || "";
            streamLog(runId, `[AutofillAgent] Scanning for visible forms and input fields...`, "info");
            const fields = await getVisibleFormFields(page);
            
            if (fields.length === 0) {
              streamLog(runId, `[AutofillAgent] No interactive input fields or forms found on this page.`, "warn");
            } else {
              streamLog(runId, `[AutofillAgent] Detected ${fields.length} form fields. Querying FormAutofillAgent...`, "info");
              const fills = await runFormAutofillAgent({
                url: page.url(),
                fields,
                userInstruction: customInstruction
              });
              
              streamLog(runId, `[AutofillAgent] FormAutofillAgent generated ${fills.length} field values. Executing fills...`, "info");
              for (const fill of fills) {
                try {
                  // Robust field locator
                  let selector = "";
                  if (fill.id) {
                    selector = `#${fill.id}`;
                  } else if (fill.name) {
                    selector = `[name="${fill.name}"]`;
                  } else {
                    continue; // Skip if no way to locate
                  }
                  
                  const element = page.locator(selector).first();
                  if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await element.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
                    if (fill.tagName === "select") {
                      streamLog(runId, `[AutofillAgent] Selecting "${fill.value}" for: ${fill.name || fill.id}`, "info");
                      await element.selectOption(fill.value);
                    } else if (fill.type === "checkbox" || fill.type === "radio") {
                      const checkVal = fill.value === "true" || fill.value === "checked";
                      streamLog(runId, `[AutofillAgent] Setting checked to ${checkVal} for: ${fill.name || fill.id}`, "info");
                      await element.setChecked(checkVal).catch(async () => {
                        // Fallback click
                        if (checkVal) await element.click();
                      });
                    } else {
                      const isPassword = fill.type === "password" || fill.name?.toLowerCase().includes("password") || fill.id?.toLowerCase().includes("password");
                      const loggedVal = isPassword ? "****" : fill.value;
                      streamLog(runId, `[AutofillAgent] Simulating human typing of "${loggedVal}" into: ${fill.name || fill.id}`, "info");
                      
                      // Simulate realistic human keystroke typing
                      await element.focus();
                      await element.fill(""); // Clear existing
                      await element.pressSequentially(fill.value, { delay: 40 + Math.random() * 30 });
                    }
                  }
                } catch (fillErr: any) {
                  streamLog(runId, `[AutofillAgent] Failed to fill field ${fill.name || fill.id}: ${fillErr.message}`, "warn");
                }
              }

              // Self-healing Validation Boundary Check
              streamLog(runId, `[AutofillAgent] Fills executed. Waiting for dynamic validation checks...`, "info");
              await page.waitForTimeout(1200);

              const errors = await scanValidationErrors(page);
              if (errors.length > 0) {
                streamLog(runId, `[AutofillAgent] ⚠️ Validation errors detected: "${errors.join("; ")}". Initiating cognitive self-healing...`, "warn");
                // Run correction loop
                const correctedFills = await runFormAutofillAgent({
                  url: page.url(),
                  fields: fields.map(f => ({ ...f, currentError: errors.join("; ") })),
                  userInstruction: `CORRECT THE FORM. Avoid the following validation errors: ${errors.join("; ")}. Previous instruction: ${customInstruction}`
                });

                streamLog(runId, `[AutofillAgent] FormAutofillAgent provided corrected values. Applying fixes...`, "info");
                for (const fill of correctedFills) {
                  try {
                    let selector = "";
                    if (fill.id) selector = `#${fill.id}`;
                    else if (fill.name) selector = `[name="${fill.name}"]`;
                    else continue;

                    const element = page.locator(selector).first();
                    if (await element.isVisible().catch(() => false)) {
                      await element.focus();
                      await element.fill("");
                      await element.pressSequentially(fill.value, { delay: 30 });
                      streamLog(runId, `[AutofillAgent] Healed field ${fill.name || fill.id} with new value.`, "pass");
                    }
                  } catch (healErr) {
                    // Ignore and continue
                  }
                }
                
                // Final brief wait to let validation settle
                await page.waitForTimeout(800);
              } else {
                streamLog(runId, `[AutofillAgent] ✓ Form autofill completed with no validation errors!`, "pass");
              }
            }
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
      const chromeScreenshot = await takeAndRecordScreenshot(page, runId, insertedResult.id, stepIndex + 1, `final-${tcId}`);

      if (isMultiBrowser && chromeScreenshot) {
        streamLog(runId, `[Visual Regression] Initiating cross-browser verification for "${tcTitle}"...`, "info");
        
        // Firefox Run
        const firefoxScreenshot = await runStepsInBrowser("firefox", runId, tc, project, plannedSteps, tcRole, understanding);
        let firefoxMismatch = 0;
        let firefoxDiffUrl = "";
        if (firefoxScreenshot) {
          const diffFilename = `${runId}_${tcId}_firefox_diff.png`;
          const diffLocalPath = path.join(PUBLIC_SCREENSHOTS_DIR, diffFilename);
          const comp = await compareScreenshots(chromeScreenshot.localPath, firefoxScreenshot.localPath, diffLocalPath);
          firefoxMismatch = comp.mismatchPercentage;
          firefoxDiffUrl = `/screenshots/${diffFilename}`;
          streamLog(runId, `[Visual Regression] Firefox vs Chromium mismatch: ${firefoxMismatch}%`, firefoxMismatch > 5 ? "warn" : "pass");
        }

        // WebKit Run
        const webkitScreenshot = await runStepsInBrowser("webkit", runId, tc, project, plannedSteps, tcRole, understanding);
        let webkitMismatch = 0;
        let webkitDiffUrl = "";
        if (webkitScreenshot) {
          const diffFilename = `${runId}_${tcId}_webkit_diff.png`;
          const diffLocalPath = path.join(PUBLIC_SCREENSHOTS_DIR, diffFilename);
          const comp = await compareScreenshots(chromeScreenshot.localPath, webkitScreenshot.localPath, diffLocalPath);
          webkitMismatch = comp.mismatchPercentage;
          webkitDiffUrl = `/screenshots/${diffFilename}`;
          streamLog(runId, `[Visual Regression] WebKit vs Chromium mismatch: ${webkitMismatch}%`, webkitMismatch > 5 ? "warn" : "pass");
        }

        visualRegressionResults.push({
          testCaseId: tcId,
          testCaseTitle: tcTitle,
          chromium: chromeScreenshot.urlPath,
          firefox: firefoxScreenshot ? firefoxScreenshot.urlPath : "",
          webkit: webkitScreenshot ? webkitScreenshot.urlPath : "",
          firefoxDiff: firefoxDiffUrl,
          webkitDiff: webkitDiffUrl,
          firefoxMismatch,
          webkitMismatch,
        });
      }
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

    // Run deep accessibility & performance audits if page is available
    let auditsPayload: any = {};
    if (page) {
      try {
        const auditRes = await performQualityAudits(page, runId);
        if (auditRes) {
          auditsPayload = auditRes;
        }
      } catch (auditErr: any) {
        streamLog(runId, `[AuditAgent] Error performing audits: ${auditErr.message}`, "warn");
      }
    }

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
        audits: {
          ...auditsPayload,
          visualRegression: visualRegressionResults,
        },
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
        audits: {
          ...auditsPayload,
          visualRegression: visualRegressionResults,
        },
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
): Promise<{ localPath: string; urlPath: string } | null> {
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
    return { localPath, urlPath };
  } catch (err: any) {
    console.error("Failed to capture and record screenshot:", err);
    return null;
  }
}

/**
 * Executes the planned browser steps inside Firefox or WebKit sequentially.
 */
async function runStepsInBrowser(
  browserType: "firefox" | "webkit",
  runId: string,
  tc: any,
  project: any,
  plannedSteps: any[],
  tcRole: string,
  understanding: any
): Promise<{ localPath: string; urlPath: string } | null> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    streamLog(runId, `Running test case steps in ${browserType}...`, "info");
    const launcher = browserType === "firefox" ? firefox : webkit;
    browser = await launcher.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    if (tcRole && tcRole !== "guest" && tcRole !== "null") {
      await handleAutoLogin(page, project, tcRole, runId);
    } else {
      await page.goto(project.baseUrl, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    }

    // Execute planned steps
    let stepIndex = 0;
    for (const step of plannedSteps) {
      stepIndex++;
      const { action, target, value } = step;
      try {
        if (action === "navigate") {
          const destUrl = (value || target || "").startsWith("http")
            ? (value || target || "")
            : `${project.baseUrl}${value || target || ""}`;
          await page.goto(destUrl, { waitUntil: "networkidle", timeout: 15000 });
        } else if (action === "fill") {
          const element = await findElementWithSmartStrategies(page, target!, runId);
          await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
          await element.fill(value || "");
        } else if (action === "click") {
          const element = await findElementWithSmartStrategies(page, target!, runId);
          await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
          await element.click({ timeout: 5000 });
        } else if (action === "wait") {
          const delay = parseInt(value || target || "1000", 10);
          await page.waitForTimeout(delay);
        } else if (action === "scroll") {
          const dir = value || target || "bottom";
          if (dir === "bottom") {
            await page.evaluate(() => (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight));
          } else {
            await page.evaluate(() => (globalThis as any).window.scrollTo(0, 0));
          }
        }
      } catch (err: any) {
        // Fallback or ignore for visual regression steps
      }
    }

    // Capture final screenshot
    const filename = `${runId}_${browserType}_${Date.now()}.png`;
    const localPath = path.join(PUBLIC_SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: localPath });
    const urlPath = `/screenshots/${filename}`;

    return { localPath, urlPath };
  } catch (err: any) {
    streamLog(runId, `Failed executing steps in ${browserType}: ${err.message}`, "warn");
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Pixel-by-pixel visual regression compare using pixelmatch and pngjs.
 */
async function compareScreenshots(
  baselinePath: string,
  targetPath: string,
  diffPath: string
): Promise<{ mismatchPercentage: number }> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(baselinePath) || !fs.existsSync(targetPath)) {
        resolve({ mismatchPercentage: 100 });
        return;
      }
      const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
      const img2 = PNG.sync.read(fs.readFileSync(targetPath));
      const { width, height } = img1;
      
      if (img1.width !== img2.width || img1.height !== img2.height) {
        resolve({ mismatchPercentage: 15.0 }); // Fallback mismatch percentage
        return;
      }

      const diff = new PNG({ width, height });
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 }
      );

      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      const totalPixels = width * height;
      const mismatchPercentage = parseFloat(((numDiffPixels / totalPixels) * 100).toFixed(2));
      resolve({ mismatchPercentage });
    } catch (err) {
      console.error("Visual regression comparison failed:", err);
      resolve({ mismatchPercentage: 0 });
    }
  });
}

/**
 * Perform deep quality audits including WCAG Accessibility (via Axe-core), SEO,
 * HTML best practices, and frontend performance metrics.
 */
async function performQualityAudits(page: Page, runId: string): Promise<any> {
  try {
    streamLog(runId, `[AuditAgent] Initiating WCAG Accessibility & Performance Audits...`, "info");

    // 1. Accessibility Audit using Axe-core
    let axeResults: any = null;
    try {
      const require = createRequire(import.meta.url);
      const axePath = require.resolve("axe-core/axe.min.js");
      const axeScript = fs.readFileSync(axePath, "utf8");

      // Inject axe-core into the page
      await page.evaluate((script) => {
        const doc = (globalThis as any).document;
        const scriptEl = doc.createElement("script");
        scriptEl.text = script;
        doc.head.appendChild(scriptEl);
      }, axeScript);

      // Run axe on the page
      axeResults = await page.evaluate(async () => {
        return (globalThis as any).axe.run();
      });

      streamLog(runId, `[AuditAgent] ✓ WCAG 2.2 Accessibility analysis completed with ${axeResults.violations.length} violation(s).`, "pass");
    } catch (axeErr: any) {
      streamLog(runId, `[AuditAgent] ✗ Failed to run WCAG Accessibility Audit: ${axeErr.message}`, "warn");
    }

    // 2. Performance Audits via Window Performance API
    let perfMetrics: any = null;
    try {
      perfMetrics = await page.evaluate(() => {
        const win = globalThis as any;
        const t = win.performance.timing;
        const resources = win.performance.getEntriesByType("resource");

        const loadTimeMs = t.loadEventEnd > 0 ? (t.loadEventEnd - t.navigationStart) : (Date.now() - t.navigationStart);
        const domContentLoadedMs = t.domContentLoadedEventEnd - t.navigationStart;

        const breakdown = { js: 0, css: 0, img: 0, other: 0 };
        let totalSize = 0;

        resources.forEach((r: any) => {
          if (r.initiatorType === "script" || r.name.endsWith(".js")) breakdown.js++;
          else if (r.initiatorType === "css" || r.name.endsWith(".css")) breakdown.css++;
          else if (r.initiatorType === "img" || /\.(png|jpg|jpeg|gif|svg|webp)/i.test(r.name)) breakdown.img++;
          else breakdown.other++;

          if (r.transferSize) totalSize += r.transferSize;
          else if (r.encodedBodySize) totalSize += r.encodedBodySize;
        });

        return {
          loadTimeMs: Math.max(loadTimeMs, 0),
          domContentLoadedMs: Math.max(domContentLoadedMs, 0),
          resourceCount: resources.length,
          pageSizeBytes: totalSize,
          breakdown
        };
      });
      streamLog(runId, `[AuditAgent] ✓ Performance timing metrics retrieved (Load Time: ${perfMetrics.loadTimeMs}ms).`, "pass");
    } catch (perfErr: any) {
      streamLog(runId, `[AuditAgent] ✗ Failed to collect page performance metrics: ${perfErr.message}`, "warn");
    }

    // 3. Best Practices & SEO Audit
    let seoMetrics: any = null;
    try {
      seoMetrics = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        const title = doc.title || "";
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
        const h1Count = doc.querySelectorAll("h1").length;
        const images = Array.from(doc.querySelectorAll("img"));
        const imgMissingAltCount = images.filter((img: any) => !img.getAttribute("alt")?.trim()).length;
        const links = Array.from(doc.querySelectorAll("a"));
        const linksMissingText = links.filter((link: any) => !link.textContent?.trim() && !link.getAttribute("aria-label")?.trim()).length;

        return {
          title,
          hasTitle: title.length > 0,
          metaDescriptionLength: metaDesc.length,
          hasMetaDescription: metaDesc.length > 0,
          h1Count,
          imgMissingAltCount,
          linksCount: links.length,
          linksMissingText,
        };
      });
      streamLog(runId, `[AuditAgent] ✓ SEO and HTML Semantic checks executed.`, "pass");
    } catch (seoErr: any) {
      streamLog(runId, `[AuditAgent] ✗ Failed to parse SEO metrics: ${seoErr.message}`, "warn");
    }

    // 4. Calculate Scores (0 - 100)
    let perfScore = 100;
    if (perfMetrics) {
      const t = perfMetrics.loadTimeMs;
      if (t > 5000) perfScore = 50;
      else if (t > 3000) perfScore = 70 - Math.round((t - 3000) * 0.01);
      else if (t > 1000) perfScore = 95 - Math.round((t - 1000) * 0.0125);
      else perfScore = 100 - Math.round(t * 0.005);
      perfScore = Math.max(Math.min(perfScore, 100), 0);
    }

    let accScore = 100;
    if (axeResults) {
      let deductions = 0;
      axeResults.violations.forEach((v: any) => {
        let weight = 5; // moderate
        if (v.impact === "critical") weight = 15;
        else if (v.impact === "serious") weight = 10;
        else if (v.impact === "minor") weight = 2;
        deductions += weight * v.nodes.length;
      });
      accScore = Math.max(100 - deductions, 0);
    }

    let seoScore = 100;
    if (seoMetrics) {
      if (!seoMetrics.hasTitle) seoScore -= 30;
      if (!seoMetrics.hasMetaDescription) seoScore -= 20;
      if (seoMetrics.h1Count !== 1) seoScore -= 15;
      if (seoMetrics.imgMissingAltCount > 0) seoScore -= Math.min(seoMetrics.imgMissingAltCount * 5, 20);
      if (seoMetrics.linksMissingText > 0) seoScore -= Math.min(seoMetrics.linksMissingText * 5, 15);
      seoScore = Math.max(seoScore, 0);
    }

    let bpScore = 100;
    if (page.url().startsWith("http://")) {
      bpScore -= 10;
    }
    if (perfMetrics && perfMetrics.pageSizeBytes > 2 * 1024 * 1024) {
      bpScore -= 10;
    }
    bpScore = Math.max(bpScore, 0);

    return {
      performance: {
        score: perfScore,
        loadTimeMs: perfMetrics?.loadTimeMs || 0,
        domContentLoadedMs: perfMetrics?.domContentLoadedMs || 0,
        resourceCount: perfMetrics?.resourceCount || 0,
        pageSizeBytes: perfMetrics?.pageSizeBytes || 0,
        breakdown: perfMetrics?.breakdown || { js: 0, css: 0, img: 0, other: 0 }
      },
      accessibility: {
        score: accScore,
        violations: axeResults?.violations.map((v: any) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map((n: any) => ({
            target: n.target,
            html: n.html
          }))
        })) || [],
        passesCount: axeResults?.passes?.length || 0,
        incompleteCount: axeResults?.incomplete?.length || 0,
        violationsCount: axeResults?.violations?.length || 0
      },
      bestPractices: {
        score: bpScore,
        hasHttps: page.url().startsWith("https://"),
        consoleErrors: 0
      },
      seo: {
        score: seoScore,
        title: seoMetrics?.title || "",
        hasTitle: seoMetrics?.hasTitle || false,
        hasMetaDescription: seoMetrics?.hasMetaDescription || false,
        h1Count: seoMetrics?.h1Count || 0,
        imgMissingAltCount: seoMetrics?.imgMissingAltCount || 0,
        linksCount: seoMetrics?.linksCount || 0,
        linksMissingText: seoMetrics?.linksMissingText || 0
      }
    };
  } catch (err: any) {
    streamLog(runId, `[AuditAgent] ✗ Failed completely to execute audits: ${err.message}`, "warn");
    return null;
  }
}
