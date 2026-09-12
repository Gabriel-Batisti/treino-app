"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { enfileirar } from "@/lib/local/db";
import { sincronizar } from "@/lib/local/sync";
import { hojeLocal, formatPeso, haQuantoTempo } from "@/lib/format";
import { e1rm, volume } from "@/lib/treino/calc";
import { avisarDescansoAcabou, prepararSom, tocarBip } from "@/lib/som";
import { SeletorExercicio } from "@/components/seletor-exercicio";
import {
  lerDesempenho,
  salvarRascunho,
  lerRascunho,
  limparRascunho,
  type ExercicioLocal,
} from "@/lib/local/db";

/**
 * A TELA DE SESSÃO ATIVA — inverte o default do projeto de propósito (D-008).
 *
 * O resto do app é Server Component + Server Action. Aqui não: round-trip por
 * série é incompatível com o uso (uma mão, 40s entre séries, sinal ruim). Todo
 * o estado é local e a sessão sobe INTEIRA ao finalizar.
 *
 * Não "corrija" isto pro padrão do projeto. Está registrado no CLAUDE.md.
 */

export interface SerieAnterior {
  indice: number;
  pesoKg: number | null;
  reps: number | null;
  e1rm: number | null;
}

export interface ExercicioDaSessao {
  exercicioId: string;
  nome: string;
  modoMedicao: string;
  seriesAlvo: number;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
  descansoSeg: number | null;
  anterior: SerieAnterior[];
  anteriorEm: string | null;
  /** Maior carga já feita neste exercício. Null = sem histórico ou sem a 0002. */
  recordePesoKg: number | null;
}

interface SerieEmAndamento {
  id: string;
  indice: number;
  pesoKg: number | null;
  /**
   * O que está literalmente digitado no campo de peso, enquanto se digita.
   *
   * Sem isto, "12," era desfeito no mesmo instante: `Number("12,")` vira 12, o
   * campo redesenhava "12" e a vírgula sumia antes do 5 chegar. Meio quilo é a
   * menor anilha da academia — digitar 12,5 não pode ser impossível.
   *
   * Vive só enquanto o campo está em edição; ao sair, volta a mostrar o número.
   */
  pesoTexto?: string;
  reps: number | null;
  concluida: boolean;
  registradaEm: string | null;
}

interface ExercicioEmAndamento extends ExercicioDaSessao {
  id: string;
  notas: string;
  series: SerieEmAndamento[];
  /** Entrou no meio do treino, não veio da rotina — candidato a virar parte dela. */
  foraDaRotina?: boolean;
}

function novaSerie(indice: number): SerieEmAndamento {
  return {
    id: crypto.randomUUID(),
    indice,
    pesoKg: null,
    reps: null,
    concluida: false,
    registradaEm: null,
  };
}

/** Quantidade de linhas = alvo da rotina, ou o que foi feito da última vez. */
function montarExercicio(e: ExercicioDaSessao): ExercicioEmAndamento {
  const qtd = Math.max(e.seriesAlvo, e.anterior.length, 1);
  return {
    ...e,
    id: crypto.randomUUID(),
    notas: "",
    series: Array.from({ length: qtd }, (_, i) => {
      const s = novaSerie(i + 1);
      // Peso entra PREENCHIDO (raramente muda). Reps fica como placeholder —
      // preencher os dois faria você registrar série que não fez.
      s.pesoKg = e.anterior[i]?.pesoKg ?? e.anterior[e.anterior.length - 1]?.pesoKg ?? null;
      return s;
    }),
  };
}

function mmss(seg: number): string {
  const m = Math.floor(Math.abs(seg) / 60);
  const s = Math.abs(seg) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDescanso(seg: number | null): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}min ${s}s` : `${m}min 0s`;
}

export function SessaoAtiva({
  nomeRotina,
  rotinaId,
  exerciciosIniciais,
}: {
  nomeRotina: string | null;
  rotinaId: string | null;
  exerciciosIniciais: ExercicioDaSessao[];
}) {
  const router = useRouter();
  const inicioRef = useRef(new Date().toISOString());
  const [exercicios, setExercicios] = useState<ExercicioEmAndamento[]>(() =>
    exerciciosIniciais.map(montarExercicio),
  );
  const [salvando, setSalvando] = useState(false);
  // Painel do fim do treino: métricas do relógio e, se for o caso, a rotina.
  const [painelFim, setPainelFim] = useState(false);
  const [fcMedia, setFcMedia] = useState("");
  /** Série sendo arrastada pro lado e o quanto já andou. Uma por vez. */
  const [deslize, setDeslize] = useState<{ id: string; dx: number } | null>(null);
  /** Quais exercícios passam a ter o número de séries feito hoje. */
  const [aAjustarSeries, setAAjustarSeries] = useState<Record<string, boolean> | null>(null);
  const [calorias, setCalorias] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  /** Timestamp em que o descanso acaba. Guardo o FIM, não o restante. */
  const [descansoAte, setDescansoAte] = useState<number | null>(null);
  /** Duração cheia do descanso atual, só pra desenhar a barra de progresso. */
  const [descansoTotal, setDescansoTotal] = useState(0);
  const [seletorAberto, setSeletorAberto] = useState(false);
  /** null = não perguntou ainda. Mapa exercicioId -> incluir na rotina. */
  const [aAdicionarNaRotina, setAAdicionarNaRotina] = useState<Record<string, boolean> | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [retomado, setRetomado] = useState(false);
  /** Só grava rascunho depois de tentar restaurar, senão o vazio sobrescreve. */
  const prontoPraRascunho = useRef(false);
  /** Último fim de descanso já avisado, pra não apitar em looping. */
  const avisouRef = useRef<number | null>(null);
  /** Toque em andamento numa linha de série, pro arrastar-pra-excluir. */
  const toqueRef = useRef<{ id: string; x: number; y: number; horizontal: boolean | null } | null>(
    null,
  );

  /**
   * Retoma o treino que ficou pela metade.
   *
   * Sem isto, tocar em voltar sem querer — ou o iOS descartar a aba em segundo
   * plano — apagava o treino inteiro. É o "rascunho protege o dado" do D-007,
   * que até aqui só valia na hora de concluir.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await lerRascunho<{
        rotinaId: string | null;
        inicioEm: string;
        exercicios: ExercicioEmAndamento[];
      }>();
      // Rascunho de outra rotina fica onde está: some da tela, mas continua lá
      // pra quando você voltar naquela rotina.
      if (vivo && r && r.rotinaId === rotinaId && r.exercicios.length > 0) {
        inicioRef.current = r.inicioEm;
        setExercicios(r.exercicios);
        setRetomado(true);
      }
      prontoPraRascunho.current = true;
    })();
    return () => {
      vivo = false;
    };
    // Só no início: depois disso quem manda é o estado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Apita quando o descanso zera — uma vez por descanso.
   *
   * A marca é o próprio instante do fim: +15 muda o fim e libera um aviso novo,
   * que é o certo. Sem a marca, o bipe repetiria a cada segundo depois do zero.
   */
  useEffect(() => {
    if (descansoAte == null) return;
    if (agora < descansoAte) return;
    if (avisouRef.current === descansoAte) return;
    avisouRef.current = descansoAte;

    // NÃO APITA ATRASADO. Com a tela bloqueada o iOS congela o app: o aviso
    // só rodaria quando você voltasse, e um bipe 40 segundos depois do fim
    // não avisa nada — só assusta. Marca como avisado e fica quieto.
    if (agora - descansoAte > 5_000) return;

    tocarBip();
    void avisarDescansoAcabou();
  }, [agora, descansoAte]);

  /** Grava o rascunho a cada alteração. Substituição inteira, é barato. */
  useEffect(() => {
    if (!prontoPraRascunho.current) return;
    void salvarRascunho({ rotinaId, inicioEm: inicioRef.current, exercicios });
  }, [exercicios, rotinaId]);

  // Cronômetro por DIFERENÇA DE TIMESTAMP, não por contador incrementado: o
  // iOS congela timer com o app em background e um contador ficaria pra trás.
  // Mesmo motivo pro descanso guardar o instante final.
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  // Mantém a tela acesa durante o treino (iOS 16.4+). Falha em silêncio onde
  // não existe — é conforto, não requisito.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* negado ou sem suporte */
      }
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      lock?.release().catch(() => {});
    };
  }, []);

  const decorrido = Math.floor((agora - new Date(inicioRef.current).getTime()) / 1000);
  const restante = descansoAte ? Math.round((descansoAte - agora) / 1000) : null;

  const feitas = exercicios.reduce((n, e) => n + e.series.filter((s) => s.concluida).length, 0);
  const volumeTotal = exercicios.reduce(
    (n, e) =>
      n + e.series.filter((s) => s.concluida).reduce((v, s) => v + (volume(s.pesoKg, s.reps) ?? 0), 0),
    0,
  );

  /**
   * Peso: guarda o texto cru E o número. O texto é o que aparece; o número é o
   * que o app usa pra tudo o mais.
   */
  const alterarPeso = useCallback((exIdx: number, sIdx: number, texto: string) => {
    // Só dígito e separador. Bloqueia sinal, espaço e o que mais o teclado do
    // iOS deixar passar.
    const limpo = texto.replace(/[^0-9.,]/g, "").replace(/[.,](?=.*[.,])/g, "");
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const serie = cp[exIdx].series[sIdx];
      serie.pesoTexto = limpo;
      if (limpo === "") {
        serie.pesoKg = null;
      } else {
        const n = Number(limpo.replace(",", "."));
        // "12," não é número ainda, mas já vale 12: manter o valor antigo faria
        // o volume do treino piscar pra trás a cada tecla.
        if (Number.isFinite(n)) serie.pesoKg = n;
      }
      return cp;
    });
  }, []);

  /** Ao sair do campo, o texto some e volta a valer o número formatado. */
  const encerrarEdicaoPeso = useCallback((exIdx: number, sIdx: number) => {
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      delete cp[exIdx].series[sIdx].pesoTexto;
      return cp;
    });
  }, []);

  const alterar = useCallback(
    (exIdx: number, sIdx: number, campo: "pesoKg" | "reps", valor: number | null) => {
      setExercicios((prev) => {
        const cp = structuredClone(prev);
        const serie = cp[exIdx].series[sIdx];
        serie[campo] = valor;
        // Apagar as reps de uma série JÁ MARCADA desmarca ela. Sem isto dava
        // pra salvar série "feita" sem repetição — aconteceu, e foi parar no
        // banco com volume nulo.
        if (campo === "reps" && valor == null && serie.concluida) {
          serie.concluida = false;
          serie.registradaEm = null;
        }
        return cp;
      });
    },
    [],
  );

  /**
   * ✓ com os campos vazios commita o anterior inteiro — o "fiz igual" num toque.
   *
   * A DECISÃO DE COMEÇAR O DESCANSO É TOMADA AQUI FORA, antes do setState. O
   * corpo do updater roda depois, durante o render: variável atribuída lá
   * dentro ainda está com o valor velho na linha seguinte a esta função. Foi
   * exatamente assim que o descanso parou de disparar no ✓.
   */
  function concluir(exIdx: number, sIdx: number) {
    // Dentro do gesto: é aqui que o iOS libera o som pro bipe de daqui a dois
    // minutos. Fora de gesto, ele recusaria em silêncio.
    prepararSom();
    const exAtual = exercicios[exIdx];
    const serieAtual = exAtual?.series[sIdx];
    const antAtual =
      exAtual?.anterior[sIdx] ?? exAtual?.anterior[exAtual.anterior.length - 1];
    // Só conta como concluir se ela estava aberta E vai ter repetição — é a
    // mesma condição que o updater aplica lá embaixo.
    const vaiConcluir =
      !!serieAtual &&
      !serieAtual.concluida &&
      (serieAtual.reps ?? antAtual?.reps) != null;

    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const ex = cp[exIdx];
      const s = ex.series[sIdx];
      if (s.concluida) {
        s.concluida = false;
        s.registradaEm = null;
        return cp;
      }
      const ant = ex.anterior[sIdx] ?? ex.anterior[ex.anterior.length - 1];
      if (s.pesoKg == null) s.pesoKg = ant?.pesoKg ?? null;
      if (s.reps == null) s.reps = ant?.reps ?? null;
      if (s.reps == null) return cp; // sem reps não há série
      s.concluida = true;
      s.registradaEm = new Date().toISOString();
      return cp;
    });

    if (vaiConcluir && exAtual.descansoSeg) {
      setDescansoAte(Date.now() + exAtual.descansoSeg * 1000);
      setDescansoTotal(exAtual.descansoSeg);
    }
    navigator.vibrate?.(30);
  }

  /**
   * Tira uma série da sessão e renumera as de baixo.
   *
   * Renumerar importa: `indice` é o que casa a série com o "anterior" da
   * sessão passada, e um buraco na numeração desalinharia a coluna inteira.
   */
  function removerSerie(exIdx: number, sIdx: number) {
    setDeslize(null);
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const ex = cp[exIdx];
      if (ex.series.length <= 1) return cp; // exercício sem série nenhuma não existe
      ex.series.splice(sIdx, 1);
      ex.series.forEach((s, i) => (s.indice = i + 1));
      return cp;
    });
    navigator.vibrate?.(20);
  }

  /** −15 / +15 no descanso. Nunca deixa o fim ficar no passado por engano. */
  function ajustarDescanso(seg: number) {
    setDescansoAte((ate) => (ate == null ? ate : Math.max(Date.now(), ate + seg * 1000)));
    setDescansoTotal((t) => Math.max(15, t + seg));
  }

  /**
   * Acrescenta um exercício à sessão em andamento.
   *
   * Não toca na rotina de propósito: máquina ocupada é coisa do dia, não
   * mudança de plano. Editar a rotina é outra ação, em outra tela.
   */
  async function addExercicio(e: ExercicioLocal) {
    setSeletorAberto(false);

    // BUSCA O "ANTERIOR" (D-005). Sem isto, adicionar um exercício que você já
    // fez 61 vezes mostrava "—" no lugar da carga da última sessão — o
    // contrário do que o app existe pra fazer. O dado já está no aparelho.
    const mapa = await lerDesempenho([e.id]);
    const d = mapa.get(e.id);
    const anterior = d?.series ?? [];
    const quantasSeries = Math.max(anterior.length, 3);
    const recordePesoKg = d?.recordePesoKg ?? null;

    setExercicios((prev) => [
      ...prev,
      {
        exercicioId: e.id,
        nome: e.nome,
        modoMedicao: e.modoMedicao,
        recordePesoKg,
        seriesAlvo: quantasSeries,
        repsAlvoMin: null,
        repsAlvoMax: null,
        // Herda o descanso do exercício anterior: o padrão do treino de hoje
        // diz mais que um valor fixo.
        descansoSeg: prev[prev.length - 1]?.descansoSeg ?? 120,
        anterior,
        anteriorEm: d?.dataLocal ?? null,
        id: crypto.randomUUID(),
        notas: "",
        foraDaRotina: true,
        series: Array.from({ length: quantasSeries }, (_, i) => {
          const serie = novaSerie(i + 1);
          // Mesma regra da rotina: peso entra preenchido, reps fica placeholder.
          serie.pesoKg = anterior[i]?.pesoKg ?? anterior[anterior.length - 1]?.pesoKg ?? null;
          return serie;
        }),
      },
    ]);
  }

  function addSerie(exIdx: number) {
    setExercicios((prev) => {
      const cp = structuredClone(prev);
      const ex = cp[exIdx];
      const nova = novaSerie(ex.series.length + 1);
      nova.pesoKg = ex.series[ex.series.length - 1]?.pesoKg ?? null;
      ex.series.push(nova);
      return cp;
    });
  }

  /**
   * Grava NO APARELHO e só então tenta subir. Nunca falha por falta de rede:
   * o treino é o dado irreversível, e o requisito é a academia sem sinal
   * (D-007). O upload vira problema do Sincronizador.
   */
  /**
   * Exercícios feitos hoje que não estão na rotina. É o que a pergunta do
   * "Concluir" oferece pra incorporar ao template.
   */
  function extrasDaRotina() {
    return exercicios.filter(
      (e) => e.foraDaRotina && e.series.some((s) => s.concluida),
    );
  }

  /**
   * Exercícios cujo número de séries FEITAS hoje não bate com o que a rotina
   * pede. É o que alimenta a pergunta "vale pras próximas?" no fim.
   *
   * Só conta exercício que já é da rotina: o que entrou hoje é tratado pela
   * pergunta de inclusão, que é outra coisa.
   */
  function mudancasDeSeries() {
    if (!rotinaId) return [];
    return exercicios
      .filter((e) => !e.foraDaRotina)
      .map((e) => ({
        exercicioId: e.exercicioId,
        nome: e.nome,
        de: e.seriesAlvo,
        para: e.series.filter((s) => s.concluida).length,
      }))
      .filter((m) => m.para > 0 && m.para !== m.de);
  }

  /**
   * O "Concluir" abre a pergunta quando houver exercício fora da rotina; só
   * depois grava. Perguntar DEPOIS de salvar seria pior: o treino já teria ido
   * embora da tela e a decisão viraria abstrata.
   */
  function aoConcluir() {
    const mudou = mudancasDeSeries();
    if (mudou.length > 0 && aAjustarSeries === null) {
      setAAjustarSeries(Object.fromEntries(mudou.map((m) => [m.exercicioId, true])));
    }
    if (rotinaId && extrasDaRotina().length > 0 && aAdicionarNaRotina === null) {
      setAAdicionarNaRotina(
        Object.fromEntries(extrasDaRotina().map((e) => [e.exercicioId, true])),
      );
    }
    setPainelFim(true);
  }

  /** Campo vazio vira null — não registrar é resposta válida. */
  const numero = (t: string): number | null => {
    const v = t.trim().replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  /**
   * `inclusoes` vem por ARGUMENTO, não do estado: "Não mudar a rotina" chama
   * setState e finalizar no mesmo tique, e a closure ainda veria o valor
   * antigo — os exercícios entrariam na rotina mesmo tendo sido recusados.
   */
  async function finalizar(
    inclusoes?: Record<string, boolean>,
    ajustes?: Record<string, boolean>,
  ) {
    const escolhidos = inclusoes ?? aAdicionarNaRotina;
    const ajustesEscolhidos = ajustes ?? aAjustarSeries;
    setSalvando(true);
    setErro(null);
    const sessaoId = crypto.randomUUID();
    const payload = {
      id: sessaoId,
      nome: nomeRotina,
      inicio_em: inicioRef.current,
      fim_em: new Date().toISOString(),
      data_local: hojeLocal(),
      notas: null,
      // Lidos no relógio e digitados aqui. O Atalhos do iOS não entrega treino
      // (D-021), então este é o caminho — dois campos, uma vez por treino.
      fc_media: numero(fcMedia),
      calorias: numero(calorias),
      exercicios: exercicios.map((e, i) => ({
        id: e.id,
        exercicio_id: e.exercicioId,
        ordem: i,
        nome_snapshot: e.nome,
        modo_medicao_snapshot: e.modoMedicao,
        notas: e.notas.trim() || null,
        series: e.series.map((s) => ({
          id: s.id,
          indice: s.indice,
          tipo: "normal" as const,
          peso_kg: s.pesoKg,
          reps: s.reps,
          rpe: null,
          concluida: s.concluida,
          registrada_em: s.registradaEm ?? new Date().toISOString(),
        })),
      })),
    };

    await enfileirar({ id: sessaoId, tipo: "sessao", payload });

    // Inclusões na rotina vão pela MESMA fila: finalizar treino na academia
    // não pode depender de rede (D-007).
    if (rotinaId && escolhidos) {
      let ordem = exercicios.length;
      for (const ex of extrasDaRotina()) {
        if (!escolhidos[ex.exercicioId]) continue;
        const id = crypto.randomUUID();
        await enfileirar({
          id,
          tipo: "rotina_exercicio",
          payload: { id, rotinaId, exercicioId: ex.exercicioId, ordem: ordem++ },
        });
      }
    }
    // Mudança no número de séries da rotina — mesma fila, mesmo motivo.
    if (rotinaId && ajustesEscolhidos) {
      for (const m of mudancasDeSeries()) {
        if (!ajustesEscolhidos[m.exercicioId]) continue;
        const id = crypto.randomUUID();
        await enfileirar({
          id,
          tipo: "rotina_series",
          payload: { rotinaId, exercicioId: m.exercicioId, seriesAlvo: m.para },
        });
      }
    }

    // Dispara sem esperar: se não houver rede, fica na fila e sobe depois.
    void sincronizar();
    await limparRascunho();
    router.push("/");
    router.refresh();
  }

  /** Descarta o treino em andamento. Nada foi gravado ainda — só o rascunho. */
  async function descartar() {
    await limparRascunho();
    router.push(rotinaId ? `/rotinas/${rotinaId}` : "/rotinas");
  }

  return (
    <main className="flex-1 flex flex-col pb-safe">
      <header className="pt-safe sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setConfirmandoDescarte(true)}
            aria-label="descartar treino"
            className="size-9 -ml-2 shrink-0 grid place-items-center text-muted text-xl leading-none"
          >
            ×
          </button>
          <h1 className="text-lg font-medium truncate flex-1">{nomeRotina ?? "Treino livre"}</h1>
          <button
            onClick={aoConcluir}
            disabled={salvando || feitas === 0}
            className="shrink-0 rounded-full bg-accent text-black font-semibold px-5 py-2 text-sm disabled:opacity-30"
          >
            {salvando ? "…" : "Concluir"}
          </button>
        </div>

        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            ["Duração", mmss(decorrido)],
            ["Volume", `${Math.round(volumeTotal).toLocaleString("pt-BR")} kg`],
            ["Séries", String(feitas)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
              <p className="text-base tabular-nums">{valor}</p>
            </div>
          ))}
        </div>
      </header>

      {retomado && (
        <p className="mx-4 mt-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-[11px] text-accent">
          Treino retomado de onde você parou.
        </p>
      )}

      <div className="flex-1 px-4 py-4 flex flex-col gap-7">
        {exercicios.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">Treino vazio.</p>
            <button
              onClick={() => setSeletorAberto(true)}
              className="mt-4 rounded-2xl bg-accent text-black font-semibold px-6 py-4 text-sm"
            >
              ＋ Adicionar exercício
            </button>
          </div>
        )}

        {exercicios.map((ex, exIdx) => (
          <section key={ex.id}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium text-accent">{ex.nome}</h2>
              {ex.anteriorEm && (
                <span className="text-[11px] text-muted shrink-0">{haQuantoTempo(ex.anteriorEm)}</span>
              )}
            </div>

            <input
              value={ex.notas}
              placeholder="Adicione notas aqui…"
              onChange={(e) =>
                setExercicios((prev) => {
                  const cp = structuredClone(prev);
                  cp[exIdx].notas = e.target.value;
                  return cp;
                })
              }
              className="mt-1 w-full bg-transparent text-xs text-muted outline-none placeholder:text-muted/60"
            />

            <p className="mt-1 text-[11px] text-muted">
              ⏱ Descanso: {formatDescanso(ex.descansoSeg)}
            </p>

            <div className="mt-2 grid grid-cols-[1.6rem_4.2rem_1fr_1fr_2.75rem] gap-2 text-[10px] uppercase tracking-wide text-muted">
              <span className="text-center">Sér</span>
              <span>Anterior</span>
              <span className="text-center">Kg</span>
              <span className="text-center">Reps</span>
              <span />
            </div>

            <div className="mt-1 flex flex-col gap-1.5">
              {ex.series.map((s, sIdx) => {
                const ant = ex.anterior[sIdx];
                const est = e1rm(s.pesoKg, s.reps);
                const bateu = ant?.e1rm != null && est != null && est > ant.e1rm;
                // RECORDE é contra o histórico inteiro, não contra a última
                // sessão: superar o treino passado é rotina, superar tudo o que
                // você já levantou é o que merece medalha.
                const recorde =
                  s.concluida &&
                  s.pesoKg != null &&
                  ex.recordePesoKg != null &&
                  s.pesoKg > ex.recordePesoKg;
                const dx = deslize?.id === s.id ? deslize.dx : 0;
                return (
                  <div key={s.id} className="relative">
                    {/* Fundo que aparece conforme a linha sai da frente. */}
                    <div
                      className="absolute inset-0 rounded-lg bg-red-500/25 flex items-center justify-end pr-3 text-xs font-medium text-red-200"
                      style={{ opacity: Math.min(1, Math.abs(dx) / 80) }}
                      aria-hidden
                    >
                      Excluir
                    </div>

                    <div
                      onTouchStart={(e) => {
                        toqueRef.current = {
                          id: s.id,
                          x: e.touches[0].clientX,
                          y: e.touches[0].clientY,
                          horizontal: null,
                        };
                      }}
                      onTouchMove={(e) => {
                        const t = toqueRef.current;
                        if (!t || t.id !== s.id) return;
                        const ddx = e.touches[0].clientX - t.x;
                        const ddy = e.touches[0].clientY - t.y;
                        // Decide UMA vez se o dedo está indo pro lado ou pra
                        // baixo. Sem esse trava, rolar a tela arrastaria linhas.
                        if (t.horizontal === null) {
                          if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
                          t.horizontal = Math.abs(ddx) > Math.abs(ddy);
                        }
                        if (!t.horizontal) return;
                        setDeslize({ id: s.id, dx: Math.min(0, ddx) });
                      }}
                      onTouchEnd={() => {
                        const t = toqueRef.current;
                        toqueRef.current = null;
                        if (!t?.horizontal) return;
                        // Limiar alto de propósito: mão suada encosta na tela.
                        if (dx < -90) removerSerie(exIdx, sIdx);
                        else setDeslize(null);
                      }}
                      style={{
                        transform: `translateX(${dx}px)`,
                        transition: deslize?.id === s.id ? "none" : "transform .15s",
                      }}
                      className={`relative grid grid-cols-[1.6rem_4.2rem_1fr_1fr_2.75rem] gap-2 items-center rounded-lg ${
                        s.concluida
                          ? recorde
                            ? "bg-amber-400/15 -mx-1 px-1"
                            : "bg-accent/10 -mx-1 px-1"
                          : "bg-background"
                      }`}
                    >
                    <span className="text-center text-xs text-muted tabular-nums">
                      {recorde ? <span aria-label="recorde">🏅</span> : s.indice}
                    </span>

                    {/* O "anterior" — a informação mais importante da tela. */}
                    <span className="text-[11px] text-muted tabular-nums">
                      {ant ? `${formatPeso(ant.pesoKg)}kg × ${ant.reps}` : "—"}
                    </span>

                    <input
                      inputMode="decimal"
                      placeholder={ant ? formatPeso(ant.pesoKg) : "kg"}
                      value={s.pesoTexto ?? (s.pesoKg ?? "")}
                      onChange={(e) => alterarPeso(exIdx, sIdx, e.target.value)}
                      onBlur={() => encerrarEdicaoPeso(exIdx, sIdx)}
                      className="min-w-0 rounded-lg bg-card border border-border px-1 py-3 text-center tabular-nums outline-none focus:border-accent"
                    />
                    <input
                      inputMode="numeric"
                      // Placeholder = faixa alvo da rotina, igual ao Hevy.
                      placeholder={
                        ex.repsAlvoMin && ex.repsAlvoMax
                          ? `${ex.repsAlvoMin}-${ex.repsAlvoMax}`
                          : ant?.reps != null
                            ? String(ant.reps)
                            : "reps"
                      }
                      value={s.reps ?? ""}
                      onChange={(e) =>
                        alterar(exIdx, sIdx, "reps", e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="min-w-0 rounded-lg bg-card border border-border px-1 py-3 text-center tabular-nums outline-none focus:border-accent"
                    />

                    {/* 44×44pt — mínimo da HIG da Apple, com a mão suada. */}
                    <button
                      onClick={() => concluir(exIdx, sIdx)}
                      aria-label={s.concluida ? "desmarcar série" : "concluir série"}
                      className={`size-11 shrink-0 rounded-lg border text-lg ${
                        s.concluida
                          ? recorde || bateu
                            ? "bg-accent text-black border-accent font-bold"
                            : "bg-accent/80 text-black border-accent/80"
                          : "bg-card border-border text-muted"
                      }`}
                    >
                      ✓
                    </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => addSerie(exIdx)}
              className="mt-2 w-full rounded-lg border border-dashed border-border py-2.5 text-xs text-muted"
            >
              + Adicionar série
            </button>
          </section>
        ))}

        {exercicios.length > 0 && (
          <button
            onClick={() => setSeletorAberto(true)}
            className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted"
          >
            ＋ Adicionar exercício
          </button>
        )}
      </div>

      {/* Fim do treino: métricas do relógio e, se houver, a pergunta da rotina. */}
      {painelFim && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col pt-safe pb-safe">
          <div className="flex-1 overflow-y-auto px-4 pt-8">
            <h2 className="text-xl font-semibold tracking-tight">Treino concluído</h2>
            <p className="mt-2 text-sm text-muted">
              {feitas} {feitas === 1 ? "série" : "séries"} em {mmss(decorrido)}.
            </p>

            <section className="mt-5">
              <h3 className="text-[10px] uppercase tracking-wide text-muted">
                Do relógio — opcional
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted" htmlFor="fc-media">
                    Batimentos médios
                  </label>
                  <input
                    id="fc-media"
                    inputMode="numeric"
                    placeholder="bpm"
                    value={fcMedia}
                    onChange={(e) => setFcMedia(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-4 text-center text-lg tabular-nums outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted" htmlFor="calorias">
                    Calorias
                  </label>
                  <input
                    id="calorias"
                    inputMode="numeric"
                    placeholder="kcal"
                    value={calorias}
                    onChange={(e) => setCalorias(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-card border border-border px-3 py-4 text-center text-lg tabular-nums outline-none focus:border-accent"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Está no resumo do treino no relógio. Em branco também está bom.
              </p>
            </section>

            {aAjustarSeries !== null && mudancasDeSeries().length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold tracking-tight">
                  Mudou o número de séries
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Marque o que deve valer também nos próximos treinos desta rotina.
                </p>
                <ul className="mt-4 flex flex-col gap-2">
                  {mudancasDeSeries().map((m) => {
                    const marcado = aAjustarSeries[m.exercicioId];
                    return (
                      <li key={m.exercicioId}>
                        <button
                          onClick={() =>
                            setAAjustarSeries((prev) => ({
                              ...prev!,
                              [m.exercicioId]: !marcado,
                            }))
                          }
                          aria-pressed={marcado}
                          className={`w-full rounded-2xl border p-4 flex items-center gap-3 text-left ${
                            marcado ? "bg-card border-accent" : "bg-card border-border"
                          }`}
                        >
                          <span
                            className={`size-6 shrink-0 rounded-md border grid place-items-center text-sm ${
                              marcado
                                ? "bg-accent border-accent text-black"
                                : "border-border text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{m.nome}</span>
                            <span className="block text-[11px] text-muted tabular-nums">
                              {m.de} → {m.para} {m.para === 1 ? "série" : "séries"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {aAdicionarNaRotina !== null && (
            <>
            <h2 className="mt-8 text-xl font-semibold tracking-tight">Atualizar a rotina?</h2>
            <p className="mt-2 text-sm text-muted">
              {extrasDaRotina().length === 1 ? "Este exercício não estava" : "Estes exercícios não estavam"}{" "}
              em <span className="text-foreground">{nomeRotina}</span>. Marque o que deve passar a
              fazer parte dela.
            </p>

            <ul className="mt-5 flex flex-col gap-2">
              {extrasDaRotina().map((ex) => {
                const marcado = aAdicionarNaRotina[ex.exercicioId];
                return (
                  <li key={ex.exercicioId}>
                    <button
                      onClick={() =>
                        setAAdicionarNaRotina((prev) => ({
                          ...prev!,
                          [ex.exercicioId]: !marcado,
                        }))
                      }
                      aria-pressed={marcado}
                      className={`w-full rounded-2xl border p-4 flex items-center gap-3 text-left ${
                        marcado ? "bg-card border-accent" : "bg-card border-border"
                      }`}
                    >
                      <span
                        className={`size-6 shrink-0 rounded-md border grid place-items-center text-sm ${
                          marcado
                            ? "bg-accent border-accent text-black"
                            : "border-border text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{ex.nome}</span>
                        <span className="block text-[11px] text-muted">
                          {ex.series.filter((s) => s.concluida).length} séries hoje
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 text-[11px] text-muted">
              O que você desmarcar continua salvo no treino de hoje — só não entra
              na rotina.
            </p>
            </>
            )}
          </div>

          <div className="px-4 pt-2 border-t border-border flex flex-col gap-2">
            <button
              onClick={() => void finalizar()}
              disabled={salvando}
              className="w-full rounded-2xl bg-accent text-black font-semibold py-5 text-base disabled:opacity-40"
            >
              {salvando ? "salvando…" : "Salvar treino"}
            </button>
            {aAdicionarNaRotina !== null || aAjustarSeries !== null ? (
              <button
                // Passa {} direto: depender do setState acima faria a closure
                // ver o valor antigo e adicionar o que você acabou de recusar.
                onClick={() => void finalizar({}, {})}
                disabled={salvando}
                className="w-full py-3 text-center text-sm text-muted"
              >
                Salvar sem mexer na rotina
              </button>
            ) : (
              <button
                onClick={() => setPainelFim(false)}
                disabled={salvando}
                className="w-full py-3 text-center text-sm text-muted"
              >
                Voltar ao treino
              </button>
            )}
          </div>
        </div>
      )}

      {confirmandoDescarte && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-medium">Descartar este treino?</h2>
            <p className="mt-2 text-sm text-muted">
              {feitas > 0
                ? `${feitas} ${feitas === 1 ? "série já marcada" : "séries já marcadas"} some${feitas === 1 ? "" : "m"} pra sempre. Nada foi salvo ainda.`
                : "Nada foi marcado ainda."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => setConfirmandoDescarte(false)}
                className="w-full rounded-xl bg-accent text-black font-semibold py-4 text-sm"
              >
                Continuar treinando
              </button>
              <button
                onClick={() => void descartar()}
                className="w-full rounded-xl border border-border py-4 text-sm text-red-400"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {seletorAberto && (
        <SeletorExercicio
          aoEscolher={addExercicio}
          aoFechar={() => setSeletorAberto(false)}
          jaNaSessao={exercicios.map((e) => e.exercicioId)}
        />
      )}

      {erro && <p className="px-4 pb-2 text-sm text-red-400">{erro}</p>}

      {/* Descanso, na zona do polegar. O número é o maior elemento da tela
          enquanto corre: é ele que você olha de longe, apoiado no aparelho. */}
      {restante !== null && restante > -3 && (
        <div className="sticky bottom-0 pb-safe bg-background/95 backdrop-blur border-t border-border">
          {/* Barra do que já passou. `descansoTotal` guarda a duração cheia
              porque +15 muda o fim e a barra precisa de uma referência. */}
          <div className="h-1 w-full bg-border">
            <div
              className="h-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{
                width: `${Math.max(0, Math.min(100, (1 - restante / Math.max(descansoTotal, 1)) * 100))}%`,
              }}
            />
          </div>

          <div className="px-4 pt-2 pb-2">
            <p
              className={`text-center text-5xl tabular-nums font-medium ${
                restante <= 0 ? "text-accent" : ""
              }`}
            >
              {restante <= 0 ? "acabou" : mmss(restante)}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                onClick={() => ajustarDescanso(-15)}
                className="rounded-xl bg-card border border-border py-3.5 text-sm tabular-nums"
              >
                −15
              </button>
              <button
                onClick={() => ajustarDescanso(15)}
                className="rounded-xl bg-card border border-border py-3.5 text-sm tabular-nums"
              >
                +15
              </button>
              <button
                onClick={() => setDescansoAte(null)}
                className="rounded-xl bg-accent text-black font-medium py-3.5 text-sm"
              >
                Pular
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
