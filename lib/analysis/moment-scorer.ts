export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  audio?: {
    energy?: number;
    excitement?: number;
  };
  chat?: {
    messagesPerMinute?: number;
    uniqueChatters?: number;
    emoteRatio?: number;
  };
  reactions?: {
    laughter?: number;
    applause?: number;
    surprise?: number;
  };
};

export type ScoredMoment = {
  start: number;
  end: number;
  duration: number;
  score: number;
  reasons: string[];
  transcript: string;
};

export type ScoringOptions = {
  minDuration?: number;
  maxDuration?: number;
  maxResults?: number;
  minGapSeconds?: number;
};

const DEFAULTS: Required<ScoringOptions> = {
  minDuration: 60,
  maxDuration: 90,
  maxResults: 8,
  minGapSeconds: 12
};

const HOOK_WORDS = [
  "inacreditável", "absurdo", "impossível", "nunca", "finalmente",
  "segredo", "descobri", "olha isso", "não acredito", "meu deus",
  "caramba", "sensacional", "errado", "cuidado", "por quê", "como assim"
];

function clamp01(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeRate(value: number | undefined, scale: number) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0;
  return clamp01(value / scale);
}

function textSignals(text: string) {
  const normalized = text.toLocaleLowerCase("pt-BR");
  const words = normalized.split(/\s+/).filter(Boolean);
  const hooks = HOOK_WORDS.filter((word) => normalized.includes(word)).length;
  const punctuation = (text.match(/[!?]/g) ?? []).length;
  const uppercaseWords = (text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b/g) ?? []).length;

  return {
    hook: clamp01(hooks / 2),
    emphasis: clamp01((punctuation + uppercaseWords) / 5),
    density: clamp01(words.length / 34)
  };
}

function scoreSegment(segment: TranscriptSegment) {
  const text = textSignals(segment.text);
  const audioEnergy = clamp01(segment.audio?.energy);
  const vocalExcitement = clamp01(segment.audio?.excitement);
  const chatVelocity = normalizeRate(segment.chat?.messagesPerMinute, 45);
  const chatters = normalizeRate(segment.chat?.uniqueChatters, 30);
  const emotes = clamp01(segment.chat?.emoteRatio);
  const laughter = clamp01(segment.reactions?.laughter);
  const applause = clamp01(segment.reactions?.applause);
  const surprise = clamp01(segment.reactions?.surprise);

  const score =
    text.hook * 0.16 +
    text.emphasis * 0.07 +
    text.density * 0.04 +
    audioEnergy * 0.12 +
    vocalExcitement * 0.18 +
    chatVelocity * 0.16 +
    chatters * 0.07 +
    emotes * 0.04 +
    laughter * 0.06 +
    applause * 0.05 +
    surprise * 0.05;

  const reasons: string[] = [];
  if (text.hook >= 0.5) reasons.push("fala com gancho");
  if (vocalExcitement >= 0.65) reasons.push("entonação intensa");
  if (audioEnergy >= 0.7) reasons.push("pico de energia");
  if (chatVelocity >= 0.65) reasons.push("chat acelerado");
  if (laughter >= 0.6) reasons.push("reação de humor");
  if (applause >= 0.6 || surprise >= 0.6) reasons.push("reação forte do público");

  return { score, reasons };
}

/**
 * Ranks transcript windows using only signals supplied by upstream services.
 * Missing engagement/audio signals are treated as neutral (zero), never fabricated.
 */
export function findBestMoments(
  segments: TranscriptSegment[],
  options: ScoringOptions = {}
): ScoredMoment[] {
  const config = { ...DEFAULTS, ...options };
  const valid = segments
    .filter((segment) =>
      Number.isFinite(segment.start) &&
      Number.isFinite(segment.end) &&
      segment.start >= 0 &&
      segment.end > segment.start &&
      segment.text.trim().length > 0
    )
    .sort((a, b) => a.start - b.start);

  if (!valid.length) return [];

  const scored = valid.map((segment) => ({
    segment,
    ...scoreSegment(segment)
  }));

  const candidates: ScoredMoment[] = [];
  for (const first of valid) {
    for (let duration = config.minDuration; duration <= config.maxDuration; duration += 5) {
      const start = first.start;
      const end = start + duration;
      const window = scored.filter(({ segment }) =>
        segment.end > start && segment.start < end
      );

      if (!window.length) continue;
      const coveredSeconds = window.reduce((sum, item) => {
        const overlap = Math.max(0, Math.min(item.segment.end, end) - Math.max(item.segment.start, start));
        return sum + overlap;
      }, 0);

      if (coveredSeconds < duration * 0.35) continue;

      const weightedScore = window.reduce((sum, item) => {
        const overlap = Math.max(0, Math.min(item.segment.end, end) - Math.max(item.segment.start, start));
        return sum + item.score * overlap;
      }, 0) / Math.max(coveredSeconds, 1);

      const peak = Math.max(...window.map((item) => item.score));
      const finalScore = Math.round(Math.min(1, weightedScore * 0.78 + peak * 0.22) * 100);
      const reasons = [...new Set(window.flatMap((item) => item.reasons))].slice(0, 4);
      const transcript = window
        .filter(({ segment }) => segment.start < end && segment.end > start)
        .map(({ segment }) => segment.text.trim())
        .join(" ");

      candidates.push({
        start,
        end,
        duration,
        score: finalScore,
        reasons: reasons.length ? reasons : ["conteúdo com sinais consistentes"],
        transcript
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.start - b.start);
  const selected: ScoredMoment[] = [];

  for (const candidate of candidates) {
    const overlaps = selected.some((item) =>
      candidate.start < item.end + config.minGapSeconds &&
      candidate.end > item.start - config.minGapSeconds
    );
    if (!overlaps) selected.push(candidate);
    if (selected.length >= config.maxResults) break;
  }

  return selected.sort((a, b) => a.start - b.start);
}