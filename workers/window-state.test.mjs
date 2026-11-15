import { describe, expect, it } from "vitest";
import { claimWindow, completeWindow, failWindow, windowQueueSummary } from "./window-state.mjs";

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
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(claimWindow(state, name, attempt * 1_000)).toBe(true);
      failWindow(state, name, new Error("simulated failure"), attempt * 1_000);
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
});
