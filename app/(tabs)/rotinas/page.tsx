"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListaRotinas, type RotinaDaLista } from "./lista-rotinas";
import { lerRotinas } from "@/lib/local/db";

/**
 * Lê do IndexedDB, não do servidor (D-007).
 *
 * É por isso que esta página é Client Component: assim o HTML é estático, o
 * service worker consegue guardá-la, e ela ABRE sem rede — que é o caminho da
 * academia. Quem enche o banco local é o Sincronizador, em segundo plano.
 *
 * Timeline, perfil e gráficos seguem no servidor de propósito: cada tela que
 * lê do local é mais uma coisa a manter sincronizada.
 */
export default function Rotinas() {
  const [rotinas, setRotinas] = useState<RotinaDaLista[] | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const locais = await lerRotinas();
      if (!vivo) return;
      setRotinas(
        locais.map((r) => ({
          id: r.id,
          nome: r.nome,
          arquivada: r.arquivada,
          ultimaVez: r.ultimaVez,
          exercicios: r.exercicios.map((e) => e.nome),
        })),
      );
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <main className="flex-1 flex flex-col pt-safe px-4">
      <header className="pt-6 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Treino</h1>
      </header>

      <Link
        href="/cardio"
        className="mt-2 rounded-2xl bg-card border border-border py-4 flex items-center justify-center gap-2 text-sm"
      >
        <span className="text-accent text-lg leading-none">＋</span>
        Registrar cardio
      </Link>

      <h2 className="mt-6 text-lg font-medium">Rotinas</h2>

      {rotinas === null ? (
        <p className="py-10 text-center text-sm text-muted">carregando…</p>
      ) : rotinas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Nenhuma rotina no aparelho ainda.
          <br />
          Abra o app com internet uma vez pra baixar.
        </p>
      ) : (
        <ListaRotinas rotinas={rotinas} />
      )}

      <div className="h-6" />
    </main>
  );
}
