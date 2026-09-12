"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Inscrição de Web Push (migration 0007).
 *
 * A inscrição nasce no navegador e precisa chegar ao banco, porque quem envia
 * a notificação é o cron no servidor — o aparelho não agenda nada. Não existe
 * API de agendamento local que o iOS suporte: sem servidor, sem lembrete.
 *
 * Arquivo "use server" só exporta função async — schema fica interno.
 */

const inscricaoSchema = z.object({
  endpoint: z.url().max(1000),
  p256dh: z.string().min(1).max(400),
  auth: z.string().min(1).max(400),
  apelido: z.string().max(80).nullable(),
});

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function inscreverPush(payload: unknown): Promise<ResultadoAcao> {
  const parsed = inscricaoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "inscrição inválida" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  // Reinscrever o mesmo aparelho não pode duplicar linha: o endpoint é único, e
  // reinscrição zera o contador de falhas.
  const { error } = await supabase.from("push_inscricoes").upsert(
    { ...parsed.data, user_id: auth.user.id, falhas: 0 },
    { onConflict: "endpoint" },
  );

  if (error) {
    if (error.message.includes("push_inscricoes")) {
      return { ok: false, error: "Tabela `push_inscricoes` não existe — rode a migration 0007." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export async function desinscreverPush(endpoint: string): Promise<ResultadoAcao> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada." };

  // Aqui o delete é o certo: inscrição não é dado histórico, é um endereço que
  // parou de valer. D-007 fala de dado sincronizado — este não é.
  const { error } = await supabase
    .from("push_inscricoes")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Este aparelho está inscrito? Usado pra desenhar o botão no estado certo. */
export async function inscricaoAtiva(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase
    .from("push_inscricoes")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  return !!data;
}
