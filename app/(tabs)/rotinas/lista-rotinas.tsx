"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reordenarRotinas, arquivarRotina } from "@/app/actions/rotinas";
import { grupoDaRotina, ROTULO_GRUPO, type GrupoRotina } from "@/lib/treino/rotinas";
import { haQuantoTempo } from "@/lib/format";

export interface RotinaDaLista {
  id: string;
  nome: string;
  exercicios: string[];
  ultimaVez: string | null;
  arquivada: boolean;
}

export function ListaRotinas({ rotinas: iniciais }: { rotinas: RotinaDaLista[] }) {
  const [rotinas, setRotinas] = useState(iniciais);
  const [abertos, setAbertos] = useState<Record<GrupoRotina, boolean>>({
    minhas: true,
    muscle_lab: false,
  });
  const [mostrarOcultas, setMostrarOcultas] = useState(false);
  const [, iniciar] = useTransition();

  // TouchSensor com delay: sem ele, o dedo rolando a lista dispara o arrasto e
  // a tela trava. 220ms separa "rolar" de "segurar pra mover".
  const sensores = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visiveis = rotinas.filter((r) => mostrarOcultas || !r.arquivada);
  const porGrupo = (g: GrupoRotina) => visiveis.filter((r) => grupoDaRotina(r.nome) === g);
  const ocultas = rotinas.filter((r) => r.arquivada).length;

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const antes = rotinas;
    const de = rotinas.findIndex((r) => r.id === active.id);
    const para = rotinas.findIndex((r) => r.id === over.id);
    const nova = arrayMove(rotinas, de, para);
    setRotinas(nova); // otimista

    iniciar(async () => {
      const r = await reordenarRotinas({ ids: nova.map((x) => x.id) });
      if (!r.ok) setRotinas(antes); // reverte se o servidor recusar
    });
  }

  function alternarOculta(id: string, arquivada: boolean) {
    const antes = rotinas;
    setRotinas((prev) => prev.map((r) => (r.id === id ? { ...r, arquivada } : r)));
    iniciar(async () => {
      const r = await arquivarRotina({ id, arquivada });
      if (!r.ok) setRotinas(antes);
    });
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={rotinas.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        {(["minhas", "muscle_lab"] as GrupoRotina[]).map((g) => {
          const doGrupo = porGrupo(g);
          if (doGrupo.length === 0) return null;
          return (
            <section key={g} className="mt-4">
              <button
                onClick={() => setAbertos((a) => ({ ...a, [g]: !a[g] }))}
                className="w-full flex items-center gap-2 py-2 text-left"
                aria-expanded={abertos[g]}
              >
                <span className={`text-muted text-xs transition-transform ${abertos[g] ? "rotate-90" : ""}`}>
                  ▶
                </span>
                <span className="text-muted">
                  {ROTULO_GRUPO[g]} ({doGrupo.length})
                </span>
              </button>

              {abertos[g] && (
                <div className="flex flex-col gap-3 mt-1">
                  {doGrupo.map((r) => (
                    <CardRotina key={r.id} rotina={r} aoOcultar={alternarOculta} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </SortableContext>

      {ocultas > 0 && (
        <button
          onClick={() => setMostrarOcultas((v) => !v)}
          className="mt-5 w-full py-3 text-center text-xs text-muted"
        >
          {mostrarOcultas ? "esconder ocultas" : `mostrar ${ocultas} oculta${ocultas > 1 ? "s" : ""}`}
        </button>
      )}
    </DndContext>
  );
}

function CardRotina({
  rotina,
  aoOcultar,
}: {
  rotina: RotinaDaLista;
  aoOcultar: (id: string, arquivada: boolean) => void;
}) {
  const [menu, setMenu] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rotina.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl bg-card border p-4 ${
        isDragging ? "border-accent opacity-90 shadow-lg z-10 relative" : "border-border"
      } ${rotina.arquivada ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Alça de arrasto própria: o card inteiro arrastável impediria de
            tocar pra abrir o detalhe. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`reordenar ${rotina.nome}`}
          className="size-9 -ml-2 -mt-1 shrink-0 grid place-items-center text-muted touch-none cursor-grab active:cursor-grabbing"
        >
          ⠿
        </button>

        <Link href={`/rotinas/${rotina.id}`} className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium truncate">{rotina.nome}</h2>
            {rotina.ultimaVez && (
              <span className="text-[11px] text-muted shrink-0">{haQuantoTempo(rotina.ultimaVez)}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
            {rotina.exercicios.join(", ")}
          </p>
        </Link>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label={`opções de ${rotina.nome}`}
            className="size-9 -mr-2 -mt-1 grid place-items-center text-muted"
          >
            ⋯
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl bg-card border border-border p-1 shadow-lg">
              <button
                onClick={() => {
                  aoOcultar(rotina.id, !rotina.arquivada);
                  setMenu(false);
                }}
                className="block w-full text-left px-3 py-2.5 text-xs rounded-lg"
              >
                {rotina.arquivada ? "Mostrar rotina" : "Ocultar rotina"}
              </button>
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/sessao?rotina=${rotina.id}`}
        className="mt-3 block rounded-xl bg-accent text-black font-semibold py-3.5 text-center text-sm"
      >
        Começar rotina
      </Link>
    </article>
  );
}
