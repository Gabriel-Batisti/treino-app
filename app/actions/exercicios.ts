"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Criação de exercício no catálogo.
 *
 * Até aqui o catálogo era congelado nos 48 que vieram da importação do Heavy —
 * dava pra olhar e não pra mexer. Máquina nova na academia não tinha caminho.
 *
 * Arquivo "use server" só exporta função async — schema fica interno.
 */

const exercicioSchema = z.object({
  // Id do client (D-007): o exercício pode nascer offline, no meio do treino.
  id: z.uuid(),
  nome: z.string().trim().min(2).max(80),
  // Calculado em TypeScript, nunca no banco (ver lib/treino/texto.ts).
  nome_busca: z.string().trim().min(1).max(80),
  grupo_muscular: z.string().trim().max(40).nullable(),
  equipamento: z.string().trim().max(40).nullable(),
  modo_medicao: z.enum(["peso_reps", "peso_corporal_reps", "tempo", "distancia"]),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function criarExercicio(payload: unknown): Promise<ResultadoAcao> {
  const parsed = exercicioSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase.from("exercicios").upsert({
    ...parsed.data,
    user_id: auth.user.id,
    fonte: "manual",
  });

  if (error) {
    // `exercicios_nome_busca_uidx` — único parcial em (user_id, nome_busca).
    // É a constraint que impede o histórico de se partir em dois nomes (D-014).
    if (error.code === "23505") {
      return { ok: false, error: "Já existe um exercício com esse nome." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/exercicios");
  return { ok: true, data: null };
}
