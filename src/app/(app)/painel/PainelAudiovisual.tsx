'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagemAnexo } from '@/components/ImagemAnexo';
import { useAlertaSonoro } from '@/hooks/useAlertaSonoro';
import { useEventos } from '@/hooks/useEventos';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { AUDIOVISUAL_SLUG, type Conversa } from '@/lib/conversa-compartilhado';
import { dataHora, hora, tempoDecorrido } from '@/lib/formatar';
import type { Mensagem } from '@/lib/types';

/**
 * Painel de conversas.
 *
 * Uma conversa por par de departamentos, como num aplicativo de mensagem: à
 * esquerda a lista de conversas com o que está pendente em cada uma, à
 * direita a conversa aberta. As respostas ficam dentro da conversa a que
 * pertencem.
 *
 * Fica num monitor lateral durante o culto — daí os alvos grandes, o texto
 * legível de longe, e o som quando chega recado, já que quem opera a mesa não
 * fica olhando para esta tela. O aparato de urgência (toggle, pendente,
 * resolver/reabrir) só aparece em conversas que envolvem o Audiovisual — ver
 * `conversa.temUrgencia`.
 */

/** Id estável de uma conversa: mesmo algoritmo de `idDaConversa`. */
function idDaConversa(a: string, b: string): string {
  return [a, b].sort().join('__');
}

export function PainelAudiovisual() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [meuDepartamento, setMeuDepartamento] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [som, setSom] = useState(true);
  const [conectado, setConectado] = useState(true);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  const { tocar, liberar } = useAlertaSonoro(som);

  // Guarda os identificadores já vistos para tocar o som só em recado
  // realmente novo — sem isso, resolver um recado dispararia o alerta.
  const conhecidos = useRef<Set<string>>(new Set());
  // A primeira carga não deve tocar som: são recados que já estavam lá.
  const primeiraCarga = useRef(true);

  const aberta =
    conversas.find((c) => idDaConversa(c.deptoA.slug, c.deptoB.slug) === abertaId) ??
    null;

  const recarregar = useCallback(async () => {
    try {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;

      const resposta = await fetch('/api/painel/mensagens', {
        headers: cabecalho,
        cache: 'no-store',
      });
      if (!resposta.ok) return;

      const dados = (await resposta.json()) as {
        conversas: Conversa[];
        meuDepartamento: string | null;
      };
      const todas = dados.conversas.flatMap((c) => c.mensagens);

      // Toca apenas para recados vindos de outro departamento: a própria
      // mensagem não deve alertar quem acabou de escrevê-la.
      if (!primeiraCarga.current) {
        const novos = todas.filter(
          (m) =>
            !conhecidos.current.has(m.id) && m.remetente !== dados.meuDepartamento,
        );
        if (novos.length > 0) {
          tocar(novos.some((m) => m.prioridade === 'urgente'));
        }
      }
      primeiraCarga.current = false;
      conhecidos.current = new Set(todas.map((m) => m.id));

      setConversas(dados.conversas);
      setMeuDepartamento(dados.meuDepartamento);
      setCarregando(false);
      setConectado(true);

      // Abre a primeira conversa assim que a lista chega, se nenhuma estiver
      // aberta ainda (ou se a que estava aberta sumiu da lista).
      setAbertaId((atual) => {
        const aindaExiste =
          atual &&
          dados.conversas.some(
            (c) => idDaConversa(c.deptoA.slug, c.deptoB.slug) === atual,
          );
        if (aindaExiste) return atual;
        const primeira = dados.conversas[0];
        return primeira
          ? idDaConversa(primeira.deptoA.slug, primeira.deptoB.slug)
          : null;
      });
    } catch {
      setConectado(false);
    }
  }, [tocar]);

  // Primeira carga: o servidor não monta nada (não tem a sessão), então o
  // painel busca assim que monta no navegador. `cancelado` evita atualizar
  // estado se o componente sair antes da resposta chegar.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (cancelado) return;
      await recarregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [recarregar]);

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
        // Espelha a regra do servidor (`montarConversas`): pendente é o que
        // chegou PARA o Audiovisual resolver — por isso compara com o slug
        // dele, e não com o departamento de quem está olhando.
        const pendentes = conversa.temUrgencia
          ? mensagens.filter((m) => m.remetente !== AUDIOVISUAL_SLUG && !m.resolvidaEm)
          : [];
        return {
          ...conversa,
          mensagens,
          pendentes: pendentes.length,
          temUrgente: pendentes.some((m) => m.prioridade === 'urgente'),
        };
      }),
    );

    try {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;

      await fetch(`/api/painel/mensagens/${id}`, {
        method: 'PATCH',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
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
          meuDepartamento={meuDepartamento}
          abertaId={abertaId}
          aoEscolher={setAbertaId}
        />

        {aberta ? (
          <PainelDaConversa
            conversa={aberta}
            meuDepartamento={meuDepartamento}
            mostrarResolvidos={mostrarResolvidos}
            aoAlternarResolvidos={() => setMostrarResolvidos((v) => !v)}
            aoMudarEstado={mudarEstado}
            aoEnviar={recarregar}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-texto-fraco">
              {carregando
                ? 'Carregando…'
                : conversas.length === 0
                  ? 'Nenhuma conversa por aqui ainda.'
                  : 'Escolha uma conversa para ver as mensagens.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Com quem eu estou falando nesta conversa — a ponta que não é a minha.
 *
 * É relativo a quem está logado, não fixo no Audiovisual: para alguém da
 * Cantina, a conversa "Cantina ↔ Audiovisual" é uma conversa com o
 * *Audiovisual*, e mostrar "Cantina" ali faria parecer que a pessoa fala
 * consigo mesma.
 *
 * Quem não tem departamento (ex: um admin que só supervisiona) não é ponta de
 * conversa nenhuma: aí as duas aparecem, uma ao lado da outra.
 */
function outroLado(
  conversa: Conversa,
  meuDepartamento: string | null,
): { nome: string; cor: string } {
  if (conversa.deptoA.slug === meuDepartamento) return conversa.deptoB;
  if (conversa.deptoB.slug === meuDepartamento) return conversa.deptoA;
  return {
    nome: `${conversa.deptoA.nome} ↔ ${conversa.deptoB.nome}`,
    cor: conversa.deptoA.cor,
  };
}

/** Coluna da esquerda: uma linha por conversa, com o que está pendente nela. */
function ListaDeConversas({
  conversas,
  meuDepartamento,
  abertaId,
  aoEscolher,
}: {
  conversas: Conversa[];
  meuDepartamento: string | null;
  abertaId: string | null;
  aoEscolher: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Conversas"
      className="w-[15rem] shrink-0 overflow-y-auto border-r border-borda bg-fundo-elevado md:w-[19rem]"
    >
      <ul>
        {conversas.map((conversa) => {
          const id = idDaConversa(conversa.deptoA.slug, conversa.deptoB.slug);
          const ativa = id === abertaId;
          const lado = outroLado(conversa, meuDepartamento);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => aoEscolher(id)}
                aria-current={ativa ? 'true' : undefined}
                className="flex w-full items-center gap-3 border-b border-borda px-4 py-3.5 text-left transition-colors hover:bg-fundo-cartao"
                style={{
                  background: ativa ? 'var(--fundo-cartao)' : undefined,
                  boxShadow: ativa ? `inset 3px 0 0 ${lado.cor}` : undefined,
                }}
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-full"
                  style={{ background: lado.cor }}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-texto">
                      {lado.nome}
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
                            conversa.ultima.remetente === meuDepartamento
                              ? 'Você: '
                              : ''
                          }${
                            conversa.ultima.texto ||
                            (conversa.ultima.anexos.length > 0 ? '📷 imagem' : '')
                          }`
                        : 'Nenhum recado ainda'}
                    </span>

                    {conversa.temUrgencia && conversa.pendentes > 0 && (
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
  meuDepartamento,
  mostrarResolvidos,
  aoAlternarResolvidos,
  aoMudarEstado,
  aoEnviar,
}: {
  conversa: Conversa;
  meuDepartamento: string | null;
  mostrarResolvidos: boolean;
  aoAlternarResolvidos: () => void;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
  aoEnviar: () => Promise<void>;
}) {
  const fim = useRef<HTMLDivElement>(null);

  const lado = outroLado(conversa, meuDepartamento);
  const conversaId = idDaConversa(conversa.deptoA.slug, conversa.deptoB.slug);

  const visiveis =
    mostrarResolvidos || !conversa.temUrgencia
      ? conversa.mensagens
      : conversa.mensagens.filter(
          (m) => m.remetente === meuDepartamento || !m.resolvidaEm,
        );

  const ocultos = conversa.mensagens.length - visiveis.length;

  // Rola para o fim ao trocar de conversa ou chegar mensagem nova.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [conversaId, conversa.mensagens.length, mostrarResolvidos]);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-borda px-5 py-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: lado.cor }}
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-texto">{lado.nome}</h2>

        {conversa.temUrgencia && conversa.pendentes > 0 && (
          <span className="text-sm text-texto-fraco">
            {conversa.pendentes} pendente{conversa.pendentes > 1 ? 's' : ''}
          </span>
        )}

        {conversa.temUrgencia && (ocultos > 0 || mostrarResolvidos) && (
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
              ? `Nenhum recado de ${lado.nome} ainda.`
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
                meuDepartamento={meuDepartamento}
                temUrgencia={conversa.temUrgencia}
                aoMudarEstado={aoMudarEstado}
              />
            ))}
          </ul>
        )}
        <div ref={fim} />
      </div>

      {/* A key faz o React recriar o campo ao trocar de conversa, o que zera
          o rascunho — sem isso, um texto começado para a Cantina apareceria
          na conversa do Kids. */}
      <CampoDeResposta key={conversaId} conversaId={conversaId} aoEnviar={aoEnviar} />
    </section>
  );
}

/**
 * Um recado dentro da conversa. Do outro lado à esquerda, seu à direita.
 *
 * `temUrgencia` esconde todo o aparato de urgência (badge "Urgente", botão
 * resolver/reabrir) em conversas que não envolvem o Audiovisual — ver
 * `conversaTemUrgencia` em `conversas.ts`.
 */
function BalaoDoPainel({
  mensagem,
  meuDepartamento,
  temUrgencia,
  aoMudarEstado,
}: {
  mensagem: Mensagem;
  meuDepartamento: string | null;
  temUrgencia: boolean;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
}) {
  const doOutroLado = mensagem.remetente !== meuDepartamento;
  const urgente = temUrgencia && mensagem.prioridade === 'urgente';
  const resolvido = Boolean(mensagem.resolvidaEm);
  const pulsa = doOutroLado && urgente && !resolvido;

  return (
    <li className={`flex ${doOutroLado ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`entrada max-w-[min(85%,44rem)] rounded-xl border-l-4 border-y border-r p-3.5 ${
          pulsa ? 'pulso-urgente' : ''
        }`}
        style={{
          background: 'var(--fundo-cartao)',
          borderLeftColor:
            doOutroLado && urgente && !resolvido ? 'var(--urgente)' : 'transparent',
          borderTopColor: 'var(--borda)',
          borderRightColor: 'var(--borda)',
          borderBottomColor: 'var(--borda)',
          opacity: resolvido ? 0.62 : 1,
        }}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {urgente && doOutroLado && (
            <span className="rounded-md bg-urgente px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Urgente
            </span>
          )}
          {!doOutroLado && (
            <span className="text-xs font-semibold text-acento">Você</span>
          )}
          {temUrgencia && resolvido && (
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

        {/* Só recado do outro lado se resolve, e só em conversa com
            Audiovisual: resposta sua não é tarefa sua. */}
        {temUrgencia && doOutroLado && (
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
  conversaId,
  aoEnviar,
}: {
  conversaId: string;
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
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) {
        setErro('Sessão expirada. Recarregue a página.');
        return;
      }

      const resposta = await fetch('/api/painel/mensagens', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversaId, texto: conteudo }),
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
            className="h-12 shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
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
