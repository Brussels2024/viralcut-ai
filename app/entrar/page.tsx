"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("O acesso por e-mail ainda não está habilitado. Estamos concluindo a configuração segura da autenticação. Nenhuma senha foi enviada ou armazenada.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft size={16} /> Voltar ao início
        </Link>
        <section className="glass purple-glow rounded-3xl p-7 sm:p-9">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/15 text-violet-200">
            <LockKeyhole size={22} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3 py-1.5 text-xs text-violet-200">
            <Sparkles size={13} /> Área do criador
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Entrar no ViralCut AI</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Acesse seus projetos, análises e cortes em um só lugar.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">E-mail</span>
              <span className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-violet-400/60">
                <Mail size={17} className="text-zinc-500" />
                <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-zinc-600" />
              </span>
            </label>
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110">
              Continuar com e-mail
            </button>
          </form>
          {message && <p role="status" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-4 py-3 text-xs leading-5 text-amber-100">{message}</p>}
          <div className="mt-7 flex items-start gap-3 border-t border-white/[0.07] pt-6">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
            <p className="text-xs leading-5 text-zinc-500">A autenticação real será ativada com sessão segura e recuperação de senha. Não use a mesma senha de outros serviços enquanto esta etapa estiver em configuração.</p>
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-zinc-600">ViralCut AI · Workspace de criação</p>
      </div>
    </main>
  );
}
