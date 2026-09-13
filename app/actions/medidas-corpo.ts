"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_POR_CHAVE } from "@/lib/medidas/sites";

/**
 * Medidas de fita (tabela `medidas_corpo`, migration 0011).
 *
 * Arquivo "use server" só exporta função async — schema fica interno.
 */

const schema = z.object({
  data_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * Só chave conhecida entra, e só número plausível. Sem isso, um campo
   * renomeado no futuro deixaria lixo no jsonb pra sempre — e jsonb não tem
   * check constraint pra me avisar.
   */
  valores: z.record(z.string(), z.number().gt(5).lt(300)),
  notas: z.string().max(500).nullish(),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function salvarMedidasCorpo(payload: unknown): Promise<ResultadoAcao> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const valores = Object.fromEntries(
    Object.entries(parsed.data.valores).filter(([k]) => SITE_POR_CHAVE.has(k)),
  );
  if (Object.keys(valores).length === 0) {
    return { ok: false, error: "Preencha pelo menos uma medida." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  // Já existe medição neste dia? Então é correção, não registro novo — o
  // índice único cuida disso, mas o upsert por id evita o erro de conflito.
  const { data: existente } = await supabase
    .from("medidas_corpo")
    .select("id, valores")
    .eq("user_id", auth.user.id)
    .eq("data_local", parsed.data.data_local)
    .is("excluido_em", null)
    .maybeSingle();

  const { error } = await supabase.from("medidas_corpo").upsert({
    id: existente?.id ?? crypto.randomUUID(),
    user_id: auth.user.id,
    data_local: parsed.data.data_local,
    // Mede-se cintura hoje e braço amanhã: o que já estava fica.
    valores: { ...((existente?.valores as Record<string, number>) ?? {}), ...valores },
    notas: parsed.data.notas ?? null,
    atualizado_em: new Date().toISOString(),
    excluido_em: null,
  });

  if (error) {
    if (error.message.includes("medidas_corpo")) {
      return { ok: false, error: "Tabela `medidas_corpo` não existe — rode a migration 0011." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/corpo/fita");
  return { ok: true, data: null };
}

export async function excluirMedidasCorpo(id: string): Promise<ResultadoAcao> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "id inválido" };

  const supabase = await createClient();
  // Exclusão é `excluido_em`, nunca delete (D-007).
  const { error } = await supabase
    .from("medidas_corpo")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/corpo/fita");
  return { ok: true, data: null };
}
