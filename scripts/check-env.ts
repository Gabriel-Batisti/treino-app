/**
 * Confere se o .env.local está preenchido e se as chaves conectam no banco.
 *
 * Roda com: npx tsx scripts/check-env.ts
 *
 * NUNCA imprime valor de chave — só o formato detectado e o tamanho. O output
 * deste script vai parar em log e em transcript de sessão.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const TABELAS = [
  "exercicios",
  "rotinas",
  "rotina_exercicios",
  "sessoes",
  "sessao_exercicios",
  "series",
] as const;

/** Descreve a chave sem revelá-la. */
function descreve(valor: string): string {
  const n = valor.length;
  if (valor.startsWith("sb_publishable_")) return `publishable nova (${n} chars)`;
  if (valor.startsWith("sb_secret_")) return `secret nova (${n} chars)`;
  if (valor.startsWith("eyJ")) return `JWT legada (${n} chars)`;
  return `formato NÃO RECONHECIDO (${n} chars)`;
}

function exigir(nome: string): string {
  const v = process.env[nome]?.trim();
  if (!v) {
    console.error(`✗ ${nome} está vazia no .env.local`);
    process.exit(1);
  }
  if (v.startsWith('"') || v.startsWith("'")) {
    console.error(`✗ ${nome} está entre aspas — tire as aspas, o valor vai cru depois do "="`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = exigir("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anon = exigir("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = exigir("SUPABASE_SERVICE_ROLE_KEY");

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    console.error(`✗ URL com formato estranho: ${url}`);
    console.error("  esperado: https://xxxxxxxx.supabase.co (sem barra no fim, sem /rest/v1)");
    process.exit(1);
  }
  if (anon === service) {
    console.error("✗ as duas chaves são iguais — você colou a mesma nos dois campos");
    process.exit(1);
  }

  console.log(`URL      ${url}`);
  console.log(`anon     ${descreve(anon)}`);
  console.log(`service  ${descreve(service)}`);
  console.log("");

  // Service role atravessa a RLS: se a tabela existe, a contagem responde.
  const db = createClient(url, service, { auth: { persistSession: false } });

  let falhou = false;
  for (const t of TABELAS) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`✗ ${t.padEnd(18)} ${error.message}`);
      falhou = true;
    } else {
      console.log(`✓ ${t.padEnd(18)} ${count} linhas`);
    }
  }

  const { error: erroView } = await db.from("vw_ultimo_desempenho").select("*").limit(1);
  if (erroView) {
    console.log(`✗ vw_ultimo_desempenho  ${erroView.message}`);
    falhou = true;
  } else {
    console.log("✓ vw_ultimo_desempenho");
  }

  // A anon deve ENXERGAR a tabela e não devolver nada (RLS sem usuário logado).
  const anonDb = createClient(url, anon, { auth: { persistSession: false } });
  const { error: erroAnon } = await anonDb.from("exercicios").select("id").limit(1);
  console.log(
    erroAnon
      ? `✗ chave anon: ${erroAnon.message}`
      : "✓ chave anon conecta (RLS bloqueia os dados até ter login — é o esperado)",
  );
  if (erroAnon) falhou = true;

  console.log("");
  console.log(falhou ? "FALHOU — ver acima" : "TUDO OK");
  process.exit(falhou ? 1 : 0);
}

main().catch((e) => {
  console.error("✗ erro inesperado:", e instanceof Error ? e.message : e);
  process.exit(1);
});
