/**
 * Id determinístico a partir de uma chave — mesmo conceito do uuid v5.
 *
 * Serve pra registro que é "um por chave": a pesagem de um dia. Gravar de novo
 * no mesmo dia cai no mesmo id, o upsert corrige a linha existente e não
 * duplica — sem precisar de unique index no banco nem de "modo edição" na UI.
 *
 * Espelha `idDe()` de scripts/importar-heavy.ts e scripts/gerar-rotinas.ts, que
 * usam SHA-1 no Node. Aqui é SHA-256 truncado porque é o que a Web Crypto
 * oferece de forma síncrona-o-bastante no browser; os dois lados nunca geram id
 * pra mesma chave, então não precisam concordar.
 */
export async function idDeterministico(chave: string): Promise<string> {
  const dados = new TextEncoder().encode(`treino-app/v1|${chave}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", dados));
  hash[6] = (hash[6] & 0x0f) | 0x50; // versão 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** A pesagem de um dia tem sempre o mesmo id. */
export function chaveDaPesagem(dataLocal: string): string {
  return `peso|${dataLocal}`;
}
