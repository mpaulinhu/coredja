# Coredja

Plataforma de comunicação interna da igreja. A primeira tela conecta as áreas
(Cantina e Kids) ao audiovisual: elas mandam recados do celular, você recebe
num painel que atualiza sozinho.

---

## Como ligar

**Clique duas vezes em `Coredja.bat`.**

Ele cuida de tudo: prepara o programa na primeira vez, monta quando o código
muda, sobe o servidor, abre o painel no navegador e mostra os links dos
celulares na tela.

Uma janela preta vai abrir e ficar aberta. **Não feche enquanto estiver
usando** — é ela que mantém a plataforma no ar. Pode minimizar.

Para desligar: feche a janela.

> **Atalho na área de trabalho:** clique com o botão direito em `Coredja.bat`
> → *Enviar para* → *Área de trabalho (criar atalho)*. Aí é só clicar no ícone
> todo domingo.

### Se preferir pelo terminal

```bash
pnpm install          # só na primeira vez
cp .env.example .env.local
pnpm build
pnpm start
```

O `pnpm dev` existe para quando alguém estiver mexendo no código: recarrega
sozinho a cada alteração, mas é mais lento que o `pnpm start`.

---

## Os endereços

O `Coredja.bat` mostra os três links prontos quando liga. Eles são:

| Quem | Endereço |
|---|---|
| Audiovisual (você, neste PC) | `localhost:3000/painel` |
| Cantina (celular) | `<ip-do-pc>:3000/a/cantina-x7k2m9` |
| Kids (celular ou PC da sala) | `<ip-do-pc>:3000/a/kids-p4w8n3` |

### Nos celulares das áreas

Os celulares não conseguem abrir `localhost` — esse endereço significa "este
computador aqui". Por isso o `.bat` mostra o número do PC na rede, algo como
`192.168.50.104`.

Abra o link no celular da área e mande **salvar na tela inicial**. Vira um
ícone, e a pessoa não precisa digitar nada de novo.

> **Se o número mudar.** Alguns roteadores trocam esse número de tempos em
> tempos, e aí o link salvo para de funcionar. Se isso acontecer, o `.bat`
> mostra o número novo — basta salvar o link de novo no celular. Para não
> passar por isso, dá para fixar o número do PC nas configurações do roteador
> (procure por "IP fixo" ou "DHCP reservation").

> **Se o celular não abrir o link.** Confira se ele está no mesmo Wi-Fi do PC.
> Se estiver e ainda assim não abrir, provavelmente é o Firewall do Windows
> bloqueando: na primeira vez que o servidor sobe, o Windows costuma perguntar
> se permite — e é preciso marcar **redes privadas**.

---

## Como funciona no domingo

**Nas áreas.** A pessoa abre o ícone, escreve o recado, e envia. Se for algo
que não pode esperar, aperta **Urgente** antes. Se tiver um banner, aperta
**Imagem** e escolhe do celular — até 4 imagens de 10 MB cada.

**No audiovisual.** O painel fica aberto no monitor lateral e funciona como um
aplicativo de mensagem: à esquerda a lista de áreas, à direita a conversa da
área escolhida.

Cada área na lista mostra a última mensagem e um crachá com quantos recados
estão pendentes — **vermelho quando há urgente**. Quem tem urgente sobe para o
topo da lista, depois quem tem pendente, depois os mais recentes.

Os recados chegam sozinhos, sem atualizar a página, e toca um som: dois tons
para normal, três mais agudos para urgente.

Dentro da conversa, os recados da área ficam à esquerda e os seus à direita.
Cada recado da área tem **Marcar como resolvido**, que o some da conversa e
diminui o crachá. O botão **Ver resolvidos** no topo traz de volta, e ali dá
para **Reabrir** se você clicou errado.

Para falar com a área, escreva no campo embaixo da conversa. **Enter envia**,
Shift+Enter quebra linha.

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

### Como as imagens são guardadas

Depende do modo:

- **`sqlite`** — em `dados/uploads/`, no disco.
- **`firebase`** — dentro do próprio recado, no Firestore.

Guardar dentro do recado permite hospedar a plataforma: num servidor da
internet o disco é descartável e some sem aviso, junto com qualquer arquivo
gravado. O Firebase Storage resolveria isso melhor, mas exige o plano pago
(Blaze) — e como o banner é baixado no mesmo dia e não precisa ficar guardado
para sempre, embutir resolve sem custo.

O limite é 1 MB por recado, então a imagem é reduzida no próprio celular antes
de subir (`comprimir.ts`) — o que também faz o envio ser bem mais rápido no
Wi-Fi da igreja. Se ainda assim passar do limite, o envio é recusado com uma
mensagem explicando.

### Backup

Com `COREDJA_STORAGE=firebase`, o Google cuida de tudo — recados e imagens.

Com `COREDJA_STORAGE=sqlite`, copie a pasta `dados/` inteira.

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

### As regras de segurança

Estão em [`firestore.rules`](firestore.rules): **leitura liberada, escrita
bloqueada**.

A leitura precisa estar aberta porque é o navegador que escuta o Firestore
para receber os recados em tempo real. A escrita fica fechada para todos —
todo envio passa pelo servidor, que usa a chave de administrador e ignora as
regras. Ninguém cria, altera ou apaga recado direto no banco.

O `token` de cada área **não é gravado no Firestore**. Ele é o segredo do link
de envio, e um banco de leitura aberta o exporia. Fica só em
[`areas.ts`](src/lib/areas.ts) e é conferido no servidor.

Para publicar mudanças nas regras: Console do Firebase → Firestore → aba
**Regras** → colar o conteúdo de `firestore.rules` → **Publicar**.

---

## Publicar na internet (Netlify)

Hospedar tira a dependência do PC ligado e do Wi-Fi da igreja: as áreas
acessam de qualquer lugar. O plano gratuito da Netlify dá conta.

### O que já está pronto

- [`netlify.toml`](netlify.toml) com a configuração de build
- A credencial pode vir de variável de ambiente, sem precisar do arquivo
- O tempo real usa o Firestore, que funciona com vários servidores
- As imagens vão embutidas no recado, sem depender de disco

### Passo a passo

1. Suba o projeto para um repositório no GitHub.
2. Em [app.netlify.com](https://app.netlify.com), crie a conta (grátis) e
   escolha **Add new site → Import an existing project**.
3. Conecte o repositório. A Netlify lê o `netlify.toml` sozinha.
4. Antes de publicar, cadastre as variáveis em **Site configuration →
   Environment variables**:

| Variável | Valor |
|---|---|
| `COREDJA_STORAGE` | `firebase` |
| `FIREBASE_CREDENCIAIS_JSON` | O conteúdo **inteiro** de `segredos/firebase-admin.json` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | do `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | do `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | do `.env.local` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | do `.env.local` |
| `NEXT_PUBLIC_FIREBASE_SENDER_ID` | do `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | do `.env.local` |

5. Publique. Sai um endereço como `coredja.netlify.app`.

### O que muda quando está publicado

**Os links viram públicos.** Hoje só quem está no Wi-Fi da igreja alcança a
plataforma. Publicada, qualquer pessoa com o link de uma área pode mandar
recado, de qualquer lugar do mundo. Continua sendo aceitável para o uso — mas
se um link vazar num grupo, troque o `token` em
[`areas.ts`](src/lib/areas.ts) e publique de novo.

**O PC deixa de ser necessário.** Nada para ligar no domingo.

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
   ├─ conversas.ts        Monta a lista de conversas do painel
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
