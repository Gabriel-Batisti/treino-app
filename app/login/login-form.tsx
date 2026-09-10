"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro(error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : error.message);
      setCarregando(false);
      return;
    }
    // refresh() em vez de push(): faz o proxy.ts rodar e mandar o Set-Cookie
    // do servidor, que é o cookie que o Safari não expira em 7 dias (D-009).
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="mt-8 flex flex-col gap-3">
      <input
        type="email" inputMode="email" autoComplete="username"
        placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl bg-card border border-border px-4 py-4 outline-none focus:border-accent"
      />
      <input
        type="password" autoComplete="current-password"
        placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)}
        className="rounded-xl bg-card border border-border px-4 py-4 outline-none focus:border-accent"
      />
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <button
        type="submit" disabled={carregando || !email || !senha}
        className="mt-2 rounded-xl bg-accent text-black font-semibold py-4 text-base disabled:opacity-40"
      >
        {carregando ? "entrando…" : "Entrar"}
      </button>
    </form>
  );
}
