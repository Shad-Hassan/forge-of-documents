import path from "node:path";
import os from "node:os";
import type { RootName } from "./types";

// Allowlisted, read-only search roots. Override with env for tests.
export const ROOTS: Record<RootName, string> = {
  artifacts:
    process.env.FORGE_ARTIFACTS_ROOT ??
    path.join(os.homedir(), "Documents/0_CurrentSessionDocuments/artifactHtml"),
  uploads: process.env.FORGE_UPLOADS_ROOT ?? path.join(process.cwd(), "data/uploads"),
};

/** Where forged outputs are written. Never a search root. */
export const OUT_DIR = process.env.FORGE_OUT_DIR ?? path.join(process.cwd(), "data/out");

/** Extensions uploads accept. */
export const UPLOAD_EXTS = [".pdf", ".docx", ".txt", ".md", ".html"] as const;
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
