import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeTranscriptMoments } from "@/lib/analysis/ai-moment-analyzer";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  videoDuration: z.number().positive().max(24 * 60 * 60).optional(),
  segments: z.array(z.object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    text: z.string().trim().min(1).max(1_000)
  }).refine((segment) => segment.end > segment.start, {
    message: "O fim do segmento precisa ser maior que o início."
  })).min(1).max(1_000)
});

function hasValidInternalKey(request: Request, expected: string) {
  const provided = request.headers.get("x-viralcut-internal-key") ?? "";
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const internalKey = process.env.VIRALCUT_INTERNAL_API_KEY;
  if (!internalKey) {
    return NextResponse.json(
      { error: "Análise interna ainda não foi habilitada neste ambiente." },
      { status: 503 }
    );
  }

  if (!hasValidInternalKey(request, internalKey)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie um JSON válido." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Transcrição inválida.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.videoDuration && parsed.data.segments.some((segment) => segment.end > parsed.data.videoDuration!)) {\n    return NextResponse.json(\n      { error: "Há segmentos que ultrapassam a duração informada do vídeo." },\n      { status: 400 }\n    );\n  }\n\n  const totalCharacters = parsed.data.segments.reduce(
    (total, segment) => total + segment.text.length,
    0
  );
  if (totalCharacters > 60_000) {
    return NextResponse.json(
      { error: "A transcrição excede o limite de 60 mil caracteres por análise." },
      { status: 413 }
    );
  }

  try {
    const result = await analyzeTranscriptMoments(
      parsed.data.segments,
      parsed.data.videoDuration
    );

    return NextResponse.json({
      status: "completed",
      analysis: "transcript",
      model: result.model,
      moments: result.moments,
      usage: result.usage
    });
  } catch (error) {
    console.error("ViralCut AI transcript analysis failed:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir a análise com IA. Tente novamente mais tarde." },
      { status: 502 }
    );
  }
}
