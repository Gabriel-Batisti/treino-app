import { createClient } from "@/lib/supabase/server";
import { SessaoAtiva, type ExercicioDaSessao } from "./sessao-ativa";
import type { UltimoDesempenho } from "@/types/database";

export const dynamic = "force-dynamic";

interface ItemRotina {
  ordem: number;
  series_alvo: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  descanso_seg: number | null;
  exercicios: { id: string; nome: string; modo_medicao: string } | null;
}

/**
 * Carrega a rotina + o "anterior" e entrega pro client.
 *
 * ⚠️ PROVISÓRIO: hoje é um fetch no servidor ao abrir a tela. O D-007 diz que o
 * caminho de leitura definitivo é o IndexedDB, atualizado em background — senão,
 * offline no minuto zero você entra no treino sem saber o que fez da última vez.
 * A fronteira já está no lugar certo (este componente busca, o client só
 * recebe), então a troca acontece aqui.
 */
export default async function TreinoPage({ searchParams }: PageProps<"/treino">) {
  const { rotina: rotinaId } = await searchParams;
  const supabase = await createClient();

  if (typeof rotinaId !== "string") {
    return <SessaoAtiva nomeRotina={null} exerciciosIniciais={[]} />;
  }

  const { data: rotina } = await supabase
    .from("rotinas")
    .select(
      "id, nome, rotina_exercicios(ordem, series_alvo, reps_alvo_min, reps_alvo_max, descanso_seg, exercicios(id, nome, modo_medicao))",
    )
    .eq("id", rotinaId)
    .maybeSingle();

  const itens = ((rotina?.rotina_exercicios ?? []) as unknown as ItemRotina[])
    .filter((i) => i.exercicios)
    .sort((a, b) => a.ordem - b.ordem);

  let exercicios: ExercicioDaSessao[] = [];

  if (itens.length) {
    const { data: anteriores } = await supabase
      .from("vw_ultimo_desempenho")
      .select("*")
      .in("exercicio_id", itens.map((i) => i.exercicios!.id));

    // View não carrega NOT NULL: no tipo gerado toda coluna vem anulável,
    // mesmo as que a tabela de origem garante. Filtra em vez de usar `!`.
    const porExercicio = new Map<string, UltimoDesempenho[]>();
    for (const a of (anteriores ?? []) as UltimoDesempenho[]) {
      if (!a.exercicio_id || a.indice == null) continue;
      porExercicio.set(a.exercicio_id, [...(porExercicio.get(a.exercicio_id) ?? []), a]);
    }

    exercicios = itens.map((i) => {
      const ex = i.exercicios!;
      const ant = (porExercicio.get(ex.id) ?? []).sort((a, b) => (a.indice ?? 0) - (b.indice ?? 0));
      return {
        exercicioId: ex.id,
        nome: ex.nome,
        modoMedicao: ex.modo_medicao,
        seriesAlvo: i.series_alvo ?? Math.max(ant.length, 1),
        repsAlvoMin: i.reps_alvo_min,
        repsAlvoMax: i.reps_alvo_max,
        descansoSeg: i.descanso_seg,
        anterior: ant.map((a) => ({
          indice: a.indice ?? 0,
          pesoKg: a.peso_kg,
          reps: a.reps,
          e1rm: a.e1rm,
        })),
        anteriorEm: ant[0]?.data_local ?? null,
      };
    });
  }

  return <SessaoAtiva nomeRotina={rotina?.nome ?? null} exerciciosIniciais={exercicios} />;
}
