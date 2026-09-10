"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarCardio } from "@/app/actions/cardio";
import { hojeLocal } from "@/lib/format";

/**
 * Registro de cardio com cronômetro.
 *
 * O cronômetro guarda o INSTANTE DE INÍCIO, não um contador incrementado: o
 * iOS congela timer com o app em background, e 30 min de esteira com o celular
 * bloqueado zerariam a conta. Mesmo princípio do descanso na tela de treino.
 *
 * E o instante vai pro localStorage: fechar o app no meio do cardio não pode
 * perder o que já correu.
 */

const CHAVE = "cardio-em-andamento";

const TIPOS = [
  { valor: "esteira", rotulo: "Esteira" },
  { valor: "bicicleta", rotulo: "Bicicleta" },
  { valor: "eliptico", rotulo: "Elíptico" },
  { valor: "escada", rotulo: "Escada" },
  { valor: "remo", rotulo: "Remo" },
  { valor: "corrida", rotulo: "Corrida" },
  { valor: "caminhada", rotulo: "Caminhada" },
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

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FormCardio() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("esteira");
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [minutos, setMinutos] = useState(30);
  const [calorias, setCalorias] = useState("");
  const [distancia, setDistancia] = useState("");
  const [intensidade, setIntensidade] = useState<Intensidade | null>("moderado");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const restaurado = useRef(false);

  // Retoma um cardio que ficou correndo (app fechado, tela bloqueada).
  useEffect(() => {
    if (restaurado.current) return;
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
  }, []);

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
    setMinutos(Math.max(1, Math.ceil(decorridoSeg / 60)));
    setInicio(null);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
  }

  const numero = (s: string): number | null => {
    const v = s.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const duracao = inicio != null ? Math.max(1, Math.ceil(decorridoSeg / 60)) : minutos;
    const r = await salvarCardio({
      id: crypto.randomUUID(),
      tipo,
      // Se o cronômetro rodou, o início é o de verdade.
      inicio_em: new Date(inicio ?? Date.now()).toISOString(),
      data_local: hojeLocal(),
      duracao_min: duracao,
      calorias: numero(calorias) != null ? Math.round(numero(calorias)!) : null,
      distancia_km: numero(distancia),
      intensidade,
      notas: null,
    });
    if (!r.ok) {
      setErro(r.error);
      setSalvando(false);
      return;
    }
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
    router.push("/");
    router.refresh();
  }

  const rodando = inicio != null;

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link href="/rotinas" aria-label="voltar" className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none">
            ‹
          </Link>
          <span className="text-sm font-medium">Cardio</span>
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
            {rodando ? "Em andamento" : "Cronômetro"}
          </p>
          <p className={`mt-1 text-5xl tabular-nums ${rodando ? "text-accent" : ""}`}>
            {mmss(rodando ? decorridoSeg : minutos * 60)}
          </p>

          {rodando ? (
            <button
              onClick={parar}
              className="mt-4 w-full rounded-xl border border-border py-3.5 text-sm"
            >
              Parar
            </button>
          ) : (
            <>
              <button
                onClick={comecar}
                className="mt-4 w-full rounded-xl bg-accent text-black font-semibold py-3.5 text-sm"
              >
                Iniciar cronômetro
              </button>
              {/* Stepper pra quando você esqueceu de iniciar e vai anotar depois. */}
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  onClick={() => setMinutos((m) => Math.max(1, m - 5))}
                  aria-label="menos 5 minutos"
                  className="size-11 rounded-xl bg-background border border-border text-lg"
                >
                  −
                </button>
                <span className="text-xs text-muted w-24">ou ajuste à mão</span>
                <button
                  onClick={() => setMinutos((m) => Math.min(600, m + 5))}
                  aria-label="mais 5 minutos"
                  className="size-11 rounded-xl bg-background border border-border text-lg"
                >
                  +
                </button>
              </div>
            </>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Calorias</h2>
            <input
              inputMode="numeric"
              placeholder="kcal"
              value={calorias}
              onChange={(e) => setCalorias(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Distância</h2>
            <input
              inputMode="decimal"
              placeholder="km"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center tabular-nums outline-none focus:border-accent"
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
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
        >
          {salvando
            ? "salvando…"
            : rodando
              ? `Concluir cardio (${mmss(decorridoSeg)})`
              : "Salvar cardio"}
        </button>
      </div>
    </main>
  );
}
