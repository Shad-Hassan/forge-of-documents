// Delivery helpers: print an HTML file to PDF with the Playwright headless shell,
// and build / write an unsent multipart .eml (HTML body + PDF attachment).
// Port of artifactHtml/src/hard_mode.py. Node built-ins only.

import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const CRLF = "\r\n";
const SHELL_PREFIX = "chromium_headless_shell-";

export interface EmlOptions {
  subject: string;
  emailHtml: string;
  pdfBytes?: Uint8Array;
  pdfName?: string;
  from: string;
  to?: string;
}

function isExecutableFile(p: string): boolean {
  try {
    if (!fs.statSync(p).isFile()) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function listDir(p: string): string[] {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

// Same selection as hard_mode.shell(): glob
// ~/.cache/ms-playwright/chromium_headless_shell-*/*/*headless*shell, keep
// executable files, sort, take the last.
export function findShell(): string {
  const root = path.join(os.homedir(), ".cache", "ms-playwright");
  const found: string[] = [];
  for (const top of listDir(root)) {
    if (!top.startsWith(SHELL_PREFIX)) continue;
    for (const sub of listDir(path.join(root, top))) {
      if (sub.startsWith(".")) continue;
      for (const entry of listDir(path.join(root, top, sub))) {
        if (entry.startsWith(".") || !/headless.*shell$/.test(entry)) continue;
        const full = path.join(root, top, sub, entry);
        if (isExecutableFile(full)) found.push(full);
      }
    }
  }
  if (found.length === 0) throw new Error("FAIL: no Playwright headless shell");
  found.sort();
  return found[found.length - 1];
}

// Same invocation and flag order as hard_mode.print_pdf().
export function printPdf(printHtmlPath: string, pdfPath: string): void {
  const shell = findShell();
  const abs = path.resolve(printHtmlPath);
  const uri =
    "file://" + encodeURI(abs).replace(/#/g, "%23").replace(/\?/g, "%3F");
  execFileSync(
    shell,
    [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=5000",
      `--print-to-pdf=${pdfPath}`,
      uri,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  const size = fs.statSync(pdfPath).size;
  if (size <= 10000) throw new Error(`PDF looks empty: ${pdfPath}`);
}

// The sender is never hardcoded. Set FORGE_EML_FROM in the environment.
export function defaultFrom(): string {
  const v = process.env.FORGE_EML_FROM;
  if (!v || !v.trim()) throw new Error("FORGE_EML_FROM is not set");
  return v.trim();
}

function assertHeaderSafe(name: string, value: string): void {
  if (/[\r\n]/.test(value)) throw new Error(`${name} must not contain CR or LF`);
}

function wrapBase64(buf: Buffer): string {
  const b64 = buf.toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join(CRLF);
}

// RFC 2047 base64 encoded-words, each at most 75 characters, split on code points.
function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const word = (s: string) =>
    "=?utf-8?b?" + Buffer.from(s, "utf8").toString("base64") + "?=";
  const words: string[] = [];
  let chunk = "";
  for (const ch of value) {
    const candidate = chunk + ch;
    if (word(candidate).length > 75 && chunk.length > 0) {
      words.push(word(chunk));
      chunk = ch;
    } else {
      chunk = candidate;
    }
  }
  if (chunk.length > 0) words.push(word(chunk));
  return words.join(" ");
}

// Builds a multipart/mixed message with the same header order as Python's write_eml:
// Content-Type, MIME-Version, Subject, From, X-Unsent (then To, if given).
export function buildEml(opts: EmlOptions): Buffer {
  assertHeaderSafe("subject", opts.subject);
  assertHeaderSafe("from", opts.from);
  if (opts.to !== undefined) assertHeaderSafe("to", opts.to);

  const boundary = "===============" + crypto.randomBytes(12).toString("hex") + "==";

  const outerHeaders = [
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "MIME-Version: 1.0",
    `Subject: ${encodeHeaderValue(opts.subject)}`,
    `From: ${opts.from}`,
    "X-Unsent: 1",
  ];
  if (opts.to !== undefined) outerHeaders.push(`To: ${opts.to}`);

  const htmlPart = [
    'Content-Type: text/html; charset="utf-8"',
    "MIME-Version: 1.0",
    "Content-Transfer-Encoding: base64",
  ].join(CRLF) + CRLF + CRLF + wrapBase64(Buffer.from(opts.emailHtml, "utf8"));

  const parts = [htmlPart];

  if (opts.pdfBytes !== undefined) {
    const name = opts.pdfName ?? "document.pdf";
    assertHeaderSafe("pdfName", name);
    const pdfPart = [
      "Content-Type: application/pdf",
      "MIME-Version: 1.0",
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${name.replace(/["\\]/g, "_")}"`,
    ].join(CRLF) + CRLF + CRLF + wrapBase64(Buffer.from(opts.pdfBytes));
    parts.push(pdfPart);
  }

  const body =
    parts.map((p) => `--${boundary}${CRLF}${p}${CRLF}`).join("") +
    `--${boundary}--${CRLF}`;

  return Buffer.from(outerHeaders.join(CRLF) + CRLF + CRLF + body, "utf8");
}

export function writeEml(filePath: string, opts: EmlOptions): void {
  fs.writeFileSync(filePath, buildEml(opts));
}

export interface NoteEmlOptions {
  subject: string;
  text: string;
  html: string;
  from: string;
  to?: string;
}

// plexio note mode (build_note.py) is NOT hard mode: multipart/ALTERNATIVE with a plain-text part and
// an HTML part, no PDF. Header order matches Python: Content-Type, MIME-Version, Subject, From, To?, X-Unsent.
export function buildNoteEml(opts: NoteEmlOptions): Buffer {
  assertHeaderSafe("subject", opts.subject);
  assertHeaderSafe("from", opts.from);
  if (opts.to !== undefined) assertHeaderSafe("to", opts.to);
  const boundary = "===============" + crypto.randomBytes(12).toString("hex") + "==";
  const headers = [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "MIME-Version: 1.0",
    `Subject: ${encodeHeaderValue(opts.subject)}`,
    `From: ${opts.from}`,
    ...(opts.to ? [`To: ${opts.to}`] : []),
    "X-Unsent: 1",
  ];
  const part = (type: string, body: string) =>
    [`Content-Type: ${type}; charset="utf-8"`, "MIME-Version: 1.0", "Content-Transfer-Encoding: base64"].join(CRLF) +
    CRLF + CRLF + wrapBase64(Buffer.from(body, "utf8"));
  const body =
    [part("text/plain", opts.text), part("text/html", opts.html)].map((p) => `--${boundary}${CRLF}${p}${CRLF}`).join("") +
    `--${boundary}--${CRLF}`;
  return Buffer.from(headers.join(CRLF) + CRLF + CRLF + body, "utf8");
}
