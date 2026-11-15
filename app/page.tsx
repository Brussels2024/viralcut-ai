"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  AudioLines,
  Clapperboard,
  CloudUpload,
  Crown,
  Film,
  Radio,
  Scissors,
  Sparkles,
  Upload,
  Video,
  WandSparkles
} from "lucide-react";

type SourceMode = "recording" | "live";

export default function Home() {
  const [mode, setMode] = useState<SourceMode>("recording");
  const [platform, setPlatform] = useState("YouTube");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [notice, setNotice] = useState("");

  function handleFile(file?: File) {
    if (!file) return;
    const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];
    if (!allowedTypes.includes(file.type)) { setFileName(""); setFileInfo(""); setNotice("Formato não suportado. Envie MP4, MOV, WebM ou MKV."); return; }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024 * 1024) { setFileName(""); setFileInfo(""); setNotice("O vídeo precisa ter até 2 GB."); return; }
    setFileName(file.name);
    setFileInfo((file.size / (1024 * 1024)).toFixed(1) + " MB");
    setNotice("Arquivo validado no navegador. O envio e a análise automática ainda não estão habilitados.");
  }

  function handleStart() {
    if (mode === "live") { setNotice("A captura de lives ainda não está conectada. A integração OBS/RTMP será implementada posteriormente."); return; }
    if (!fileName && !sourceUrl.trim()) {
      setNotice("Adicione um link ou selecione um vídeo para começar.");
      return;
    }
    if (mode === "live" && !sourceUrl.trim()) {
      setNotice("Informe o endereço da transmissão ou da fonte compatível.");
      return;
    }
    setNotice(fileName ? "Pré-verificação concluída. O upload e a análise ainda aguardam a configuração de autenticação e armazenamento no servidor." : "A importação automática por link ainda não está disponível. Selecione um arquivo de vídeo compatível.");
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="ViralCut AI início">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/15 text-violet-200">
            <Scissors size={21} />
          </span>
          <span className="text-lg font-semibold tracking-tight">ViralCut <span className="text-violet-300">AI</span></span>
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          Workspace de criação
        </div>
        <Link href="/entrar" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5">
          Entrar
        </Link>
      </header>

      <section className="grid-glow relative mx-auto max-w-7xl overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[110px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3 py-1.5 text-xs font-medium text-violet-200">
            <Sparkles size={14} /> Inteligência artificial para criadores
          </div>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Encontre o momento.
            <br />
            <span className="bg-gradient-to-r from-violet-200 via-purple-400 to-fuchsia-300 bg-clip-text text-transparent">Crie o corte viral.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            Transforme vídeos e transmissões em cortes verticais. A IA vai identificar os momentos mais fortes e preparar tudo para publicar.
          </p>
        </div>

        <div className="glass purple-glow relative mx-auto mt-12 max-w-3xl rounded-3xl p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Nova edição</p>
              <p className="mt-1 text-xs text-zinc-500">Escolha de onde vem seu conteúdo</p>
            </div>
            <span className="rounded-lg border border-violet-300/15 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">BETA</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setMode("recording"); setNotice(""); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${mode === "recording" ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-violet-200"><Film size={20} /></span>
              <span><span className="block text-sm font-medium">Vídeo gravado</span><span className="mt-1 block text-xs text-zinc-500">Arquivo ou link</span></span>
            </button>
            <button onClick={() => { setMode("live"); setNotice(""); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${mode === "live" ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-violet-200"><Radio size={20} /></span>
              <span><span className="block text-sm font-medium">Live em andamento</span><span className="mt-1 block text-xs text-zinc-500">Transmissão ao vivo</span></span>
            </button>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-medium text-zinc-400">Plataforma de origem</label>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0c0b15] px-4 py-3 text-sm text-white outline-none focus:border-violet-400/60">
              <option>YouTube</option>
              <option>Twitch</option>
              <option>Instagram</option>
              <option>TikTok</option>
              <option>Facebook</option>
              <option>Outra fonte compatível</option>
            </select>
          </div>

          <div className="mt-5">
            <label htmlFor="source" className="mb-2 block text-xs font-medium text-zinc-400">{mode === "live" ? "Link da live ou endereço da fonte" : "Link do vídeo (opcional se enviar arquivo)"}</label>
            <input id="source" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder={mode === "live" ? "Cole o link ou endereço da transmissão" : "https://..."} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/60" />
          </div>

          {mode === "recording" && (
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300/25 bg-violet-400/[0.035] px-5 py-7 text-center transition hover:border-violet-300/50 hover:bg-violet-400/[0.07]">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><CloudUpload size={22} /></span>
              <span className="text-sm font-medium">{fileName || "Arraste seu vídeo ou clique para selecionar"}</span>
              <span className="mt-1 text-xs text-zinc-500">MP4, MOV, WebM ou MKV · até 2 GB</span>
              <input type="file" accept="video/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
            </label>
          )}

          {notice && <p role="status" className="mt-4 rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 text-sm text-violet-100">{notice}</p>}

          <button onClick={handleStart} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110">
            <WandSparkles size={17} /> Preparar análise <ArrowUpRight size={17} />
          </button>
          <p className="mt-3 text-center text-[11px] leading-5 text-zinc-600">Ao continuar, use apenas conteúdos que você tem autorização para processar.</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          <Feature icon={<AudioLines size={19} />} title="Momentos de impacto" description="Identificação de falas, reações e picos de engajamento." />
          <Feature icon={<Video size={19} />} title="Formato vertical" description="Preparação para vídeos curtos em proporção 9:16." />
          <Feature icon={<Crown size={19} />} title="Pronto para publicar" description="Legendas, títulos e descrições em um só fluxo." />
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-7 text-center text-xs text-zinc-600">
        <span className="inline-flex items-center gap-2"><Clapperboard size={14} /> ViralCut AI</span>
        <span className="mx-2">·</span>
        Feito para transformar conteúdo em bons momentos.
        <span className="mx-2">·</span>
        <Upload size={12} className="inline" /> Sua próxima edição começa aqui
      </footer>
    </main>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/[0.08] text-violet-200">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  );
}