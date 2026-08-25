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
  /**
   * Texto no telão e arte a caminho da pasta de Fotos do Holyrics, pela
   * ponte. Estado próprio (e não `enviado`) porque a pessoa precisa saber
   * que a arte NÃO subiu sozinha — ela está lá para ser exibida pela cabine.
   */
  | { estado: 'enviado-imagem-na-pasta'; motivo: string }
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
  'Só o texto foi: sem a ponte instalada no computador do audiovisual, não há como levar a arte até o Holyrics. Projete a arte manualmente.';

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
export async function enviarAvisoAoHolyrics(
  aviso: {
    titulo: string;
    texto: string;
    imagem?: ImagemDoAviso;
  },
  /** Exibir a arte no telão na hora, além de deixá-la pronta na pasta. */
  projetarImagem = false,
): Promise<ResultadoHolyrics> {
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
      dados: dadosDoComando.aviso(
        aviso.titulo.trim(),
        aviso.texto.trim(),
        aviso.imagem?.url,
        aviso.imagem?.nomeArquivo,
        projetarImagem,
      ),
    },
    // Com imagem, a ponte é o único caminho que leva a arte — ver a seção
    // "A EXCEÇÃO" no comentário de `entregar`.
    Boolean(aviso.imagem),
  );

  // O caminho DIRETO nunca leva imagem — `SetTextCommunicationPanel` só
  // aceita texto (ver `MOTIVO_IMAGEM_FICOU_DE_FORA`). Pela FILA é diferente:
  // a ponte recebeu a arte junto (`dadosDoComando.aviso` acima) e a grava na
  // pasta de Fotos do Holyrics — ver `holyrics.ts` da ponte.
  if (resultado.estado === 'enviado' && aviso.imagem) {
    if (!pelaFila) {
      return { estado: 'enviado-sem-imagem', motivo: MOTIVO_IMAGEM_FICOU_DE_FORA };
    }
    // Quando a arte NÃO sobe sozinha, dizer onde ela foi parar é o que evita
    // alguém esperar por uma imagem que está só esperando ser exibida.
    if (!projetarImagem) {
      return {
        estado: 'enviado-imagem-na-pasta',
        motivo: `A arte foi para a pasta de Fotos do Holyrics${
          aviso.imagem.nomeArquivo ? ` como "${aviso.imagem.nomeArquivo}"` : ''
        } — é só exibir por lá na hora certa.`,
      };
    }
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
 * Tira do telão a arte que está sendo exibida.
 *
 * Ação separada de `limparAvisoNoHolyrics` porque são duas telas diferentes:
 * lá é o painel de comunicação (o monitor de retorno, com o texto), aqui é a
 * projeção que a igreja vê. Quem põe a arte no ar (`ShowImage`, via
 * "Projetar a arte agora") precisava de um jeito de tirá-la — sem isto, a
 * imagem ficava presa até alguém mexer no Holyrics à mão.
 */
export async function fecharArteNoHolyrics(): Promise<ResultadoHolyrics> {
  const config = await configHolyrics();
  if (!config) return { estado: 'nao-configurado' };

  return entregarResultado(
    () => chamar(config, 'CloseCurrentPresentation', {}),
    { tipo: 'arte-fechar', dados: {} },
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A EXCEÇÃO: `preferirFila`
 * ────────────────────────────────────────────────────────────────────────────
 * Aviso com IMAGEM inverte a ordem, porque o raciocínio acima pressupõe que
 * os dois caminhos fazem a mesma coisa — e para imagem eles não fazem. O
 * caminho direto NÃO consegue projetar arte (a API não recebe imagem de
 * fora); só a ponte consegue, salvando o arquivo na pasta de Fotos do
 * Holyrics. Tentar direto primeiro nesse caso seria escolher, de propósito, o
 * único caminho que não faz o que a pessoa pediu.
 *
 * Isso aparece exatamente quando o Coredja roda na MESMA rede do Holyrics
 * (`Coredja.bat`, ou `localhost` em desenvolvimento): o direto funciona, o
 * `catch` nunca dispara, e a ponte — instalada e viva ali do lado — nunca era
 * consultada. O sintoma era "publiquei com imagem e só o texto foi", sem
 * pista de que existia um caminho que teria funcionado.
 */
async function entregar(
  executar: () => Promise<ResultadoHolyrics>,
  comando: { tipo: TipoDeComando; dados: Record<string, unknown> },
  preferirFila = false,
): Promise<{ resultado: ResultadoHolyrics; pelaFila: boolean }> {
  // Só vale a pena consultar a ponte se ela puder mesmo assumir; sem ponte
  // viva o caminho direto segue sendo o melhor disponível (mesmo sem imagem).
  if (preferirFila && (await ponteEstaViva())) {
    const enfileirou = await enfileirarComando(comando.tipo, comando.dados);
    if (enfileirou) return { resultado: { estado: 'enviado' }, pelaFila: true };
    // Não conseguiu enfileirar: cai para o direto abaixo, que ao menos
    // projeta o texto.
  }

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

/**
 * As ações de ESCRITA que dá para sondar SEM executá-las.
 *
 * ┌─ POR QUE SÓ ESTAS TRÊS ─────────────────────────────────────────────────┐
 * Medido contra um Holyrics real (25/08/2026). Mandando corpo vazio `{}`:
 *
 *   ShowImage                        → `Field 'file' not found`
 *   StartCountdownCommunicationPanel → `Fields 'minutes,seconds' ... not found`
 *   AddToPlaylist                    → `Field 'items' is empty`
 *
 *   SetTextCommunicationPanel        → {"status":"ok"}  ← ACEITOU
 *   CloseCurrentPresentation         → {"status":"ok"}  ← ACEITOU
 *   StopCountdownCommunicationPanel  → {"status":"ok"}  ← ACEITOU
 *   SetCommunicationPanelSettings    → {"status":"ok"}  ← ACEITOU
 *
 * As quatro de baixo aceitam corpo vazio em vez de recusar, então não há
 * erro de campo que sirva de prova — e o `ok` delas não distingue "liberada"
 * de "executada". Medido o efeito real de cada uma com `{}`:
 *
 *   StopCountdownCommunicationPanel  → PARA um cronômetro em andamento
 *                                      (medido: 298s → 0). Destrutiva.
 *   SetTextCommunicationPanel        → campo ausente = "não mexer"; o texto
 *   SetCommunicationPanelSettings      no ar sobrevive. Inócua na prática.
 *   CloseCurrentPresentation         → fecha a apresentação no ar.
 *
 * Uma única destrutiva já basta para excluir o grupo: o teste é apertado no
 * meio do culto, e parar o cronômetro da pregação para diagnosticar seria
 * pior que o problema diagnosticado. Cobrir menos é a escolha certa.
 *
 * A primeira versão desta sondagem incluía as sete e foi validada contra um
 * servidor de mentira escrito com a suposição já embutida (401 vs erro de
 * campo). O Holyrics real desmentiu quatro delas. Um mock só confirma o que
 * quem o escreveu já achava — daí a lista acima ser medição, não dedução.
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * A cobertura parcial ainda vale: as permissões são marcadas uma a uma, e na
 * prática quem esquece de liberar, esquece várias. Achar UMA bloqueada já
 * prova que a instalação está incompleta e manda a pessoa para a tela certa.
 */
const ACOES_SONDAVEIS: { acao: string; rotulo: string }[] = [
  { acao: 'ShowImage', rotulo: 'Projetar a arte do aviso' },
  { acao: 'StartCountdownCommunicationPanel', rotulo: 'Ligar o cronômetro' },
  { acao: 'AddToPlaylist', rotulo: 'Pôr o aviso na fila do Holyrics' },
];

/**
 * Descobre se uma ação está liberada SEM executá-la.
 *
 * Só funciona para as ações de `ACOES_SONDAVEIS`, que exigem um campo
 * obrigatório: o Holyrics confere a permissão ANTES de validar os campos,
 * então o erro de campo prova que a permissão existe e nada acontece.
 *
 * Assinaturas medidas contra o Holyrics real:
 *
 *   401 `unauthorized action`      → não liberada (ou ação inexistente)
 *   401 `invalid token`            → token errado — problema OUTRO, não é
 *                                    permissão, e vira `null` para não ser
 *                                    reportado como "libere esta ação"
 *   200 `Field '...' not found`    → liberada, e NÃO executou
 *   200 `{"status":"ok"}`          → executou: impossível aqui, porque toda
 *                                    ação desta lista exige campo
 */
async function permissaoLiberada(
  config: ConfigHolyrics,
  acao: string,
): Promise<boolean | null> {
  try {
    const resposta = await fetch(
      `${config.url}/api/${acao}?token=${encodeURIComponent(config.token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        cache: 'no-store',
      },
    );

    const dados = (await resposta.json().catch(() => null)) as {
      status?: string;
      error?: string;
    } | null;

    // Token inválido não é problema de permissão de ação: o teste principal
    // já reporta isso como `recusado`, com o texto certo. Dizer "libere
    // ShowImage" para quem errou o token manda a pessoa para o lugar errado.
    if (dados?.error && /invalid token/i.test(dados.error)) return null;

    if (resposta.status === 401) return false;
    if (dados?.error && /unauthorized/i.test(dados.error)) return false;
    if (!resposta.ok) return null;

    return true;
  } catch {
    // Timeout ou rede: não dá para afirmar nada sobre a permissão.
    return null;
  }
}

/** Sonda as ações seguras e devolve o rótulo das que estão bloqueadas. */
async function acoesBloqueadas(config: ConfigHolyrics): Promise<string[]> {
  const veredictos = await Promise.all(
    ACOES_SONDAVEIS.map(async ({ acao, rotulo }) => ({
      rotulo,
      liberada: await permissaoLiberada(config, acao),
    })),
  );

  // `null` (indeterminado) NÃO entra na lista: acusar bloqueio sem ter
  // certeza mandaria a pessoa mexer em permissão que já estava certa.
  return veredictos.filter((v) => v.liberada === false).map((v) => v.rotulo);
}

/**
 * Onde olhar quando o Holyrics não atende — e o motivo de este texto existir.
 *
 * O API Server tem um log próprio em `logs/api_server.txt`, dentro da pasta de
 * instalação do Holyrics, e ele registra a causa exata da falha de subida. O
 * caso mais traiçoeiro é `port 8091 is already in use`: o Holyrics fica
 * tentando subir a cada 15s, falhando sempre, e nada na tela dele denuncia
 * isso — a aba API Server continua mostrando "Ativado" com a porta certa.
 *
 * Aconteceu nesta própria investigação (25/08/2026): outro processo segurava
 * a 8091, o Holyrics real nunca subiu, e por um bom tempo o diagnóstico foi
 * feito contra o processo errado. O log foi o que desfez o engano em segundos.
 */
const DICA_LOG_DO_HOLYRICS =
  'Confira o IP e a porta, e se o Holyrics está aberto. Se estiver e mesmo assim não atender, ' +
  'abra `logs/api_server.txt` na pasta do Holyrics: se aparecer "port ... is already in use", ' +
  'outro programa tomou a porta e o API Server nunca chegou a subir — a tela do Holyrics não mostra isso.';

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
  /**
   * A ponte está viva, mas ELA não está conseguindo falar com o Holyrics.
   *
   * É o pior cenário para esconder atrás de um "conectado": aconteceu de
   * verdade (24/08/2026) — o teste disse OK só porque havia uma ponte viva,
   * e quem confiou nele foi até a igreja descobrir que nenhuma ação
   * funcionava. A ponte reporta `holyricsOk` no sinal de vida justamente
   * para isto ser detectável; ignorar esse campo era transformar um
   * diagnóstico preciso em silêncio.
   */
  | { estado: 'ponte-sem-holyrics'; computador: string }
  /** Chegou no Holyrics, mas ele recusou o token ou a permissão da ação. */
  | { estado: 'recusado'; motivo: string }
  /**
   * O Holyrics responde e o token vale, MAS ações de ESCRITA que o Coredja
   * usa não estão liberadas em "gerenciar permissões".
   *
   * Estado próprio porque é o caso que mais enganou até hoje (24/08/2026):
   * a sonda de leitura passava, a tela dizia "conectado", e no domingo nada
   * ia para o telão. Responder e AUTORIZAR são coisas diferentes — o teste
   * antigo só sabia da primeira, e por isso dava um "ok" que não valia nada.
   */
  | { estado: 'sem-permissao'; acoesBloqueadas: string[] }
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
    // A ponte diz, no próprio sinal de vida, se ELA alcança o Holyrics.
    // Ignorar isso e responder "conectado" só porque existe ponte viva é o
    // que fez alguém viajar até a igreja para descobrir na hora que nada
    // funcionava — ver `ponte-sem-holyrics` em `DiagnosticoHolyrics`.
    if (!infoDaPonte.holyricsOk) {
      return { estado: 'ponte-sem-holyrics', computador: infoDaPonte.computador };
    }
    // A ponte alcança o Holyrics — falta saber se ele AUTORIZA o que ela
    // manda. Pontes novas reportam a sondagem no sinal de vida; as antigas
    // não mandam o campo, e aí não há o que afirmar (`undefined`), só seguir.
    if (infoDaPonte.acoesBloqueadas && infoDaPonte.acoesBloqueadas.length > 0) {
      return { estado: 'sem-permissao', acoesBloqueadas: infoDaPonte.acoesBloqueadas };
    }

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
          : `Não foi possível alcançar ${config.url}. ${DICA_LOG_DO_HOLYRICS}`,
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

  // Token aceito e leitura funcionando. Isso ainda NÃO quer dizer que os
  // comandos vão para o telão: cada ação de escrita tem permissão própria,
  // e são elas que fazem o trabalho de domingo. Sondar aqui é o que separa
  // "o Holyrics respondeu" de "o Coredja consegue mandar alguma coisa".
  const bloqueadas = await acoesBloqueadas(config);
  if (bloqueadas.length > 0) {
    return { estado: 'sem-permissao', acoesBloqueadas: bloqueadas };
  }

  return { estado: 'ok', painelNoAr: dados.data?.countdown_show === true };
}
