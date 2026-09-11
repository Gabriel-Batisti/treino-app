"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Fotos de acompanhamento (tabela `fotos`, migration 0004).
 *
 * Arquivo "use server" só exporta função async — schemas ficam internos.
 */

const fotoSchema = z.object({
  id: z.uuid(),
  tirada_em: z.iso.datetime({ offset: true }),
  // Do relógio do celular, não de now() no servidor (D-012).
  data_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  angulo: z.enum(["frente", "lado", "costas", "outro"]),
  arquivo_path: z.string().min(1).max(400),
  largura: z.number().int().positive().nullable(),
  altura: z.number().int().positive().nullable(),
  notas: z.string().max(500).nullable(),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function salvarFoto(payload: unknown): Promise<ResultadoAcao> {
  const parsed = fotoSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase.from("fotos").upsert({ ...parsed.data, user_id: auth.user.id });

  if (error) {
    if (error.message.includes("fotos")) {
      return { ok: false, error: "Tabela `fotos` não existe — rode a migration 0004 no Supabase." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/fotos");
  return { ok: true, data: null };
}

/**
 * Exclusão é `excluido_em`, nunca delete (D-007) — e o arquivo no Storage FICA.
 * Apagar o binário tornaria a exclusão irreversível, o que é o contrário do que
 * a regra quer. Limpeza de órfãos, se um dia precisar, é tarefa separada.
 */
export async function excluirFoto(id: string): Promise<ResultadoAcao> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "id inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fotos")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/fotos");
  return { ok: true, data: null };
}

/**
 * URLs assinadas em lote. Uma chamada por foto deixaria a galeria lenta e
 * estouraria o limite de requisições à toa.
 *
 * Uma hora de validade: o bucket é privado, e link longo circulando equivale a
 * torná-lo público. Uma hora cobre a sessão de quem está olhando a galeria.
 */
export async function urlsDasFotos(
  caminhos: string[],
): Promise<ResultadoAcao<Record<string, string>>> {
  if (caminhos.length === 0) return { ok: true, data: {} };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("fotos")
    .createSignedUrls(caminhos, 60 * 60);

  if (error) return { ok: false, error: error.message };

  const mapa: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  }
  return { ok: true, data: mapa };
}
