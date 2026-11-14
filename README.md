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

## Roadmap

1. Estrutura visual e experiência inicial.
2. Upload seguro e armazenamento de mídia.
3. Pipeline de ingestão e extração de áudio.
4. Transcrição e análise de momentos relevantes.
5. Geração de cortes verticais com legendas.
6. Exportação e histórico de projetos.
7. Integrações de lives e plataformas, respeitando APIs, permissões e direitos de conteúdo.

## Observação

A interface inicial é um ponto de partida. O processamento real de vídeo e a análise por IA ainda precisam ser implementados e conectados a serviços de backend.