"use client";

import { useState, useEffect, useMemo } from "react";
import { lerExercicios, gravarExercicio, enfileirar, type ExercicioLocal } from "@/lib/local/db";
import { sincronizar } from "@/lib/local/sync";
import { normalizarNome } from "@/lib/treino/texto";
import { Ilustracao } from "@/components/ilustracao";

/**
 * Escolher um exercício do catálogo — ou criar um na hora.
 *
 * LÊ DO INDEXEDDB (D-007). Trocar exercício porque a máquina está ocupada é
 * exatamente uma coisa que se faz na academia, e uma busca que depende de rede
 * não serviria pra isso.
 *
 * A ordem já vem do banco local (mais recente, depois mais usado — D-014), e o
 * filtro preserva essa ordem em vez de reordenar por relevância: com 48 itens,
 * "o que eu fiz semana passada" acerta mais que qualquer pontuação de texto.
 *
 * Criar offline grava no catálogo local NA HORA e enfileira o envio: o
 * exercício já pode ser usado no treino que está acontecendo.
 */

const GRUPOS = ["peito", "costas", "pernas", "ombros", "bíceps", "tríceps", "abdômen", "outro"];
const EQUIPAMENTOS = ["maquina", "barra", "halter", "cabo", "smith", "peso corporal"];

export function SeletorExercicio({
  aoEscolher,
  aoFechar,
  jaNaSessao = [],
}: {
  aoEscolher: (e: ExercicioLocal) => void;
  aoFechar: () => void;
  /** Ids já presentes na sessão — marcados, mas não bloqueados: repetir um
      exercício no mesmo treino é legítimo (pré e pós-exaustão). */
  jaNaSessao?: string[];
}) {
  const [todos, setTodos] = useState<ExercicioLocal[] | null>(null);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [grupo, setGrupo] = useState<string>("");
  const [equipamento, setEquipamento] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerExercicios().then((e) => vivo && setTodos(e));
    return () => {
      vivo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    if (!todos) return [];
    // TODAS as palavras têm que aparecer, em qualquer posição. Substring pura
    // falhava no caso mais natural: "agachamento smith" não achava
    // "Agachamento (Smith)" por causa do parêntese no meio.
    const palavras = normalizarNome(busca).split(" ").filter(Boolean);
    if (palavras.length === 0) return todos;
    return todos.filter((e) => palavras.every((p) => e.nomeBusca.includes(p)));
  }, [todos, busca]);

  async function criar() {
    const nome = busca.trim();
    if (nome.length < 2) return;
    setSalvando(true);
    setErro(null);

    const novo: ExercicioLocal = {
      id: crypto.randomUUID(),
      nome,
      nomeBusca: normalizarNome(nome),
      grupoMuscular: grupo || null,
      equipamento: equipamento || null,
      modoMedicao: equipamento === "peso corporal" ? "peso_corporal_reps" : "peso_reps",
      usos: 0,
      ultimoUsoEm: null,
    };

    // Já existe com esse nome? A constraint do banco recusaria depois; melhor
    // dizer agora do que enfileirar algo que vai falhar cinco vezes.
    if (todos?.some((e) => e.nomeBusca === novo.nomeBusca)) {
      setErro("Já existe um exercício com esse nome.");
      setSalvando(false);
      return;
    }

    // Local primeiro: o exercício tem que servir pro treino de agora.
    await gravarExercicio(novo);
    await enfileirar({
      id: novo.id,
      tipo: "exercicio",
      payload: {
        id: novo.id,
        nome: novo.nome,
        nome_busca: novo.nomeBusca,
        grupo_muscular: novo.grupoMuscular,
        equipamento: novo.equipamento,
        modo_medicao: novo.modoMedicao,
      },
    });
    void sincronizar();

    setSalvando(false);
    aoEscolher(novo);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col pt-safe pb-safe">
      <header className="px-4 pt-3 pb-3 flex items-center gap-2 border-b border-border">
        <button
          onClick={aoFechar}
          aria-label="fechar"
          className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {criando ? "Novo exercício" : "Escolher exercício"}
        </span>
      </header>

      <div className="px-4 pt-3">
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setErro(null);
          }}
          placeholder="buscar ou digitar um nome novo"
          autoComplete="off"
          className="w-full rounded-xl bg-card border border-border px-4 py-3.5 outline-none focus:border-accent"
        />
      </div>

      {criando ? (
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <p className="text-sm">
            Criar <span className="text-accent font-medium">{busca.trim()}</span>
          </p>

          <h3 className="mt-5 text-[10px] uppercase tracking-wide text-muted">Grupo muscular</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {GRUPOS.map((g) => (
              <button
                key={g}
                onClick={() => setGrupo((v) => (v === g ? "" : g))}
                className={`rounded-full px-3 py-2 text-xs border capitalize ${
                  grupo === g
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-card text-muted border-border"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <h3 className="mt-5 text-[10px] uppercase tracking-wide text-muted">Equipamento</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {EQUIPAMENTOS.map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipamento((v) => (v === eq ? "" : eq))}
                className={`rounded-full px-3 py-2 text-xs border capitalize ${
                  equipamento === eq
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-card text-muted border-border"
                }`}
              >
                {eq}
              </button>
            ))}
          </div>

          {erro && <p className="mt-4 text-sm text-red-400">{erro}</p>}

          <p className="mt-5 text-[11px] text-muted">
            Exercício criado aqui não tem ilustração — a base de imagens é fixa e
            casada à mão (ver CLAUDE.md).
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto px-4 pt-3 divide-y divide-border">
          {todos === null && <li className="py-10 text-center text-sm text-muted">carregando…</li>}

          {todos !== null &&
            filtrados.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => aoEscolher(e)}
                  className="w-full py-3 flex items-center gap-3 text-left"
                >
                  <Ilustracao nomeBusca={e.nomeBusca} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.nome}</span>
                    <span className="block text-[11px] text-muted">
                      {e.equipamento ?? "—"} · {e.usos} séries
                    </span>
                  </span>
                  {jaNaSessao.includes(e.id) && (
                    <span className="text-[10px] text-accent shrink-0">já no treino</span>
                  )}
                </button>
              </li>
            ))}

          {todos !== null && filtrados.length === 0 && (
            <li className="py-10 text-center text-sm text-muted">
              Nenhum exercício com esse nome.
            </li>
          )}
        </ul>
      )}

      <div className="px-4 pt-2 border-t border-border">
        {criando ? (
          <div className="flex gap-2">
            <button
              onClick={() => setCriando(false)}
              className="flex-1 rounded-2xl border border-border py-4 text-sm"
            >
              Voltar
            </button>
            <button
              onClick={criar}
              disabled={salvando || busca.trim().length < 2}
              className="flex-1 rounded-2xl bg-accent text-black font-semibold py-4 text-sm disabled:opacity-40"
            >
              {salvando ? "criando…" : "Criar e usar"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCriando(true)}
            disabled={busca.trim().length < 2}
            className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted disabled:opacity-40"
          >
            {busca.trim().length < 2
              ? "digite um nome pra criar um novo"
              : `＋ Criar "${busca.trim()}"`}
          </button>
        )}
      </div>
    </div>
  );
}
