/**
 * Se o telão está alcançável agora — a informação que a tela usa para avisar
 * antes do domingo, e não durante.
 *
 * O problema que isto resolve: até aqui, a única forma de descobrir que o
 * Holyrics estava fora do ar era clicar em "Projetar" e ver o recado de erro.
 * No domingo, ao vivo, esse é o pior momento possível para descobrir. Aqui a
 * tela pergunta ANTES e mostra um selo de "telão desconectado" ao lado dos
 * botões que dependem dele.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE UMA SONDA PRÓPRIA, E NÃO REAPROVEITAR `testarConexaoHolyrics`
 * ────────────────────────────────────────────────────────────────────────────
 * `testarConexaoHolyrics` (ver `holyrics.ts`) bate no Holyrics toda vez que é
 * chamada, e é isso que se quer de um botão "Testar conexão" que alguém
 * apertou de propósito. Aqui é o contrário: a pergunta é feita por VÁRIAS
 * telas, repetidamente, sem ninguém pedir. Sem cache, abrir a Ordem do Culto
 * com três pessoas na sala viraria três chamadas de rede a cada carregamento,
 * cada uma podendo travar 5 segundos se o PC do audiovisual estiver desligado.
 *
 * Por isso o resultado vale por `VALIDADE_MS`, e uma consulta dentro da
 * janela responde com o que já se sabe, sem tocar a rede.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE MUDA QUANDO A PONTE EXISTIR
 * ────────────────────────────────────────────────────────────────────────────
 * Hoje o servidor fala direto com o Holyrics, o que só funciona quando os dois
 * estão na mesma rede. Publicado na internet, isso deixa de valer (endereço
 * `192.168.x.x` é privado — ver o cabeçalho de `holyrics.ts`), e a resposta
 * daqui passa a ser sempre "desconectado", corretamente: o telão de fato não
 * é alcançável dali.
 *
 * Quando a ponte existir — um programa no PC do audiovisual repassando os
 * comandos —, é ela quem vai registrar que está viva, e esta função passa a
 * ler esse registro em vez de sondar a rede. A ASSINATURA não muda, então as
 * telas que já mostram o selo não precisam ser tocadas de novo.
 */

import { configHolyrics } from './holyrics';

/**
 * Quanto tempo uma resposta vale antes de perguntar de novo.
 *
 * 30 segundos: curto o bastante para o selo ficar certo em minutos de
 * preparação (ligar o Holyrics e ver a tela reagir sem F5), e longo o
 * bastante para navegar entre telas sem gerar uma rajada de chamadas.
 */
const VALIDADE_MS = 30_000;

/**
 * Prazo curto de propósito, bem menor que os 5s de `holyrics.ts`.
 *
 * Aqui ninguém pediu esta consulta — ela acontece ao abrir a tela. Segurar o
 * carregamento por 5 segundos por causa de um selo informativo seria pior que
 * o problema que ele resolve. Dentro da rede local o Holyrics responde em
 * poucos milissegundos; se passou de 1,5s, ou ele não está lá, ou a rede está
 * ruim o suficiente para o automático não ser confiável mesmo.
 */
const PRAZO_MS = 1500;

export type EstadoDoTelao =
  /** Sem endereço/token configurados — não há o que estar conectado. */
  | 'nao-configurado'
  /** O Holyrics respondeu. Projetar e cronômetro vão funcionar. */
  | 'conectado'
  /** Configurado, mas não respondeu. Projetar não vai surtir efeito. */
  | 'desconectado';

interface Lembrado {
  estado: EstadoDoTelao;
  expiraEm: number;
}

let lembrado: Lembrado | null = null;

/**
 * Uma consulta em andamento, compartilhada por quem chegar enquanto ela corre.
 *
 * Sem isto, três telas abertas ao mesmo tempo (o que acontece no domingo:
 * cabine, palco e celular) disparariam três sondas simultâneas — o cache só
 * pega quem chega DEPOIS da primeira terminar, não quem chega junto.
 */
let emAndamento: Promise<EstadoDoTelao> | null = null;

/**
 * Como está o telão. Nunca lança e nunca demora mais que `PRAZO_MS`.
 *
 * `forcar: true` ignora o que está lembrado — é o que o botão "Testar
 * conexão" usa depois de alguém salvar um endereço novo, quando esperar a
 * validade vencer seria confuso.
 */
export async function estadoDoTelao(forcar = false): Promise<EstadoDoTelao> {
  const agora = Date.now();

  if (!forcar && lembrado && lembrado.expiraEm > agora) {
    return lembrado.estado;
  }

  if (!forcar && emAndamento) return emAndamento;

  emAndamento = sondar().then((estado) => {
    lembrado = { estado, expiraEm: Date.now() + VALIDADE_MS };
    emAndamento = null;
    return estado;
  });

  return emAndamento;
}

/** Descarta o que está lembrado. Usado ao salvar configuração nova. */
export function esquecerEstadoDoTelao(): void {
  lembrado = null;
}

/**
 * A pergunta de fato. `GetCommunicationPanelInfo` por ser a única chamada de
 * leitura da API — sondar com um envio acenderia texto no telão da igreja.
 */
async function sondar(): Promise<EstadoDoTelao> {
  const config = await configHolyrics();
  if (!config) return 'nao-configurado';

  try {
    const resposta = await fetch(
      `${config.url}/api/GetCommunicationPanelInfo?token=${encodeURIComponent(config.token)}`,
      { method: 'GET', signal: AbortSignal.timeout(PRAZO_MS), cache: 'no-store' },
    );
    if (!resposta.ok) return 'desconectado';

    // O Holyrics devolve erro de aplicação com HTTP 200 (ver `chamar` em
    // `holyrics.ts`), então o corpo é quem decide. Token recusado conta como
    // desconectado: do ponto de vista de quem vai projetar, dá no mesmo — não
    // vai funcionar. O diagnóstico detalhado (rede × token) fica no botão
    // "Testar conexão" das Configurações, onde há espaço para explicar.
    const dados = (await resposta.json().catch(() => null)) as {
      status?: string;
    } | null;

    return dados?.status === 'ok' ? 'conectado' : 'desconectado';
  } catch {
    // Timeout, DNS, conexão recusada — todos significam a mesma coisa aqui.
    return 'desconectado';
  }
}
