"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarRotina } from "@/app/actions/rotinas";
import { sincronizar } from "@/lib/local/sync";

/**
 * Criar rotina — o caso "o coach mandou um treino novo".
 *
 * Cria VAZIA e manda direto pra edição, onde os exercícios entram. Pedir nome
 * e exercícios na mesma tela duplicaria a busca de exercício, o stepper de
 * séries e o arrasto de ordem que a tela de edição já tem — e a segunda cópia
 * é sempre a que fica pra trás.
 *
 * SINCRONIZA ANTES DE NAVEGAR, e é por isso que tem um "criando…" de um
 * segundo: a tela de edição lê do IndexedDB (D-007), então ir pra lá antes do
 * pull mostraria "carregando…" pra sempre numa rotina que existe.
 *
 * Diferente do resto do app, isto EXIGE rede. Montar rotina é coisa de sofá,
 * não de academia — e uma rotina só local não teria id do servidor pros
 * exercícios se pendurarem.
 */
export function NovaRotina() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const limpo = nome.trim();
    if (!limpo) return setErro("Dê um nome pra rotina.");

    setCriando(true);
    setErro(null);

    const id = crypto.randomUUID();
    const r = await criarRotina({ id, nome: limpo }).catch(() => ({
      ok: false as const,
      error: "Sem conexão. Criar rotina precisa de internet.",
    }));

    if (!r.ok) {
      setErro(r.error);
      setCriando(false);
      return;
    }

    await sincronizar();
    router.push(`/rotinas/${id}/editar`);
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-2xl bg-card border border-border py-4 flex items-center justify-center gap-2 text-sm"
      >
        <span className="text-accent text-lg leading-none">＋</span>
        Nova rotina
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <label className="text-[10px] uppercase tracking-wide text-muted" htmlFor="nome-rotina">
        Nome da rotina
      </label>
      <input
        id="nome-rotina"
        autoFocus
        value={nome}
        maxLength={60}
        placeholder="Treino A"
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void criar()}
        className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-3.5 outline-none focus:border-accent"
      />

      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            setAberto(false);
            setNome("");
            setErro(null);
          }}
          disabled={criando}
          className="flex-1 rounded-xl border border-border py-3.5 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={() => void criar()}
          disabled={criando}
          className="flex-1 rounded-xl bg-accent text-black font-semibold py-3.5 text-sm disabled:opacity-40"
        >
          {criando ? "criando…" : "Criar e adicionar exercícios"}
        </button>
      </div>
    </div>
  );
}
