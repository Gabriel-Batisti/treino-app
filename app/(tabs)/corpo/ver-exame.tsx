"use client";

import { useState } from "react";
import { urlDoExame } from "@/app/actions/medidas";

/**
 * Abre o PDF original do exame.
 *
 * A URL é ASSINADA E CURTA (10 min, ver `urlDoExame`): o bucket é privado, e um
 * link permanente circulando é o mesmo que torná-lo público. Por isso ela só é
 * pedida quando você toca — não fica pronta na página.
 *
 * ABRIR É A PARTE DIFÍCIL, e o motivo de tanto código pra um link:
 *
 *   1. `window.open` DEPOIS de um `await` não conta mais como gesto do
 *      usuário. O navegador trata como pop-up e bloqueia em silêncio — sem
 *      erro, sem nada acontecendo. Era esse o sintoma.
 *   2. Abrir a aba ANTES do await resolve na maioria dos navegadores, mas não
 *      em todos: app instalado no iOS e webviews recusam do mesmo jeito.
 *   3. Por isso a URL vira sempre um LINK de verdade na tela, tendo a aba
 *      aberto ou não. Um toque num `<a href>` é o único caminho que nenhum
 *      navegador bloqueia.
 */
export function VerExame({ caminho }: { caminho: string }) {
  const [carregando, setCarregando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setCarregando(true);
    setErro(null);

    // Aberta AGORA, dentro do gesto. Se vier nula, já sabemos que o caminho
    // do pop-up está fechado e o link na tela é o plano.
    const janela = window.open("", "_blank");

    const r = await urlDoExame(caminho);
    setCarregando(false);

    if (!r.ok) {
      janela?.close();
      setErro(r.error);
      return;
    }

    // O LINK APARECE SEMPRE, mesmo quando a aba abriu. Não dá pra saber com
    // certeza se ela realmente navegou — webview devolve um objeto de janela
    // e engole a navegação em silêncio. Deixar o link na tela custa uma linha
    // e elimina a chance de você tocar e não acontecer nada.
    if (janela && !janela.closed) janela.location.href = r.data;
    setLink(r.data);
  }

  if (link) {
    return (
      <div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl bg-accent text-black font-semibold py-4 text-sm text-center"
        >
          Abrir PDF do exame
        </a>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          O link vale por 10 minutos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => void abrir()}
        disabled={carregando}
        className="w-full rounded-2xl border border-border py-4 text-sm disabled:opacity-40"
      >
        {carregando ? "preparando…" : "Ver o PDF do exame"}
      </button>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
