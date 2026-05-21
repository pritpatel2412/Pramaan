import { Router } from "express";
import { db, reportsTable, testRunsTable, testResultsTable, screenshotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { AskVivaAgentBody } from "@workspace/api-zod";
import { askVivaAgent } from "../lib/ai";
import fs from "fs";
import path from "path";
import os from "os";
import { getClient } from "../lib/agents";
import { chromium } from "playwright";
import OpenAI from "openai";

const router = Router();

router.get("/runs/:runId/report/pdf", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.runId, runId)).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not ready yet" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const frontendHost = process.env.FRONTEND_URL || "http://localhost:23013";

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // Navigate to front-end page first to get to the correct origin so we can set localStorage
    await page.goto(`${frontendHost}/`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.evaluate((t) => {
      localStorage.setItem("autoviva_token", t);
    }, token);

    // Now go to the print-enabled report route
    await page.goto(`${frontendHost}/runs/${runId}/report?print=true`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report-${runId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    res.status(500).json({ error: `Failed to generate PDF: ${err.message}` });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

router.get("/runs/:runId/report", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.runId, runId)).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not ready yet" });
    return;
  }

  const results = await db.select().from(testResultsTable).where(eq(testResultsTable.runId, runId));
  const screenshots = await db.select().from(screenshotsTable).where(eq(screenshotsTable.runId, runId));
  const screenshotsByResult = new Map<string, typeof screenshots>();
  for (const s of screenshots) {
    const key = s.resultId ?? "no-result";
    if (!screenshotsByResult.has(key)) screenshotsByResult.set(key, []);
    screenshotsByResult.get(key)!.push(s);
  }

  const enrichedResults = results.map(r => ({
    ...r,
    screenshots: (screenshotsByResult.get(r.id) ?? []).map(s => ({ id: s.id, url: s.url ?? s.filePath, stepNumber: s.stepNumber, label: s.label })),
  }));

  res.json({
    id: report.id,
    runId: report.runId,
    summary: report.summary,
    aiNotes: report.aiNotes,
    suggestions: report.suggestions ?? [],
    scoreBreakdown: report.scoreBreakdown ?? {},
    keyFindings: report.keyFindings ?? [],
    bugsFound: report.bugsFound ?? [],
    featureCoverage: report.featureCoverage ?? [],
    run,
    results: enrichedResults,
    generatedAt: report.generatedAt,
  });
});

router.post("/runs/:runId/ask", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  let question = req.body.question;
  let transcribedQuestion: string | null = null;

  if (req.body.audio) {
    try {
      const buffer = Buffer.from(req.body.audio, "base64");
      const tempFilePath = path.join(os.tmpdir(), `viva-voice-${runId}-${Date.now()}.webm`);
      fs.writeFileSync(tempFilePath, buffer);

      const client = getClient();
      const whisperModel = process.env.GROQ_API_KEY ? "whisper-large-v3" : "whisper-1";
      const response = await client.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: whisperModel,
      });

      transcribedQuestion = response.text;
      question = response.text;

      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (err: any) {
      console.error("Failed to transcribe voice payload:", err);
      if (!question) {
        res.status(500).json({ error: "Failed to transcribe audio and no text fallback provided." });
        return;
      }
    }
  }

  if (!question) {
    res.status(400).json({ error: "Invalid request body: Missing question or audio payload" });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.runId, runId)).limit(1);
  const results = await db.select().from(testResultsTable).where(eq(testResultsTable.runId, runId));

  const answer = await askVivaAgent({
    question,
    run,
    report,
    results,
  });

  let audioResponse: string | null = null;
  if (req.body.enableTts) {
    try {
      if (process.env.GROQ_API_KEY) {
        if (process.env.REPLIT_AI_API_KEY) {
          const replitClient = new OpenAI({
            apiKey: process.env.REPLIT_AI_API_KEY,
            baseURL: "https://api.replit.com/v1/ai/openai",
          });
          const mp3 = await replitClient.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: answer,
          });
          const audioBuffer = Buffer.from(await mp3.arrayBuffer());
          audioResponse = audioBuffer.toString("base64");
        } else if (process.env.OPENAI_API_KEY) {
          const openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          const mp3 = await openaiClient.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: answer,
          });
          const audioBuffer = Buffer.from(await mp3.arrayBuffer());
          audioResponse = audioBuffer.toString("base64");
        } else {
          console.warn("TTS requested, but Groq doesn't support TTS and no fallback key is set.");
        }
      } else {
        const client = getClient();
        const mp3 = await client.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: answer,
        });
        const audioBuffer = Buffer.from(await mp3.arrayBuffer());
        audioResponse = audioBuffer.toString("base64");
      }
    } catch (ttsErr) {
      console.error("TTS generation failed:", ttsErr);
    }
  }

  res.json({
    answer,
    question: transcribedQuestion ?? question,
    audioResponse,
    evidenceScreenshots: [],
    referencedTestCases: []
  });
});

export default router;
