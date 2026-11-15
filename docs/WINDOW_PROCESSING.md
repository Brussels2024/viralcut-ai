# Automatic live-window processing

The persistent processor consumes closed MP4 entries from the CSV manifest produced by `live-capture.mjs`. For each window it probes the media, extracts mono 16 kHz audio, requests timestamped transcription, measures RMS/peak audio levels, detects scene changes with FFmpeg, submits available signals to the protected ViralCut AI endpoint, and renders selected moments as vertical 1080×1920 MP4 files.

## Required environment

- `SESSION_ID`: same session used by capture.
- `VIRALCUT_CAPTURE_DIR`: shared capture root (default `./data/captures`).
- `VIRALCUT_CLIPS_DIR`: output folder (default `<session>/clips`).
- `VIRALCUT_API_BASE_URL`: deployed ViralCut app URL, no trailing slash.
- `VIRALCUT_INTERNAL_API_KEY`: same private key configured on the app.
- `OPENAI_API_KEY`: separate key with audio transcription access.
- Optional: `VIRALCUT_TRANSCRIPTION_MODEL` (default `whisper-1`), `FFMPEG_PATH`, `FFPROBE_PATH`, `VIRALCUT_PROCESS_POLL_MS`.

The web app also needs its server-side AI Gateway configuration, including `AI_GATEWAY_MODEL` if the default model is not desired.

## Run with Docker Compose

1. Copy `.env.live.example` to `.env.live` on the worker host.
2. Replace every placeholder. Keep `.env.live` private; it is excluded from Git.
3. Ensure the RTMP/RTMPS/SRT ingest URL is a direct stream input, not a public watch-page URL.
4. Start both persistent services:

```sh
docker compose -f docker-compose.live.yml up -d --build
docker compose -f docker-compose.live.yml logs -f
```

The capture and processor containers share a persistent Docker volume. To stop gracefully:

```sh
docker compose -f docker-compose.live.yml down
```

For local development, run `npm run process:windows` alongside `npm run capture:live` after installing FFmpeg and setting the same environment variables.

## Queue behavior

- Only closed MP4 segments listed by FFmpeg are considered.
- Each window is tracked in `processed-windows.json` with `processing`, `retry`, `completed`, or `dead` status.
- Failed windows retry up to five attempts with exponential backoff; one failed window does not block later windows.
- Processing leases allow interrupted jobs to be reclaimed after expiry.
- A lock directory prevents two processors from consuming the same session simultaneously. If the host is forcibly terminated and leaves `.processor-lock` behind, first verify no processor is running, then remove that directory before restarting.
- Original source videos are never deleted.
- Temporary audio is stored under `<session>/.processing`; protect and rotate the host disk.
- The initial vertical layout uses centered letterboxing, not AI face tracking. Captions and platform chat connectors are separate follow-up stages.
- The AI can return fewer than ten moments, including zero, when quality is insufficient.

## Operational limits

This worker requires a persistent host/container with FFmpeg and shared durable storage. It is not suitable for a short-lived Vercel Function. A real stream run still requires a valid ingest URL, configured API secrets, AI/transcription access, and an operational host. Never expose internal API keys in browser code.
