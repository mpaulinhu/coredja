'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagemAnexo } from '@/components/ImagemAnexo';
import { useAlertaSonoro } from '@/hooks/useAlertaSonoro';
import { useEventos } from '@/hooks/useEventos';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { comprimirImagem } from '@/lib/comprimir';
import { AUDIOVISUAL_SLUG, type Conversa } from '@/lib/conversa-compartilhado';
import { dataHora, hora, tempoDecorrido } from '@/lib/formatar';
import { MAXIMO_ANEXOS, TAMANHO_MAXIMO_BYTES } from '@/lib/limites';
import type { Mensagem } from '@/lib/types';

/**
 * Painel de conversas entre departamentos.
 *
 * Refeito em 20/08/2026 a partir de uma tela de referência que o Marcos
 * entregou pronta ("faça a tela exatamente assim"), no mesmo movimento que
 * trouxe a Ordem do Culto para a identidade nova. O que a referência mudou
 * em relação à versão anterior:
 *
 * - **A barra da esquerda vira a tela inteira de navegação.** Ela deixa de
 *   ser uma lista magra ao lado do menu do app e passa a ser a coluna de
 *   340px com busca, avatar, prévia e contador — como num aplicativo de
 *   mensagem. O menu do app sai daqui (ver `layoutProprio` abaixo).
 * - **Busca**, que filtra por nome de departamento E por conteúdo de recado.
 * - **Faixa de alerta** com "N recados aguardando você", o mais antigo, e
 *   "Resolver todos" — antes só existia o contador por conversa, e resolver
 *   cinco recados exigia cinco cliques em cinco cartões.
 * - **Autor "Departamento · Pessoa"** no cabeçalho de cada recado. Antes só
 *   aparecia o departamento, o que num departamento com vários voluntários
 *   não dizia com quem se estava falando.
 * - **Cabeçalho fora do balão**: autor e horário sobem para uma linha acima,
 *   e o balão fica só com o conteúdo. É o que deixa a coluna legível de
 *   longe, que é como esta tela é lida — ela fica num monitor lateral
 *   durante o culto, daí também os alvos grandes e o alerta sonoro.
 *
 * O aparato de urgência (urgente, pendente, resolver/reabrir) continua
 * restrito a conversas que envolvem o Audiovisual — ver `conversaTemUrgencia`
 * em `conversa-compartilhado.ts`.
 */

/** Id estável de uma conversa: mesmo algoritmo de `idDaConversa`. */
function idDaConversa(a: string, b: string): string {
  return [a, b].sort().join('__');
}

/**
 * A inicial que vai no avatar. `Array.from` em vez de `[0]` porque o nome
 * pode começar com um caractere fora do plano básico (emoji), que em UTF-16
 * ocupa duas posições e sairia cortado pela metade.
 */
function inicial(nome: string): string {
  return (Array.from(nome.trim())[0] ?? '?').toUpperCase();
}

/**
 * Se o texto do recado é uma resposta a `termo`. Usada pela busca da barra
 * lateral, que casa tanto no nome do departamento quanto no conteúdo.
 */
function contem(texto: string, termo: string): boolean {
  return texto.toLowerCase().includes(termo);
}

export function PainelAudiovisual() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [meuDepartamento, setMeuDepartamento] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [som, setSom] = useState(true);
  const [conectado, setConectado] = useState(true);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [busca, setBusca] = useState('');
  // No celular a lista e a conversa não cabem lado a lado — ver `ListaDeConversas`.
  const [verConversaNoCelular, setVerConversaNoCelular] = useState(false);

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

  /**
   * Aplica resolver/reabrir na tela antes da resposta do servidor: o clique
   * precisa parecer instantâneo no meio do culto. O `recarregar` em seguida
   * confirma (ou corrige, se a chamada falhou).
   *
   * Recebe uma lista para servir também ao "Resolver todos", que muda vários
   * de uma vez — pintar um por um faria a faixa de alerta piscar a contagem
   * descendo de 3 para 2 para 1.
   */
  const pintarEstado = useCallback(
    (ids: string[], acao: 'resolver' | 'reabrir') => {
      const alvo = new Set(ids);
      setConversas((atuais) =>
        atuais.map((conversa) => {
          if (!conversa.mensagens.some((m) => alvo.has(m.id))) return conversa;

          const mensagens = conversa.mensagens.map((m) =>
            alvo.has(m.id)
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
            ? mensagens.filter(
                (m) => m.remetente !== AUDIOVISUAL_SLUG && !m.resolvidaEm,
              )
            : [];
          return {
            ...conversa,
            mensagens,
            pendentes: pendentes.length,
            temUrgente: pendentes.some((m) => m.prioridade === 'urgente'),
          };
        }),
      );
    },
    [],
  );

  const enviarEstado = useCallback(
    async (id: string, acao: 'resolver' | 'reabrir') => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      await fetch(`/api/painel/mensagens/${id}`, {
        method: 'PATCH',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
    },
    [],
  );

  const mudarEstado = useCallback(
    async (id: string, acao: 'resolver' | 'reabrir') => {
      pintarEstado([id], acao);
      try {
        await enviarEstado(id, acao);
      } catch {
        // O recarregar abaixo devolve o estado real se a chamada falhou.
      }
      await recarregar();
    },
    [pintarEstado, enviarEstado, recarregar],
  );

  /**
   * "Resolver todos" da faixa de alerta: resolve de uma vez os pendentes da
   * conversa aberta.
   *
   * Reaproveita a rota por recado (`PATCH .../{id}`) em vez de uma rota nova
   * em lote — assim cada mensagem passa exatamente pelas mesmas checagens de
   * permissão que passaria num clique individual, sem uma segunda
   * implementação da mesma regra para manter em dia.
   */
  const resolverTodos = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      pintarEstado(ids, 'resolver');
      try {
        await Promise.all(ids.map((id) => enviarEstado(id, 'resolver')));
      } catch {
        // idem `mudarEstado`.
      }
      await recarregar();
    },
    [pintarEstado, enviarEstado, recarregar],
  );

  const totalPendentes = conversas.reduce((soma, c) => soma + c.pendentes, 0);

  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(() => {
    if (!termo) return conversas;
    return conversas.filter((conversa) => {
      const nomes = `${conversa.deptoA.nome} ${conversa.deptoB.nome}`;
      return (
        contem(nomes, termo) ||
        conversa.mensagens.some(
          (m) => contem(m.texto, termo) || contem(m.autor ?? '', termo),
        )
      );
    });
  }, [conversas, termo]);

  function escolher(id: string) {
    setAbertaId(id);
    setMostrarResolvidos(false);
    setVerConversaNoCelular(true);
  }

  return (
    // `h-full`, e não `100dvh`: acima desta tela está a barra de conta do
    // `ExigeLogin`, então o que cabe aqui é o que sobrou da janela. O
    // html/body ganharam altura real em `globals.css` para esta cadeia de
    // `h-full`/`flex-1` ter de que descontar.
    <div className="flex h-full overflow-hidden bg-fundo-fundo" onClickCapture={liberar}>
      {/* Abaixo de `md` só uma das duas colunas aparece por vez: 340px de
          lista mais a conversa não cabem em 390px sem rolagem lateral. */}
      <ListaDeConversas
        className={verConversaNoCelular ? 'hidden md:flex' : 'flex'}
        conversas={filtradas}
        meuDepartamento={meuDepartamento}
        abertaId={abertaId}
        totalPendentes={totalPendentes}
        conectado={conectado}
        busca={busca}
        aoBuscar={setBusca}
        aoEscolher={escolher}
      />

      <main
        className={`min-w-0 flex-1 flex-col ${
          verConversaNoCelular ? 'flex' : 'hidden md:flex'
        }`}
      >
        {aberta ? (
          <PainelDaConversa
            conversa={aberta}
            meuDepartamento={meuDepartamento}
            som={som}
            aoAlternarSom={() => setSom((v) => !v)}
            mostrarResolvidos={mostrarResolvidos}
            aoAlternarResolvidos={() => setMostrarResolvidos((v) => !v)}
            aoMudarEstado={mudarEstado}
            aoResolverTodos={resolverTodos}
            aoEnviar={recarregar}
            aoVoltar={() => setVerConversaNoCelular(false)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-texto-fraco">
              {carregando
                ? 'Carregando…'
                : conversas.length === 0
                  ? 'Nenhuma conversa por aqui ainda.'
                  : 'Escolha uma conversa para ver os recados.'}
            </p>
          </div>
        )}
      </main>
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

/**
 * Avatar redondo com a inicial, na cor do departamento.
 *
 * A cor vem do dado (`Departamento.cor`, escolhida no CRUD) e por isso vai
 * inline — é a exceção legítima à regra de "só token". O texto por cima é
 * `--acento-texto`, o mesmo par escuro que o botão principal usa sobre
 * laranja: as cores de departamento são todas de meio-tom, e um texto escuro
 * lê melhor sobre todas elas que um claro.
 */
function Avatar({
  nome,
  cor,
  tamanho = 'h-11 w-11 text-base',
}: {
  nome: string;
  cor: string;
  tamanho?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${tamanho} flex shrink-0 items-center justify-center rounded-full font-extrabold`}
      style={{ background: cor, color: 'var(--acento-texto)' }}
    >
      {inicial(nome)}
    </span>
  );
}

/** Coluna da esquerda: busca, uma linha por conversa, e o rodapé. */
function ListaDeConversas({
  className,
  conversas,
  meuDepartamento,
  abertaId,
  totalPendentes,
  conectado,
  busca,
  aoBuscar,
  aoEscolher,
}: {
  className: string;
  conversas: Conversa[];
  meuDepartamento: string | null;
  abertaId: string | null;
  totalPendentes: number;
  conectado: boolean;
  busca: string;
  aoBuscar: (valor: string) => void;
  aoEscolher: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Conversas"
      className={`w-full shrink-0 flex-col border-r border-borda bg-fundo-elevado md:w-[21.25rem] ${className}`}
    >
      <div className="flex shrink-0 flex-col gap-4 border-b border-borda px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          {/* Volta para o resto do app. A tela usa layout próprio, sem o menu
              lateral (ver `layout.tsx` do painel), então este link é a única
              saída — mesmo papel do "← Todas as ordens" da Execução do Culto. */}
          <Link
            href="/culto"
            className="-ml-1 flex min-h-11 items-center gap-2 rounded-lg px-1 text-[21px] font-extrabold tracking-tight text-texto hover:text-acento-forte"
          >
            <span aria-hidden="true" className="text-base">
              ←
            </span>
            Coredja
          </Link>

          {totalPendentes > 0 && (
            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{
                background: 'var(--urgente-fundo)',
                color: 'var(--urgente)',
              }}
            >
              {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!conectado && (
          <p
            role="status"
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{
              background: 'var(--urgente-fundo)',
              color: 'var(--urgente)',
            }}
          >
            Sem conexão — tentando de novo.
          </p>
        )}

        <div className="flex h-11 items-center gap-2.5 rounded-xl border border-borda bg-fundo-cartao px-3.5 focus-within:border-borda-forte">
          <IconeBusca />
          <label htmlFor="busca-conversas" className="sr-only">
            Buscar departamento ou recado
          </label>
          <input
            id="busca-conversas"
            type="search"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            placeholder="Buscar departamento ou recado"
            className="min-w-0 flex-1 bg-transparent text-sm text-texto outline-none placeholder:text-texto-fraco"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {conversas.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-texto-fraco">
            {busca.trim()
              ? 'Nenhuma conversa com esse termo.'
              : 'Nenhuma conversa por aqui ainda.'}
          </p>
        ) : (
          <ul>
            {conversas.map((conversa) => {
              const id = idDaConversa(conversa.deptoA.slug, conversa.deptoB.slug);
              const ativa = id === abertaId;
              const lado = outroLado(conversa, meuDepartamento);
              const mostraCracha = conversa.temUrgencia && conversa.pendentes > 0;

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => aoEscolher(id)}
                    aria-current={ativa ? 'true' : undefined}
                    className="mb-1.5 grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-2xl p-3.5 text-left transition-colors hover:bg-fundo-cartao"
                    style={{
                      background: ativa ? 'var(--acento-suave-fundo)' : undefined,
                      boxShadow: ativa ? 'inset 3px 0 0 var(--acento)' : undefined,
                    }}
                  >
                    <Avatar nome={lado.nome} cor={lado.cor} />

                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span
                          className="truncate text-[15px] font-bold"
                          style={{
                            color: ativa
                              ? 'var(--acento-texto-sobre-fundo)'
                              : 'var(--texto)',
                          }}
                        >
                          {lado.nome}
                        </span>
                        {conversa.temUrgente && (
                          <span
                            aria-hidden="true"
                            className="pulso-ao-vivo h-[7px] w-[7px] shrink-0 rounded-full"
                            style={{ background: 'var(--urgente)' }}
                          />
                        )}
                      </span>

                      <span className="mt-1 block truncate text-[13px] text-texto-fraco">
                        {conversa.ultima
                          ? `${
                              conversa.ultima.remetente === meuDepartamento
                                ? 'Você: '
                                : ''
                            }${
                              conversa.ultima.texto ||
                              (conversa.ultima.anexos.length > 0
                                ? '📷 imagem'
                                : '')
                            }`
                          : 'Nenhum recado ainda'}
                      </span>
                    </span>

                    <span className="flex flex-col items-end gap-1.5">
                      {conversa.ultima && (
                        <span className="numero text-xs text-texto-fraco">
                          {hora(conversa.ultima.criadaEm)}
                        </span>
                      )}
                      {mostraCracha && (
                        <span
                          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold"
                          style={{
                            background: conversa.temUrgente
                              ? 'var(--urgente)'
                              : 'var(--borda-forte)',
                            color: conversa.temUrgente
                              ? 'var(--acento-texto)'
                              : 'var(--texto)',
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
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Criar departamento é CRUD de admin e já tem tela própria — daqui o
          botão só leva para lá, em vez de duplicar o formulário. */}
      <div className="shrink-0 border-t border-borda p-3.5">
        <Link
          href="/departamentos"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-borda-forte text-sm font-semibold text-texto-suave transition-colors hover:border-acento hover:text-acento-forte"
        >
          + Novo departamento
        </Link>
      </div>
    </nav>
  );
}

/** Coluna da direita: a conversa aberta, com o campo de resposta embaixo. */
function PainelDaConversa({
  conversa,
  meuDepartamento,
  som,
  aoAlternarSom,
  mostrarResolvidos,
  aoAlternarResolvidos,
  aoMudarEstado,
  aoResolverTodos,
  aoEnviar,
  aoVoltar,
}: {
  conversa: Conversa;
  meuDepartamento: string | null;
  som: boolean;
  aoAlternarSom: () => void;
  mostrarResolvidos: boolean;
  aoAlternarResolvidos: () => void;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
  aoResolverTodos: (ids: string[]) => Promise<void>;
  aoEnviar: () => Promise<void>;
  aoVoltar: () => void;
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

  // Os que o botão "Resolver todos" alcança: mesma regra de `pendentes` no
  // servidor — o que chegou para o Audiovisual e ainda está aberto.
  const pendentes = conversa.temUrgencia
    ? conversa.mensagens.filter(
        (m) => m.remetente !== AUDIOVISUAL_SLUG && !m.resolvidaEm,
      )
    : [];
  const maisAntigo = pendentes[0] ?? null;

  // Rola para o fim ao trocar de conversa ou chegar mensagem nova.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [conversaId, conversa.mensagens.length, mostrarResolvidos]);

  const total = conversa.mensagens.length;
  const resumo =
    conversa.temUrgencia && pendentes.length > 0
      ? `${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''} · ${total} recado${total === 1 ? '' : 's'}`
      : `${total} recado${total === 1 ? '' : 's'}${
          conversa.temUrgencia && total > 0 ? ' · tudo resolvido' : ''
        }`;

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-borda bg-fundo-elevado px-4 py-3 md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          {/* Só no celular: no desktop a lista está sempre à vista ao lado. */}
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar para as conversas"
            className="-ml-1 flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-texto-suave hover:text-texto md:hidden"
          >
            <span aria-hidden="true">←</span>
          </button>

          <Avatar
            nome={lado.nome}
            cor={lado.cor}
            tamanho="h-10 w-10 text-[15px]"
          />

          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-texto">
              {lado.nome}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-texto-fraco">{resumo}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {conversa.temUrgencia && (ocultos > 0 || mostrarResolvidos) && (
            <button
              type="button"
              onClick={aoAlternarResolvidos}
              className="hidden h-10 items-center rounded-xl border border-borda bg-fundo-cartao px-4 text-[13px] font-semibold text-texto-suave transition-colors hover:text-texto sm:flex"
            >
              {mostrarResolvidos
                ? 'Ocultar resolvidos'
                : `Ver resolvidos (${ocultos})`}
            </button>
          )}

          <button
            type="button"
            onClick={aoAlternarSom}
            aria-pressed={som}
            title={som ? 'Desligar som' : 'Ligar som'}
            className="flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition-colors sm:px-4"
            style={{
              borderColor: som ? 'var(--acento-suave-borda)' : 'var(--borda)',
              background: som ? 'var(--acento-suave-fundo)' : 'var(--fundo-cartao)',
              color: som
                ? 'var(--acento-texto-sobre-fundo)'
                : 'var(--texto-fraco)',
            }}
          >
            {som ? <IconeSom /> : <IconeSomMudo />}
            <span className="hidden md:inline">
              {som ? 'Som ligado' : 'Som desligado'}
            </span>
          </button>
        </div>
      </header>

      {pendentes.length > 0 && maisAntigo && (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-7"
          style={{
            background: 'var(--urgente-fundo)',
            borderColor: 'var(--acento-suave-borda)',
          }}
        >
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: 'var(--urgente)' }}
            />
            <strong className="font-extrabold" style={{ color: 'var(--urgente)' }}>
              {pendentes.length} recado{pendentes.length > 1 ? 's' : ''} aguardando
              você
            </strong>
            <span className="text-texto-suave">
              o mais antigo {tempoDecorrido(maisAntigo.criadaEm)} · {hora(maisAntigo.criadaEm)}
            </span>
          </p>

          <button
            type="button"
            onClick={() => void aoResolverTodos(pendentes.map((m) => m.id))}
            className="flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-[13px] font-bold transition-opacity hover:opacity-85"
            style={{
              borderColor: 'var(--urgente)',
              color: 'var(--urgente)',
            }}
          >
            Resolver todos
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-2 md:px-7">
        {visiveis.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'var(--fundo-cartao)', color: 'var(--texto-fraco)' }}
              aria-hidden="true"
            >
              ◌
            </div>
            <p className="text-lg font-bold text-texto">
              {conversa.mensagens.length === 0
                ? 'Nenhum recado ainda'
                : 'Tudo resolvido por aqui'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-texto-fraco">
              {conversa.mensagens.length === 0
                ? 'Escreva abaixo para avisar a equipe. Recados urgentes aparecem com destaque e alerta sonoro.'
                : 'Nenhum recado aguardando resposta nesta conversa.'}
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-[57.5rem] flex-col gap-4">
            {visiveis.map((mensagem) => (
              <BalaoDoPainel
                key={mensagem.id}
                mensagem={mensagem}
                nomeDoLado={lado.nome}
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
      <CampoDeResposta
        key={conversaId}
        conversaId={conversaId}
        nomeDoLado={lado.nome}
        temUrgencia={conversa.temUrgencia}
        aoEnviar={aoEnviar}
      />
    </>
  );
}

/**
 * Um recado dentro da conversa. Do outro lado à esquerda, seu à direita.
 *
 * O cabeçalho ("Departamento · Pessoa" e o horário) fica FORA do balão, numa
 * linha acima — é o que a referência faz, e o que deixa a coluna de recados
 * legível de relance: o olho corre pelos autores sem ter de entrar em cada
 * caixa.
 *
 * `temUrgencia` esconde todo o aparato de urgência (selo "URGENTE", botão
 * resolver/reabrir) em conversas que não envolvem o Audiovisual — ver
 * `conversaTemUrgencia` em `conversa-compartilhado.ts`.
 */
function BalaoDoPainel({
  mensagem,
  nomeDoLado,
  meuDepartamento,
  temUrgencia,
  aoMudarEstado,
}: {
  mensagem: Mensagem;
  /** Nome do departamento do outro lado, para assinar o recado dele. */
  nomeDoLado: string;
  meuDepartamento: string | null;
  temUrgencia: boolean;
  aoMudarEstado: (id: string, acao: 'resolver' | 'reabrir') => Promise<void>;
}) {
  const doOutroLado = mensagem.remetente !== meuDepartamento;
  const urgente = temUrgencia && mensagem.prioridade === 'urgente';
  const resolvido = Boolean(mensagem.resolvidaEm);
  const destacado = doOutroLado && urgente && !resolvido;

  // "Departamento · Pessoa" quando se sabe quem escreveu; só o departamento
  // em recado gravado antes do campo `autor` existir, ou vindo do link de
  // área (que não tem pessoa por trás). Ver `Mensagem.autor`.
  const departamento = doOutroLado ? nomeDoLado : 'Você';
  const assinatura = mensagem.autor
    ? `${departamento} · ${mensagem.autor}`
    : departamento;

  return (
    <li
      className={`flex flex-col gap-1.5 ${
        doOutroLado ? 'items-start' : 'items-end'
      }`}
    >
      <div className="flex max-w-full items-center gap-2.5 px-1">
        <span
          className="truncate text-[13px] font-bold"
          style={{
            color: doOutroLado
              ? 'var(--texto-suave)'
              : 'var(--acento-texto-sobre-fundo)',
          }}
        >
          {assinatura}
        </span>
        <span
          className="numero shrink-0 text-xs text-texto-fraco"
          title={dataHora(mensagem.criadaEm)}
        >
          {tempoDecorrido(mensagem.criadaEm)} · {hora(mensagem.criadaEm)}
        </span>
      </div>

      <div
        className={`entrada flex w-full max-w-[38.75rem] flex-col gap-3 rounded-2xl border p-4 ${
          destacado ? 'pulso-urgente' : ''
        }`}
        style={{
          background: destacado
            ? 'var(--urgente-fundo)'
            : doOutroLado
              ? 'var(--fundo-cartao)'
              : 'var(--acento-suave-fundo)',
          borderColor: destacado
            ? 'var(--urgente)'
            : doOutroLado
              ? 'var(--borda)'
              : 'var(--acento-suave-borda)',
          boxShadow: destacado ? 'inset 4px 0 0 var(--urgente)' : undefined,
          opacity: resolvido ? 0.72 : 1,
        }}
      >
        {urgente && doOutroLado && !resolvido && (
          <span
            className="self-start rounded-md px-2.5 py-1 text-[11px] font-extrabold tracking-[0.1em]"
            style={{ background: 'var(--urgente)', color: 'var(--acento-texto)' }}
          >
            URGENTE
          </span>
        )}

        {mensagem.texto && (
          <p
            className="text-[16.5px] leading-relaxed break-words whitespace-pre-wrap"
            style={{ color: resolvido ? 'var(--texto-suave)' : 'var(--texto)' }}
          >
            {mensagem.texto}
          </p>
        )}

        {mensagem.anexos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {mensagem.anexos.map((anexo) => (
              <li key={anexo.id}>
                <ImagemAnexo anexo={anexo} tamanho="h-32 w-32" mostrarDownload />
              </li>
            ))}
          </ul>
        )}

        {/* Só recado do outro lado se resolve, e só em conversa com
            Audiovisual: resposta sua não é tarefa sua. */}
        {temUrgencia && doOutroLado && !resolvido && (
          <button
            type="button"
            onClick={() => void aoMudarEstado(mensagem.id, 'resolver')}
            className="flex min-h-11 items-center self-start rounded-xl border border-borda-forte bg-fundo-elevado px-4 text-sm font-bold text-texto transition-colors hover:bg-borda"
          >
            ✓ Marcar como resolvido
          </button>
        )}

        {temUrgencia && resolvido && (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-sucesso">
            <span aria-hidden="true">✓</span>
            <span>resolvido</span>
            {doOutroLado && (
              <button
                type="button"
                onClick={() => void aoMudarEstado(mensagem.id, 'reabrir')}
                className="ml-1 font-semibold text-texto-fraco underline hover:text-texto"
              >
                reabrir
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Campo de resposta, fixo no rodapé da conversa aberta. */
function CampoDeResposta({
  conversaId,
  nomeDoLado,
  temUrgencia,
  aoEnviar,
}: {
  conversaId: string;
  nomeDoLado: string;
  /** Sem Audiovisual na conversa não há "urgente" — ver `conversaTemUrgencia`. */
  temUrgencia: boolean;
  aoEnviar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [imagens, setImagens] = useState<{ arquivo: File; previa: string }[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const temConteudo = texto.trim().length > 0 || imagens.length > 0;

  async function escolherImagens(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhidas = Array.from(evento.target.files ?? []);
    if (escolhidas.length === 0) return;

    if (imagens.length + escolhidas.length > MAXIMO_ANEXOS) {
      setErro(`Envie no máximo ${MAXIMO_ANEXOS} imagens por recado.`);
      return;
    }

    // Avisa aqui, antes do envio: subir uma foto grande pelo Wi-Fi da igreja
    // para só então receber a recusa do servidor custa tempo no meio do culto.
    const grande = escolhidas.find((a) => a.size > TAMANHO_MAXIMO_BYTES);
    if (grande) {
      const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
      setErro(`"${grande.name}" passa de ${limite} MB e não pode ser enviada.`);
      return;
    }

    setErro(null);
    setPreparando(true);
    try {
      const novas = await Promise.all(
        escolhidas.map(async (original) => {
          const arquivo = await comprimirImagem(original);
          return { arquivo, previa: URL.createObjectURL(arquivo) };
        }),
      );
      setImagens((atuais) => [...atuais, ...novas]);
    } finally {
      setPreparando(false);
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  }

  function removerImagem(indice: number) {
    setImagens((atuais) => {
      const alvo = atuais[indice];
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return atuais.filter((_, i) => i !== indice);
    });
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!temConteudo || enviando || preparando) return;

    setEnviando(true);
    setErro(null);
    try {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) {
        setErro('Sessão expirada. Recarregue a página.');
        return;
      }

      // Com imagem vai multipart; sem imagem, JSON — o servidor aceita os
      // dois (ver `POST /api/painel/mensagens`) e o JSON evita montar um
      // FormData no caminho mais comum, que é o recado só de texto.
      let resposta: Response;
      if (imagens.length > 0) {
        const form = new FormData();
        form.set('conversaId', conversaId);
        form.set('texto', conteudo);
        form.set('prioridade', urgente ? 'urgente' : 'normal');
        for (const img of imagens) form.append('imagens', img.arquivo);
        resposta = await fetch('/api/painel/mensagens', {
          method: 'POST',
          headers: cabecalho,
          body: form,
        });
      } else {
        resposta = await fetch('/api/painel/mensagens', {
          method: 'POST',
          headers: { ...cabecalho, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversaId,
            texto: conteudo,
            prioridade: urgente ? 'urgente' : 'normal',
          }),
        });
      }

      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
        };
        setErro(dados.erro ?? 'Não foi possível enviar.');
        return;
      }

      for (const img of imagens) URL.revokeObjectURL(img.previa);
      setTexto('');
      setUrgente(false);
      setImagens([]);
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
      className="shrink-0 border-t border-borda bg-fundo-elevado px-4 pt-4 pb-5 md:px-7"
    >
      <div className="mx-auto flex max-w-[57.5rem] flex-col gap-3">
        {erro && (
          <p role="alert" className="text-sm font-semibold text-urgente">
            {erro}
          </p>
        )}

        <div className="flex items-end gap-3">
          <div
            className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-2xl border bg-fundo-cartao p-3"
            style={{
              borderColor: temConteudo
                ? urgente
                  ? 'var(--urgente)'
                  : 'var(--borda-forte)'
                : 'var(--borda)',
            }}
          >
            <label htmlFor="resposta" className="sr-only">
              Escrever recado para {nomeDoLado}
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
              rows={2}
              placeholder={`Escrever recado para ${nomeDoLado}…`}
              className="max-h-40 w-full resize-none bg-transparent text-base leading-relaxed text-texto outline-none placeholder:text-texto-fraco"
            />

            {imagens.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {imagens.map((img, indice) => (
                  <li key={img.previa} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previa}
                      alt={img.arquivo.name}
                      className="h-16 w-16 rounded-lg border border-borda object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removerImagem(indice)}
                      aria-label={`Remover ${img.arquivo.name}`}
                      className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-borda text-xs font-bold"
                      style={{
                        background: 'var(--fundo-elevado)',
                        color: 'var(--texto)',
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Uma linha só, com rolagem lateral no celular em vez de quebra:
                três botões empilhando em duas ou três fileiras comeriam a
                altura de quem está LENDO os recados, que é o principal desta
                tela. `-mx-1 px-1` dá folga para o anel de foco não ser
                cortado pelo `overflow`. */}
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {temUrgencia && (
                <button
                  type="button"
                  onClick={() => setUrgente((v) => !v)}
                  aria-pressed={urgente}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold tracking-wide transition-colors"
                  style={{
                    borderColor: urgente ? 'var(--urgente)' : 'var(--borda)',
                    background: urgente ? 'var(--urgente)' : 'transparent',
                    color: urgente ? 'var(--acento-texto)' : 'var(--texto-fraco)',
                  }}
                >
                  <span aria-hidden="true">●</span> URGENTE
                </button>
              )}

              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                disabled={preparando || imagens.length >= MAXIMO_ANEXOS}
                className="h-9 shrink-0 rounded-lg border border-borda px-3 text-xs font-semibold text-texto-suave transition-colors hover:text-texto disabled:opacity-50"
              >
                {preparando ? 'Preparando…' : 'Anexar imagem'}
              </button>

              <input
                ref={inputArquivo}
                type="file"
                accept="image/*"
                multiple
                onChange={escolherImagens}
                className="hidden"
              />

              {/* Publicar no telão é fluxo próprio (aviso cadastrado +
                  permissão `avisos:publicar`), então daqui vai um link para a
                  tela que faz isso, em vez de um segundo caminho de envio ao
                  Holyrics para manter em dia. */}
              <Link
                href="/avisos"
                className="flex h-9 shrink-0 items-center rounded-lg border border-borda px-3 text-xs font-semibold text-texto-suave transition-colors hover:text-texto"
              >
                Enviar ao telão
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={!temConteudo || enviando || preparando}
            className="h-14 shrink-0 rounded-2xl px-5 text-base font-extrabold transition-opacity disabled:opacity-50 md:h-16 md:px-8"
            style={{
              background: temConteudo ? 'var(--acento)' : 'var(--fundo-cartao)',
              color: temConteudo ? 'var(--acento-texto)' : 'var(--texto-fraco)',
              boxShadow: temConteudo
                ? '0 12px 30px -14px var(--acento-sombra)'
                : undefined,
            }}
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>

        {/* A parte sobre o alerta sonoro só aparece de `sm` para cima: no
            celular ela ocuparia duas linhas a mais no rodapé, roubando altura
            de quem está lendo os recados. */}
        <p className="numero text-xs leading-relaxed text-texto-fraco">
          Enter envia · Shift+Enter quebra linha
          {temUrgencia && (
            <span className="hidden sm:inline">
              {' '}
              · recados urgentes tocam alerta em quem está no controle
            </span>
          )}
        </p>
      </div>
    </form>
  );
}

function IconeBusca() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="shrink-0 text-texto-fraco"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  );
}

function IconeSom() {
  return (
    <svg
      width="15"
      height="15"
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
    </svg>
  );
}

function IconeSomMudo() {
  return (
    <svg
      width="15"
      height="15"
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
