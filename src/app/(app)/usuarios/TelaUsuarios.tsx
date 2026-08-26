'use client';

import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import type { Papel, Pessoa } from '@/lib/papeis';
import type { Departamento } from '@/lib/types';
import { FormularioConvite } from './FormularioConvite';
import { LinhaPessoa } from './LinhaPessoa';

export interface AreaResumo {
  slug: string;
  nome: string;
  cor: string;
}

/**
 * Do mais para o menos amplo — hierarquia de cargo único, cada um inclui os
 * de baixo. A ordem da lista reflete isso visualmente (Admin no topo).
 */
export const TODOS_OS_PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  {
    valor: 'admin',
    rotulo: 'Admin',
    descricao:
      'Gerencia contas, departamentos e apaga recado — e tudo que Líder e Operador fazem',
  },
  {
    valor: 'lider',
    rotulo: 'Líder',
    descricao: 'Monta a ordem do culto e cadastra os avisos — e tudo que o Operador faz',
  },
  {
    valor: 'operador',
    rotulo: 'Operador',
    descricao:
      'Executa no domingo: avança o culto, publica aviso e arte, usa as mensagens da transmissão',
  },
];

/**
 * Gerenciar Usuários: quem tem login, com que papéis, e quais áreas de
 * recado cada um enxerga no Painel.
 *
 * Diferente de Culto/Avisos, esta tela não tem "modo de leitura" — só quem
 * já tem `pessoas:escrever` chega até ela (a rota nega 403 pra quem não
 * tem, e o item some do menu — ver `MenuLateral.tsx`). Não há por que
 * desenhar um segundo modo que ninguém vai ver.
 */
export function TelaUsuarios() {
  const [pessoas, setPessoas] = useState<Pessoa[] | undefined>(undefined);
  const [areas, setAreas] = useState<AreaResumo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);

  const carregar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return;
    }
    const resp = await fetch('/api/pessoas', { headers: cabecalho });
    const dados = await resp.json();
    if (!resp.ok) {
      setErro(dados.erro ?? 'Não foi possível carregar.');
      return;
    }
    setPessoas(dados.pessoas);
    setAreas(dados.areas);
    setDepartamentos(dados.departamentos ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      await carregar();
    })();
  }, [carregar]);

  const convidar = useCallback(
    async (
      nome: string,
      email: string,
      papel: Papel,
      departamento: string | null,
      areasVisiveis: string[],
      abas: string[] | null,
    ) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return { ok: false as const, erro: 'Sessão expirada.' };

      const resp = await fetch('/api/pessoas', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        // `abas: null` (padrão do cargo) não vai no corpo — o servidor trata
        // ausente como padrão, e mandar `null` gravaria o campo à toa.
        body: JSON.stringify({
          nome,
          email,
          papel,
          departamento,
          areasVisiveis,
          ...(abas ? { abas } : {}),
        }),
      });
      const dados = await resp.json();
      if (!resp.ok) return { ok: false as const, erro: dados.erro ?? 'Falha ao convidar.' };

      setSenhaGerada({ email, senha: dados.pessoa.senhaTemporaria });
      await carregar();
      return { ok: true as const };
    },
    [carregar],
  );

  const atualizar = useCallback(
    async (
      uid: string,
      papel: Papel,
      departamento: string | null,
      areasVisiveis: string[],
      abas: string[] | null,
    ) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      await fetch(`/api/pessoas/${uid}`, {
        method: 'PUT',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ papel, departamento, areasVisiveis, abas }),
      });
      await carregar();
    },
    [carregar],
  );

  const remover = useCallback(
    async (uid: string) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch(`/api/pessoas/${uid}`, {
        method: 'DELETE',
        headers: cabecalho,
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(dados.erro ?? 'Não foi possível remover.');
        return;
      }
      await carregar();
    },
    [carregar],
  );

  if (pessoas === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela titulo="Usuários" />

      {erro && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      {senhaGerada && (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--acento)', color: 'var(--texto)' }}
        >
          <p className="font-semibold">Conta criada para {senhaGerada.email}</p>
          <p className="mt-1 text-texto-suave">
            Senha temporária: <span className="font-mono text-texto">{senhaGerada.senha}</span>
          </p>
          <p className="mt-1 text-xs text-texto-fraco">
            Anote agora — ela não fica salva e não aparece de novo. Repasse à
            pessoa; ela pode trocar depois em &quot;esqueci a senha&quot;.
          </p>
          <button
            type="button"
            onClick={() => setSenhaGerada(null)}
            className="mt-2 text-xs text-texto-suave hover:text-texto"
          >
            Ok, anotei
          </button>
        </div>
      )}

      {/* Centralizado, não encostado à esquerda: um cartão estreito colado
          numa borda, com a lista abaixo indo até a outra, desalinha a tela. */}
      <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-texto-suave">Convidar pessoa</h2>
        <FormularioConvite areas={areas} departamentos={departamentos} onConvidar={convidar} />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {pessoas.length === 0 && (
          <p className="text-sm text-texto-fraco">Nenhuma pessoa cadastrada ainda.</p>
        )}
        {pessoas.map((p) => (
          <LinhaPessoa
            key={p.uid}
            pessoa={p}
            areas={areas}
            departamentos={departamentos}
            onAtualizar={(papel, departamento, areasVisiveis, abas) =>
              atualizar(p.uid, papel, departamento, areasVisiveis, abas)
            }
            onRemover={() => remover(p.uid)}
          />
        ))}
      </ul>
    </div>
  );
}
