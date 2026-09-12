import { timingSafeEqual } from "node:crypto";

/**
 * Confere o token do webhook em tempo constante.
 *
 * Comparar string com `===` vaza o tamanho do prefixo correto pelo tempo de
 * resposta. É paranoia barata: são três linhas.
 */
export function tokenConfere(cabecalho: string | null): boolean {
  const recebido = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  const esperado = process.env.CARDIO_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
