import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { tokenConfere } from "@/lib/cardio/token";
import { processarTreino } from "@/lib/cardio/processar";

/**
 * Recebe um treino do Apple Saúde, via Atalho do iOS.
 *
 * O QUE ELE FAZ COM O TREINO, nesta ordem:
 *   1. tipo reconhecido como cardio ("Bicicleta", "Esteira") → grava cardio e
 *      pronto. Não disputa sessão.
 *   2. senão, tenta CASAR com uma sessão do app pelo horário. Casou → anexa
 *      batimentos e calorias nela e não cria cardio nenhum.
 *   3. não casou → estaciona como cardio "outro", que `salvarSessao` absorve
 *      quando a sessão aparecer.
 *
 * O nome do tipo só decide no passo 1, e só pra CONFIRMAR cardio — nunca pra
 * recusar. É o suficiente pra impedir que a bike do aquecimento seja anexada à
 * musculação que veio logo depois, sem voltar a depender do tipo pra reconhecer
 * academia (que é o que quebrava quando o relógio registrava tudo como "Outro").
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
  /**
   * Duração em MINUTOS — mas o Atalhos do iOS costuma entregar a duração do
   * treino em segundos, e quem monta a automação não tem como saber qual dos
   * dois saiu. Por isso o teto é alto e o valor é interpretado abaixo:
   * acima de 600 só pode ser segundo, porque ninguém treina 10 horas.
   */
  duracao_min: z.coerce.number().min(1).max(86_400).optional(),
  /** Alternativa explícita, pra quem preferir mandar sem ambiguidade. */
  duracao_seg: z.coerce.number().min(1).max(86_400).optional(),
  calorias: z.coerce.number().min(0).max(5000).nullish(),
  distancia_km: z.coerce.number().min(0).max(500).nullish(),
  fc_media: z.coerce.number().min(20).max(260).nullish(),
  fc_max: z.coerce.number().min(20).max(260).nullish(),
});

export async function POST(request: NextRequest) {
  if (!tokenConfere(request.headers.get("authorization"))) {
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

  const duracaoMin = (() => {
    if (c.duracao_seg != null) return Math.max(1, Math.round(c.duracao_seg / 60));
    if (c.duracao_min == null) return null;
    return c.duracao_min > 600
      ? Math.max(1, Math.round(c.duracao_min / 60))
      : Math.max(1, Math.round(c.duracao_min));
  })();

  if (duracaoMin == null) {
    return NextResponse.json({ erro: "faltou duracao_min ou duracao_seg" }, { status: 400 });
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

  const resultado = await processarTreino(db, userId, {
    origem_id: c.origem_id,
    tipo: c.tipo,
    inicio,
    duracaoMin,
    calorias: c.calorias ?? null,
    distancia_km: c.distancia_km ?? null,
    fc_media: c.fc_media ?? null,
    fc_max: c.fc_max ?? null,
  });

  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: resultado.status });
  }
  return NextResponse.json(resultado);
}

/** GET só pra conferir, do navegador, que a rota subiu. Não expõe nada. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/cardio",
    metodo: "POST",
    autenticacao: "cabeçalho Authorization: Bearer <token>",
    comportamento:
      "tipo reconhecido como cardio vira cardio; o resto casa com o treino do app pelo horário e anexa FC/calorias nele",
    campos: [
      "origem_id (obrigatório)",
      "tipo (obrigatório)",
      "inicio_em (obrigatório, ISO 8601)",
      "duracao_min OU duracao_seg (um dos dois)",
      "calorias, distancia_km, fc_media, fc_max (opcionais)",
    ],
  });
}
