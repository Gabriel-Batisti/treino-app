import { createClient } from "@/lib/supabase/server";
import { SessaoAtiva, type ExercicioDaSessao } from "./sessao-ativa";
import type { UltimoDesempenho } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Carrega o modelo do treino + o "anterior" e entrega pro client.
 *
 * ⚠️ PROVISÓRIO: hoje isto é um fetch no servidor ao abrir a tela. O D-007 diz
 * que o caminho de leitura definitivo é o IndexedDB, atualizado em background —
 * senão, offline no minuto zero você entra no treino sem saber o que fez da
 * última vez. A camada local entra em seguida; a fronteira já está no lugar
 * certo (este componente busca, o client só recebe), então a troca é aqui.
 */
export default async function TreinoPage({
  searchParams,
}: PageProps<"/treino">) {
  const { modelo } = await searchParams;
  const nomeModelo = typeof modelo === "string" ? modelo : null;

  const supabase = await createClient();
  let exercicios: ExercicioDaSessao[] = [];

  if (nomeModelo) {
    const { data: ultima } = await supabase
      .from("sessoes")
      .select("id, sessao_exercicios(exercicio_id, ordem, nome_snapshot, modo_medicao_snapshot)")
      .eq("status", "concluida")
      .eq("nome", nomeModelo)
      .order("inicio_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const doModelo = ((ultima?.sessao_exercicios ?? []) as {
      exercicio_id: string; ordem: number; nome_snapshot: string; modo_medicao_snapshot: string;
    }[]).sort((a, b) => a.ordem - b.ordem);

    if (doModelo.length) {
      const { data: anteriores } = await supabase
        .from("vw_ultimo_desempenho")
        .select("*")
        .in("exercicio_id", doModelo.map((e) => e.exercicio_id));

      // View não carrega NOT NULL: no tipo gerado toda coluna vem anulável,
      // mesmo as que a tabela de origem garante. Filtra em vez de usar `!`.
      const porExercicio = new Map<string, UltimoDesempenho[]>();
      for (const a of (anteriores ?? []) as UltimoDesempenho[]) {
        if (!a.exercicio_id || a.indice == null) continue;
        porExercicio.set(a.exercicio_id, [...(porExercicio.get(a.exercicio_id) ?? []), a]);
      }

      exercicios = doModelo.map((e) => {
        const ant = (porExercicio.get(e.exercicio_id) ?? [])
          .sort((a, b) => (a.indice ?? 0) - (b.indice ?? 0));
        return {
          exercicioId: e.exercicio_id,
          nome: e.nome_snapshot,
          modoMedicao: e.modo_medicao_snapshot,
          anterior: ant.map((a) => ({
            indice: a.indice ?? 0, pesoKg: a.peso_kg, reps: a.reps, e1rm: a.e1rm,
          })),
          anteriorEm: ant[0]?.data_local ?? null,
        };
      });
    }
  }

  return <SessaoAtiva nomeModelo={nomeModelo} exerciciosIniciais={exercicios} />;
}
