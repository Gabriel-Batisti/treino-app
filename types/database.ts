/**
 * Tipos do schema — GERADO, não editar à mão.
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * Regerar SEMPRE depois de rodar uma migration nova. Os apelidos no fim do
 * arquivo derivam daqui, então uma coluna que muda de tipo quebra no tsc em
 * vez de quebrar em produção.
 *
 * ⚠️ O gerador da Supabase NÃO exclui coluna gerada do `Insert`: `series.Insert`
 * vem com `e1rm?` e `volume_kg?`, que o Postgres recusa em tempo de execução.
 * Por isso os apelidos no fim do arquivo fazem o `Omit` à mão — é lá que a
 * proteção do D-003 realmente existe. Não use `Tables["series"]["Insert"]` cru.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      exercicios: {
        Row: {
          arquivado: boolean
          atualizado_em: string
          criado_em: string
          equipamento: string | null
          favorito: boolean
          fixado: boolean
          fonte: string
          grupo_muscular: string | null
          id: string
          modo_medicao: string
          nome: string
          nome_busca: string
          notas: string | null
          ordem_manual: number | null
          ultimo_uso_em: string | null
          unilateral: boolean
          user_id: string
          usos: number
        }
        Insert: {
          arquivado?: boolean
          atualizado_em?: string
          criado_em?: string
          equipamento?: string | null
          favorito?: boolean
          fixado?: boolean
          fonte?: string
          grupo_muscular?: string | null
          id?: string
          modo_medicao?: string
          nome: string
          nome_busca: string
          notas?: string | null
          ordem_manual?: number | null
          ultimo_uso_em?: string | null
          unilateral?: boolean
          user_id?: string
          usos?: number
        }
        Update: {
          arquivado?: boolean
          atualizado_em?: string
          criado_em?: string
          equipamento?: string | null
          favorito?: boolean
          fixado?: boolean
          fonte?: string
          grupo_muscular?: string | null
          id?: string
          modo_medicao?: string
          nome?: string
          nome_busca?: string
          notas?: string | null
          ordem_manual?: number | null
          ultimo_uso_em?: string | null
          unilateral?: boolean
          user_id?: string
          usos?: number
        }
        Relationships: []
      }
      rotina_exercicios: {
        Row: {
          atualizado_em: string
          criado_em: string
          descanso_seg: number | null
          excluido_em: string | null
          exercicio_id: string
          id: string
          notas: string | null
          ordem: number
          reps_alvo_max: number | null
          reps_alvo_min: number | null
          rotina_id: string
          series_alvo: number | null
          superset_grupo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descanso_seg?: number | null
          excluido_em?: string | null
          exercicio_id: string
          id?: string
          notas?: string | null
          ordem?: number
          reps_alvo_max?: number | null
          reps_alvo_min?: number | null
          rotina_id: string
          series_alvo?: number | null
          superset_grupo?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descanso_seg?: number | null
          excluido_em?: string | null
          exercicio_id?: string
          id?: string
          notas?: string | null
          ordem?: number
          reps_alvo_max?: number | null
          reps_alvo_min?: number | null
          rotina_id?: string
          series_alvo?: number | null
          superset_grupo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotina_exercicios_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotina_exercicios_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotinas: {
        Row: {
          arquivada: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          notas: string | null
          ordem: number
          user_id: string
        }
        Insert: {
          arquivada?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          notas?: string | null
          ordem?: number
          user_id?: string
        }
        Update: {
          arquivada?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          notas?: string | null
          ordem?: number
          user_id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          atualizado_em: string
          concluida: boolean
          criado_em: string
          distancia_m: number | null
          duracao_seg: number | null
          e1rm: number | null
          excluido_em: string | null
          id: string
          indice: number
          peso_kg: number | null
          registrada_em: string
          reps: number | null
          rpe: number | null
          sessao_exercicio_id: string
          tipo: string
          volume_kg: number | null
        }
        Insert: {
          atualizado_em?: string
          concluida?: boolean
          criado_em?: string
          distancia_m?: number | null
          duracao_seg?: number | null
          e1rm?: number | null
          excluido_em?: string | null
          id: string
          indice: number
          peso_kg?: number | null
          registrada_em: string
          reps?: number | null
          rpe?: number | null
          sessao_exercicio_id: string
          tipo?: string
          volume_kg?: number | null
        }
        Update: {
          atualizado_em?: string
          concluida?: boolean
          criado_em?: string
          distancia_m?: number | null
          duracao_seg?: number | null
          e1rm?: number | null
          excluido_em?: string | null
          id?: string
          indice?: number
          peso_kg?: number | null
          registrada_em?: string
          reps?: number | null
          rpe?: number | null
          sessao_exercicio_id?: string
          tipo?: string
          volume_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_sessao_exercicio_id_fkey"
            columns: ["sessao_exercicio_id"]
            isOneToOne: false
            referencedRelation: "sessao_exercicios"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_exercicios: {
        Row: {
          atualizado_em: string
          criado_em: string
          excluido_em: string | null
          exercicio_id: string
          id: string
          modo_medicao_snapshot: string
          nome_snapshot: string
          notas: string | null
          ordem: number
          sessao_id: string
          superset_grupo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          excluido_em?: string | null
          exercicio_id: string
          id: string
          modo_medicao_snapshot: string
          nome_snapshot: string
          notas?: string | null
          ordem?: number
          sessao_id: string
          superset_grupo?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          excluido_em?: string | null
          exercicio_id?: string
          id?: string
          modo_medicao_snapshot?: string
          nome_snapshot?: string
          notas?: string | null
          ordem?: number
          sessao_id?: string
          superset_grupo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessao_exercicios_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_exercicios_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_exercicios_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "vw_ultimo_desempenho"
            referencedColumns: ["sessao_id"]
          },
        ]
      }
      sessoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_local: string
          duracao_seg: number | null
          fim_em: string | null
          id: string
          inicio_em: string
          nome: string | null
          notas: string | null
          origem: string
          peso_corporal_kg: number | null
          rotina_id: string | null
          sincronizado_em: string | null
          status: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_local: string
          duracao_seg?: number | null
          fim_em?: string | null
          id: string
          inicio_em: string
          nome?: string | null
          notas?: string | null
          origem?: string
          peso_corporal_kg?: number | null
          rotina_id?: string | null
          sincronizado_em?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_local?: string
          duracao_seg?: number | null
          fim_em?: string | null
          id?: string
          inicio_em?: string
          nome?: string | null
          notas?: string | null
          origem?: string
          peso_corporal_kg?: number | null
          rotina_id?: string | null
          sincronizado_em?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_ultimo_desempenho: {
        Row: {
          atualizado_em: string | null
          data_local: string | null
          distancia_m: number | null
          duracao_seg: number | null
          e1rm: number | null
          exercicio_id: string | null
          indice: number | null
          inicio_em: string | null
          peso_kg: number | null
          reps: number | null
          rpe: number | null
          sessao_id: string | null
          user_id: string | null
          volume_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessao_exercicios_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Apelidos usados pelo app. Derivados do schema acima — nunca redigitados.
// ─────────────────────────────────────────────────────────────────────────────

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
/** Sem `volume_kg` nem `e1rm`: são colunas geradas (D-003). */
export type SerieInsert = Omit<Tabelas["series"]["Insert"], "volume_kg" | "e1rm">;

/** Uma linha da view do "anterior" (D-005). */
export type UltimoDesempenho = Views["vw_ultimo_desempenho"]["Row"];

export type ModoMedicao = "peso_reps" | "peso_corporal_reps" | "tempo" | "distancia";
export type TipoSerie = "normal" | "aquecimento" | "drop" | "falha" | "backoff";
export type StatusSessao = "em_andamento" | "concluida" | "abandonada";
export type OrigemSessao = "app" | "importado_heavy";
