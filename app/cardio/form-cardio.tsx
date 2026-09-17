"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { enfileirar } from "@/lib/local/db";
import { sincronizar } from "@/lib/local/sync";
import { atualizarCardio, excluirCardio } from "@/app/actions/cardio";
import { hojeLocal } from "@/lib/format";

/**
 * Registro de cardio com cronômetro, ou anotado depois em outra data — e, com
 * `cardio` preenchido, a correção de um que já está gravado.
 *
 * O cronômetro guarda o INSTANTE DE INÍCIO, não um contador incrementado: o
 * iOS congela timer com o app em background, e 30 min de esteira com o celular
 * bloqueado zerariam a conta. Mesmo princípio do descanso na tela de treino.
 *
 * E o instante vai pro localStorage: fechar o app no meio do cardio não pode
 * perder o que já correu.
 *
 * MODO EDIÇÃO é a mesma tela de propósito: os campos são exatamente os mesmos,
 * e duas telas parecidas divergem com o tempo — a de correção sempre fica pra
 * trás. O que muda é que o cronômetro some (não se cronometra o passado) e
 * aparece o botão de excluir.
 */

const CHAVE = "cardio-em-andamento";

const TIPOS = [
  { valor: "esteira", rotulo: "Esteira" },
  { valor: "bicicleta", rotulo: "Bike (academia)" },
  { valor: "bicicleta_externa", rotulo: "Bike (rua)" },
  { valor: "eliptico", rotulo: "Elíptico" },
  { valor: "escada", rotulo: "Escada" },
  { valor: "remo", rotulo: "Remo" },
  { valor: "corrida", rotulo: "Corrida" },
  { valor: "caminhada", rotulo: "Caminhada" },
  { valor: "futebol", rotulo: "Futebol" },
  { valor: "outro", rotulo: "Outro" },
] as const;

const INTENSIDADES = [
  { valor: "leve", rotulo: "Leve" },
  { valor: "moderado", rotulo: "Moderado" },
  { valor: "intenso", rotulo: "Intenso" },
] as const;

type Tipo = (typeof TIPOS)[number]["valor"];
type Intensidade = (typeof INTENSIDADES)[number]["valor"];

interface EmAndamento {
  tipo: Tipo;
  inicio: number;
}

export interface CardioExistente {
  id: string;
  tipo: string;
  data_local: string;
  inicio_em: string;
  duracao_min: number;
  calorias: number | null;
  fc_media: number | null;
  distancia_km: number | null;
  intensidade: string | null;
  fonte: string;
}

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Número em texto, aceitando vírgula. Vazio vira null, não zero. */
function numero(s: string): number | null {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function FormCardio({ cardio }: { cardio?: CardioExistente }) {
  const router = useRouter();
  const editando = !!cardio;

  const [tipo, setTipo] = useState<Tipo>((cardio?.tipo as Tipo) ?? "esteira");
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  /**
   * TEXTO, não número. Campo controlado que guarda number apaga o que você
   * digita: `Number("")` é 0, o React redesenha "0" e o cursor pula. É o mesmo
   * problema da vírgula no peso, na tela de treino.
   */
  const [minutos, setMinutos] = useState(String(cardio?.duracao_min ?? 30));
  const [calorias, setCalorias] = useState(cardio?.calorias != null ? String(cardio.calorias) : "");
  const [fcMedia, setFcMedia] = useState(cardio?.fc_media != null ? String(cardio.fc_media) : "");
  const [distancia, setDistancia] = useState(
    cardio?.distancia_km != null ? String(cardio.distancia_km).replace(".", ",") : "",
  );
  const [intensidade, setIntensidade] = useState<Intensidade | null>(
    (cardio?.intensidade as Intensidade | null) ?? (editando ? null : "moderado"),
  );
  const [data, setData] = useState(cardio?.data_local ?? hojeLocal());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const restaurado = useRef(false);

  // Retoma um cardio que ficou correndo (app fechado, tela bloqueada).
  // Não vale na edição: o cronômetro pendente é de um registro NOVO, e
  // restaurá-lo aqui sobrescreveria o que você veio corrigir.
  useEffect(() => {
    if (editando || restaurado.current) return;
    restaurado.current = true;
    try {
      const cru = localStorage.getItem(CHAVE);
      if (!cru) return;
      const salvo = JSON.parse(cru) as EmAndamento;
      if (salvo?.inicio) {
        setTipo(salvo.tipo);
        setInicio(salvo.inicio);
      }
    } catch {
      /* storage bloqueado ou lixo — segue sem retomar */
    }
  }, [editando]);

  useEffect(() => {
    if (inicio == null) return;
    const tick = () => setAgora(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [inicio]);

  const decorridoSeg = inicio == null ? 0 : Math.floor((agora - inicio) / 1000);
  /** O campo pode estar vazio no meio da digitação — a conta usa 30 até voltar. */
  const minutosNum = Math.min(600, Math.max(1, Math.round(numero(minutos) ?? 30)));

  function comecar() {
    const t = Date.now();
    setInicio(t);
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ tipo, inicio: t } satisfies EmAndamento));
    } catch {
      /* sem storage o cronômetro ainda funciona, só não sobrevive ao fechar */
    }
  }

  function parar() {
    // Arredonda pra cima: 4min30 de esteira é um cardio de 5 min, não de 4.
    setMinutos(String(Math.max(1, Math.ceil(decorridoSeg / 60))));
    setInicio(null);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
  }

  function ajustar(delta: number) {
    setMinutos(String(Math.min(600, Math.max(1, minutosNum + delta))));
  }

  /** Os campos que são iguais nos dois modos. */
  function camposComuns() {
    return {
      tipo,
      duracao_min: minutosNum,
      calorias: numero(calorias) != null ? Math.round(numero(calorias)!) : null,
      fc_media: numero(fcMedia) != null ? Math.round(numero(fcMedia)!) : null,
      distancia_km: numero(distancia),
      intensidade,
      notas: null,
    };
  }

  async function salvarNovo() {
    const cardioId = crypto.randomUUID();
    const hoje = hojeLocal();
    // Cronômetro mandou? O instante é o de verdade. Data de outro dia? Meio-dia
    // local — é hora inventada de qualquer jeito, e meio-dia não escorrega pro
    // dia anterior quando o fuso é convertido pra UTC (D-012).
    const instante =
      inicio != null
        ? new Date(inicio)
        : data === hoje
          ? new Date()
          : new Date(`${data}T12:00:00-03:00`);
    // Mesma regra do treino: grava no aparelho, sobe depois (D-007).
    await enfileirar({
      id: cardioId,
      tipo: "cardio",
      payload: {
        id: cardioId,
        ...camposComuns(),
        duracao_min: inicio != null ? Math.max(1, Math.ceil(decorridoSeg / 60)) : minutosNum,
        inicio_em: instante.toISOString(),
        data_local: inicio != null ? hoje : data,
      },
    });
    void sincronizar();
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
    router.push("/");
    router.refresh();
  }

  async function salvarEdicao() {
    // A hora do dia é preservada quando a data não muda; ao mudar de dia, vale
    // meio-dia local pelo mesmo motivo do registro novo (D-012).
    const instante =
      data === cardio!.data_local
        ? cardio!.inicio_em
        : new Date(`${data}T12:00:00-03:00`).toISOString();

    const r = await atualizarCardio({
      id: cardio!.id,
      ...camposComuns(),
      inicio_em: instante,
      data_local: data,
    });
    if (!r.ok) {
      setErro(r.error);
      setSalvando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    if (editando) await salvarEdicao();
    else await salvarNovo();
  }

  async function excluir() {
    setSalvando(true);
    setErro(null);
    const r = await excluirCardio(cardio!.id);
    if (!r.ok) {
      setErro(r.error);
      setSalvando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const rodando = inicio != null;

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link
            href={editando ? "/" : "/rotinas"}
            aria-label="voltar"
            className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
          >
            ‹
          </Link>
          <span className="text-sm font-medium">{editando ? "Editar cardio" : "Cardio"}</span>
        </div>
      </header>

      <div className="flex-1 px-4 pt-5 flex flex-col gap-6">
        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Tipo</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                onClick={() => setTipo(t.valor)}
                disabled={rodando}
                className={`rounded-xl border py-3.5 text-sm disabled:opacity-40 ${
                  tipo === t.valor
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-card border-border"
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {rodando ? "Em andamento" : editando ? "Duração" : "Cronômetro"}
          </p>

          {rodando ? (
            <>
              <p className="mt-1 text-5xl tabular-nums text-accent">{mmss(decorridoSeg)}</p>
              <button
                onClick={parar}
                className="mt-4 w-full rounded-xl border border-border py-3.5 text-sm"
              >
                Parar
              </button>
            </>
          ) : (
            <>
              {/*
                O NÚMERO É O CAMPO. Antes ele era só um display e os minutos só
                andavam de 5 em 5 — 8 min de bike era impossível de registrar.
                Agora os botões continuam pra ajuste rápido com o polegar e o
                teclado resolve o valor exato.
              */}
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => ajustar(-5)}
                  aria-label="menos 5 minutos"
                  className="size-12 shrink-0 rounded-xl bg-background border border-border text-xl"
                >
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label="duração em minutos"
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value.replace(/[^\d]/g, ""))}
                  onFocus={(e) => e.target.select()}
                  className="w-24 rounded-xl bg-background border border-border py-2 text-center text-4xl tabular-nums outline-none focus:border-accent"
                />
                <button
                  onClick={() => ajustar(5)}
                  aria-label="mais 5 minutos"
                  className="size-12 shrink-0 rounded-xl bg-background border border-border text-xl"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">minutos</p>

              {!editando && (
                <button
                  onClick={comecar}
                  className="mt-4 w-full rounded-xl bg-accent text-black font-semibold py-3.5 text-sm"
                >
                  Iniciar cronômetro
                </button>
              )}
            </>
          )}
        </section>

        {/* Só faz sentido escolher data pro cardio anotado depois: se o
            cronômetro rodou, o dia é hoje e ponto. */}
        {!rodando && (
          <section>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Data</h2>
            <input
              type="date"
              value={data}
              max={hojeLocal()}
              onChange={(e) => setData(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center outline-none focus:border-accent"
            />
            {!editando && data !== hojeLocal() && (
              <p className="mt-1.5 text-center text-[11px] text-muted">
                registrando num dia anterior
              </p>
            )}
          </section>
        )}

        {/* Três colunas, não duas: no relógio a FC média vem junto com as
            calorias, então anotar à mão deve ser igual de curto. O rótulo é
            "FC média" e não "batimentos" porque o número é a média da
            sessão — "batimentos" sozinho sugere o valor de agora. */}
        <section className="grid grid-cols-3 gap-2">
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Calorias</h2>
            <input
              inputMode="numeric"
              placeholder="kcal"
              value={calorias}
              onChange={(e) => setCalorias(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-2 py-4 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">FC média</h2>
            <input
              inputMode="numeric"
              placeholder="bpm"
              value={fcMedia}
              onChange={(e) => setFcMedia(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-2 py-4 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Distância</h2>
            <input
              inputMode="decimal"
              placeholder="km"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-2 py-4 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Intensidade</h2>
          <div className="mt-2 flex gap-2">
            {INTENSIDADES.map((i) => (
              <button
                key={i.valor}
                onClick={() => setIntensidade((v) => (v === i.valor ? null : i.valor))}
                className={`flex-1 rounded-xl border py-3 text-sm ${
                  intensidade === i.valor
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-card border-border"
                }`}
              >
                {i.rotulo}
              </button>
            ))}
          </div>
        </section>

        {editando && (
          <section>
            {cardio.fonte === "apple_saude" && (
              <p className="mb-3 rounded-xl border border-border bg-card px-4 py-3 text-[11px] text-muted">
                Veio do Apple Watch. Corrigir aqui não muda nada no relógio, e um
                reenvio da mesma atividade sobrescreve o que você digitou.
              </p>
            )}

            {confirmandoExclusao ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
                <p className="text-sm">Excluir este cardio?</p>
                <p className="mt-1 text-[11px] text-muted">
                  Some da timeline e do calendário. Dá pra desfazer no banco — não é
                  apagado de verdade.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    disabled={salvando}
                    className="flex-1 rounded-xl border border-border py-3.5 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void excluir()}
                    disabled={salvando}
                    className="flex-1 rounded-xl bg-red-500 text-white font-semibold py-3.5 text-sm disabled:opacity-40"
                  >
                    {salvando ? "excluindo…" : "Excluir"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmandoExclusao(true)}
                className="w-full rounded-2xl border border-border py-4 text-sm text-red-400"
              >
                Excluir cardio
              </button>
            )}
          </section>
        )}
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={() => void salvar()}
          disabled={salvando}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
        >
          {salvando
            ? "salvando…"
            : editando
              ? "Salvar alterações"
              : rodando
                ? `Concluir cardio (${mmss(decorridoSeg)})`
                : "Salvar cardio"}
        </button>
      </div>
    </main>
  );
}
