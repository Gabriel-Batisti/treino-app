/**
 * Descobre a janela do treino a partir das amostras de frequência cardíaca.
 *
 * A IDEIA: o Apple Watch mede FC a cada poucos segundos DURANTE o exercício e
 * a cada vários minutos em repouso. A densidade das amostras desenha o treino
 * sem que ninguém precise avisar quando ele começou.
 *
 * Isso substitui a automação "ao iniciar": em vez de o relógio avisar o começo
 * e o servidor guardar, o Atalho manda as últimas horas de FC com horário e o
 * servidor acha o aglomerado que termina agora.
 */

/** Intervalo acima disto separa dois aglomerados. Em repouso o relógio mede a
 *  cada 5-10 min; em exercício, a cada poucos segundos. 4 min é folgado o
 *  bastante pra aguentar uma falha de leitura no meio da série. */
const CORTE_MS = 4 * 60_000;

export interface Amostra {
  valor: number;
  em: Date;
}

export interface Janela {
  inicio: Date;
  fim: Date;
  amostras: Amostra[];
}

/**
 * Aceita ISO e o formato do Atalhos em pt-BR ("12/09/2026, 15:00:56").
 *
 * O Atalhos serializa data no formato do aparelho, não em ISO — e num iPhone
 * em português isso é dia/mês/ano, que `new Date()` lê como mês/dia/ano e
 * silenciosamente devolve outro dia. Por isso o caso brasileiro é tratado à
 * mão em vez de confiar no parser.
 */
export function lerData(texto: string): Date | null {
  const t = texto.trim();
  if (!t) return null;

  const br = t.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (br) {
    const [, dia, mes, ano, h = "0", min = "0", seg = "0"] = br;
    // Sem fuso no texto: é hora local do aparelho, que é a de São Paulo.
    const d = new Date(
      `${ano}-${mes}-${dia}T${h.padStart(2, "0")}:${min}:${seg.padStart(2, "0")}-03:00`,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Junta a lista de valores com a lista de datas, na ordem em que vieram.
 *
 * As duas listas saem da MESMA busca no Atalhos, então o índice casa. Se os
 * tamanhos divergirem, corta no menor — meia amostra é melhor que estourar.
 */
export function parear(valores: number[], datas: string[]): Amostra[] {
  const n = Math.min(valores.length, datas.length);
  const pares: Amostra[] = [];
  for (let i = 0; i < n; i++) {
    const em = lerData(datas[i]);
    if (em) pares.push({ valor: valores[i], em });
  }
  return pares.sort((a, b) => a.em.getTime() - b.em.getTime());
}

/**
 * Último aglomerado de amostras — o treino que acabou de terminar.
 *
 * Anda de trás pra frente enquanto o intervalo entre amostras for pequeno.
 * Devolve null se o aglomerado tiver menos de 3 amostras ou durar menos de
 * 2 minutos: aí não é treino, é o relógio medindo em repouso.
 */
export function janelaDoTreino(amostras: Amostra[]): Janela | null {
  if (amostras.length < 3) return null;

  let i = amostras.length - 1;
  while (i > 0 && amostras[i].em.getTime() - amostras[i - 1].em.getTime() <= CORTE_MS) {
    i--;
  }

  const doTreino = amostras.slice(i);
  if (doTreino.length < 3) return null;

  const inicio = doTreino[0].em;
  const fim = doTreino[doTreino.length - 1].em;
  if (fim.getTime() - inicio.getTime() < 2 * 60_000) return null;

  return { inicio, fim, amostras: doTreino };
}
