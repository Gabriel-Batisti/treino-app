/**
 * Leitura do laudo InBody (MyNutri) em PDF.
 *
 * O laudo tem layout fixo, então dá pra preencher o formulário sozinho em vez
 * de o usuário copiar sete números de uma folha A4 no celular.
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

export interface LeituraInbody {
  data_local: string | null;
  peso_kg: number | null;
  gordura_pct: number | null;
  massa_muscular_kg: number | null;
  massa_magra_kg: number | null;
  agua_pct: number | null;
  gordura_visceral: number | null;
  tmb_kcal: number | null;
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
