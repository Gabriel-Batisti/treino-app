/**
 * Banco local (IndexedDB). É daqui que a tela de treino lê — D-007.
 *
 * ESCOPO ESTREITO DE PROPÓSITO: só o caminho da academia mora aqui (rotinas,
 * último desempenho e a fila de gravação). Timeline, gráficos, perfil e
 * histórico continuam lendo do servidor. Cada store aqui é uma coisa a mais
 * pra manter sincronizada; a régua é "preciso disto sem sinal?".
 *
 * IndexedDB é BUFFER, nunca a única cópia: o Safari pode limpar o storage, e
 * app instalado na tela de início só reduz esse risco, não elimina. O servidor
 * continua sendo a fonte da verdade — ver risco 3 em docs/PLANO.md.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const NOME = "treino-local";
const VERSAO = 2;

export interface RotinaLocal {
  id: string;
  nome: string;
  ordem: number;
  arquivada: boolean;
  ultimaVez: string | null;
  exercicios: {
    /** Id da linha em `rotina_exercicios` — é por ele que a edição atualiza. */
    rotinaExercicioId: string;
    exercicioId: string;
    nome: string;
    nomeBusca: string;
    modoMedicao: string;
    ordem: number;
    seriesAlvo: number | null;
    repsAlvoMin: number | null;
    repsAlvoMax: number | null;
    descansoSeg: number | null;
  }[];
}

/**
 * O catálogo inteiro no aparelho. Entrou na v2: sem ele, o seletor de exercício
 * não abriria sem rede — e trocar um exercício no meio do treino é exatamente
 * uma coisa que se faz na academia, com sinal ruim.
 */
export interface ExercicioLocal {
  id: string;
  nome: string;
  nomeBusca: string;
  grupoMuscular: string | null;
  equipamento: string | null;
  modoMedicao: string;
  usos: number;
  ultimoUsoEm: string | null;
}

export interface DesempenhoLocal {
  exercicioId: string;
  dataLocal: string;
  series: { indice: number; pesoKg: number | null; reps: number | null; e1rm: number | null }[];
}

/** Uma gravação esperando rede. `tentativas` evita ficar batendo em erro fatal. */
export interface PendenciaLocal {
  id: string;
  tipo: "sessao" | "cardio" | "exercicio" | "rotina_exercicio";
  payload: unknown;
  criadoEm: number;
  tentativas: number;
  ultimoErro: string | null;
}

interface Esquema extends DBSchema {
  rotinas: { key: string; value: RotinaLocal };
  exercicios: { key: string; value: ExercicioLocal };
  desempenho: { key: string; value: DesempenhoLocal };
  fila: { key: string; value: PendenciaLocal };
  meta: { key: string; value: { chave: string; valor: string } };
}

let promessa: Promise<IDBPDatabase<Esquema>> | null = null;

function abrir(): Promise<IDBPDatabase<Esquema>> {
  promessa ??= openDB<Esquema>(NOME, VERSAO, {
    // `upgrade` roda pra QUALQUER versão anterior, inclusive instalação nova.
    // Por isso cada store é criada só se ainda não existir, em vez de um
    // switch por versão: mais simples e não quebra quem pula uma versão.
    upgrade(db) {
      if (!db.objectStoreNames.contains("rotinas")) db.createObjectStore("rotinas", { keyPath: "id" });
      if (!db.objectStoreNames.contains("exercicios")) db.createObjectStore("exercicios", { keyPath: "id" });
      if (!db.objectStoreNames.contains("desempenho")) db.createObjectStore("desempenho", { keyPath: "exercicioId" });
      if (!db.objectStoreNames.contains("fila")) db.createObjectStore("fila", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "chave" });
    },
  });
  return promessa;
}

/**
 * Toda leitura passa por aqui. IndexedDB lança em aba privada e em navegador
 * com storage bloqueado — e nada disso pode derrubar a tela de treino.
 */
async function seguro<T>(fn: (db: IDBPDatabase<Esquema>) => Promise<T>, padrao: T): Promise<T> {
  try {
    return await fn(await abrir());
  } catch {
    return padrao;
  }
}

// ── rotinas ──────────────────────────────────────────────────────────────────

export function lerRotinas(): Promise<RotinaLocal[]> {
  return seguro(async (db) => (await db.getAll("rotinas")).sort((a, b) => a.ordem - b.ordem), []);
}

export function lerRotina(id: string): Promise<RotinaLocal | null> {
  return seguro(async (db) => (await db.get("rotinas", id)) ?? null, null);
}

export function gravarRotinas(rotinas: RotinaLocal[]): Promise<void> {
  return seguro(async (db) => {
    const tx = db.transaction("rotinas", "readwrite");
    await tx.store.clear();
    await Promise.all(rotinas.map((r) => tx.store.put(r)));
    await tx.done;
  }, undefined);
}

// ── catálogo de exercícios ───────────────────────────────────────────────────

/**
 * Ordem do D-014: o mais recente primeiro, depois o mais usado. É o histórico
 * importado que faz a busca acertar já no primeiro toque.
 */
export function lerExercicios(): Promise<ExercicioLocal[]> {
  return seguro(
    async (db) =>
      (await db.getAll("exercicios")).sort((a, b) => {
        const ua = a.ultimoUsoEm ?? "";
        const ub = b.ultimoUsoEm ?? "";
        if (ua !== ub) return ub.localeCompare(ua);
        return b.usos - a.usos;
      }),
    [],
  );
}

export function gravarExercicios(itens: ExercicioLocal[]): Promise<void> {
  return seguro(async (db) => {
    const tx = db.transaction("exercicios", "readwrite");
    await tx.store.clear();
    await Promise.all(itens.map((e) => tx.store.put(e)));
    await tx.done;
  }, undefined);
}

/** Exercício criado offline entra no catálogo local na hora, antes de subir. */
export function gravarExercicio(item: ExercicioLocal): Promise<void> {
  return seguro(async (db) => {
    await db.put("exercicios", item);
  }, undefined);
}

// ── último desempenho (o "anterior", D-005) ──────────────────────────────────

export function lerDesempenho(exercicioIds: string[]): Promise<Map<string, DesempenhoLocal>> {
  return seguro(async (db) => {
    const m = new Map<string, DesempenhoLocal>();
    for (const id of exercicioIds) {
      const d = await db.get("desempenho", id);
      if (d) m.set(id, d);
    }
    return m;
  }, new Map());
}

export function gravarDesempenho(itens: DesempenhoLocal[]): Promise<void> {
  return seguro(async (db) => {
    const tx = db.transaction("desempenho", "readwrite");
    await Promise.all(itens.map((d) => tx.store.put(d)));
    await tx.done;
  }, undefined);
}

// ── fila de gravação ─────────────────────────────────────────────────────────

export function enfileirar(p: Omit<PendenciaLocal, "criadoEm" | "tentativas" | "ultimoErro">): Promise<void> {
  return seguro(async (db) => {
    await db.put("fila", { ...p, criadoEm: Date.now(), tentativas: 0, ultimoErro: null });
  }, undefined);
}

export function lerFila(): Promise<PendenciaLocal[]> {
  return seguro(async (db) => (await db.getAll("fila")).sort((a, b) => a.criadoEm - b.criadoEm), []);
}

export function removerDaFila(id: string): Promise<void> {
  return seguro(async (db) => {
    await db.delete("fila", id);
  }, undefined);
}

export function marcarFalha(id: string, erro: string): Promise<void> {
  return seguro(async (db) => {
    const p = await db.get("fila", id);
    if (!p) return;
    await db.put("fila", { ...p, tentativas: p.tentativas + 1, ultimoErro: erro });
  }, undefined);
}

// ── meta ─────────────────────────────────────────────────────────────────────

export function lerMeta(chave: string): Promise<string | null> {
  return seguro(async (db) => (await db.get("meta", chave))?.valor ?? null, null);
}

export function gravarMeta(chave: string, valor: string): Promise<void> {
  return seguro(async (db) => {
    await db.put("meta", { chave, valor });
  }, undefined);
}

// ── rascunho do treino em andamento ──────────────────────────────────────────

/**
 * O treino em andamento vive em estado do React. Um toque errado no botão
 * voltar, ou o iOS descartando a aba em segundo plano, apagava tudo — e treino
 * perdido é o dado irreversível que o D-007 existe pra proteger.
 *
 * Guardado no store `meta` como JSON, e não em store própria: é uma linha só,
 * substituída inteira a cada alteração. Store nova custaria mais uma versão de
 * schema sem ganho nenhum.
 */
const CHAVE_RASCUNHO = "rascunho_sessao";

export function salvarRascunho(dados: unknown): Promise<void> {
  return gravarMeta(CHAVE_RASCUNHO, JSON.stringify(dados));
}

export async function lerRascunho<T>(): Promise<T | null> {
  const cru = await lerMeta(CHAVE_RASCUNHO);
  if (!cru) return null;
  try {
    return JSON.parse(cru) as T;
  } catch {
    // Rascunho corrompido não pode impedir de treinar.
    return null;
  }
}

export function limparRascunho(): Promise<void> {
  return gravarMeta(CHAVE_RASCUNHO, "");
}
