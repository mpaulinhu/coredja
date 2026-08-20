'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { normalizarAviso, ordenarParaPublicar, valeNoDia, type Aviso } from '@/lib/avisos';
import { comprimirImagem } from '@/lib/comprimir';
import { hojeLocal } from '@/lib/culto';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { TAMANHO_MAXIMO_BYTES } from '@/lib/limites';
import { BotaoPrincipal, BotaoSecundario, Numero, Rotulo, Selo } from '@/components/Interface';
import { CabecalhoDaPrevia, PreviaDoTelao, type ConteudoDaPrevia } from '@/components/PreviaDoTelao';

/** Resposta da publicação, na parte que conta o que houve com o Holyrics. */
interface RetornoTelao {
  holyrics?: { estado: string; motivo?: string } | null;
}

/**
 * Os filtros da lista.
 *
 * Vêm da referência (`defaultFilter`, com as opções "Todos / Hoje /
 * Programados / Vale sempre") e — o que decidiu mantê-los — todos os quatro
 * saem de dado que o `Aviso` já tem: `dias` vazio é "vale sempre", `dias`
 * contendo hoje é "hoje", `dias` preenchido é "programado". Nenhum inventa
 * campo novo.
 */
type Filtro = 'todos' | 'hoje' | 'programados' | 'sempre';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'programados', rotulo: 'Programados' },
  { id: 'sempre', rotulo: 'Vale sempre' },
];

function passaNoFiltro(aviso: Aviso, filtro: Filtro, hoje: string): boolean {
  switch (filtro) {
    case 'hoje':
      return valeNoDia(aviso, hoje);
    case 'programados':
      return aviso.dias.length > 0;
    case 'sempre':
      return aviso.dias.length === 0;
    default:
      return true;
  }
}

/** `"2026-08-23"` vira `"23/08"`. O ano polui e raramente importa. */
function formatarDia(dia: string): string {
  const [, mes, d] = dia.split('-');
  return `${d}/${mes}`;
}

/** "domingo, 23 de agosto" — o rótulo de data do topo, como na referência. */
function dataPorExtenso(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/** Um aviso é "só imagem" quando não há o que o Holyrics consiga projetar. */
function ehSoImagem(aviso: Aviso): boolean {
  return Boolean(aviso.imagem) && !aviso.titulo.trim() && !aviso.texto.trim();
}

/** A etiqueta que aparece no canto da prévia e no chip do cartão. */
function etiquetaDoAviso(aviso: Aviso, hoje: string): string {
  if (aviso.noAr) return 'No telão';
  if (aviso.dias.length === 0) return 'Vale sempre';
  return valeNoDia(aviso, hoje) ? 'Hoje' : 'Programado';
}

/**
 * Avisos do Telão: cadastro (quem pode) + prévia + lista com os botões de
 * publicar.
 *
 * Refeita em 20/08/2026 sobre a tela de referência ("Avisos do Telão -
 * offline.html"), a terceira da série depois de Ordem do Culto e Recados. O
 * que a referência mudou de fato, além do visual: a tela deixou de ser um
 * formulário estreito com uma lista embaixo e passou a ser um painel de duas
 * colunas com PRÉVIA — dá para conferir como o aviso vai aparecer projetado
 * antes de salvar, que era exatamente o que não dava para fazer antes (só se
 * descobria no domingo, no telão da igreja).
 *
 * `podeCadastrar` segue o mesmo truque de `TelaCulto`: em vez de perguntar o
 * papel, o formulário aparece sempre e o erro 403 (se vier) vira mensagem.
 * Cadastrar não muda nada até o clique em "Cadastrar aviso", então não há
 * custo em deixar visível e deixar o servidor explicar por que não salvou.
 */
export function TelaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[] | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [holyricsLigado, setHolyricsLigado] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  // O que está sendo digitado no formulário, espelhado aqui para a prévia
  // conseguir mostrá-lo ao vivo. Mora no pai porque prévia e formulário são
  // irmãos em colunas diferentes.
  const [rascunho, setRascunho] = useState<ConteudoDaPrevia>({
    titulo: '',
    texto: '',
    dias: [],
    etiqueta: 'Novo aviso',
  });

  // Calculado uma vez por montagem: recalcular a cada render faria a lista
  // reordenar sozinha na virada da meia-noite, no meio de um clique.
  const hoje = useMemo(() => hojeLocal(), []);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return;
    return onSnapshot(collection(db, 'avisos'), (snap) => {
      const lista = snap.docs.map((d) => normalizarAviso({ id: d.id, ...d.data() }));
      setAvisos(ordenarParaPublicar(lista, hojeLocal()));
    });
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho || !vivo) return;
      const resp = await fetch('/api/holyrics/status', { headers: cabecalho });
      if (!resp.ok || !vivo) return;
      const dados = (await resp.json()) as { configurado?: boolean };
      if (vivo) setHolyricsLigado(dados.configurado === true);
    })().catch(() => {
      // Integração é opcional: não saber se está ligada não quebra a tela.
    });
    return () => {
      vivo = false;
    };
  }, []);

  const chamar = useCallback(async (caminho: string, metodo: string, corpo?: FormData) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return null;
    }
    const resp = await fetch(caminho, {
      method: metodo,
      headers: cabecalho,
      body: corpo,
    });
    const dados = await resp.json();
    if (!resp.ok) {
      setErro(dados.erro ?? 'Algo deu errado.');
      return null;
    }
    setErro(null);
    return dados;
  }, []);

  const criar = useCallback((form: FormData) => chamar('/api/avisos', 'POST', form), [chamar]);
  const remover = useCallback((id: string) => chamar(`/api/avisos/${id}`, 'DELETE'), [chamar]);

  /** Publicar/ocultar traz junto o que aconteceu do lado do Holyrics. */
  const mexerNoTelao = useCallback(
    async (id: string, publicando: boolean) => {
      setRecado(null);
      const dados = (await chamar(
        `/api/avisos/${id}/telao`,
        publicando ? 'POST' : 'DELETE',
      )) as RetornoTelao | null;
      if (!dados) return;

      const holyrics = dados.holyrics;
      if (!holyrics || holyrics.estado === 'enviado') return;

      const complemento = holyrics.motivo ?? '';
      // `nao-suportado` e `enviado-sem-imagem` não são falha: o envio fez o
      // que dava para fazer, e o recado só conta o que ficou de fora.
      const parcial =
        holyrics.estado === 'nao-suportado' || holyrics.estado === 'enviado-sem-imagem';
      setRecado(
        parcial
          ? `Publicado no Coredja. ${complemento}`.trim()
          : `Publicado no Coredja, mas não foi possível enviar ao Holyrics. ${complemento}`.trim(),
      );
    },
    [chamar],
  );

  /** Manda para a fila do Holyrics sem projetar — quem opera decide a hora. */
  const mandarParaFila = useCallback(
    async (id: string) => {
      setRecado(null);
      const dados = (await chamar(`/api/avisos/${id}/fila`, 'POST')) as RetornoTelao | null;
      if (!dados) return;

      const holyrics = dados.holyrics;
      if (!holyrics) return;

      if (holyrics.estado === 'enviado') {
        setRecado('Audiovisual avisado. Quem opera projeta na hora certa.');
        return;
      }

      const complemento = holyrics.motivo ?? '';
      const parcial =
        holyrics.estado === 'nao-suportado' || holyrics.estado === 'enviado-sem-imagem';
      setRecado(
        parcial
          ? `Audiovisual avisado. ${complemento}`.trim()
          : `Não foi possível enviar ao Holyrics. ${complemento}`.trim(),
      );
    },
    [chamar],
  );

  const visiveis = useMemo(
    () => (avisos ?? []).filter((a) => passaNoFiltro(a, filtro, hoje)),
    [avisos, filtro, hoje],
  );

  /**
   * O aviso que a prévia mostra quando não se está digitando: o selecionado,
   * ou — na ausência de escolha — o que está no ar, ou o primeiro da lista.
   * Sem esse encadeamento a prévia nasceria vazia numa tela que já tem
   * avisos cadastrados, o que a faria parecer quebrada.
   */
  const selecionado = useMemo(() => {
    const lista = avisos ?? [];
    if (selecionadoId) {
      const achado = lista.find((a) => a.id === selecionadoId);
      if (achado) return achado;
    }
    return lista.find((a) => a.noAr) ?? visiveis[0] ?? lista[0] ?? null;
  }, [avisos, selecionadoId, visiveis]);

  // Digitar sempre ganha da seleção: enquanto há rascunho, a prévia é dele.
  const digitando = Boolean(
    rascunho.titulo.trim() || rascunho.texto.trim() || rascunho.imagemUrl,
  );

  const conteudoDaPrevia: ConteudoDaPrevia = digitando
    ? rascunho
    : selecionado
      ? {
          titulo: selecionado.titulo,
          texto: selecionado.texto,
          ...(selecionado.imagem ? { imagemUrl: selecionado.imagem.url } : {}),
          dias: selecionado.dias,
          etiqueta: etiquetaDoAviso(selecionado, hoje),
          etiquetaEmDestaque: selecionado.noAr,
        }
      : { titulo: '', texto: '', dias: [], etiqueta: 'Novo aviso' };

  if (avisos === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  const noAr = avisos.find((a) => a.noAr) ?? null;
  const total = avisos.length;

  return (
    <div className="mx-auto w-full max-w-[1620px] px-4 py-6 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Rotulo className="first-letter:uppercase">{dataPorExtenso(hoje)}</Rotulo>
          <h1 className="mt-2 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-texto sm:text-[40px]">
            Avisos do Telão
          </h1>
          <p className="mt-2 max-w-xl text-sm text-texto-suave">
            Cadastre durante a semana. No domingo, projete com um clique — quem está na
            cabine recebe o aviso na hora.
          </p>
        </div>

        {/* O indicador do topo diz o que o servidor de fato sabe: se a
            integração com o Holyrics está configurada, e o que está no ar.
            "Telão conectado · Sala 1" da referência virou isto — a sala é
            dado que não existe no Coredja, e inventá-la seria escrever no
            painel uma informação que ninguém cadastrou. */}
        <div
          className="flex items-center gap-2.5 rounded-xl border px-4 py-3"
          style={{
            borderColor: noAr ? 'var(--acento-suave-borda)' : 'var(--borda)',
            background: noAr ? 'var(--acento-suave-fundo)' : 'var(--fundo-elevado)',
          }}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${noAr ? 'pulso-ao-vivo' : ''}`}
            style={{
              background: noAr
                ? 'var(--acento)'
                : holyricsLigado
                  ? 'var(--sucesso)'
                  : 'var(--texto-fraco)',
            }}
          />
          <span
            className="text-sm font-bold"
            style={{
              color: noAr ? 'var(--acento-texto-sobre-fundo)' : 'var(--texto-suave)',
            }}
          >
            {noAr
              ? 'Aviso no telão agora'
              : holyricsLigado
                ? 'Holyrics conectado'
                : 'Telão livre'}
          </span>
        </div>
      </header>

      {/* Duas colunas: prévia + formulário. `auto-fit` com mínimo de 460px
          colapsa para uma coluna sozinho no celular, sem breakpoint à mão. */}
      <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-start gap-5">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-borda bg-fundo-elevado">
          <CabecalhoDaPrevia />
          <div className="p-5 sm:p-6">
            <PreviaDoTelao conteudo={conteudoDaPrevia} />
          </div>

          {/* Os botões do aviso SELECIONADO — não do rascunho: só dá para
              projetar o que já foi salvo. Enquanto se digita, a prévia mostra
              o rascunho mas estes botões continuam apontando para o
              selecionado, então some para não publicar a coisa errada. */}
          {!digitando && selecionado && (
            <div className="flex flex-wrap gap-2.5 px-5 pb-5 sm:px-6 sm:pb-6">
              <BotaoPrincipal
                onClick={() => mexerNoTelao(selecionado.id, !selecionado.noAr)}
                className="min-w-0 flex-1 text-sm sm:h-14"
                style={
                  selecionado.noAr
                    ? {
                        background: 'var(--borda-forte)',
                        color: 'var(--texto)',
                        boxShadow: 'none',
                      }
                    : undefined
                }
              >
                {selecionado.noAr
                  ? 'Tirar da tela de retorno'
                  : holyricsLigado
                    ? 'Projetar tela de retorno'
                    : 'Publicar no telão'}
              </BotaoPrincipal>

              {holyricsLigado && !ehSoImagem(selecionado) && (
                <BotaoSecundario
                  onClick={() => mandarParaFila(selecionado.id)}
                  className="text-sm sm:h-14"
                >
                  Avisar audiovisual
                </BotaoSecundario>
              )}
            </div>
          )}

          {/* Só faz sentido explicar isso quando a integração existe: sem
              Holyrics configurado, ninguém espera envio automático. */}
          {!digitando && selecionado && holyricsLigado && ehSoImagem(selecionado) && (
            <p className="px-5 pb-5 text-xs text-texto-fraco sm:px-6 sm:pb-6">
              Não vai para o Holyrics automaticamente — a API dele não recebe imagens de
              fora. Projete a arte manualmente.
            </p>
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-borda bg-fundo-elevado">
          <div className="border-b border-borda px-5 py-4 sm:px-6">
            <Rotulo>Novo aviso</Rotulo>
          </div>
          <div className="p-5 sm:p-6">
            <FormularioNovoAviso onCriar={criar} onRascunho={setRascunho} />

            {erro && (
              <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--urgente)' }}>
                {erro}
              </p>
            )}
          </div>
        </section>
      </div>

      {recado && (
        <div
          role="status"
          className="entrada mt-5 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--acento-suave-borda)',
            background: 'var(--acento-suave-fundo)',
            color: 'var(--texto)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0">{recado}</p>
            <button
              type="button"
              onClick={() => setRecado(null)}
              aria-label="Dispensar recado"
              className="shrink-0 cursor-pointer text-texto-fraco hover:text-texto"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Rotulo>
            Avisos cadastrados · {total === 1 ? '1 aviso' : `${total} avisos`}
          </Rotulo>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar avisos"
          >
            {FILTROS.map((opcao) => {
              const ativo = filtro === opcao.id;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(opcao.id)}
                  className="min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-bold transition-colors"
                  style={{
                    borderColor: ativo ? 'var(--acento-suave-borda)' : 'var(--borda)',
                    background: ativo ? 'var(--acento-suave-fundo)' : 'transparent',
                    color: ativo
                      ? 'var(--acento-texto-sobre-fundo)'
                      : 'var(--texto-suave)',
                  }}
                >
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borda-forte px-6 py-12 text-center">
            <p className="text-base font-bold text-texto">
              {total === 0 ? 'Nenhum aviso cadastrado' : 'Nenhum aviso neste filtro'}
            </p>
            <p className="mt-2 text-sm text-texto-suave">
              {total === 0
                ? 'Cadastre o primeiro no formulário acima.'
                : 'Cadastre ao lado ou troque o filtro acima.'}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-4">
            {visiveis.map((aviso) => {
              const soImagem = ehSoImagem(aviso);
              const ehDeHoje = valeNoDia(aviso, hoje);
              const escolhido = selecionado?.id === aviso.id && !digitando;

              return (
                <li key={aviso.id}>
                  <article
                    className="flex h-full flex-col gap-4 rounded-2xl border p-4 sm:p-5"
                    style={{
                      borderColor: aviso.noAr
                        ? 'var(--acento-suave-borda)'
                        : escolhido
                          ? 'var(--borda-forte)'
                          : 'var(--borda)',
                      background: aviso.noAr
                        ? 'var(--acento-suave-fundo)'
                        : 'var(--fundo-cartao)',
                    }}
                  >
                    {/* O cartão inteiro seleciona (é o que a referência faz
                        com `c.select`), mas o alvo clicável é um BOTÃO em
                        volta do conteúdo — e não um `onClick` na `<li>` —
                        para quem navega por teclado alcançar a seleção. */}
                    <button
                      type="button"
                      onClick={() => setSelecionadoId(aviso.id)}
                      aria-pressed={escolhido}
                      className="flex cursor-pointer items-start gap-3.5 text-left"
                    >
                      <div className="shrink-0">
                        {aviso.imagem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={aviso.imagem.url}
                            alt=""
                            className="h-14 w-20 rounded-lg border border-borda object-cover"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="flex h-14 w-20 items-center justify-center rounded-lg border border-borda"
                            style={{ background: 'var(--fundo-elevado)' }}
                          >
                            <Numero className="text-[10px] text-texto-fraco">
                              TEXTO
                            </Numero>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Selo
                            tom={
                              aviso.noAr ? 'acento' : ehDeHoje ? 'sucesso' : 'neutro'
                            }
                          >
                            {etiquetaDoAviso(aviso, hoje)}
                          </Selo>
                          {aviso.dias.length > 0 && (
                            <Numero className="text-xs text-texto-fraco">
                              {aviso.dias.map(formatarDia).join(' · ')}
                            </Numero>
                          )}
                        </div>

                        <p className="mt-2 truncate font-bold text-texto">
                          {aviso.titulo.trim() || 'Aviso em imagem'}
                        </p>
                        {aviso.texto && (
                          <p className="mt-0.5 truncate text-sm text-texto-suave">
                            {aviso.texto}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => mexerNoTelao(aviso.id, !aviso.noAr)}
                        className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-xl px-3 text-sm font-bold transition-colors"
                        style={{
                          background: aviso.noAr ? 'var(--borda-forte)' : 'var(--acento)',
                          color: aviso.noAr ? 'var(--texto)' : 'var(--acento-texto)',
                        }}
                      >
                        {aviso.noAr
                          ? 'Tirar da tela de retorno'
                          : holyricsLigado
                            ? 'Projetar tela de retorno'
                            : 'Publicar no telão'}
                      </button>

                      {holyricsLigado && !soImagem && (
                        <button
                          type="button"
                          onClick={() => mandarParaFila(aviso.id)}
                          className="min-h-11 cursor-pointer rounded-xl border border-borda px-3.5 text-sm font-semibold text-texto-suave transition-colors hover:border-borda-forte hover:text-texto"
                        >
                          Avisar audiovisual
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => remover(aviso.id)}
                        aria-label={`Remover o aviso ${aviso.titulo.trim() || 'em imagem'}`}
                        className="min-h-11 w-11 cursor-pointer rounded-xl border border-borda text-texto-fraco transition-colors hover:text-texto"
                        style={{ borderColor: 'var(--borda)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Cadastrar aparece para todo mundo — quem não tem `avisos:escrever` só
 * descobre isso ao tentar salvar, quando o servidor devolve 403.
 *
 * `onRascunho` empurra o que está sendo digitado para o pai, que passa
 * adiante à prévia. É o preço de a prévia e o formulário serem irmãos em
 * colunas diferentes; alternativa seria subir o formulário inteiro para o
 * pai, o que espalharia oito estados numa tela que já tem os seus.
 */
function FormularioNovoAviso({
  onCriar,
  onRascunho,
}: {
  onCriar: (form: FormData) => Promise<unknown>;
  onRascunho: (conteudo: ConteudoDaPrevia) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<{ arquivo: File; previa: string } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [dias, setDias] = useState<string[]>([]);
  const [diaEscolhido, setDiaEscolhido] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const podeSalvar = Boolean(titulo.trim() || imagem);

  // Avisar o pai a cada mudança é o que faz a prévia ser "ao vivo". Fica num
  // efeito (e não numa chamada dentro de cada `onChange`) para não repetir a
  // mesma montagem de objeto em cinco lugares e esquecer um deles.
  useEffect(() => {
    onRascunho({
      titulo,
      texto,
      ...(imagem ? { imagemUrl: imagem.previa } : {}),
      dias,
      etiqueta: 'Novo aviso',
    });
  }, [titulo, texto, imagem, dias, onRascunho]);

  async function escolherImagem(lista: FileList | null) {
    const original = lista?.[0];
    if (!original) return;
    setAvisoLocal(null);

    if (!original.type.startsWith('image/')) {
      setAvisoLocal('Escolha um arquivo de imagem (PNG ou JPG).');
      return;
    }

    // Avisa aqui, antes do envio: subir uma arte grande pelo Wi-Fi da igreja
    // para só então receber a recusa do servidor custa tempo.
    if (original.size > TAMANHO_MAXIMO_BYTES) {
      const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
      setAvisoLocal(`A imagem passa de ${limite} MB e não pode ser enviada.`);
      return;
    }

    setPreparando(true);
    try {
      const arquivo = await comprimirImagem(original);
      setImagem((atual) => {
        if (atual) URL.revokeObjectURL(atual.previa);
        return { arquivo, previa: URL.createObjectURL(arquivo) };
      });
    } finally {
      setPreparando(false);
    }
  }

  function removerImagem() {
    setImagem((atual) => {
      if (atual) URL.revokeObjectURL(atual.previa);
      return null;
    });
    if (inputArquivo.current) inputArquivo.current.value = '';
  }

  function adicionarDia() {
    if (!diaEscolhido) return;
    setDias((atuais) =>
      atuais.includes(diaEscolhido) ? atuais : [...atuais, diaEscolhido].sort(),
    );
    setDiaEscolhido('');
  }

  function removerDia(dia: string) {
    setDias((atuais) => atuais.filter((d) => d !== dia));
  }

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);

    const form = new FormData();
    form.set('titulo', titulo);
    form.set('texto', texto);
    form.set('dias', JSON.stringify(dias));
    if (imagem) form.set('imagem', imagem.arquivo);

    const resultado = await onCriar(form);
    setSalvando(false);

    if (resultado) {
      setTitulo('');
      setTexto('');
      setDias([]);
      setDiaEscolhido('');
      removerImagem();
    }
  }

  const campo =
    'w-full rounded-xl border border-borda bg-fundo-cartao px-4 text-[16px] text-texto placeholder:text-texto-fraco focus:border-acento focus:outline-none';

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold text-texto-suave">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={60}
          placeholder="Ex: Batismo dia 30"
          className={`${campo} h-13`}
        />
        <Numero className="text-xs text-texto-fraco">
          {titulo.length}/60 · aparece grande no telão
        </Numero>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold text-texto-suave">
          Detalhes <span className="font-medium text-texto-fraco">(opcional)</span>
        </span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Local, horário, quem procurar…"
          className={`${campo} resize-none py-3.5 leading-relaxed`}
        />
      </label>

      {/* Imagem: um aviso pode ser só a arte pronta, sem título nem texto. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-texto-suave">Imagem</span>

        {/*
          A área inteira aceita arrastar-e-soltar E clique (é um `<label>`
          amarrado ao input escondido). `onDragOver` precisa do
          `preventDefault` senão o navegador abre a imagem numa aba nova em
          vez de entregá-la ao `onDrop`.
        */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!arrastando) setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            escolherImagem(e.dataTransfer.files);
          }}
          className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-dashed p-3.5 transition-colors"
          style={{
            borderColor: arrastando ? 'var(--acento)' : 'var(--borda-forte)',
            background: arrastando ? 'var(--acento-suave-fundo)' : 'var(--fundo-cartao)',
          }}
        >
          <input
            ref={inputArquivo}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => escolherImagem(e.target.files)}
          />

          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagem.previa}
              alt="Prévia da imagem do aviso"
              className="h-13 w-21 shrink-0 rounded-lg border border-borda object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-13 w-21 shrink-0 rounded-lg"
              style={{
                background:
                  'repeating-linear-gradient(135deg, var(--fundo-elevado) 0 6px, var(--borda) 6px 12px)',
              }}
            />
          )}

          <div className="min-w-0">
            <p className="text-sm font-semibold text-texto">
              {preparando
                ? 'Preparando…'
                : imagem
                  ? 'Trocar imagem'
                  : 'Arraste uma imagem ou escolha um arquivo'}
            </p>
            <Numero className="mt-1 block text-xs text-texto-fraco">
              PNG/JPG · 1920×1080 recomendado
            </Numero>
          </div>
        </label>

        {imagem && (
          <button
            type="button"
            onClick={removerImagem}
            className="min-h-11 cursor-pointer self-start rounded-xl border border-borda px-4 text-sm font-medium text-texto-suave transition-colors hover:border-borda-forte hover:text-texto"
          >
            Remover imagem
          </button>
        )}
      </div>

      {/* Dias: input de data + botão, sem biblioteca de calendário. */}
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-bold text-texto-suave">
          Dias em que deve aparecer
        </span>
        <div className="flex flex-wrap gap-2.5">
          <input
            type="date"
            value={diaEscolhido}
            onChange={(e) => setDiaEscolhido(e.target.value)}
            aria-label="Dia em que o aviso vale"
            className={`${campo} numero h-13 min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={adicionarDia}
            disabled={!diaEscolhido}
            className="min-h-13 shrink-0 cursor-pointer rounded-xl border border-borda-forte bg-fundo-cartao px-4 text-sm font-bold text-texto-suave transition-colors hover:text-texto disabled:cursor-default disabled:opacity-50"
          >
            Adicionar dia
          </button>
        </div>

        {dias.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {dias.map((dia) => (
              <li key={dia}>
                <button
                  type="button"
                  onClick={() => removerDia(dia)}
                  aria-label={`Remover o dia ${formatarDia(dia)}`}
                  className="numero inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-borda-forte bg-fundo-cartao px-3 text-sm font-semibold text-texto transition-colors hover:border-urgente"
                >
                  {formatarDia(dia)}
                  <span aria-hidden="true" className="text-texto-fraco">
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-texto-fraco">
          {dias.length === 0
            ? 'Sem dias marcados: vale sempre.'
            : 'Fora desses dias o aviso continua cadastrado, mas desce na lista.'}
        </p>
      </div>

      {avisoLocal && (
        <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
          {avisoLocal}
        </p>
      )}

      <BotaoPrincipal
        onClick={salvar}
        disabled={salvando || preparando || !podeSalvar}
        className="h-14 w-full"
      >
        {salvando ? 'Salvando…' : 'Cadastrar aviso'}
      </BotaoPrincipal>
    </div>
  );
}
