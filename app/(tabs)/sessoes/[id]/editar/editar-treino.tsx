"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { atualizarSessao } from "@/app/actions/treino";
import { sincronizar } from "@/lib/local/sync";
import { Ilustracao } from "@/components/ilustracao";

/**
 * Corrigir um treino já concluído.
 *
 * O QUE ESTA TELA NÃO FAZ: adicionar exercício ou série. Corrigir é consertar o
 * que ficou errado; montar treino é a tela de sessão ativa. Misturar as duas
 * daria um editor completo que ninguém usa direito e que teria de repetir a
 * busca de exercício, o "anterior" e a troca de exercício.
 *
 * Todos os campos numéricos guardam TEXTO enquanto se digita. Campo controlado
 * com number apaga o que você escreve: `Number("")` é 0, o React redesenha "0"
 * e o cursor pula. É o mesmo problema da vírgula no peso, na sessão ativa.
 *
 * Depois de salvar, `sincronizar()` atualiza o banco local — senão a tela de
 * treino seguiria mostrando como "anterior" o número que você acabou de
 * corrigir.
 */

export interface SerieEditavel {
  id: string;
  indice: number;
  tipo: string;
  peso_kg: number | null;
  reps: number | null;
}

export interface ExercicioEditavel {
  chave: string;
  nome: string;
  nomeBusca: string;
  series: SerieEditavel[];
}

export interface TreinoEditavel {
  id: string;
  nome: string | null;
  data_local: string;
  duracao_min: number;
  fc_media: number | null;
  fc_max: number | null;
  calorias: number | null;
  notas: string | null;
  exercicios: ExercicioEditavel[];
}

/** Número em texto, aceitando vírgula. Vazio vira null, não zero. */
function numero(s: string | undefined): number | null {
  const v = s?.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function texto(n: number | null): string {
  return n == null ? "" : String(n).replace(".", ",");
}

export function EditarTreino({ treino, hoje }: { treino: TreinoEditavel; hoje: string }) {
  const router = useRouter();

  const [nome, setNome] = useState(treino.nome ?? "");
  const [data, setData] = useState(treino.data_local);
  const [duracao, setDuracao] = useState(String(treino.duracao_min));
  const [fcMedia, setFcMedia] = useState(texto(treino.fc_media));
  const [fcMax, setFcMax] = useState(texto(treino.fc_max));
  const [calorias, setCalorias] = useState(texto(treino.calorias));
  const [notas, setNotas] = useState(treino.notas ?? "");

  // Um mapa plano por id de série: a estrutura aninhada só serve pra desenhar.
  const [pesos, setPesos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      treino.exercicios.flatMap((e) => e.series.map((s) => [s.id, texto(s.peso_kg)])),
    ),
  );
  const [reps, setReps] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      treino.exercicios.flatMap((e) => e.series.map((s) => [s.id, texto(s.reps)])),
    ),
  );
  /** Marcadas pra sumir, mas só no Salvar — dá pra desfazer antes. */
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set());

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarExclusao(id: string) {
    setExcluidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);

    const r = await atualizarSessao({
      id: treino.id,
      nome: nome.trim() || null,
      data_local: data,
      duracao_min: Math.min(600, Math.max(1, Math.round(numero(duracao) ?? treino.duracao_min))),
      fc_media: numero(fcMedia) != null ? Math.round(numero(fcMedia)!) : null,
      fc_max: numero(fcMax) != null ? Math.round(numero(fcMax)!) : null,
      calorias: numero(calorias) != null ? Math.round(numero(calorias)!) : null,
      notas: notas.trim() || null,
      series: treino.exercicios.flatMap((e) =>
        e.series.map((s) => ({
          id: s.id,
          peso_kg: numero(pesos[s.id]),
          reps: numero(reps[s.id]) != null ? Math.round(numero(reps[s.id])!) : null,
          excluir: excluidas.has(s.id),
        })),
      ),
    });

    if (!r.ok) {
      setErro(r.error);
      setSalvando(false);
      return;
    }

    await sincronizar();
    router.push(`/sessoes/${treino.id}`);
    router.refresh();
  }

  const campo =
    "mt-1 w-full rounded-xl bg-card border border-border px-3 py-3.5 text-center tabular-nums outline-none focus:border-accent";
  const rotulo = "text-[10px] uppercase tracking-wide text-muted";

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link
            href={`/sessoes/${treino.id}`}
            aria-label="voltar"
            className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
          >
            ‹
          </Link>
          <span className="text-sm font-medium">Editar treino</span>
        </div>
      </header>

      <div className="flex-1 px-4 pt-5 flex flex-col gap-6">
        <section>
          <label className={rotulo} htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            value={nome}
            placeholder="Treino"
            onChange={(ev) => setNome(ev.target.value)}
            className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-3.5 outline-none focus:border-accent"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="data">
              Data
            </label>
            <input
              id="data"
              type="date"
              value={data}
              max={hoje}
              onChange={(ev) => setData(ev.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="duracao">
              Duração (min)
            </label>
            <input
              id="duracao"
              inputMode="numeric"
              value={duracao}
              onChange={(ev) => setDuracao(ev.target.value.replace(/[^\d]/g, ""))}
              onFocus={(ev) => ev.target.select()}
              className={campo}
            />
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <div>
            <label className={rotulo} htmlFor="fcm">
              FC média
            </label>
            <input
              id="fcm"
              inputMode="numeric"
              placeholder="bpm"
              value={fcMedia}
              onChange={(ev) => setFcMedia(ev.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="fcx">
              FC máx
            </label>
            <input
              id="fcx"
              inputMode="numeric"
              placeholder="bpm"
              value={fcMax}
              onChange={(ev) => setFcMax(ev.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="kcal">
              Calorias
            </label>
            <input
              id="kcal"
              inputMode="numeric"
              placeholder="kcal"
              value={calorias}
              onChange={(ev) => setCalorias(ev.target.value)}
              className={campo}
            />
          </div>
        </section>

        <section>
          <h2 className={rotulo}>Séries</h2>
          <div className="mt-2 flex flex-col gap-5">
            {treino.exercicios.map((e) => (
              <div key={e.chave}>
                <div className="flex items-center gap-3">
                  <Ilustracao nomeBusca={e.nomeBusca} className="size-9" />
                  <span className="text-sm">{e.nome}</span>
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  {e.series.map((s) => {
                    const fora = excluidas.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 ${fora ? "opacity-40" : ""}`}
                      >
                        <span className="w-4 shrink-0 text-center text-xs text-muted tabular-nums">
                          {s.indice}
                        </span>
                        <input
                          inputMode="decimal"
                          aria-label={`peso da série ${s.indice}`}
                          disabled={fora}
                          value={pesos[s.id] ?? ""}
                          onChange={(ev) =>
                            setPesos((v) => ({ ...v, [s.id]: ev.target.value }))
                          }
                          className="min-w-0 flex-1 rounded-xl bg-card border border-border px-2 py-3 text-center tabular-nums outline-none focus:border-accent disabled:line-through"
                        />
                        <span className="shrink-0 text-xs text-muted">kg ×</span>
                        <input
                          inputMode="numeric"
                          aria-label={`repetições da série ${s.indice}`}
                          disabled={fora}
                          value={reps[s.id] ?? ""}
                          onChange={(ev) =>
                            setReps((v) => ({ ...v, [s.id]: ev.target.value.replace(/[^\d]/g, "") }))
                          }
                          className="min-w-0 flex-1 rounded-xl bg-card border border-border px-2 py-3 text-center tabular-nums outline-none focus:border-accent disabled:line-through"
                        />
                        <button
                          onClick={() => alternarExclusao(s.id)}
                          aria-label={fora ? "manter série" : "excluir série"}
                          className={`size-11 shrink-0 rounded-xl border text-sm ${
                            fora ? "border-accent text-accent" : "border-border text-red-400"
                          }`}
                        >
                          {fora ? "↩" : "✕"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {excluidas.size > 0 && (
            <p className="mt-3 text-[11px] text-muted">
              {excluidas.size === 1 ? "1 série sai" : `${excluidas.size} séries saem`} ao salvar.
              O ↩ desfaz.
            </p>
          )}
        </section>

        <section>
          <label className={rotulo} htmlFor="notas">
            Notas
          </label>
          <textarea
            id="notas"
            rows={3}
            value={notas}
            onChange={(ev) => setNotas(ev.target.value)}
            className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-3 outline-none focus:border-accent"
          />
        </section>
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={() => void salvar()}
          disabled={salvando}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
        >
          {salvando ? "salvando…" : "Salvar alterações"}
        </button>
      </div>
    </main>
  );
}
