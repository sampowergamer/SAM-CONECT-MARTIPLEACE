# SAM CONECTA · primeira versão 0.1.0

Marketplace em português com vendedores, afiliados, painel web principal e dois aplicativos Android conectados ao mesmo servidor. Nome inicial editável pelo proprietário.

**Entrega de código e APKs, ainda sem conexão às suas contas.** Não há produtos, contas, saldos, pagamentos nem rendimentos fictícios. A tela inicial informa quando o Firebase ainda não foi configurado.

Comece por [GUIA-DE-IMPLANTACAO.md](docs/GUIA-DE-IMPLANTACAO.md). As decisões de comunicação entre canais estão em [ARQUITETURA.md](docs/ARQUITETURA.md), e os conectores em [CONECTORES.md](docs/CONECTORES.md).

## Incluído

- Web responsiva: catálogo por categoria, busca, produtos, compras, vendas e links de indicação.
- Google e e-mail/senha pelo Firebase; CPF/CNPJ, telefone, endereço e aceite versionado dos textos publicados pelo proprietário.
- Uma conta pode vender e indicar. Comissão em um nível, vinculada à venda confirmada.
- ADM: moderação, usuários, suspensão, permissões, pedidos, atendimento humano, novidades, taxas, projetos e histórico.
- Configuração central versionada, proteção contra sobrescrita por outra sessão e verificação de regras no servidor a cada operação.
- Mercado Pago: credenciais cifradas no servidor, teste de autenticação, Checkout Pro, OAuth de vendedores, split 1:1, webhook assinado e página de retorno.
- Valores em centavos; preço recalculado pelo servidor; idempotência de pedido e repasse; comissões ajustadas após estorno/contestação.
- Fotos no Firebase Storage, servidas por uma rota de imagem. Documentos do catálogo guardam somente URLs.
- Dois APKs assinados: usuário e ADM. A URL HTTPS da central é informada no primeiro acesso, sem recompilar.
- Alertas persistentes na plataforma. O APK pode exibir notificações locais ao receber eventos com o aplicativo ativo.
- Projetos: cadastro, imagem, descrição, valor mínimo, meta, estimativa e publicação controlada; manifestações de interesse.
- Limpeza diária de códigos temporários vencidos na Netlify.

## Limites da versão

- Credenciais reais, publicação em Netlify/Firebase, instalação física e pagamento de ponta a ponta ainda precisam ser feitos com a sua conta.
- O teste de conexão confirma capacidades específicas; não declara um serviço “100% operante”.
- Somente Firebase e Mercado Pago possuem conectores implementados. Outra API exige código de adaptação. A troca de banco não é automática.
- Notificações com o aplicativo fechado e push remoto FCM ainda não estão implementados.
- O repasse ao afiliado é uma transferência externa registrada no ADM. O sistema não executa o Pix de repasse.
- Aportes não são cobrados e rendimentos não são distribuídos nesta versão. O módulo registra projetos e interesse, sem criar titularidade sobre imóveis.
- Estornos são iniciados no Mercado Pago; a plataforma recebe o novo estado. Há consulta manual de reconciliação, sem varredura financeira automática em segundo plano.
- A reconexão OAuth do vendedor é solicitada quando o token expira; a renovação por refresh token ainda não é automática.
- Pedidos online com falha de criação do checkout ficam reservados para revisão. Não há liberação automática dessas reservas sem conferência do provedor.
- CPF/CNPJ informado não equivale a identidade verificada. Não há KYC documental, antifraude próprio, emissão fiscal, cálculo de frete ou logística integrada.
- As telas carregam até 1.000 registros; os totais da visão geral correspondem aos registros carregados.

## Rodar no computador

Node.js 22 ou superior:

```bash
npm ci
npm run check
npm test
npm run build
npm run dev
```

Abra `http://localhost:4173`. Sem `.env`, a aplicação abre a orientação inicial. Para usar dados reais localmente, copie `.env.example` para `.env`, preencha os campos e inclua `localhost` nos domínios autorizados do Firebase. Em produção, use HTTPS e a URL final em `APP_URL`.

Para compilar Android, siga [ANDROID.md](docs/ANDROID.md). O arquivo de assinatura privada é entregue separadamente e não pertence ao repositório.

## Estrutura

| Caminho | Finalidade |
| --- | --- |
| `web/` | Interface, login, retorno do pagamento e autorização do APK |
| `server/` | Autorização, regras, integrações e operações financeiras |
| `netlify/functions/` | Entrada HTTP e limpeza de códigos vencidos |
| `android/` | Aplicativo Android, duas variantes |
| `scripts/` | Compilação e desenvolvimento local |
| `tests/` | Testes de autorização, dinheiro, idempotência e conectores |
| `docs/` | Implantação, arquitetura, Android e limites |
| `.env.example` | Nomes das variáveis sem credenciais |

Não coloque a conta de serviço Firebase, a chave de criptografia, tokens Mercado Pago ou a assinatura Android no GitHub. A configuração pública Web do Firebase é diferente da conta de serviço privada.
