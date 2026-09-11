import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { classificarTreinoApple } from "@/lib/cardio/apple";
import { casarComSessao, type JanelaSessao } from "@/lib/cardio/casar-sessao";

/**
 * Recebe um treino do Apple Saúde, via Atalho do iOS.
 *
 * O QUE ELE FAZ COM O TREINO, nesta ordem:
 *   1. tenta CASAR com uma sessão de musculação do app pelo horário. Casou →
 *      anexa batimentos e calorias nela e não cria cardio nenhum.
 *   2. não casou → grava como cardio.
 *
 * O casamento vem primeiro, e não o filtro por tipo, porque o usuário registra
 * musculação como "Outro" no relógio. Decidir pelo nome do tipo criaria um
 * cardio falso por cima de cada treino de academia.
 *
 * O cardio gravado no passo 2 também serve de ESTACIONAMENTO: se o relógio for
 * encerrado antes de você tocar em Concluir no app, a sessão ainda não existe.
 * Quando ela for salva, `salvarSessao` procura um cardio do Apple sobrepondo e
 * absorve os números.
 *
 * API route e não Server Action porque quem chama é cliente externo, sem sessão.
 *
 * SUPERFÍCIE DE ATAQUE, e o que a limita:
 *   - só escreve cardio e métricas de sessão. Não lê histórico, não apaga nada.
 *   - token fixo comparado em tempo constante.
 *   - `user_id` resolvido no servidor, NUNCA aceito do corpo.
 *   - reenvio é idempotente pelo `origem_id`.
 *
 * `runtime = "nodejs"` é obrigatório: timingSafeEqual não existe no edge.
 */
export const runtime = "nodejs";

const corpoSchema = z.object({
  /** Id do treino no Apple Saúde. Chave de idempotência. */
  origem_id: z.string().trim().min(1).max(200),
  /** Nome do tipo, no idioma do iPhone. Pode ser "Outro" — e tudo bem. */
  tipo: z.string().trim().max(120),
  inicio_em: z.string().trim().min(10),
  duracao_min: z.coerce.number().min(1).max(600),
  calorias: z.coerce.number().min(0).max(5000).nullish(),
  distancia_km: z.coerce.number().min(0).max(500).nullish(),
  fc_media: z.coerce.number().min(20).max(260).nullish(),
  fc_max: z.coerce.number().min(20).max(260).nullish(),
});

function tokenConfere(recebido: string | null): boolean {
  const esperado = process.env.CARDIO_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Data local (America/Sao_Paulo) do instante — D-012. */
function dataLocalDe(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

const arred = (n: number | null | undefined) => (n != null ? Math.round(n) : null);

async function gravarComoCardio(
  db: SupabaseClient,
  userId: string,
  c: z.infer<typeof corpoSchema>,
  inicio: Date,
  tipo: string,
) {
  // Idempotência sem ON CONFLICT: o índice de `origem_id` é PARCIAL e o
  // Postgres não aceita índice parcial em ON CONFLICT.
  const { data: existente } = await db
    .from("cardios")
    .select("id")
    .eq("user_id", userId)
    .eq("origem_id", c.origem_id)
    .maybeSingle();

  return db.from("cardios").upsert({
    id: existente?.id ?? crypto.randomUUID(),
    user_id: userId,
    tipo,
    fonte: "apple_saude",
    origem_id: c.origem_id,
    inicio_em: inicio.toISOString(),
    data_local: dataLocalDe(inicio.toISOString()),
    duracao_min: Math.max(1, Math.round(c.duracao_min)),
    calorias: arred(c.calorias),
    distancia_km: c.distancia_km ?? null,
    fc_media: arred(c.fc_media),
    fc_max: arred(c.fc_max),
    excluido_em: null,
  });
}

export async function POST(request: NextRequest) {
  const cabecalho = request.headers.get("authorization");
  const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  if (!tokenConfere(token)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo não é JSON" }, { status: 400 });
  }

  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "dados inválidos", detalhe: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const c = parsed.data;

  const inicio = new Date(c.inicio_em);
  if (Number.isNaN(inicio.getTime())) {
    return NextResponse.json({ erro: "inicio_em inválido" }, { status: 400 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // App monousuário: o dono é o único usuário. Resolver aqui, e nunca aceitar
  // user_id do corpo, é o que impede a rota de escrever pra outra conta.
  const { data: usuarios, error: erroUsuarios } = await db.auth.admin.listUsers();
  const userId = usuarios?.users[0]?.id;
  if (erroUsuarios || !userId) {
    return NextResponse.json({ erro: "nenhum usuário cadastrado" }, { status: 500 });
  }

  // ── 1. tenta casar com uma sessão de musculação ────────────────────────────
  const dia = dataLocalDe(inicio.toISOString());
  const { data: sessoesDoDia } = await db
    .from("sessoes")
    .select("id, inicio_em, fim_em, apple_origem_id")
    .eq("user_id", userId)
    .eq("status", "concluida")
    .in("data_local", [dia, dataLocalDe(new Date(inicio.getTime() - 86_400_000).toISOString())]);

  const { sessao, distanciaMin } = casarComSessao(
    (sessoesDoDia ?? []) as JanelaSessao[],
    inicio,
    c.duracao_min,
    c.origem_id,
  );

  if (sessao) {
    const { error } = await db
      .from("sessoes")
      .update({
        fc_media: arred(c.fc_media),
        fc_max: arred(c.fc_max),
        calorias: arred(c.calorias),
        apple_origem_id: c.origem_id,
      })
      .eq("id", sessao.id);

    if (error) {
      if (error.message.includes("fc_media") || error.message.includes("apple_origem_id")) {
        return NextResponse.json({ erro: "rode a migration 0006 no Supabase" }, { status: 500 });
      }
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    // Se este treino já tinha virado cardio numa tentativa anterior (o relógio
    // encerrou antes do app), tira o cardio: agora ele pertence à sessão.
    await db
      .from("cardios")
      .update({ excluido_em: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("origem_id", c.origem_id);

    return NextResponse.json({
      ok: true,
      anexado_ao_treino: sessao.id,
      distancia_min: distanciaMin,
    });
  }

  // ── 2. não casou: grava como cardio ────────────────────────────────────────
  // Serve pro cardio de verdade E como estacionamento pro treino de força cuja
  // sessão ainda não foi salva — `salvarSessao` absorve depois.
  const { tipo } = classificarTreinoApple(c.tipo);
  const { error } = await gravarComoCardio(db, userId, c, inicio, tipo ?? "outro");

  if (error) {
    if (error.message.includes("origem_id") || error.message.includes("fc_media")) {
      return NextResponse.json({ erro: "rode a migration 0005 no Supabase" }, { status: 500 });
    }
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tipo: tipo ?? "outro", duracao_min: Math.round(c.duracao_min) });
}

/** GET só pra conferir, do navegador, que a rota subiu. Não expõe nada. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/cardio",
    metodo: "POST",
    autenticacao: "cabeçalho Authorization: Bearer <token>",
    comportamento:
      "casa com treino do app pelo horário e anexa FC/calorias nele; se não casar, grava como cardio",
    campos: [
      "origem_id (obrigatório)",
      "tipo (obrigatório)",
      "inicio_em (obrigatório, ISO 8601)",
      "duracao_min (obrigatório)",
      "calorias, distancia_km, fc_media, fc_max (opcionais)",
    ],
  });
}
