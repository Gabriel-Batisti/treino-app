"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListaRotinas, type RotinaDaLista } from "./lista-rotinas";
import { NovaRotina } from "./nova-rotina";
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

      <div className="mt-2 flex flex-col gap-2">
        <Link
          href="/sessao"
          className="rounded-2xl bg-card border border-border py-4 flex items-center justify-center gap-2 text-sm"
        >
          <span className="text-accent text-lg leading-none">＋</span>
          Iniciar treino vazio
        </Link>
        <Link
          href="/cardio"
          className="rounded-2xl bg-card border border-border py-4 flex items-center justify-center gap-2 text-sm"
        >
          <span className="text-accent text-lg leading-none">＋</span>
          Registrar cardio
        </Link>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">Rotinas</h2>
      </div>

      {rotinas === null ? (
        <p className="py-10 text-center text-sm text-muted">carregando…</p>
      ) : rotinas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Nenhuma rotina no aparelho ainda.
          <br />
          Abra o app com internet pra baixar, ou crie uma abaixo.
        </p>
      ) : (
        <ListaRotinas rotinas={rotinas} />
      )}

      <div className="mt-3 flex flex-col">
        <NovaRotina />
      </div>

      <div className="h-6" />
    </main>
  );
}
