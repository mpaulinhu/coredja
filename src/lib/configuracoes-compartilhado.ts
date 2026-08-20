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
  estado: 'nao-configurado' | 'ok' | 'recusado' | 'inalcancavel';
  motivo?: string;
  /** Só em `ok`: se há um cronômetro no ar agora no painel de comunicação. */
  painelNoAr?: boolean;
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

/** Confere um endereço antes de gravar. Devolve o problema, ou null. */
export function problemaNoEnderecoDoHolyrics(url: string): string | null {
  const limpo = url.trim();
  if (!limpo) return null; // vazio é válido: desliga a integração

  let alvo: URL;
  try {
    alvo = new URL(limpo);
  } catch {
    return 'Endereço inválido. Ele precisa começar com http:// e incluir a porta — ex: http://192.168.0.10:8091';
  }

  if (alvo.protocol !== 'http:' && alvo.protocol !== 'https:') {
    return 'O endereço precisa começar com http:// ou https://';
  }

  // O API Server do Holyrics não roda na 80/443: sem porta explícita é quase
  // sempre alguém que colou só o IP e vai levar timeout sem entender por quê.
  if (!alvo.port) {
    return 'Falta a porta no endereço. No Holyrics ela aparece em Configurações → API Server — normalmente 8091.';
  }

  return null;
}
