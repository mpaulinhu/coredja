'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { hojeLocal, type Bloco, type Culto } from '@/lib/culto';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { EditorCulto } from './EditorCulto';
import { ExecucaoCulto } from './ExecucaoCulto';
import { ListaCultos } from './ListaCultos';

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
 * Quem monta vê a LISTA de ordens (cada culto tem sua data desde que deixou de
 * existir um documento único — ver `culto.ts`) e escolhe qual editar; quem só
 * executa vê direto a ordem que vale hoje, sem lista para escolher, porque no
 * domingo não há escolha a fazer.
 */
export function TelaCulto() {
  const [cultos, setCultos] = useState<Culto[] | undefined>(undefined);
  const [podeMontar, setPodeMontar] = useState<boolean | null>(null);
  /** id em edição; `''` é uma ordem nova ainda sem data escolhida. */
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return; // sem Firebase configurado, a tela fica vazia

    return onSnapshot(collection(db, 'culto'), (snap) => {
      setCultos(
        snap.docs
          .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
          // Mesma guarda do servidor (`culto-store.ts`): a coleção pode ter
          // sobras que não são cultos, e uma delas não pode quebrar a tela.
          .filter((culto) => /^\d{4}-\d{2}-\d{2}$/.test(culto.data ?? ''))
          .sort((a, b) => a.data.localeCompare(b.data)),
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

  const salvar = useCallback(async (data: string, blocos: Bloco[], idAnterior?: string) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

    const resp = await fetch('/api/culto', {
      method: 'PUT',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, blocos, idAnterior }),
    });
    const corpo = await resp.json();
    if (!resp.ok) return { ok: false as const, erro: corpo.erro ?? 'Falha ao salvar.' };
    // A data é o id: mudá-la move a ordem, e o id em edição precisa
    // acompanhar, senão o editor perde de vista o que acabou de salvar.
    if (corpo.culto?.id) setEditandoId(corpo.culto.id);
    return { ok: true as const };
  }, []);

  const remover = useCallback(async (id: string) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch(`/api/culto/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: cabecalho,
    });
  }, []);

  const avancar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch('/api/culto/avancar', { method: 'POST', headers: cabecalho });
  }, []);

  // Mesma regra do servidor (`buscarAtiva`): a de hoje, senão a próxima
  // futura. Repetida aqui porque a lista chega pelo Firestore em tempo real,
  // sem passar pela API — perguntar ao servidor de novo atrasaria o selo.
  const ativa = useMemo(() => {
    const hoje = hojeLocal();
    return cultos?.find((c) => c.data >= hoje) ?? null;
  }, [cultos]);

  if (cultos === undefined || podeMontar === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  if (!podeMontar) {
    return <ExecucaoCulto culto={ativa} onAvancar={avancar} />;
  }

  if (editandoId !== null) {
    const emEdicao = cultos.find((c) => c.id === editandoId) ?? null;
    return (
      <EditorCulto
        culto={emEdicao}
        datasOcupadas={cultos.map((c) => c.data)}
        onSalvar={salvar}
        onVoltar={() => setEditandoId(null)}
      />
    );
  }

  return (
    <ListaCultos
      cultos={cultos}
      ativaId={ativa?.id ?? null}
      onNova={() => setEditandoId('')}
      onEditar={setEditandoId}
      onRemover={remover}
      onAvancar={avancar}
    />
  );
}
