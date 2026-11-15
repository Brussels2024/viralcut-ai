#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const WINDOW_SECONDS = Number.parseInt(process.env.VIRALCUT_WINDOW_SECONDS ?? "600", 10);
const OUTPUT_ROOT = path.resolve(process.env.VIRALCUT_CAPTURE_DIR ?? "./data/captures");
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function validateInput(raw) {
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("LIVE_INPUT_URL precisa ser uma URL válida."); }
  if (!["rtmp:", "rtmps:", "srt:"].includes(parsed.protocol)) {
    throw new Error("Protocolo não suportado. Use RTMP, RTMPS ou SRT; links comuns de páginas não são fontes de ingestão.");
  }
  if (parsed.username || parsed.password) throw new Error("Não coloque credenciais na URL. Use um segredo de ingestão protegido no ambiente.");
  return parsed.toString();
}

function safeSessionId(value) {
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(value)) throw new Error("SESSION_ID deve conter 3–64 caracteres: letras, números, _ ou -.");
  return value;
}

async function main() {
  const input = validateInput(process.env.LIVE_INPUT_URL ?? "");
  const sessionId = safeSessionId(process.env.SESSION_ID ?? "");
  if (!Number.isInteger(WINDOW_SECONDS) || WINDOW_SECONDS < 60 || WINDOW_SECONDS > 3600) {
    throw new Error("VIRALCUT_WINDOW_SECONDS deve estar entre 60 e 3600.");
  }

  const sessionDir = path.join(OUTPUT_ROOT, sessionId);
  await mkdir(sessionDir, { recursive: true });
  const outputPattern = path.join(sessionDir, "window-%06d.mp4");
  const manifestPath = path.join(sessionDir, "windows.csv");

  const args = [
    "-hide_banner", "-nostdin", "-y",
    "-i", input,
    "-map", "0:v:0", "-map", "0:a?",
    "-c", "copy",
    "-f", "segment",
    "-segment_time", String(WINDOW_SECONDS),
    "-reset_timestamps", "1",
    "-segment_format", "mp4",
    "-segment_list", manifestPath,
    "-segment_list_type", "csv",
    outputPattern
  ];

  console.log(JSON.stringify({
    event: "capture_started",
    sessionId,
    windowSeconds: WINDOW_SECONDS,
    outputDirectory: await realpath(sessionDir)
  }));

  const child = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "inherit"] });
  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: "capture_stopping", sessionId, signal }));
    child.kill("SIGINT");
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  child.once("error", (error) => {
    console.error(JSON.stringify({ event: "capture_error", message: error.message }));
    process.exitCode = 1;
  });
  child.once("close", (code, signal) => {
    console.log(JSON.stringify({ event: "capture_stopped", sessionId, code, signal }));
    if (code !== 0 && !stopping) process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "capture_configuration_error", message: error.message }));
  process.exitCode = 1;
});
