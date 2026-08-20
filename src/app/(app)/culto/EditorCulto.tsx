'use client';

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import { idDoCulto, type Bloco, type Culto, type ModeloCulto } from '@/lib/culto';

/** Distância (px) que o dedo pode se mover antes do timer de long-press
 * completar. Passou disso = é scroll, não intenção de arrastar — cancela o
 * timer e deixa o gesto seguir normalmente para a página. */
const LIMIAR_MOVIMENTO_PX = 10;
/** Duração do long-press que ativa o modo arrastar no touch. */
const DURACAO_LONG_PRESS_MS = 500;

/** Estado do bloco sendo arrastado livremente pelo cursor/dedo. Guardado em
 * state (não só em ref) porque alimenta o render: posição, dimensões
 * originais (pra manter o placeholder do mesmo tamanho) e o deslocamento do
 * ponto de toque em relação ao canto do bloco (pra não "saltar" pro cursor
 * ao começar a arrastar). */
interface EstadoArrasto {
  id: string;
  largura: number;
  altura: number;
  /** Posição atual do canto superior-esquerdo do bloco, em coordenadas de
   * viewport — já descontado o deslocamento do ponto de toque. */
  x: number;
  y: number;
  /** Onde dentro do bloco o cursor/dedo pegou, pra manter esse ponto fixo
   * sob o cursor durante o arrasto. */
  deslocX: number;
  deslocY: number;
}

interface Props {
  /** null quando é uma ordem nova. */
  culto: Culto | null;
  /** Ids (`data__hora`) que já têm ordem — para avisar antes de sobrescrever sem querer. */
  idsOcupados: string[];
  /** Blocos pré-preenchidos ao abrir (vindos de "Duplicar" na lista). null = editor em branco/existente. */
  blocosIniciais?: Bloco[] | null;
  onSalvar: (
    data: string,
    hora: string,
    blocos: Bloco[],
    idAnterior?: string,
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
  onVoltar: () => void;
}

function proximoDomingo(): string {
  const hoje = new Date();
  const diasAteDomingo = (7 - hoje.getDay()) % 7 || 7;
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + diasAteDomingo);
  const mes = String(alvo.getMonth() + 1).padStart(2, '0');
  const dia = String(alvo.getDate()).padStart(2, '0');
  return `${alvo.getFullYear()}-${mes}-${dia}`;
}

function novoBloco(): Bloco {
  return { id: crypto.randomUUID(), titulo: '', minutos: 10 };
}

/**
 * Modo de montagem: quem prepara na semana. Reordena os blocos por
 * posicionamento livre — o bloco arrastado sai do fluxo e segue o
 * cursor/dedo em tempo real (`transform: translate`), os demais deslizam
 * pra abrir espaço via FLIP (First Last Invert Play: mede a posição antes
 * da troca, deixa o DOM já na posição nova, e anima a diferença de volta a
 * zero com uma transition de `transform`). Sem biblioteca — só mouse/touch
 * nativos + CSS.
 *
 * Mouse e touch convergem pro MESMO motor de arrasto (`iniciarArrasto` +
 * `moverArrasto` + `soltarArrasto`); só a forma de ATIVAR difere:
 *
 * - Mouse: `onMouseDown` no bloco já inicia o arrasto — não existe o
 *   problema de "scroll acidental" que o touch tem, então não precisa de
 *   long-press nem de alça separada.
 * - Touch: precisa do long-press de ~500ms que já existia, com o mesmo
 *   limiar de cancelamento por movimento — sem isso, um scroll vertical
 *   comum na lista viraria um drag sem querer.
 *
 * O bloco inteiro é a área de arrasto (sem alça `⠿` e sem setinhas ▲▼, que
 * o usuário pediu pra tirar de vez) — `onMouseDown`/`onTouchStart` ignoram o
 * gesto quando o alvo está dentro de um input ou do botão de remover, então
 * editar título/minutos continua funcionando normalmente.
 */
export function EditorCulto({ culto, idsOcupados, blocosIniciais, onSalvar, onVoltar }: Props) {
  const [data, setData] = useState(culto?.data ?? proximoDomingo());
  const [hora, setHora] = useState(culto?.hora ?? '09:00');
  const [blocos, setBlocos] = useState<Bloco[]>(
    culto?.blocos.length ? culto.blocos : blocosIniciais?.length ? blocosIniciais : [novoBloco()],
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // --- Arrastar-e-soltar (posicionamento livre, mouse + touch) ---
  const [arrasto, setArrasto] = useState<EstadoArrasto | null>(null);
  const refsBlocos = useRef(new Map<string, HTMLLIElement>());
  const refLista = useRef<HTMLUListElement>(null);
  // Id do bloco em arrasto, espelhado num ref: os handlers de `mousemove`/
  // `touchmove` disparam muitas vezes por segundo e precisam ler o id
  // corrente sem depender do valor capturado no fechamento de quando o
  // listener foi registrado (senão fica um id "congelado").
  const idArrastoRef = useRef<string | null>(null);
  // Espelha `blocos` pelo mesmo motivo: `moverArrasto` é registrado uma vez
  // por arrasto (no `useEffect` do mouse) e não pode ler uma ordem antiga.
  const blocosRef = useRef<Bloco[]>(blocos);
  useEffect(() => {
    blocosRef.current = blocos;
  }, [blocos]);

  // --- Arrastar (touch): long-press antes de ativar o motor acima ---
  const [idArmandoTouch, setIdArmandoTouch] = useState<string | null>(null);
  const timerLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origemToqueRef = useRef<{ x: number; y: number } | null>(null);

  const [modelos, setModelos] = useState<ModeloCulto[] | null>(null);
  const [mostrarModelos, setMostrarModelos] = useState(false);
  const [nomeModelo, setNomeModelo] = useState('');
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [modeloSalvo, setModeloSalvo] = useState(false);

  useEffect(() => {
    if (!mostrarModelos || modelos !== null) return;
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch('/api/culto/modelos', { headers: cabecalho });
      if (!resp.ok) return;
      const corpo = (await resp.json()) as { modelos?: ModeloCulto[] };
      setModelos(corpo.modelos ?? []);
    })();
  }, [mostrarModelos, modelos]);

  // Evita disparar o timer de long-press depois que o componente já saiu
  // da árvore (ex: usuário navega enquanto o dedo ainda está pressionado).
  useEffect(() => {
    return () => {
      if (timerLongPressRef.current) clearTimeout(timerLongPressRef.current);
    };
  }, []);

  function atualizarBloco(id: string, campo: 'titulo' | 'minutos', valor: string) {
    setSalvo(false);
    setBlocos((atuais) =>
      atuais.map((b) =>
        b.id === id
          ? { ...b, [campo]: campo === 'minutos' ? Number(valor) || 0 : valor }
          : b,
      ),
    );
  }

  // --- Motor de arrasto (posicionamento livre, mouse + touch) ---

  /** Aplica a técnica FLIP aos blocos que NÃO são o arrastado: mede a
   * posição de cada `<li>` antes da troca (`antes`), aplica a nova ordem em
   * `blocos` (o que já reposiciona o DOM na renderização seguinte), e então
   * — via rAF, depois do DOM assentar — calcula a diferença entre onde cada
   * bloco estava e onde ficou, aplica essa diferença como `transform` sem
   * transition (parece que não se moveu) e, no frame seguinte, remove o
   * transform COM transition (anima até 0). É o que dá a sensação de "os
   * outros blocos abrindo espaço". */
  function animarComFlip(idArrastadoId: string, novaOrdem: Bloco[]) {
    const antes = new Map<string, DOMRect>();
    refsBlocos.current.forEach((el, id) => {
      if (id !== idArrastadoId) antes.set(id, el.getBoundingClientRect());
    });

    setBlocos(novaOrdem);

    requestAnimationFrame(() => {
      refsBlocos.current.forEach((el, id) => {
        if (id === idArrastadoId) return;
        const rectAntes = antes.get(id);
        if (!rectAntes) return;
        const rectDepois = el.getBoundingClientRect();
        const deltaY = rectAntes.top - rectDepois.top;
        if (deltaY === 0) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${deltaY}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.2s ease';
          el.style.transform = '';
        });
      });
    });
  }

  /** Ponto em comum entre início por mouse e por long-press touch: mede o
   * bloco e liga o motor de arrasto. Os listeners de movimento/soltura são
   * globais (`window`, no `useEffect` abaixo) porque o dedo/cursor sai do
   * `<li>` de origem assim que o gesto começa — um listener só no elemento
   * perderia o gesto no primeiro movimento. */
  function iniciarArrasto(id: string, clienteX: number, clienteY: number) {
    const el = refsBlocos.current.get(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    idArrastoRef.current = id;
    setArrasto({
      id,
      largura: rect.width,
      altura: rect.height,
      x: rect.left,
      y: rect.top,
      deslocX: clienteX - rect.left,
      deslocY: clienteY - rect.top,
    });
    if (typeof navigator.vibrate === 'function') navigator.vibrate(15);
  }

  /** Atualiza a posição do bloco arrastado e, se o cursor/dedo cruzou o
   * centro vertical de um vizinho, reordena — só nesse cruzamento, não a
   * cada pixel, senão a lista treme com micro-movimentos. Usa `blocosRef`
   * (não a variável `blocos` do closure) porque este handler é registrado
   * uma vez por arrasto e precisa sempre ler a ordem mais recente. */
  function moverArrasto(clienteX: number, clienteY: number) {
    const idAtual = idArrastoRef.current;
    if (!idAtual) return;

    setArrasto((atual) => {
      if (!atual) return atual;
      return { ...atual, x: clienteX - atual.deslocX, y: clienteY - atual.deslocY };
    });

    const atuais = blocosRef.current;
    const indiceOrigem = atuais.findIndex((b) => b.id === idAtual);
    if (indiceOrigem === -1) return;

    // Índice de destino: a posição, entre os blocos que NÃO são o
    // arrastado, cujo centro vertical o cursor/dedo já ultrapassou.
    let indiceAlvo = atuais.length - 1;
    for (let i = 0; i < atuais.length; i++) {
      if (atuais[i].id === idAtual) continue;
      const el = refsBlocos.current.get(atuais[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clienteY < rect.top + rect.height / 2) {
        indiceAlvo = i;
        break;
      }
    }
    if (indiceAlvo === indiceOrigem) return;

    const copia = [...atuais];
    const [movido] = copia.splice(indiceOrigem, 1);
    // `indiceAlvo` foi calculado sobre a lista com o item de origem ainda
    // presente; ao removê-lo antes de inserir, todo destino que vinha
    // depois da origem "recua" uma posição.
    const destino = indiceAlvo > indiceOrigem ? indiceAlvo - 1 : indiceAlvo;
    copia.splice(destino, 0, movido);

    animarComFlip(idAtual, copia);
    setSalvo(false);
  }

  function soltarArrasto() {
    setArrasto(null);
    idArrastoRef.current = null;
  }

  // --- Ativação por mouse ---

  function ehAreaDeEdicao(alvo: EventTarget | null): boolean {
    if (!(alvo instanceof HTMLElement)) return false;
    return alvo.closest('input, button') != null;
  }

  function aoPressionarMouse(e: MouseEvent<HTMLLIElement>, id: string) {
    if (e.button !== 0 || ehAreaDeEdicao(e.target)) return;
    e.preventDefault();
    iniciarArrasto(id, e.clientX, e.clientY);
  }

  // --- Ativação por touch: long-press antes de ligar o motor acima ---

  /** Desfaz o `touch-action: none` aplicado direto no DOM em `aoTocarBloco`
   *  — sem isto, um bloco cujo long-press foi cancelado (virou scroll) ou
   *  que já foi solto ficaria travado sem rolar a lista nunca mais. */
  function liberarTouchAction(id: string | null) {
    if (!id) return;
    const el = refsBlocos.current.get(id);
    if (el) el.style.touchAction = '';
  }

  function limparLongPress() {
    if (timerLongPressRef.current) {
      clearTimeout(timerLongPressRef.current);
      timerLongPressRef.current = null;
    }
    origemToqueRef.current = null;
  }

  function aoTocarBloco(e: TouchEvent<HTMLLIElement>, id: string) {
    if (ehAreaDeEdicao(e.target)) return;
    const toque = e.touches[0];
    origemToqueRef.current = { x: toque.clientX, y: toque.clientY };
    // Aplicado direto no DOM, não via `style` no JSX: o navegador decide se
    // o gesto é scroll ou não na thread de composição, antes do próximo
    // render do React acontecer — esperar o `setState` de `idArmandoTouch`
    // chegar tarde demais para essa decisão. Precisa estar em vigor desde
    // este exato toque, não só quando o long-press completar.
    e.currentTarget.style.touchAction = 'none';
    timerLongPressRef.current = setTimeout(() => {
      setIdArmandoTouch(null);
      iniciarArrasto(id, toque.clientX, toque.clientY);
    }, DURACAO_LONG_PRESS_MS);
    setIdArmandoTouch(id);
  }

  function aoMoverToqueBloco(e: globalThis.TouchEvent) {
    const toque = e.touches[0];
    // Ainda no período de espera do long-press: se o dedo já se moveu além
    // do limiar, é scroll — cancela o timer e libera o gesto para a página.
    if (timerLongPressRef.current && origemToqueRef.current) {
      const dx = toque.clientX - origemToqueRef.current.x;
      const dy = toque.clientY - origemToqueRef.current.y;
      if (Math.hypot(dx, dy) > LIMIAR_MOVIMENTO_PX) {
        limparLongPress();
        liberarTouchAction(idArmandoTouch);
        setIdArmandoTouch(null);
      }
      return;
    }

    // Long-press já ativou o arrasto: segue o motor comum, e impede o
    // scroll da página enquanto o gesto está em andamento. `preventDefault`
    // só tem efeito porque este listener foi registrado manualmente com
    // `{ passive: false }` (ver useEffect abaixo) — o React sempre prende
    // `onTouchMove` do JSX como passivo, e nesse modo o navegador ignora
    // preventDefault e rola a página de qualquer forma.
    if (idArrastoRef.current) {
      e.preventDefault();
      moverArrasto(toque.clientX, toque.clientY);
    }
  }

  function aoSoltarToqueBloco() {
    limparLongPress();
    liberarTouchAction(idArmandoTouch ?? arrasto?.id ?? null);
    setIdArmandoTouch(null);
    if (arrasto) soltarArrasto();
  }

  // `touchmove` precisa ser registrado à mão (não via `onTouchMove` do JSX)
  // porque o React sempre prende esse listener como passivo — nesse modo o
  // navegador ignora `preventDefault` e a página rola junto com o dedo
  // mesmo depois do long-press ativar o arrasto. Reatribuído a cada render
  // (barato — é só addEventListener) para sempre chamar a versão atual da
  // função, sem precisar espelhar mais estado em ref.
  useEffect(() => {
    const el = refLista.current;
    if (!el) return;
    el.addEventListener('touchmove', aoMoverToqueBloco, { passive: false });
    return () => el.removeEventListener('touchmove', aoMoverToqueBloco);
  });

  // Listeners globais do arrasto por MOUSE: precisam ficar no `window`
  // porque o cursor sai do `<li>` de origem assim que o gesto começa.
  useEffect(() => {
    if (!arrasto) return;
    function aoMover(e: globalThis.MouseEvent) {
      moverArrasto(e.clientX, e.clientY);
    }
    function aoSoltar() {
      soltarArrasto();
    }
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);
    return () => {
      window.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrasto?.id]);

  function removerBloco(id: string) {
    setSalvo(false);
    setBlocos((atuais) => atuais.filter((b) => b.id !== id));
  }

  function usarModelo(modelo: ModeloCulto) {
    setBlocos(modelo.blocos.map((b) => ({ ...b, id: crypto.randomUUID() })));
    setSalvo(false);
    setMostrarModelos(false);
  }

  async function salvarComoModelo() {
    const nome = nomeModelo.trim();
    const preenchidos = blocos.map((b) => ({ ...b, titulo: b.titulo.trim() })).filter((b) => b.titulo);
    if (!nome || preenchidos.length === 0) return;

    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;

    setSalvandoModelo(true);
    const resp = await fetch('/api/culto/modelos', {
      method: 'POST',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, blocos: preenchidos }),
    });
    setSalvandoModelo(false);

    if (resp.ok) {
      setNomeModelo('');
      setModeloSalvo(true);
      setModelos(null); // força recarregar na próxima vez que abrir a lista
    }
  }

  async function salvar() {
    const preenchidos = blocos
      .map((b) => ({ ...b, titulo: b.titulo.trim() }))
      .filter((b) => b.titulo);

    if (preenchidos.length === 0) {
      setErro('Adicione ao menos um bloco com título.');
      return;
    }

    setErro(null);
    setSalvando(true);
    // `culto.id` vai junto para o servidor saber que é uma ordem existente
    // mudando de data/hora — nesse caso ele move, em vez de deixar a antiga
    // para trás.
    const resultado = await onSalvar(data, hora, preenchidos, culto?.id);
    setSalvando(false);

    if (resultado.ok) {
      setBlocos(preenchidos);
      setSalvo(true);
    } else {
      setErro(resultado.erro);
    }
  }

  const totalMinutos = blocos.reduce((soma, b) => soma + (b.minutos || 0), 0);
  const emAndamento = culto?.blocoAtualId != null;
  // Só é conflito se a data+hora escolhida for de OUTRA ordem: reeditar o
  // próprio horário da ordem aberta é o comportamento normal, não uma
  // sobrescrita.
  const idEscolhido = idDoCulto(data, hora);
  const conflitaComOutra = idsOcupados.includes(idEscolhido) && idEscolhido !== culto?.id;

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <button
        type="button"
        onClick={onVoltar}
        className="text-sm text-texto-suave hover:text-texto"
      >
        ← Todas as ordens
      </button>

      <div className="mt-3">
        <CabecalhoDaTela
          titulo={culto ? 'Editar ordem' : 'Nova ordem'}
          instrucao="Monte a sequência. Quem estiver no domingo vê isto se atualizar sozinho."
        />
      </div>

      {!culto && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setMostrarModelos((v) => !v)}
            className="h-10 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
          >
            Começar de um modelo
          </button>
        </div>
      )}

      {mostrarModelos && (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-borda bg-fundo-elevado p-4">
          {modelos === null && (
            <p className="text-sm text-texto-fraco">Carregando modelos…</p>
          )}
          {modelos !== null && modelos.length === 0 && (
            <p className="text-sm text-texto-fraco">
              Nenhum modelo salvo ainda. Monte uma ordem e use &quot;Salvar
              como modelo&quot; para criar o primeiro.
            </p>
          )}
          {modelos !== null && modelos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {modelos.map((modelo) => (
                <li key={modelo.id}>
                  <button
                    type="button"
                    onClick={() => usarModelo(modelo)}
                    className="w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2 text-left text-sm text-texto hover:border-borda-forte"
                  >
                    <span className="font-medium">{modelo.nome}</span>
                    <span className="ml-2 text-xs text-texto-fraco">
                      {modelo.blocos.length === 1
                        ? '1 bloco'
                        : `${modelo.blocos.length} blocos`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {emAndamento && (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--urgente)', color: 'var(--urgente)' }}>
          O culto está em andamento. Salvar aqui reinicia a execução do
          início.
        </div>
      )}

      {conflitaComOutra && (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--urgente)', color: 'var(--urgente)' }}>
          Já existe uma ordem nesta data e horário. Salvar substitui a que
          está lá.
        </div>
      )}

      <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="data" className="mb-1.5 block text-sm text-texto-suave">
              Data
            </label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                setSalvo(false);
              }}
              className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
            />
          </div>

          <div className="w-full sm:w-36">
            <label htmlFor="hora" className="mb-1.5 block text-sm text-texto-suave">
              Horário
            </label>
            <input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => {
                setHora(e.target.value);
                setSalvo(false);
              }}
              className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-texto-suave">Blocos</span>
          <span className="text-xs text-texto-fraco">{totalMinutos} min ao todo</span>
        </div>

        <ul ref={refLista} className="relative mt-2 flex flex-col gap-2">
          {blocos.map((bloco) => {
            const estaArrastando = arrasto?.id === bloco.id;
            const estaArmandoTouch = idArmandoTouch === bloco.id;

            return (
              <li
                key={bloco.id}
                ref={(el) => {
                  if (el) refsBlocos.current.set(bloco.id, el);
                  else refsBlocos.current.delete(bloco.id);
                }}
                aria-grabbed={estaArrastando}
                aria-roledescription="item reordenável por arrastar"
                // O bloco arrastado vira só um "buraco" no lugar de onde
                // saiu (opacidade baixa) — quem representa ele visualmente
                // agora é o clone fixo renderizado depois da lista.
                className={`flex items-center gap-2 rounded-xl border bg-fundo-cartao px-3 py-2 select-none ${
                  estaArrastando ? 'border-borda opacity-30' : 'border-borda'
                } ${estaArmandoTouch ? 'border-[var(--acento)]' : ''}`}
                onMouseDown={(e) => aoPressionarMouse(e, bloco.id)}
                // Long-press do bloco inteiro (touch): o timer só ativa o
                // modo arrastar depois de ~500ms parado, então tocar um
                // campo de texto/número para editar continua funcionando
                // normalmente — o toque termina (onTouchEnd) bem antes
                // disso e só cancela o timer, sem efeito colateral.
                onTouchStart={(e) => aoTocarBloco(e, bloco.id)}
                onTouchEnd={aoSoltarToqueBloco}
              >
                <span aria-hidden="true" className="cursor-grab px-0.5 text-texto-fraco active:cursor-grabbing">
                  ⠿
                </span>

                <input
                  value={bloco.titulo}
                  onChange={(e) => atualizarBloco(bloco.id, 'titulo', e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Ex: Louvor"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-texto placeholder:text-texto-fraco focus:outline-none"
                />

                <input
                  type="number"
                  min={0}
                  value={bloco.minutos}
                  onChange={(e) => atualizarBloco(bloco.id, 'minutos', e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Minutos"
                  className="w-14 rounded-lg border border-borda bg-fundo px-2 py-1 text-right text-sm text-texto"
                />
                <span className="text-xs text-texto-fraco">min</span>

                <button
                  type="button"
                  onClick={() => removerBloco(bloco.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Remover bloco"
                  className="text-texto-fraco hover:text-texto"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>

        {arrasto && (() => {
          const bloco = blocos.find((b) => b.id === arrasto.id);
          if (!bloco) return null;
          return (
            <div
              aria-hidden="true"
              className="fixed z-50 flex items-center gap-2 rounded-xl border bg-fundo-cartao px-3 py-2.5 shadow-lg"
              style={{
                left: 0,
                top: 0,
                width: arrasto.largura,
                height: arrasto.altura,
                borderColor: 'var(--acento)',
                transform: `translate(${arrasto.x}px, ${arrasto.y}px) scale(1.02)`,
                pointerEvents: 'none',
              }}
            >
              <span aria-hidden="true" className="px-0.5 text-texto-fraco">⠿</span>
              <span className="min-w-0 flex-1 truncate text-[16px] text-texto">
                {bloco.titulo || 'Sem título'}
              </span>
              <span className="text-xs text-texto-fraco">{bloco.minutos} min</span>
            </div>
          );
        })()}

        <button
          type="button"
          onClick={() => setBlocos((atuais) => [...atuais, novoBloco()])}
          className="mt-3 h-11 w-full rounded-xl border border-dashed border-borda text-sm text-texto-suave hover:border-borda-forte hover:text-texto"
        >
          + Adicionar bloco
        </button>

        {erro && (
          <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--urgente)' }}>
            {erro}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-borda pt-3 sm:flex-row sm:items-center">
          <input
            value={nomeModelo}
            onChange={(e) => {
              setNomeModelo(e.target.value);
              setModeloSalvo(false);
            }}
            placeholder="Nome do modelo (ex: Culto padrão)"
            className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo-cartao px-3 py-2 text-sm text-texto placeholder:text-texto-fraco"
          />
          <button
            type="button"
            onClick={salvarComoModelo}
            disabled={salvandoModelo || !nomeModelo.trim()}
            className="h-10 shrink-0 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto disabled:opacity-50"
          >
            {salvandoModelo ? 'Salvando…' : modeloSalvo ? 'Modelo salvo ✓' : 'Salvar como modelo'}
          </button>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-14 flex-1 rounded-xl text-base font-bold disabled:opacity-60"
          style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
        >
          {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Publicar'}
        </button>

        <button
          type="button"
          onClick={onVoltar}
          className="h-14 rounded-xl border border-borda px-5 text-sm font-medium text-texto-suave hover:text-texto"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
