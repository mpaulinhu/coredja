import {
  lerConfiguracoesGravadas,
  mascarar,
  resolver,
  salvarConfiguracoes,
} from '@/lib/configuracoes';
import {
  problemaNoEnderecoDoHolyrics,
  type ConfiguracoesParaTela,
  type Pendencia,
} from '@/lib/configuracoes-compartilhado';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { ARMAZENAMENTO_ATIVO, store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * A tela de Configurações — o que está ligado, o que falta, e o que dá para
 * mudar sem abrir arquivo nenhum.
 *
 * Exige `departamentos:escrever` (admin) nos DOIS métodos, inclusive no GET:
 * diferente de `/api/departamentos`, cuja lista todo mundo precisa, aqui
 * mesmo a leitura revela topologia da instalação (endereço do PC do
 * audiovisual, id do projeto no Firebase, o que está pendente). Não é
 * informação para quem só opera o domingo.
 *
 * Reutiliza `departamentos:escrever` em vez de criar uma permissão nova
 * porque as duas coisas são exatamente "ser admin" — inventar
 * `configuracoes:escrever` só para dar o mesmo resultado acrescentaria uma
 * peça sem acrescentar controle.
 */

/** O token real nunca sai daqui — ver o cabeçalho de `configuracoes.ts`. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja vê as configurações.' },
      { status: 403 },
    );
  }

  const gravado = await lerConfiguracoesGravadas();

  const url = resolver(gravado.holyricsUrl, process.env.HOLYRICS_URL);
  const token = resolver(gravado.holyricsToken, process.env.HOLYRICS_TOKEN);
  const holyricsConfigurado = Boolean(url.valor && token.valor);

  // A lista de departamentos serve a duas coisas: entra no checklist e prova,
  // de quebra, que o servidor fala com o banco. Uma falha aqui é o próprio
  // diagnóstico do Firebase, então o erro vira `conectado: false` em vez de
  // derrubar a resposta inteira.
  let departamentos: { slug: string }[] = [];
  let bancoConectado = true;
  try {
    departamentos = await store.listarDepartamentos();
  } catch {
    bancoConectado = false;
  }

  // O tempo real (o painel atualizando sozinho, sem F5) depende da
  // configuração PÚBLICA do Firebase, que é outra coisa da credencial do
  // servidor — dá para ter uma sem a outra, e o sintoma seria "tudo funciona
  // mas nada aparece sozinho". Por isso as duas entram separadas.
  const tempoRealConfigurado = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );

  const resposta: ConfiguracoesParaTela = {
    holyrics: {
      url: { valor: url.valor, origem: url.origem },
      // Mascarado sempre, para qualquer um: a tela mostra o suficiente para
      // conferir "é esse token mesmo", nunca o bastante para usá-lo.
      token: { valor: mascarar(token.valor), origem: token.origem },
      configurado: holyricsConfigurado,
    },
    firebase: {
      armazenamento: ARMAZENAMENTO_ATIVO,
      projetoId:
        process.env.FIREBASE_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
        '',
      conectado: bancoConectado,
      tempoRealConfigurado,
    },
    ultimaAlteracao:
      gravado.atualizadoEm && gravado.atualizadoPor
        ? { por: gravado.atualizadoPor, em: gravado.atualizadoEm }
        : undefined,
    pendencias: montarPendencias({
      holyricsConfigurado,
      bancoConectado,
      tempoRealConfigurado,
      armazenamento: ARMAZENAMENTO_ATIVO,
      quantosDepartamentos: departamentos.length,
    }),
  };

  return Response.json(resposta);
}

/** Salva endereço e/ou token do Holyrics. Só admin. */
export async function PUT(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja muda as configurações.' },
      { status: 403 },
    );
  }

  let corpo: { holyricsUrl?: string; holyricsToken?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const mudancas: { holyricsUrl?: string; holyricsToken?: string } = {};

  if (typeof corpo.holyricsUrl === 'string') {
    const url = corpo.holyricsUrl.trim().replace(/\/+$/, '');
    const problema = problemaNoEnderecoDoHolyrics(url);
    if (problema) return Response.json({ erro: problema }, { status: 400 });
    mudancas.holyricsUrl = url;
  }

  // `undefined` (campo ausente) é "não mexa no token" — é o que a tela manda
  // ao salvar só o endereço. String vazia é "apague o token", explícito.
  // Sem essa distinção, salvar o endereço apagaria o token toda vez, já que
  // a tela nunca teve o valor real para reenviar.
  if (typeof corpo.holyricsToken === 'string') {
    mudancas.holyricsToken = corpo.holyricsToken.trim();
  }

  if (Object.keys(mudancas).length === 0) {
    return Response.json({ erro: 'Nada para salvar.' }, { status: 400 });
  }

  try {
    await salvarConfiguracoes(mudancas, pessoa.nome);
  } catch {
    return Response.json(
      {
        erro: 'Não foi possível gravar. Confira o diagnóstico do Firebase abaixo — sem banco, a configuração só pode vir do arquivo .env.local.',
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}

/**
 * Monta o checklist do topo: o que ainda falta para o Coredja funcionar
 * inteiro nesta instalação.
 *
 * A ordem importa — o que impede é listado antes do que só limita. Cada item
 * diz o que fazer, não só o que está errado: "Holyrics não configurado" sem
 * o próximo passo obriga quem lê a adivinhar.
 */
function montarPendencias(estado: {
  holyricsConfigurado: boolean;
  bancoConectado: boolean;
  tempoRealConfigurado: boolean;
  armazenamento: string;
  quantosDepartamentos: number;
}): Pendencia[] {
  const lista: Pendencia[] = [];

  if (!estado.bancoConectado) {
    lista.push({
      id: 'banco',
      titulo: 'O servidor não está falando com o banco',
      detalhe:
        'Nada será gravado enquanto isso durar. Confira a credencial em segredos/ e o FIREBASE_PROJECT_ID no .env.local.',
      gravidade: 'bloqueio',
    });
  }

  if (!estado.holyricsConfigurado) {
    lista.push({
      id: 'holyrics',
      titulo: 'Holyrics não está configurado',
      detalhe:
        'O Coredja funciona normalmente sem ele — só não projeta o aviso nem o cronômetro no telão sozinho. Preencha endereço e token aqui embaixo para ligar.',
      gravidade: 'aviso',
    });
  }

  if (estado.armazenamento === 'firebase' && !estado.tempoRealConfigurado) {
    lista.push({
      id: 'tempo-real',
      titulo: 'O tempo real está desligado',
      detalhe:
        'As telas só atualizam com F5: falta a configuração pública do Firebase (as variáveis NEXT_PUBLIC_FIREBASE_*) no .env.local.',
      gravidade: 'aviso',
    });
  }

  if (estado.armazenamento === 'sqlite') {
    lista.push({
      id: 'armazenamento-local',
      titulo: 'Os dados estão sendo salvos só nesta máquina',
      detalhe:
        'COREDJA_STORAGE=sqlite guarda tudo no arquivo dados/coredja.db. Para o Coredja publicado, com várias pessoas acessando, troque para firebase no .env.local.',
      gravidade: 'aviso',
    });
  }

  // Dois é o mínimo para existir uma conversa — com um só, o Painel abre vazio
  // e não há como o Coredja explicar por quê.
  if (estado.bancoConectado && estado.quantosDepartamentos < 2) {
    lista.push({
      id: 'departamentos',
      titulo: 'Faltam departamentos cadastrados',
      detalhe:
        'É preciso pelo menos dois para existir uma conversa. Cadastre em Departamentos, no menu.',
      gravidade: 'bloqueio',
    });
  }

  return lista;
}
