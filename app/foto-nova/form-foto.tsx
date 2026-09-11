"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarFoto } from "@/app/actions/fotos";
import { createClient } from "@/lib/supabase/client";
import { reduzirImagem } from "@/lib/imagem";
import { hojeLocal } from "@/lib/format";

/**
 * Upload de foto de acompanhamento.
 *
 * `capture="environment"` abre a câmera traseira direto no iPhone, mas o
 * seletor de arquivo continua disponível — foto de acompanhamento costuma ser
 * tirada com timer e escolhida depois, não na hora.
 *
 * Fora da fila offline (D-007): enfileirar binário no IndexedDB seria
 * complexidade sem caso de uso — isso se faz em casa, com rede.
 */

const ANGULOS = [
  { valor: "frente", rotulo: "Frente" },
  { valor: "lado", rotulo: "Lado" },
  { valor: "costas", rotulo: "Costas" },
  { valor: "outro", rotulo: "Outro" },
] as const;

type Angulo = (typeof ANGULOS)[number]["valor"];

export function FormFoto() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [angulo, setAngulo] = useState<Angulo>("frente");
  const [data, setData] = useState(hojeLocal());
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function escolher(f: File | null) {
    setErro(null);
    if (previa) URL.revokeObjectURL(previa);
    if (!f) {
      setArquivo(null);
      setPrevia(null);
      return;
    }
    setArquivo(f);
    setPrevia(URL.createObjectURL(f));
  }

  async function salvar() {
    if (!arquivo) return;
    setSalvando(true);
    setErro(null);

    try {
      setEtapa("preparando imagem…");
      const { blob, largura, altura } = await reduzirImagem(arquivo);

      setEtapa("enviando…");
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Faça login de novo.");

      // Convenção do bucket: <user_id>/<arquivo> — é da primeira pasta que as
      // políticas do Storage tiram o dono (migration 0004).
      const caminho = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(caminho, blob, { contentType: "image/jpeg" });

      if (error) {
        throw new Error(
          error.message.toLowerCase().includes("bucket")
            ? "Bucket `fotos` não existe — rode a migration 0004 no Supabase."
            : `Falha ao enviar: ${error.message}`,
        );
      }

      setEtapa("salvando…");
      const r = await salvarFoto({
        id: crypto.randomUUID(),
        tirada_em: new Date(`${data}T12:00:00-03:00`).toISOString(),
        data_local: data,
        angulo,
        arquivo_path: caminho,
        largura,
        altura,
        notas: null,
      });
      if (!r.ok) throw new Error(r.error);

      router.push("/fotos");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não foi possível salvar");
      setSalvando(false);
      setEtapa(null);
    }
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link
            href="/fotos"
            aria-label="voltar"
            className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none"
          >
            ‹
          </Link>
          <span className="text-sm font-medium">Nova foto</span>
        </div>
      </header>

      <div className="flex-1 px-4 pt-5 flex flex-col gap-6">
        <section>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {previa ? (
            <button onClick={() => entrada.current?.click()} className="w-full">
              <div className="rounded-2xl overflow-hidden bg-card border border-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previa} alt="prévia da foto escolhida" className="w-full h-auto" />
              </div>
              <span className="mt-2 block text-xs text-muted">toque pra trocar</span>
            </button>
          ) : (
            <button
              onClick={() => entrada.current?.click()}
              className="w-full rounded-2xl border border-dashed border-border py-16 text-sm text-muted"
            >
              <span className="block text-2xl">＋</span>
              <span className="block mt-2">Tirar ou escolher foto</span>
            </button>
          )}
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Ângulo</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ANGULOS.map((a) => (
              <button
                key={a.valor}
                onClick={() => setAngulo(a.valor)}
                className={`rounded-xl border py-3 text-xs ${
                  angulo === a.valor
                    ? "bg-accent text-black border-accent font-medium"
                    : "bg-card border-border"
                }`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Data</h2>
          <input
            type="date"
            value={data}
            max={hojeLocal()}
            onChange={(e) => setData(e.target.value)}
            className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center outline-none focus:border-accent"
          />
        </section>
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={salvar}
          disabled={salvando || !arquivo}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
        >
          {etapa ?? (arquivo ? "Salvar foto" : "Escolha uma foto")}
        </button>
      </div>
    </main>
  );
}
