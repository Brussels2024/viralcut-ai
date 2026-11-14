import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const storageConfigured = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
  const aiGatewayConfigured = Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL
  );

  return NextResponse.json({
    name: "ViralCut AI API",
    status: "ok",
    capabilities: {
      videoStorage: storageConfigured,
      aiGateway: aiGatewayConfigured,
      transcriptAnalysis: aiGatewayConfigured && Boolean(process.env.VIRALCUT_INTERNAL_API_KEY),
      videoTranscription: false,
      liveIngestion: false,
      clipRendering: false
    },
    timestamp: new Date().toISOString()
  });
}
