/**
 * Tipos do schema (migration 0001).
 *
 * ⚠️ PROVISÓRIO — escrito à mão porque `supabase gen types typescript` exige
 * `supabase login`. Assim que a CLI estiver autenticada, SUBSTITUIR este
 * arquivo pela saída do gerador:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * O leilões-app tem exatamente esta dívida em aberto há meses; aqui ela tem
 * data pra morrer. Ver CLAUDE.md.
 *
 * Convenção: `Row` tem tudo; `Insert` omite as colunas geradas (o Postgres
 * recusa) e as que têm default.
 */

export type ModoMedicao = "peso_reps" | "peso_corporal_reps" | "tempo" | "distancia";
export type FonteExercicio = "seed" | "importado_heavy" | "manual";
export type StatusSessao = "em_andamento" | "concluida" | "abandonada";
export type OrigemSessao = "app" | "importado_heavy";
export type TipoSerie = "normal" | "aquecimento" | "drop" | "falha" | "backoff";

export interface Exercicio {
  id: string;
  user_id: string;
  nome: string;
  nome_busca: string;
  grupo_muscular: string | null;
  equipamento: string | null;
  modo_medicao: ModoMedicao;
  unilateral: boolean;
  fonte: FonteExercicio;
  usos: number;
  ultimo_uso_em: string | null;
  favorito: boolean;
  fixado: boolean;
  ordem_manual: number | null;
  notas: string | null;
  arquivado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Sessao {
  id: string;
  user_id: string;
  rotina_id: string | null;
  nome: string | null;
  inicio_em: string;
  fim_em: string | null;
  data_local: string;
  status: StatusSessao;
  origem: OrigemSessao;
  peso_corporal_kg: number | null;
  notas: string | null;
  /** GERADA — nunca enviar em insert/update. */
  duracao_seg: number | null;
  sincronizado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SessaoExercicio {
  id: string;
  sessao_id: string;
  exercicio_id: string;
  ordem: number;
  nome_snapshot: string;
  modo_medicao_snapshot: ModoMedicao;
  superset_grupo: string | null;
  notas: string | null;
  excluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Serie {
  id: string;
  sessao_exercicio_id: string;
  indice: number;
  tipo: TipoSerie;
  peso_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duracao_seg: number | null;
  distancia_m: number | null;
  concluida: boolean;
  registrada_em: string;
  /** GERADA — nunca enviar em insert/update. */
  volume_kg: number | null;
  /** GERADA (Brzycki, null acima de 12 reps — D-004). Nunca enviar. */
  e1rm: number | null;
  excluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Uma linha da vw_ultimo_desempenho — o "anterior" (D-005). */
export interface UltimoDesempenho {
  user_id: string;
  exercicio_id: string;
  indice: number;
  peso_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duracao_seg: number | null;
  distancia_m: number | null;
  volume_kg: number | null;
  e1rm: number | null;
  sessao_id: string;
  inicio_em: string;
  data_local: string;
  atualizado_em: string;
}

export type SessaoInsert = Omit<Sessao, "duracao_seg" | "criado_em" | "atualizado_em">;
export type SessaoExercicioInsert = Omit<SessaoExercicio, "criado_em" | "atualizado_em">;
export type SerieInsert = Omit<Serie, "volume_kg" | "e1rm" | "criado_em" | "atualizado_em">;
