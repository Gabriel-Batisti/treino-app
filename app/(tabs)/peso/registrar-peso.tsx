"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarMedida } from "@/app/actions/medidas";
import { idDeterministico, chaveDaPesagem } from "@/lib/treino/ids";
import { formatPeso } from "@/lib/format";

/**
 * Pesagem do dia.
 *
 * Stepper de ±0,1 kg em vez de teclado: é o incremento real de uma balança, e
 * na maioria dos dias o peso está a um ou dois toques do anterior. O campo de
 * digitar continua ali pra quando pular muito.
 *
 * Registrar de novo no mesmo dia CORRIGE: o id é derivado da data, então o
 * upsert cai na mesma linha (ver lib/treino/ids.ts).
 */
export function RegistrarPeso({
  hoje,
  pesoDeHoje,
  ultimoPeso,
}: {
  hoje: string;
  pesoDeHoje: number | null;
  ultimoPeso: number | null;
}) {
  const router = useRouter();
  const partida = pesoDeHoje ?? ultimoPeso ?? 75;
  const [peso, setPeso] = useState<number>(Number(partida));
  const [texto, setTexto] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editando = texto !== "";
  const valor = editando ? Number(texto.replace(",", ".")) : peso;
  const valido = Number.isFinite(valor) && valor > 20 && valor < 400;

  function ajustar(delta: number) {
    setTexto("");
    setPeso((p) => Math.round((p + delta) * 10) / 10);
  }

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    const r = await salvarMedida({
      id: await idDeterministico(chaveDaPesagem(hoje)),
      origem: "manual",
      medido_em: new Date().toISOString(),
      data_local: hoje,
      peso_kg: Math.round(valor * 10) / 10,
      gordura_pct: null,
      massa_magra_kg: null,
      massa_muscular_kg: null,
      agua_pct: null,
      gordura_visceral: null,
      tmb_kcal: null,
      cintura_cm: null,
      arquivo_path: null,
      notas: null,
    });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setTexto("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[10px] uppercase tracking-wide text-muted">
        {pesoDeHoje != null ? "Hoje (registrado)" : "Peso de hoje"}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => ajustar(-0.1)}
          aria-label="menos 100 gramas"
          className="size-14 shrink-0 rounded-xl bg-background border border-border text-xl"
        >
          −
        </button>

        <div className="flex-1 text-center">
          <input
            inputMode="decimal"
            value={editando ? texto : formatPeso(peso)}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={(e) => {
              setTexto(String(peso).replace(".", ","));
              e.currentTarget.select();
            }}
            aria-label="peso em quilos"
            className="w-full bg-transparent text-center text-4xl tabular-nums outline-none"
          />
          <span className="text-xs text-muted">kg</span>
        </div>

        <button
          onClick={() => ajustar(0.1)}
          aria-label="mais 100 gramas"
          className="size-14 shrink-0 rounded-xl bg-background border border-border text-xl"
        >
          +
        </button>
      </div>

      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}

      <button
        onClick={salvar}
        disabled={salvando || !valido}
        className="mt-4 w-full rounded-xl bg-accent text-black font-semibold py-4 text-sm disabled:opacity-40"
      >
        {salvando ? "salvando…" : pesoDeHoje != null ? "Atualizar peso de hoje" : "Registrar"}
      </button>
    </section>
  );
}
