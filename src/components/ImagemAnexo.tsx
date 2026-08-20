'use client';

import { useState } from 'react';
import type { Anexo } from '@/lib/types';

/**
 * O que a miniatura de fato precisa: o nome (para o title/alt/download) e a
 * URL. Aceitar só esses dois campos deixa o componente servir tanto ao
 * `Anexo` de um recado quanto à imagem de um aviso, que não tem `id`.
 */
type ImagemExibivel = Pick<Anexo, 'nomeArquivo' | 'url'>;

/**
 * Miniatura de uma imagem anexada a um recado.
 *
 * Trata o caso de a imagem não existir mais. Isso é possível porque os
 * recados ficam no Firestore, na nuvem, enquanto as imagens ficam no disco do
 * PC do audiovisual — se a pasta `dados/uploads/` for perdida ou o PC trocar,
 * o recado sobrevive apontando para um arquivo que não existe.
 *
 * Em vez de um ícone de imagem quebrada, mostra um aviso claro do que
 * aconteceu, para ninguém ficar esperando um banner que não vai carregar.
 */
export function ImagemAnexo({
  anexo,
  tamanho,
  mostrarDownload = false,
}: {
  anexo: ImagemExibivel;
  /** Classes de dimensão da miniatura (ex: "h-32 w-32"). */
  tamanho: string;
  mostrarDownload?: boolean;
}) {
  const [sumiu, setSumiu] = useState(false);

  if (sumiu) {
    return (
      <div
        className={`${tamanho} flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-borda-forte px-2 text-center`}
        title={anexo.nomeArquivo}
      >
        <span aria-hidden="true" className="text-lg opacity-60">
          🖼
        </span>
        <span className="text-[11px] leading-tight text-texto-fraco">
          imagem não encontrada
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <a href={anexo.url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anexo.url}
          alt={anexo.nomeArquivo}
          onError={() => setSumiu(true)}
          className={`${tamanho} rounded-lg border border-borda object-cover`}
        />
      </a>
      {mostrarDownload && (
        <a
          href={anexo.url}
          download={anexo.nomeArquivo}
          className="text-center text-xs font-medium text-acento hover:underline"
        >
          Baixar
        </a>
      )}
    </div>
  );
}
