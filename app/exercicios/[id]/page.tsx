import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatData, formatPeso } from "@/lib/format";
import { DetalheExercicio, type SessaoDoExercicio } from "./detalhe-exercicio";

export const dynamic = "force-dynamic";

interface LinhaSerie {
  peso_kg: number | null;
  reps: number | null;
  e1rm: number | null;
  volume_kg: number | null;
  indice: number;
  tipo: string;
}

export default async function ExercicioPage({ params }: PageProps<"/exercicios/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercicio } = await supabase
    .from("exercicios")
    .select("id, nome, grupo_muscular, equipamento, modo_medicao, usos, notas")
    .eq("id", id)
    .maybeSingle();

  if (!exercicio) notFound();

  const { data: linhas } = await supabase
    .from("sessao_exercicios")
    .select("id, notas, sessoes(nome, data_local, inicio_em, status), series(indice, tipo, peso_kg, reps, e1rm, volume_kg)")
    .eq("exercicio_id", id)
    .order("criado_em", { ascending: false })
    .limit(200);

  const sessoes: SessaoDoExercicio[] = (linhas ?? [])
    .map((l) => {
      const s = l.sessoes as unknown as { nome: string | null; data_local: string; inicio_em: string; status: string } | null;
      const series = ((l.series ?? []) as unknown as LinhaSerie[])
        .filter((x) => x.tipo !== "aquecimento")
        .sort((a, b) => a.indice - b.indice);
      return {
        data: s?.data_local ?? "",
        treino: s?.nome ?? null,
        inicioEm: s?.inicio_em ?? "",
        status: s?.status ?? "",
        notas: l.notas,
        series: series.map((x) => ({
          peso: x.peso_kg,
          reps: x.reps,
          e1rm: x.e1rm,
          volume: x.volume_kg,
        })),
      };
    })
    .filter((s) => s.status === "concluida" && s.series.length > 0)
    .sort((a, b) => (a.inicioEm < b.inicioEm ? 1 : -1));

  // Recordes: o de força é FATO (maior peso por faixa de reps). O e1RM é
  // estimativa e vem depois — ver D-004.
  const todas = sessoes.flatMap((s) => s.series);
  const maiorPeso = todas.reduce<{ peso: number; reps: number } | null>(
    (m, x) => (x.peso != null && (!m || x.peso > m.peso) ? { peso: x.peso, reps: x.reps ?? 0 } : m),
    null,
  );
  const melhorE1rm = todas.reduce<number | null>(
    (m, x) => (x.e1rm != null && (m == null || x.e1rm > m) ? x.e1rm : m),
    null,
  );
  const maiorVolume = sessoes.reduce<{ v: number; data: string } | null>((m, s) => {
    const v = s.series.reduce((n, x) => n + Number(x.volume ?? 0), 0);
    return !m || v > m.v ? { v, data: s.data } : m;
  }, null);

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe px-4 pt-4 pb-3 flex items-center gap-3 border-b border-border">
        <Link href="/" aria-label="voltar" className="size-9 -ml-1 grid place-items-center text-muted text-xl">
          ‹
        </Link>
        <span className="text-sm truncate">{exercicio.nome}</span>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{exercicio.nome}</h1>
        <p className="mt-1 text-xs text-muted">
          {[exercicio.grupo_muscular, exercicio.equipamento].filter(Boolean).join(" · ") || "sem classificação"}
          {" · "}
          {exercicio.usos} séries
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Maior peso", maiorPeso ? `${formatPeso(maiorPeso.peso)} kg` : "—", maiorPeso ? `× ${maiorPeso.reps}` : ""],
            ["Melhor 1RM est.", melhorE1rm ? `${formatPeso(melhorE1rm)} kg` : "—", "Brzycki"],
            ["Maior volume", maiorVolume ? `${Math.round(maiorVolume.v).toLocaleString("pt-BR")} kg` : "—", maiorVolume ? formatData(maiorVolume.data) : ""],
          ].map(([rotulo, valor, sub]) => (
            <div key={rotulo} className="rounded-xl bg-card border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
              <p className="mt-0.5 text-base tabular-nums">{valor}</p>
              <p className="text-[10px] text-muted">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <DetalheExercicio sessoes={sessoes} notasExercicio={exercicio.notas} />
    </main>
  );
}
