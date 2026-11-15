# Automatic live-window processing

A persistent worker consumes the CSV manifest created by `live-capture.mjs`. For every closed MP4 window it probes duration, extracts mono 16 kHz MP3, transcribes with timestamped segments using the OpenAI audio transcription API, measures RMS energy and peak level for each transcript interval from decoded PCM audio, detects visual scene changes with FFmpeg, and submits the transcript plus measured audio/video signals to the protected ViralCut AI endpoint, and renders selected moments as 1080×1920 MP4 files.

## Required environment

- `SESSION_ID`: same session used by capture.
- `VIRALCUT_CAPTURE_DIR`: same capture root (default `./data/captures`).
- `VIRALCUT_CLIPS_DIR`: optional output folder (default `<session>/clips`).
- `VIRALCUT_API_BASE_URL`: deployed ViralCut app URL, no trailing slash.
- `VIRALCUT_INTERNAL_API_KEY`: same server-side key configured on the app.
- `OPENAI_API_KEY`: key with audio transcription access.
- Optional: `VIRALCUT_TRANSCRIPTION_MODEL` (default `whisper-1`), `FFMPEG_PATH`, `FFPROBE_PATH`, `VIRALCUT_PROCESS_POLL_MS`.

Run alongside capture with `npm run process:windows`.

## Guarantees and limitations

- Only closed segments listed by FFmpeg are processed.
- Successful source windows are persisted in `processed-windows.json`; failures retry on later polls.
- Source videos are never deleted.
- Temporary audio is stored under `<session>/.processing`; secure and rotate the host disk.
- The first vertical format uses centered letterboxing, not AI face tracking. Captions are a later stage.
- Analysis returns up to ten strong moments and may return fewer or none.
- This process must run on a persistent host/container, not a Vercel Function.
