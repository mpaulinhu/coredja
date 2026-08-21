/**
 * O que a tela de Configurações recebe do servidor.
 *
 * Vive num arquivo próprio, e não em `configuracoes.ts`, pelo mesmo motivo de
 * `conversa-compartilhado.ts`: `configuracoes.ts` importa `firebase-admin`,
 * e um Componente de Cliente que importasse os tipos de lá arrastaria o
 * Admin SDK inteiro para o pacote do navegador — o build quebra com
 * "Can't resolve 'child_process'".
 *
 * Aqui só há tipos e constantes de texto. Nada executa.
 */

import type { OrigemDoValor } from './configuracoes';

export type { OrigemDoValor };

/** Um valor configurável, do jeito que a tela precisa exibir. */
export interface CampoDeConfiguracao {
  /** Já mascarado quando é segredo — o valor real nunca sai do servidor. */
  valor: string;
  origem: OrigemDoValor;
}

/** Como está a conexão com o Holyrics, quando o teste roda. */
export interface ResultadoDoTeste {
  estado: 'nao-configurado' | 'ok' | 'ok-pela-ponte' | 'recusado' | 'inalcancavel';
  motivo?: string;
  /** Só em `ok`: se há um cronômetro no ar agora no painel de comunicação. */
  painelNoAr?: boolean;
  /** Só em `ok-pela-ponte`: qual computador está servindo de ponte agora. */
  computador?: string;
}

/** Uma pendência de configuração — o checklist do topo da tela. */
export interface Pendencia {
  /** Identificador estável, para a tela dar `key` sem usar índice. */
  id: string;
  titulo: string;
  detalhe: string;
  /** `aviso` não impede o uso; `bloqueio` impede a função de funcionar. */
  gravidade: 'aviso' | 'bloqueio';
}

/** Tudo que a tela de Configurações precisa, numa resposta só. */
export interface ConfiguracoesParaTela {
  holyrics: {
    url: CampoDeConfiguracao;
    token: CampoDeConfiguracao;
    configurado: boolean;
  };
  firebase: {
    /** "firebase" ou "sqlite" — de onde os dados estão vindo agora. */
    armazenamento: string;
    projetoId: string;
    /** Se o servidor conseguiu falar com o Firestore nesta consulta. */
    conectado: boolean;
    /** Se o navegador tem a configuração pública (o tempo real depende dela). */
    tempoRealConfigurado: boolean;
  };
  /** Quem salvou por último pela tela, e quando. Ausente se nunca salvaram. */
  ultimaAlteracao?: { por: string; em: string };
  pendencias: Pendencia[];
}

/**
 * As ações que o Coredja chama na API do Holyrics — cada uma precisa estar
 * liberada individualmente em "gerenciar permissões" (coluna "Local").
 *
 * Esta lista existe na tela porque a causa nº 1 de "configurei e não
 * funciona" é uma ação não liberada: o token está certo, o endereço está
 * certo, e mesmo assim vem 401. Conferir contra uma lista é mais rápido do
 * que descobrir uma a uma quando o recurso falha ao vivo.
 */
export const ACOES_DO_HOLYRICS: { acao: string; paraQue: string }[] = [
  {
    acao: 'GetCommunicationPanelInfo',
    paraQue: 'Ler quanto falta no cronômetro — é o que o "Testar conexão" usa.',
  },
  {
    acao: 'SetTextCommunicationPanel',
    paraQue: 'Projetar o texto do aviso na tela de retorno.',
  },
  {
    acao: 'StartCountdownCommunicationPanel',
    paraQue: 'Ligar o cronômetro do bloco da ordem do culto.',
  },
  {
    acao: 'StopCountdownCommunicationPanel',
    paraQue: 'Desligar o cronômetro ao encerrar o bloco.',
  },
  {
    acao: 'SetCommunicationPanelSettings',
    paraQue: 'Limpar o rótulo que sobra acima do cronômetro.',
  },
  {
    acao: 'AddToPlaylist',
    paraQue: 'Mandar o aviso para a fila, sem projetar na hora.',
  },
];

/**
 * Arruma o endereço digitado antes de conferir se ele serve.
 *
 * Existe porque a forma natural de escrever isso é `192.168.50.103:8091` — é
 * o que o Holyrics mostra na tela do API Server, e é o que qualquer pessoa
 * digita. Exigir o `http://` na mão e devolver "Endereço inválido" para quem
 * escreveu o IP certo é o sistema cobrando cerimônia por uma coisa que ele
 * mesmo sabe completar.
 *
 * O que é consertado sozinho, sem reclamar:
 *
 * - `192.168.50.103:8091`  → ganha `http://` na frente
 * - `http//` e `http:/`    → viram `http://` (escorregão comum de digitação)
 * - espaços no meio        → removidos (colar de PDF/WhatsApp costuma trazer)
 * - barra(s) no fim        → removidas
 *
 * O que NÃO se conserta é a porta ausente: `192.168.50.103` sozinho pode ser
 * um endereço legítimo em qualquer porta, e chutar 8091 esconderia um erro
 * de digitação atrás de um timeout de 5 segundos no domingo.
 */
export function normalizarEnderecoDoHolyrics(url: string): string {
  // `\s` cobre o espaço comum e também o espaço-duro (U+00A0), que é o que
  // vem colado quando o endereço passou por PDF ou por mensagem formatada.
  let limpo = url.trim().replace(/[\s ]+/g, '');
  if (!limpo) return '';

  // Escorregões no esquema, antes de decidir se falta o esquema inteiro.
  limpo = limpo.replace(/^(https?):\/{3,}/i, '$1://');
  limpo = limpo.replace(/^(https?):\/(?!\/)/i, '$1://');
  limpo = limpo.replace(/^(https?)\/\//i, '$1://');
  limpo = limpo.replace(/^(https?):(?![/])/i, '$1://');

  // Sem esquema nenhum: assume http, que é o que o API Server do Holyrics
  // usa na rede local (ele não serve https).
  if (!/^https?:\/\//i.test(limpo)) {
    limpo = `http://${limpo}`;
  }

  return limpo.replace(/\/+$/, '');
}

/**
 * Confere um endereço antes de gravar. Devolve o problema, ou null.
 *
 * Recebe o endereço JÁ passado por `normalizarEnderecoDoHolyrics` — o que
 * sobra aqui são os casos que não dá para adivinhar sem arriscar esconder um
 * erro de digitação.
 */
export function problemaNoEnderecoDoHolyrics(url: string): string | null {
  const limpo = url.trim();
  if (!limpo) return null; // vazio é válido: desliga a integração

  let alvo: URL;
  try {
    alvo = new URL(limpo);
  } catch {
    return 'Não consegui entender esse endereço. O formato é o IP do computador com a porta — ex: 192.168.0.10:8091';
  }

  if (alvo.protocol !== 'http:' && alvo.protocol !== 'https:') {
    return 'O endereço precisa ser http:// ou https://';
  }

  // O API Server do Holyrics não roda na 80/443: sem porta explícita é quase
  // sempre alguém que colou só o IP e vai levar timeout sem entender por quê.
  if (!alvo.port) {
    return `Falta a porta no fim do endereço — normalmente 8091, então ficaria ${alvo.host}:8091. No Holyrics ela aparece em Configurações → API Server.`;
  }

  return null;
}
