# Coredja

Plataforma de comunicação interna da igreja. A primeira tela conecta as áreas
(Cantina e Kids) ao audiovisual: elas mandam recados do celular, você recebe
num painel que atualiza sozinho.

---

## Como rodar

Na primeira vez, instale as dependências:

```bash
pnpm install
```

E crie o arquivo de configuração a partir do modelo:

```bash
cp .env.example .env.local
```

Para usar no domingo:

```bash
pnpm build
pnpm start
```

O `pnpm start` é a versão rápida, para uso real. O `pnpm dev` é para quando
estiver mexendo no código: ele recarrega sozinho a cada alteração, mas é mais
lento.

---

## Os endereços

Com o servidor rodando, abra `http://localhost:3000` para ver a lista de
links.

| Quem | Endereço |
|---|---|
| Audiovisual (você) | `/painel` |
| Cantina | `/a/cantina-x7k2m9` |
| Kids | `/a/kids-p4w8n3` |

### Nos celulares das áreas

Os celulares não conseguem abrir `localhost` — esse endereço significa "este
computador aqui". Eles precisam do número do seu PC na rede da igreja.

Para descobrir esse número, rode no PC do audiovisual:

```bash
ipconfig
```

Procure por "Endereço IPv4", algo como `192.168.0.15`. O link da Cantina fica
então:

```
http://192.168.0.15:3000/a/cantina-x7k2m9
```

Abra esse link no celular da Cantina e mande salvar na tela inicial. Vira um
ícone, e a pessoa não precisa digitar nada de novo.

> **Se o número mudar.** Alguns roteadores trocam esse número de tempos em
> tempos, e aí o link salvo para de funcionar. Se isso acontecer, dá para
> fixar o número do PC nas configurações do roteador (procure por "IP fixo" ou
> "DHCP reservation"). Vale fazer isso uma vez e esquecer.

---

## Como funciona no domingo

**Nas áreas.** A pessoa abre o ícone, escreve o recado, e envia. Se for algo
que não pode esperar, aperta **Urgente** antes. Se tiver um banner, aperta
**Imagem** e escolhe do celular — até 4 imagens de 10 MB cada.

**No audiovisual.** O painel fica aberto no monitor lateral. Os recados
aparecem sozinhos, com os urgentes no topo e em vermelho. Toca um som quando
chega um novo — dois tons para normal, três mais agudos para urgente.

Cada recado tem **Marcar como resolvido**, que o tira da lista e manda para o
**Histórico**. Se clicar errado, o botão **Reabrir** no histórico devolve.

Para falar com uma área, use os botões **Falar com: Cantina / Kids** no rodapé.

**Os banners.** A imagem aparece no cartão com um link **Baixar** embaixo.
Você baixa e coloca no telão pelo Holyrics, como já faz hoje.

### O som

O navegador só libera som depois do primeiro clique na página. Ao abrir o
painel, clique uma vez em qualquer lugar — depois disso o alerta funciona pelo
resto do culto. O botão **Som ligado / Som desligado** no topo controla isso.

---

## O que precisa estar ligado

O PC do audiovisual é o servidor. Enquanto ele estiver ligado, com o `pnpm
start` rodando e conectado ao Wi-Fi da igreja, tudo funciona. Se ele dormir,
cair da rede ou desligar, os recados param de chegar.

Vale desativar a suspensão automática do Windows durante o culto.

---

## Os links secretos

Não há login: quem tem o link de uma área envia recados como aquela área.
É simples de usar e não atrapalha ninguém no meio do culto, mas significa
que um link vazado num grupo de WhatsApp deixa qualquer pessoa mandar recado
como se fosse a Cantina.

Para trocar um link, abra [`src/lib/areas.ts`](src/lib/areas.ts) e mude o
`token` da área. O link antigo para de funcionar assim que você reiniciar o
servidor. O histórico não se perde.

---

## Adicionar uma área nova

Abra [`src/lib/areas.ts`](src/lib/areas.ts) e acrescente um item à lista:

```ts
{
  slug: 'recepcao',
  nome: 'Recepção',
  token: 'k9m2p7',   // invente um trecho secreto qualquer
  cor: '#7c5cd6',    // cor de identificação no painel
}
```

Reinicie o servidor e a área nova aparece na home, no painel e nos botões de
"Falar com".

---

## Onde os recados ficam guardados

O Coredja funciona de dois jeitos, e a escolha é uma linha no `.env.local`:

```bash
COREDJA_STORAGE=firebase   # recados na nuvem (padrão hoje)
COREDJA_STORAGE=sqlite     # tudo neste PC, sem internet
```

Depois de trocar, rode `pnpm build` e `pnpm start` de novo. A home mostra qual
está ativo, com uma bolinha verde (nuvem) ou azul (local).

| | Firebase | SQLite local |
|---|---|---|
| Onde ficam os recados | Nuvem do Google | `dados/coredja.db` |
| Onde ficam as imagens | **Neste PC**, em `dados/uploads/` | `dados/uploads/` |
| Precisa de internet | Sim | Não |
| Se o PC for perdido | Recados sobrevivem | Perde tudo |

Poder alternar existe por um motivo prático: se a internet cair no meio de um
culto, troque para `sqlite`, reinicie, e os recados voltam a funcionar na
hora. Os que estavam na nuvem continuam lá, esperando você voltar.

### ⚠️ As imagens não estão na nuvem

Mesmo com `COREDJA_STORAGE=firebase`, **as imagens continuam no disco deste
PC**. Isso porque o Firebase Storage exige o plano pago (Blaze) e o projeto
está no plano gratuito (Spark).

Na prática: se este PC for trocado ou a pasta `dados/` for perdida, os
**recados sobrevivem** e os **banners não**. Onde havia imagem, a tela mostra
"imagem não encontrada" em vez de quebrar.

Se um dia isso incomodar, há dois caminhos: ativar o plano Blaze e mover as
imagens para o Firebase Storage, ou manter o backup da pasta `dados/uploads/`.

### Backup

Com `COREDJA_STORAGE=firebase`, o Google já cuida dos recados. Falta só copiar
a pasta `dados/uploads/`, que guarda as imagens.

Com `COREDJA_STORAGE=sqlite`, copie a pasta `dados/` inteira — ela tem tudo.

A pasta não vai para o git de propósito: são as mensagens reais da igreja.

---

## O projeto no Firebase

O projeto é o **`coreadja-43109`**, no plano gratuito (Spark).

### A chave de administrador

O arquivo `segredos/firebase-admin.json` é o que permite ao servidor acessar
o banco. **Ele é a chave da casa**: quem o tem lê, escreve e apaga tudo,
ignorando as regras de segurança.

Ele está no `.gitignore` e nunca deve ser enviado por e-mail, chat ou anexado
em lugar nenhum. Se vazar, gere uma nova em Console → ⚙️ Configurações do
projeto → Contas de serviço, e exclua a antiga em
[IAM & Admin](https://console.cloud.google.com/iam-admin/serviceaccounts).

Para instalar em outro PC, baixe uma chave nova por esse mesmo caminho e
salve como `segredos/firebase-admin.json`.

### Por que o banco fica fechado

As regras do Firestore estão em modo produção, o que significa
`allow read, write: if false` — **ninguém entra pelo navegador**, nem para
ler.

Isso funciona porque o navegador nunca fala com o Firestore direto: o celular
da Cantina conversa com este servidor, e só o servidor conversa com o banco,
usando a chave de administrador que ignora as regras.

É mais seguro do que abrir o banco e proteger com regras, porque não existe
superfície pública nenhuma. O link secreto de cada área continua sendo
conferido no servidor, como sempre foi.

### Sobre índices

O Firestore exige um índice, criado à mão no Console, para consultas que
filtram por um campo e ordenam por outro. Para evitar esse passo manual, todas
as ordenações do Coredja acontecem em memória — com o volume de uma igreja,
isso é instantâneo. Se um dia o histórico crescer muito, aí vale criar os
índices e mover a ordenação para o banco.

---

## O que vem depois

**Aviso por cima do Holyrics.** Uma janelinha pequena, sempre no topo do
monitor, que acende quando chega recado. É um programa à parte (Electron) e
não depende do Holyrics para funcionar.

**Integração com o Holyrics.** Mandar um recado ou um banner direto para o
telão, sem passar pelo download. O Holyrics tem uma API que roda na máquina
dele, então isso exige que a plataforma alcance essa máquina na rede da
igreja.

**Login.** Quando as áreas crescerem, os links secretos podem dar lugar a
contas de verdade. A estrutura já separa "qual é a área" de "como ela se
identifica", então essa troca não mexe nas telas.

---

## Estrutura do código

```
src/
├─ app/
│  ├─ a/[chave]/          Tela de envio das áreas (celular e PC)
│  ├─ painel/             Painel do audiovisual
│  ├─ api/
│  │  ├─ areas/           Envio e leitura dos recados de uma área
│  │  ├─ painel/          Dados do painel, respostas, resolver/reabrir
│  │  ├─ eventos/         Canal de tempo real (SSE)
│  │  └─ imagens/         Serve as imagens enviadas
│  └─ page.tsx            Home com a lista de links
├─ components/
│  └─ ImagemAnexo.tsx     Miniatura, com aviso se a imagem sumiu
├─ hooks/
│  ├─ useEventos.ts       Recebe os avisos de tempo real
│  └─ useAlertaSonoro.ts  Som de recado novo
└─ lib/
   ├─ types.ts            Contrato de dados (Area, Mensagem, Store)
   ├─ store.ts            Escolhe o armazenamento (sqlite ou firebase)
   ├─ sqlite-store.ts     Implementação local
   ├─ db.ts               Conexão e schema do SQLite
   ├─ firebase-store.ts   Implementação na nuvem
   ├─ firebase.ts         Conexão com o Firestore
   ├─ areas.ts            As áreas da igreja e seus links
   ├─ uploads.ts          Validação e gravação das imagens
   ├─ limites.ts          Limites de tamanho, usados nos dois lados
   └─ eventos.ts          Publicação dos avisos de tempo real
```

### Como as duas implementações convivem

Todo o resto do código conhece apenas a interface `Store`, definida em
[`src/lib/types.ts`](src/lib/types.ts) — nove operações, como "criar
mensagem" e "listar pendentes". Ela não diz nada sobre *onde* os dados ficam.

Duas implementações satisfazem esse contrato:
[`sqlite-store.ts`](src/lib/sqlite-store.ts) e
[`firebase-store.ts`](src/lib/firebase-store.ts). Quem escolhe entre elas é
[`store.ts`](src/lib/store.ts), lendo `COREDJA_STORAGE` do `.env.local`.

É por isso que a migração para o Firebase não mexeu em nenhuma tela: elas
importam `store` e chamam as mesmas nove operações, sem saber o que está do
outro lado.

### Sobre o tempo real

O Firestore avisa sozinho quando um dado muda, mas esse aviso vai para quem
fala com ele direto — e aqui o navegador não fala. Por isso o Coredja mantém
o canal próprio de [`src/lib/eventos.ts`](src/lib/eventos.ts), que empurra os
avisos do servidor para as telas abertas.

Funciona igual nos dois modos de armazenamento, e é o que faz o recado
aparecer no painel sem ninguém apertar F5.
