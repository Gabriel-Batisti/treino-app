import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarioMes, type DiaAtivo } from "@/components/calendario-mes";
import { Ilustracao } from "@/components/ilustracao";
import { hojeLocal, formatData, haQuantoTempo } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROTULO_CARDIO: Record<string, string> = {
  esteira: "Esteira",
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  escada: "Escada",
  remo: "Remo",
  corrida: "Corrida",
  caminhada: "Caminhada",
  outro: "Cardio",
};

interface SerieDaTimeline {
  peso_kg: number | null;
  e1rm: number | null;
  volume_kg: number | null;
  concluida: boolean;
  tipo: string;
}

interface ExDaTimeline {
  ordem: number;
  exercicio_id: string;
  nome_snapshot: string;
  exercicios: { nome_busca: string } | null;
  series: SerieDaTimeline[];
}

export default async function Inicio() {
  const supabase = await createClient();
  const hoje = hojeLocal();

  const [{ data: sessoes }, cardiosRes, recordesRes] = await Promise.all([
    supabase
      .from("sessoes")
      .select(
        "id, nome, data_local, inicio_em, duracao_seg, sessao_exercicios(ordem, exercicio_id, nome_snapshot, exercicios(nome_busca), series(peso_kg, e1rm, volume_kg, concluida, tipo))",
      )
      .eq("status", "concluida")
      .order("inicio_em", { ascending: false })
      .limit(20),
    // A 0002 pode ainda não ter sido rodada — a tela não pode quebrar por isso.
    supabase
      .from("cardios")
      .select("id, tipo, data_local, inicio_em, duracao_min, calorias, distancia_km, fc_media, fonte")
      .is("excluido_em", null)
      .order("inicio_em", { ascending: false })
      .limit(20)
      .then((r) => r, () => ({ data: null })),
    supabase
      .from("vw_recorde_exercicio")
      .select("exercicio_id, melhor_peso")
      .then((r) => r, () => ({ data: null })),
  ]);

  // A 0003 pode não ter sido rodada — a faixa some em vez de quebrar a tela.
  const { data: pesos } = await supabase
    .from("medidas")
    .select("data_local, peso_kg")
    .is("excluido_em", null)
    .order("data_local", { ascending: false })
    .limit(2)
    .then((r) => r, () => ({ data: null }));

  const pesoAtual = (pesos as { data_local: string; peso_kg: number }[] | null)?.[0] ?? null;
  const pesoAnterior = (pesos as { data_local: string; peso_kg: number }[] | null)?.[1] ?? null;
  const deltaPeso =
    pesoAtual && pesoAnterior ? Number(pesoAtual.peso_kg) - Number(pesoAnterior.peso_kg) : null;
  const pesouHoje = pesoAtual?.data_local === hoje;

  const cardios = (cardiosRes as { data: Cardio[] | null }).data ?? [];
  const recordes = new Map(
    ((recordesRes as { data: { exercicio_id: string; melhor_peso: number | null }[] | null }).data ?? [])
      .map((r) => [r.exercicio_id, r.melhor_peso]),
  );

  // Dias ativos do calendário: treino e cardio contam separado.
  const mapaDias = new Map<string, DiaAtivo>();
  for (const s of sessoes ?? []) {
    const d = mapaDias.get(s.data_local) ?? { data: s.data_local, treino: false, cardio: false };
    d.treino = true;
    mapaDias.set(s.data_local, d);
  }
  for (const c of cardios) {
    const d = mapaDias.get(c.data_local) ?? { data: c.data_local, treino: false, cardio: false };
    d.cardio = true;
    mapaDias.set(c.data_local, d);
  }

  // Uma linha do tempo só, treino e cardio misturados por data.
  const itens = [
    ...(sessoes ?? []).map((s) => ({ tipo: "treino" as const, quando: s.inicio_em, dado: s })),
    ...cardios.map((c) => ({ tipo: "cardio" as const, quando: c.inicio_em, dado: c })),
  ].sort((a, b) => (a.quando < b.quando ? 1 : -1));

  return (
    <main className="flex-1 flex flex-col pt-safe">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <Link
          href="/cardio"
          className="rounded-full border border-border px-4 py-2 text-xs text-accent"
        >
          + Cardio
        </Link>
      </header>

      <div className="px-4">
        <CalendarioMes dias={[...mapaDias.values()]} hoje={hoje} />
      </div>

      {pesos !== null && (
        <Link
          href="/peso"
          className="mx-4 mt-3 rounded-2xl bg-card border border-border px-4 py-3.5 flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Peso</p>
            <p className="tabular-nums">
              {pesoAtual ? `${Number(pesoAtual.peso_kg).toLocaleString("pt-BR")} kg` : "—"}
              {deltaPeso != null && Math.abs(deltaPeso) >= 0.05 && (
                <span className={`ml-2 text-xs ${deltaPeso > 0 ? "text-amber-400" : "text-accent"}`}>
                  {deltaPeso > 0 ? "+" : ""}
                  {(Math.round(deltaPeso * 10) / 10).toLocaleString("pt-BR")}
                </span>
              )}
            </p>
          </div>
          <span className={`text-xs shrink-0 ${pesouHoje ? "text-muted" : "text-accent"}`}>
            {pesouHoje ? "registrado hoje" : "registrar hoje ›"}
          </span>
        </Link>
      )}

      <section className="mt-6 flex flex-col gap-3 px-4">
        {itens.length === 0 && (
          <p className="text-sm text-muted py-10 text-center">Nada registrado ainda.</p>
        )}

        {itens.map((item) => {
          if (item.tipo === "cardio") {
            const c = item.dado;
            return (
              <article key={c.id} className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">
                    {ROTULO_CARDIO[c.tipo] ?? "Cardio"}
                    {c.fonte === "apple_saude" && (
                      <span className="ml-2 text-[10px] font-normal text-accent align-middle">
                        Apple Watch
                      </span>
                    )}
                  </h2>
                  <span className="text-[11px] text-muted shrink-0">
                    {haQuantoTempo(c.data_local)} · {formatData(c.data_local)}
                  </span>
                </div>
                <div className="mt-2 flex gap-6 text-sm">
                  <span>
                    <span className="text-[10px] uppercase tracking-wide text-muted block">Tempo</span>
                    {c.duracao_min} min
                  </span>
                  {c.calorias != null && (
                    <span>
                      <span className="text-[10px] uppercase tracking-wide text-muted block">Calorias</span>
                      {c.calorias} kcal
                    </span>
                  )}
                  {c.distancia_km != null && (
                    <span>
                      <span className="text-[10px] uppercase tracking-wide text-muted block">Distância</span>
                      {c.distancia_km} km
                    </span>
                  )}
                  {c.fc_media != null && (
                    <span>
                      <span className="text-[10px] uppercase tracking-wide text-muted block">FC média</span>
                      {c.fc_media} bpm
                    </span>
                  )}
                </div>
              </article>
            );
          }

          const s = item.dado;
          const exs = ((s.sessao_exercicios ?? []) as unknown as ExDaTimeline[]).sort(
            (a, b) => a.ordem - b.ordem,
          );
          const series = exs.flatMap((e) => e.series ?? []).filter((x) => x.concluida && x.tipo !== "aquecimento");
          const volume = Math.round(series.reduce((n, x) => n + Number(x.volume_kg ?? 0), 0));

          // "Recorde" = a sessão contém a melhor marca de peso daquele exercício
          // em todo o histórico. Peso é FATO; e1RM seria estimativa (D-004).
          const qtdRecordes = exs.filter((e) => {
            const melhor = recordes.get(e.exercicio_id);
            if (melhor == null) return false;
            const maxNaSessao = Math.max(
              0,
              ...(e.series ?? []).filter((x) => x.concluida).map((x) => Number(x.peso_kg ?? 0)),
            );
            return maxNaSessao >= Number(melhor);
          }).length;

          return (
            <Link
              key={s.id}
              href={`/sessoes/${s.id}`}
              className="block rounded-2xl bg-card border border-border p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium">{s.nome ?? "Treino"}</h2>
                <span className="text-[11px] text-muted shrink-0">
                  {haQuantoTempo(s.data_local)} · {formatData(s.data_local)}
                </span>
              </div>

              <div className="mt-2 flex gap-6 text-sm">
                <span>
                  <span className="text-[10px] uppercase tracking-wide text-muted block">Tempo</span>
                  {s.duracao_seg ? `${Math.round(s.duracao_seg / 60)} min` : "—"}
                </span>
                <span>
                  <span className="text-[10px] uppercase tracking-wide text-muted block">Volume</span>
                  {volume.toLocaleString("pt-BR")} kg
                </span>
                {qtdRecordes > 0 && (
                  <span>
                    <span className="text-[10px] uppercase tracking-wide text-muted block">Recordes</span>
                    🥇 {qtdRecordes}
                  </span>
                )}
              </div>

              <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {exs.slice(0, 3).map((e) => (
                  <li key={e.exercicio_id} className="flex items-center gap-3">
                    <Ilustracao nomeBusca={e.exercicios?.nome_busca ?? ""} className="size-9" />
                    <span className="text-sm">
                      {(e.series ?? []).filter((x) => x.concluida).length} séries {e.nome_snapshot}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-center text-xs text-muted">
                {exs.length > 3 ? `Ver mais ${exs.length - 3} exercícios` : "Ver treino"}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

interface Cardio {
  id: string;
  tipo: string;
  data_local: string;
  inicio_em: string;
  duracao_min: number;
  calorias: number | null;
  distancia_km: number | null;
  fc_media: number | null;
  fonte: string | null;
}
