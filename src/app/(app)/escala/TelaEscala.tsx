'use client';

import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import type { Escala, Escalado } from '@/lib/escala';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { EditorEscala } from './EditorEscala';
import { ConfirmacaoEscala } from './ConfirmacaoEscala';

/**
 * Escala do Time: escuta o Firestore direto (mesmo padrão de `TelaCulto`) e
 * decide o modo tentando gravar — o servidor decide, não a tela.
 */
export function TelaEscala() {
  const [escala, setEscala] = useState<Escala | null | undefined>(undefined);
  const [podeMontar, setPodeMontar] = useState<boolean | null>(null);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return;
    return onSnapshot(doc(db, 'escala', 'atual'), (snap) => {
      setEscala(snap.exists() ? (snap.data() as Escala) : null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) {
        setPodeMontar(false);
        return;
      }
      const resp = await fetch('/api/escala', { headers: cabecalho });
      setPodeMontar(resp.ok);
    })();
  }, []);

  const salvar = useCallback(
    async (data: string, escalados: Omit<Escalado, 'presente'>[]) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

      const resp = await fetch('/api/escala', {
        method: 'PUT',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, escalados }),
      });
      const corpo = await resp.json();
      if (!resp.ok) return { ok: false as const, erro: corpo.erro ?? 'Falha ao salvar.' };
      return { ok: true as const };
    },
    [],
  );

  const marcarPresenca = useCallback(async (id: string, presente: boolean) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch(`/api/escala/${id}/presenca`, {
      method: 'POST',
      headers: { ...cabecalho, 'Content-Type': 'application/json' },
      body: JSON.stringify({ presente }),
    });
  }, []);

  if (escala === undefined || podeMontar === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return podeMontar ? (
    <EditorEscala escala={escala} onSalvar={salvar} onMarcarPresenca={marcarPresenca} />
  ) : (
    <ConfirmacaoEscala escala={escala} onMarcarPresenca={marcarPresenca} />
  );
}
