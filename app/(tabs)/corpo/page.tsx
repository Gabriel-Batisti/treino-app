import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatData, formatPeso } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Exame {
  id: string;
  data_local: string;
  peso_kg: number;
  gordura_pct: number | null;
  massa_muscular_kg: number | null;
  arquivo_path: string | null;
  dados: { pontuacao?: number | null } | null;
}

export default async function Bioimpedancias() {
  const supabase = await createClient();

  // `dados` é da migration 0010 e pode não ter rodado — a tela não pode quebrar
  // por isso. Mesma tolerância do resto do app. As duas listas de colunas são
  // LITERAIS: montada por concatenação, o supabase-js perde o tipo do retorno.
  const comDados = await supabase
    .from("medidas")
    .select("id, data_local, peso_kg, gordura_pct, massa_muscular_kg, arquivo_path, dados")
    .eq("origem", "bioimpedancia")
    .is("excluido_em", null)
    .order("data_local", { ascending: false });

  const faltaDados = !!comDados.error;
  const semDados = faltaDados
    ? await supabase
        .from("medidas")
        .select("id, data_local, peso_kg, gordura_pct, massa_muscular_kg, arquivo_path")
        .eq("origem", "bioimpedancia")
        .is("excluido_em", null)
        .order("data_local", { ascending: false })
    : null;

  const data = faltaDados ? semDados?.data : comDados.data;

  const exames = (data ?? []) as unknown as Exame[];

  return (
    <div className="flex-1 flex flex-col px-4 pt-4">
      <div className="flex justify-end">
        <Link
          href="/bioimpedancia"
          className="rounded-full border border-border px-4 py-2 text-xs text-accent"
        >
          + Bioimpedância
        </Link>
      </div>

      {faltaDados && (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Rode a migration <code>0010</code> pra ver o laudo completo. O que já está
          registrado continua aparecendo.
        </p>
      )}

      {exames.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          Nenhuma bioimpedância ainda.
          <br />
          Suba o PDF do exame — o app lê os números sozinho.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {exames.map((e) => (
            <li key={e.id}>
              <Link
                href={`/corpo/${e.id}`}
                className="block rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm">{formatData(e.data_local)}</span>
                  {e.dados?.pontuacao != null && (
                    <span className="text-[11px] text-muted tabular-nums">
                      {e.dados.pontuacao}/100 pontos
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-5 text-sm tabular-nums">
                  <span>
                    {formatPeso(e.peso_kg)} <span className="text-muted text-xs">kg</span>
                  </span>
                  {e.gordura_pct != null && (
                    <span>
                      {formatPeso(e.gordura_pct)}
                      <span className="text-muted text-xs"> % gordura</span>
                    </span>
                  )}
                  {e.massa_muscular_kg != null && (
                    <span>
                      {formatPeso(e.massa_muscular_kg)}
                      <span className="text-muted text-xs"> kg músculo</span>
                    </span>
                  )}
                </div>
                <span className="mt-2 block text-[11px] text-accent">
                  ver detalhamento ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="h-6" />
    </div>
  );
}
