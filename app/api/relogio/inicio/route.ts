import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { tokenConfere } from "@/lib/cardio/token";

/**
 * Memória do início do treino no relógio — a metade que o Atalhos não tem.
 *
 * POST  → a automação "ao iniciar exercício" grava a hora de agora.
 * GET   → a automação "ao encerrar" lê essa hora, em TEXTO PURO.
 *
 * O GET responde `text/plain` de propósito: assim o Atalho usa o resultado
 * direto como data no filtro de busca, sem "Obter dicionário" nem "Obter valor
 * do dicionário" no meio. Cada ação a menos é uma a menos pra montar naquela
 * interface — e este atalho já tem oito.
 *
 * SEM INÍCIO GRAVADO ele não devolve erro: devolve 90 minutos atrás. A
 * automação de início pode não ter disparado (iPhone longe, relógio sem rede),
 * e nesse caso um intervalo grande demais dá uma FC média ruim — mas registrar
 * ruim é melhor que não registrar, e a alternativa seria o atalho inteiro
 * falhar no fim do treino.
 */
export const runtime = "nodejs";

const JANELA_PADRAO_MIN = 90;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** App monousuário: o dono é o único usuário. Nunca aceito do corpo. */
async function donoDoApp(cliente: ReturnType<typeof db>) {
  const { data } = await cliente.auth.admin.listUsers();
  return data?.users[0]?.id ?? null;
}

export async function POST(request: NextRequest) {
  if (!tokenConfere(request.headers.get("authorization"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const cliente = db();
  const userId = await donoDoApp(cliente);
  if (!userId) return NextResponse.json({ erro: "nenhum usuário" }, { status: 500 });

  // O corpo pode trazer `em`; sem ele, agora. A automação dispara no instante
  // em que o treino começa, então "agora" é uma boa aproximação — e evita mais
  // uma ação de formatação de data no Atalho.
  let em = new Date();
  try {
    const corpo = (await request.json()) as { em?: string };
    if (corpo?.em) {
      const d = new Date(corpo.em);
      if (!Number.isNaN(d.getTime())) em = d;
    }
  } catch {
    /* sem corpo: agora */
  }

  const { error } = await cliente.from("relogio_inicios").insert({
    user_id: userId,
    inicio_em: em.toISOString(),
  });

  if (error) {
    const falta = error.message.includes("relogio_inicios");
    return NextResponse.json(
      { erro: falta ? "rode a migration 0008 no Supabase" : error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, inicio_em: em.toISOString() });
}

export async function GET(request: NextRequest) {
  if (!tokenConfere(request.headers.get("authorization"))) {
    return new NextResponse("não autorizado", { status: 401 });
  }

  const cliente = db();
  const userId = await donoDoApp(cliente);
  const padrao = new Date(Date.now() - JANELA_PADRAO_MIN * 60_000).toISOString();
  if (!userId) return texto(padrao);

  const { data } = await cliente
    .from("relogio_inicios")
    .select("id, inicio_em")
    .eq("user_id", userId)
    .is("consumido_em", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return texto(padrao);

  // Início de ontem é lixo: a automação de fim não disparou e ficou pendurado.
  const idade = Date.now() - new Date(data.inicio_em).getTime();
  if (idade > 12 * 60 * 60_000) return texto(padrao);

  await cliente
    .from("relogio_inicios")
    .update({ consumido_em: new Date().toISOString() })
    .eq("id", data.id);

  return texto(new Date(data.inicio_em).toISOString());
}

function texto(iso: string) {
  return new NextResponse(iso, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
