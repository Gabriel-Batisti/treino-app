import { ilustracaoDe } from "@/lib/treino/ilustracoes";

/**
 * Sugestão de substituto pro exercício cuja máquina está ocupada.
 *
 * NÃO PASSA POR IA de propósito. A resposta é determinística — mesmo músculo,
 * outro aparelho, entre os exercícios que VOCÊ já fez — e precisa sair num
 * toque, sem rede, com a academia cheia. Chat resolveria pior e mais devagar.
 *
 * O UNIVERSO É O SEU HISTÓRICO. Sugerir hack squat pra quem não tem hack squat
 * na academia é pior que não sugerir nada; os exercícios que você já registrou
 * são a melhor definição do que existe lá.
 */

export interface CandidatoSubstituto {
  exercicioId: string;
  nome: string;
  nomeBusca: string;
  usos: number;
  /** Por que ele apareceu — a UI mostra, pra você julgar em vez de obedecer. */
  motivo: string;
}

interface ExercicioConhecido {
  id: string;
  nome: string;
  nome_busca: string;
  usos?: number | null;
}

/**
 * Aparelho a partir do NOME, não da base.
 *
 * Os nomes daqui já dizem o aparelho — "(Máquina)", "(Cabo)", "(Halter)" — e
 * dizem melhor que a base: quando a ilustração é aproximada (`aprox`), o
 * equipamento registrado lá é o do exercício parecido, não o seu. "Elevação
 * Lateral Unilateral (Cabo)" aponta pra uma versão com halter na base; quem
 * está certo é o seu nome.
 */
export function equipamentoDoNome(nome: string): string | null {
  const n = nome.toLowerCase();
  if (/\bsmith\b/.test(n)) return "smith";
  if (/m[áa]quina|machine|articulad|iso-?lateral|leg press/.test(n)) return "maquina";
  if (/cabo|polia|crossover|cable|pulley/.test(n)) return "cabo";
  if (/halter|dumbbell|unilateral com peso/.test(n)) return "halter";
  if (/barra|barbell|ez\b/.test(n)) return "barra";
  if (/corda|rope/.test(n)) return "cabo";
  return null;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Ordena candidatos pro exercício `alvo`.
 *
 * Critério, em ordem:
 *   1. mesmo músculo principal — inegociável, é o ponto do substituto
 *   2. aparelho DIFERENTE primeiro (a máquina ocupada é o problema)
 *   3. mesma mecânica (não trocar composto por isolado, nem o contrário)
 *   4. mesma direção de força (empurrar/puxar)
 *   5. o que você mais usa
 *
 * Sem metadado do alvo, devolve lista vazia em vez de chutar por nome.
 */
export function sugerirSubstitutos(
  alvoNomeBusca: string,
  alvoNome: string,
  catalogo: ExercicioConhecido[],
  jaNaSessao: string[] = [],
  limite = 8,
): CandidatoSubstituto[] {
  const alvo = ilustracaoDe(alvoNomeBusca);
  if (!alvo || alvo.musculos.length === 0) return [];

  const musculosAlvo = new Set(alvo.musculos.map(semAcento));
  const equipAlvo = equipamentoDoNome(alvoNome) ?? alvo.equipamento;
  const naSessao = new Set(jaNaSessao);

  const pontuados = catalogo
    .filter((e) => e.nome_busca !== alvoNomeBusca && !naSessao.has(e.id))
    .map((e) => {
      const ilu = ilustracaoDe(e.nome_busca);
      if (!ilu) return null;

      const mesmosMusculos = ilu.musculos.filter((m) => musculosAlvo.has(semAcento(m)));
      if (mesmosMusculos.length === 0) return null;

      const equip = equipamentoDoNome(e.nome) ?? ilu.equipamento;
      const outroAparelho = !!equip && !!equipAlvo && equip !== equipAlvo;
      const mesmaMecanica = !!alvo.mecanica && ilu.mecanica === alvo.mecanica;
      const mesmaForca = !!alvo.forca && ilu.forca === alvo.forca;

      const nota =
        (outroAparelho ? 100 : 0) +
        (mesmaMecanica ? 40 : 0) +
        (mesmaForca ? 20 : 0) +
        Math.min(20, e.usos ?? 0);

      const motivo = [
        mesmosMusculos[0],
        outroAparelho && equip ? equip : null,
        mesmaMecanica && alvo.mecanica === "compound" ? "composto" : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        exercicioId: e.id,
        nome: e.nome,
        nomeBusca: e.nome_busca,
        usos: e.usos ?? 0,
        motivo,
        nota,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.nota - a.nota || b.usos - a.usos);

  return pontuados.slice(0, limite).map(({ nota: _nota, ...resto }) => resto);
}
