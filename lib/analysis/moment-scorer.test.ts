import { describe, expect, it } from "vitest";
import { findBestMoments, type TranscriptSegment } from "./moment-scorer";

function makeSegments(count = 12, overrides: Partial<TranscriptSegment> = {}): TranscriptSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    start: index * 5,
    end: index * 5 + 5,
    text: "Este é um trecho de exemplo com conteúdo suficiente para análise.",
    ...overrides
  }));
}

describe("findBestMoments", () => {
  it("returns no moments when there are no valid transcript segments", () => {
    expect(findBestMoments([])).toEqual([]);
    expect(findBestMoments([
      { start: -1, end: 5, text: "inválido" },
      { start: 10, end: 10, text: "inválido" },
      { start: 0, end: 4, text: "   " }
    ])).toEqual([]);
  });

  it("returns windows within the configured duration limits", () => {
    const moments = findBestMoments(makeSegments(), {
      minDuration: 60,
      maxDuration: 90,
      maxResults: 4
    });

    expect(moments.length).toBeGreaterThan(0);
    expect(moments.every((moment) => moment.duration >= 60 && moment.duration <= 90)).toBe(true);
    expect(moments.every((moment) => moment.end - moment.start === moment.duration)).toBe(true);
  });

  it("prioritizes windows with strong supplied engagement and audio signals", () => {
    const calm = makeSegments(12);
    const energetic = makeSegments(12, {
      text: "MEU DEUS! Isso é inacreditável!!!",
      audio: { energy: 0.95, excitement: 0.98 },
      chat: { messagesPerMinute: 45, uniqueChatters: 30, emoteRatio: 0.9 },
      reactions: { laughter: 0.9, applause: 0.9, surprise: 1 }
    });

    const calmBest = findBestMoments(calm, { maxResults: 1 })[0];
    const energeticBest = findBestMoments(energetic, { maxResults: 1 })[0];

    expect(energeticBest.score).toBeGreaterThan(calmBest.score);
    expect(energeticBest.reasons.length).toBeGreaterThan(0);
  });

  it("respects a zero result limit", () => {
    expect(findBestMoments(makeSegments(), { maxResults: 0 })).toEqual([]);
  });

  it("does not fabricate engagement reasons when signals are absent", () => {
    const moments = findBestMoments(makeSegments(), { maxResults: 1 });
    expect(moments[0].reasons).toEqual(["conteúdo com sinais consistentes"]);
  });

  it("avoids selecting overlapping moments", () => {
    const moments = findBestMoments(makeSegments(36), {
      minDuration: 60,
      maxDuration: 60,
      maxResults: 8,
      minGapSeconds: 12
    });

    for (let index = 1; index < moments.length; index += 1) {
      expect(moments[index].start).toBeGreaterThanOrEqual(moments[index - 1].end + 12);
    }
  });
});
