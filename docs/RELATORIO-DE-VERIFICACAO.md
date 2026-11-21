# Verificação da entrega 0.1.0

Data: 20/11/2026, São Paulo.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Sintaxe JavaScript/ESM | Aprovada |
| Testes automatizados | 27 aprovados, zero falhas |
| Compilação Web com esbuild | Aprovada |
| Auditoria npm após atualização e override | Zero vulnerabilidades reportadas |
| Interface inicial no navegador | Carregou e apresentou a configuração pendente; navegação inicial conferida |
| APK de usuário | Compilado, íntegro e assinado |
| APK ADM | Compilado, íntegro e assinado |
| Assinaturas Android | v1, v2 e v3 válidas; APKs alinhados |
| DEX e manifesto nos APKs | Presentes; integridade ZIP aprovada |
| Dispositivo Android conectado | Nenhum; instalação e uso físico não realizados |
| Firebase do usuário | Não conectado; sem credenciais fornecidas |
| Mercado Pago do usuário | Não conectado; sem cobrança real executada |
| Publicação GitHub/Netlify | Preparada em arquivos; não realizada na conta do usuário |

Os testes usam repositório em memória, autenticação controlada e respostas de provedor simuladas exclusivamente no ambiente de teste. O repositório de teste impõe leituras antes de gravações e transações atômicas. Ele não participa do código de produção. Não foi executado um emulador Firestore nesta entrega.

## Casos cobertos

Permissões de proprietário e ADM, bloqueio de usuário suspenso, isolamento dos pedidos, proteção contra origem não autorizada, versão da configuração, atualização de termos e consentimento, recusa de troca de banco sem migração, cifragem autenticada, prova PKCE e código único do APK, preço definido no servidor, estoque em pedido idempotente, assinatura de webhook, conferência de referência/valor/moeda/recebedor/ambiente, replay e ordem de eventos, duplicidade de pagamento, estorno parcial e total, preservação de repasses já realizados, confirmação manual e baixa idempotente de repasse externo.

## Identificação dos APKs

| Arquivo | Bytes | SHA-256 |
| --- | --- | --- |
| SAM-CONECTA-USUARIO-0.1.0.apk | 21035 | `8a9d5b79300676f25b6eab15ca6b730aa3160684e97b65160e8f699c5065156a` |
| SAM-CONECTA-ADM-0.1.0.apk | 21035 | `389bfa679cb881b1702444a936fd0958e3cc6b8f25d8e5dc73e0c3bc87f915fb` |

Os APKs são pequenos porque carregam a interface web publicada, sem incorporar bibliotecas Firebase nativas ou um catálogo de demonstração. Ambos usam a mesma chave de assinatura entregue separadamente. Os pacotes são diferentes.

## Limites de validação

Os resultados não certificam uma operação real de pagamento nem disponibilidade contínua de terceiros. Faltam a implantação nas contas reais, login Google em aparelho, vinculação OAuth de vendedores, envio de foto ao Storage real, recebimento real de webhook e retorno do checkout ao Android.

As pendências funcionais estão descritas no README: push remoto com aplicativo fechado, recebimento/distribuição financeira de aportes, transferências automáticas de comissões, renovação automática de OAuth, liberação automática de reservas online em revisão, conectores adicionais e migração efetiva de banco.
