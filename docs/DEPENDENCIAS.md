# Dependências verificadas

Na preparação da versão 0.1.0 foram atualizados e fixados Firebase Web 13.4.0, Firebase Admin 14.5.1 e esbuild 0.28.2. O `package-lock.json` acompanha o código para instalação reproduzível por `npm ci`.

Há um override de `@grpc/grpc-js` para 1.14.7. O pacote transitivo incluído pelo Firebase Web mantinha uma versão antiga sinalizada pela auditoria npm. A versão corrigida também é utilizada pela dependência Firestore do Firebase Admin. O cliente desta aplicação utiliza apenas Firebase App e Auth; dados de negócio passam pela API do servidor.

Os testes, a checagem de sintaxe e a compilação Web são executados novamente após a atualização. O relatório de verificação registra o resultado da auditoria. A auditoria de dependências não substitui a homologação das suas contas e do fluxo de pagamento.
