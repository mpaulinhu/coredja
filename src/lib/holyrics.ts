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
  'O texto foi para o telão, mas a arte não: a API do Holyrics não recebe imagens de fora. Projete a arte manualmente.';

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
