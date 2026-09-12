/**
 * Apelidos do schema usados pelo app. Derivados de `database.ts` — nunca
 * redigitados.
 *
 * POR QUE ESTE ARQUIVO EXISTE E NÃO MORA EM `database.ts`: `supabase gen types`
 * SOBRESCREVE o arquivo inteiro. Este bloco já viveu lá e foi apagado na
 * regeração da 0006. Aqui ele é imune.
 *
 * ⚠️ O gerador NÃO exclui coluna gerada do `Insert`: `series.Insert` vem com
 * `e1rm?` e `volume_kg?`, que o Postgres recusa em tempo de execução. Os `Omit`
 * abaixo são onde a proteção do D-003 realmente existe — não use
 * `Tables["series"]["Insert"]` cru.
 */
import type { Database } from "./database";


type Tabelas = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type Exercicio = Tabelas["exercicios"]["Row"];
export type ExercicioInsert = Tabelas["exercicios"]["Insert"];
export type Rotina = Tabelas["rotinas"]["Row"];
export type RotinaExercicio = Tabelas["rotina_exercicios"]["Row"];
export type Sessao = Tabelas["sessoes"]["Row"];
/** Sem `duracao_seg`: é coluna gerada, o Postgres recusa no insert (D-003). */
export type SessaoInsert = Omit<Tabelas["sessoes"]["Insert"], "duracao_seg">;
export type SessaoExercicio = Tabelas["sessao_exercicios"]["Row"];
export type SessaoExercicioInsert = Tabelas["sessao_exercicios"]["Insert"];
export type Serie = Tabelas["series"]["Row"];
export type Cardio = Tabelas["cardios"]["Row"];
export type Medida = Tabelas["medidas"]["Row"];
/** Sem `massa_gorda_kg`: é coluna gerada (D-003). */
export type MedidaInsert = Omit<Tabelas["medidas"]["Insert"], "massa_gorda_kg">;
export type Foto = Tabelas["fotos"]["Row"];
export type FotoInsert = Tabelas["fotos"]["Insert"];
/** Sem `kcal_por_min`: é coluna gerada (D-003). */
export type CardioInsert = Omit<Tabelas["cardios"]["Insert"], "kcal_por_min">;
/** Sem `volume_kg` nem `e1rm`: são colunas geradas (D-003). */
export type SerieInsert = Omit<Tabelas["series"]["Insert"], "volume_kg" | "e1rm">;

/** Uma linha da view do "anterior" (D-005). */
export type UltimoDesempenho = Views["vw_ultimo_desempenho"]["Row"];

/** Melhor marca por exercício — alimenta a contagem de recordes na timeline. */
export type RecordeExercicio = Views["vw_recorde_exercicio"]["Row"];

export type ModoMedicao = "peso_reps" | "peso_corporal_reps" | "tempo" | "distancia";
export type TipoSerie = "normal" | "aquecimento" | "drop" | "falha" | "backoff";
export type StatusSessao = "em_andamento" | "concluida" | "abandonada";
export type OrigemSessao = "app" | "importado_heavy";
