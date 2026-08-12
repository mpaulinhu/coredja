'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAlertaSonoro } from '@/hooks/useAlertaSonoro';
import { useEventos } from '@/hooks/useEventos';
import { dataHora, hora, tempoDecorrido } from '@/lib/formatar';
import type { Area, Mensagem } from '@/lib/types';

/**
 * Painel do audiovisual.
 *
 * Fica num monitor lateral durante o culto. As decisões de layout partem
 * disso: cartões grandes, legíveis de longe, urgentes no topo e destacados,
 * e um som quando chega recado — porque quem opera a mesa não fica olhando
 * para esta tela.
 */

interface Props {
  areasIniciais: Area[];
  pendentesIniciais: Mensagem[];
  historicoInicial: Mensagem[];
}

type Aba = 'pendentes' | 'historico';

export function PainelAudiovisual({
  areasIniciais,
  pendentesIniciais,
  historicoInicial,
}: Props) {
  const [areas, setAreas] = useState(areasIniciais);
  const [pendentes, setPendentes] = useState(pendentesIniciais);
  const [historico, setHistorico] = useState(historicoInicial);
  const [aba, setAba] = useState<Aba>('pendentes');
  const [som, setSom] = useState(true);
  const [respondendo, setRespondendo] = useState<Area | null>(null);
  const [conectado, setConectado] = useState(true);

  const { tocar, liberar } = useAlertaSonoro(som);

  // Guarda os identificadores já vistos para tocar o som só em recado
  // realmente novo — sem isso, resolver um recado dispararia o alerta.
  const conhecidos = useRef<Set<string>>(
    new Set(pendentesIniciais.map((m) => m.id)),
  );

  const porSlug = useMemo(
    () => new Map(areas.map((area) => [area.slug, area])),
    [areas],
  );

  const recarregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/painel/mensagens', {
        cache: 'no-store',
      });
      if (!resposta.ok) return;

      const dados = (await resposta.json()) as {
        areas: Area[];
        pendentes: Mensagem[];
        historico: Mensagem[];
      };

      // Toca apenas para recados vindos de área: a própria resposta do
      // audiovisual não deve alertar quem acabou de escrevê-la.
      const novos = dados.pendentes.filter(
        (m) => !conhecidos.current.has(m.id) && m.autor === 'area',
      );
      if (novos.length > 0) {
        tocar(novos.some((m) => m.prioridade === 'urgente'));
      }
      conhecidos.current = new Set(dados.pendentes.map((m) => m.id));

      setAreas(dados.areas);
      setPendentes(dados.pendentes);
      setHistorico(dados.historico);
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
    if (acao === 'resolver') {
      setPendentes((atuais) => atuais.filter((m) => m.id !== id));
    }

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

  const urgentes = pendentes.filter((m) => m.prioridade === 'urgente').length;

  // Layout em coluna de altura cheia: cabeçalho e barra de ações presos nas
  // pontas, só a lista rola no meio. Com `sticky` numa página de altura livre,
  // a barra de baixo flutuaria no meio dos cartões quando a lista fica longa.
  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-fundo"
      onClickCapture={liberar}
    >
      <header className="shrink-0 border-b border-borda bg-fundo-elevado/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <h1 className="text-xl font-bold tracking-tight text-texto">
            Coredja
          </h1>
          <span className="text-sm text-texto-fraco">Audiovisual</span>

          {!conectado && (
            <span className="rounded-full bg-urgente-fundo px-2.5 py-1 text-xs font-semibold text-urgente">
              Sem conexão
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSom((v) => !v)}
              aria-pressed={som}
              title={som ? 'Desligar som' : 'Ligar som'}
              className="flex h-10 items-center gap-2 rounded-lg border border-borda bg-fundo-cartao px-3 text-sm text-texto-suave hover:bg-borda"
            >
              {som ? <IconeSom /> : <IconeSomMudo />}
              {som ? 'Som ligado' : 'Som desligado'}
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl gap-1 px-5">
          <BotaoAba
            ativo={aba === 'pendentes'}
            onClick={() => setAba('pendentes')}
            rotulo="Recados"
            contagem={pendentes.length}
            destaque={urgentes > 0}
          />
          <BotaoAba
            ativo={aba === 'historico'}
            onClick={() => setAba('historico')}
            rotulo="Histórico"
            contagem={historico.length}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-5 py-5">
        {aba === 'pendentes' ? (
          pendentes.length === 0 ? (
            <VazioPendentes />
          ) : (
            <ul className="gap-3 md:columns-2 [&>li]:mb-3 [&>li]:break-inside-avoid">
              {/* Colunas independentes em vez de grade: um cartão com banner
                  é bem mais alto que um só de texto, e numa grade em linhas
                  isso abriria vazios grandes ao lado dele. Aqui cada coluna
                  se preenche sozinha, e os urgentes entram primeiro. */}
              {pendentes.map((mensagem) => (
                <CartaoRecado
                  key={mensagem.id}
                  mensagem={mensagem}
                  area={porSlug.get(mensagem.areaSlug)}
                  aoResolver={() => mudarEstado(mensagem.id, 'resolver')}
                />
              ))}
            </ul>
          )
        ) : historico.length === 0 ? (
          <p className="py-16 text-center text-sm text-texto-fraco">
            Nada no histórico ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historico.map((mensagem) => (
              <LinhaHistorico
                key={mensagem.id}
                mensagem={mensagem}
                area={porSlug.get(mensagem.areaSlug)}
                aoReabrir={() => mudarEstado(mensagem.id, 'reabrir')}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Barra fixa para iniciar uma conversa com qualquer área. */}
      <div className="shrink-0 border-t border-borda bg-fundo-elevado/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2">
          <span className="text-sm text-texto-fraco">Falar com:</span>
          {areas.map((area) => (
            <button
              key={area.slug}
              type="button"
              onClick={() => setRespondendo(area)}
              className="flex h-10 items-center gap-2 rounded-lg border border-borda bg-fundo-cartao px-3 text-sm font-medium text-texto hover:bg-borda"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: area.cor }}
                aria-hidden="true"
              />
              {area.nome}
            </button>
          ))}
        </div>
      </div>

      {respondendo && (
        <ModalResposta
          area={respondendo}
          aoFechar={() => setRespondendo(null)}
          aoEnviar={recarregar}
        />
      )}
    </div>
  );
}

function BotaoAba({
  ativo,
  onClick,
  rotulo,
  contagem,
  destaque,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  contagem: number;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors"
      style={{
        color: ativo ? 'var(--texto)' : 'var(--texto-fraco)',
        boxShadow: ativo ? 'inset 0 -2px 0 var(--acento)' : 'none',
      }}
    >
      {rotulo}
      <span
        className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{
          background: destaque ? 'var(--urgente)' : 'var(--fundo-cartao)',
          color: destaque ? '#fff' : 'var(--texto-suave)',
        }}
      >
        {contagem}
      </span>
    </button>
  );
}

function VazioPendentes() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-medium text-texto-suave">
        Nenhum recado pendente
      </p>
      <p className="mt-1 text-sm text-texto-fraco">
        Os recados da Cantina e do Kids aparecem aqui automaticamente.
      </p>
    </div>
  );
}

function CartaoRecado({
  mensagem,
  area,
  aoResolver,
}: {
  mensagem: Mensagem;
  area?: Area;
  aoResolver: () => void;
}) {
  const urgente = mensagem.prioridade === 'urgente';
  const doAudiovisual = mensagem.autor === 'audiovisual';

  return (
    <li
      className={`entrada rounded-xl border p-4 ${
        urgente ? 'pulso-urgente' : ''
      }`}
      style={{
        background: urgente ? 'var(--urgente-fundo)' : 'var(--fundo-cartao)',
        borderColor: urgente ? 'var(--urgente)' : 'var(--borda)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: area?.cor ?? 'var(--texto-fraco)' }}
          aria-hidden="true"
        />
        <span className="text-base font-bold text-texto">
          {area?.nome ?? mensagem.areaSlug}
        </span>

        {urgente && (
          <span className="rounded-md bg-urgente px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Urgente
          </span>
        )}

        {doAudiovisual && (
          <span className="rounded-md border border-borda-forte px-2 py-0.5 text-xs font-semibold text-texto-suave">
            Você enviou
          </span>
        )}

        <span className="ml-auto whitespace-nowrap text-sm text-texto-fraco">
          {tempoDecorrido(mensagem.criadaEm)} · {hora(mensagem.criadaEm)}
        </span>
      </div>

      {mensagem.texto && (
        <p className="whitespace-pre-wrap break-words text-[17px] leading-relaxed text-texto">
          {mensagem.texto}
        </p>
      )}

      {mensagem.anexos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {mensagem.anexos.map((anexo) => (
            <li key={anexo.id} className="flex flex-col gap-1">
              <a href={anexo.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anexo.url}
                  alt={anexo.nomeArquivo}
                  className="h-32 w-32 rounded-lg border border-borda object-cover"
                />
              </a>
              <a
                href={anexo.url}
                download={anexo.nomeArquivo}
                className="text-center text-xs font-medium text-acento hover:underline"
              >
                Baixar
              </a>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={aoResolver}
        className="mt-4 h-11 w-full rounded-lg border border-borda-forte bg-fundo-elevado text-sm font-semibold text-texto hover:bg-borda"
      >
        Marcar como resolvido
      </button>
    </li>
  );
}

function LinhaHistorico({
  mensagem,
  area,
  aoReabrir,
}: {
  mensagem: Mensagem;
  area?: Area;
  aoReabrir: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-borda bg-fundo-cartao px-4 py-3">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: area?.cor ?? 'var(--texto-fraco)' }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-texto-suave">
            {area?.nome ?? mensagem.areaSlug}
          </span>
          {mensagem.prioridade === 'urgente' && (
            <span className="text-xs font-bold uppercase text-urgente">
              Urgente
            </span>
          )}
          {mensagem.autor === 'audiovisual' && (
            <span className="text-xs text-texto-fraco">você enviou</span>
          )}
          <span className="text-xs text-texto-fraco">
            {dataHora(mensagem.criadaEm)}
          </span>
        </div>

        {mensagem.texto && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-texto">
            {mensagem.texto}
          </p>
        )}

        {mensagem.anexos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {mensagem.anexos.map((anexo) => (
              <li key={anexo.id}>
                <a href={anexo.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={anexo.url}
                    alt={anexo.nomeArquivo}
                    className="h-16 w-16 rounded border border-borda object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={aoReabrir}
        className="shrink-0 rounded-lg border border-borda px-3 py-1.5 text-xs font-medium text-texto-suave hover:bg-borda"
      >
        Reabrir
      </button>
    </li>
  );
}

function ModalResposta({
  area,
  aoFechar,
  aoEnviar,
}: {
  area: Area;
  aoFechar: () => void;
  aoEnviar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

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
        body: JSON.stringify({ areaSlug: area.slug, texto: conteudo }),
      });
      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
        };
        setErro(dados.erro ?? 'Não foi possível enviar.');
        return;
      }
      await aoEnviar();
      aoFechar();
    } catch {
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      onClick={aoFechar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mensagem para ${area.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-borda bg-fundo-elevado p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: area.cor }}
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-texto">
            Mensagem para {area.nome}
          </h2>
        </div>

        <form onSubmit={enviar}>
          <textarea
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder={`Ex: qual o preço da coxinha?`}
            className="w-full resize-none rounded-xl border border-borda bg-fundo-cartao px-3 py-3 text-[15px] text-texto placeholder:text-texto-fraco"
          />

          {erro && (
            <p role="alert" className="mt-2 text-sm text-urgente">
              {erro}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="h-11 flex-1 rounded-lg border border-borda text-sm font-medium text-texto-suave hover:bg-borda"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="h-11 flex-1 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--acento)' }}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
