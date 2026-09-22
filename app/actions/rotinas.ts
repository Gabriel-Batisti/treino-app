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

const itemSchema = z.object({
  // Id do client: o mesmo padrão do resto (D-007), pra retry não duplicar.
  id: z.uuid(),
  rotinaId: z.uuid(),
  exercicioId: z.uuid(),
  ordem: z.number().int().min(0).max(60),
});

/** Acrescenta um exercício à rotina (ao template, não ao treino do dia). */
export async function adicionarExercicioNaRotina(payload: unknown): Promise<ResultadoAcao> {
  const parsed = itemSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "dados inválidos" };
  const { id, rotinaId, exercicioId, ordem } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("rotina_exercicios").upsert({
    id,
    rotina_id: rotinaId,
    exercicio_id: exercicioId,
    ordem,
    // Sem alvo definido: o usuário ajusta na própria tela de edição. Chutar
    // "3×8-12" aqui seria inventar número que ele nunca escolheu.
    series_alvo: 3,
    descanso_seg: 120,
    excluido_em: null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${rotinaId}`);
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}

/**
 * Muda quantas séries a rotina pede para um exercício.
 *
 * Chamado quando você termina o treino tendo feito um número diferente do que
 * a rotina pedia — tirou uma série ou acrescentou — e confirma que isso vale
 * pras próximas vezes. Sem isso, a correção teria que ser repetida todo treino.
 *
 * Casa por (rotina, exercício) e não por id da linha: quem faz o pedido é a
 * tela de treino, que conhece o exercício, não a linha da rotina.
 */
export async function definirSeriesAlvo(payload: unknown): Promise<ResultadoAcao> {
  const parsed = z
    .object({ rotinaId: z.uuid(), exercicioId: z.uuid(), seriesAlvo: z.number().int().min(1).max(20) })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, error: "dados inválidos" };
  const { rotinaId, exercicioId, seriesAlvo } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotina_exercicios")
    .update({ series_alvo: seriesAlvo })
    .eq("rotina_id", rotinaId)
    .eq("exercicio_id", exercicioId)
    .is("excluido_em", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${rotinaId}`);
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}

/**
 * Tira o exercício da rotina. `excluido_em`, nunca delete (D-007) — e o
 * histórico das sessões que usaram esse exercício não é tocado.
 */
export async function removerExercicioDaRotina(payload: unknown): Promise<ResultadoAcao> {
  const parsed = z.object({ id: z.uuid(), rotinaId: z.uuid() }).safeParse(payload);
  if (!parsed.success) return { ok: false, error: "dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotina_exercicios")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${parsed.data.rotinaId}`);
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}

/** Recebe os ids JÁ na ordem final — mesma abordagem de `reordenarRotinas`. */
export async function reordenarExerciciosDaRotina(payload: unknown): Promise<ResultadoAcao> {
  const parsed = z
    .object({ rotinaId: z.uuid(), ids: z.array(z.uuid()).min(1).max(60) })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, error: "lista inválida" };

  const supabase = await createClient();
  for (const [i, id] of parsed.data.ids.entries()) {
    const { error } = await supabase.from("rotina_exercicios").update({ ordem: i }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/rotinas/${parsed.data.rotinaId}`);
  return { ok: true, data: null };
}

const alvoSchema = z.object({
  id: z.uuid(),
  rotinaId: z.uuid(),
  seriesAlvo: z.number().int().min(1).max(20).nullable(),
  repsAlvoMin: z.number().int().min(1).max(100).nullable(),
  repsAlvoMax: z.number().int().min(1).max(100).nullable(),
});

/** Séries alvo e faixa de reps. O descanso tem ação própria (atualizarDescanso). */
export async function atualizarAlvoDoExercicio(payload: unknown): Promise<ResultadoAcao> {
  const parsed = alvoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "valores inválidos" };
  const { id, rotinaId, seriesAlvo, repsAlvoMin, repsAlvoMax } = parsed.data;

  if (repsAlvoMin != null && repsAlvoMax != null && repsAlvoMax < repsAlvoMin) {
    return { ok: false, error: "A faixa de reps está invertida." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotina_exercicios")
    .update({ series_alvo: seriesAlvo, reps_alvo_min: repsAlvoMin, reps_alvo_max: repsAlvoMax })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${rotinaId}`);
  return { ok: true, data: null };
}

export async function renomearRotina(payload: unknown): Promise<ResultadoAcao> {
  const parsed = z
    .object({ id: z.uuid(), nome: z.string().trim().min(1).max(60) })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, error: "nome inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rotinas")
    .update({ nome: parsed.data.nome })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/rotinas/${parsed.data.id}`);
  revalidatePath("/rotinas");
  return { ok: true, data: null };
}

/**
 * Cria uma rotina vazia e devolve o id, pra tela já abrir a edição dela.
 *
 * DEVOLVE O ID em vez de redirecionar: a tela precisa dele pra navegar DEPOIS
 * de sincronizar. A edição de rotina lê do IndexedDB (D-007), então navegar
 * antes do pull deixaria a tela em "carregando…" pra sempre.
 *
 * O id vem do client pelo mesmo motivo de sempre (D-007): se a resposta se
 * perder e o app tentar de novo, o upsert cai na mesma linha em vez de criar
 * duas rotinas com o mesmo nome.
 */
export async function criarRotina(payload: unknown): Promise<ResultadoAcao<{ id: string }>> {
  const parsed = z
    .object({
      id: z.uuid(),
      nome: z.string().trim().min(1).max(60),
      // O programa é TEXTO LIVRE, não uma escolha entre os que existem: criar
      // treino no programa novo e criar o programa são a mesma ação. Um passo
      // separado de "criar programa" só existiria pra encher uma tabela que a
      // 0013 decidiu não ter.
      grupo: z.string().trim().max(60).nullish(),
    })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, error: "nome inválido" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Faça login de novo." };

  // Entra no fim do PROGRAMA, não no fim da lista: o Treino B tem que nascer
  // colado no Treino A, e não depois dos treinos soltos lá embaixo. `ordem`
  // também desempata a listagem — duas linhas com a mesma ordem apareceriam
  // em ordem arbitrária entre uma abertura e outra.
  const grupo = parsed.data.grupo?.trim() || null;
  const consulta = supabase
    .from("rotinas")
    .select("ordem")
    .eq("user_id", auth.user.id)
    .order("ordem", { ascending: false })
    .limit(1);
  const { data: ultima } = await (grupo
    ? consulta.eq("grupo", grupo)
    : consulta.is("grupo", null)
  ).maybeSingle();

  const { error } = await supabase.from("rotinas").upsert({
    id: parsed.data.id,
    user_id: auth.user.id,
    nome: parsed.data.nome,
    grupo,
    ordem: (ultima?.ordem ?? -1) + 1,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/rotinas");
  return { ok: true, data: { id: parsed.data.id } };
}
