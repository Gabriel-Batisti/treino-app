import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { classificarTreinoApple } from "@/lib/cardio/apple";

/**
 * Recebe cardio do Apple Saúde, via Atalho do iOS.
 *
 * API route e não Server Action porque quem chama é um cliente externo, sem
 * sessão — é o caso que o CLAUDE.md reserva pra rota de API.
 *
 * SUPERFÍCIE DE ATAQUE, e o que a limita:
 *   - só INSERE cardio. Não lê, não apaga, não toca em mais nada.
 *   - autenticada por token fixo, comparado em tempo constante.
 *   - usa service role porque não há sessão de usuário; por isso o `user_id`
 *     é resolvido aqui e nunca vem do corpo da requisição.
 *   - reenvio é idempotente pelo `origem_id`, então disparo duplo não duplica.
 *
 * `runtime = "nodejs"` é obrigatório: timingSafeEqual é do Node, não existe no
 * runtime de edge.
 */
export const runtime = "nodejs";

const corpoSchema = z.object({
  /** Id do treino no Apple Saúde. É a chave de idempotência. */
  origem_id: z.string().trim().min(1).max(200),
  /** Nome do tipo, no idioma do iPhone: "Corrida ao ar livre", "Outdoor Run". */
  tipo: z.string().trim().max(120),
  /** ISO 8601 com fuso. O Atalho manda a data de início do treino. */
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
  // timingSafeEqual exige mesmo tamanho; comparar o tamanho antes já vaza
  // apenas o comprimento, que não ajuda quem tenta adivinhar.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Data local (America/Sao_Paulo) do instante — D-012. */
function dataLocalDe(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
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

  const { tipo, ehForca } = classificarTreinoApple(c.tipo);
  if (ehForca) {
    // 200, não erro: o Atalho dispara pra QUALQUER treino, e um erro aqui
    // apareceria como falha no iPhone a cada treino de musculação.
    return NextResponse.json({ ok: true, ignorado: "treino de força, não é cardio" });
  }

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

  const { error } = await db.from("cardios").upsert(
    {
      id: crypto.randomUUID(),
      user_id: userId,
      tipo,
      fonte: "apple_saude",
      origem_id: c.origem_id,
      inicio_em: inicio.toISOString(),
      data_local: dataLocalDe(inicio.toISOString()),
      duracao_min: Math.max(1, Math.round(c.duracao_min)),
      calorias: c.calorias != null ? Math.round(c.calorias) : null,
      distancia_km: c.distancia_km ?? null,
      fc_media: c.fc_media != null ? Math.round(c.fc_media) : null,
      fc_max: c.fc_max != null ? Math.round(c.fc_max) : null,
    },
    // Sem isto, disparo duplo criaria duas linhas: o id é novo a cada chamada,
    // e é o `origem_id` que identifica o treino.
    { onConflict: "user_id,origem_id" },
  );

  if (error) {
    if (error.message.includes("origem_id") || error.message.includes("fc_media")) {
      return NextResponse.json(
        { erro: "rode a migration 0005 no Supabase" },
        { status: 500 },
      );
    }
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tipo, duracao_min: Math.round(c.duracao_min) });
}

/** GET só pra você conferir, do navegador, que a rota subiu. Não expõe nada. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/cardio",
    metodo: "POST",
    autenticacao: "cabeçalho Authorization: Bearer <token>",
    campos: [
      "origem_id (obrigatório)",
      "tipo (obrigatório)",
      "inicio_em (obrigatório, ISO 8601)",
      "duracao_min (obrigatório)",
      "calorias, distancia_km, fc_media, fc_max (opcionais)",
    ],
  });
}
