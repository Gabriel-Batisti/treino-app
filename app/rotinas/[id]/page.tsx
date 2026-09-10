import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatData } from "@/lib/format";
import { GraficoRotina, type PontoSessao } from "./grafico-rotina";
import { ExercicioRotina, type LinhaSerieAlvo } from "./exercicio-rotina";
import type { UltimoDesempenho } from "@/types/database";

export const dynamic = "force-dynamic";

interface ItemRotina {
  id: string;
  ordem: number;
  series_alvo: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  descanso_seg: number | null;
  exercicios: { id: string; nome: string; nome_busca: string; equipamento: string | null } | null;
}

export default async function RotinaPage({ params }: PageProps<"/rotinas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rotina } = await supabase
    .from("rotinas")
    .select(
      "id, nome, notas, rotina_exercicios(id, ordem, series_alvo, reps_alvo_min, reps_alvo_max, descanso_seg, exercicios(id, nome, nome_busca, equipamento))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!rotina) notFound();

  const itens = ((rotina.rotina_exercicios ?? []) as unknown as ItemRotina[])
    .filter((i) => i.exercicios)
    .sort((a, b) => a.ordem - b.ordem);

  const [{ data: sessoes }, { data: anteriores }] = await Promise.all([
    supabase
      .from("sessoes")
      .select("id, data_local, duracao_seg, sessao_exercicios(series(volume_kg, reps, concluida))")
      .eq("status", "concluida")
      .eq("nome", rotina.nome)
      .order("inicio_em", { ascending: true })
      .limit(40),
    itens.length
      ? supabase
          .from("vw_ultimo_desempenho")
          .select("*")
          .in("exercicio_id", itens.map((i) => i.exercicios!.id))
      : Promise.resolve({ data: [] as UltimoDesempenho[] }),
  ]);

  // View não carrega NOT NULL: toda coluna vem anulável no tipo gerado.
  const pesoPorExercicio = new Map<string, Map<number, number | null>>();
  for (const a of (anteriores ?? []) as UltimoDesempenho[]) {
    if (!a.exercicio_id || a.indice == null) continue;
    const m = pesoPorExercicio.get(a.exercicio_id) ?? new Map<number, number | null>();
    m.set(a.indice, a.peso_kg);
    pesoPorExercicio.set(a.exercicio_id, m);
  }

  const pontos: PontoSessao[] = (sessoes ?? []).map((s) => {
    const series = (
      s.sessao_exercicios as unknown as {
        series: { volume_kg: number | null; reps: number | null; concluida: boolean }[];
      }[]
    ).flatMap((se) => se.series ?? []);
    return {
      data: s.data_local,
      duracaoMin: s.duracao_seg ? Math.round(s.duracao_seg / 60) : 0,
      volumeKg: Math.round(series.reduce((n, x) => n + Number(x.volume_kg ?? 0), 0)),
      reps: series.reduce((n, x) => n + (x.reps ?? 0), 0),
    };
  });

  const ultima = pontos[pontos.length - 1];

  return (
    <main className="flex-1 flex flex-col pb-safe">
      {/* Sticky COM fundo: com statusBarStyle black-translucent o conteúdo passa
          por baixo da barra do iOS ao rolar, e o título ficava embaixo do
          relógio. A barra sólida é o que impede isso. */}
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link href="/" aria-label="voltar" className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none">
            ‹
          </Link>
          <span className="text-sm font-medium truncate">{rotina.nome}</span>
        </div>
      </header>

      <div className="px-4 pt-4">
        {ultima && (
          <p className="text-xs text-muted">
            última: {formatData(ultima.data)} · {ultima.duracaoMin} min ·{" "}
            {ultima.volumeKg.toLocaleString("pt-BR")} kg
          </p>
        )}

        <Link
          href={`/treino?rotina=${rotina.id}`}
          className="mt-3 block rounded-2xl bg-accent text-black font-semibold py-4 text-center"
        >
          Iniciar rotina
        </Link>
      </div>

      {pontos.length > 1 && (
        <div className="mt-6 px-4">
          <GraficoRotina pontos={pontos} />
        </div>
      )}

      <section className="mt-6 px-4">
        <h2 className="text-xs uppercase tracking-wide text-muted">Exercícios</h2>
        <div className="mt-3 flex flex-col gap-7">
          {itens.map((i) => {
            const ex = i.exercicios!;
            const pesos = pesoPorExercicio.get(ex.id);
            const qtd = Math.max(i.series_alvo ?? 0, pesos?.size ?? 0, 1);
            const linhas: LinhaSerieAlvo[] = Array.from({ length: qtd }, (_, k) => ({
              indice: k + 1,
              pesoAnterior: pesos?.get(k + 1) ?? null,
            }));
            return (
              <ExercicioRotina
                key={i.id}
                rotinaId={rotina.id}
                rotinaExercicioId={i.id}
                exercicioId={ex.id}
                nome={ex.nome}
                nomeBusca={ex.nome_busca}
                seriesAlvo={qtd}
                repsAlvoMin={i.reps_alvo_min}
                repsAlvoMax={i.reps_alvo_max}
                descansoSeg={i.descanso_seg}
                linhas={linhas}
              />
            );
          })}
        </div>
      </section>

      <div className="h-10" />
    </main>
  );
}
