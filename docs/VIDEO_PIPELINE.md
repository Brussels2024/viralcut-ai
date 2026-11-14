# ViralCut AI — Video pipeline

## Current foundation

- Video MIME/size validation in `lib/media/validation.ts`.
- Cloudflare R2 private-object storage adapter in `lib/storage/r2.ts`.
- Health endpoint at `GET /api/health`.

The storage adapter creates a 10-minute, single-object presigned PUT URL. It must only be called by an authenticated server route after checking that the user owns the target workspace. The browser must never receive R2 credentials.

## Required infrastructure

1. Create a private Cloudflare R2 bucket.
2. Create an R2 API token limited to that bucket with object read/write permissions.
3. Add the four R2 variables from `.env.example` to the deployment environment.
4. Configure bucket CORS for the production app origin and local development origin, allowing PUT and the Content-Type header.

## Processing stages

1. Upload original media to private object storage.
2. Create a persistent media record and processing job in the database.
3. Extract audio and generate a timestamped transcript.
4. Score candidate moments using speech, pauses, emphasis, reactions and available engagement signals.
5. Render selected moments in 9:16 with active captions and speaker-aware framing.
6. Store rendered clips and expose authenticated download links.

## Safety and platform access

Only process media the account owner is authorized to use. Platform ingestion must use supported APIs, OAuth scopes and platform terms. Do not scrape private streams or bypass access controls.

## Not implemented yet

Authentication, database persistence, queue workers, transcription, AI moment scoring, FFmpeg rendering and live ingestion are not yet active. The health endpoint reports these capabilities as unavailable until implemented.