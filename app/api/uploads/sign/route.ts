import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { videoUploadSchema } from "@/lib/media/validation";
import { createVideoUploadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

function hasValidUploadKey(request: NextRequest) {
  const expected = process.env.VIRALCUT_UPLOAD_API_KEY;
  const received = request.headers.get("x-viralcut-upload-key");
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: NextRequest) {
  if (!hasValidUploadKey(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = videoUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do vídeo inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const upload = await createVideoUploadUrl(parsed.data);
    return NextResponse.json(upload, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("ViralCut upload URL error:", error);
    return NextResponse.json(
      { error: "O armazenamento de vídeos não está configurado." },
      { status: 503 }
    );
  }
}
