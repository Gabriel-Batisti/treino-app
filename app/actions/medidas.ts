"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Pesagem diária e bioimpedância (tabela `medidas`, migration 0003).
 *
 * Arquivo "use server" só exporta função async — schemas ficam internos.
 */

const medidaSchema = z.object({
  id: z.uuid(),
  origem: z.enum(["manual", "bioimpedancia"]),
  medido_em: z.iso.datetime({ offset: true }),
  // Do relógio do celular, não de now() no servidor (D-012).
  data_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  peso_kg: z.number().gt(20).lt(400),
  gordura_pct: z.number().min(0).max(75).nullable(),
  massa_magra_kg: z.number().min(0).nullable(),
  massa_muscular_kg: z.number().min(0).nullable(),
  agua_pct: z.number().min(0).max(100).nullable(),
  gordura_visceral: z.number().min(0).nullable(),
  tmb_kcal: z.number().int().min(0).nullable(),
  cintura_cm: z.number().gt(0).nullable(),
  arquivo_path: z.string().max(400).nullable(),
  notas: z.string().max(500).nullable(),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function salvarMedida(payload: unknown): Promise<ResultadoAcao> {
  const parsed = medidaSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  // upsert por id: a pesagem do dia usa id determinístico, então registrar de
  // novo no mesmo dia CORRIGE em vez de duplicar.
  const { error } = await supabase
    .from("medidas")
    .upsert({ ...parsed.data, user_id: auth.user.id, excluido_em: null });

  if (error) {
    if (error.message.includes("medidas")) {
      return { ok: false, error: "Tabela `medidas` não existe — rode a migration 0003 no Supabase." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/peso");
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function excluirMedida(id: string): Promise<ResultadoAcao> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "id inválido" };

  const supabase = await createClient();
  // Exclusão é `excluido_em`, nunca delete (D-007).
  const { error } = await supabase
    .from("medidas")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/peso");
  revalidatePath("/");
  return { ok: true, data: null };
}

/**
 * URL assinada pra ver o exame. Curta de propósito: o bucket é privado, e um
 * link longo circulando é o mesmo que torná-lo público.
 */
export async function urlDoExame(caminho: string): Promise<ResultadoAcao<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("bioimpedancia")
    .createSignedUrl(caminho, 60 * 10);

  if (error || !data) return { ok: false, error: error?.message ?? "não foi possível abrir" };
  return { ok: true, data: data.signedUrl };
}
