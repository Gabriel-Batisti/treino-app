/**
 * Tipos do schema — GERADO por:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * NÃO EDITAR, e não pôr nada aqui dentro: o comando sobrescreve o arquivo
 * inteiro. Apelidos e `Omit` de coluna gerada ficam em `types/app.ts`.
 *
 * Regerar SEMPRE depois de rodar uma migration nova — assim uma coluna que
 * muda de tipo quebra no tsc em vez de quebrar em produção.
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
      cardios: {
        Row: {
          atualizado_em: string
          calorias: number | null
          criado_em: string
          data_local: string
          distancia_km: number | null
          duracao_min: number
          excluido_em: string | null
          fc_max: number | null
          fc_media: number | null
          fonte: string
          id: string
          inicio_em: string
          intensidade: string | null
          kcal_por_min: number | null
          notas: string | null
          origem_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          calorias?: number | null
          criado_em?: string
          data_local: string
          distancia_km?: number | null
          duracao_min: number
          excluido_em?: string | null
          fc_max?: number | null
          fc_media?: number | null
          fonte?: string
          id: string
          inicio_em: string
          intensidade?: string | null
          kcal_por_min?: number | null
          notas?: string | null
          origem_id?: string | null
          tipo: string
          user_id?: string
        }
        Update: {
          atualizado_em?: string
          calorias?: number | null
          criado_em?: string
          data_local?: string
          distancia_km?: number | null
          duracao_min?: number
          excluido_em?: string | null
          fc_max?: number | null
          fc_media?: number | null
          fonte?: string
          id?: string
          inicio_em?: string
          intensidade?: string | null
          kcal_por_min?: number | null
          notas?: string | null
          origem_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
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
      fotos: {
        Row: {
          altura: number | null
          angulo: string
          arquivo_path: string
          atualizado_em: string
          criado_em: string
          data_local: string
          excluido_em: string | null
          id: string
          largura: number | null
          notas: string | null
          tirada_em: string
          user_id: string
        }
        Insert: {
          altura?: number | null
          angulo?: string
          arquivo_path: string
          atualizado_em?: string
          criado_em?: string
          data_local: string
          excluido_em?: string | null
          id: string
          largura?: number | null
          notas?: string | null
          tirada_em: string
          user_id?: string
        }
        Update: {
          altura?: number | null
          angulo?: string
          arquivo_path?: string
          atualizado_em?: string
          criado_em?: string
          data_local?: string
          excluido_em?: string | null
          id?: string
          largura?: number | null
          notas?: string | null
          tirada_em?: string
          user_id?: string
        }
        Relationships: []
      }
      medidas: {
        Row: {
          agua_pct: number | null
          arquivo_path: string | null
          atualizado_em: string
          cintura_cm: number | null
          criado_em: string
          data_local: string
          excluido_em: string | null
          gordura_pct: number | null
          gordura_visceral: number | null
          id: string
          massa_gorda_kg: number | null
          massa_magra_kg: number | null
          massa_muscular_kg: number | null
          medido_em: string
          notas: string | null
          origem: string
          peso_kg: number
          tmb_kcal: number | null
          user_id: string
        }
        Insert: {
          agua_pct?: number | null
          arquivo_path?: string | null
          atualizado_em?: string
          cintura_cm?: number | null
          criado_em?: string
          data_local: string
          excluido_em?: string | null
          gordura_pct?: number | null
          gordura_visceral?: number | null
          id: string
          massa_gorda_kg?: number | null
          massa_magra_kg?: number | null
          massa_muscular_kg?: number | null
          medido_em: string
          notas?: string | null
          origem?: string
          peso_kg: number
          tmb_kcal?: number | null
          user_id?: string
        }
        Update: {
          agua_pct?: number | null
          arquivo_path?: string | null
          atualizado_em?: string
          cintura_cm?: number | null
          criado_em?: string
          data_local?: string
          excluido_em?: string | null
          gordura_pct?: number | null
          gordura_visceral?: number | null
          id?: string
          massa_gorda_kg?: number | null
          massa_magra_kg?: number | null
          massa_muscular_kg?: number | null
          medido_em?: string
          notas?: string | null
          origem?: string
          peso_kg?: number
          tmb_kcal?: number | null
          user_id?: string
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
          apple_origem_id: string | null
          atualizado_em: string
          calorias: number | null
          criado_em: string
          data_local: string
          duracao_seg: number | null
          fc_max: number | null
          fc_media: number | null
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
          apple_origem_id?: string | null
          atualizado_em?: string
          calorias?: number | null
          criado_em?: string
          data_local: string
          duracao_seg?: number | null
          fc_max?: number | null
          fc_media?: number | null
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
          apple_origem_id?: string | null
          atualizado_em?: string
          calorias?: number | null
          criado_em?: string
          data_local?: string
          duracao_seg?: number | null
          fc_max?: number | null
          fc_media?: number | null
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
      vw_recorde_exercicio: {
        Row: {
          exercicio_id: string | null
          melhor_e1rm: number | null
          melhor_peso: number | null
          melhor_volume_serie: number | null
          total_series: number | null
          user_id: string | null
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
