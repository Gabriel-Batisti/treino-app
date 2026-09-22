"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarRotina } from "@/app/actions/rotinas";
import { sincronizar } from "@/lib/local/sync";

/**
 * Criar um TREINO — o caso "o coach mandou o treino novo".
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
export function NovaRotina({ grupos }: { grupos: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  /**
   * O programa é o MESMO CAMPO pra escolher um existente e pra criar um novo:
   * os botões preenchem o texto, e digitar outra coisa cria. Separar em
   * "escolher" e "criar programa" seria um passo a mais pra alimentar uma
   * tabela que a 0013 decidiu não existir — o programa é só um rótulo.
   */
  const [grupo, setGrupo] = useState(grupos[0] ?? "");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    const limpo = nome.trim();
    if (!limpo) return setErro("Dê um nome pro treino.");

    setCriando(true);
    setErro(null);

    const id = crypto.randomUUID();
    const r = await criarRotina({ id, nome: limpo, grupo: grupo.trim() || null }).catch(() => ({
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
        Novo treino
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <label className="text-[10px] uppercase tracking-wide text-muted" htmlFor="nome-treino">
        Nome do treino
      </label>
      <input
        id="nome-treino"
        autoFocus
        value={nome}
        maxLength={60}
        placeholder="Treino B"
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void criar()}
        className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-3.5 outline-none focus:border-accent"
      />

      <label className="mt-3 block text-[10px] uppercase tracking-wide text-muted" htmlFor="grupo">
        Rotina
      </label>
      {grupos.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {grupos.map((g) => (
            <button
              key={g}
              onClick={() => setGrupo(g)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                grupo === g
                  ? "bg-accent text-black border-accent font-medium"
                  : "bg-background border-border text-muted"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      <input
        id="grupo"
        value={grupo}
        maxLength={60}
        placeholder="Musclelab 2"
        onChange={(e) => setGrupo(e.target.value)}
        className="mt-1.5 w-full rounded-xl bg-background border border-border px-3 py-3 text-sm outline-none focus:border-accent"
      />
      <p className="mt-1 text-[11px] text-muted">
        Nome novo aqui cria uma rotina nova. Em branco, o treino fica solto.
      </p>

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
