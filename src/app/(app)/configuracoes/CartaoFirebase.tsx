import type { ConfiguracoesParaTela } from '@/lib/configuracoes-compartilhado';

/**
 * Onde os dados do Coredja estão guardados agora, e se está tudo de pé.
 *
 * Só leitura, ao contrário do cartão do Holyrics: trocar de projeto Firebase
 * significa trocar um arquivo `.json` de credencial dentro da pasta
 * `segredos/`, que não é coisa que se faça por um campo de texto — e um
 * formulário que aceitasse o conteúdo do arquivo colado numa caixa seria a
 * pior forma possível de manusear a chave de administrador do projeto.
 *
 * O valor aqui é diagnóstico: quando algo não grava, ou o painel não atualiza
 * sozinho, esta caixa diz em qual das três pernas está o problema
 * (armazenamento escolhido, credencial do servidor, configuração pública).
 */
export function CartaoFirebase({
  firebase,
}: {
  firebase: ConfiguracoesParaTela['firebase'];
}) {
  const naNuvem = firebase.armazenamento === 'firebase';

  return (
    <section className="rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
      <h2 className="text-base font-bold text-texto">Banco de dados</h2>
      <p className="mt-0.5 text-xs text-texto-fraco">
        Onde ficam guardados os recados, a ordem do culto, os avisos e as
        contas. Mudar isto exige mexer no arquivo do servidor — aqui é só o
        diagnóstico.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Linha
          rotulo="Guardando em"
          valor={naNuvem ? 'Firebase (nuvem)' : 'SQLite (arquivo local)'}
          detalhe={
            naNuvem
              ? 'Várias pessoas acessam de qualquer lugar.'
              : 'Só funciona nesta máquina — dados/coredja.db.'
          }
          estado={naNuvem ? 'ok' : 'atencao'}
        />

        <Linha
          rotulo="Projeto"
          valor={firebase.projetoId || 'não informado'}
          detalhe="FIREBASE_PROJECT_ID, no .env.local."
          estado={firebase.projetoId ? 'ok' : 'atencao'}
          monoespacado
        />

        <Linha
          rotulo="Servidor fala com o banco"
          valor={firebase.conectado ? 'Sim' : 'Não'}
          detalhe={
            firebase.conectado
              ? 'A consulta feita ao abrir esta tela funcionou.'
              : 'Confira a credencial .json dentro da pasta segredos/.'
          }
          estado={firebase.conectado ? 'ok' : 'erro'}
        />

        <Linha
          rotulo="Tempo real"
          valor={firebase.tempoRealConfigurado ? 'Ligado' : 'Desligado'}
          detalhe={
            firebase.tempoRealConfigurado
              ? 'As telas atualizam sozinhas, sem F5.'
              : 'Faltam as variáveis NEXT_PUBLIC_FIREBASE_* no .env.local.'
          }
          estado={firebase.tempoRealConfigurado ? 'ok' : 'atencao'}
        />
      </dl>
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  detalhe,
  estado,
  monoespacado,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  estado: 'ok' | 'atencao' | 'erro';
  monoespacado?: boolean;
}) {
  const cor = {
    ok: 'var(--sucesso)',
    atencao: 'var(--alerta)',
    erro: 'var(--urgente)',
  }[estado];

  return (
    <div
      className="rounded-xl border border-borda bg-fundo-cartao px-4 py-3"
      style={{ boxShadow: `inset 3px 0 0 ${cor}` }}
    >
      <dt className="text-[11px] font-bold tracking-wide text-texto-fraco uppercase">
        {rotulo}
      </dt>
      <dd
        className={`mt-0.5 text-sm font-semibold text-texto ${monoespacado ? 'font-mono break-all' : ''}`}
      >
        {valor}
      </dd>
      <p className="mt-0.5 text-[12px] leading-snug text-texto-fraco">{detalhe}</p>
    </div>
  );
}
