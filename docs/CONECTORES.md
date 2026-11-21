# Conectores e testes de conexão

O projeto usa uma lista explícita de provedores e operações. Possuir uma API é condição de acesso, mas os formatos e as capacidades precisam ser implementados.

## Ponto de extensão

| Arquivo | Responsabilidade |
| --- | --- |
| `server/domain.mjs` | Registro de provedores, validações e regras de dinheiro |
| `server/store.mjs` | Implementação de leitura, consulta e transações Firestore |
| `server/images.mjs` | Fotos no Firebase Storage e leitura pública de imagens |
| `server/mercadopago.mjs` | Autenticação, preferências, consulta e OAuth Mercado Pago |
| `server/service.mjs` | Permissões, configuração, pedidos, comissões e auditoria |
| `server/handler.mjs` | Entrada HTTP e respostas sem exposição de credenciais |

## Contrato de dados

Um novo adaptador precisa preservar os identificadores e oferecer:

```javascript
await store.get(collection, id); // objeto com id ou null
await store.set(collection, id, object);
await store.remove(collection, id);
await store.list(collection, filters, cursor, limit); // {items, nextCursor}
await store.transaction(async tx => {
  const value = await tx.get(collection, id);
  // Todas as leituras antes das gravações, sem HTTP dentro da transação.
  tx.set(collection, id, nextValue);
});
```

As transações precisam ser atômicas e tratar concorrência. Um serviço que só oferece gravações independentes por REST não satisfaz o contrato de pedidos, estoque e repasses. `MemoryStore` existe somente nos testes e nunca é usado para produção.

## Contrato de pagamentos

Um conector deve definir autenticação e ambiente, criação de checkout, consulta de pagamento, referência externa, moeda, valor, recebedor, verificação de webhook, idempotência, OAuth ou vinculação de vendedores quando existir e estados de estorno/contestação. Se uma capacidade não for implementada, a interface deve informá-la como pendente.

Nesta versão, o conector Mercado Pago utiliza somente o host oficial da API. Não há campo que encaminhe credenciais para uma URL arbitrária inserida pelo navegador.

## Estados exibidos

| Estado | O que comprova |
| --- | --- |
| Aguardando configuração | Credenciais não foram cadastradas |
| Aguardando teste | Credenciais foram salvas, sem teste da versão atual |
| Autenticação verificada | O provedor aceitou a credencial no endpoint testado |
| Falha na conexão | O teste não conseguiu autenticar ou comunicar |
| Conector necessário | O serviço ainda não possui implementação |

O teste Firebase faz uma gravação e leitura temporárias. O teste Mercado Pago consulta a conta e identifica os campos de webhook e OAuth cadastrados. Nenhum deles executa uma cobrança real, prova uma entrega de webhook nem certifica disponibilidade futura.

## Homologação de um novo conector

Use conta e credenciais de teste do próprio provedor. Confira uma operação aprovada, pendente, recusada, repetida e estornada. Faça o teste em cada canal, com o navegador fechado durante a confirmação do provedor. Confirme recebedor, taxa, comissão, moeda e ausência de dados sensíveis no cliente.

O teste de assinatura de webhook e a consulta do pagamento são independentes. Uma notificação simulada de teste do painel do provedor não comprova que um pedido real foi liquidado.

## Escala e continuidade

Para operação maior, acrescente paginação por data com filtros de servidor, índices próprios, conciliação periódica, monitoramento de webhook, renovação OAuth com trava de concorrência e processamento de notificações push. A limpeza diária atual remove somente códigos temporários vencidos.

Fotos enviadas são comprimidas no cliente, validadas no servidor e guardadas no Storage. Endereços externos HTTPS de imagem continuam suportados. Não se guardam fotos em base64 nos documentos de produtos.
