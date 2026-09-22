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

interface LinhaRotina {
  id: string;
  nome: string;
  grupo?: string | null;
  ordem: number;
  arquivada: boolean;
  rotina_exercicios: ItemRotina[] | null;
}

interface ItemRotina {
  id: string;
  ordem: number;
  series_alvo: number | null;
  /** Opcional: a 0012 pode não ter rodado, e a coluna vem undefined. */
  series_backup?: number | null;
  backup_pct_carga?: number | null;
  backup_descanso_seg?: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  descanso_seg: number | null;
  notas?: string | null;
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
    /** Programa a que este treino pertence. Null = treino solto. */
    grupo: string | null;
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
      seriesBackup: number;
      backupPctCarga: number | null;
      backupDescansoSeg: number | null;
      repsAlvoMin: number | null;
      repsAlvoMax: number | null;
      descansoSeg: number | null;
      notas: string | null;
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
    .select("nome, rotina_id, data_local")
    .eq("status", "concluida")
    .order("inicio_em", { ascending: false })
    .limit(60);

  /**
   * "Última vez" por ID primeiro, por NOME só como sobra.
   *
   * O nome sozinho passou a mentir quando dois programas ganharam um "Treino
   * A" cada: o treino recém-criado nascia mostrando a data do homônimo velho,
   * de março. Sessão gravada pelo app agora carrega `rotina_id` — o nome
   * continua atendendo o histórico importado do Heavy, que não tem o vínculo.
   */
  const porId = new Map<string, string>();
  const porNome = new Map<string, string>();
  for (const s of ultimas ?? []) {
    if (s.rotina_id && !porId.has(s.rotina_id)) porId.set(s.rotina_id, s.data_local);
    if (s.nome && !porNome.has(s.nome)) porNome.set(s.nome, s.data_local);
  }

  const { data: catalogo } = await supabase
    .from("exercicios")
    .select("id, nome, nome_busca, grupo_muscular, equipamento, modo_medicao, usos, ultimo_uso_em")
    .eq("arquivado", false);

  /**
   * Duas listas de colunas, e não uma.
   *
   * Pedir coluna que não existe faz o PostgREST devolver 400 — e aqui isso não
   * seria "um campo a menos", seria o pull INTEIRO falhando: sem rotina no
   * banco local, a tela de treino fica vazia e o app deixa de funcionar na
   * academia. Foi o que aconteceu quando a 0012 entrou no código antes de
   * rodar no banco.
   *
   * Como migration aqui é rodada à mão (e portanto pode atrasar em relação ao
   * deploy), o pull tenta o conjunto novo e cai no antigo se ele não existir.
   * Os campos que faltam viram null/0 na normalização abaixo.
   */
  // As duas listas ficam LITERAIS: o client do Supabase lê a string do select
  // em tempo de tipo, e montar por template derruba a inferência inteira.
  // Mesmo filtro nas duas: sem ele o banco local receberia exercício removido
  // da rotina e a tela de treino o mostraria offline.
  const nova = await supabase
    .from("rotinas")
    .select(
      "id, nome, grupo, ordem, arquivada, rotina_exercicios(id, ordem, series_alvo, series_backup, backup_pct_carga, backup_descanso_seg, reps_alvo_min, reps_alvo_max, descanso_seg, notas, exercicios(id, nome, nome_busca, modo_medicao))",
    )
    .is("rotina_exercicios.excluido_em", null)
    .order("ordem");

  let rotinas = nova.data as unknown as LinhaRotina[] | null;
  let error = nova.error;

  if (error) {
    const antiga = await supabase
      .from("rotinas")
      .select(
        "id, nome, grupo, ordem, arquivada, rotina_exercicios(id, ordem, series_alvo, reps_alvo_min, reps_alvo_max, descanso_seg, notas, exercicios(id, nome, nome_busca, modo_medicao))",
      )
      .is("rotina_exercicios.excluido_em", null)
      .order("ordem");
    rotinas = antiga.data as unknown as LinhaRotina[] | null;
    error = antiga.error;
  }
  if (error) return { ok: false, error: error.message };

  const comExercicios = (rotinas ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    grupo: r.grupo ?? null,
    ordem: r.ordem,
    arquivada: r.arquivada,
    // Se ESTE treino já tem sessão própria, o nome nem é consultado: ele só
    // responde por quem ainda não tem vínculo nenhum.
    ultimaVez: porId.get(r.id) ?? (r.nome ? (porNome.get(r.nome) ?? null) : null),
    exercicios: (r.rotina_exercicios ?? [])
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
        // A 0012 pode não ter rodado ainda: sem ela a coluna volta undefined e
        // 0 é o certo (nenhuma série é backup), não NaN.
        seriesBackup: i.series_backup ?? 0,
        backupPctCarga: i.backup_pct_carga ?? null,
        backupDescansoSeg: i.backup_descanso_seg ?? null,
        repsAlvoMin: i.reps_alvo_min,
        repsAlvoMax: i.reps_alvo_max,
        descansoSeg: i.descanso_seg,
        notas: i.notas ?? null,
      })),
  }));

  const ids = [...new Set(comExercicios.flatMap((r) => r.exercicios.map((e) => e.exercicioId)))];

  const { data: anteriores } = ids.length
    ? await supabase.from("vw_ultimo_desempenho").select("*").in("exercicio_id", ids)
    : { data: [] as UltimoDesempenho[] };

  // Recorde de carga, pra tela de treino saber na hora que a série bateu um.
  // A view pode não existir (0002 não rodada) — a tela não pode quebrar por isso.
  const { data: recordes } = ids.length
    ? await supabase
        .from("vw_recorde_exercicio")
        .select("exercicio_id, melhor_peso")
        .in("exercicio_id", ids)
        .then((r) => r, () => ({ data: null }))
    : { data: null };

  const melhorPeso = new Map<string, number | null>(
    ((recordes ?? []) as { exercicio_id: string | null; melhor_peso: number | null }[])
      .filter((r) => r.exercicio_id)
      .map((r) => [r.exercicio_id!, r.melhor_peso]),
  );

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
      recordePesoKg: melhorPeso.get(exercicioId) ?? null,
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
