import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { tokenConfere } from "@/lib/cardio/token";

/**
 * Eco de diagnóstico: guarda o que o Atalho mandou, pra eu ler depois.
 *
 * POR QUE EXISTE: alerta do Atalhos não aparece com o iPhone bloqueado, então
 * não dá pra saber se a automação disparou nem o que veio na "Entrada do
 * Atalho" de uma automação de exercício. Uma chamada de rede deixa rastro que
 * sobrevive à tela apagada.
 *
 * ONDE GUARDA, e por que não é gambiarra permanente: grava em `cardios` com
 * `excluido_em` JÁ PREENCHIDO. A linha nasce invisível pro app — toda leitura
 * de cardio filtra `excluido_em is null` — e some junto quando eu apagar. É
 * isso ou uma migration só pra depurar.
 *
 * TEMPORÁRIO. Apagar esta rota quando o Atalho estiver funcionando.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!tokenConfere(request.headers.get("authorization"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const cru = (await request.text()).slice(0, 2000);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: usuarios } = await db.auth.admin.listUsers();
  const userId = usuarios?.users[0]?.id;
  if (!userId) return NextResponse.json({ erro: "nenhum usuário" }, { status: 500 });

  const agora = new Date();
  const { error } = await db.from("cardios").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    tipo: "outro",
    fonte: "apple_saude",
    origem_id: `eco-${agora.getTime()}`,
    inicio_em: agora.toISOString(),
    data_local: agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    duracao_min: 1,
    notas: cru || "(corpo vazio)",
    excluido_em: agora.toISOString(),
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recebido: cru.length });
}
