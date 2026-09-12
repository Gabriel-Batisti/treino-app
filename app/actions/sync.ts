"use server";

import { createClient } from "@/lib/supabase/server";
import type { UltimoDesempenho } from "@/types/app";

/**
 * Payload que abastece o banco local (D-007).
 *
 * Uma chamada só, com tudo que a academia precisa: as rotinas e o último
 * desempenho de cada exercício delas. É pouca coisa — 10 rotinas e ~50
 * exercícios — então não vale complicar com delta por `atualizado_em` ainda.
 * Quando passar de alguns milhares de linhas, aí sim.
 *
 * Arquivo "use server" só exporta função async.
 */

interface ItemRotina {
  id: string;
  ordem: number;
  series_alvo: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  descanso_seg: number | null;
  exercicios: { id: string; nome: string; nome_busca: string; modo_medicao: string } | null;
}

export interface DadosLocais {
  /** Catálogo inteiro — é o que alimenta o seletor de exercício offline. */
  exercicios: {
    id: string;
    nome: string;
    nomeBusca: string;
    grupoMuscular: string | null;
    equipamento: string | null;
    modoMedicao: string;
    usos: number;
    ultimoUsoEm: string | null;
  }[];
  rotinas: {
    id: string;
    nome: string;
    ordem: number;
    arquivada: boolean;
    ultimaVez: string | null;
    exercicios: {
      rotinaExercicioId: string;
      exercicioId: string;
      nome: string;
      nomeBusca: string;
      modoMedicao: string;
      ordem: number;
      seriesAlvo: number | null;
      repsAlvoMin: number | null;
      repsAlvoMax: number | null;
      descansoSeg: number | null;
    }[];
  }[];
  desempenho: {
    exercicioId: string;
    dataLocal: string;
    series: { indice: number; pesoKg: number | null; reps: number | null; e1rm: number | null }[];
  }[];
  geradoEm: string;
}

export async function puxarDadosLocais(): Promise<
  { ok: true; data: DadosLocais } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "sem sessão" };

  const { data: ultimas } = await supabase
    .from("sessoes")
    .select("nome, data_local")
    .eq("status", "concluida")
    .order("inicio_em", { ascending: false })
    .limit(60);

  // Casa por NOME — é o que liga rotina e histórico enquanto
  // `sessoes.rotina_id` não é preenchido.
  const ultimaVez = new Map<string, string>();
  for (const s of ultimas ?? []) {
    if (s.nome && !ultimaVez.has(s.nome)) ultimaVez.set(s.nome, s.data_local);
  }

  const { data: catalogo } = await supabase
    .from("exercicios")
    .select("id, nome, nome_busca, grupo_muscular, equipamento, modo_medicao, usos, ultimo_uso_em")
    .eq("arquivado", false);

  const { data: rotinas, error } = await supabase
    .from("rotinas")
    .select(
      "id, nome, ordem, arquivada, rotina_exercicios(id, ordem, series_alvo, reps_alvo_min, reps_alvo_max, descanso_seg, exercicios(id, nome, nome_busca, modo_medicao))",
    )
    // Mesma coisa aqui: sem o filtro, o banco local receberia exercício
    // removido da rotina e a tela de treino o mostraria offline.
    .is("rotina_exercicios.excluido_em", null)
    .order("ordem");
  if (error) return { ok: false, error: error.message };

  const comExercicios = (rotinas ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    ordem: r.ordem,
    arquivada: r.arquivada,
    ultimaVez: r.nome ? (ultimaVez.get(r.nome) ?? null) : null,
    exercicios: ((r.rotina_exercicios ?? []) as unknown as ItemRotina[])
      .filter((i) => i.exercicios)
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({
        rotinaExercicioId: i.id,
        exercicioId: i.exercicios!.id,
        nome: i.exercicios!.nome,
        nomeBusca: i.exercicios!.nome_busca,
        modoMedicao: i.exercicios!.modo_medicao,
        ordem: i.ordem,
        seriesAlvo: i.series_alvo,
        repsAlvoMin: i.reps_alvo_min,
        repsAlvoMax: i.reps_alvo_max,
        descansoSeg: i.descanso_seg,
      })),
  }));

  const ids = [...new Set(comExercicios.flatMap((r) => r.exercicios.map((e) => e.exercicioId)))];

  const { data: anteriores } = ids.length
    ? await supabase.from("vw_ultimo_desempenho").select("*").in("exercicio_id", ids)
    : { data: [] as UltimoDesempenho[] };

  // View não carrega NOT NULL: toda coluna vem anulável no tipo gerado.
  const porExercicio = new Map<string, UltimoDesempenho[]>();
  for (const a of (anteriores ?? []) as UltimoDesempenho[]) {
    if (!a.exercicio_id || a.indice == null) continue;
    porExercicio.set(a.exercicio_id, [...(porExercicio.get(a.exercicio_id) ?? []), a]);
  }

  const desempenho = [...porExercicio.entries()].map(([exercicioId, linhas]) => {
    const ord = linhas.sort((a, b) => (a.indice ?? 0) - (b.indice ?? 0));
    return {
      exercicioId,
      dataLocal: ord[0]?.data_local ?? "",
      series: ord.map((a) => ({
        indice: a.indice ?? 0,
        pesoKg: a.peso_kg,
        reps: a.reps,
        e1rm: a.e1rm,
      })),
    };
  });

  return {
    ok: true,
    data: {
      exercicios: (catalogo ?? []).map((e) => ({
        id: e.id,
        nome: e.nome,
        nomeBusca: e.nome_busca,
        grupoMuscular: e.grupo_muscular,
        equipamento: e.equipamento,
        modoMedicao: e.modo_medicao,
        usos: e.usos,
        ultimoUsoEm: e.ultimo_uso_em,
      })),
      rotinas: comExercicios,
      desempenho,
      geradoEm: new Date().toISOString(),
    },
  };
}
