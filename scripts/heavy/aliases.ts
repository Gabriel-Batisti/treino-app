/**
 * Mapa de junção de nomes do export do Heavy. D-014.
 *
 * O usuário trocou o idioma do app por volta de maio/2026, então o mesmo
 * exercício aparece com dois nomes no histórico. Sem juntar, o "anterior"
 * (D-005) enxerga só as sessões recentes e ignora um ano de carga.
 *
 * Chave = nome antigo (inglês). Valor = nome canônico (português, o que o
 * usuário usa hoje). Cada entrada foi conferida contra carga mediana, treino
 * em que aparece e período — não por tradução.
 *
 * Editar este arquivo e reimportar é seguro: a importação é idempotente por id
 * determinístico. Juntar depois custa uma linha aqui; separar depois dá bem
 * mais trabalho — na dúvida, NÃO junte.
 */
export const ALIASES: Record<string, string> = {
  // ── evidentes (mesmo movimento, mesma carga, sem sobreposição no tempo) ──
  "Chest Fly (Machine)": "Crucifixo (Máquina)",
  "Lat Pulldown (Cable)": "Puxada Alta (Cabo)",
  "Lat Pulldown - Close Grip (Cable)": "Puxada Alta - Pegada Fechada (Cabo)",
  "Lateral Raise (Dumbbell)": "Elevação Lateral (Halter)",
  "Rear Delt Reverse Fly (Machine)": "Crucifixo Invertido (Máquina)",
  "Calf Extension (Machine)": "Extensão de Panturrilha (Máquina)",
  "Leg Extension (Machine)": "Cadeira Extensora (Máquina)",
  "Lying Leg Curl (Machine)": "Mesa Flexora (Máquina)",
  "Seated Leg Curl (Machine)": "Cadeira Flexora (Máquina)",
  "Cable Fly Crossovers": "Crossover na Polia",
  "Single Arm Lateral Raise (Cable)": "Elevação Lateral Unilateral (Cabo)",
  "Single Arm Cable Row": "Remada Unilateral (Cabo)",
  "Squat (Barbell)": "Agachamento (Barra)",
  "Squat (Smith Machine)": "Agachamento (Smith)",
  "Hip Thrust (Barbell)": "Elevação Pélvica (Barra)",
  "Back Extension (Weighted Hyperextension)": "Extensão Lombar (Hiperextensão com Peso)",
  "Incline Chest Press (Machine)": "Supino Inclinado (Máquina)",
  "Incline Bench Press (Smith Machine)": "Supino Inclinado (Máquina Smith)",

  // ── decididos pela carga, confirmados pelo usuário em 10/09/2026 ──

  // Mesma mediana (240 kg) e o "45º" ainda aparece dentro do Treino A.
  "Leg Press (Machine)": "Leg Press 45º (Máquina)",

  // Barra: mediana 30 kg, bate com "Tríceps na Polia" (32,5). A corda
  // (mediana 22,5) é outro movimento e conviveu no mesmo Treino B — fica fora.
  "Triceps Pushdown": "Tríceps na Polia",

  // Máquina: 40-45 kg, bate com "Abdominal (Máquina)" (30-55). O "Decline
  // Crunch" é sem carga nenhuma, banco declinado — fica fora.
  "Crunch (Machine)": "Abdominal (Máquina)",

  // ── traduzidos em 12/09/2026 (scripts/traduzir-nomes.ts) ──────────────
  // Estes NÃO eram alias: eram os próprios nomes canônicos, herdados do
  // período em que o Heavy estava em inglês. Viraram alias quando o
  // catálogo foi traduzido — sem isto, reimportar o CSV recria cada um
  // como exercício novo e parte o histórico em dois.
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

/**
 * Pares que PARECEM iguais e foram deixados separados de propósito. Documentado
 * pra ninguém "consertar" isto depois achando que passou batido.
 */
export const NAO_JUNTAR = [
  "Triceps Rope Pushdown — corda, mediana 22,5 kg; a barra puxa 30. Conviveram no Treino B.",
  "Decline Crunch — 64 séries sem carga, banco declinado. A máquina tem 30-55 kg.",
  "Seated Cable Row - Bar Wide Grip — remada sentada aberta com barra na polia; conviveu com a Remada Baixa Triangulo (outra pegada da mesma polia).",
  "Remada Sentada (Máquina) — 2 séries em 10/09/2026, adaptação de um dia fora do treino.",
  "Bicep Curl (Machine) vs Rosca Direta (Cabo) — carga parecida, mas máquina não é polia.",
  "Bicep Curl (Dumbbell) vs Rosca Inclinada Sentado (Halter) — em pé vs banco inclinado.",
];

/** Aplica o mapa. Nome sem alias volta como está. */
export function canonico(nome: string): string {
  return ALIASES[nome] ?? nome;
}
