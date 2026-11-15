import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { claimWindow, completeWindow, failWindow, loadWindowState, saveWindowState, windowQueueSummary } from "./window-state.mjs";

describe("durable live-window queue", () => {
  it("claims a new window and prevents a second active claim", () => {
    const state = { version: 1, windows: {} };
    expect(claimWindow(state, "window-000001.mp4", 1_000)).toBe(true);
    expect(state.windows["window-000001.mp4"].status).toBe("processing");
    expect(claimWindow(state, "window-000001.mp4", 2_000)).toBe(false);
  });

  it("reclaims expired processing leases after a restart", () => {
    const state = { version: 1, windows: {} };
    claimWindow(state, "window-000001.mp4", 1_000, 5_000);
    expect(claimWindow(state, "window-000001.mp4", 7_000, 5_000)).toBe(true);
    expect(state.windows["window-000001.mp4"].attempts).toBe(2);
  });

  it("backs off after errors and eventually moves poison windows to dead", () => {
    const state = { version: 1, windows: {} };
    const name = "window-000002.mp4";
    let now = 1_000;
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(claimWindow(state, name, now)).toBe(true);
      failWindow(state, name, new Error("simulated failure"), now);
      now = state.windows[name].nextAttemptAt
        ? Date.parse(state.windows[name].nextAttemptAt)
        : now + 1_000;
    }
    expect(state.windows[name].status).toBe("dead");
    expect(state.windows[name].attempts).toBe(5);
    expect(claimWindow(state, name, 99_000_000)).toBe(false);
  });

  it("marks successful windows completed and counts queue states", () => {
    const state = { version: 1, windows: {} };
    claimWindow(state, "window-000003.mp4", 1_000);
    completeWindow(state, "window-000003.mp4", 2_000);
    expect(claimWindow(state, "window-000003.mp4", 99_000)).toBe(false);
    expect(windowQueueSummary(state)).toEqual({
      pending: 0, processing: 0, retry: 0, completed: 1, dead: 0
    });
  });

  it("uses exponential retry delay capped by the queue policy", () => {
    const state = { version: 1, windows: {} };
    const name = "window-000004.mp4";
    claimWindow(state, name, 10_000);
    failWindow(state, name, "temporary", 10_000);
    expect(Date.parse(state.windows[name].nextAttemptAt) - 10_000).toBe(30_000);
    expect(state.windows[name].status).toBe("retry");
  });

  it("persists queue state atomically and reloads it after restart", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "viralcut-queue-"));
    const file = path.join(directory, "processed-windows.json");
    try {
      const state = { version: 1, windows: {} };
      claimWindow(state, "window-000005.mp4", 1_000);
      failWindow(state, "window-000005.mp4", new Error("temporary"), 2_000);
      await saveWindowState(file, state);
      const restored = await loadWindowState(file);
      expect(restored.windows["window-000005.mp4"].status).toBe("retry");
      expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
