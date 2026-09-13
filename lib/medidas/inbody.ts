/**
 * Leitura do laudo InBody (MyNutri) em PDF.
 *
 * O laudo tem layout fixo, então dá pra preencher o formulário sozinho em vez
 * de o usuário copiar trinta números de uma folha A4 no celular.
 *
 * COMO O TEXTO SAI DO PDF: as barras de escala viram linhas de números soltos
 * e o VALOR fica sozinho numa linha no meio delas —
 *
 *     Massa Muscular
 *     Esquelética (kg)
 *     70 80 90 100 110 120 130      ← escala
 *     39                            ← o número que interessa
 *     140 150 160 170 %             ← resto da escala
 *
 * Por isso os campos da seção "Músculo-Gordura" são lidos como "primeira linha
 * depois do rótulo que é um número sozinho", e não por regex na mesma linha.
 *
 * A DATA NÃO VEM DE "Data/Hora". Nos dois laudos que eu tenho, o primeiro traz
 * `Data/Hora 10/02/2026` num exame que o próprio histórico do PDF data em
 * `07.06.25` — aquele campo é quando o PDF foi gerado. A última data do
 * "Histórico da Composição Corporal" é o exame atual, e é ela que vale.
 */

/** Faixa de referência que o próprio laudo imprime: "49.5 (38.8~47.4)". */
export interface Faixa {
  min: number;
  max: number;
}

/** Um lado do corpo na análise segmentar, em kg. */
export interface Segmento {
  bracoDireito: number | null;
  bracoEsquerdo: number | null;
  tronco: number | null;
  pernaDireita: number | null;
  pernaEsquerda: number | null;
}

export interface LeituraInbody {
  data_local: string | null;

  // ── os sete que viram coluna na tabela `medidas` ──────────────────────────
  peso_kg: number | null;
  gordura_pct: number | null;
  massa_muscular_kg: number | null;
  massa_magra_kg: number | null;
  agua_pct: number | null;
  gordura_visceral: number | null;
  tmb_kcal: number | null;

  // ── o resto do laudo, que vive em `medidas.dados` (jsonb) ─────────────────
  altura_cm: number | null;
  idade: number | null;
  agua_l: number | null;
  proteina_kg: number | null;
  minerais_kg: number | null;
  massa_gorda_kg: number | null;
  imc: number | null;
  pontuacao: number | null;
  peso_ideal_kg: number | null;
  controle_peso_kg: number | null;
  controle_gordura_kg: number | null;
  controle_muscular_kg: number | null;
  cintura_quadril: number | null;
  grau_obesidade_pct: number | null;

  /**
   * Faixas de referência IMPRESSAS NO LAUDO, não inventadas por mim.
   *
   * O InBody calcula a faixa a partir da altura e do sexo da pessoa —
   * "8,3~16,5 kg de gordura" é a faixa DELE, não uma tabela genérica. Por isso
   * elas vêm do PDF e ficam guardadas junto do exame: laudo antigo mantém a
   * faixa que valia naquele dia.
   */
  faixas: Partial<
    Record<"peso" | "agua" | "proteina" | "minerais" | "gordura" | "visceral", Faixa>
  >;

  /** Análise segmentar. Null quando o laudo não traz. */
  segmentar: { magra: Segmento | null; gordura: Segmento | null };

  /** Quantos campos vieram preenchidos — a UI usa pra dizer se valeu a pena. */
  achados: number;
}

const VAZIO: LeituraInbody = {
  data_local: null,
  peso_kg: null,
  gordura_pct: null,
  massa_muscular_kg: null,
  massa_magra_kg: null,
  agua_pct: null,
  gordura_visceral: null,
  tmb_kcal: null,
  altura_cm: null,
  idade: null,
  agua_l: null,
  proteina_kg: null,
  minerais_kg: null,
  massa_gorda_kg: null,
  imc: null,
  pontuacao: null,
  peso_ideal_kg: null,
  controle_peso_kg: null,
  controle_gordura_kg: null,
  controle_muscular_kg: null,
  cintura_quadril: null,
  grau_obesidade_pct: null,
  faixas: {},
  segmentar: { magra: null, gordura: null },
  achados: 0,
};

const num = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const arred = (n: number | null, casas = 1): number | null =>
  n == null ? null : Math.round(n * 10 ** casas) / 10 ** casas;

/** Primeiro valor "sozinho numa linha" depois do rótulo. Ver cabeçalho. */
function valorAbaixoDe(linhas: string[], rotulo: RegExp, alcance = 6): number | null {
  const i = linhas.findIndex((l) => rotulo.test(l));
  if (i < 0) return null;
  for (let j = i + 1; j < Math.min(i + 1 + alcance, linhas.length); j++) {
    const m = linhas[j].trim().match(/^(\d{1,3}(?:[.,]\d{1,2})?)$/);
    if (m) return num(m[1]);
  }
  return null;
}

/** `02.08.26` → `2026-08-02`. Século fixo em 2000: laudo de bioimpedância. */
function dataDoHistorico(texto: string): string | null {
  const i = texto.indexOf("Histórico da Composição Corporal");
  const trecho = i >= 0 ? texto.slice(i) : texto;
  const todas = [...trecho.matchAll(/\b(\d{2})\.(\d{2})\.(\d{2})\b/g)];
  const ultima = todas.at(-1);
  if (ultima) return `20${ultima[3]}-${ultima[2]}-${ultima[1]}`;

  // Sem histórico (primeiro exame de todos): aceita o Data/Hora.
  const m = texto.match(/Data\/Hora\s*\n?\s*(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "49.5 (38.8~47.4)" → { min: 38.8, max: 47.4 }. */
function faixaDe(texto: string, rotulo: string): Faixa | undefined {
  const re = new RegExp(rotulo + "\\s+[\\d.,]+\\s*\\(([\\d.,]+)\\s*~\\s*([\\d.,]+)\\)", "i");
  const m = texto.match(re);
  const min = num(m?.[1]);
  const max = num(m?.[2]);
  return min != null && max != null ? { min, max } : undefined;
}

/**
 * Um bloco segmentar — cinco valores em kg, na ordem em que o PDF os escreve:
 * braço direito, braço esquerdo, tronco, perna direita, perna esquerda.
 *
 * A janela de 400 caracteres não é estética: sem o corte, a massa magra
 * segmentar engoliria os números da gordura segmentar, que vem logo abaixo.
 */
function segmentoDe(texto: string, titulo: string): Segmento | null {
  const i = texto.indexOf(titulo);
  if (i < 0) return null;
  const trecho = texto.slice(i, i + 400);
  const kgs = [...trecho.matchAll(/([\d.,]+)\s*kg/g)].map((m) => num(m[1]));
  if (kgs.length < 5) return null;
  return {
    bracoDireito: kgs[0],
    bracoEsquerdo: kgs[1],
    tronco: kgs[2],
    pernaDireita: kgs[3],
    pernaEsquerda: kgs[4],
  };
}

/**
 * Extrai o que der do texto do laudo. NUNCA lança: laudo de outro aparelho
 * simplesmente devolve tudo nulo, e o formulário continua manual.
 */
export function lerInbody(texto: string): LeituraInbody {
  if (!texto || !/InBody|Composição Corporal/i.test(texto)) return VAZIO;

  const linhas = texto.split("\n");

  const peso =
    num(texto.match(/A soma acima\s+Peso \(kg\)\s+([\d.,]+)/)?.[1]) ??
    valorAbaixoDe(linhas, /^Peso \(kg\)$/);

  const gorduraKg =
    num(texto.match(/Massa de gordura \(kg\)\s+([\d.,]+)/i)?.[1]) ??
    valorAbaixoDe(linhas, /^Massa de Gordura \(kg\)$/);

  const aguaL = num(texto.match(/Água corporal total \(L\)\s+([\d.,]+)/)?.[1]);

  const r: LeituraInbody = {
    data_local: dataDoHistorico(texto),
    peso_kg: arred(peso),
    gordura_pct: arred(valorAbaixoDe(linhas, /^Percentual de Gordura$/)),
    massa_muscular_kg: arred(valorAbaixoDe(linhas, /^Esquelética \(kg\)$/)),
    // O laudo não imprime massa magra: é o peso menos a gordura.
    massa_magra_kg: peso != null && gorduraKg != null ? arred(peso - gorduraKg) : null,
    // E a água vem em LITROS. A coluna é percentual — 49.5 L em 82 kg = 60.4%.
    agua_pct: aguaL != null && peso ? arred((aguaL / peso) * 100) : null,
    gordura_visceral: num(texto.match(/Nível de Gordura Visceral\s+([\d.,]+)/)?.[1]),
    tmb_kcal: num(texto.match(/Taxa metabólica basal\s+([\d.,]+)\s*kcal/)?.[1]),

    altura_cm: num(texto.match(/Altura\s*\n?\s*([\d.,]+)\s*cm/)?.[1]),
    idade: num(texto.match(/Idade\s*\n?\s*(\d+)\s*anos/)?.[1]),
    agua_l: aguaL,
    proteina_kg: num(texto.match(/Proteína \(kg\)\s+([\d.,]+)/)?.[1]),
    minerais_kg: num(texto.match(/Minerais \(kg\)\s+([\d.,]+)/)?.[1]),
    massa_gorda_kg: arred(gorduraKg),
    imc: arred(valorAbaixoDe(linhas, /^Índice de Massa Corporal$/), 2),
    pontuacao: num(texto.match(/([\d.,]+)\s*\/\s*100 pontos/)?.[1]),
    peso_ideal_kg: num(texto.match(/Peso Ideal\s+([\d.,]+)\s*kg/)?.[1]),
    // Controle vem com sinal: "-2.50kg" quer dizer "perca 2,5".
    controle_peso_kg: num(texto.match(/Controle de Peso\s+(-?[\d.,]+)\s*kg/)?.[1]),
    controle_gordura_kg: num(texto.match(/Controle de Gordura\s+(-?[\d.,]+)\s*kg/)?.[1]),
    controle_muscular_kg: num(texto.match(/Controle Muscular\s+(-?[\d.,]+)\s*kg/)?.[1]),
    cintura_quadril: num(texto.match(/Relação Cintura-Quadril\s+([\d.,]+)/)?.[1]),
    grau_obesidade_pct: num(texto.match(/Grau de Obesidade\s+([\d.,]+)\s*%/)?.[1]),

    faixas: {
      peso: faixaDe(texto, "Peso \\(kg\\)"),
      agua: faixaDe(texto, "Água corporal total \\(L\\)"),
      proteina: faixaDe(texto, "Proteína \\(kg\\)"),
      minerais: faixaDe(texto, "Minerais \\(kg\\)"),
      gordura: faixaDe(texto, "Massa de gordura \\(kg\\)"),
      visceral: faixaDe(texto, "Nível de Gordura Visceral"),
    },

    segmentar: {
      magra: segmentoDe(texto, "Análise da Massa Magra Segmentar"),
      gordura: segmentoDe(texto, "Análise da Gordura Segmentar"),
    },

    achados: 0,
  };

  r.achados = [
    r.peso_kg,
    r.gordura_pct,
    r.massa_muscular_kg,
    r.massa_magra_kg,
    r.agua_pct,
    r.gordura_visceral,
    r.tmb_kcal,
  ].filter((v) => v != null).length;

  return r;
}
