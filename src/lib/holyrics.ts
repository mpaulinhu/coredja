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
 * Lê a configuração das variáveis de ambiente. Ausente = integração inerte.
 *
 * `HOLYRICS_URL`   → ex.: http://192.168.0.10:8091
 * `HOLYRICS_TOKEN` → token gerado no Holyrics
 */
export function configHolyrics(): ConfigHolyrics | null {
  const url = (process.env.HOLYRICS_URL ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.HOLYRICS_TOKEN ?? '').trim();
  if (!url || !token) return null;
  return { url, token };
}

/** Se a integração está ligada — usado pela tela para explicar o que acontece. */
export function holyricsConfigurado(): boolean {
  return configHolyrics() !== null;
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
  imagem?: unknown;
}): Promise<ResultadoHolyrics> {
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  if (!podeEnviarAoHolyrics(aviso)) {
    return { estado: 'nao-suportado', motivo: MOTIVO_IMAGEM_NAO_SUPORTADA };
  }

  const texto = [aviso.titulo.trim(), aviso.texto.trim()]
    .filter(Boolean)
    .join('\n');

  try {
    // `SetTextCommunicationPanel`, e não `ShowAnnouncement`: testado contra um
    // Holyrics real (20/08/2026), o `ShowAnnouncement` responde
    // `{"status":"error","error":"Item not found"}` — ele EXIBE um anúncio já
    // cadastrado no Holyrics, procurando por id/nome, e não aceita texto novo
    // vindo de fora. O painel de comunicação aceita, que é o que precisamos.
    const resultado = await chamar(config, 'SetTextCommunicationPanel', {
      text: texto,
      show: true,
    });

    // Deu certo, mas o aviso tinha arte junto: quem publicou precisa saber
    // que só o texto chegou lá, senão conta com uma arte que não subiu.
    if (resultado.estado === 'enviado' && aviso.imagem) {
      return { estado: 'enviado-sem-imagem', motivo: MOTIVO_IMAGEM_FICOU_DE_FORA };
    }
    return resultado;
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
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
  imagem?: unknown;
}): Promise<ResultadoHolyrics> {
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  if (!podeEnviarAoHolyrics(aviso)) {
    return { estado: 'nao-suportado', motivo: MOTIVO_IMAGEM_NAO_SUPORTADA };
  }

  const texto = [aviso.titulo.trim(), aviso.texto.trim()]
    .filter(Boolean)
    .join(' — ');

  try {
    const resultado = await chamar(config, 'AddToPlaylist', {
      items: [{ type: 'title', name: texto }],
      index: -1, // -1 = no fim da fila
      ignore_duplicates: true,
    });

    if (resultado.estado === 'enviado' && aviso.imagem) {
      return { estado: 'enviado-sem-imagem', motivo: MOTIVO_IMAGEM_FICOU_DE_FORA };
    }
    return resultado;
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
}

/** Tira o aviso do telão do Holyrics. Mesmo contrato de `enviarAviso`. */
export async function limparAvisoNoHolyrics(): Promise<ResultadoHolyrics> {
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  try {
    return await chamar(config, 'SetTextCommunicationPanel', {
      text: '',
      show: false,
    });
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
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
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  try {
    return await ligarCronometro(config, minutos * 60);
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
}

/** Desliga o cronômetro do painel. Mesmo contrato das outras. */
export async function pararCronometroNoHolyrics(): Promise<ResultadoHolyrics> {
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  try {
    return await chamar(config, 'StopCountdownCommunicationPanel', {});
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
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
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  const extras = Math.round(minutosExtras * 60);

  try {
    const info = await lerPainelDoHolyrics(config);

    // Sem cronômetro no ar (nunca ligou, ou pararam): "dar mais X minutos"
    // vira simplesmente ligar um de X minutos, que é o que quem clicou espera.
    const restante = info?.countdown_show ? (info.countdown_time ?? 0) : 0;

    return await ligarCronometro(config, restante + extras);
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
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
  const config = configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  try {
    return await ligarCronometro(config, segundos);
  } catch (erro) {
    return { estado: 'falhou', motivo: mensagemDoErro(erro) };
  }
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
