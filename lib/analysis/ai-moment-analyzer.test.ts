import { describe, expect, it } from "vitest";
import { validateAiMoments } from "./ai-moment-analyzer";

describe("validateAiMoments", () => {
  it("keeps only valid 60–90 second moments", () => {
    const result = validateAiMoments(JSON.stringify({
      moments: [
        { startSeconds: 0, endSeconds: 75, score: 90, title: "Bom corte", hook: "Gancho", description: "Descrição", hashtags: ["#viral"], reasons: ["gancho"] },
        { startSeconds: 100, endSeconds: 130, score: 99, title: "Curto demais", hook: "Gancho", description: "Descrição", hashtags: [], reasons: ["curto"] }
      ]
    }));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Bom corte");
  });

  it("rejects moments that exceed the video duration", () => {
    const result = validateAiMoments(JSON.stringify({
      moments: [
        { startSeconds: 50, endSeconds: 130, score: 90, title: "Fora do vídeo", hook: "Gancho", description: "Descrição", hashtags: [], reasons: ["limite"] }
      ]
    }), 120);
    expect(result).toHaveLength(0);
  });

  it("removes overlapping moments and keeps the higher score", () => {
    const result = validateAiMoments(JSON.stringify({
      moments: [
        { startSeconds: 0, endSeconds: 75, score: 80, title: "Primeiro", hook: "Gancho", description: "Descrição", hashtags: [], reasons: ["forte"] },
        { startSeconds: 40, endSeconds: 115, score: 95, title: "Segundo", hook: "Gancho", description: "Descrição", hashtags: [], reasons: ["mais forte"] }
      ]
    }));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Segundo");
  });

  it("accepts JSON wrapped in a markdown code fence", () => {
    const result = validateAiMoments('```json\n{"moments":[]}\n```');
    expect(result).toEqual([]);
  });
});


it("limits each analysis to the ten highest-scoring non-overlapping moments", () => {
  const moments = Array.from({ length: 11 }, (_, index) => ({
    startSeconds: index * 100,
    endSeconds: index * 100 + 70,
    score: 100 - index,
    title: `Momento ${index + 1}`,
    hook: "Gancho",
    description: "Descrição",
    hashtags: [],
    reasons: ["teste"]
  }));
  const result = validateAiMoments(JSON.stringify({ moments }));
  expect(result).toHaveLength(10);
  expect(result.some(moment => moment.title === "Momento 11")).toBe(false);
});
