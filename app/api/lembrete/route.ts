import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";

/**
 * Lembrete diário de pesagem. Chamado pelo cron da Vercel (`vercel.json`).
 *
 * HORÁRIO: a Hobby só aceita cron uma vez por dia e com precisão de HORA
 * (±59 min, documentado pela Vercel). O agendamento é 10:00 UTC = 7h de
 * Brasília, então a notificação chega entre 7h e 8h. Não dá pra prometer
 * "7:00 em ponto" sem plano pago.
 *
 * NÃO INCOMODA À TOA: se já existe pesagem de hoje, não manda nada. Lembrete
 * que chega depois de você já ter feito a coisa é o que faz desligar
 * notificação.
 *
 * `runtime = "nodejs"`: web-push usa crypto do Node, não roda no edge.
 */
export const runtime = "nodejs";

/** Data local (America/Sao_Paulo) de agora — D-012. */
function hojeLocal(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function GET(request: NextRequest) {
  // A Vercel manda `Authorization: Bearer $CRON_SECRET` quando a variável
  // existe. Sem o segredo, qualquer um dispararia notificação no meu celular.
  const segredo = process.env.CRON_SECRET;

  // Recurso ainda não configurado: responde OK e não faz NADA. Sem isto o cron
  // diário marcaria erro vermelho todo dia no painel por um recurso que a
  // pessoa ainda nem ligou — e log com falha crônica é log que ninguém lê.
  // Não é buraco de segurança: sem segredo, nada é enviado.
  if (!segredo) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "lembrete não configurado" });
  }

  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    return NextResponse.json({ erro: "faltam as chaves VAPID" }, { status: 500 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:sem@email", publica, privada);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: inscricoes, error } = await db
    .from("push_inscricoes")
    .select("id, user_id, endpoint, p256dh, auth");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!inscricoes?.length) return NextResponse.json({ ok: true, enviados: 0, motivo: "ninguém inscrito" });

  const hoje = hojeLocal();
  let enviados = 0;
  let pulados = 0;
  const removidos: string[] = [];

  // Agrupa por usuário: a checagem "já pesou hoje" é por pessoa, não por
  // aparelho, e o app é monousuário — na prática é uma consulta só.
  const porUsuario = new Map<string, typeof inscricoes>();
  for (const i of inscricoes) {
    porUsuario.set(i.user_id, [...(porUsuario.get(i.user_id) ?? []), i]);
  }

  for (const [userId, doUsuario] of porUsuario) {
    const { data: jaPesou } = await db
      .from("medidas")
      .select("id")
      .eq("user_id", userId)
      .eq("data_local", hoje)
      .is("excluido_em", null)
      .limit(1)
      .maybeSingle();

    if (jaPesou) {
      pulados += doUsuario.length;
      continue;
    }

    const corpo = JSON.stringify({
      titulo: "Bom dia",
      corpo: "Registra o peso de hoje?",
      url: "/peso",
      tag: "peso-diario",
    });

    for (const i of doUsuario) {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          corpo,
        );
        enviados++;
        await db
          .from("push_inscricoes")
          .update({ ultimo_envio_em: new Date().toISOString(), falhas: 0 })
          .eq("id", i.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = inscrição morta (app desinstalado, permissão revogada).
        // Apagar na hora evita o cron ficar batendo em endpoint fantasma.
        if (status === 404 || status === 410) {
          await db.from("push_inscricoes").delete().eq("id", i.id);
          removidos.push(i.id);
        } else {
          const { data: atual } = await db
            .from("push_inscricoes")
            .select("falhas")
            .eq("id", i.id)
            .maybeSingle();
          await db
            .from("push_inscricoes")
            .update({ falhas: (atual?.falhas ?? 0) + 1 })
            .eq("id", i.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados, pulados, removidos: removidos.length });
}
