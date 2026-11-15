# Live capture worker (RTMP/RTMPS/SRT)

This worker runs as a long-lived Node.js process on a machine/container that has FFmpeg installed. It is intentionally **not** deployed as a Vercel Function: continuous ingest needs a persistent process and local/attached storage.

## Run

Node.js 22+ and FFmpeg must be installed and available in PATH.

```bash
LIVE_INPUT_URL='rtmps://your-ingest-host/live/STREAM_KEY' \
SESSION_ID='live_2026_001' \
VIRALCUT_CAPTURE_DIR='./data/captures' \
VIRALCUT_WINDOW_SECONDS='600' \
node workers/live-capture.mjs
```

Supported input protocols: RTMP, RTMPS and SRT. A normal YouTube/Twitch webpage URL is not an ingest endpoint. Do not put stream credentials in source control or browser code.

## Output and window semantics

- Writes sequential MP4 files named `window-000000.mp4`, `window-000001.mp4`, etc.
- Default window length is 600 seconds (10 minutes); allowed range is 60–3600 seconds.
- Writes `windows.csv` as FFmpeg closes segments. A segment becomes eligible for analysis only after it is closed and listed.
- Uses stream copy to avoid CPU-heavy transcoding during capture. Segment boundaries depend on keyframes, so actual durations may drift from exactly 10:00 unless the broadcaster emits keyframes at a suitable interval.
- SIGINT/SIGTERM asks FFmpeg to finalize the current segment before exiting.

## Important current limits

This is the capture foundation only. It does not yet upload segments, enqueue analysis jobs, transcribe audio, inspect chat/reactions, score moments, or render clips. Those are subsequent pipeline stages. Storage must be monitored and rotated; this worker does not delete source segments automatically.
