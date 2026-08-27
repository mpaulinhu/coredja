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
 * DOIS CAMINHOS, NA ORDEM CERTA
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **A ponte deu sinal?** Então o telão está alcançável por ela, e pronto.
 *    É o caminho do Coredja publicado, onde sondar o Holyrics direto sempre
 *    falharia (o servidor não alcança `192.168.x.x` — ver `telao-fila.ts`).
 *
 * 2. **Não há ponte?** Sonda o Holyrics direto. É o caminho do Coredja rodando
 *    no PC da igreja, onde os dois estão na mesma rede e não existe ponte
 *    nenhuma para dar sinal.
 *
 * A ordem importa: perguntar pela ponte primeiro evita gastar 1,5s de espera
 * numa sonda que se sabe de antemão que vai falhar.
 */

import { configHolyrics } from './holyrics';
import { infoDaPonteAtiva } from './telao-fila-store';

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
 * Falhas seguidas desde a última vez que o telão respondeu.
 *
 * ┌─ POR QUE NÃO ACUSAR NA PRIMEIRA ───────────────────────────────────────┐
 * O selo dizia "telão desconectado" com tudo funcionando (igreja,
 * 27/08/2026). A causa: uma única sonda infeliz — o prazo aqui é curto
 * (1,5s) de propósito, e o Conector reporta `holyricsOk` a partir da própria
 * sonda dele, que pode ter pego o Holyrics ocupado num render. Uma falha
 * isolada virava meio minuto de selo vermelho, porque o resultado fica
 * lembrado por `VALIDADE_MS`.
 *
 * Exigir DUAS falhas seguidas troca uma mentira frequente por um atraso raro:
 * o telão que caiu de verdade continua caindo na sonda seguinte, e o selo
 * acende com no máximo 30s de atraso. O erro caro aqui é o falso alarme —
 * quem opera aprende a ignorar um selo que mente, e aí ele não serve para
 * nada no dia em que estiver certo.
 * └────────────────────────────────────────────────────────────────────────┘
 */
let falhasSeguidas = 0;

/** Quantas falhas seguidas antes de acender o selo de desconectado. */
const FALHAS_PARA_ACUSAR = 2;

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
    const suavizado = suavizar(estado, forcar);
    lembrado = { estado: suavizado, expiraEm: Date.now() + VALIDADE_MS };
    emAndamento = null;
    return suavizado;
  });

  return emAndamento;
}

/** Descarta o que está lembrado. Usado ao salvar configuração nova. */
export function esquecerEstadoDoTelao(): void {
  lembrado = null;
  falhasSeguidas = 0;
}

/**
 * Aplica a tolerância a uma falha isolada — ver `falhasSeguidas`.
 *
 * `forcar` pula a tolerância: quem apertou "Testar conexão" quer o resultado
 * DESTA sonda, não uma média. Segurar a má notícia ali seria esconder
 * justamente o que a pessoa foi conferir.
 *
 * `nao-configurado` também passa direto: não é falha de rede, é ausência de
 * configuração, e não tem por que ser confirmada duas vezes.
 */
function suavizar(estado: EstadoDoTelao, forcar: boolean): EstadoDoTelao {
  if (estado !== 'desconectado') {
    falhasSeguidas = 0;
    return estado;
  }
  if (forcar) return estado;

  falhasSeguidas += 1;
  if (falhasSeguidas >= FALHAS_PARA_ACUSAR) return 'desconectado';

  // Primeira falha: mantém o que se sabia antes. Sem nada sabido (primeira
  // consulta desde que o servidor subiu), 'conectado' é o palpite certo — o
  // caso comum é estar tudo bem, e a sonda seguinte corrige em 30s se não
  // estiver.
  return lembrado?.estado ?? 'conectado';
}

/**
 * A pergunta de fato. `GetCommunicationPanelInfo` por ser a única chamada de
 * leitura da API — sondar com um envio acenderia texto no telão da igreja.
 */
async function sondar(): Promise<EstadoDoTelao> {
  const config = await configHolyrics();
  if (!config) return 'nao-configurado';

  // A ponte manda ver primeiro. Com o Coredja publicado, sondar o Holyrics
  // direto SEMPRE falha (o servidor não alcança `192.168.x.x`), então sem
  // esta checagem o selo diria "desconectado" o tempo todo — inclusive com
  // tudo funcionando pela ponte, que é o cenário normal quando hospedado.
  //
  // Rodando na rede da igreja não há ponte nenhuma, `infoDaPonteAtiva()`
  // devolve `null`, e a sonda direta abaixo decide — como antes.
  //
  // `holyricsOk` é o que separa "a ponte está viva" de "o telão responde".
  // Tratar ponte viva como conectado, sem olhar esse campo, foi o que fez o
  // selo ficar verde na igreja (24/08/2026) enquanto nenhuma ação chegava ao
  // telão — a ponte estava no ar, mas não alcançava o Holyrics.
  const ponte = await infoDaPonteAtiva();
  if (ponte) return ponte.holyricsOk ? 'conectado' : 'desconectado';

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
