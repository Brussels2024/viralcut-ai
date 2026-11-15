# ViralCut AI

Aplicação web para transformar vídeos gravados e transmissões compatíveis em cortes verticais, com seleção inteligente dos melhores momentos.

## Stack inicial

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Lucide React

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## AI transcript analysis

The first AI-backed analysis endpoint is available at `POST /api/ai/analyze-transcript`. It uses the Vercel AI SDK and AI Gateway to rank timestamped transcript moments, then returns validated 60–90 second candidates with publishing metadata. See [`docs/AI_ANALYSIS.md`](docs/AI_ANALYSIS.md) for setup, authentication, and current limitations. Video transcription and rendering are not connected yet.

## Live capture worker

A persistent RTMP/RTMPS/SRT capture worker is available. It saves closed MP4 segments every 10 minutes by default. See [`docs/LIVE_CAPTURE.md`](docs/LIVE_CAPTURE.md). Run it with `npm run capture:live` after setting `LIVE_INPUT_URL` and `SESSION_ID`.

## Automatic live-window processing

The persistent `workers/process-windows.mjs` worker transcribes each closed segment, requests AI ranking, and renders selected vertical MP4 clips. Its durable queue tracks processing leases, retries transient failures with exponential backoff, moves repeatedly failing windows to a dead state, and resumes after restarts. Configure it using [`docs/WINDOW_PROCESSING.md`](docs/WINDOW_PROCESSING.md) and run `npm run process:windows` alongside the capture worker. A valid OpenAI transcription key, protected app endpoint, FFmpeg, and persistent shared storage are required. This is a worker implementation; a live end-to-end run still requires credentials, an ingest source, and a persistent host.

## Roadmap

1. Estrutura visual e experiência inicial.
2. Upload seguro e armazenamento de mídia.
3. Pipeline de ingestão e extração de áudio.
4. Transcrição e análise de momentos relevantes.
5. Geração de cortes verticais com legendas.
6. Exportação e histórico de projetos.
7. Integrações de lives e plataformas, respeitando APIs, permissões e direitos de conteúdo.

## Observação

A interface web ainda é um protótipo. Os trabalhadores de ingestão ao vivo e processamento por janela estão implementados, mas nenhuma transmissão real foi validada em produção. Transcrição, análise por IA e armazenamento exigem credenciais e infraestrutura persistente configuradas separadamente.