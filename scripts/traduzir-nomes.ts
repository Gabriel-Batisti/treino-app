/**
 * Traduz pro português os exercícios que ficaram em inglês no histórico.
 *
 *   npx tsx scripts/traduzir-nomes.ts --ver      (mostra o que faria)
 *   npx tsx scripts/traduzir-nomes.ts            (aplica)
 *
 * POR QUE ELES EXISTEM: o usuário usava o Heavy em inglês até maio/2026. A
 * importação (D-014) juntou os pares evidentes, mas o que NÃO tinha par em
 * português ficou com o nome inglês — e agora convive com nomes traduzidos
 * na mesma tela.
 *
 * O QUE ISTO TOCA, e por que cada um:
 *   1. `exercicios.nome` e `nome_busca` — o nome em si. `nome_busca` é
 *      recalculado com a MESMA função do app (D-003), nunca à mão.
 *   2. `sessao_exercicios.nome_snapshot` — o nome congelado em cada treino
 *      passado. Normalmente snapshot não se mexe (é história), mas aqui a
 *      história é "o app estava em inglês", não uma decisão: deixar metade do
 *      histórico em inglês tornaria a timeline ilegível.
 *
 * O QUE ISTO **NÃO** RESOLVE SOZINHO: a chave do mapa de ilustrações é o
 * `nome_busca`. Depois de rodar, é OBRIGATÓRIO atualizar o MAPA de
 * `scripts/baixar-ilustracoes.py` e regerar — senão o exercício renomeado
 * perde a imagem. O script avisa no fim.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { normalizarNome } from "../lib/treino/texto";

config({ path: ".env.local", quiet: true });

/**
 * De → para. Escolhi o nome que SE USA na academia, não a tradução literal:
 * "Skullcrusher" é "tríceps testa", não "quebra-crânio"; "Preacher Curl" é
 * "rosca scott". Aparelho entre parênteses, igual ao resto do catálogo.
 */
const TRADUCOES: Record<string, string> = {
  "Decline Crunch": "Abdominal Declinado",
  "Triceps Rope Pushdown": "Tríceps Corda (Polia)",
  "Incline Bench Press (Dumbbell)": "Supino Inclinado (Halter)",
  "Bicep Curl (Dumbbell)": "Rosca Direta (Halter)",
  "Bicep Curl (Machine)": "Rosca Direta (Máquina)",
  "Front Raise (Dumbbell)": "Elevação Frontal (Halter)",
  "Preacher Curl (Barbell)": "Rosca Scott (Barra)",
  "Skullcrusher (Dumbbell)": "Tríceps Testa (Halter)",
  "Bench Press (Barbell)": "Supino Reto (Barra)",
  "Dumbbell Row": "Remada Unilateral (Halter)",
  "Overhead Press (Dumbbell)": "Desenvolvimento (Halter)",
  "Overhead Press (Barbell)": "Desenvolvimento Militar (Barra)",
  "Deadlift (Barbell)": "Levantamento Terra (Barra)",
  "Seated Cable Row - Bar Wide Grip": "Remada Sentada Pegada Aberta (Cabo)",
  "Meadows Rows (Barbell)": "Remada Meadows (Barra)",
  "Overhead Triceps Extension (Cable)": "Tríceps Francês (Polia)",
  "stiff barra": "Stiff (Barra)",
};

async function main() {
  const apenasVer = process.argv.includes("--ver");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  const { data: exercicios } = await db.from("exercicios").select("id, nome, nome_busca");
  const porNome = new Map((exercicios ?? []).map((e) => [e.nome, e]));

  let renomeados = 0;
  let snapshots = 0;

  for (const [de, para] of Object.entries(TRADUCOES)) {
    const ex = porNome.get(de);
    if (!ex) {
      console.log(`  – ${de} — não está no catálogo, pulando`);
      continue;
    }

    // Colisão: já existe um exercício com o nome de destino. Renomear criaria
    // dois com o mesmo nome_busca e o índice único recusaria — melhor avisar
    // que o certo é FUNDIR os dois, que é outra operação.
    const novoBusca = normalizarNome(para);
    const colide = (exercicios ?? []).find(
      (o) => o.id !== ex.id && o.nome_busca === novoBusca,
    );
    if (colide) {
      console.log(`  ✗ ${de} → ${para} — já existe "${colide.nome}". Fundir, não renomear.`);
      continue;
    }

    console.log(`  ${apenasVer ? "→" : "✓"} ${de} → ${para}`);
    if (apenasVer) continue;

    const { error } = await db
      .from("exercicios")
      .update({ nome: para, nome_busca: novoBusca })
      .eq("id", ex.id);
    if (error) {
      console.log(`      ERRO: ${error.message}`);
      continue;
    }
    renomeados++;

    // O snapshot de cada treino passado. Ver cabeçalho.
    const { count } = await db
      .from("sessao_exercicios")
      .update({ nome_snapshot: para }, { count: "exact" })
      .eq("exercicio_id", ex.id)
      .eq("nome_snapshot", de);
    snapshots += count ?? 0;
  }

  if (apenasVer) return console.log("\n(nada foi alterado — rode sem --ver pra aplicar)");

  console.log(`\n${renomeados} exercícios renomeados · ${snapshots} snapshots atualizados`);
  console.log("\nFALTA, e sem isto eles perdem a imagem:");
  console.log("  1. atualizar o MAPA de scripts/baixar-ilustracoes.py com os nomes novos");
  console.log("  2. PYTHONIOENCODING=utf-8 python scripts/baixar-ilustracoes.py");
}

main();
