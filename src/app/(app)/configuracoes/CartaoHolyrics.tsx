'use client';

import { useState } from 'react';
import {
  normalizarEnderecoDoHolyrics,
} from '@/lib/configuracoes-compartilhado';
import type {
  ConfiguracoesParaTela,
  OrigemDoValor,
  ResultadoDoTeste,
} from '@/lib/configuracoes-compartilhado';
import { GuiaDoHolyrics } from './GuiaDoHolyrics';

interface Props {
  holyrics: ConfiguracoesParaTela['holyrics'];
  ultimaAlteracao?: { por: string; em: string };
  /** Devolve o erro, ou null se gravou. `undefined` no token = não mexer. */
  onSalvar: (mudancas: {
    holyricsUrl?: string;
    holyricsToken?: string;
    holyricsPastaFotos?: string;
  }) => Promise<string | null>;
  onTestar: () => Promise<ResultadoDoTeste | null>;
}

/**
 * Endereço e token do Holyrics — os dois valores que mudam quando a igreja
 * troca o computador do audiovisual ou quando o token precisa ser renovado.
 *
 * O token é tratado como segredo de verdade: a tela nunca recebe o valor
 * real, só a máscara com os 4 últimos caracteres (ver `mascarar`). Trocar é
 * escrever um novo por cima — não há "ver o atual", nem para admin. Por isso
 * o campo começa em modo "guardado", com um botão para substituir, em vez de
 * um `<input>` com os pontinhos dentro: um campo mascarado que ao ser clicado
 * revelasse nada, ou apagasse o valor ao ganhar foco, é pior que explícito.
 */
export function CartaoHolyrics({
  holyrics,
  ultimaAlteracao,
  onSalvar,
  onTestar,
}: Props) {
  const [url, setUrl] = useState(holyrics.url.valor);
  const [pastaFotos, setPastaFotos] = useState(holyrics.pastaFotos.valor);
  const [trocandoToken, setTrocandoToken] = useState(false);
  const [tokenNovo, setTokenNovo] = useState('');
  const [tokenVisivel, setTokenVisivel] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);

  // Nota sobre a sincronização com o servidor: depois de salvar, o valor
  // gravado pode diferir do digitado (a barra final é removida, por exemplo),
  // e o campo precisa passar a mostrar o que de fato ficou. Isso NÃO é feito
  // por um efeito copiando `holyrics.url.valor` para o estado — seria um
  // render em cascata, e o lint barra com razão. Quem resolve é a `key` deste
  // componente em `TelaConfiguracoes`: mudou o valor do servidor, o React
  // monta o cartão de novo e `useState` renasce com o valor certo.

  // Normaliza do MESMO jeito que o servidor antes de comparar (ver o PUT em
  // `/api/configuracoes`). Faz duas coisas:
  //
  // 1. Completa o que falta — digitar "192.168.50.103:8091", que é como o
  //    Holyrics mostra o endereço, vira "http://192.168.50.103:8091" em vez
  //    de virar erro.
  // 2. Iguala a comparação: sem isto, digitar "http://x:8091/" e salvar grava
  //    "http://x:8091" — igual ao que já valia — e a tela fica achando que
  //    ainda há mudança pendente, com o botão Salvar aceso para sempre.
  const urlNormalizada = normalizarEnderecoDoHolyrics(url);
  const urlMudou = urlNormalizada !== holyrics.url.valor;
  const tokenMudou = trocandoToken && tokenNovo.trim().length > 0;
  const pastaFotosMudou = pastaFotos.trim() !== holyrics.pastaFotos.valor;
  const temMudanca = urlMudou || tokenMudou || pastaFotosMudou;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const problema = await onSalvar({
      ...(urlMudou ? { holyricsUrl: urlNormalizada } : {}),
      ...(tokenMudou ? { holyricsToken: tokenNovo.trim() } : {}),
      ...(pastaFotosMudou ? { holyricsPastaFotos: pastaFotos.trim() } : {}),
    });

    setSalvando(false);
    if (problema) {
      setErro(problema);
      return;
    }

    // O token novo sai da memória da tela assim que vira gravado: manter a
    // string por perto sem motivo é o tipo de coisa que acaba num screenshot.
    // O campo passa a mostrar o que de fato ficou gravado — a barra final
    // que o servidor removeu não pode continuar na tela.
    setUrl(urlNormalizada);
    setPastaFotos(pastaFotos.trim());
    setTokenNovo('');
    setTrocandoToken(false);
    setTokenVisivel(false);
    setSalvo(true);
    // O que estava na tela antes do salvamento não vale mais.
    setTeste(null);
  }

  async function testar() {
    setTestando(true);
    setTeste(null);
    const resultado = await onTestar();
    setTestando(false);
    if (resultado) setTeste(resultado);
  }

  return (
    <section className="rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-texto">Holyrics</h2>
          <p className="mt-0.5 text-xs text-texto-fraco">
            O programa que projeta no telão. Ligado, o Coredja manda o aviso e o
            cronômetro do bloco direto para a tela de retorno.
          </p>
        </div>
        <Selo ligado={holyrics.configurado} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* ── Endereço ─────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="holyrics-url"
              className="text-xs font-bold tracking-wide text-texto-suave uppercase"
            >
              Endereço do Holyrics
            </label>
            <input
              id="holyrics-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.0.10:8091"
              spellCheck={false}
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 font-mono text-[15px] text-texto placeholder:text-texto-fraco"
            />
            {/* Esse endereço não é um site: o API Server responde 404 com
                corpo vazio na raiz, e o navegador mostra "Não é possível
                acessar esse site" (ERR_INVALID_RESPONSE) mesmo com tudo
                certo. Aconteceu no uso real — quem conferiu no navegador
                concluiu que o IP estava errado e foi mexer no que
                funcionava. O teste que vale é o botão aqui do lado. */}
            <p className="mt-1.5 text-xs text-texto-fraco">
              <strong className="font-semibold text-texto-suave">
                Não tente abrir esse endereço no navegador.
              </strong>{' '}
              Ele não é um site — só aceita comandos, e o navegador vai dizer
              que não conseguiu acessar mesmo quando está tudo certo. Use o
              &ldquo;Testar conexão&rdquo; para conferir.
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Origem origem={holyrics.url.origem} />
              <span className="text-xs text-texto-fraco">
                O IP do computador onde o Holyrics está aberto, com a porta. Pode
                escrever só <code className="font-mono">192.168.0.10:8091</code>{' '}
                — o resto se completa sozinho.
              </span>
            </div>
          </div>

          {/* ── Token ────────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="holyrics-token"
              className="text-xs font-bold tracking-wide text-texto-suave uppercase"
            >
              Token
            </label>

            {trocandoToken ? (
              <>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="holyrics-token"
                    // `text` quando visível para o gerenciador de senhas do
                    // navegador não se meter, e `password` quando escondido.
                    type={tokenVisivel ? 'text' : 'password'}
                    value={tokenNovo}
                    onChange={(e) => setTokenNovo(e.target.value)}
                    placeholder="Cole aqui o token gerado no Holyrics"
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 font-mono text-[15px] text-texto placeholder:text-texto-fraco"
                  />
                  <button
                    type="button"
                    onClick={() => setTokenVisivel((v) => !v)}
                    aria-pressed={tokenVisivel}
                    className="shrink-0 cursor-pointer rounded-lg border border-borda-forte px-3 text-xs font-semibold text-texto-suave hover:text-texto"
                  >
                    {tokenVisivel ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrocandoToken(false);
                    setTokenNovo('');
                    setTokenVisivel(false);
                  }}
                  className="mt-1.5 cursor-pointer text-xs text-texto-fraco underline underline-offset-2 hover:text-texto"
                >
                  Cancelar a troca e manter o token atual
                </button>
              </>
            ) : (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 font-mono text-[15px] text-texto-suave">
                    {holyrics.token.valor || 'nenhum token guardado'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setTrocandoToken(true)}
                    className="h-11 cursor-pointer rounded-lg border border-borda-forte px-4 text-sm font-semibold text-texto hover:bg-fundo-cartao"
                  >
                    {holyrics.token.valor ? 'Trocar token' : 'Definir token'}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Origem origem={holyrics.token.origem} />
                  <span className="text-xs text-texto-fraco">
                    Por segurança o token não é exibido — só os 4 últimos
                    caracteres, para conferência.
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── Pasta de fotos ──────────────────────────────────────── */}
          <div>
            <label
              htmlFor="holyrics-pasta-fotos"
              className="text-xs font-bold tracking-wide text-texto-suave uppercase"
            >
              Pasta de fotos do Holyrics{' '}
              <span className="font-normal normal-case text-texto-fraco">(opcional)</span>
            </label>
            <input
              id="holyrics-pasta-fotos"
              value={pastaFotos}
              onChange={(e) => setPastaFotos(e.target.value)}
              placeholder="C:\Holyrics\Holyrics\files\media\image"
              spellCheck={false}
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 font-mono text-[15px] text-texto placeholder:text-texto-fraco"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Origem origem={holyrics.pastaFotos.origem} />
              <span className="text-xs text-texto-fraco">
                Onde a ponte salva a arte de um aviso antes de projetar — é a
                mesma pasta onde o Holyrics guarda as fotos que aparecem na
                aba de Fotos dele. Deixe em branco para usar o caminho padrão
                configurado na própria ponte.
              </span>
            </div>
          </div>

          {/* ── Ações ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={!temMudanca || salvando}
              className="h-11 cursor-pointer rounded-lg px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>

            <button
              type="button"
              onClick={testar}
              disabled={testando}
              className="h-11 cursor-pointer rounded-lg border border-borda-forte px-5 text-sm font-semibold text-texto hover:bg-fundo-cartao disabled:opacity-50"
            >
              {testando ? 'Testando…' : 'Testar conexão'}
            </button>

            {salvo && !temMudanca && (
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--sucesso)' }}
              >
                Salvo.
              </span>
            )}
          </div>

          {erro && (
            <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
              {erro}
            </p>
          )}

          {/* O teste bate no Holyrics de verdade: pode demorar até 5 segundos
              e é a única parte da tela com resultado ao vivo. */}
          {teste && <ResultadoTeste resultado={teste} />}

          {ultimaAlteracao && (
            <p className="text-xs text-texto-fraco">
              Última alteração por {ultimaAlteracao.por} em{' '}
              {new Date(ultimaAlteracao.em).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              .
            </p>
          )}
        </div>

        <GuiaDoHolyrics />
      </div>
    </section>
  );
}

/** Ligado/desligado, para ler de relance antes de qualquer texto. */
function Selo({ ligado }: { ligado: boolean }) {
  return (
    <span
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
      style={{
        color: ligado ? 'var(--sucesso)' : 'var(--texto-fraco)',
        background: ligado ? 'var(--sucesso-fundo)' : 'var(--fundo-cartao)',
      }}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: ligado ? 'var(--sucesso)' : 'var(--borda-forte)' }}
      />
      {ligado ? 'Configurado' : 'Não configurado'}
    </span>
  );
}

/**
 * De onde o valor que está valendo veio.
 *
 * Existe por um motivo prático: com as duas camadas (banco e `.env.local`),
 * alguém que editar o arquivo e não vir efeito nenhum ficaria sem pista de
 * que há um valor gravado aqui ganhando dele.
 */
function Origem({ origem }: { origem: OrigemDoValor }) {
  if (origem === 'ausente') return null;

  const doBanco = origem === 'banco';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
      style={{
        color: doBanco ? 'var(--acento-texto-sobre-fundo)' : 'var(--texto-fraco)',
        background: doBanco ? 'var(--acento-suave-fundo)' : 'var(--fundo-cartao)',
      }}
      title={
        doBanco
          ? 'Valor salvo nesta tela. Ele tem prioridade sobre o do arquivo .env.local.'
          : 'Valor vindo do arquivo .env.local do servidor. Salvar aqui passa a valer no lugar dele.'
      }
    >
      {doBanco ? 'salvo nesta tela' : 'vindo do .env.local'}
    </span>
  );
}

/** O que o "Testar conexão" descobriu, com o próximo passo junto. */
function ResultadoTeste({ resultado }: { resultado: ResultadoDoTeste }) {
  const porEstado = {
    ok: {
      cor: 'var(--sucesso)',
      fundo: 'var(--sucesso-fundo)',
      titulo: 'Conectado.',
    },
    // Estado só possível com o Coredja PUBLICADO: o teste direto sempre daria
    // "inalcançável" nesse cenário (o servidor não alcança 192.168.x.x — ver
    // o cabeçalho de holyrics.ts), então a checagem passou pela ponte em vez
    // de tentar direto. Cor de sucesso, e não de aviso: do ponto de vista de
    // quem opera, "a ponte está entregando" é exatamente o resultado bom.
    'ok-pela-ponte': {
      cor: 'var(--sucesso)',
      fundo: 'var(--sucesso-fundo)',
      titulo: 'Conectado pela ponte.',
    },
    recusado: {
      cor: 'var(--urgente)',
      fundo: 'var(--urgente-fundo)',
      titulo: 'O Holyrics respondeu, mas recusou.',
    },
    inalcancavel: {
      cor: 'var(--alerta)',
      fundo: 'var(--alerta-fundo)',
      titulo: 'Não foi possível chegar ao Holyrics.',
    },
    'nao-configurado': {
      cor: 'var(--texto-suave)',
      fundo: 'var(--fundo-cartao)',
      titulo: 'Preencha o endereço e o token primeiro.',
    },
  }[resultado.estado];

  return (
    <div
      role="status"
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: porEstado.cor, background: porEstado.fundo }}
    >
      <p className="text-sm font-bold" style={{ color: porEstado.cor }}>
        {porEstado.titulo}
      </p>
      {resultado.motivo && (
        <p className="mt-1 text-[13px] leading-relaxed text-texto-suave">
          {resultado.motivo}
        </p>
      )}
      {resultado.estado === 'ok' && (
        <p className="mt-1 text-[13px] text-texto-suave">
          {resultado.painelNoAr
            ? 'Há um cronômetro no ar no painel de comunicação agora.'
            : 'O painel de comunicação está sem cronômetro no ar no momento.'}
        </p>
      )}
      {resultado.estado === 'ok-pela-ponte' && (
        <p className="mt-1 text-[13px] text-texto-suave">
          O servidor não alcança o Holyrics direto — normal com o Coredja
          publicado (ver a explicação sobre rede local ao lado). Quem está
          entregando os comandos é a ponte, rodando em{' '}
          <strong className="font-semibold text-texto-suave">
            {resultado.computador}
          </strong>
          .
        </p>
      )}
    </div>
  );
}
