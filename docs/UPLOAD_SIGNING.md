# Protected video upload signing

ViralCut AI stores original media in a private Cloudflare R2 bucket. The application server creates short-lived presigned PUT URLs; the browser must never receive R2 credentials or the signing key.

## Required environment variables

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `VIRALCUT_UPLOAD_API_KEY` — a long random secret used only by trusted server-to-server callers

Never prefix these values with `NEXT_PUBLIC_` or commit real values to Git.

## Endpoint

`POST /api/uploads/sign`

Headers:

- `Content-Type: application/json`
- `x-viralcut-upload-key: <server-only secret>`

Body:

```json
{
  "fileName": "live.mp4",
  "contentType": "video/mp4",
  "size": 73400320
}
```

The route validates the filename, MIME type and size (maximum 2 GiB), compares the secret in constant time, and returns a unique object key plus a presigned upload URL valid for 10 minutes. Upload the bytes to that URL using HTTP PUT and the exact `Content-Type` returned in `requiredHeaders`.

The endpoint is intentionally not wired to the public browser form yet: exposing its shared server-to-server key in client JavaScript would let anonymous visitors consume storage. Complete user authentication, per-user quotas and ownership records before enabling browser uploads.

## Health check

`GET /api/health` reports `capabilities.uploadSigning` as true only when all R2 credentials and the upload signing key are configured. This does not imply that public user uploads or a complete media-processing pipeline are enabled.
