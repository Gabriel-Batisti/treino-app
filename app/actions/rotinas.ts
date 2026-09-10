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
