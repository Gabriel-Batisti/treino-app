import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatData } from "@/lib/format";
import { GraficoRotina, type PontoSessao } from "./grafico-rotina";

export const dynamic = "force-dynamic";

interface ItemRotina {
  ordem: number;
  series_alvo: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  descanso_seg: number | null;
  exercicios: { id: string; nome: string; equipamento: string | null } | null;
}

function formatDescanso(seg: number | null): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}min ${s}s` : `${m}min 0s`;
}

export default async function RotinaPage({ params }: PageProps<"/rotinas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rotina } = await supabase
    .from("rotinas")
    .select(
      "id, nome, notas, rotina_exercicios(ordem, series_alvo, reps_alvo_min, reps_alvo_max, descanso_seg, exercicios(id, nome, equipamento))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!rotina) notFound();

  const itens = ((rotina.rotina_exercicios ?? []) as unknown as ItemRotina[])
    .filter((i) => i.exercicios)
    .sort((a, b) => a.ordem - b.ordem);

  // Histórico deste treino: uma sessão por ponto do gráfico.
  const { data: sessoes } = await supabase
    .from("sessoes")
    .select("id, data_local, duracao_seg, sessao_exercicios(series(volume_kg, reps, concluida))")
    .eq("status", "concluida")
    .eq("nome", rotina.nome)
    .order("inicio_em", { ascending: true })
    .limit(40);

  const pontos: PontoSessao[] = (sessoes ?? []).map((s) => {
    const series = (s.sessao_exercicios as unknown as { series: { volume_kg: number | null; reps: number | null; concluida: boolean }[] }[])
      .flatMap((se) => se.series ?? []);
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
      <header className="pt-safe px-4 pt-4 pb-3 flex items-center gap-3 border-b border-border">
        <Link href="/" aria-label="voltar" className="size-9 -ml-1 grid place-items-center text-muted text-xl">
          ‹
        </Link>
        <span className="text-sm text-muted">Rotina</span>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{rotina.nome}</h1>
        {ultima && (
          <p className="mt-0.5 text-xs text-muted">
            última: {formatData(ultima.data)} · {ultima.duracaoMin} min ·{" "}
            {ultima.volumeKg.toLocaleString("pt-BR")} kg
          </p>
        )}

        <Link
          href={`/treino?rotina=${rotina.id}`}
          className="mt-4 block rounded-2xl bg-accent text-black font-semibold py-4 text-center"
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
        <div className="mt-2 flex flex-col gap-4">
          {itens.map((i) => (
            <div key={i.exercicios!.id}>
              <Link href={`/exercicios/${i.exercicios!.id}`} className="flex items-center gap-3">
                {/* Espaço da ilustração do movimento. Sem imagem ainda: só há
                    base aberta com FOTO estática (free-exercise-db), e casar
                    com os nomes em pt-BR é trabalho manual — decisão pendente. */}
                <span className="size-10 shrink-0 rounded-full bg-border grid place-items-center text-[10px] text-muted">
                  {i.exercicios!.equipamento?.slice(0, 3) ?? "—"}
                </span>
                <span className="text-accent">{i.exercicios!.nome}</span>
              </Link>
              <p className="mt-1 ml-13 text-[11px] text-muted">
                Descanso: {formatDescanso(i.descanso_seg)}
              </p>
              <div className="mt-1.5 ml-13 flex gap-6 text-[11px] text-muted">
                <span>{i.series_alvo ?? "—"} séries</span>
                <span>
                  {i.reps_alvo_min && i.reps_alvo_max
                    ? `${i.reps_alvo_min}–${i.reps_alvo_max} reps`
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-8" />
    </main>
  );
}
