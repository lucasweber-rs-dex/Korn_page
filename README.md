# tudo.conecta.ai — loja

Site de vendas com dois planos (Mensal e Anual) e um checkout que gera cobrança Pix.

> **Estado atual:** o checkout é ilustrativo. O fluxo completo está implementado (validação de dados → cobrança → QR Code → confirmação), mas nenhuma venda real acontece até que uma chave da Asaas seja configurada. Sem chave, o site funciona normalmente e só o botão "GERAR PIX" responde com um aviso.

---

## 1. Rodar na sua máquina

Você precisa apenas do [Node.js 20 ou superior](https://nodejs.org) instalado. **Nenhuma chave, conta ou cadastro é necessário para ver o site funcionando.**

```bash
npm install             # instala as dependências (só na primeira vez)
npm start               # sobe o site
```

Abra **http://localhost:3001**. Para parar, pressione `Ctrl+C` no terminal.

Um único processo Node entrega as páginas e a API na mesma porta — não é preciso subir dois servidores nem configurar CORS.

### Trocar a porta

A porta vem de `PORT` no arquivo `api/.env`. Se esse arquivo não existir, o padrão é `3000`:

```bash
cp api/.env.example api/.env    # no Windows: copy api\.env.example api\.env
```

---

## 2. Como o projeto é organizado

```
public/                      tudo que o visitante vê (HTML, CSS, imagens)
  index.html                 página inicial com os dois planos
  checkout-mensal.html       checkout do Plano Mensal
  checkout-anual.html        checkout do Plano Anual
  404.html                   página de endereço inexistente
  favicon.svg
  assets/css/                home.css (página inicial) e checkout.css
  assets/js/checkout.js      validação dos campos e chamada da API
  assets/img/

app.js                       as rotas /api/* e a integração com a Asaas
server.js                    inicialização; fora do Docker também entrega public/
api/                         credenciais locais e imagem Docker da API
  .env                       suas credenciais (não vai para o Git)
  .env.example               modelo do .env

deploy/                      usado só no Docker
  nginx.conf                 entrega os arquivos de public/
  Caddyfile                  HTTPS automático e roteamento de /api/*

docs/                        guia de publicação na VPS
compose.yaml                 orquestração dos containers
```

Regra prática: **conteúdo e visual ficam em `public/`, regras de pagamento em `app.js`.**

---

## 3. Personalizar

### Textos, imagens e visual

Edite os arquivos em `public/` com qualquer editor e recarregue o navegador. Não há build, compilação nem framework — é HTML e CSS puros.

| O que mudar | Onde |
|---|---|
| Nome da marca no cabeçalho | `public/index.html` e `public/checkout-*.html`, dentro de `<a class="brand">` |
| Textos e benefícios dos planos | `public/index.html` |
| Cores e tipografia | variáveis no topo de `public/assets/css/home.css` |
| Imagem do topo | `public/assets/img/dispositivos.jpg` |

### Preços

⚠️ **O preço aparece em dois lugares e os dois precisam ser alterados juntos:**

1. `app.js`, no objeto `PLANOS` — é o valor realmente cobrado.
2. Os arquivos `public/checkout-*.html` e `public/index.html` — é o valor exibido.

Se eles divergirem, o cliente vê um preço e paga outro.

```js
// app.js
const PLANOS = {
  mensal: { titulo: "Plano Mensal", valor: 24.9 },
  anual: { titulo: "Plano Anual", valor: 169.9 },
};
```

### Adicionar um plano

1. Acrescente a entrada em `PLANOS` (`app.js`).
2. Duplique um `public/checkout-*.html`, ajuste título e preço e mude o `data-plano="..."` na `<section class="payment-box">` para a chave nova.
3. Adicione o card e o link na seção "Escolha o seu plano" de `public/index.html`.

---

## 4. Ativar o Pix de verdade (opcional)

O pagamento usa a [Asaas](https://www.asaas.com). Enquanto não houver chave, o site continua no ar e a API responde `503` com uma mensagem explicativa.

1. Crie uma conta de testes em https://sandbox.asaas.com
2. Gere a chave em **Integrações → API Key**
3. Copie `api/.env.example` para `api/.env` e preencha:

```ini
ASAAS_API_KEY=cole_sua_chave_aqui
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
PORT=3001
```

4. Reinicie o servidor (`Ctrl+C` e `npm start`).

Para produção, use uma chave da conta real e troque `ASAAS_BASE_URL` para `https://api.asaas.com/v3`.

Conferir se a chave foi reconhecida:

```bash
curl http://localhost:3001/api/saude
# {"ok":true,"pix":true}   -> chave carregada
# {"ok":true,"pix":false}  -> sem chave; o Pix fica ilustrativo
```

> `api/.env` contém credenciais e está no `.gitignore`. Nunca faça commit dele nem compartilhe a chave.

---

## 5. Rotas da API

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/saude` | Diz se o servidor está de pé e se o Pix está configurado |
| `POST` | `/api/pagamentos` | Cria a cobrança e devolve o QR Code. Corpo: `plano`, `nome`, `email`, `telefone`, `cpf` |
| `GET` | `/api/pagamentos/:id` | Consulta o status: `pending`, `approved` ou `cancelled` |

E-mail, celular e CPF são validados no navegador **e** novamente no servidor — a validação do navegador é só conveniência, quem decide é `app.js`.

Depois de gerar o QR Code, a página consulta o status a cada 3 segundos por até 5 minutos e avisa quando o pagamento é confirmado.

---

## 6. Publicar em um servidor (Docker)

Com Docker e Docker Compose instalados, na pasta do projeto:

```bash
docker compose up -d      # subir
docker compose logs -f    # acompanhar
docker compose down       # parar
```

São três containers: o **Nginx** entrega `public/`, a **API** responde em `api:3001` e o **Caddy** recebe as portas 80/443, emite o certificado HTTPS e encaminha `/api/*` para a API.

Antes de subir, ajuste o domínio na primeira linha de `deploy/Caddyfile` (hoje `desertfoxlabs.com`) e aponte o DNS desse domínio para o IP do servidor — o certificado só é emitido depois disso.

O passo a passo de envio dos arquivos para a VPS está em [`docs/guia-atualizar-tema-tahingresso.md`](docs/guia-atualizar-tema-tahingresso.md).

---

## 7. Se algo der errado

| Sintoma | Causa provável |
|---|---|
| `EADDRINUSE` ao iniciar | A porta já está ocupada. Mude `PORT` em `api/.env` ou feche o outro processo. |
| `Cannot find module 'express'` | Faltou rodar `npm install`. |
| Botão "GERAR PIX" fica cinza | E-mail, celular ou CPF ainda estão inválidos — ele libera sozinho quando os três passarem. |
| "Não foi possível gerar o Pix agora" | Chave da Asaas ausente, inválida ou vencida. O motivo exato aparece no terminal do servidor. |
| Página abre sem estilo | Abriu o arquivo direto pelo Explorer. Use sempre `npm start` e o endereço `http://localhost:3001`. |
