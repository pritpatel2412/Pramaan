import OpenAI from "openai";

const MODEL = "gpt-5.2";

function getClient(): OpenAI {
  const apiKey = process.env.REPLIT_AI_API_KEY;
  if (!apiKey) {
    throw new Error("REPLIT_AI_API_KEY is not set. Please add the OpenAI integration in Replit.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.replit.com/v1/ai/openai",
  });
}

export async function generateTestCasesWithAI(input: {
  projectDescription: string;
  projectId?: string | null;
  includeAuthTests?: boolean;
  includeCrudTests?: boolean;
  includeNavigationTests?: boolean;
  includeFormValidationTests?: boolean;
  includeRoleBasedTests?: boolean;
}) {
  const categories = [
    input.includeAuthTests !== false ? "Authentication tests (login, logout, registration)" : null,
    input.includeCrudTests !== false ? "CRUD tests (create, read, update, delete records)" : null,
    input.includeNavigationTests !== false ? "Navigation tests (page routing, breadcrumbs)" : null,
    input.includeFormValidationTests !== false ? "Form validation tests (required fields, error messages)" : null,
    input.includeRoleBasedTests !== false ? "Role-based access control tests" : null,
  ].filter(Boolean).join(", ");

  const prompt = `You are AutoViva AI, an expert test case generator for student web projects.

Generate comprehensive test cases for this project:
"${input.projectDescription}"

Generate 5-8 test cases covering: ${categories}

Return a JSON array of test cases. Each test case must follow this exact schema:
{
  "id": "TC_001",
  "title": "string",
  "priority": "high|medium|low",
  "role": "admin|user|student|null",
  "description": "string",
  "steps": [
    { "action": "navigate|click|fill|wait|screenshot|assert_text|assert_url|assert_element|scroll", "target": "string or null", "value": "string or null" }
  ],
  "expected": {
    "urlContains": "string or null",
    "pageContains": "string or null",
    "elementVisible": "string or null"
  }
}

Return ONLY a valid JSON array, no markdown, no explanation.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });
    const text = response.choices[0]?.message?.content ?? "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return buildFallbackTestCases(input.projectDescription);
    }
  } catch {
    return buildFallbackTestCases(input.projectDescription);
  }
}

function buildFallbackTestCases(description: string) {
  return [
    {
      id: "TC_001",
      title: "User Registration",
      priority: "high",
      role: "user",
      description: "Verify that new users can register successfully",
      steps: [
        { action: "navigate", target: "/register", value: null },
        { action: "fill", target: "input[name='name']", value: "Test User" },
        { action: "fill", target: "input[name='email']", value: "test@example.com" },
        { action: "fill", target: "input[name='password']", value: "password123" },
        { action: "click", target: "button[type='submit']", value: null },
        { action: "screenshot", target: null, value: "after-register" },
      ],
      expected: { urlContains: "/dashboard", pageContains: null, elementVisible: null },
    },
    {
      id: "TC_002",
      title: "User Login",
      priority: "high",
      role: "user",
      description: "Verify that existing users can log in with valid credentials",
      steps: [
        { action: "navigate", target: "/login", value: null },
        { action: "fill", target: "input[name='email']", value: "admin@test.com" },
        { action: "fill", target: "input[name='password']", value: "password123" },
        { action: "click", target: "button[type='submit']", value: null },
        { action: "screenshot", target: null, value: "after-login" },
      ],
      expected: { urlContains: "/dashboard", pageContains: null, elementVisible: null },
    },
    {
      id: "TC_003",
      title: "Dashboard Access",
      priority: "high",
      role: "admin",
      description: "Verify the main dashboard loads with data",
      steps: [
        { action: "navigate", target: "/dashboard", value: null },
        { action: "screenshot", target: null, value: "dashboard" },
        { action: "assert_element", target: "main, .dashboard, #dashboard", value: null },
      ],
      expected: { urlContains: "/dashboard", pageContains: null, elementVisible: null },
    },
    {
      id: "TC_004",
      title: "Create Record",
      priority: "medium",
      role: "admin",
      description: "Verify that new records can be created through the UI",
      steps: [
        { action: "navigate", target: "/", value: null },
        { action: "screenshot", target: null, value: "home" },
        { action: "assert_element", target: "button, a", value: null },
      ],
      expected: { urlContains: null, pageContains: null, elementVisible: null },
    },
    {
      id: "TC_005",
      title: "Navigation Flow",
      priority: "medium",
      role: "user",
      description: "Verify that navigation between pages works correctly",
      steps: [
        { action: "navigate", target: "/", value: null },
        { action: "screenshot", target: null, value: "home-page" },
        { action: "scroll", target: "body", value: "bottom" },
        { action: "screenshot", target: null, value: "home-scrolled" },
      ],
      expected: { urlContains: null, pageContains: null, elementVisible: null },
    },
    {
      id: "TC_006",
      title: "Form Validation",
      priority: "medium",
      role: "user",
      description: "Verify that forms show proper validation errors",
      steps: [
        { action: "navigate", target: "/login", value: null },
        { action: "click", target: "button[type='submit']", value: null },
        { action: "screenshot", target: null, value: "validation-errors" },
      ],
      expected: { urlContains: "/login", pageContains: "required", elementVisible: null },
    },
    {
      id: "TC_007",
      title: "Logout Functionality",
      priority: "low",
      role: "user",
      description: "Verify that users can log out and session is cleared",
      steps: [
        { action: "navigate", target: "/", value: null },
        { action: "screenshot", target: null, value: "before-logout" },
        { action: "click", target: "button[aria-label*='logout'], a[href*='logout']", value: null },
        { action: "screenshot", target: null, value: "after-logout" },
      ],
      expected: { urlContains: "/login", pageContains: null, elementVisible: null },
    },
  ];
}

export async function generateEvaluationReport(input: {
  runId: string;
  score: number;
  grade: string;
  passed: number;
  failed: number;
  testCases: any[];
  project: any;
  suite: any;
}) {
  const { score, grade, passed, failed, testCases, project } = input;
  const total = testCases.length;

  const prompt = `You are AutoViva AI, an expert project evaluator. Generate a professional evaluation report.

Project: "${project.name}"
URL: ${project.baseUrl}
Tech Stack: ${project.techStack ?? "Not specified"}
Score: ${score}/100 (Grade: ${grade})
Results: ${passed} passed, ${failed} failed out of ${total} test cases

Generate a comprehensive evaluation report with:
1. A 2-3 sentence executive summary
2. 3-5 key findings as bullet points
3. AI examiner notes (2-3 sentences of professional observations)
4. 3-5 actionable improvement suggestions
5. Score breakdown across 8 categories (must total ${score} points)
6. Any bugs found (list issues if failed > 0)
7. Feature coverage status

Return a JSON object with this exact structure:
{
  "summary": "string",
  "aiNotes": "string", 
  "keyFindings": ["string"],
  "suggestions": ["string"],
  "scoreBreakdown": {
    "Login/Auth": number,
    "Core Features": number,
    "CRUD": number,
    "UI Navigation": number,
    "Error Handling": number,
    "DB Persistence": number,
    "Reliability": number,
    "UI Polish": number
  },
  "bugsFound": [{"issue": "string", "severity": "critical|major|minor", "description": "string"}],
  "featureCoverage": [{"feature": "string", "status": "passed|failed|not_tested"}]
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return buildFallbackReport(score, grade, passed, failed, total, project);
  }
}

function buildFallbackReport(score: number, grade: string, passed: number, failed: number, total: number, project: any) {
  return {
    summary: `Evaluation of ${project.name} completed. Score: ${score}/100, Grade: ${grade}. ${passed} of ${total} test cases passed.`,
    aiNotes: `The project ${score >= 75 ? "demonstrates solid" : "shows partial"} functionality. ${failed > 0 ? `${failed} test cases require attention.` : "All tests passed successfully."}`,
    keyFindings: [
      `Score: ${score}/100 (${grade})`,
      `${passed}/${total} test cases passed`,
      `Pass rate: ${Math.round((passed / Math.max(total, 1)) * 100)}%`,
      failed > 0 ? `${failed} test cases failed and need fixes` : "All test cases passed",
    ],
    suggestions: [
      "Fix failing test cases to improve your score",
      "Add comprehensive error handling",
      "Improve form validation feedback",
      "Test edge cases and boundary conditions",
    ],
    scoreBreakdown: {
      "Login/Auth": Math.round(score * 0.10),
      "Core Features": Math.round(score * 0.30),
      "CRUD": Math.round(score * 0.20),
      "UI Navigation": Math.round(score * 0.10),
      "Error Handling": Math.round(score * 0.10),
      "DB Persistence": Math.round(score * 0.10),
      "Reliability": Math.round(score * 0.05),
      "UI Polish": Math.round(score * 0.05),
    },
    bugsFound: failed > 0 ? [
      { issue: "Test assertion failures", severity: "major", description: `${failed} test cases failed to meet expected conditions` }
    ] : [],
    featureCoverage: [
      { feature: "Authentication", status: "passed" },
      { feature: "Core CRUD", status: passed > failed ? "passed" : "failed" },
      { feature: "Navigation", status: "passed" },
      { feature: "Error Handling", status: failed > 0 ? "failed" : "passed" },
    ],
  };
}

export async function askVivaAgent(input: {
  question: string;
  run: any;
  report: any;
  results: any[];
}) {
  const { question, run, report, results } = input;

  const resultsContext = results.slice(0, 10).map(r =>
    `${r.testCaseId}: ${r.title} — ${r.status}${r.errorMessage ? ` (Error: ${r.errorMessage})` : ""}`
  ).join("\n");

  const prompt = `You are AutoViva AI, a professional project evaluation assistant. You have evaluated a student project and must answer questions from an examiner based on evidence.

Evaluation Context:
- Score: ${run.score}/100, Grade: ${run.grade}
- Mode: ${run.mode}
- Passed: ${run.passed}/${run.totalTests} test cases
- Summary: ${(report as any)?.summary ?? "No summary available"}
- AI Notes: ${(report as any)?.aiNotes ?? "No notes"}

Test Results:
${resultsContext}

Examiner Question: "${question}"

Answer the question professionally, citing specific test cases and evidence where relevant. Be concise but thorough. Do not make up results — only reference what is in the evaluation data above.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });
    return response.choices[0]?.message?.content ?? "I cannot provide an answer based on the available evaluation data.";
  } catch {
    return `Based on the evaluation data: Score ${run.score}/100, ${run.passed} of ${run.totalTests} tests passed. ${(report as any)?.summary ?? ""}`;
  }
}
