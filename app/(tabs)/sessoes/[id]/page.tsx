import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Ilustracao } from "@/components/ilustracao";
import { ExcluirTreino } from "./excluir-treino";
import { formatData, formatPeso } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SerieDoTreino {
  indice: number;
  tipo: string;
  peso_kg: number | null;
  reps: number | null;
  e1rm: number | null;
  volume_kg: number | null;
  concluida: boolean;
}

interface ExDoTreino {
  ordem: number;
  nome_snapshot: string;
  notas: string | null;
  exercicios: { id: string; nome_busca: string } | null;
  series: SerieDoTreino[];
}

export default async function TreinoPage({ params }: PageProps<"/sessoes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sessao } = await supabase
    .from("sessoes")
    .select(
      "id, nome, data_local, inicio_em, duracao_seg, notas, origem, fc_media, fc_max, calorias, sessao_exercicios(ordem, nome_snapshot, notas, exercicios(id, nome_busca), series(indice, tipo, peso_kg, reps, e1rm, volume_kg, concluida))",
    )
    .eq("id", id)
    .eq("status", "concluida")
    .maybeSingle();

  if (!sessao) notFound();

  const exs = ((sessao.sessao_exercicios ?? []) as unknown as ExDoTreino[]).sort(
    (a, b) => a.ordem - b.ordem,
  );
  const todas = exs.flatMap((e) => (e.series ?? []).filter((s) => s.concluida));
  const volume = Math.round(todas.reduce((n, s) => n + Number(s.volume_kg ?? 0), 0));

  // RECORDES DESTE TREINO. Mesmo critério da timeline, de propósito: o mesmo
  // número não pode significar duas coisas em duas telas. "Recorde" é conter a
  // melhor marca de PESO do exercício em todo o histórico — peso é fato, e1RM
  // seria estimativa (D-004).
  //
  // A view pode não existir (0002 não rodada): o card some, a tela não quebra.
  const idsDoTreino = exs.map((e) => e.exercicios?.id).filter((x): x is string => !!x);
  const { data: recordesData } = idsDoTreino.length
    ? await supabase
        .from("vw_recorde_exercicio")
        .select("exercicio_id, melhor_peso")
        .in("exercicio_id", idsDoTreino)
        .then((r) => r, () => ({ data: null }))
    : { data: null };

  const melhorPorExercicio = new Map(
    ((recordesData ?? []) as { exercicio_id: string | null; melhor_peso: number | null }[])
      .filter((r) => r.exercicio_id)
      .map((r) => [r.exercicio_id!, Number(r.melhor_peso ?? 0)]),
  );

  const comRecorde = exs.filter((e) => {
    const melhor = e.exercicios ? melhorPorExercicio.get(e.exercicios.id) : undefined;
    if (melhor == null) return false;
    const maxAqui = Math.max(
      0,
      ...(e.series ?? []).filter((x) => x.concluida).map((x) => Number(x.peso_kg ?? 0)),
    );
    return maxAqui >= melhor;
  });
  const qtdRecordes = comRecorde.length;
  const ehRecorde = new Set(comRecorde.map((e) => `${e.ordem}-${e.nome_snapshot}`));

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link
            href="/"
            aria-label="voltar"
            className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
          >
            ‹
          </Link>
          <span className="text-sm font-medium truncate">{sessao.nome ?? "Treino"}</span>
        </div>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{sessao.nome ?? "Treino"}</h1>
        <p className="mt-0.5 text-xs text-muted">
          {formatData(sessao.data_local)}
          {sessao.origem === "importado_heavy" && " · importado do Heavy"}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Tempo", sessao.duracao_seg ? `${Math.round(sessao.duracao_seg / 60)} min` : "—"],
            ["Volume", `${volume.toLocaleString("pt-BR")} kg`],
            ["Séries", String(todas.length)],
            ...(qtdRecordes > 0
              ? ([["Recordes", `🏅 ${qtdRecordes}`]] as [string, string][])
              : []),
            // Só aparecem quando o Apple Watch mandou.
            ...(sessao.fc_media != null
              ? ([["FC média", `${sessao.fc_media} bpm`]] as [string, string][])
              : []),
            ...(sessao.fc_max != null
              ? ([["FC máx", `${sessao.fc_max} bpm`]] as [string, string][])
              : []),
            ...(sessao.calorias != null
              ? ([["Calorias", `${sessao.calorias} kcal`]] as [string, string][])
              : []),
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-xl bg-card border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
              <p className="mt-0.5 text-base tabular-nums">{valor}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-6 px-4 flex flex-col gap-6">
        {exs.map((e) => (
          <div key={`${e.ordem}-${e.nome_snapshot}`}>
            <div className="flex items-center gap-3">
              <Ilustracao nomeBusca={e.exercicios?.nome_busca ?? ""} className="size-10" />
              {/* A medalha ao lado do nome é o que torna o número do card
                  acionável: "3 recordes" sem dizer QUAIS não serve pra nada. */}
              {ehRecorde.has(`${e.ordem}-${e.nome_snapshot}`) && (
                <span title="melhor carga deste exercício" aria-label="recorde">
                  🏅
                </span>
              )}
              {e.exercicios ? (
                <Link href={`/exercicios/${e.exercicios.id}`} className="text-accent">
                  {e.nome_snapshot}
                </Link>
              ) : (
                <span>{e.nome_snapshot}</span>
              )}
            </div>
            {e.notas && <p className="mt-1 ml-13 text-[11px] text-muted italic">{e.notas}</p>}
            <div className="mt-2 ml-13 flex flex-col gap-0.5">
              {(e.series ?? [])
                .filter((s) => s.concluida)
                .sort((a, b) => a.indice - b.indice)
                .map((s) => (
                  <div key={s.indice} className="flex gap-3 text-sm tabular-nums">
                    <span className="w-4 text-muted">{s.indice}</span>
                    <span className="w-28">
                      {formatPeso(s.peso_kg)} kg × {s.reps}
                    </span>
                    {s.e1rm != null && (
                      <span className="text-[11px] text-muted self-center">
                        1RM ~{formatPeso(s.e1rm)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>

      <div className="mt-10 px-4">
        <ExcluirTreino id={sessao.id} nome={sessao.nome ?? "este treino"} />
      </div>

      <div className="h-8" />
    </main>
  );
}
