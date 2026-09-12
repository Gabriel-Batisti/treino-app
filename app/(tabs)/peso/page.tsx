import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GraficoMedidas } from "@/components/grafico-medidas";
import { RegistrarPeso } from "./registrar-peso";
import { formatData, formatPeso, hojeLocal } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Medida {
  id: string;
  origem: string;
  data_local: string;
  peso_kg: number;
  gordura_pct: number | null;
  massa_magra_kg: number | null;
  massa_muscular_kg: number | null;
  massa_gorda_kg: number | null;
  agua_pct: number | null;
  tmb_kcal: number | null;
  arquivo_path: string | null;
}

export default async function Peso() {
  const supabase = await createClient();
  const hoje = hojeLocal();

  // A 0003 pode não ter sido rodada — a tela não pode quebrar por isso.
  const { data, error } = await supabase
    .from("medidas")
    .select(
      "id, origem, data_local, peso_kg, gordura_pct, massa_magra_kg, massa_muscular_kg, massa_gorda_kg, agua_pct, tmb_kcal, arquivo_path",
    )
    .is("excluido_em", null)
    .order("data_local", { ascending: false })
    .limit(180);

  const faltaMigration = !!error;
  const medidas = (data ?? []) as Medida[];

  const deHoje = medidas.find((m) => m.data_local === hoje && m.origem === "manual");
  const ultima = medidas[0];

  return (
    <main className="flex-1 flex flex-col pt-safe px-4">
      <header className="pt-6 pb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Peso</h1>
        <div className="flex gap-2 shrink-0">
          <Link href="/fotos" className="rounded-full border border-border px-4 py-2 text-xs text-accent">
            Fotos
          </Link>
          <Link href="/bioimpedancia" className="rounded-full border border-border px-4 py-2 text-xs text-accent">
            + Bio
          </Link>
        </div>
      </header>

      {faltaMigration && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Tabela <code>medidas</code> não existe ainda — rode a migration 0003 no Supabase.
        </p>
      )}

      <RegistrarPeso hoje={hoje} pesoDeHoje={deHoje?.peso_kg ?? null} ultimoPeso={ultima?.peso_kg ?? null} />

      {medidas.length > 1 && (
        <section className="mt-6 rounded-2xl bg-card border border-border p-4">
          <GraficoMedidas medidas={medidas} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-wide text-muted">Histórico</h2>
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {medidas.map((m) => (
            <li key={m.id} className="py-3 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="tabular-nums">
                  {formatPeso(m.peso_kg)} kg
                  {m.gordura_pct != null && (
                    <span className="ml-2 text-xs text-muted">{formatPeso(m.gordura_pct)}% gordura</span>
                  )}
                </p>
                {m.origem === "bioimpedancia" && (
                  <p className="text-[11px] text-accent">
                    bioimpedância
                    {m.massa_muscular_kg != null && ` · ${formatPeso(m.massa_muscular_kg)} kg músculo`}
                    {m.arquivo_path && " · com exame"}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-muted shrink-0">{formatData(m.data_local)}</span>
            </li>
          ))}
          {medidas.length === 0 && !faltaMigration && (
            <li className="py-10 text-center text-sm text-muted">Nenhuma pesagem ainda.</li>
          )}
        </ul>
      </section>

      <div className="h-6" />
    </main>
  );
}
