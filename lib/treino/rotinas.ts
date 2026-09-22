/**
 * Agrupamento das rotinas.
 *
 * VOCABULÁRIO, que é o que estava errado antes: uma linha de `rotinas` é UM
 * TREINO ("Treino A"). O que o usuário chama de rotina é o PROGRAMA que
 * contém os treinos — "Musclelab", com A a E dentro. O app tinha um nível
 * onde ele tem dois.
 *
 * Antes isto era HEURÍSTICA PELO NOME (termina em letra → Muscle lab), com
 * dois grupos fixos no código. Quebrou na primeira vez que entrou um programa
 * novo: "Musclelab 2 — A" também termina em letra, e não havia como um
 * terceiro grupo existir. Agora quem manda é `rotinas.grupo` (migration 0013).
 */

export const SEM_GRUPO = "Treinos soltos";

export interface ParaAgrupar {
  grupo: string | null;
  ordem: number;
}

export interface Grupo<T> {
  nome: string;
  itens: T[];
}

/**
 * Agrupa preservando a ordem da lista: o grupo aparece onde seu primeiro
 * treino aparece. Ordenar por nome jogaria "Musclelab" na frente de
 * "Musclelab 2" — o programa velho acima do que você está fazendo hoje.
 *
 * Treino sem programa vai pro fim, sempre: é resto, não destaque.
 */
export function agruparRotinas<T extends ParaAgrupar>(rotinas: T[]): Grupo<T>[] {
  const mapa = new Map<string, T[]>();
  for (const r of [...rotinas].sort((a, b) => a.ordem - b.ordem)) {
    const chave = r.grupo?.trim() || SEM_GRUPO;
    const atual = mapa.get(chave);
    if (atual) atual.push(r);
    else mapa.set(chave, [r]);
  }

  const grupos = [...mapa].map(([nome, itens]) => ({ nome, itens }));
  return [
    ...grupos.filter((g) => g.nome !== SEM_GRUPO),
    ...grupos.filter((g) => g.nome === SEM_GRUPO),
  ];
}
