'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagemAnexo } from '@/components/ImagemAnexo';
import { useAlertaSonoro } from '@/hooks/useAlertaSonoro';
import { useEventos } from '@/hooks/useEventos';
import type { Conversa } from '@/lib/conversas';
import { dataHora, hora, tempoDecorrido } from '@/lib/formatar';
import type { Mensagem } from '@/lib/types';

/**
 * Painel do audiovisual.
 *
 * Uma conversa por área, como num aplicativo de mensagem: à esquerda a lista
 * de áreas com o que está pendente em cada uma, à direita a conversa aberta.
 * As respostas do audiovisual ficam dentro da conversa a que pertencem.
 *
 * Fica num monitor lateral durante o culto — daí os alvos grandes, o texto
 * legível de longe, e o som quando chega recado, já que quem opera a mesa não
 * fica olhando para esta tela.
 */

interface Props {
  conversasIniciais: Conversa[];
}

export function PainelAudiovisual({ conversasIniciais }: Props) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [abertaSlug, setAbertaSlug] = useState<string | null>(
    conversasIniciais[0]?.area.slug ?? null,
  );
  const [som, setSom] = useState(true);
  const [conectado, setConectado] = useState(true);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  const { tocar, liberar } = useAlertaSonoro(som);

  // Guarda os identificadores já vistos para tocar o som só em recado
  // realmente novo — sem isso, resolver um recado dispararia o alerta.
  const conhecidos = useRef<Set<string>>(
    new Set(conversasIniciais.flatMap((c) => c.mensagens.map((m) => m.id))),
  );

  const aberta = conversas.find((c) => c.area.slug === abertaSlug) ?? null;

  const recarregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/painel/mensagens', {
        cache: 'no-store',
      });
      if (!resposta.ok) return;

      const dados = (await resposta.json()) as { conversas: Conversa[] };
      const todas = dados.conversas.flatMap((c) => c.mensagens);

      // Toca apenas para recados vindos de área: a própria resposta do
      // audiovisual não deve alertar quem acabou de escrevê-la.
      const novos = todas.filter(
        (m) => !conhecidos.current.has(m.id) && m.autor === 'area',
      );
      if (novos.length > 0) {
        tocar(novos.some((m) => m.prioridade === 'urgente'));
      }
      conhecidos.current = new Set(todas.map((m) => m.id));

      setConversas(dados.conversas);
      setConectado(true);
    } catch {
      setConectado(false);
    }
  }, [tocar]);

  useEventos(useCallback(() => void recarregar(), [recarregar]));

  // Rede de segurança: se a conexão de avisos cair sem o navegador perceber,
  // esta releitura periódica mantém o painel correto.
  useEffect(() => {
    const timer = setInterval(() => void recarregar(), 30_000);
    return () => clearInterval(timer);
  }, [recarregar]);

  // Redesenha de minuto em minuto para o "há X min" não congelar na tela.
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forcarRender((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function mudarEstado(id: string, acao: 'resolver' | 'reabrir') {
    // Aplica na tela antes da resposta do servidor: o clique precisa parecer
    // instantâneo no meio do culto. O recarregar em seguida confirma.
    setConversas((atuais) =>
      atuais.map((conversa) => {
        if (!conversa.mensagens.some((m) => m.id === id)) return conversa;

        const mensagens = conversa.mensagens.map((m) =>
          m.id === id
            ? {
                ...m,
                resolvidaEm:
                  acao === 'resolver' ? new Date().toISOString() : null,
              }
            : m,
        );
        const pendentes = mensagens.filter(
          (m) => m.autor === 'area' && !m.resolvidaEm,
        );
        return {
          ...conversa,
          mensagens,
          pendentes: pendentes.length,
          temUrgente: pendentes.some((m) => m.prioridade === 'urgente'),
        };
      }),
    );

    try {
      await fetch(`/api/painel/mensagens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
    } catch {
      // O recarregar abaixo devolve o estado real se a chamada falhou.
    }
    await recarregar();
  }

  const totalPendentes = conversas.reduce((soma, c) => soma + c.pendentes, 0);

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-fundo"
      onClickCapture={liberar}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-borda bg-fundo-elevado px-5 py-3">
        <h1 className="text-xl font-bold tracking-tight text-texto">Coredja</h1>
        <span className="text-sm text-texto-fraco">Audiovisual</span>

        {totalPendentes > 0 && (
          <span className="rounded-full bg-fundo-cartao px-2.5 py-1 text-xs font-semibold text-texto-suave">
            {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}
          </span>
        )}

        {!conectado && (
          <span className="rounded-full bg-urgente-fundo px-2.5 py-1 text-xs font-semibold text-urgente">
            Sem conexão
          </span>
        )}

        <button
          type="button"
          onClick={() => setSom((v) => !v)}
          aria-pressed={som}
          title={som ? 'Desligar som' : 'Ligar som'}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-borda bg-fundo-cartao px-3 text-sm text-texto-suave hover:bg-borda"
        >
          {som ? <IconeSom /> : <IconeSomMudo />}
          <span className="hidden sm:inline">
            {som ? 'Som ligado' : 'Som desligado'}
          </span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <ListaDeConversas
          conversas={conversas}
          abertaSlug={abertaSlug}
          aoEscolher={setAbertaSlug}
        />

        {aberta ? (
          <PainelDaConversa
            conversa={aberta}
            mostrarResolvidos={mostrarResolvidos}
            aoAlternarResolvidos={() => setMostrarResolvidos((v) => !v)}
            aoMudarEstado={mudarEstado}
            aoEnviar={recarregar}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-texto-fraco">
              Escolha uma área para ver a conversa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Coluna da esquerda: uma linha por área, com o que está pendente nela. */
function ListaDeConversas({
  conversas,
  abertaSlug,
  aoEscolher,
}: {
  conversas: Conversa[];
  abertaSlug: string | null;
  aoEscolher: (slug: string) => void;
}) {
  return (
    <nav
      aria-label="Áreas"
      className="w-[15rem] shrink-0 overflow-y-auto border-r border-borda bg-fundo-elevado md:w-[19rem]"
    >
      <ul>
        {conversas.map((conversa) => {
          const ativa = conversa.area.slug === abertaSlug;
          return (
            <li key={conversa.area.slug}>
              <button
                type="button"
                onClick={() => aoEscolher(conversa.area.slug)}
                aria-current={ativa ? 'true' : undefined}
                className="flex w-full items-center gap-3 border-b border-borda px-4 py-3.5 text-left transition-colors hover:bg-fundo-cartao"
                style={{
                  background: ativa ? 'var(--fundo-cartao)' : undefined,
                  boxShadow: ativa
                    ? `inset 3px 0 0 ${conversa.area.cor}`
                    : undefined,
                }}
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-full"
                  style={{ background: conversa.area.cor }}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-texto">
                      {conversa.area.nome}
                    </span>
                    {conversa.ultima && (
                      <span className="ml-auto shrink-0 text-[11px] text-texto-fraco">
                        {hora(conversa.ultima.criadaEm)}
                      </span>
                    )}
                  </span>

                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-texto-fraco">
                      {conversa.ultima
                        ? `${
                            conversa.ultima.autor === 'audiovisual' ? 'Você: ' : ''
                          }${
                            conversa.ultima.texto ||
                            (conversa.ultima.anexos.length > 0 ? '📷 imagem' : '')
                          }`
                        : 'Nenhum recado ainda'}
                    </span>

                    {conversa.pendentes > 0 && (
                      <span
                        className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{
                          background: conversa.temUrgente
                            ? 'var(--urgente)'
                            : 'var(--texto-fraco)',
                        }}
                        title={
                          conversa.temUrgente
                            ? 'Tem recado urgente'
                            : 'Recados pendentes'
                        }
                      >
                        {conversa.pendentes}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Coluna da direita: a conversa aberta, com o campo de resposta embaixo. */
function PainelDaConversa({
  conversa,
  mostrarResolvidos,
  aoAlternarResolvidos,
  aoMudarEstado,
  aoEnviar,
}: {
  conversa: Conversa;
  mostrarResolvidos: boolean;
  aoAlternarResolvidos: () => void;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
  aoEnviar: () => Promise<void>;
}) {
  const fim = useRef<HTMLDivElement>(null);

  const visiveis = mostrarResolvidos
    ? conversa.mensagens
    : conversa.mensagens.filter((m) => m.autor === 'audiovisual' || !m.resolvidaEm);

  const ocultos = conversa.mensagens.length - visiveis.length;

  // Rola para o fim ao trocar de área ou chegar mensagem nova.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [conversa.area.slug, conversa.mensagens.length, mostrarResolvidos]);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-borda px-5 py-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: conversa.area.cor }}
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-texto">{conversa.area.nome}</h2>

        {conversa.pendentes > 0 && (
          <span className="text-sm text-texto-fraco">
            {conversa.pendentes} pendente{conversa.pendentes > 1 ? 's' : ''}
          </span>
        )}

        {(ocultos > 0 || mostrarResolvidos) && (
          <button
            type="button"
            onClick={aoAlternarResolvidos}
            className="ml-auto rounded-lg border border-borda px-3 py-1.5 text-xs font-medium text-texto-suave hover:bg-borda"
          >
            {mostrarResolvidos
              ? 'Ocultar resolvidos'
              : `Ver resolvidos (${ocultos})`}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {visiveis.length === 0 ? (
          <p className="py-16 text-center text-sm text-texto-fraco">
            {conversa.mensagens.length === 0
              ? `Nenhum recado da ${conversa.area.nome} ainda.`
              : 'Tudo resolvido por aqui.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {/* Largura cheia, sem max-w centralizado: os balões precisam
                encostar nas bordas para a distinção esquerda/direita ficar
                evidente de longe, que é como esta tela é lida. */}
            {visiveis.map((mensagem) => (
              <BalaoDoPainel
                key={mensagem.id}
                mensagem={mensagem}
                aoMudarEstado={aoMudarEstado}
              />
            ))}
          </ul>
        )}
        <div ref={fim} />
      </div>

      {/* A key faz o React recriar o campo ao trocar de área, o que zera o
          rascunho — sem isso, um texto começado para a Cantina apareceria na
          conversa do Kids. */}
      <CampoDeResposta
        key={conversa.area.slug}
        areaSlug={conversa.area.slug}
        aoEnviar={aoEnviar}
      />
    </section>
  );
}

/** Um recado dentro da conversa. Da área à esquerda, seu à direita. */
function BalaoDoPainel({
  mensagem,
  aoMudarEstado,
}: {
  mensagem: Mensagem;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
}) {
  const daArea = mensagem.autor === 'area';
  const urgente = mensagem.prioridade === 'urgente';
  const resolvido = Boolean(mensagem.resolvidaEm);
  const pulsa = daArea && urgente && !resolvido;

  return (
    <li className={`flex ${daArea ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`entrada max-w-[min(85%,44rem)] rounded-2xl border p-3.5 ${
          pulsa ? 'pulso-urgente' : ''
        }`}
        style={{
          background:
            daArea && urgente && !resolvido
              ? 'var(--urgente-fundo)'
              : 'var(--fundo-cartao)',
          borderColor:
            daArea && urgente && !resolvido ? 'var(--urgente)' : 'var(--borda)',
          opacity: resolvido ? 0.62 : 1,
        }}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {urgente && daArea && (
            <span className="rounded-md bg-urgente px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Urgente
            </span>
          )}
          {!daArea && (
            <span className="text-xs font-semibold text-acento">Você</span>
          )}
          {resolvido && (
            <span className="text-[11px] font-medium text-sucesso">
              ✓ resolvido
            </span>
          )}
          <span
            className="ml-auto whitespace-nowrap text-xs text-texto-fraco"
            title={dataHora(mensagem.criadaEm)}
          >
            {tempoDecorrido(mensagem.criadaEm)} · {hora(mensagem.criadaEm)}
          </span>
        </div>

        {mensagem.texto && (
          <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed text-texto">
            {mensagem.texto}
          </p>
        )}

        {mensagem.anexos.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {mensagem.anexos.map((anexo) => (
              <li key={anexo.id}>
                <ImagemAnexo anexo={anexo} tamanho="h-32 w-32" mostrarDownload />
              </li>
            ))}
          </ul>
        )}

        {/* Só recado de área se resolve: resposta sua não é tarefa sua. */}
        {daArea && (
          <button
            type="button"
            onClick={() =>
              aoMudarEstado(mensagem.id, resolvido ? 'reabrir' : 'resolver')
            }
            className="mt-3 h-10 w-full rounded-lg border border-borda-forte bg-fundo-elevado text-sm font-semibold text-texto hover:bg-borda"
          >
            {resolvido ? 'Reabrir' : 'Marcar como resolvido'}
          </button>
        )}
      </div>
    </li>
  );
}

/** Campo de resposta, fixo no rodapé da conversa aberta. */
function CampoDeResposta({
  areaSlug,
  aoEnviar,
}: {
  areaSlug: string;
  aoEnviar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/painel/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaSlug, texto: conteudo }),
      });
      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
        };
        setErro(dados.erro ?? 'Não foi possível enviar.');
        return;
      }
      setTexto('');
      await aoEnviar();
      campo.current?.focus();
    } catch {
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="shrink-0 border-t border-borda bg-fundo-elevado px-5 py-3"
    >
      <div className="mx-auto max-w-3xl">
        {erro && (
          <p role="alert" className="mb-2 text-sm text-urgente">
            {erro}
          </p>
        )}

        <div className="flex items-end gap-2">
          <label htmlFor="resposta" className="sr-only">
            Mensagem
          </label>
          <textarea
            id="resposta"
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha. Numa conversa rápida,
              // ter de mirar no botão a cada mensagem atrasa.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void enviar(e);
              }
            }}
            rows={1}
            placeholder="Escreva uma mensagem…"
            className="max-h-32 min-h-[3rem] w-full resize-y rounded-xl border border-borda bg-fundo-cartao px-3 py-3 text-[15px] text-texto placeholder:text-texto-fraco"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="h-12 shrink-0 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--acento)' }}
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </form>
  );
}

function IconeSom() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function IconeSomMudo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m22 9-6 6" />
      <path d="m16 9 6 6" />
    </svg>
  );
}
