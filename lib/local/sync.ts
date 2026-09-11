/**
 * Sincronização entre o banco local e o servidor. D-007.
 *
 * Ordem obrigatória: EMPURRA antes de PUXAR. Se puxasse primeiro, um treino
 * ainda na fila seria sobrescrito por um "anterior" desatualizado do servidor —
 * e o número que aparece na academia é justamente esse.
 *
 * Regra do D-009: falha aqui bloqueia SINCRONIZAÇÃO, nunca USO. Nada nesta
 * camada pode lançar pra cima.
 */
import { puxarDadosLocais } from "@/app/actions/sync";
import { salvarSessao } from "@/app/actions/treino";
import { salvarCardio } from "@/app/actions/cardio";
import { criarExercicio } from "@/app/actions/exercicios";
import {
  lerFila,
  removerDaFila,
  marcarFalha,
  gravarRotinas,
  gravarExercicios,
  gravarDesempenho,
  gravarMeta,
  lerMeta,
} from "./db";

/** Depois disto, parou de ser rede ruim e passou a ser dado inválido. */
const MAX_TENTATIVAS = 5;

export interface ResultadoSync {
  enviados: number;
  pendentes: number;
  puxou: boolean;
  erro: string | null;
}

async function empurrar(): Promise<{ enviados: number; pendentes: number }> {
  const fila = await lerFila();
  let enviados = 0;

  for (const p of fila) {
    if (p.tentativas >= MAX_TENTATIVAS) continue;
    try {
      const r =
        p.tipo === "sessao"
          ? await salvarSessao(p.payload)
          : p.tipo === "cardio"
            ? await salvarCardio(p.payload)
            : await criarExercicio(p.payload);
      if (r.ok) {
        await removerDaFila(p.id);
        enviados++;
      } else {
        await marcarFalha(p.id, r.error);
      }
    } catch (e) {
      // Sem rede a server action rejeita. Fica na fila pra próxima.
      await marcarFalha(p.id, e instanceof Error ? e.message : "sem rede");
    }
  }

  const restante = await lerFila();
  return { enviados, pendentes: restante.length };
}

async function puxar(): Promise<boolean> {
  try {
    const r = await puxarDadosLocais();
    if (!r.ok) return false;
    await gravarExercicios(r.data.exercicios);
    await gravarRotinas(r.data.rotinas);
    await gravarDesempenho(r.data.desempenho);
    await gravarMeta("ultimo_sync", r.data.geradoEm);
    return true;
  } catch {
    return false;
  }
}

export async function sincronizar(): Promise<ResultadoSync> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const fila = await lerFila();
    return { enviados: 0, pendentes: fila.length, puxou: false, erro: "offline" };
  }

  const { enviados, pendentes } = await empurrar();
  const puxou = await puxar();
  return {
    enviados,
    pendentes,
    puxou,
    erro: puxou ? null : "não foi possível atualizar",
  };
}

export function lerUltimoSync(): Promise<string | null> {
  return lerMeta("ultimo_sync");
}
