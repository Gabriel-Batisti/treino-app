/**
 * Os pontos do corpo que se mede com a fita.
 *
 * A LISTA MORA AQUI, NÃO NO BANCO. As medidas vão num `jsonb` (migration
 * 0011), então acrescentar "pescoço" ou tirar "antebraço" é uma linha neste
 * arquivo — não uma migration e um deploy. Com quatorze colunas seria o
 * contrário, e a lista de quem mede o quê muda mais que o esquema.
 *
 * `lado` existe pra UI agrupar direito e esquerdo na mesma linha.
 */

export interface Site {
  chave: string;
  rotulo: string;
  lado?: "D" | "E";
  /** Pares aparecem lado a lado; os demais ocupam a linha inteira. */
  par?: string;
}

export const SITES: Site[] = [
  { chave: "pescoco", rotulo: "Pescoço" },
  { chave: "ombro", rotulo: "Ombro" },
  { chave: "peito", rotulo: "Peito" },
  { chave: "cintura", rotulo: "Cintura" },
  { chave: "abdomen", rotulo: "Abdômen" },
  { chave: "quadril", rotulo: "Quadril" },
  { chave: "braco_d", rotulo: "Braço", lado: "D", par: "braco" },
  { chave: "braco_e", rotulo: "Braço", lado: "E", par: "braco" },
  { chave: "antebraco_d", rotulo: "Antebraço", lado: "D", par: "antebraco" },
  { chave: "antebraco_e", rotulo: "Antebraço", lado: "E", par: "antebraco" },
  { chave: "coxa_d", rotulo: "Coxa", lado: "D", par: "coxa" },
  { chave: "coxa_e", rotulo: "Coxa", lado: "E", par: "coxa" },
  { chave: "panturrilha_d", rotulo: "Panturrilha", lado: "D", par: "panturrilha" },
  { chave: "panturrilha_e", rotulo: "Panturrilha", lado: "E", par: "panturrilha" },
];

export const SITE_POR_CHAVE = new Map(SITES.map((s) => [s.chave, s]));

/** Nome cheio pra título e legenda: "Braço direito". */
export function nomeDoSite(chave: string): string {
  const s = SITE_POR_CHAVE.get(chave);
  if (!s) return chave;
  return s.lado ? `${s.rotulo} ${s.lado === "D" ? "direito" : "esquerdo"}` : s.rotulo;
}
