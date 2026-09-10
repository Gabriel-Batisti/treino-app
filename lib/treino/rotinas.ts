/**
 * Agrupamento das rotinas.
 *
 * O usuário mantém dois blocos: os treinos de LETRA (Treino A-E, o bloco
 * antigo) e os de NÚMERO (Treino 1-5, o atual). Ele chama o primeiro de
 * "Muscle lab".
 *
 * ⚠️ HEURÍSTICA PELO NOME, não coluna no banco. Foi escolha deliberada pra não
 * exigir mais uma migration manual — e é frágil: renomear "Treino A" pra
 * "Peito e tríceps" joga a rotina no outro grupo. Se isso incomodar, o conserto
 * é uma coluna `grupo` em `rotinas`.
 */

export type GrupoRotina = "muscle_lab" | "minhas";

export const ROTULO_GRUPO: Record<GrupoRotina, string> = {
  muscle_lab: "Muscle lab",
  minhas: "Minhas rotinas",
};

/** Termina em letra → Muscle lab. Qualquer outra coisa → Minhas rotinas. */
export function grupoDaRotina(nome: string | null): GrupoRotina {
  return /[a-zA-Z]$/.test((nome ?? "").trim()) ? "muscle_lab" : "minhas";
}
