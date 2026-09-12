import type { SupabaseClient } from "@supabase/supabase-js";
import { classificarTreinoApple } from "@/lib/cardio/apple";
import { casarComSessao, type JanelaSessao } from "@/lib/cardio/casar-sessao";

/**
 * O que fazer com um treino vindo do relógio — o miolo compartilhado por
 * `/api/cardio` (envio direto) e `/api/relogio/fim` (montado pelo Atalho).
 *
 * A regra é a mesma nos dois casos e está descrita em D-017: cardio de tipo
 * reconhecido vira cardio e não disputa sessão; o resto tenta casar com a
 * sessão do app pelo horário e, não casando, estaciona como cardio "outro"
 * pra `salvarSessao` absorver depois.
 *
 * Estar aqui e não na rota é o que impede as duas portas de entrada de
 * divergirem — duas implementações da mesma regra é o erro que o CLAUDE.md
 * proíbe pra cálculo, e vale igual pra decisão.
 */

export interface TreinoDoRelogio {
  origem_id: string;
  /** Nome do tipo no idioma do iPhone. Pode ser "Outro" — e tudo bem. */
  tipo: string;
  inicio: Date;
  duracaoMin: number;
  calorias: number | null;
  distancia_km: number | null;
  fc_media: number | null;
  fc_max: number | null;
}

export type ResultadoTreino =
  | { ok: true; anexadoASessao: string; distanciaMin: number | null }
  | { ok: true; cardio: string; aguardandoTreino: boolean; duracaoMin: number }
  | { ok: false; erro: string; status: number };

/** Data local (America/Sao_Paulo) do instante — D-012. */
export function dataLocalDe(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export const arred = (n: number | null | undefined) => (n != null ? Math.round(n) : null);

async function gravarComoCardio(
  db: SupabaseClient,
  userId: string,
  t: TreinoDoRelogio,
  tipo: string,
) {
  // Idempotência sem ON CONFLICT: o índice de `origem_id` é PARCIAL e o
  // Postgres não aceita índice parcial em ON CONFLICT.
  const { data: existente } = await db
    .from("cardios")
    .select("id")
    .eq("user_id", userId)
    .eq("origem_id", t.origem_id)
    .maybeSingle();

  return db.from("cardios").upsert({
    id: existente?.id ?? crypto.randomUUID(),
    user_id: userId,
    tipo,
    fonte: "apple_saude",
    origem_id: t.origem_id,
    inicio_em: t.inicio.toISOString(),
    data_local: dataLocalDe(t.inicio.toISOString()),
    duracao_min: t.duracaoMin,
    calorias: arred(t.calorias),
    distancia_km: t.distancia_km,
    fc_media: arred(t.fc_media),
    fc_max: arred(t.fc_max),
    excluido_em: null,
  });
}

export async function processarTreino(
  db: SupabaseClient,
  userId: string,
  t: TreinoDoRelogio,
): Promise<ResultadoTreino> {
  const classificacao = classificarTreinoApple(t.tipo);
  const podeSerAcademia = classificacao.ehForca || !classificacao.reconhecido;

  if (!podeSerAcademia) {
    const { error } = await gravarComoCardio(db, userId, t, classificacao.tipo ?? "outro");
    if (error) return { ok: false, erro: error.message, status: 500 };
    return {
      ok: true,
      cardio: classificacao.tipo ?? "outro",
      aguardandoTreino: false,
      duracaoMin: t.duracaoMin,
    };
  }

  // Dois dias de janela: treino que vira a meia-noite tem `data_local` de
  // ontem e a sessão do app pode estar em qualquer um dos dois.
  const dia = dataLocalDe(t.inicio.toISOString());
  const ontem = dataLocalDe(new Date(t.inicio.getTime() - 86_400_000).toISOString());
  const { data: sessoesDoDia } = await db
    .from("sessoes")
    .select("id, inicio_em, fim_em, apple_origem_id")
    .eq("user_id", userId)
    .eq("status", "concluida")
    .in("data_local", [dia, ontem]);

  const { sessao, distanciaMin } = casarComSessao(
    (sessoesDoDia ?? []) as JanelaSessao[],
    t.inicio,
    t.duracaoMin,
    t.origem_id,
  );

  if (sessao) {
    const { error } = await db
      .from("sessoes")
      .update({
        fc_media: arred(t.fc_media),
        fc_max: arred(t.fc_max),
        calorias: arred(t.calorias),
        apple_origem_id: t.origem_id,
      })
      .eq("id", sessao.id);

    if (error) {
      const faltaMigration =
        error.message.includes("fc_media") || error.message.includes("apple_origem_id");
      return {
        ok: false,
        erro: faltaMigration ? "rode a migration 0006 no Supabase" : error.message,
        status: 500,
      };
    }

    // Se este treino já tinha virado cardio numa tentativa anterior (o relógio
    // encerrou antes do app), tira o cardio: agora ele pertence à sessão.
    await db
      .from("cardios")
      .update({ excluido_em: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("origem_id", t.origem_id);

    return { ok: true, anexadoASessao: sessao.id, distanciaMin };
  }

  const { error } = await gravarComoCardio(db, userId, t, "outro");
  if (error) return { ok: false, erro: error.message, status: 500 };
  return { ok: true, cardio: "outro", aguardandoTreino: true, duracaoMin: t.duracaoMin };
}
