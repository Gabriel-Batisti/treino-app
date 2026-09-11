/**
 * Tradução do tipo de treino do Apple Saúde pro enum de `cardios`.
 *
 * O Atalho manda o NOME do tipo como texto, e ele vem no idioma do iPhone —
 * "Corrida ao ar livre" num aparelho em português, "Outdoor Run" em inglês. Por
 * isso o casamento é por palavra-chave nos dois idiomas, sobre o nome
 * normalizado (minúsculo, sem acento), e não por lista de valores exatos: a
 * Apple renomeia e traduz, e uma lista fechada quebraria em silêncio.
 */
import { normalizarNome } from "@/lib/treino/texto";

export type TipoCardio =
  | "esteira"
  | "bicicleta"
  | "eliptico"
  | "escada"
  | "remo"
  | "corrida"
  | "caminhada"
  | "outro";

/** Ordem importa: o primeiro que casar vence. Mais específico primeiro. */
const REGRAS: [RegExp, TipoCardio][] = [
  [/esteira|treadmill/, "esteira"],
  [/eliptic|elliptic/, "eliptico"],
  [/escada|stair|degrau/, "escada"],
  [/\bremo\b|rowing|rower/, "remo"],
  [/bicicleta|cycling|cycle|bike|spinning|indoor cycle/, "bicicleta"],
  // "corrida" tem que vir depois de esteira: "corrida na esteira" é esteira.
  [/corrida|running|\brun\b|trilha|trail/, "corrida"],
  [/caminhada|walking|\bwalk\b|hiking|caminhar/, "caminhada"],
];

/**
 * Musculação NÃO é cardio.
 *
 * Se a automação disparar ao fim de um treino de força — e vai, porque ele
 * também é um "treino" no Apple Saúde — sem isto o app criaria um cardio falso
 * por cima do treino que você acabou de registrar à mão.
 */
const FORCA =
  /musculacao|forca|strength|weight training|weightlifting|core training|functional|pilates|yoga|alongamento|flexibility|cooldown|aquecimento/;

export interface ClassificacaoCardio {
  tipo: TipoCardio | null;
  /** true quando é treino de força — deve ser ignorado, não rejeitado. */
  ehForca: boolean;
}

export function classificarTreinoApple(nomeDoTipo: string): ClassificacaoCardio {
  const n = normalizarNome(nomeDoTipo);
  if (!n) return { tipo: "outro", ehForca: false };
  if (FORCA.test(n)) return { tipo: null, ehForca: true };
  for (const [padrao, tipo] of REGRAS) {
    if (padrao.test(n)) return { tipo, ehForca: false };
  }
  // Cardio que não reconheci (HIIT, dança, natação…) entra como "outro" em vez
  // de ser recusado: perder o registro é pior que classificar de forma genérica.
  return { tipo: "outro", ehForca: false };
}
