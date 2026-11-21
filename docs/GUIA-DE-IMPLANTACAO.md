# Colocar o SAM CONECTA no ar

Primeira versão 0.1.0 · 20/11/2026 · São Paulo.

O nome é provisório e pode ser alterado no ADM. O objetivo desta entrega é fornecer os arquivos de desenvolvimento, os APKs assinados e a implantação preparada. As suas contas Firebase, Netlify e Mercado Pago ainda não foram conectadas.

## Arquivos da entrega

| Arquivo | Uso |
| --- | --- |
| `SAM-CONECTA-0.1.0-PROJETO.zip` | Código para extrair e enviar ao GitHub |
| `SAM-CONECTA-USUARIO-0.1.0.apk` | Aplicativo de usuários, vendedores e afiliados |
| `SAM-CONECTA-ADM-0.1.0.apk` | Aplicativo administrativo; exige conta autorizada |
| `SAM-CONECTA-ASSINATURA-PRIVADA.zip` | Chave de assinatura e credenciais para futuras atualizações; guarde em local privado |

Os APKs precisam de uma plataforma HTTPS publicada. Sem ela, abrem a configuração inicial da central.

## 1. Preparar o Firebase

Use um projeto exclusivo desta plataforma na sua conta Firebase. As regras entregues fecham o acesso direto aos dados e não devem substituir regras de outro aplicativo existente.

1. No [Console Firebase](https://console.firebase.google.com/), crie ou selecione o projeto correto.
2. Abra **Authentication → Sign-in method** e habilite **Google** e **E-mail/senha**. No Google, informe o e-mail de suporte solicitado pelo console.
3. Em **Firestore Database**, crie o banco padrão `(default)` em modo de produção.
4. Em **Storage**, crie o bucket se desejar enviar fotos do celular. Confira as condições de cobrança da sua conta. URLs HTTPS de imagens externas também são aceitas.
5. Em **Configurações do projeto → Seus apps**, registre um aplicativo **Web**. Copie `apiKey`, `authDomain`, `projectId`, `appId` e o nome do bucket quando houver.
6. Em **Configurações do projeto → Contas de serviço**, gere a chave privada do Admin SDK para este projeto. Ela é usada somente no servidor.

Crie uma versão em uma linha do JSON da conta de serviço no computador. O comando gera um arquivo local, sem imprimir a chave no terminal:

```bash
node -e "const fs=require('fs');fs.writeFileSync('firebase-service-account.private.txt',JSON.stringify(JSON.parse(fs.readFileSync('service-account.json','utf8'))))"
```

O caminho `service-account.json` deve corresponder ao arquivo que você baixou. Copie o conteúdo de `firebase-service-account.private.txt` para a variável privada indicada na etapa 3. Não envie esses arquivos ao GitHub.

Para publicar as regras e o índice de notificações, na pasta do projeto:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage --project SEU_PROJECT_ID
```

Substitua `SEU_PROJECT_ID`. Se não usar Storage, execute somente `--only firestore:rules,firestore:indexes`.

O índice de notificações pode levar alguns minutos para ficar pronto. Não abra o Firestore em modo público para contornar um erro.

## 2. GitHub e Netlify

1. Extraia `SAM-CONECTA-0.1.0-PROJETO.zip`.
2. Entre na pasta `SAM-CONECTA`. O arquivo `package.json` e o `netlify.toml` precisam ficar na raiz do repositório.
3. Crie o repositório no GitHub e envie os arquivos, incluindo `.gitignore`, `.env.example`, `.github/`, `server/`, `netlify/functions/`, `web/`, `scripts/`, os arquivos de regras e `package-lock.json`.
4. Não envie `node_modules`, `.env`, arquivos de conta de serviço nem o ZIP de assinatura privada.
5. Na [Netlify](https://app.netlify.com/), escolha a importação de um projeto existente pelo GitHub e selecione o repositório.
6. Confira: comando de build **`npm run build`**, diretório publicado **`dist`** e funções em **`netlify/functions`**. O `netlify.toml` já define esses campos.
7. Publique uma primeira vez e anote a URL HTTPS final. A tela mostrará a orientação inicial enquanto as variáveis estiverem vazias.

O plano gratuito da Netlify tem limites de uso/créditos. A disponibilidade depende do plano e das cotas da sua conta; domínio próprio, Firebase e processamento de pagamento podem ter custos próprios. Não se trata de hospedagem ilimitada.

## 3. Variáveis na hospedagem

Em **Project configuration → Environment variables**, cadastre os valores. Use o ambiente de produção e assegure que estejam disponíveis às Functions. As variáveis privadas não são colocadas no código do navegador.

| Variável | Valor |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` do aplicativo Web Firebase |
| `FIREBASE_AUTH_DOMAIN` | `authDomain`, normalmente `projeto.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | ID exato do projeto |
| `FIREBASE_APP_ID` | `appId` do aplicativo Web |
| `FIREBASE_STORAGE_BUCKET` | Nome do bucket, sem `gs://`; necessário para envio de fotos |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo da conta de serviço em uma linha |
| `ADMIN_EMAIL` | Seu e-mail proprietário, que será verificado no login |
| `APP_URL` | URL HTTPS final do site, sem barra no final |
| `TOKEN_ENCRYPTION_KEY` | Chave aleatória de 32 bytes codificada em base64 |
| `PAYMENTS_ENABLED` | Comece com `false`; depois use `true` para homologar o checkout |

Para gerar a chave de criptografia em um arquivo local privado:

```bash
node -e "require('fs').writeFileSync('token-encryption.private.txt',require('crypto').randomBytes(32).toString('base64'))"
```

Copie o conteúdo para `TOKEN_ENCRYPTION_KEY` e preserve uma cópia privada. Não troque essa chave depois de salvar tokens sem antes preparar a recifragem dos dados.

Após preencher as variáveis, faça um novo deploy. Variáveis colocadas somente no arquivo `netlify.toml` não substituem as variáveis privadas de execução das Functions.

Volte ao Firebase e abra **Authentication → Settings → Authorized domains**. Adicione o domínio exato publicado, como `seu-site.netlify.app`, sem `https://` e sem caminho. Se usar um domínio próprio, adicione-o também.

## 4. Primeiro acesso proprietário

1. Abra o site e entre com o Google correspondente a `ADMIN_EMAIL`.
2. Se preferir e-mail/senha, crie a conta, confirme o e-mail enviado pelo Firebase e entre novamente.
3. O proprietário pode abrir o ADM. Uma conta comum não recebe acesso por instalar o APK administrativo.
4. Em **Configurações**, revise nome, categorias e taxa. A taxa inicial é zero até você definir outra.
5. Publique seus textos de termos e privacidade. Eles começam vazios para que não haja aceite de um documento inexistente.
6. Informe uma versão dos termos. Uma alteração posterior dos textos exige nova versão.
7. Abra **Área do usuário → Meu perfil**, complete CPF/CNPJ, telefone, endereço e as opções de vendedor/afiliado e aceite os textos publicados.

Há rascunhos operacionais em `docs/TERMOS-E-PRIVACIDADE-RASCUNHO.md` para ajudar no preenchimento. Eles precisam receber a identificação da sua operação, contatos, prazos e revisão antes de serem publicados.

O documento informado não é automaticamente verificado junto a um serviço de identidade. A plataforma registra o dado e o aceite. A administração precisa definir seu processo de validação cadastral.

## 5. Conectar o Mercado Pago

O conector implementado é **Checkout Pro com preferências**, usando a Payments API para consultar o resultado. Não misture os campos deste fluxo com os campos diferentes da Orders API.

1. Em [Mercado Pago Developers](https://www.mercadopago.com.br/developers/), crie a aplicação correspondente à sua operação.
2. Para trabalhar com vendedores terceiros, confira a habilitação e as permissões de marketplace/split disponíveis para a aplicação e para sua conta.
3. Cadastre como Redirect URI OAuth a URL final com o caminho:

```text
https://SEU-DOMINIO/api/oauth/mercadopago/callback
```

4. Configure as notificações de pagamentos em Webhooks e copie o segredo da assinatura. A URL base é:

```text
https://SEU-DOMINIO/api/webhooks/mercadopago
```

Cada preferência criada pela plataforma também envia uma URL com a referência do pedido. Não invente manualmente o parâmetro `data.id`: ele é enviado pelo provedor e participa da assinatura.

5. No **ADM → Integrações → Mercado Pago → Configurar**, informe o Access Token da plataforma, o segredo Webhook e, para vincular vendedores, o Client ID e o Client Secret. Selecione o ambiente correto.
6. Toque **Salvar conexão** e depois **Testar conexão**. Uma autenticação válida não comprova ainda o recebimento de uma cobrança ou de um webhook.
7. Defina `PAYMENTS_ENABLED=true` nas variáveis da Netlify e publique novamente para realizar a homologação.
8. No ADM, execute novamente o teste da conexão e, em até 15 minutos, habilite **Pagamentos Mercado Pago** nas configurações. As credenciais precisam ser da mesma revisão testada.
9. O vendedor terceiro abre **Quero vender → Conectar Mercado Pago** e autoriza sua conta pelo OAuth do provedor. Uma venda online de terceiro só prossegue depois dessa vinculação.

O sistema cobra no split a parte da plataforma e a comissão do afiliado como remuneração do marketplace. O repasse ao afiliado continua sendo uma transferência externa registrada no ADM. As tarifas do provedor são próprias do Mercado Pago e não estão incluídas no valor da taxa definido por você.

## 6. Testar compra e retorno

Use as contas e meios de teste fornecidos pelo Mercado Pago. Não use dados pessoais de cartão real no ambiente de teste.

1. Com uma conta de vendedor, complete o cadastro e cadastre um produto de pagamento online.
2. No ADM, aprove a publicação do produto.
3. Com outra conta de comprador, crie o pedido. O servidor consulta o preço, reserva uma unidade e gera o checkout.
4. Conclua o cenário de teste do provedor. O comprador deve retornar a `retorno.html`, que consulta a central.
5. No caso aprovado, confira o pedido pago, o recebedor, o valor, o ambiente e o histórico. O texto `status=approved` na URL não altera o pedido sozinho.
6. Repita para pendente e recusado. Pagamento pendente deve continuar pendente.
7. Gere um link de afiliado com uma terceira conta e confira a comissão após uma venda confirmada.
8. Confira um estorno iniciado no próprio Mercado Pago. Depois do webhook ou da consulta de reconciliação, a comissão precisa se ajustar.
9. Faça também uma compra pelo APK. A página de retorno oferece o deep link para abrir o aplicativo correspondente.

O retorno automático do Checkout Pro depende do provedor e do meio de pagamento. A documentação informa até 40 segundos para o retorno automático aprovado. A plataforma tenta abrir o APK depois de exibir o estado na página; o botão manual permanece quando o navegador impede a abertura automática.

Se o webhook não chegar, abra o pedido e use **Consultar pagamento**. Confira a URL, a assinatura configurada e os logs da Function. Não marque um pedido online como pago manualmente para contornar uma falha de integração.

Se a criação do checkout falhar, o pedido aparece como revisão. Confira o pedido e a referência no Mercado Pago antes de repetir. Essa versão não libera reservas online automaticamente sem conferir o resultado no provedor.

## 7. Negociações assistidas

Para imóveis, veículos ou produtos que dependem de atendimento, selecione **Negociação assistida** no cadastro.

O comprador solicita atendimento, e o pedido gera avisos para administração, vendedor e comprador. A equipe conclui a negociação externamente e registra o valor exato e a referência do contrato/comprovante. Somente então o pedido e a comissão são confirmados.

O sistema permite cancelar uma negociação assistida ainda aberta e devolver a unidade ao estoque. As operações ficam no histórico.

## 8. Instalar os APKs

1. Baixe o APK de usuário ou o APK ADM no Android. São pacotes diferentes e podem coexistir.
2. Autorize a instalação pela origem usada para baixar, quando o Android solicitar.
3. No primeiro acesso, informe **a mesma URL HTTPS da central publicada**, sem caminhos adicionais.
4. Entre na sua conta. O APK ADM exige o proprietário ou um administrador autorizado no servidor.
5. O Google abre o navegador do sistema e usa um código temporário com prova PKCE para retornar ao aplicativo. A senha Google não é solicitada dentro do WebView.
6. Para fotos de produtos, use o seletor de arquivos do Android.

O botão **Central**, na barra superior do APK, permite atualizar a página ou trocar a URL. Mudanças de telas e configurações do site são usadas pelos APKs. Recursos nativos ou permissões novas exigem recompilar e atualizar o APK.

**Notificações:** os avisos ficam guardados na plataforma. O aplicativo pode emitir notificações locais ao receber novidades enquanto está ativo, mediante permissão do Android. Push com o APK fechado ainda não foi implementado.

## 9. Projetos para o futuro

No ADM, abra **Projetos** e cadastre nome, imagem, descrição, valor mínimo, meta e estimativa mensal. Você controla o estado de rascunho, publicado ou pausado. Em **Configurações**, escolha quando o módulo ficará visível aos usuários.

Nesta versão, os usuários registram interesse para atendimento. Não há cobrança de aporte, titularidade compartilhada de imóvel, custódia, cálculo de rendimento realizado ou distribuição financeira automática. A configuração de uma estimativa não cria um saldo disponível.

## 10. Antes da distribuição para usuários

- Verifique o login Google no navegador e no APK com sua conta real.
- Confira termos publicados, cadastro, suspensão e permissões com contas diferentes.
- Faça um fluxo completo de teste no Mercado Pago, incluindo webhook e retorno ao aplicativo.
- Confira as tarifas e a conta de recebimento antes de usar produção.
- Teste a instalação e o comportamento no seu aparelho; os APKs foram compilados e assinados, mas não foram executados em Android físico neste ambiente.
- Guarde a assinatura privada separadamente. Ela é necessária para atualizar os APKs já instalados, sem perder a continuidade da assinatura.

## Referências oficiais consultadas

- [Firebase: verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase: transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Google: login em aplicações e navegadores embutidos](https://developers.google.com/identity/siwg/best-practices)
- [Mercado Pago: URLs de retorno](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-back-urls)
- [Mercado Pago: configuração do split](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/create-configuration)
- [Mercado Pago: integração do marketplace](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)
- [Mercado Pago: Webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod)
- [Netlify: variáveis nas Functions](https://docs.netlify.com/build/functions/environment-variables/)
- [Netlify: limites e planos por créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
