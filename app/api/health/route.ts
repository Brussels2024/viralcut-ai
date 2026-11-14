import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const storageConfigured = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

  return NextResponse.json({
    name: "ViralCut AI API",
    status: "ok",
    capabilities: {
      videoStorage: storageConfigured,
      videoAnalysis: false,
      liveIngestion: false,
      clipRendering: false
    },
    timestamp: new Date().toISOString()
  });
}