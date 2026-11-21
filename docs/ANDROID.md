# Android · usuário e ADM

Os APKs desta entrega usam uma camada Android nativa com WebView para carregar a URL da sua central. A parte operacional roda no servidor. Não possuem dados de demonstração nem credenciais administrativas incorporadas.

| Canal | Nome | Pacote | Deep link |
| --- | --- | --- | --- |
| Usuário | SAM CONECTA | `br.com.samconecta.app` | `samconecta://` |
| ADM | SAM CONECTA ADM | `br.com.samconecta.adm` | `samconecta-adm://` |

Android mínimo 6.0/API 23; alvo e compilação API 35; versão `0.1.0`, código `1`.

## Compilar com o script

Requer Python 3, JDK 17 ou superior, Android SDK com `platforms;android-35` e `build-tools;35.0.0`. O script usa Java, AAPT2, D8, Zipalign e Apksigner oficiais, sem bibliotecas nativas de terceiros.

Defina `ANDROID_STORE_PASSWORD` e `ANDROID_KEY_PASSWORD` no ambiente do seu terminal com a senha guardada no arquivo de assinatura privada. Não escreva essas credenciais no repositório. O alias da assinatura desta entrega é `samconecta`.

Exemplo Linux/macOS:

```bash
python3 scripts/build_android.py \
  --sdk /caminho/android-sdk \
  --java-home /caminho/jdk \
  --keystore /caminho/privado/sam-conecta-release.p12 \
  --output /caminho/dos-apks
```

Exemplo Windows PowerShell, depois de definir as variáveis de senha no terminal:

```powershell
python scripts/build_android.py --sdk "C:\Android\Sdk" --java-home "C:\Java\jdk-17" --keystore "C:\Chaves\sam-conecta-release.p12" --output "C:\SAM\APKs"
```

Os caminhos são exemplos. O script também aceita `ANDROID_HOME` ou `ANDROID_SDK_ROOT` e `JAVA_HOME` em lugar dos dois primeiros argumentos. Não requer Node para compilar a camada Android.

Não basta alterar `versionCode` somente no manifesto em uma atualização: altere também os valores no script de compilação e no `build.gradle`. As atualizações do mesmo pacote precisam da mesma chave de assinatura.

## Android Studio / Gradle

Há um projeto Gradle de módulo único na pasta `android/`, com os sabores `usuario` e `adm`. Abra essa pasta no Android Studio e instale o SDK 35. O código fica em `src/br/com/samconecta/app/MainActivity.java`.

O repositório não inclui um wrapper Gradle binário. O script Python é o caminho de compilação verificado nesta entrega. Para compilar pelo Gradle, use Gradle compatível com AGP 8.7.2 e configure a assinatura Release no ambiente local ou no Android Studio.

## Autenticação e retorno

- Google: navegador do sistema → Firebase Web → código temporário → deep link → troca no servidor com PKCE → sessão Firebase no aplicativo.
- Pagamento: navegador/checkout Mercado Pago → página HTTPS de retorno → deep link → leitura do pedido autorizado na central.
- Tokens de login não são colocados no deep link.
- O APK não contém a conta de serviço Firebase nem os tokens de pagamento.
- O primeiro acesso exige a URL HTTPS publicada. URLs HTTP e certificados inválidos não são aceitos.

## Fotos e notificações

O seletor Android permite escolher uma imagem sem conceder acesso amplo ao armazenamento. A página reduz a foto antes de enviar à central.

A permissão de notificação é solicitada no ADM em Android 13 ou superior. Nesta versão, os eventos são consultados com o aplicativo ativo; não há serviço de push FCM com o aplicativo fechado.

## Verificação realizada

Compilação dos dois canais, presença de DEX, integridade ZIP, identificação dos pacotes, alinhamento e assinaturas v1/v2/v3 conferidos. Sem teste de instalação, Google, seletor de fotos ou retorno de pagamento em aparelho físico neste ambiente.
