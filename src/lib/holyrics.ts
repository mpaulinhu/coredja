/**
 * Envio de avisos para o Holyrics — o programa que de fato projeta no telão.
 *
 * O Holyrics roda um servidor HTTP no PC onde está instalado, dentro da rede
 * da igreja, e aceita chamadas em `http://[IP]:[PORTA]/api/{acao}?token=...`
 * (Configurações → API Server → gerenciar permissões, no próprio Holyrics).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LIMITAÇÃO IMPORTANTE — rede local
 * ────────────────────────────────────────────────────────────────────────────
 * A chamada sai do SERVIDOR do Coredja, nunca do navegador: assim o token
 * jamais é entregue ao cliente. O custo disso é que o servidor precisa
 * enxergar o IP do Holyrics. Rodando o Coredja no PC do audiovisual (ou em
 * qualquer máquina da mesma rede) funciona. Com o Coredja hospedado na
 * internet, o servidor está fora da rede da igreja e NÃO alcança
 * `192.168.x.x` — a chamada simplesmente vai dar timeout.
 *
 * Resolver isso exigiria um caminho diferente (o serviço de nuvem do próprio
 * Holyrics em `api.holyrics.com.br/send/`, que pede uma API key da conta, ou
 * um agente instalado na igreja fazendo a ponte). Não está feito aqui de
 * propósito: a versão servidor-para-servidor é a mais simples que funciona no
 * cenário local, que é onde o Coredja roda hoje.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Verificado contra um Holyrics real em 20/08/2026: o token vai na URL
 * (`?token=`) e não em header — com o token em header a resposta é
 * `invalid token`. Cada ação precisa ser liberada individualmente em
 * Configurações → API Server → gerenciar permissões (coluna "Local"); sem
 * isso a resposta é `unauthorized action` com HTTP 401.
 */

import { lerConfiguracoesGravadas, resolver } from './configuracoes';
import { enfileirarComando, infoDaPonteAtiva, ponteEstaViva } from './telao-fila-store';
import { dadosDoComando, type TipoDeComando } from './telao-fila';
import type { ImagemDoAviso } from './avisos';

/** Quanto esperar antes de desistir. Curto: no domingo ninguém espera. */
const TEMPO_LIMITE_MS = 5000;

export interface ConfigHolyrics {
  url: string;
  token: string;
}

export type ResultadoHolyrics =
  | { estado: 'nao-configurado' }
  | { estado: 'nao-suportado'; motivo: string }
  | { estado: 'enviado' }
  /** Texto foi, imagem ficou para trás — ver `MOTIVO_IMAGEM_FICOU_DE_FORA`. */
  | { estado: 'enviado-sem-imagem'; motivo: string }
  | { estado: 'falhou'; motivo: string };

/**
 * Lê a configuração, com o que foi salvo na tela de Configurações ganhando do
 * `.env.local` — ver `resolver` em `configuracoes.ts`. Ausente nos dois =
 * integração inerte.
 *
 * `HOLYRICS_URL`   → ex.: http://192.168.0.10:8091
 * `HOLYRICS_TOKEN` → token gerado no Holyrics
 *
 * Virou assíncrona quando a configuração passou a poder vir do banco. O custo
 * é baixo porque `lerConfiguracoesGravadas` guarda o valor em memória por um
 * minuto — no domingo, avançar dez blocos não vira dez leituras no Firestore.
 */
export async function configHolyrics(): Promise<ConfigHolyrics | null> {
  const gravado = await lerConfiguracoesGravadas();

  const url = resolver(gravado.holyricsUrl, process.env.HOLYRICS_URL)
    .valor.replace(/\/+$/, '');
  const token = resolver(gravado.holyricsToken, process.env.HOLYRICS_TOKEN).valor;

  if (!url || !token) return null;
  return { url, token };
}

/** Se a integração está ligada — usado pela tela para explicar o que acontece. */
export async function holyricsConfigurado(): Promise<boolean> {
  return (await configHolyrics()) !== null;
}

/**
 * Por que um aviso-imagem não vai para o Holyrics.
 *
 * A API tem `ShowImage`, mas ela só exibe arquivos que JÁ estão na aba de
 * arquivos do Holyrics — não existe upload pela API. Como a arte do aviso
 * vive dentro do Coredja (embutida no documento), não há o que referenciar
 * do outro lado. Preferimos dizer isso na cara do usuário a fingir que o
 * envio funcionou.
 */
export const MOTIVO_IMAGEM_NAO_SUPORTADA =
  'A API do Holyrics não recebe imagens enviadas de fora — ela só exibe artes que já estão na aba de arquivos do próprio Holyrics. Projete esta arte manualmente.';

/**
 * Aviso que tem texto E imagem: o texto vai, a arte não (mesma limitação
 * acima). Sem este recado o envio parece completo — e no telão aparece só o
 * texto, sem a arte que a pessoa achou que tinha projetado.
 */
export const MOTIVO_IMAGEM_FICOU_DE_FORA =
  'Só o texto foi: a API do Holyrics não recebe imagens de fora. Projete a arte manualmente.';

/** Um aviso só pode ser projetado via API se tiver texto. */
export function podeEnviarAoHolyrics(aviso: {
  titulo: string;
  texto: string;
}): boolean {
  return Boolean(aviso.titulo.trim() || aviso.texto.trim());
}

/**
 * Manda o aviso para o telão do Holyrics.
 *
 * Nunca lança: devolve o resultado tipado para quem chamou decidir o que
 * mostrar. Publicar no Coredja não pode quebrar porque o Holyrics está
 * fechado.
 */
export async function enviarAvisoAoHolyrics(aviso: {
  titulo: string;
  texto: string;
  imagem?: ImagemDoAviso;
}): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  if (!podeEnviarAoHolyrics(aviso)) {
    return { estado: 'nao-suportado', motivo: MOTIVO_IMAGEM_NAO_SUPORTADA };
  }

  const texto = [aviso.titulo.trim(), aviso.texto.trim()]
    .filter(Boolean)
    .join('\n');

  // `SetTextCommunicationPanel`, e não `ShowAnnouncement`: testado contra um
  // Holyrics real (20/08/2026), o `ShowAnnouncement` responde
  // `{"status":"error","error":"Item not found"}` — ele EXIBE um anúncio já
  // cadastrado no Holyrics, procurando por id/nome, e não aceita texto novo
  // vindo de fora. O painel de comunicação aceita, que é o que precisamos.
  const { resultado, pelaFila } = await entregar(
    () => chamar(config, 'SetTextCommunicationPanel', { text: texto, show: true }),
    {
      tipo: 'aviso-projetar',
      dados: dadosDoComando.aviso(aviso.titulo.trim(), aviso.texto.trim(), aviso.imagem?.url),
    },
  );

  // O caminho DIRETO nunca projeta imagem — `SetTextCommunicationPanel` só
  // aceita texto (ver `MOTIVO_IMAGEM_FICOU_DE_FORA`). Pela FILA é diferente:
  // a ponte recebeu a imagem junto (`dadosDoComando.aviso` acima) e vai
  // salvá-la na pasta de Fotos do Holyrics antes de projetar — ver
  // `holyrics.ts` da ponte. Só avisar "ficou de fora" quando for direto.
  if (resultado.estado === 'enviado' && aviso.imagem && !pelaFila) {
    return { estado: 'enviado-sem-imagem', motivo: MOTIVO_IMAGEM_FICOU_DE_FORA };
  }
  return resultado;
}

/**
 * Põe o aviso na fila do Holyrics, sem projetar nada.
 *
 * Diferente de `enviarAvisoAoHolyrics`, que joga o texto no telão na hora:
 * aqui o aviso vira um item na playlist e quem opera decide quando exibir.
 * É o caminho normal para um recado que não precisa interromper o culto.
 *
 * `type: "title"` é o item de texto livre da playlist — os outros tipos
 * (`text`, `announcement`) exigem um item JÁ cadastrado dentro do Holyrics,
 * referenciado por id, e não servem para texto vindo de fora.
 */
export async function enviarAvisoAFilaDoHolyrics(aviso: {
  titulo: string;
  texto: string;
  imagem?: ImagemDoAviso;
}): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  if (!podeEnviarAoHolyrics(aviso)) {
    return { estado: 'nao-suportado', motivo: MOTIVO_IMAGEM_NAO_SUPORTADA };
  }

  const texto = [aviso.titulo.trim(), aviso.texto.trim()]
    .filter(Boolean)
    .join(' — ');

  // Sem imagem no comando de propósito, mesmo pela fila: isto só ENFILEIRA
  // no Holyrics (playlist), não projeta agora — salvar a foto na pasta antes
  // de alguém decidir exibir seria fazer trabalho que pode nunca ser usado.
  // `enviarAvisoAoHolyrics`, que projeta na hora, é quem manda a imagem.
  const resultado = await entregarResultado(
    () =>
      chamar(config, 'AddToPlaylist', {
        items: [{ type: 'title', name: texto }],
        index: -1, // -1 = no fim da fila
        ignore_duplicates: true,
      }),
    {
      tipo: 'aviso-fila',
      dados: dadosDoComando.aviso(aviso.titulo.trim(), aviso.texto.trim()),
    },
  );

  if (resultado.estado === 'enviado' && aviso.imagem) {
    return { estado: 'enviado-sem-imagem', motivo: MOTIVO_IMAGEM_FICOU_DE_FORA };
  }
  return resultado;
}

/** Tira o aviso do telão do Holyrics. Mesmo contrato de `enviarAviso`. */
export async function limparAvisoNoHolyrics(): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  return entregarResultado(
    () => chamar(config, 'SetTextCommunicationPanel', { text: '', show: false }),
    { tipo: 'aviso-limpar', dados: {} },
  );
}

/**
 * Entrega o comando pelo caminho que existir: direto, se o Holyrics estiver
 * ao alcance; pela fila da ponte, se não estiver.
 *
 * É o que faz as MESMAS rotas funcionarem nos dois cenários sem saber em qual
 * estão rodando:
 *
 * - **Coredja no PC da igreja** (o `Coredja.bat`): o servidor está na mesma
 *   rede, `executar()` alcança o Holyrics, e a fila nunca entra em cena.
 * - **Coredja publicado**: o servidor não alcança `192.168.x.x` (ver o
 *   cabeçalho de `telao-fila.ts`), `executar()` falha por rede, e o comando
 *   vai para a fila — a ponte no PC do audiovisual pega e executa ali.
 *
 * A ORDEM importa e é deliberada: tenta direto PRIMEIRO. O caminho direto é
 * instantâneo e devolve o resultado real do Holyrics ("token recusado", "ação
 * não liberada"), coisa que a fila não tem como devolver — quando o comando é
 * enfileirado, a resposta só diz que foi entregue à ponte, não que deu certo
 * lá. Preferir a fila quando o direto funciona trocaria diagnóstico preciso
 * por incerteza, de graça.
 *
 * Só desvia para a fila em falha de REDE (o `catch`). Um Holyrics que
 * respondeu e recusou não é caso de ponte: enfileirar repetiria a recusa
 * alguns segundos depois, agora sem a mensagem que explica o motivo.
 */
async function entregar(
  executar: () => Promise<ResultadoHolyrics>,
  comando: { tipo: TipoDeComando; dados: Record<string, unknown> },
): Promise<{ resultado: ResultadoHolyrics; pelaFila: boolean }> {
  try {
    return { resultado: await executar(), pelaFila: false };
  } catch (erro) {
    // Não alcançou. Se há ponte viva, ela resolve.
    if (await ponteEstaViva()) {
      const enfileirou = await enfileirarComando(comando.tipo, comando.dados);
      if (enfileirou) return { resultado: { estado: 'enviado' }, pelaFila: true };

      return {
        resultado: {
          estado: 'falhou',
          motivo:
            'Não foi possível deixar o comando para o computador do audiovisual. Projete pelo Holyrics.',
        },
        pelaFila: true,
      };
    }
    return { resultado: { estado: 'falhou', motivo: mensagemDoErro(erro) }, pelaFila: false };
  }
}

/** `entregar()` sem o `pelaFila` — para quem não precisa diferenciar (cronômetro, limpar). */
async function entregarResultado(
  executar: () => Promise<ResultadoHolyrics>,
  comando: { tipo: TipoDeComando; dados: Record<string, unknown> },
): Promise<ResultadoHolyrics> {
  const { resultado } = await entregar(executar, comando);
  return resultado;
}

/** POST para uma ação da API do Holyrics, com prazo para desistir. */
async function chamar(
  config: ConfigHolyrics,
  acao: string,
  corpo: Record<string, unknown>,
): Promise<ResultadoHolyrics> {
  const cancelar = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const endereco = `${config.url}/api/${acao}?token=${encodeURIComponent(config.token)}`;

  const resposta = await fetch(endereco, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: cancelar,
    cache: 'no-store',
  });

  if (!resposta.ok) {
    return {
      estado: 'falhou',
      motivo: `O Holyrics respondeu ${resposta.status}. Confira o token e a porta.`,
    };
  }

  // A API responde `{"status":"ok"}` ou `{"status":"error","error":"..."}`
  // com HTTP 200 nos dois casos — checar só o status HTTP deixaria passar
  // token errado como se tivesse dado certo.
  const dados = (await resposta.json().catch(() => null)) as {
    status?: string;
    error?: string;
  } | null;

  if (dados && dados.status && dados.status !== 'ok') {
    return {
      estado: 'falhou',
      motivo: dados.error ?? 'O Holyrics recusou o envio.',
    };
  }

  return { estado: 'enviado' };
}

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof DOMException && erro.name === 'TimeoutError') {
    return 'O Holyrics não respondeu a tempo. Ele está aberto e na mesma rede?';
  }
  return 'Não foi possível falar com o Holyrics. Confira se ele está aberto e o endereço configurado.';
}

/* ────────────────────────────────────────────────────────────────────────────
 * CRONÔMETRO DO PAINEL DE COMUNICAÇÃO
 *
 * O painel de comunicação do Holyrics é a tela de retorno que a equipe vê do
 * palco. Além do texto (usado pelos avisos, acima), ele tem um cronômetro
 * regressivo próprio — que é o que a Ordem do Culto usa para mostrar quanto
 * falta do bloco em andamento.
 *
 * Verificado contra um Holyrics real em 20/08/2026: os campos aceitos são
 * `minutes` e `seconds` (números). A documentação oficial menciona um campo
 * `time: "10:00"`, que NÃO funciona — a resposta é
 * `Fields 'minutes,seconds' or 'exact_time' not found or invalid`.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Liga o cronômetro regressivo do painel com `minutos` no relógio.
 *
 * `stop_at_zero: false` de propósito: ao chegar em zero o cronômetro segue
 * contando para baixo (negativo). Quem está no palco precisa justamente ver
 * QUANTO estourou o tempo — travar em `00:00` esconderia essa informação.
 */
export async function iniciarCronometroNoHolyrics(
  minutos: number,
): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  return entregarResultado(() => ligarCronometro(config, minutos * 60), {
    tipo: 'cronometro-iniciar',
    dados: { minutos },
  });
}

/** Desliga o cronômetro do painel. Mesmo contrato das outras. */
export async function pararCronometroNoHolyrics(): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  return entregarResultado(
    () => chamar(config, 'StopCountdownCommunicationPanel', {}),
    { tipo: 'cronometro-parar', dados: {} },
  );
}

/**
 * Soma `minutosExtras` ao bloco em andamento. Valor NEGATIVO tira tempo.
 *
 * A API não tem "somar tempo": só dá para iniciar um cronômetro do zero. Então
 * o caminho é ler quanto ainda falta (`GetCommunicationPanelInfo`) e reiniciar
 * com o total novo — daí o ler-e-reiniciar em vez de uma chamada só.
 *
 * O cronômetro pode estar NEGATIVO (o bloco estourou o tempo, e
 * `stop_at_zero: false` deixa ele seguir contando). Somar em cima do valor
 * real é o que faz sentido: dar 5 minutos a um bloco que já passou 3 deixa
 * 2 minutos de fato, não 5.
 *
 * Verificado contra um Holyrics real em 20/08/2026: reenviar
 * `StartCountdownCommunicationPanel` com um total MENOR encurta o cronômetro
 * normalmente (10 min no ar, reenvio de 3 min, o painel passou a 178s). Tirar
 * tempo é, portanto, o mesmo caminho de somar, com o sinal invertido.
 */
export async function somarTempoAoCronometroNoHolyrics(
  minutosExtras: number,
): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  const extras = Math.round(minutosExtras * 60);

  // Este é o único comando que PRECISA ler o painel antes de escrever, e por
  // isso é o único que não pode ser resolvido aqui e mandado pronto para a
  // ponte. O quanto somar depende de quanto falta AGORA, e quem tem essa
  // resposta é quem alcança o Holyrics — que, com o Coredja publicado, é a
  // ponte e não este servidor.
  //
  // Então o que vai para a fila é a INTENÇÃO ("some 5 minutos"), e a ponte
  // faz o ler-e-reiniciar do lado dela. Enfileirar um total absoluto
  // calculado aqui seria calcular sobre um valor que não se pôde ler.
  return entregarResultado(
    async () => {
      const info = await lerPainelDoHolyrics(config);

      // Sem cronômetro no ar (nunca ligou, ou pararam): "dar mais X minutos"
      // vira simplesmente ligar um de X minutos, que é o que quem clicou espera.
      const restante = info?.countdown_show ? (info.countdown_time ?? 0) : 0;

      return ligarCronometro(config, restante + extras);
    },
    { tipo: 'cronometro-somar', dados: { minutos: minutosExtras } },
  );
}

/**
 * Põe o cronômetro do painel exatamente em `segundos` restantes — o número
 * digitado no cronômetro da tela.
 *
 * Diferente de `somarTempoAoCronometroNoHolyrics`, não lê o painel antes: o
 * valor digitado É a verdade, e consultar o estado atual só acrescentaria uma
 * chamada de rede cujo resultado seria descartado.
 */
export async function definirCronometroNoHolyrics(
  segundos: number,
): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  return entregarResultado(() => ligarCronometro(config, segundos), {
    tipo: 'cronometro-definir',
    dados: { segundos },
  });
}

/**
 * Liga o countdown do painel em `segundos`, limpando o rótulo antes.
 *
 * Comum às três formas de mexer no cronômetro (ligar do zero, somar, definir)
 * porque as três terminam na mesma chamada, com os mesmos dois cuidados:
 *
 * 1. **Rótulo residual.** O painel pode ter sobrado com texto de um teste ou
 *    de um aviso anterior, e o pedido aqui é "só o tempo" na tela. Falhar a
 *    limpeza não impede o cronômetro: é cosmético, e derrubar o principal por
 *    causa do acessório seria pior.
 * 2. **Piso em zero do que se ENVIA.** `segundos` pode chegar negativo (tirar
 *    5 min de um bloco com 2 sobrando; digitar um tempo já estourado). A TELA
 *    mostra esse negativo — é a informação de quanto o bloco passou. A API
 *    não: `minutes`/`seconds` não têm sinal. Então liga-se em `00:00` e o
 *    `stop_at_zero: false` leva o painel para o negativo por conta própria no
 *    segundo seguinte, chegando ao mesmo lugar.
 */
async function ligarCronometro(
  config: ConfigHolyrics,
  segundos: number,
): Promise<ResultadoHolyrics> {
  const total = Math.max(0, Math.round(segundos));

  await chamar(config, 'SetCommunicationPanelSettings', {
    countdown_text: '',
  }).catch(() => undefined);

  return chamar(config, 'StartCountdownCommunicationPanel', {
    minutes: Math.floor(total / 60),
    seconds: total % 60,
    stop_at_zero: false,
  });
}

/** O que interessa do estado do painel. Campos ausentes = painel sem countdown. */
interface InfoPainelHolyrics {
  countdown_show?: boolean;
  /** Segundos restantes. Negativo quando o tempo já estourou. */
  countdown_time?: number;
}

/**
 * Lê o estado do painel de comunicação. GET, não POST — é a única chamada de
 * leitura aqui, por isso não passa por `chamar()`.
 *
 * Devolve `null` (em vez de lançar) quando não dá para ler: quem chama trata
 * como "não há cronômetro no ar", que é a leitura conservadora certa.
 */
async function lerPainelDoHolyrics(
  config: ConfigHolyrics,
): Promise<InfoPainelHolyrics | null> {
  const endereco = `${config.url}/api/GetCommunicationPanelInfo?token=${encodeURIComponent(config.token)}`;
  const resposta = await fetch(endereco, {
    method: 'GET',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    cache: 'no-store',
  });
  if (!resposta.ok) return null;

  const dados = (await resposta.json().catch(() => null)) as {
    status?: string;
    data?: InfoPainelHolyrics;
  } | null;

  if (!dados || dados.status !== 'ok') return null;
  return dados.data ?? null;
}

/** O que a tela recebe sobre o Holyrics numa resposta de API. */
export interface HolyricsParaTela {
  estado: string;
  motivo?: string;
}

/**
 * Converte o resultado para o que a tela precisa saber. `nao-configurado` vira
 * `null` de propósito: quem nunca ligou a integração não deve ver recado sobre
 * ela.
 */
export function holyricsParaTela(
  resultado: ResultadoHolyrics,
): HolyricsParaTela | null {
  if (resultado.estado === 'nao-configurado') return null;
  if (resultado.estado === 'enviado') return { estado: 'enviado' };
  return { estado: resultado.estado, motivo: resultado.motivo };
}

/* ────────────────────────────────────────────────────────────────────────────
 * TESTE DE CONEXÃO — usado pela tela de Configurações
 * ──────────────────────────────────────────────────────────────────────────── */

/** O que o teste descobriu. Cada caso pede uma ação diferente de quem lê. */
export type DiagnosticoHolyrics =
  | { estado: 'nao-configurado' }
  /** Falou, respondeu, token aceito. */
  | { estado: 'ok'; painelNoAr: boolean }
  /**
   * O servidor não alcança o Holyrics direto (normal quando publicado — ver
   * `telao-fila.ts`), MAS a ponte está viva e o sinal dela diz que o Holyrics
   * responde. É o caso normal de "está tudo funcionando" com o Coredja
   * hospedado: o teste direto SEMPRE dá "inalcançável" nesse cenário, e sem
   * este estado a tela mentiria "não funciona" para uma instalação que
   * funciona perfeitamente, só que por outro caminho.
   */
  | { estado: 'ok-pela-ponte'; computador: string }
  /** Chegou no Holyrics, mas ele recusou o token ou a permissão da ação. */
  | { estado: 'recusado'; motivo: string }
  /** Não chegou: Holyrics fechado, IP/porta errados, ou fora da rede. */
  | { estado: 'inalcancavel'; motivo: string };

/**
 * Bate no Holyrics de verdade e diz o que voltou.
 *
 * Usa `GetCommunicationPanelInfo` como sonda por ser a única chamada de
 * LEITURA da integração: testar com um envio acenderia texto no telão da
 * igreja no meio do culto só para conferir a configuração.
 *
 * A diferença entre "não chegou" e "chegou e recusou" é o ponto do
 * diagnóstico: são problemas opostos (rede/endereço × token/permissão) e
 * quem lê precisa saber onde mexer. Um "falhou" genérico manda a pessoa
 * conferir as duas coisas às cegas.
 *
 * ATENÇÃO à permissão: se `GetCommunicationPanelInfo` não estiver liberada em
 * "gerenciar permissões", o teste acusa recusa mesmo com o token certo — por
 * isso o texto do motivo cita a ação pelo nome, e a tela lista as permissões
 * necessárias logo ao lado.
 */
export async function testarConexaoHolyrics(): Promise<DiagnosticoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  // A ponte manda ver primeiro — mesmo raciocínio de `holyrics-presenca.ts`.
  // Com o Coredja publicado, o teste DIRETO abaixo nunca vai alcançar
  // `192.168.x.x` (é a limitação de rede documentada em `telao-fila.ts`), e
  // sem esta checagem o botão "Testar conexão" diria "não funciona" mesmo
  // com a ponte entregando os comandos perfeitamente pela fila.
  const infoDaPonte = await infoDaPonteAtiva();
  if (infoDaPonte) {
    return { estado: 'ok-pela-ponte', computador: infoDaPonte.computador };
  }

  const endereco = `${config.url}/api/GetCommunicationPanelInfo?token=${encodeURIComponent(config.token)}`;

  let resposta: Response;
  try {
    resposta = await fetch(endereco, {
      method: 'GET',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      cache: 'no-store',
    });
  } catch (erro) {
    // Timeout, DNS, conexão recusada: nada disso chegou ao Holyrics.
    return {
      estado: 'inalcancavel',
      motivo:
        erro instanceof DOMException && erro.name === 'TimeoutError'
          ? `O Holyrics não respondeu em ${TEMPO_LIMITE_MS / 1000} segundos. Ele está aberto, com o API Server ligado, e o servidor do Coredja está na mesma rede?`
          : `Não foi possível alcançar ${config.url}. Confira o IP e a porta, e se o Holyrics está aberto.`,
    };
  }

  // 401 é a resposta do Holyrics a token inválido ou ação não liberada — os
  // dois casos são de configuração dentro do programa, não de rede.
  if (resposta.status === 401) {
    return {
      estado: 'recusado',
      motivo:
        'O Holyrics recusou o token. Confira se ele foi copiado inteiro e se a ação "GetCommunicationPanelInfo" está liberada em gerenciar permissões.',
    };
  }

  if (!resposta.ok) {
    return {
      estado: 'recusado',
      motivo: `O Holyrics respondeu ${resposta.status}. Confira o endereço — talvez a porta aponte para outro programa.`,
    };
  }

  // Chegou com 200, mas o Holyrics devolve erro de aplicação também em 200
  // (ver `chamar`), então o corpo é quem decide.
  const dados = (await resposta.json().catch(() => null)) as {
    status?: string;
    error?: string;
    data?: InfoPainelHolyrics;
  } | null;

  if (!dados) {
    return {
      estado: 'recusado',
      motivo:
        'Veio uma resposta que não é do Holyrics. Confira se a porta configurada é a do API Server, e não a de outro programa.',
    };
  }

  if (dados.status !== 'ok') {
    return { estado: 'recusado', motivo: dados.error ?? 'O Holyrics recusou a consulta.' };
  }

  return { estado: 'ok', painelNoAr: dados.data?.countdown_show === true };
}
