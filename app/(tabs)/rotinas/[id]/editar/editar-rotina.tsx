"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  adicionarExercicioNaRotina,
  removerExercicioDaRotina,
  reordenarExerciciosDaRotina,
  atualizarAlvoDoExercicio,
  renomearRotina,
} from "@/app/actions/rotinas";
import { lerRotina, type ExercicioLocal } from "@/lib/local/db";
import { sincronizar } from "@/lib/local/sync";
import { SeletorExercicio } from "@/components/seletor-exercicio";
import { Ilustracao } from "@/components/ilustracao";

/**
 * Edição da rotina — o template, não o treino do dia.
 *
 * Grava a cada alteração, sem botão "salvar": é o mesmo comportamento do
 * descanso, do reordenar e do ocultar no resto do app. Um botão de salvar aqui
 * criaria um estado "alterado mas não gravado" que o app inteiro não tem.
 *
 * Depois de cada gravação, `sincronizar()` atualiza o banco local — senão a
 * tela de treino continuaria abrindo a rotina velha até o próximo sync.
 */

interface ItemEdicao {
  /** id da linha em `rotina_exercicios`, não do exercício. */
  id: string;
  exercicioId: string;
  nome: string;
  nomeBusca: string;
  seriesAlvo: number | null;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
}

export function EditarRotina() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rotinaId = params.id;

  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<ItemEdicao[] | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // TouchSensor com delay: sem ele o dedo rolando a lista dispara o arrasto.
  const sensores = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    let vivo = true;
    lerRotina(rotinaId).then((r) => {
      if (!vivo || !r) return;
      setNome(r.nome);
      setItens(
        r.exercicios.map((e) => ({
          // O banco local guarda o exercício, não a linha da rotina. Derivar o
          // id da linha daqui seria chute; o servidor devolve no próximo sync.
          id: e.rotinaExercicioId ?? "",
          exercicioId: e.exercicioId,
          nome: e.nome,
          nomeBusca: e.nomeBusca,
          seriesAlvo: e.seriesAlvo,
          repsAlvoMin: e.repsAlvoMin,
          repsAlvoMax: e.repsAlvoMax,
        })),
      );
    });
    return () => {
      vivo = false;
    };
  }, [rotinaId]);

  /** Roda a ação, mostra erro se falhar e atualiza o banco local. */
  function gravar(fn: () => Promise<{ ok: boolean; error?: string }>, aoFalhar?: () => void) {
    iniciar(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          setErro(r.error ?? "não foi possível salvar");
          aoFalhar?.();
          return;
        }
        setErro(null);
        await sincronizar();
      } catch {
        setErro("Sem conexão — a edição de rotina precisa de rede.");
        aoFalhar?.();
      }
    });
  }

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id || !itens) return;
    const antes = itens;
    const de = itens.findIndex((i) => i.id === active.id);
    const para = itens.findIndex((i) => i.id === over.id);
    const nova = arrayMove(itens, de, para);
    setItens(nova);
    gravar(
      () => reordenarExerciciosDaRotina({ rotinaId, ids: nova.map((i) => i.id) }),
      () => setItens(antes),
    );
  }

  function remover(item: ItemEdicao) {
    const antes = itens ?? [];
    setItens((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    gravar(
      () => removerExercicioDaRotina({ id: item.id, rotinaId }),
      () => setItens(antes),
    );
  }

  function adicionar(e: ExercicioLocal) {
    setSeletorAberto(false);
    const novo: ItemEdicao = {
      id: crypto.randomUUID(),
      exercicioId: e.id,
      nome: e.nome,
      nomeBusca: e.nomeBusca,
      seriesAlvo: 3,
      repsAlvoMin: null,
      repsAlvoMax: null,
    };
    const antes = itens ?? [];
    setItens([...antes, novo]);
    gravar(
      () =>
        adicionarExercicioNaRotina({
          id: novo.id,
          rotinaId,
          exercicioId: e.id,
          ordem: antes.length,
        }),
      () => setItens(antes),
    );
  }

  function alterarAlvo(id: string, campo: "seriesAlvo" | "repsAlvoMin" | "repsAlvoMax", valor: number | null) {
    const antes = itens ?? [];
    const nova = antes.map((i) => (i.id === id ? { ...i, [campo]: valor } : i));
    setItens(nova);
    const item = nova.find((i) => i.id === id)!;
    gravar(
      () =>
        atualizarAlvoDoExercicio({
          id,
          rotinaId,
          seriesAlvo: item.seriesAlvo,
          repsAlvoMin: item.repsAlvoMin,
          repsAlvoMax: item.repsAlvoMax,
        }),
      () => setItens(antes),
    );
  }

  if (itens === null) {
    return <main className="flex-1 grid place-items-center text-sm text-muted">carregando…</main>;
  }

  const semIdDaLinha = itens.some((i) => !i.id);

  return (
    <main className="flex-1 flex flex-col">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link
            href={`/rotinas/${rotinaId}`}
            aria-label="voltar"
            className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
          >
            ‹
          </Link>
          <span className="text-sm font-medium">Editar rotina</span>
          <button
            onClick={() => router.push(`/rotinas/${rotinaId}`)}
            className="ml-auto rounded-full bg-accent text-black font-semibold px-5 py-2 text-sm"
          >
            Pronto
          </button>
        </div>
      </header>

      <div className="px-4 pt-4">
        <label className="text-[10px] uppercase tracking-wide text-muted" htmlFor="nome">
          Nome
        </label>
        <input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => {
            const limpo = nome.trim();
            if (limpo) gravar(() => renomearRotina({ id: rotinaId, nome: limpo }));
          }}
          className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-3.5 outline-none focus:border-accent"
        />
      </div>

      {erro && <p className="px-4 pt-3 text-sm text-red-400">{erro}</p>}

      {semIdDaLinha && (
        <p className="mx-4 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Abra o app com internet uma vez pra poder editar esta rotina — falta o
          identificador das linhas no banco local.
        </p>
      )}

      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-5 px-4 flex flex-col gap-3">
            {itens.map((item) => (
              <LinhaExercicio
                key={item.id}
                item={item}
                aoRemover={() => remover(item)}
                aoAlterar={(campo, valor) => alterarAlvo(item.id, campo, valor)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="px-4 pt-4 pb-8">
        <button
          onClick={() => setSeletorAberto(true)}
          className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted"
        >
          ＋ Adicionar exercício
        </button>
      </div>

      {seletorAberto && (
        <SeletorExercicio
          aoEscolher={adicionar}
          aoFechar={() => setSeletorAberto(false)}
          jaNaSessao={itens.map((i) => i.exercicioId)}
        />
      )}
    </main>
  );
}

function LinhaExercicio({
  item,
  aoRemover,
  aoAlterar,
}: {
  item: ItemEdicao;
  aoRemover: () => void;
  aoAlterar: (campo: "seriesAlvo" | "repsAlvoMin" | "repsAlvoMax", valor: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const num = (v: string): number | null => {
    const n = Number(v.trim());
    return v.trim() && Number.isFinite(n) ? Math.round(n) : null;
  };

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl bg-card border p-3 ${
        isDragging ? "border-accent shadow-lg z-10 relative" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={`reordenar ${item.nome}`}
          className="size-9 -ml-1 shrink-0 grid place-items-center text-muted touch-none cursor-grab active:cursor-grabbing"
        >
          ⠿
        </button>
        <Ilustracao nomeBusca={item.nomeBusca} className="size-10" />
        <span className="flex-1 min-w-0 truncate text-sm">{item.nome}</span>
        <button
          onClick={aoRemover}
          aria-label={`remover ${item.nome}`}
          className="size-9 shrink-0 grid place-items-center text-muted text-lg"
        >
          ×
        </button>
      </div>

      <div className="mt-2 pl-11 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted">séries</span>
          <button
            onClick={() => aoAlterar("seriesAlvo", Math.max(1, (item.seriesAlvo ?? 3) - 1))}
            aria-label="menos uma série"
            className="size-8 rounded-lg bg-background border border-border"
          >
            −
          </button>
          <span className="w-5 text-center tabular-nums text-sm">{item.seriesAlvo ?? "—"}</span>
          <button
            onClick={() => aoAlterar("seriesAlvo", Math.min(20, (item.seriesAlvo ?? 3) + 1))}
            aria-label="mais uma série"
            className="size-8 rounded-lg bg-background border border-border"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] uppercase tracking-wide text-muted">reps</span>
          <input
            inputMode="numeric"
            aria-label={`reps mínimas de ${item.nome}`}
            value={item.repsAlvoMin ?? ""}
            onChange={(e) => aoAlterar("repsAlvoMin", num(e.target.value))}
            className="w-11 rounded-lg bg-background border border-border py-2 text-center tabular-nums text-sm outline-none focus:border-accent"
          />
          <span className="text-muted text-xs">–</span>
          <input
            inputMode="numeric"
            aria-label={`reps máximas de ${item.nome}`}
            value={item.repsAlvoMax ?? ""}
            onChange={(e) => aoAlterar("repsAlvoMax", num(e.target.value))}
            className="w-11 rounded-lg bg-background border border-border py-2 text-center tabular-nums text-sm outline-none focus:border-accent"
          />
        </div>
      </div>
    </article>
  );
}
