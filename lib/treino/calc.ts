/**
 * Cálculos de treino. Funções puras — usadas pelo client (feedback instantâneo
 * entre séries, offline) e pelo server.
 */

/**
 * 1RM estimado — Brzycki (D-004).
 *
 * ⚠️ ESPELHA a coluna gerada `series.e1rm` da migration 0001. É a única
 * duplicação de fórmula do projeto, e é forçada: o banco precisa dela pra
 * ordenar em SQL, e o client precisa dela pra mostrar o número offline antes
 * de sincronizar. Se mexer aqui, mexa lá — e vice-versa.
 *
 * Valores conferidos contra o banco em 10/09/2026:
 *   100 kg × 1  → 100.00   (Epley daria 103,33 — foi por isso que ela caiu)
 *    80 kg × 8  →  99.31
 *    60 kg × 15 →  null    (acima de 12 reps e1RM é ficção)
 */
export function e1rm(pesoKg: number | null, reps: number | null): number | null {
  if (pesoKg == null || reps == null) return null;
  if (pesoKg <= 0 || reps < 1 || reps > 12) return null;
  return Math.round(((pesoKg * 36) / (37 - reps)) * 100) / 100;
}

/** O export do Heavy traz RPE; quem prefere pensar em RIR converte aqui (D-015). */
export function rirDeRpe(rpe: number | null): number | null {
  return rpe == null ? null : 10 - rpe;
}

export function volume(pesoKg: number | null, reps: number | null): number | null {
  if (pesoKg == null || reps == null) return null;
  return Math.round(pesoKg * reps * 100) / 100;
}

export interface SerieFeita {
  pesoKg: number | null;
  reps: number | null;
}

/**
 * Sugestão de progressão. SUGERE, NÃO APLICA — mesmo princípio do pré-filtro
 * do Descobertos no leilões-app: o veredito é sugestão, a decisão é do usuário.
 *
 * Regra: bateu o topo da faixa de reps em TODAS as séries de trabalho → sobe a
 * carga. Ficou abaixo do piso em todas → sugere descer.
 */
export function sugerirProgressao(
  series: SerieFeita[],
  repsAlvoMin: number,
  repsAlvoMax: number,
  incrementoKg = 2.5,
): { delta: number; motivo: string } | null {
  const validas = series.filter((s) => s.reps != null && s.pesoKg != null);
  if (validas.length === 0) return null;

  if (validas.every((s) => s.reps! >= repsAlvoMax)) {
    return { delta: incrementoKg, motivo: `bateu ${repsAlvoMax} reps em todas` };
  }
  if (validas.every((s) => s.reps! < repsAlvoMin)) {
    return { delta: -incrementoKg, motivo: `ficou abaixo de ${repsAlvoMin} reps em todas` };
  }
  return null;
}
