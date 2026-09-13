"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarMedidasCorpo } from "@/app/actions/medidas-corpo";
import { SITES } from "@/lib/medidas/sites";

/**
 * Formulário de fita métrica.
 *
 * FECHADO POR PADRÃO. Medir com fita é coisa de uma vez por mês; deixar
 * quatorze campos abertos na frente dos gráficos inverteria a frequência de
 * uso da tela.
 *
 * Os campos guardam TEXTO enquanto se digita, não número: "88," precisa
 * sobreviver até o "5" chegar — é o mesmo problema do peso na tela de treino.
 */
export function RegistrarFita({
  hoje,
  ultimo,
}: {
  hoje: string;
  ultimo: { data: string; valores: Record<string, number> } | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const numero = (t: string | undefined): number | null => {
    const v = t?.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  async function salvar() {
    const limpos: Record<string, number> = {};
    for (const [k, v] of Object.entries(valores)) {
      const n = numero(v);
      if (n != null) limpos[k] = n;
    }
    if (Object.keys(limpos).length === 0) {
      setErro("Preencha pelo menos uma medida.");
      return;
    }

    setSalvando(true);
    setErro(null);
    const r = await salvarMedidasCorpo({ data_local: data, valores: limpos, notas: null });
    setSalvando(false);

    if (!r.ok) return setErro(r.error);
    setValores({});
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full rounded-2xl bg-accent text-black font-semibold py-4 text-sm"
      >
        Registrar medidas
      </button>
    );
  }

  return (
    <section className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Registrar medidas</h2>
        <button onClick={() => setAberto(false)} className="text-xs text-muted px-2 py-1">
          fechar
        </button>
      </div>

      <label className="mt-3 block text-[10px] uppercase tracking-wide text-muted" htmlFor="data">
        Data
      </label>
      <input
        id="data"
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value)}
        className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-3.5 text-center outline-none focus:border-accent"
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        {SITES.map((s) => (
          <div key={s.chave}>
            <label className="text-[11px] text-muted" htmlFor={s.chave}>
              {s.rotulo}
              {s.lado && <span className="opacity-70"> {s.lado}</span>}
            </label>
            <input
              id={s.chave}
              inputMode="decimal"
              // O valor da última medição fica de placeholder: quase sempre é
              // ele com um décimo de diferença, e serve de referência.
              placeholder={
                ultimo?.valores?.[s.chave] != null
                  ? String(ultimo.valores[s.chave]).replace(".", ",")
                  : "cm"
              }
              value={valores[s.chave] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [s.chave]: e.target.value }))}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-3 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted">
        Deixe em branco o que não mediu — o que já estava guardado continua lá.
      </p>

      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}

      <button
        onClick={() => void salvar()}
        disabled={salvando}
        className="mt-3 w-full rounded-2xl bg-accent text-black font-semibold py-4 text-sm disabled:opacity-40"
      >
        {salvando ? "salvando…" : "Salvar"}
      </button>
    </section>
  );
}
