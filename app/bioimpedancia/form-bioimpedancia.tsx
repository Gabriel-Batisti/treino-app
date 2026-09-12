"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lerExame, salvarMedida } from "@/app/actions/medidas";
import { createClient } from "@/lib/supabase/client";
import { hojeLocal } from "@/lib/format";

/**
 * Registro de bioimpedância: o exame em si + os valores.
 *
 * O ARQUIVO é o que mais importa e é o único campo obrigatório junto com o
 * peso: dá pra guardar o exame hoje e digitar os números depois. Os valores é
 * que alimentam os gráficos — sem eles, o exame vira só um anexo.
 *
 * Nada aqui passa pela fila offline (D-007): bioimpedância se faz na clínica,
 * com sinal, e enfileirar binário no IndexedDB seria complexidade sem caso de
 * uso. A tela avisa quando não há rede em vez de fingir que salvou.
 */

const CAMPOS = [
  { chave: "gordura_pct", rotulo: "Gordura", sufixo: "%", modo: "decimal" },
  { chave: "massa_muscular_kg", rotulo: "Massa muscular", sufixo: "kg", modo: "decimal" },
  { chave: "massa_magra_kg", rotulo: "Massa magra", sufixo: "kg", modo: "decimal" },
  { chave: "agua_pct", rotulo: "Água corporal", sufixo: "%", modo: "decimal" },
  { chave: "gordura_visceral", rotulo: "Gordura visceral", sufixo: "", modo: "decimal" },
  { chave: "tmb_kcal", rotulo: "Metabolismo basal", sufixo: "kcal", modo: "numeric" },
  { chave: "cintura_cm", rotulo: "Cintura", sufixo: "cm", modo: "decimal" },
] as const;

type Chave = (typeof CAMPOS)[number]["chave"];

const TIPOS_ACEITOS = "image/jpeg,image/png,image/heic,image/webp,application/pdf";
const TAMANHO_MAX = 10 * 1024 * 1024;

export function FormBioimpedancia() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hojeLocal());
  const [peso, setPeso] = useState("");
  const [valores, setValores] = useState<Partial<Record<Chave, string>>>({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<number | null>(null);

  const numero = (s: string | undefined): number | null => {
    const v = s?.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const pesoNum = numero(peso);
  const podeSalvar = pesoNum != null && pesoNum > 20 && pesoNum < 400;

  function escolher(f: File | null) {
    setErro(null);
    setLido(null);
    if (!f) return setArquivo(null);
    if (f.size > TAMANHO_MAX) {
      setErro("Arquivo acima de 10 MB. Tire uma foto menor ou comprima o PDF.");
      return;
    }
    setArquivo(f);
    if (f.type === "application/pdf") void preencherPeloExame(f);
  }

  /**
   * Lê o laudo e preenche os campos VAZIOS.
   *
   * Não sobrescreve o que você já digitou: se você corrigiu um número à mão, o
   * PDF não tem o direito de desfazer. E falhar aqui não atrapalha nada — o
   * formulário continua digitável, que é como ele funcionava antes.
   */
  async function preencherPeloExame(f: File) {
    setLendo(true);
    const fd = new FormData();
    fd.set("arquivo", f);
    const r = await lerExame(fd);
    setLendo(false);
    if (!r.ok || r.data.achados === 0) return;

    const l = r.data;
    if (l.data_local) setData(l.data_local);
    if (l.peso_kg != null) setPeso((p) => p.trim() || String(l.peso_kg));
    setValores((v) => {
      const novo = { ...v };
      const por = (k: Chave, n: number | null) => {
        if (n != null && !novo[k]?.trim()) novo[k] = String(n);
      };
      por("gordura_pct", l.gordura_pct);
      por("massa_muscular_kg", l.massa_muscular_kg);
      por("massa_magra_kg", l.massa_magra_kg);
      por("agua_pct", l.agua_pct);
      por("gordura_visceral", l.gordura_visceral);
      por("tmb_kcal", l.tmb_kcal);
      return novo;
    });
    setLido(l.achados);
  }

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);

    let caminho: string | null = null;

    if (arquivo) {
      setEtapa("enviando exame…");
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setErro("Sessão expirada. Faça login de novo.");
        setSalvando(false);
        setEtapa(null);
        return;
      }
      // Convenção do bucket: <user_id>/<arquivo> — é da primeira pasta que as
      // políticas do Storage tiram o dono (migration 0003).
      const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "bin";
      caminho = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("bioimpedancia")
        .upload(caminho, arquivo, { contentType: arquivo.type || undefined });

      if (error) {
        setErro(
          error.message.toLowerCase().includes("bucket")
            ? "Bucket `bioimpedancia` não existe — rode a migration 0003 no Supabase."
            : `Falha ao enviar o exame: ${error.message}`,
        );
        setSalvando(false);
        setEtapa(null);
        return;
      }
    }

    setEtapa("salvando…");
    const r = await salvarMedida({
      id: crypto.randomUUID(),
      origem: "bioimpedancia",
      medido_em: new Date(`${data}T12:00:00-03:00`).toISOString(),
      data_local: data,
      peso_kg: Math.round(pesoNum! * 10) / 10,
      gordura_pct: numero(valores.gordura_pct),
      massa_magra_kg: numero(valores.massa_magra_kg),
      massa_muscular_kg: numero(valores.massa_muscular_kg),
      agua_pct: numero(valores.agua_pct),
      gordura_visceral: numero(valores.gordura_visceral),
      tmb_kcal: numero(valores.tmb_kcal) != null ? Math.round(numero(valores.tmb_kcal)!) : null,
      cintura_cm: numero(valores.cintura_cm),
      arquivo_path: caminho,
      notas: null,
    });

    setSalvando(false);
    setEtapa(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    router.push("/peso");
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 flex items-center gap-2">
          <Link href="/peso" aria-label="voltar" className="size-9 -ml-2 grid place-items-center text-muted text-2xl leading-none">
            ‹
          </Link>
          <span className="text-sm font-medium">Bioimpedância</span>
        </div>
      </header>

      <div className="flex-1 px-4 pt-5 flex flex-col gap-6">
        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">Exame</h2>
          <input
            ref={entrada}
            type="file"
            accept={TIPOS_ACEITOS}
            onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            onClick={() => entrada.current?.click()}
            className={`mt-2 w-full rounded-2xl border border-dashed py-6 text-sm ${
              arquivo ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {arquivo ? (
              <>
                <span className="block">{arquivo.name}</span>
                <span className="block mt-1 text-[11px] opacity-70">
                  {(arquivo.size / 1024 / 1024).toFixed(1)} MB · toque pra trocar
                </span>
              </>
            ) : (
              <>
                <span className="block text-lg">＋</span>
                <span className="block mt-1">Foto ou PDF do exame</span>
              </>
            )}
          </button>
          {lendo && (
            <p className="mt-2 text-center text-xs text-muted">lendo o exame…</p>
          )}
          {lido != null && !lendo && (
            <p className="mt-2 text-center text-xs text-accent">
              {lido} {lido === 1 ? "valor lido" : "valores lidos"} do laudo — confira abaixo
            </p>
          )}
          {arquivo && (
            <button
              onClick={() => {
                setArquivo(null);
                setLido(null);
                if (entrada.current) entrada.current.value = "";
              }}
              className="mt-2 w-full py-2 text-center text-xs text-muted"
            >
              remover arquivo
            </button>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Data</h2>
            <input
              type="date"
              value={data}
              max={hojeLocal()}
              onChange={(e) => setData(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center outline-none focus:border-accent"
            />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-wide text-muted">Peso *</h2>
            <input
              inputMode="decimal"
              placeholder="kg"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="mt-2 w-full rounded-xl bg-card border border-border px-3 py-4 text-center tabular-nums outline-none focus:border-accent"
            />
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-wide text-muted">
            {lido != null
              ? "Valores do exame — vieram do PDF, pode corrigir"
              : "Valores do exame — o que você não tiver, deixe em branco"}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.chave}>
                <label className="text-[11px] text-muted" htmlFor={c.chave}>
                  {c.rotulo} {c.sufixo && <span className="opacity-60">({c.sufixo})</span>}
                </label>
                <input
                  id={c.chave}
                  inputMode={c.modo}
                  value={valores[c.chave] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-3.5 text-center tabular-nums outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      <div className="sticky bottom-0 px-4 pt-2 pb-safe bg-background/95 backdrop-blur border-t border-border">
        <button
          onClick={salvar}
          disabled={salvando || !podeSalvar}
          className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
        >
          {etapa ?? (podeSalvar ? "Salvar bioimpedância" : "Preencha o peso")}
        </button>
      </div>
    </main>
  );
}
