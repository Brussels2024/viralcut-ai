# AI transcript analysis

ViralCut AI uses the Vercel AI SDK and Vercel AI Gateway so the model provider can be changed without rewriting the analysis pipeline.

## Current model

The default model is `google/gemini-3.1-flash-lite`, selected from the live AI Gateway catalog for text analysis and cost-conscious processing. Override it with `AI_GATEWAY_MODEL`. Model availability and pricing can change; verify the Gateway catalog before changing the default.

## Authentication

- On a Vercel deployment, AI Gateway can use the deployment's Vercel OIDC identity.
- For local development or another hosting provider, set `AI_GATEWAY_API_KEY`.
- Never commit an API key or expose it through a `NEXT_PUBLIC_*` variable.
- The analysis route also requires `VIRALCUT_INTERNAL_API_KEY` in the `x-viralcut-internal-key` request header. This temporary server-to-server guard prevents public visitors from consuming model credits before user authentication and authorization are implemented.

## Endpoint

`POST /api/ai/analyze-transcript`

Request:

```json
{
  "videoDuration": 3600,
  "segments": [
    { "start": 12.4, "end": 18.2, "text": "Texto reconhecido na transcrição..." }
  ]
}
```

The route accepts 1–1,000 timestamped transcript segments and up to 60,000 transcript characters. It returns up to eight non-overlapping moments, each between 60 and 90 seconds, with an AI score, title, opening hook, description, hashtags, and reasons. It may return fewer than eight or none when the transcript does not contain enough strong moments.

The model is instructed to use only transcript evidence. It must not invent chat activity, audience reactions, audio peaks, or emotions that were not supplied.

## Current boundary

This is the semantic transcript-analysis stage only. It does not yet extract audio from uploaded video, transcribe the media, analyze video frames, read live chat, render MP4 clips, or ingest OBS/RTMP. Those pipeline stages must feed timestamped segments into this endpoint.
