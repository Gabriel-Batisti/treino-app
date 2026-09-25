/**
 * "Esta sessão foi acima ou abaixo da sua média?"
 *
 * Função pura, usada pela timeline. Três decisões de critério que importam
 * mais que o código:
 *
 * 1. COMPARA COM O MESMO TIPO DE SESSÃO. Futebol contra futebol, Treino A
 *    contra Treino A. Média de tudo junto compararia 90 min de futebol com
 *    30 min de bike e o número não significaria nada. Quem agrupa é quem
 *    chama — aqui só entra a lista já filtrada.
 *
 * 2. CALORIA É COMPARADA POR MINUTO, não no total. Caloria cresce com a
 *    duração: um futebol de 45 min queima metade de um de 90 e não foi "abaixo
 *    da média", foi mais curto. Dividindo por minuto sobra a INTENSIDADE, que
 *    é o que a pergunta quer saber. FC média já é intensidade e entra direto.
 *
 * 3. SÓ OLHA PRA TRÁS. A média é das sessões ANTERIORES a esta, não de todas —
 *    "média histórica" é o que existia até aquele dia. Como efeito, as
 *    primeiras sessões de cada tipo não mostram nada, o que é honesto.
 */

/** Abaixo disto, "média" é opinião de duas sessões. */
const MIN_AMOSTRA = 3;

/** Dentro disso é ruído do dia — dormiu mal, comeu tarde, fez calor. */
const FAIXA_NEUTRA = 0.05;

export interface AmostraSessao {
  /** Só compara com o que veio antes. */
  dataLocal: string;
  minutos: number | null;
  calorias: number | null;
  fcMedia: number | null;
}

export interface Desvio {
  /** Fração: 0.08 = 8% acima. Negativo = abaixo. */
  pct: number;
  /** Dentro da faixa neutra — nem acima nem abaixo. */
  naMedia: boolean;
}

export interface Comparacao {
  /** Intensidade calórica: kcal por minuto. */
  ritmo: Desvio | null;
  fc: Desvio | null;
}

function desvio(atual: number, anteriores: number[]): Desvio | null {
  if (anteriores.length < MIN_AMOSTRA) return null;
  const media = anteriores.reduce((s, n) => s + n, 0) / anteriores.length;
  if (media <= 0) return null;
  const pct = atual / media - 1;
  return { pct, naMedia: Math.abs(pct) < FAIXA_NEUTRA };
}

/**
 * `historico` deve conter APENAS sessões do mesmo tipo, a atual inclusive ou
 * não — tanto faz, ela é filtrada por data aqui.
 */
export function compararComHistorico(
  atual: AmostraSessao,
  historico: AmostraSessao[],
): Comparacao {
  const antes = historico.filter((h) => h.dataLocal < atual.dataLocal);

  const ritmoDe = (s: AmostraSessao) =>
    s.calorias != null && s.minutos != null && s.minutos > 0 ? s.calorias / s.minutos : null;

  const ritmoAtual = ritmoDe(atual);
  const fcAtual = atual.fcMedia;

  return {
    ritmo:
      ritmoAtual == null
        ? null
        : desvio(ritmoAtual, antes.map(ritmoDe).filter((n): n is number => n != null)),
    fc:
      fcAtual == null
        ? null
        : desvio(
            fcAtual,
            antes.map((s) => s.fcMedia).filter((n): n is number => n != null),
          ),
  };
}

export interface ItemComparacao {
  rotulo: string;
  /** Seta pronta pra renderizar. */
  seta: "↑" | "↓" | "→";
  /** Acima = mais intenso que o normal. */
  direcao: "acima" | "abaixo" | "media";
  /** Inteiro, sempre positivo — o sinal já está na seta. 0 quando na média. */
  pct: number;
}

/**
 * Vira os itens do cartão. Lista vazia = não há o que dizer, e aí a linha
 * inteira some — ela não pode aparecer vazia nem escrever "sem dados".
 *
 * A porcentagem é ARREDONDADA e sem casa decimal de propósito: a média vem de
 * três sessões e o número do relógio varia com sono e calor. "↑ 21%" já é
 * mais precisão do que o dado sustenta; "↑ 21,4%" seria invenção.
 */
export function itensComparacao(c: Comparacao): ItemComparacao[] {
  const itens: ItemComparacao[] = [];

  const push = (rotulo: string, d: Desvio | null) => {
    if (!d) return;
    const pct = Math.round(Math.abs(d.pct) * 100);
    if (d.naMedia) itens.push({ rotulo, seta: "→", direcao: "media", pct: 0 });
    else if (d.pct > 0) itens.push({ rotulo, seta: "↑", direcao: "acima", pct });
    else itens.push({ rotulo, seta: "↓", direcao: "abaixo", pct });
  };

  push("FC médio", c.fc);
  push("Ritmo (kcal)", c.ritmo);

  return itens;
}
