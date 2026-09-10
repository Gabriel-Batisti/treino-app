"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Gravação da sessão de treino.
 *
 * A sessão sobe INTEIRA de uma vez, ao finalizar — não uma chamada por série
 * (D-008). Todos os ids vêm do client (D-007), então o upsert é idempotente:
 * se a resposta se perder e o app tentar de novo, não duplica nada.
 *
 * Arquivo "use server" só exporta função async — constante e schema ficam
 * internos. (`export const X = ...` passa no tsc e quebra o build da Vercel.)
 */

const serieSchema = z.object({
  id: z.uuid(),
  indice: z.number().int().min(1),
  tipo: z.enum(["normal", "aquecimento", "drop", "falha", "backoff"]),
  peso_kg: z.number().min(0).nullable(),
  reps: z.number().int().min(0).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  concluida: z.boolean(),
  registrada_em: z.iso.datetime({ offset: true }),
});

const exercicioSchema = z.object({
  id: z.uuid(),
  exercicio_id: z.uuid(),
  ordem: z.number().int().min(0),
  nome_snapshot: z.string().min(1),
  modo_medicao_snapshot: z.enum(["peso_reps", "peso_corporal_reps", "tempo", "distancia"]),
  notas: z.string().nullable(),
  series: z.array(serieSchema),
});

const sessaoSchema = z.object({
  id: z.uuid(),
  nome: z.string().nullable(),
  inicio_em: z.iso.datetime({ offset: true }),
  fim_em: z.iso.datetime({ offset: true }),
  // Vem do RELÓGIO DO CELULAR, não de now() no servidor (D-012).
  data_local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().nullable(),
  exercicios: z.array(exercicioSchema),
});

export type ResultadoAcao<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function salvarSessao(payload: unknown): Promise<ResultadoAcao> {
  const parsed = sessaoSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: `payload inválido: ${parsed.error.issues[0]?.message ?? "?"}` };
  }
  const s = parsed.data;

  // Só sobe série que foi de fato concluída — linha em branco não vira registro.
  const exercicios = s.exercicios
    .map((e) => ({ ...e, series: e.series.filter((x) => x.concluida) }))
    .filter((e) => e.series.length > 0);

  if (exercicios.length === 0) {
    return { ok: false, error: "Nenhuma série concluída — nada pra salvar." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  const { error: e1 } = await supabase.from("sessoes").upsert({
    id: s.id,
    user_id: auth.user.id,
    nome: s.nome,
    inicio_em: s.inicio_em,
    fim_em: s.fim_em,
    data_local: s.data_local,
    status: "concluida",
    origem: "app",
    notas: s.notas,
    sincronizado_em: new Date().toISOString(),
  });
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase.from("sessao_exercicios").upsert(
    exercicios.map((e) => ({
      id: e.id,
      sessao_id: s.id,
      exercicio_id: e.exercicio_id,
      ordem: e.ordem,
      nome_snapshot: e.nome_snapshot,
      modo_medicao_snapshot: e.modo_medicao_snapshot,
      notas: e.notas,
    })),
  );
  if (e2) return { ok: false, error: e2.message };

  const { error: e3 } = await supabase.from("series").upsert(
    exercicios.flatMap((e) =>
      e.series.map((x) => ({
        id: x.id,
        sessao_exercicio_id: e.id,
        indice: x.indice,
        tipo: x.tipo,
        peso_kg: x.peso_kg,
        reps: x.reps,
        rpe: x.rpe,
        concluida: true,
        registrada_em: x.registrada_em,
        // volume_kg e e1rm são GERADAS — nunca enviar (D-003).
      })),
    ),
  );
  if (e3) return { ok: false, error: e3.message };

  // Ranking da busca (D-014): `usos` e `ultimo_uso_em` ordenam o catálogo.
  // Um update por exercício da sessão — são no máximo ~10, não vale RPC.
  // Não é crítico: se falhar, o treino já está salvo e a ordem se ajusta na
  // próxima sessão. Por isso o erro é ignorado de propósito.
  for (const e of exercicios) {
    const { data: atual } = await supabase
      .from("exercicios").select("usos").eq("id", e.exercicio_id).single();
    await supabase
      .from("exercicios")
      .update({
        usos: (atual?.usos ?? 0) + e.series.length,
        ultimo_uso_em: s.inicio_em,
      })
      .eq("id", e.exercicio_id);
  }

  revalidatePath("/");
  revalidatePath("/exercicios");
  return { ok: true, data: null };
}

export async function sair(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
