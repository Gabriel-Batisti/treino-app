/**
 * Normalização de nome de exercício/alimento.
 *
 * IMPLEMENTAÇÃO ÚNICA — não replicar isto no banco. `unaccent()` do Postgres é
 * STABLE, não IMMUTABLE, então não serve pra coluna gerada, e o workaround é um
 * wrapper marcado imutável na marra, que mente. Além disso o client precisa da
 * mesma normalização pra busca offline. Logo: mora aqui, e `nome_busca` é
 * gravado por quem escreve (form, importador, seed). Ver CLAUDE.md.
 */

/**
 * "Puxada Alta - Pegada Fechada (Cabo)" → "puxada alta - pegada fechada (cabo)"
 * "Extensão Lombar" → "extensao lombar"
 * "  Supino   Reto " → "supino reto"
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
