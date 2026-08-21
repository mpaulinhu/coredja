'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import {
  hojeLocal,
  horaLocal,
  statusDoCulto,
  type Bloco,
  type Culto,
  type StatusCulto,
} from '@/lib/culto';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { BibliotecaModelos } from './BibliotecaModelos';
import { EditorCulto } from './EditorCulto';
import { ExecucaoCulto } from './ExecucaoCulto';
import { ListaCultos } from './ListaCultos';

const REGEX_ID = /^\d{4}-\d{2}-\d{2}__\d{2}:\d{2}$/;

/** O que as rotas de culto devolvem sobre o Holyrics, quando devolvem. */
interface RespostaHolyrics {
  erro?: string;
  holyrics?: { estado: string; motivo?: string } | null;
}

/** Distância em minutos entre dois horários `"HH:MM"`, sempre positiva. */
function distanciaMinutos(a: string, b: string): number {
  const [ha, ma] = a.split(':').map(Number);
  const [hb, mb] = b.split(':').map(Number);
  return Math.abs(ha * 60 + ma - (hb * 60 + mb));
}

/**
 * Ordem do Culto: escuta o Firestore direto (mesmo padrão de tempo real de
 * `useEventos`, mas sem passar por ele — aquele hook está amarrado à coleção
 * `mensagens`) e decide o modo de exibição pelo que o servidor permite.
 *
 * A distinção entre "monta" e "só executa" não pergunta o papel da pessoa
 * diretamente — ela TENTA gravar, e o servidor decide (ver
 * `api/culto/route.ts`). Perguntar ao servidor "montar deu certo?" em vez de
 * perguntar "qual é o meu papel?" evita duplicar a regra de permissão em dois
 * lugares que podem divergir.
 *
 * Quem monta vê a LISTA de ordens (cada culto tem sua data+hora — ver
 * `culto.ts`) e escolhe qual editar; quem só executa vê direto a ordem que
 * vale agora, sem lista para escolher, porque no domingo não há escolha a
 * fazer.
 */
export function TelaCulto() {
  const [cultos, setCultos] = useState<Culto[] | undefined>(undefined);
  const [podeMontar, setPodeMontar] = useState<boolean | null>(null);
  /** id em edição; `''` é uma ordem nova ainda sem data escolhida. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /** Blocos vindos de "Duplicar", para pré-preencher uma ordem nova. */
  const [blocosParaDuplicar, setBlocosParaDuplicar] = useState<Bloco[] | null>(null);
  /** id da ordem aberta em tela cheia para operar ao vivo. null = não está operando. */
  const [operandoId, setOperandoId] = useState<string | null>(null);
  /** Biblioteca de modelos aberta — o botão "Modelos" do topo da lista. */
  const [vendoModelos, setVendoModelos] = useState(false);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return; // sem Firebase configurado, a tela fica vazia

    return onSnapshot(collection(db, 'culto'), (snap) => {
      setCultos(
        snap.docs
          .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
          // Mesma guarda do servidor (`culto-store.ts`): a coleção pode ter
          // sobras que não são cultos (ou documentos legados ainda não
          // migrados para o schema data__hora), e uma delas não pode quebrar
          // a tela.
          .filter((culto) => REGEX_ID.test(culto.id))
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
    });
  }, []);

  useEffect(() => {
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) {
        setPodeMontar(false);
        return;
      }
      // Quem decide é o servidor: ele devolve `podeMontar` junto da lista
      // (ver `api/culto/route.ts`), em vez de a tela deduzir pelo status ou
      // reimplementar a regra de papel aqui.
      const resp = await fetch('/api/culto', { headers: cabecalho });
      if (!resp.ok) {
        setPodeMontar(false);
        return;
      }
      const corpo = (await resp.json()) as { podeMontar?: boolean };
      setPodeMontar(Boolean(corpo.podeMontar));
    })();
  }, []);

  const salvar = useCallback(
    async (
      data: string,
      hora: string,
      blocos: Bloco[],
      status: StatusCulto,
      idAnterior?: string,
    ) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

      const resp = await fetch('/api/culto', {
        method: 'PUT',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, hora, blocos, status, idAnterior }),
      });
      const corpo = await resp.json();
      if (!resp.ok) return { ok: false as const, erro: corpo.erro ?? 'Falha ao salvar.' };
      // A data+hora é o id: mudá-la move a ordem, e o id em edição precisa
      // acompanhar, senão o editor perde de vista o que acabou de salvar.
      if (corpo.culto?.id) setEditandoId(corpo.culto.id);
      return { ok: true as const };
    },
    [],
  );

  const remover = useCallback(async (id: string) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch(`/api/culto/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: cabecalho,
    });
  }, []);

  /**
   * Avançar bloco. Devolve o recado sobre o Holyrics (ou `null`) para a tela
   * mostrar — o avanço em si já aconteceu no servidor de qualquer jeito, ver
   * `api/culto/avancar/route.ts`.
   *
   * Sem `cultoId` o servidor avança a ordem ATIVA — é o caso do operador, que
   * não escolhe qual culto está no ar. Com id, avança a que a pessoa abriu.
   */
  const avancar = useCallback(async (cultoId?: string): Promise<string | null> => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return 'Sessão expirada. Recarregue a página.';
    const resp = await fetch('/api/culto/avancar', {
      method: 'POST',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify(cultoId ? { cultoId } : {}),
    });
    const corpo = (await resp.json().catch(() => null)) as RespostaHolyrics | null;
    if (!resp.ok) return corpo?.erro ?? 'Não foi possível avançar.';

    const holyrics = corpo?.holyrics;
    if (!holyrics || holyrics.estado === 'enviado') return null;
    return `Bloco avançado, mas o cronômetro não foi ao Holyrics. ${holyrics.motivo ?? ''}`.trim();
  }, []);

  /** Pula direto para um bloco (adiante ou de volta). Mesmo contrato de `avancar`. */
  const irParaBloco = useCallback(
    async (cultoId: string, blocoId: string): Promise<string | null> => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return 'Sessão expirada. Recarregue a página.';
      const resp = await fetch('/api/culto/bloco', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultoId, blocoId }),
      });
      const corpo = (await resp.json().catch(() => null)) as RespostaHolyrics | null;
      if (!resp.ok) return corpo?.erro ?? 'Não foi possível mudar o bloco.';

      const holyrics = corpo?.holyrics;
      if (!holyrics || holyrics.estado === 'enviado') return null;
      return `Bloco trocado, mas o cronômetro não foi ao Holyrics. ${holyrics.motivo ?? ''}`.trim();
    },
    [],
  );

  /**
   * Estica (ou encurta, com `minutos` negativo) o cronômetro do bloco em
   * andamento, sem mexer na ordem montada.
   *
   * Grava em `minutosExtras` (não em `bloco.minutos`) e manda o mesmo tempo
   * ao Holyrics — ver `api/culto/tempo-extra`.
   */
  const tempoExtra = useCallback(
    async (minutos: number, cultoId?: string): Promise<string | null> => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return 'Sessão expirada. Recarregue a página.';
      const resp = await fetch('/api/culto/tempo-extra', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify(cultoId ? { minutos, cultoId } : { minutos }),
      });
      const corpo = (await resp.json().catch(() => null)) as RespostaHolyrics | null;
      if (!resp.ok) return corpo?.erro ?? 'Não foi possível dar mais tempo.';

      const holyrics = corpo?.holyrics;
      // Sem Holyrics configurado não há erro a relatar: o cronômetro da
      // própria tela já recebeu os minutos, que é o efeito principal agora.
      // `holyricsParaTela` devolve null quando a integração nem está
      // configurada, então cair aqui significa erro de verdade.
      if (!holyrics || holyrics.estado === 'enviado') return null;
      const gesto =
        minutos > 0 ? `Mais ${minutos} min` : `Menos ${Math.abs(minutos)} min`;
      return `${gesto} na tela, mas o Holyrics não recebeu. ${holyrics.motivo ?? ''}`.trim();
    },
    [],
  );

  /**
   * Acerta quanto AINDA FALTA do bloco em andamento — o tempo digitado no
   * cronômetro da tela.
   *
   * Não confundir com `tempoExtra`: aquele muda a DURAÇÃO prevista do bloco
   * (`minutosExtras`), este muda o RELÓGIO (o quanto se considera já
   * corrido). Ver `api/culto/tempo-restante`.
   */
  const definirRestante = useCallback(
    async (segundos: number, cultoId?: string): Promise<string | null> => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return 'Sessão expirada. Recarregue a página.';
      const resp = await fetch('/api/culto/tempo-restante', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify(cultoId ? { segundos, cultoId } : { segundos }),
      });
      const corpo = (await resp.json().catch(() => null)) as RespostaHolyrics | null;
      if (!resp.ok) return corpo?.erro ?? 'Não foi possível acertar o tempo.';

      const holyrics = corpo?.holyrics;
      if (!holyrics || holyrics.estado === 'enviado') return null;
      return `Tempo acertado na tela, mas o Holyrics não recebeu. ${holyrics.motivo ?? ''}`.trim();
    },
    [],
  );

  /** Pausa ou retoma o cronômetro (na tela e no Holyrics). */
  const pausar = useCallback(
    async (pausarAgora: boolean, cultoId?: string): Promise<string | null> => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return 'Sessão expirada. Recarregue a página.';
      const resp = await fetch('/api/culto/pausar', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          cultoId ? { pausar: pausarAgora, cultoId } : { pausar: pausarAgora },
        ),
      });
      const corpo = (await resp.json().catch(() => null)) as RespostaHolyrics | null;
      if (!resp.ok) return corpo?.erro ?? 'Não foi possível pausar.';

      const holyrics = corpo?.holyrics;
      if (!holyrics || holyrics.estado === 'enviado') return null;
      const gesto = pausarAgora ? 'Pausado' : 'Retomado';
      return `${gesto} aqui, mas o Holyrics não acompanhou. ${holyrics.motivo ?? ''}`.trim();
    },
    [],
  );

  const concluir = useCallback(async (id: string, concluirAgora: boolean) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch(`/api/culto/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: concluirAgora ? 'concluir' : 'reabrir' }),
    });
  }, []);

  /**
   * Abre o editor em branco com os blocos da ordem `id`, sem tocar o original.
   */
  const duplicar = useCallback(
    (id: string) => {
      const original = cultos?.find((c) => c.id === id);
      if (!original) return;
      setBlocosParaDuplicar(
        original.blocos.map((b) => ({ ...b, id: crypto.randomUUID() })),
      );
      setEditandoId('');
    },
    [cultos],
  );

  // Mesma regra do servidor (`buscarAtiva`): entre as de hoje ainda não
  // concluídas, a de horário mais próximo de agora; senão a próxima futura
  // não concluída. Repetida aqui porque a lista chega pelo Firestore em tempo
  // real, sem passar pela API — perguntar ao servidor de novo atrasaria o
  // selo.
  const ativa = useMemo(() => {
    if (!cultos) return null;
    const hoje = hojeLocal();
    const agora = horaLocal();

    // Rascunho fora da eleição, igual ao servidor (`buscarAtiva`): um
    // esboço não pode roubar o posto de "no ar agora". Ver `culto.ts`.
    const elegiveis = cultos.filter((c) => statusDoCulto(c) !== 'rascunho');

    const deHoje = elegiveis.filter((c) => c.data === hoje && !c.concluidoEm);
    if (deHoje.length > 0) {
      return deHoje.reduce((maisProxima, atual) =>
        distanciaMinutos(atual.hora, agora) < distanciaMinutos(maisProxima.hora, agora)
          ? atual
          : maisProxima,
      );
    }

    return elegiveis.find((c) => c.data > hoje && !c.concluidoEm) ?? null;
  }, [cultos]);

  if (cultos === undefined || podeMontar === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  // Quem só opera não tem lista para escolher: cai direto na ordem ativa, sem
  // "Voltar" (não há para onde). Quem monta chega na MESMA tela clicando num
  // culto da lista — o componente é um só, muda apenas de onde vem o culto.
  if (!podeMontar) {
    return (
      <ExecucaoCulto
        culto={ativa}
        onAvancar={() => avancar()}
        onIrParaBloco={(blocoId) =>
          ativa
            ? irParaBloco(ativa.id, blocoId)
            : Promise.resolve('Nenhuma ordem ativa agora.')
        }
        onTempoExtra={(minutos) => tempoExtra(minutos)}
        onDefinirRestante={(segundos) => definirRestante(segundos)}
        onPausar={(pausarAgora) => pausar(pausarAgora)}
      />
    );
  }

  if (operandoId !== null) {
    // Lido da lista a cada render, não copiado para o estado: assim o
    // Firestore em tempo real reflete aqui o avanço feito de outro aparelho.
    const emOperacao = cultos.find((c) => c.id === operandoId) ?? null;
    return (
      <ExecucaoCulto
        culto={emOperacao}
        onAvancar={() => avancar(operandoId)}
        onIrParaBloco={(blocoId) => irParaBloco(operandoId, blocoId)}
        onTempoExtra={(minutos) => tempoExtra(minutos, operandoId)}
        onDefinirRestante={(segundos) => definirRestante(segundos, operandoId)}
        onPausar={(pausarAgora) => pausar(pausarAgora, operandoId)}
        onConcluir={async () => {
          await concluir(operandoId, true);
          setOperandoId(null);
        }}
        onEditar={() => {
          setOperandoId(null);
          setEditandoId(operandoId);
        }}
        onVoltar={() => setOperandoId(null)}
      />
    );
  }

  if (vendoModelos) {
    return (
      <BibliotecaModelos
        onUsar={(blocos) => {
          setBlocosParaDuplicar(blocos);
          setVendoModelos(false);
          setEditandoId('');
        }}
        onVoltar={() => setVendoModelos(false)}
      />
    );
  }

  if (editandoId !== null) {
    const emEdicao = cultos.find((c) => c.id === editandoId) ?? null;
    return (
      <EditorCulto
        culto={emEdicao}
        idsOcupados={cultos.map((c) => c.id)}
        blocosIniciais={blocosParaDuplicar}
        onSalvar={salvar}
        onVoltar={() => {
          setEditandoId(null);
          setBlocosParaDuplicar(null);
        }}
      />
    );
  }

  return (
    <ListaCultos
      cultos={cultos}
      ativaId={ativa?.id ?? null}
      onNova={() => setEditandoId('')}
      onEditar={setEditandoId}
      onDuplicar={duplicar}
      onRemover={remover}
      onOperar={setOperandoId}
      onConcluir={concluir}
      onModelos={() => setVendoModelos(true)}
    />
  );
}
