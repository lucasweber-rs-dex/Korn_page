# Como enviar e atualizar o tema da tahingresso

Este guia mostra como enviar o arquivo ZIP pelo PowerShell e atualizar a loja dentro da VPS sem reinstalar o servidor.

## Informações usadas

- IP da VPS: `2.25.158.116`
- Usuário da VPS: `root`
- Pasta da loja: `/opt/tahingresso`
- Arquivo do tema: `tahingresso-loja-v2.zip`
- Domínio: `https://desertfoxlabs.com`

## 1. Confirmar que o arquivo existe no computador

Abra o PowerShell no Windows e execute:

```powershell
Test-Path "C:\Users\lucas\Documents\Codex\2026-09-04\quero-descobrir-mais-informa-es-sobre\outputs\tahingresso-loja-v2.zip"
```

O resultado esperado é:

```text
True
```

## 2. Enviar o ZIP para a VPS

No mesmo PowerShell, execute:

```powershell
scp "C:\Users\lucas\Documents\Codex\2026-09-04\quero-descobrir-mais-informa-es-sobre\outputs\tahingresso-loja-v2.zip" root@2.25.158.116:/opt/tahingresso/
```

Na primeira conexão, poderá aparecer uma pergunta sobre a autenticidade do servidor. Digite:

```text
yes
```

Depois, informe a senha do usuário `root`. A senha não aparece enquanto é digitada; isso é normal.

## 3. Entrar na VPS

Caso ainda não esteja usando o terminal da Hostinger, também é possível entrar pelo PowerShell:

```powershell
ssh root@2.25.158.116
```

## 4. Abrir a pasta da loja

No terminal da VPS, execute:

```bash
cd /opt/tahingresso
```

Confirme que o ZIP chegou:

```bash
ls -lh tahingresso-loja-v2.zip
```

## 5. Criar um backup da versão atual

Crie a pasta de backups:

```bash
mkdir -p /opt/tahingresso/backups
```

Crie um arquivo compactado da versão atual:

```bash
tar --exclude='./backups' --exclude='*.zip' -czf "backups/antes-da-atualizacao-$(date +%Y%m%d-%H%M%S).tar.gz" .
```

Confira se o backup foi criado:

```bash
ls -lh backups
```

## 6. Extrair o tema atualizado

```bash
unzip -o tahingresso-loja-v2.zip
```

O parâmetro `-o` permite substituir os arquivos antigos pelos arquivos do ZIP.

Confira os arquivos principais:

```bash
ls -lh public/index.html public/assets/css public/assets/js public/checkout-*.html compose.yaml deploy/nginx.conf deploy/Caddyfile
```

## 7. Validar a configuração do Docker

Antes de reiniciar os contêineres, execute:

```bash
docker compose config
```

Se o comando mostrar a configuração e não apresentar erro, prossiga. Se aparecer erro, não reinicie os contêineres.

## 8. Aplicar a atualização

```bash
docker compose up -d --force-recreate
```

Esse comando recria os contêineres usando os arquivos atualizados.

## 9. Verificar os contêineres

```bash
docker compose ps
```

Os contêineres `loja-em-construcao` e `tahingresso-https` devem aparecer em execução.

Para verificar mensagens recentes:

```bash
docker compose logs --tail=50
```

## 10. Testar a loja

Teste a página principal:

```bash
curl -I https://desertfoxlabs.com
```

Teste os dois checkouts:

```bash
curl -I https://desertfoxlabs.com/checkout-mensal.html
```

```bash
curl -I https://desertfoxlabs.com/checkout-anual.html
```

Os três testes devem retornar um código `200`.

Depois, abra no navegador:

- [Página principal](https://desertfoxlabs.com)
- [Checkout mensal](https://desertfoxlabs.com/checkout-mensal.html)
- [Checkout anual](https://desertfoxlabs.com/checkout-anual.html)

## Se a atualização apresentar erro

Veja o nome do backup mais recente:

```bash
ls -lt backups
```

Pare os contêineres:

```bash
docker compose down
```

Substitua `NOME_DO_BACKUP.tar.gz` pelo nome mostrado na lista:

```bash
tar -xzf backups/NOME_DO_BACKUP.tar.gz
```

Inicie novamente a versão recuperada:

```bash
docker compose up -d
```

Confirme a recuperação:

```bash
docker compose ps
```

```bash
curl -I https://desertfoxlabs.com
```

## Atualizações futuras

Para cada nova versão:

1. Envie o novo ZIP com `scp`.
2. Entre em `/opt/tahingresso`.
3. Crie um backup.
4. Extraia o novo ZIP.
5. Execute `docker compose config`.
6. Recrie os contêineres.
7. Teste a página principal e os checkouts.

Não coloque senhas, tokens ou chaves de pagamento dentro do ZIP do tema.
