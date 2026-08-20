'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  equipeDoCulto,
  hojeLocal,
  horaLocal,
  statusDoCulto,
  type Culto,
} from '@/lib/culto';
import { getFirestoreCliente } from '@/lib/firebase-cliente';

const REGEX_ID = /^\d{4}-\d{2}-\d{2}__\d{2}:\d{2}$/;

/** Distância em minutos entre dois horários `"HH:MM"`, sempre positiva. */
function distanciaMinutos(a: string, b: string): number {
  const [ha, ma] = a.split(':').map(Number);
  const [hb, mb] = b.split(':').map(Number);
  return Math.abs(ha * 60 + ma - (hb * 60 + mb));
}

/**
 * "EQUIPE DE HOJE" no rodapé da barra lateral — Som / Telão / Louvor e quem
 * está em cada função.
 *
 * De onde vem o dado: dos **responsáveis dos blocos da ordem ativa**, não de
 * um cadastro novo. A escolha é deliberada — quem monta o culto já digita
 * "Telão · Priscila" e "Ana + banda" no editor, e uma tela de cadastro de
 * equipe seria um segundo lugar dizendo a mesma coisa, livre para divergir e
 * para ficar desatualizada. Ver `equipeDoCulto` em `culto.ts`, que faz o
 * casamento por palavra-chave.
 *
 * Some inteiro quando não há ordem ativa ou quando ninguém preencheu
 * responsável: uma caixa vazia com três rótulos e nenhum nome ocuparia o
 * rodapé sem informar nada.
 *
 * Escuta o Firestore direto, como `TelaCulto`: assim o nome muda na barra
 * lateral no mesmo instante em que alguém corrige o responsável no editor,
 * sem recarregar a página.
 */
export function EquipeDeHoje() {
  const [ativa, setAtiva] = useState<Culto | null>(null);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return; // sem Firebase configurado, a caixa simplesmente não aparece

    return onSnapshot(collection(db, 'culto'), (snap) => {
      const cultos = snap.docs
        .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
        .filter((culto) => REGEX_ID.test(culto.id))
        // Mesma regra do servidor (`buscarAtiva`) e de `TelaCulto`: rascunho
        // não conta como "no ar".
        .filter((culto) => statusDoCulto(culto) !== 'rascunho');

      const hoje = hojeLocal();
      const agora = horaLocal();
      const deHoje = cultos.filter((c) => c.data === hoje && !c.concluidoEm);

      setAtiva(
        deHoje.length > 0
          ? deHoje.reduce((maisProxima, atual) =>
              distanciaMinutos(atual.hora, agora) <
              distanciaMinutos(maisProxima.hora, agora)
                ? atual
                : maisProxima,
            )
          : null,
      );
    });
  }, []);

  const equipe = equipeDoCulto(ativa);
  if (equipe.length === 0) return null;

  return (
    // Mesma caixa da tela de referência (o bloco "AUDIOVISUAL" no rodapé da
    // lateral): raio 14px, borda fina, rótulo espaçado em caixa alta.
    <div className="rounded-[14px] border border-borda bg-fundo-cartao p-4">
      <p className="text-[11px] font-bold tracking-[0.14em] text-texto-fraco uppercase">
        Equipe de hoje
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-[13px]">
        {equipe.map((linha) => (
          <div key={linha.funcao} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 shrink truncate text-texto-suave">{linha.funcao}</dt>
            <dd className="min-w-0 truncate text-right font-semibold text-texto">
              {linha.nome}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
