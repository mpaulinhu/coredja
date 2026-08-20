'use client';

import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import type { Departamento } from '@/lib/types';
import { FormularioDepartamento } from './FormularioDepartamento';
import { LinhaDepartamento } from './LinhaDepartamento';

/**
 * Gerenciar Departamentos: os setores da igreja que conversam entre si.
 *
 * A tela existe para o admin não precisar mexer em código para abrir um
 * departamento novo. Quem não é admin chega aqui pelo endereço direto (o
 * item não aparece no menu) e vê a lista em modo de leitura — `podeEditar`
 * vem do servidor junto com a lista, ver `GET /api/departamentos`.
 */
export function TelaDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[] | undefined>(undefined);
  const [podeEditar, setPodeEditar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return;
    }
    const resp = await fetch('/api/departamentos', { headers: cabecalho });
    const dados = await resp.json();
    if (!resp.ok) {
      setErro(dados.erro ?? 'Não foi possível carregar.');
      return;
    }
    setErro(null);
    setDepartamentos(dados.departamentos);
    setPodeEditar(dados.podeEditar === true);
  }, []);

  useEffect(() => {
    (async () => {
      await carregar();
    })();
  }, [carregar]);

  const criar = useCallback(
    async (nome: string, cor: string) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

      const resp = await fetch('/api/departamentos', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cor }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) return { ok: false as const, erro: dados.erro ?? 'Falha ao criar.' };

      await carregar();
      return { ok: true as const };
    },
    [carregar],
  );

  const atualizar = useCallback(
    async (slug: string, nome: string, cor: string) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch(`/api/departamentos/${slug}`, {
        method: 'PUT',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cor }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(dados.erro ?? 'Não foi possível salvar.');
        return;
      }
      await carregar();
    },
    [carregar],
  );

  const remover = useCallback(
    async (slug: string) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch(`/api/departamentos/${slug}`, {
        method: 'DELETE',
        headers: cabecalho,
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(dados.erro ?? 'Não foi possível apagar.');
        return;
      }
      await carregar();
    },
    [carregar],
  );

  if (departamentos === undefined) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <p className="text-sm text-texto-fraco">
          {erro ?? 'Carregando…'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela
        titulo="Departamentos"
        instrucao="A cor de cada um é o que identifica ele no painel de conversas."
      />

      {erro && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      {/* Cartão centralizado, não encostado à esquerda: um cartão estreito
          colado numa borda, com a lista abaixo indo até a outra, desalinha. */}
      {podeEditar && (
        <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-texto-suave">Novo departamento</h2>
          <FormularioDepartamento onCriar={criar} />
        </div>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {departamentos.length === 0 && (
          <p className="col-span-full text-sm text-texto-fraco">
            Nenhum departamento cadastrado ainda.
          </p>
        )}
        {departamentos.map((departamento) => (
          <LinhaDepartamento
            key={departamento.slug}
            departamento={departamento}
            podeEditar={podeEditar}
            onAtualizar={(nome, cor) => atualizar(departamento.slug, nome, cor)}
            onRemover={() => remover(departamento.slug)}
          />
        ))}
      </ul>
    </div>
  );
}
