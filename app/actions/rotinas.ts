"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Edição de rotina.
 *
 * Arquivo "use server" só exporta função async — schema fica interno.
 */

const descansoSchema = z.object({
  rotinaExercicioId: z.uuid(),
  rotinaId: z.uuid(),
  // 0 = sem descanso. Teto de 15 min: acima disso é dedo errado, não intenção.
  descansoSeg: z.number().int().min(0).max(900),
});

export type ResultadoAcao<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function atualizarDescanso(payload: unknown): Promise<ResultadoAcao> {
  const parsed = descansoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "valor inválido" };
  const { rotinaExercicioId, rotinaId, descansoSeg } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotina_exercicios")
    .update({ descanso_seg: descansoSeg || null })
    .eq("id", rotinaExercicioId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${rotinaId}`);
  return { ok: true, data: null };
}

const reordenarSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
});

/**
 * Persiste a ordem depois do arrastar. Recebe os ids JÁ na ordem final e grava
 * o índice de cada um — mais simples e mais robusto que mandar "moveu de X pra
 * Y", que depende de o cliente e o servidor concordarem no estado anterior.
 */
export async function reordenarRotinas(payload: unknown): Promise<ResultadoAcao> {
  const parsed = reordenarSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "lista inválida" };

  const supabase = await createClient();
  for (const [i, id] of parsed.data.ids.entries()) {
    const { error } = await supabase.from("rotinas").update({ ordem: i }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}

const arquivarSchema = z.object({
  id: z.uuid(),
  arquivada: z.boolean(),
});

/**
 * Ocultar = `arquivada`, NUNCA delete (D-007): um delete é invisível pro sync
 * delta e o registro ressuscitaria no próximo pull. E o histórico das sessões
 * não é tocado — some a rotina, não o que você treinou.
 */
export async function arquivarRotina(payload: unknown): Promise<ResultadoAcao> {
  const parsed = arquivarSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotinas")
    .update({ arquivada: parsed.data.arquivada })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}
