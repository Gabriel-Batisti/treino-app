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

/**
 * Ênfase do movimento — inclinado, declinado ou reto.
 *
 * A base só diz "chest" pra supino inclinado e pra supino reto, e eles NÃO são
 * intercambiáveis: a inclinação muda a parte do peitoral que trabalha. A
 * distinção não existe no dado, mas existe no nome, em português e em inglês.
 *
 * Vale também pra costas e ombro por tabela (remada inclinada, banco inclinado
 * na rosca), e nesses casos o efeito é o mesmo: só troca por igual.
 */
export function enfaseDoNome(nome: string): "inclinado" | "declinado" | "reto" | null {
  const n = semAcento(nome);
  if (/inclinad|incline/.test(n)) return "inclinado";
  if (/declinad|decline/.test(n)) return "declinado";
  // Limite de palavra: sem ele "direto" e "concreto" casariam com "reto".
  if (/\breto\b|\bflat\b/.test(n)) return "reto";
  // SUPINO SEM QUALIFICADOR É RETO, por convenção — ninguém escreve "supino
  // reto na barra", escreve "supino". Sem esta linha, "Bench Press (Barbell)"
  // passava como ênfase indefinida e aparecia como substituto do inclinado,
  // que foi exatamente o erro reclamado.
  if (/supino|bench press|chest press/.test(n)) return "reto";
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
  const secundariosAlvo = new Set(alvo.secundarios.map(semAcento));
  const equipAlvo = equipamentoDoNome(alvoNome) ?? alvo.equipamento;
  const enfaseAlvo = enfaseDoNome(alvoNome);
  const naSessao = new Set(jaNaSessao);

  const pontuados = catalogo
    .filter((e) => e.nome_busca !== alvoNomeBusca && !naSessao.has(e.id))
    .map((e) => {
      const ilu = ilustracaoDe(e.nome_busca);
      if (!ilu) return null;

      const mesmosMusculos = ilu.musculos.filter((m) => musculosAlvo.has(semAcento(m)));
      if (mesmosMusculos.length === 0) return null;

      // ÊNFASE DIFERENTE NÃO É SUBSTITUTO. Supino inclinado por supino reto é
      // o mesmo músculo com outra parte trabalhando — foi a primeira coisa que
      // o usuário notou de errado, e está certo.
      const enfase = enfaseDoNome(e.nome);
      if (enfaseAlvo && enfase && enfase !== enfaseAlvo) return null;

      const equip = equipamentoDoNome(e.nome) ?? ilu.equipamento;
      const outroAparelho = !!equip && !!equipAlvo && equip !== equipAlvo;
      const mesmaMecanica = !!alvo.mecanica && ilu.mecanica === alvo.mecanica;
      const mesmaForca = !!alvo.forca && ilu.forca === alvo.forca;
      const mesmaEnfase = !!enfaseAlvo && enfase === enfaseAlvo;
      // Alvo com ênfase e candidato sem (crucifixo pra supino inclinado): serve,
      // mas depois de qualquer um que tenha a mesma inclinação.
      const enfaseIndefinida = !!enfaseAlvo && !enfase;

      // Músculo secundário em comum é sinal de movimento parecido: supino e
      // desenvolvimento dividem tríceps e ombro; supino e crucifixo, não.
      const secundariosEmComum = ilu.secundarios.filter((m) =>
        secundariosAlvo.has(semAcento(m)),
      ).length;

      const nota =
        (outroAparelho ? 100 : 0) +
        (mesmaEnfase ? 80 : 0) +
        (enfaseIndefinida ? -40 : 0) +
        (mesmaMecanica ? 40 : 0) +
        secundariosEmComum * 15 +
        (mesmaForca ? 20 : 0) +
        Math.min(20, e.usos ?? 0);

      const motivo = [
        mesmosMusculos[0],
        mesmaEnfase ? enfase : null,
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
