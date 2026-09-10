"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarCardio } from "@/app/actions/cardio";
import { hojeLocal } from "@/lib/format";

/**
 * Registro de cardio.
 *
 * Tudo em passos tocáveis, nada de digitar quando dá pra escolher: o cenário é
 * o mesmo do treino — uma mão, em pé, logo depois do esforço.
 */

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

export function FormCardio() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("esteira");
  const [minutos, setMinutos] = useState(30);
  const [calorias, setCalorias] = useState<string>("");
  const [distancia, setDistancia] = useState<string>("");
  const [intensidade, setIntensidade] = useState<Intensidade | null>("moderado");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const numero = (s: string): number | null => {
    const v = s.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarCardio({
      id: crypto.randomUUID(),
      tipo,
      inicio_em: new Date().toISOString(),
      data_local: hojeLocal(),
      duracao_min: minutos,
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
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link href="/" aria-label="voltar" className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none">
            ‹
          </Link>
          <span className="text-sm font-medium">Registrar cardio</span>
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
                className={`rounded-xl border py-3.5 text-sm ${
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

        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Tempo</h2>
          {/* Stepper em vez de teclado: mais rápido e não come metade da tela. */}
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setMinutos((m) => Math.max(1, m - 5))}
              aria-label="menos 5 minutos"
              className="size-14 shrink-0 rounded-xl bg-card border border-border text-xl"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl tabular-nums">{minutos}</span>
              <span className="ml-1 text-sm text-muted">min</span>
            </div>
            <button
              onClick={() => setMinutos((m) => Math.min(600, m + 5))}
              aria-label="mais 5 minutos"
              className="size-14 shrink-0 rounded-xl bg-card border border-border text-xl"
            >
              +
            </button>
          </div>
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
          {salvando ? "salvando…" : "Salvar cardio"}
        </button>
      </div>
    </main>
  );
}
