import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 30 * 60_000;

export async function loadWindowState(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    if (Array.isArray(parsed.completed)) {
      return {
        version: 1,
        windows: Object.fromEntries(parsed.completed.map(name => [name, {
          status: "completed", attempts: 1, completedAt: parsed.updatedAt ?? new Date(0).toISOString()
        }]))
      };
    }
    return parsed && parsed.version === 1 && parsed.windows && typeof parsed.windows === "object"
      ? parsed
      : { version: 1, windows: {} };
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, windows: {} };
    throw error;
  }
}

export async function saveWindowState(filePath, state) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + "." + process.pid + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(temporary, filePath);
}

export function claimWindow(state, name, now = Date.now(), leaseMs = 20 * 60_000) {
  const previous = state.windows[name];
  if (previous?.status === "completed" || previous?.status === "dead") return false;
  if (previous?.status === "processing" && Date.parse(previous.leaseUntil ?? "") > now) return false;
  if (previous?.status === "retry" && Date.parse(previous.nextAttemptAt ?? "") > now) return false;
  const attempts = (previous?.attempts ?? 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    state.windows[name] = { ...previous, status: "dead", attempts: MAX_ATTEMPTS, failedAt: new Date(now).toISOString() };
    return false;
  }
  state.windows[name] = {
    ...previous,
    status: "processing",
    attempts,
    startedAt: new Date(now).toISOString(),
    leaseUntil: new Date(now + leaseMs).toISOString(),
    lastError: undefined
  };
  return true;
}

export function completeWindow(state, name, now = Date.now()) {
  state.windows[name] = {
    ...state.windows[name],
    status: "completed",
    completedAt: new Date(now).toISOString(),
    leaseUntil: undefined,
    nextAttemptAt: undefined,
    lastError: undefined
  };
}

export function failWindow(state, name, error, now = Date.now()) {
  const previous = state.windows[name] ?? { attempts: 1 };
  const attempts = previous.attempts ?? 1;
  const terminal = attempts >= MAX_ATTEMPTS;
  const delay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, attempts - 1)));
  state.windows[name] = {
    ...previous,
    status: terminal ? "dead" : "retry",
    failedAt: new Date(now).toISOString(),
    nextAttemptAt: terminal ? undefined : new Date(now + delay).toISOString(),
    leaseUntil: undefined,
    lastError: String(error?.message ?? error ?? "Erro desconhecido").slice(0, 1200)
  };
}

export function windowQueueSummary(state) {
  const counts = { pending: 0, processing: 0, retry: 0, completed: 0, dead: 0 };
  for (const item of Object.values(state.windows)) {
    if (counts[item.status] !== undefined) counts[item.status]++;
  }
  return counts;
}
