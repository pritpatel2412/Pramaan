import { Router } from "express";
import { db, credentialsTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateCredentialBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

const ENCRYPT_KEY = (process.env.SESSION_SECRET || "autoviva-encrypt-key-24chars!!").padEnd(32, "0").slice(0, 32);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPT_KEY), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

router.get("/projects/:projectId/credentials", requireAuth, async (req, res) => {
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const creds = await db.select({
    id: credentialsTable.id,
    projectId: credentialsTable.projectId,
    role: credentialsTable.role,
    username: credentialsTable.username,
  }).from(credentialsTable).where(eq(credentialsTable.projectId, req.params.projectId));
  res.json(creds);
});

router.post("/projects/:projectId/credentials", requireAuth, async (req, res) => {
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const parsed = CreateCredentialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { role, username, password } = parsed.data;
  const [cred] = await db.insert(credentialsTable).values({
    projectId: req.params.projectId,
    role,
    username,
    passwordEncrypted: encrypt(password),
  }).returning();
  res.status(201).json({ id: cred.id, projectId: cred.projectId, role: cred.role, username: cred.username });
});

router.delete("/projects/:projectId/credentials/:credentialId", requireAuth, async (req, res) => {
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, req.params.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await db.delete(credentialsTable).where(and(
    eq(credentialsTable.id, req.params.credentialId),
    eq(credentialsTable.projectId, req.params.projectId)
  ));
  res.json({ message: "Credential deleted" });
});

export default router;
