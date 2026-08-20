import { getFirestoreDb } from './firebase';
import {
  duracaoDoBlocoAtualEmSegundos,
  hojeLocal,
  horaLocal,
  idDoCulto,
  indiceDoBlocoAtual,
  statusDoCulto,
  type Bloco,
  type Culto,
  type ModeloCulto,
  type NovoCulto,
  type NovoModelo,
  type StoreCulto,
} from './culto';

/**
 * Implementação de `StoreCulto` sobre o Cloud Firestore.
 *
 * Ao contrário dos recados (`store.ts`), esta tela não tem versão SQLite:
 * a Ordem do Culto só existe para ser preparada na semana por uma pessoa e
 * lida por outra no domingo — sem publicação, isso não tem uso. Ver a nota em
 * `culto.ts` sobre a plataforma deixar de ser local.
 *
 * A coleção guarda uma ordem por data+hora, com o id do documento sendo
 * `"{data}__{hora}"` — ver `culto.ts`.
 */

const COLECAO = 'culto';
const COLECAO_MODELOS = 'culto_modelos';

function colecao() {
  return getFirestoreDb().collection(COLECAO);
}

function colecaoModelos() {
  return getFirestoreDb().collection(COLECAO_MODELOS);
}

/** Formato válido do id atual: `"YYYY-MM-DD__HH:MM"`. */
const REGEX_ID = /^\d{4}-\d{2}-\d{2}__\d{2}:\d{2}$/;

/**
 * A igreja não tem centenas de cultos: ler a coleção inteira e ordenar em
 * memória é mais simples que manter índice e paginação, e evita um `orderBy`
 * que quebraria com os documentos legados sem os campos `hora`/`concluidoEm`.
 *
 * Ignora documento cujo id não está no formato novo (`data__hora`): a
 * migração (`scripts/migrar-culto-multiplas-ordens.mjs`) precisa rodar antes
 * de um documento antigo (id só com a data) aparecer aqui — enquanto isso não
 * acontece, uma sobra no formato velho não pode derrubar a tela inteira.
 */
async function todos(): Promise<Culto[]> {
  const snap = await colecao().get();
  return snap.docs
    .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
    .filter((culto) => REGEX_ID.test(culto.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const cultoStore: StoreCulto = {
  listar: todos,

  async buscar(id: string) {
    const doc = await colecao().doc(id).get();
    return doc.exists ? ({ ...(doc.data() as Culto), id: doc.id }) : null;
  },

  async buscarAtiva() {
    const hoje = hojeLocal();
    const agora = horaLocal();

    // Rascunho fica de fora da eleição automática: é uma ordem ainda sendo
    // montada (blocos pela metade, tempos chutados), e deixá-la concorrer
    // faria um esboço do culto de quarta roubar o posto de "no ar agora" do
    // domingo. Ver `Culto.status`. Continua operável se alguém abrir pela
    // lista de propósito — o que muda é só quem escolhe: o relógio ou uma
    // pessoa.
    const lista = (await todos()).filter((c) => statusDoCulto(c) !== 'rascunho');
    const deHoje = lista.filter((c) => c.data === hoje && !c.concluidoEm);

    if (deHoje.length > 0) {
      // Entre as de hoje ainda abertas, a de horário mais próximo do agora —
      // não necessariamente a mais tarde nem a mais cedo: se já passaram das
      // 20h e há uma às 09h (encerrada) e uma às 19h (não concluída), a das
      // 19h é a que está "no ar" mesmo que já tenha ultrapassado o horário.
      return deHoje.reduce((maisProxima, atual) =>
        distanciaMinutos(atual.hora, agora) < distanciaMinutos(maisProxima.hora, agora)
          ? atual
          : maisProxima,
      );
    }

    // Nenhuma hoje (ou todas concluídas): a próxima futura, ignorando
    // concluídas — uma ordem de amanhã concluída de propósito não deveria
    // aparecer como "ativa" antes da hora.
    return (
      lista.find((c) => c.data > hoje && !c.concluidoEm) ?? null
    );
  },

  async salvar(dados: NovoCulto, autor: string) {
    const id = idDoCulto(dados.data, dados.hora);
    const culto: Culto = {
      id,
      data: dados.data,
      hora: dados.hora,
      blocos: dados.blocos,
      // Uma edição nova sempre reinicia a execução: o que estava "em
      // andamento" pertencia à sequência antiga, que pode ter mudado de
      // ordem ou perdido blocos. Os campos de cronômetro descrevem esse
      // mesmo "em andamento", então zeram junto — deixar um
      // `blocoIniciadoEm` de uma sequência que não existe mais faria o
      // cronômetro nascer contando um tempo sem dono.
      blocoAtualId: null,
      blocoIniciadoEm: null,
      pausadoEm: null,
      segundosAcumulados: 0,
      minutosExtras: 0,
      status: dados.status ?? 'pronta',
      concluidoEm: null,
      editadoPor: autor,
      editadoEm: new Date().toISOString(),
    };
    await colecao().doc(id).set(culto);
    return culto;
  },

  async remover(id: string) {
    await colecao().doc(id).delete();
  },

  async avancar(id: string) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const indiceAtual = culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
    const proximo: Bloco | undefined =
      indiceAtual === -1 ? culto.blocos[0] : culto.blocos[indiceAtual + 1];

    const atualizado: Culto = { ...culto, ...trocarDeBloco(proximo?.id ?? null) };
    await ref.set(atualizado);
    return atualizado;
  },

  async definirBlocoAtual(id: string, blocoId: string) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    // Bloco de outra ordem (ou de uma sequência que foi reescrita depois que
    // a tela carregou) não pode virar o atual: gravaria um `blocoAtualId` que
    // não existe em `blocos`, e a tela leria isso como "culto encerrado".
    if (!culto.blocos.some((b) => b.id === blocoId)) return null;

    const atualizado: Culto = { ...culto, ...trocarDeBloco(blocoId) };
    await ref.set(atualizado);
    return atualizado;
  },

  async reiniciar(id: string) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const atualizado: Culto = { ...culto, ...trocarDeBloco(null) };
    await ref.set(atualizado);
    return atualizado;
  },

  async concluir(id: string, concluir: boolean) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const atualizado: Culto = {
      ...culto,
      concluidoEm: concluir ? new Date().toISOString() : null,
    };
    await ref.set(atualizado);
    return atualizado;
  },

  async pausar(id: string, pausar: boolean) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const jaPausado = Boolean(culto.pausadoEm);
    // Clicar duas vezes (ou de dois aparelhos ao mesmo tempo) não pode
    // reprocessar: pausar o já-pausado zeraria o acumulado de novo a partir
    // do instante da segunda pausa, perdendo o tempo real do bloco.
    if (jaPausado === pausar) return culto;

    const agora = new Date();

    if (pausar) {
      // Congela: o que já correu vira acumulado, e o relógio de referência
      // some. Ver `decorridoDoBlocoEmSegundos`.
      const acumulado = Number(culto.segundosAcumulados);
      const base = Number.isFinite(acumulado) && acumulado > 0 ? acumulado : 0;
      const inicio = culto.blocoIniciadoEm ? Date.parse(culto.blocoIniciadoEm) : NaN;
      const correu = Number.isFinite(inicio)
        ? Math.max(0, Math.floor((agora.getTime() - inicio) / 1000))
        : 0;

      const atualizado: Culto = {
        ...culto,
        pausadoEm: agora.toISOString(),
        segundosAcumulados: base + correu,
      };
      await ref.set(atualizado);
      return atualizado;
    }

    // Retoma: o acumulado fica como está e o relógio recomeça de agora —
    // o tempo que a pausa durou simplesmente não conta.
    const atualizado: Culto = {
      ...culto,
      pausadoEm: null,
      blocoIniciadoEm: agora.toISOString(),
    };
    await ref.set(atualizado);
    return atualizado;
  },

  async darTempoExtra(id: string, minutos: number) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    // O acumulado pode já estar negativo (alguém tirou tempo antes), então
    // a base preserva o sinal — descartá-lo faria o segundo "-5" partir do
    // zero e desfazer o primeiro.
    const atuais = Number(culto.minutosExtras);
    const base = Number.isFinite(atuais) ? atuais : 0;

    const atualizado: Culto = { ...culto, minutosExtras: base + minutos };
    await ref.set(atualizado);
    return atualizado;
  },

  async definirRestante(id: string, segundos: number) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    // Sem bloco em andamento não há relógio a acertar: gravar um acumulado
    // aqui deixaria o número pendurado para o próximo bloco herdar.
    if (indiceDoBlocoAtual(culto) === -1) return null;

    // O restante é DERIVADO (duração - decorrido), então definir o restante
    // é escolher o decorrido que produz esse número. A duração fica como
    // está: os minutos do bloco são o planejado da semana, e digitar
    // "faltam 5" no domingo não deve reescrever o roteiro.
    const decorridoAlvo = duracaoDoBlocoAtualEmSegundos(culto) - Math.round(segundos);

    // Com o culto pausado o decorrido é o acumulado puro; correndo, é o
    // acumulado mais o tempo desde `blocoIniciadoEm`. Zerar o relógio de
    // referência para agora e pôr tudo no acumulado dá o mesmo número nos
    // dois estados — e mantém pausado o que estava pausado, porque
    // `pausadoEm` não é tocado. Ver `decorridoDoBlocoEmSegundos`.
    const atualizado: Culto = {
      ...culto,
      segundosAcumulados: decorridoAlvo,
      blocoIniciadoEm: new Date().toISOString(),
    };
    await ref.set(atualizado);
    return atualizado;
  },

  async listarModelos() {
    const snap = await colecaoModelos().get();
    return snap.docs
      .map((doc) => ({ ...(doc.data() as ModeloCulto), id: doc.id }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async salvarModelo(dados: NovoModelo, autor: string) {
    const ref = colecaoModelos().doc();
    const modelo: ModeloCulto = {
      id: ref.id,
      nome: dados.nome,
      blocos: dados.blocos,
      criadoPor: autor,
      criadoEm: new Date().toISOString(),
    };
    await ref.set(modelo);
    return modelo;
  },

  async removerModelo(id: string) {
    await colecaoModelos().doc(id).delete();
  },
};

/** Distância em minutos entre dois horários `"HH:MM"`, sempre positiva. */
function distanciaMinutos(a: string, b: string): number {
  const [ha, ma] = a.split(':').map(Number);
  const [hb, mb] = b.split(':').map(Number);
  return Math.abs(ha * 60 + ma - (hb * 60 + mb));
}

/**
 * Os campos de execução que TODA troca de bloco tem que reescrever juntos.
 *
 * São quatro, e esquecer um deixa o cronômetro mentindo de um jeito
 * diferente: sem `blocoIniciadoEm` novo ele conta o tempo do bloco anterior;
 * sem zerar `segundosAcumulados` ele nasce já com o acumulado do anterior;
 * sem limpar `pausadoEm` o bloco novo nasce congelado; sem zerar
 * `minutosExtras` o "+5 min" dado ao louvor vale também para a pregação.
 *
 * Existe como função porque três métodos trocam de bloco (`avancar`,
 * `definirBlocoAtual`, `reiniciar`) — deixar os quatro campos soltos em cada
 * um é exatamente o tipo de coisa que diverge na primeira alteração futura.
 *
 * `blocoIniciadoEm` é `null` quando não há bloco (culto reiniciado ou
 * encerrado): sem bloco não há o que cronometrar.
 */
function trocarDeBloco(blocoId: string | null): Pick<
  Culto,
  'blocoAtualId' | 'blocoIniciadoEm' | 'pausadoEm' | 'segundosAcumulados' | 'minutosExtras'
> {
  return {
    blocoAtualId: blocoId,
    blocoIniciadoEm: blocoId ? new Date().toISOString() : null,
    pausadoEm: null,
    segundosAcumulados: 0,
    minutosExtras: 0,
  };
}
