'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import type { Bloco, Culto } from '@/lib/culto';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { EditorCulto } from './EditorCulto';
import { ExecucaoCulto } from './ExecucaoCulto';

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
 */
export function TelaCulto() {
  const [culto, setCulto] = useState<Culto | null | undefined>(undefined);
  const [podeMontar, setPodeMontar] = useState<boolean | null>(null);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return; // sem Firebase configurado, a tela fica vazia

    return onSnapshot(doc(db, 'culto', 'atual'), (snap) => {
      setCulto(snap.exists() ? (snap.data() as Culto) : null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) {
        setPodeMontar(false);
        return;
      }
      // GET não grava nada — usado só para descobrir se a sessão é válida.
      // A checagem de permissão de escrita de verdade acontece no PUT/POST,
      // no momento de salvar ou avançar.
      const resp = await fetch('/api/culto', { headers: cabecalho });
      setPodeMontar(resp.ok);
    })();
  }, []);

  const salvar = useCallback(async (data: string, blocos: Bloco[]) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

    const resp = await fetch('/api/culto', {
      method: 'PUT',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, blocos }),
    });
    const corpo = await resp.json();
    if (!resp.ok) return { ok: false as const, erro: corpo.erro ?? 'Falha ao salvar.' };
    return { ok: true as const };
  }, []);

  const avancar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch('/api/culto/avancar', { method: 'POST', headers: cabecalho });
  }, []);

  if (culto === undefined || podeMontar === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return podeMontar ? (
    <EditorCulto culto={culto} onSalvar={salvar} onAvancar={avancar} />
  ) : (
    <ExecucaoCulto culto={culto} onAvancar={avancar} />
  );
}
