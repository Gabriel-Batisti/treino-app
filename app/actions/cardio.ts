"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Registro de cardio (tabela `cardios`, migration 0002).
 *
 * Arquivo "use server" só exporta função async — schema fica interno.
 */

const cardioSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(["esteira", "bicicleta", "eliptico", "escada", "remo", "corrida", "caminhada", "outro"]),
  inicio_em: z.iso.datetime({ offset: true }),
  // Do relógio do celular, não de now() no servidor (D-012).
  data_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duracao_min: z.number().int().min(1).max(600),
  calorias: z.number().int().min(0).max(5000).nullable(),
  distancia_km: z.number().min(0).max(500).nullable(),
  intensidade: z.enum(["leve", "moderado", "intenso"]).nullable(),
  notas: z.string().max(500).nullable(),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function salvarCardio(payload: unknown): Promise<ResultadoAcao> {
  const parsed = cardioSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  // upsert por id (vindo do client) — retry não duplica (D-007).
  const { error } = await supabase
    .from("cardios")
    .upsert({ ...parsed.data, user_id: auth.user.id });

  if (error) {
    // A 0002 pode não ter sido rodada ainda; o erro cru não diz isso.
    if (error.message.includes("cardios")) {
      return { ok: false, error: "Tabela `cardios` não existe — rode a migration 0002 no Supabase." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: null };
}
