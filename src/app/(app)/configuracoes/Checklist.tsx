import type { Pendencia } from '@/lib/configuracoes-compartilhado';

/**
 * O que ainda falta para esta instalação do Coredja funcionar inteira.
 *
 * Fica no TOPO da tela, antes dos campos, porque a pergunta que traz alguém
 * aqui é quase sempre "por que tal coisa não está funcionando?" — e a
 * resposta costuma estar nesta lista. Os campos são o segundo passo, depois
 * de saber o que mexer.
 *
 * Sem nenhuma pendência a lista some e dá lugar a uma confirmação verde: uma
 * caixa vazia com o título "o que falta" deixa a dúvida de se ela não
 * carregou.
 */
export function Checklist({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border px-5 py-4"
        style={{
          borderColor: 'var(--sucesso)',
          background: 'var(--sucesso-fundo)',
        }}
      >
        <span aria-hidden className="text-lg leading-none">
          ✓
        </span>
        <p className="text-sm font-semibold" style={{ color: 'var(--sucesso)' }}>
          Está tudo configurado. Nada pendente por aqui.
        </p>
      </div>
    );
  }

  const bloqueios = pendencias.filter((p) => p.gravidade === 'bloqueio').length;

  return (
    <section className="rounded-2xl border border-borda bg-fundo-elevado p-5">
      <h2 className="text-sm font-bold text-texto">
        Falta{pendencias.length > 1 ? 'm' : ''} {pendencias.length}{' '}
        {pendencias.length > 1 ? 'ajustes' : 'ajuste'}
      </h2>
      <p className="mt-0.5 text-xs text-texto-fraco">
        {bloqueios > 0
          ? 'Os itens em vermelho impedem alguma parte do Coredja de funcionar.'
          : 'Nada aqui impede o uso — são coisas que limitam o Coredja em algum ponto.'}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {pendencias.map((pendencia) => {
          const bloqueio = pendencia.gravidade === 'bloqueio';
          const cor = bloqueio ? 'var(--urgente)' : 'var(--alerta)';

          return (
            <li
              key={pendencia.id}
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: 'var(--borda)',
                // Faixa colorida na borda esquerda, mesmo recurso do item
                // ativo do menu: distingue gravidade sem depender só da cor
                // do texto, que num monitor mal calibrado quase não muda.
                boxShadow: `inset 3px 0 0 ${cor}`,
                background: 'var(--fundo-cartao)',
              }}
            >
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-texto">
                {pendencia.titulo}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                  style={{
                    color: cor,
                    background: bloqueio
                      ? 'var(--urgente-fundo)'
                      : 'var(--alerta-fundo)',
                  }}
                >
                  {bloqueio ? 'impede' : 'atenção'}
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-texto-suave">
                {pendencia.detalhe}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
