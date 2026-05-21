import OpenAI from "openai";
import { db, credentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ENCRYPT_KEY = (process.env.SESSION_SECRET || "autoviva-encrypt-key-24chars!!").padEnd(32, "0").slice(0, 32);

export function getClient(): OpenAI {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    return new OpenAI({
      apiKey: groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  const apiKey = process.env.OPENAI_API_KEY || process.env.REPLIT_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Neither GROQ_API_KEY, OPENAI_API_KEY, nor REPLIT_AI_API_KEY is set in environment.");
  }
  if (process.env.REPLIT_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey,
      baseURL: "https://api.replit.com/v1/ai/openai",
    });
  }
  return new OpenAI({
    apiKey,
  });
}

export const MODEL = process.env.GROQ_API_KEY
  ? "llama-3.3-70b-versatile"
  : (process.env.OPENAI_MODEL || (process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "gpt-5.2"));


/**
 * Decrypt helper for passwords
 */
export function decrypt(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(":");
    if (textParts.length < 2) return encryptedText;
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedTextBuffer = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPT_KEY), iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedTextBuffer),
      decipher.final()
    ]).toString("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return encryptedText;
  }
}

/**
 * Agent 1: ProjectUnderstandingAgent
 * Evaluates the project metadata and outlines critical testing goals, modules and risk areas.
 */
export async function runProjectUnderstanding(project: {
  name: string;
  description: string | null;
  techStack: string | null;
  baseUrl: string;
}) {
  const prompt = `You are AutoViva AI's Project Understanding Agent.
Analyze the following project metadata:
Project Name: ${project.name}
Base URL: ${project.baseUrl}
Description: ${project.description ?? "Not specified"}
Tech Stack: ${project.techStack ?? "Not specified"}

Outline:
1. Expected main modules and features to evaluate.
2. Areas of high risk (e.g. database persistence, state management, form validations).
3. Recommended test case coverage.

Return a JSON object with this exact structure:
{
  "mainModules": ["string"],
  "riskAreas": ["string"],
  "suggestedTestCoverage": ["string"]
}

Return ONLY valid JSON, no markdown, no explaining.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("ProjectUnderstandingAgent failed:", err);
    return {
      mainModules: ["Authentication", "Dashboard", "Core Features"],
      riskAreas: ["Database Connectivity", "User Registration Flow"],
      suggestedTestCoverage: ["Verify login and core user interactions"],
    };
  }
}

/**
 * Agent 2: TestPlannerAgent
 * Translates/expands raw visual test steps to robust execution directives.
 */
export async function runTestPlanner(
  testCase: { title: string; description?: string | null; steps: any[] },
  understanding: any
) {
  const prompt = `You are AutoViva AI's Test Planner Agent.
Convert these raw visual test steps into robust Playwright directives.
Project context:
Modules: ${JSON.stringify(understanding.mainModules)}
Risk areas: ${JSON.stringify(understanding.riskAreas)}

Test Case Name: ${testCase.title}
Steps to translate:
${JSON.stringify(testCase.steps, null, 2)}

Standard actions: "navigate", "click", "fill", "wait", "screenshot", "assert_text", "assert_url", "assert_element", "scroll".
Provide a robust plan. Standardize selectors so that they locate form fields or buttons resiliently (e.g. using IDs, labels, names, or text content).

Return a JSON object with this exact structure:
{
  "plannedSteps": [
    { "action": "string", "target": "string or null", "value": "string or null", "reasoning": "string" }
  ]
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content).plannedSteps || testCase.steps;
  } catch (err) {
    console.error("TestPlannerAgent failed, using fallback steps:", err);
    return testCase.steps;
  }
}

/**
 * Agent 4: AssertionAgent
 * Performs semantically-aware verification of page status vs expected results.
 */
export async function runAssertion(input: {
  expected: { urlContains?: string | null; pageContains?: string | null; elementVisible?: string | null };
  actual: { url: string; textContent: string; visibleElements: string[] };
}) {
  const prompt = `You are AutoViva AI's Assertion Agent.
Evaluate whether the actual browser page state satisfies the expected assertion conditions.

Expected Assertion:
${JSON.stringify(input.expected, null, 2)}

Actual Page State:
URL: ${input.actual.url}
Page Text content: ${input.actual.textContent.slice(0, 1000)} ...
Visible elements on page: ${JSON.stringify(input.actual.visibleElements)}

Rules:
- If expected "urlContains" is provided, verify actual URL contains it.
- If expected "pageContains" is provided, verify actual text contains it semantically (or matches key phrases).
- If expected "elementVisible" is provided, check if it matches elements list.

Return a JSON object with this structure:
{
  "passed": boolean,
  "confidence": number, // 0 to 1
  "reason": "string describing why it passed or failed based on evidence"
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("AssertionAgent failed, using fallback assert:", err);
    // Simple deterministic fallback
    let passed = true;
    let reason = "Assertion checked deterministically.";
    if (input.expected.urlContains && !input.actual.url.includes(input.expected.urlContains)) {
      passed = false;
      reason = `URL ${input.actual.url} does not contain ${input.expected.urlContains}`;
    }
    if (input.expected.pageContains && !input.actual.textContent.toLowerCase().includes(input.expected.pageContains.toLowerCase())) {
      passed = false;
      reason = `Page text does not contain phrase "${input.expected.pageContains}"`;
    }
    return { passed, confidence: 0.9, reason };
  }
}

/**
 * Agent 5: RecoveryAgent
 * Self-healing mechanism when a selector fails or times out. Analyzes page state to find alternative target.
 */
export async function runRecovery(input: {
  failedAction: string;
  failedTarget: string;
  failedValue?: string | null;
  url: string;
  visibleElements: string[];
  htmlSnippet: string;
}) {
  const prompt = `You are AutoViva AI's self-healing Recovery Agent.
An automation script failed because it could not locate target element: "${input.failedTarget}" for action: "${input.failedAction}".

Context:
Current URL: ${input.url}
Visible interactive elements: ${JSON.stringify(input.visibleElements)}
HTML DOM Snippet of current page:
${input.htmlSnippet.slice(0, 1500)}

Suggest a recovery action. Can we find an alternative selector/target (e.g. another input, another button, another link, or different text) that does what was intended?
Return a plan to try up to 2 alternative targets.

Return a JSON object with this structure:
{
  "canRecover": boolean,
  "alternatives": [
    { "target": "string", "reason": "string why this selector is the best match" }
  ]
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("RecoveryAgent failed:", err);
    return { canRecover: false, alternatives: [] };
  }
}

/**
 * Agent 3: FormAutofillAgent
 * Synthesizes semantically consistent and valid input values to autofill forms on the fly.
 */
export async function runFormAutofillAgent(input: {
  url: string;
  fields: Array<{
    id: string;
    name: string;
    tagName: string;
    type: string;
    placeholder: string;
    ariaLabel: string;
    labelText: string;
    options: Array<{ value: string; text: string }>;
  }>;
  userInstruction?: string | null;
}) {
  const prompt = `You are AutoViva AI's Form Autofill Agent.
Analyze the visible form fields on the active page and synthesize a highly coherent, valid, and semantically consistent set of input values to fill out the form.

Current URL: ${input.url}
User Instruction: ${input.userInstruction || "Complete the form with appropriate standard mock values."}

Form Fields:
${JSON.stringify(input.fields, null, 2)}

Rules for value synthesis:
1. Every field value MUST make logical sense in relation to other fields (e.g. if name is "Alice Smith", email should be "alice.smith@example.com", phone should be a valid mock number, password should be secure, etc.).
2. For "password" type fields, generate a secure strong password string.
3. For "select" fields, you MUST choose exactly one of the available option values from the "options" list.
4. For checkboxes or radios, provide a valid value (e.g. "true", "false", or a matching option value).
5. If credit cards, billing, or CVVs are requested, use standard mock sandbox card details (e.g., standard visa 4111111111111111).
6. Match each value back to the fields list using their ID or name attributes.

Return a JSON object with this exact structure:
{
  "fills": [
    {
      "id": "string (field id or empty)",
      "name": "string (field name or empty)",
      "tagName": "string (tagName)",
      "type": "string (type)",
      "value": "string (the value to fill/select/toggle)",
      "reasoning": "string explaining the chosen value"
    }
  ]
}

Return ONLY valid JSON, no explaining, no markdown prefix.`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content).fills || [];
  } catch (err) {
    console.error("FormAutofillAgent failed:", err);
    return [];
  }
}

