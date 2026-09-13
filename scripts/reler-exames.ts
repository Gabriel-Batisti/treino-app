/**
 * Relê os PDFs de bioimpedância já guardados e preenche `medidas.dados`.
 *
 *   npx tsx scripts/reler-exames.ts          (só o que ainda não tem)
 *   npx tsx scripts/reler-exames.ts --todos  (relê tudo)
 *
 * Precisa da migration 0010. Existe porque o parser cresceu depois que os
 * exames já estavam no banco: os arquivos continuam lá, então dá pra extrair o
 * laudo completo sem pedir nada ao usuário.
 *
 * NÃO SOBRESCREVE os sete campos que viraram coluna. Se ele corrigiu um número
 * à mão, a correção fica — o PDF preenche só o que está vazio, igual ao
 * formulário.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";
import { lerInbody } from "../lib/medidas/inbody";

config({ path: ".env.local", quiet: true });

async function main() {
  const todos = process.argv.includes("--todos");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  const { data: medidas, error } = await db
    .from("medidas")
    .select(
      "id, data_local, arquivo_path, dados, gordura_pct, massa_muscular_kg, massa_magra_kg, agua_pct, gordura_visceral, tmb_kcal",
    )
    .eq("origem", "bioimpedancia")
    .is("excluido_em", null)
    .order("data_local");

  if (error) {
    console.error(
      error.message.includes("dados")
        ? "✗ coluna `dados` não existe — rode a migration 0010 primeiro"
        : `✗ ${error.message}`,
    );
    process.exit(1);
  }

  for (const m of medidas ?? []) {
    if (!m.arquivo_path) {
      console.log(`  – ${m.data_local}: sem arquivo`);
      continue;
    }
    if (m.dados && !todos) {
      console.log(`  – ${m.data_local}: já tem laudo lido`);
      continue;
    }

    const { data: blob } = await db.storage.from("bioimpedancia").download(m.arquivo_path);
    if (!blob) {
      console.log(`  ✗ ${m.data_local}: não consegui baixar o arquivo`);
      continue;
    }

    const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const l = lerInbody(text);

    if (l.achados === 0) {
      console.log(`  ✗ ${m.data_local}: não parece um laudo InBody`);
      continue;
    }

    // Só preenche coluna vazia — número corrigido à mão manda.
    const patch: Record<string, unknown> = { dados: l };
    const por = (coluna: keyof typeof m, valor: number | null) => {
      if (valor != null && m[coluna] == null) patch[coluna] = valor;
    };
    por("gordura_pct", l.gordura_pct);
    por("massa_muscular_kg", l.massa_muscular_kg);
    por("massa_magra_kg", l.massa_magra_kg);
    por("agua_pct", l.agua_pct);
    por("gordura_visceral", l.gordura_visceral);
    por("tmb_kcal", l.tmb_kcal);

    const { error: e } = await db.from("medidas").update(patch).eq("id", m.id);
    console.log(
      e
        ? `  ✗ ${m.data_local}: ${e.message}`
        : `  ✓ ${m.data_local}: laudo completo (${l.achados}/7 principais, segmentar ${
            l.segmentar.magra ? "sim" : "não"
          })`,
    );
  }
}

main();
