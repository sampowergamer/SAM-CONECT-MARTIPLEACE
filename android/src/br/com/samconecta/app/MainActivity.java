package br.com.samconecta.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.security.*;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends Activity {
  private WebView web;
  private LinearLayout root;
  private android.content.SharedPreferences prefs;
  private String origin="",pendingCode="",pendingOrder="";
  private boolean ready=false;
  private ValueCallback<Uri[]> fileCallback;
  private final String scheme=BuildConfig.IS_ADMIN?"samconecta-adm":"samconecta";
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density);}

  @Override public void onCreate(Bundle state){super.onCreate(state);prefs=getSharedPreferences("sam_central",MODE_PRIVATE);origin=prefs.getString("origin","");consumeIntent(getIntent());if(origin.isEmpty())setup();else launch();}
  private TextView label(String text,int size,int color){TextView t=new TextView(this);t.setText(text);t.setTextSize(size);t.setTextColor(color);return t;}
  private Button button(String text){Button b=new Button(this);b.setText(text);b.setAllCaps(false);b.setTextColor(Color.WHITE);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(217,62,54)));return b;}
  private String validOrigin(String value){
    try{Uri u=Uri.parse(value.trim());String host=u.getHost();if(!"https".equals(u.getScheme())||host==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!(u.getPath()==null||u.getPath().isEmpty()||"/".equals(u.getPath())))return "";if(u.getPort()!=-1&&u.getPort()!=443)return "";if(host.equals("localhost")||host.matches("[0-9.]+"))return "";return "https://"+host.toLowerCase(Locale.ROOT);}catch(Exception e){return "";}
  }
  private void setup(){
    ready=false;ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(28),dp(50),dp(28),dp(30));page.setBackgroundColor(Color.rgb(244,245,247));scroll.addView(page);page.addView(label("SAM CONECTA",28,Color.rgb(217,62,54)));page.addView(label(BuildConfig.IS_ADMIN?"Aplicativo ADM":"Sua rede de negócios",19,Color.rgb(23,29,38)));
    TextView intro=label("Conecte este aplicativo à sua central",25,Color.rgb(23,29,38));intro.setPadding(0,dp(42),0,dp(16));page.addView(intro);
    TextView hint=label("Informe a URL HTTPS da plataforma publicada. O app usará os mesmos usuários, produtos e configurações do painel web.",16,Color.rgb(90,102,119));page.addView(hint);
    EditText input=new EditText(this);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);input.setSingleLine(true);input.setText(origin);input.setHint("https://seu-site.netlify.app");input.setTextSize(16);LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(-1,dp(64));ip.topMargin=dp(30);page.addView(input,ip);
    Button connect=button("Conectar à central");LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,dp(54));bp.topMargin=dp(20);page.addView(connect,bp);connect.setOnClickListener(v->{String target=validOrigin(input.getText().toString());if(target.isEmpty()){input.setError("Use somente a origem HTTPS, sem caminho nem parâmetros.");return;}origin=target;pendingCode="";pendingOrder="";prefs.edit().putString("origin",origin).remove("verifier").apply();CookieManager.getInstance().removeAllCookies(null);WebStorage.getInstance().deleteAllData();launch();});
    TextView note=label("Primeiro acesso: publique o projeto web e configure o Firebase. Esta tela não cria contas nem simula pagamentos.",14,Color.rgb(90,102,119));note.setPadding(0,dp(30),0,0);page.addView(note);setContentView(scroll);
  }
  private boolean own(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&origin.equals("https://"+uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null;}
  private void launch(){
    if(web!=null){web.removeJavascriptInterface("SamNative");web.destroy();}
    ready=false;root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setFitsSystemWindows(true);root.setBackgroundColor(Color.rgb(21,25,30));
    LinearLayout toolbar=new LinearLayout(this);toolbar.setPadding(dp(15),dp(3),dp(8),dp(3));toolbar.setGravity(Gravity.CENTER_VERTICAL);TextView brand=label(BuildConfig.IS_ADMIN?"SAM CONECTA · ADM":"SAM CONECTA",14,Color.WHITE);brand.setTypeface(null,android.graphics.Typeface.BOLD);toolbar.addView(brand,new LinearLayout.LayoutParams(0,-2,1));Button options=new Button(this);options.setText("Central");options.setAllCaps(false);options.setTextSize(13);options.setTextColor(Color.WHITE);options.setBackgroundColor(Color.TRANSPARENT);options.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("Sua central").setMessage(origin+"\n\nOs dados da conta ficam na plataforma conectada.").setPositiveButton("Continuar",null).setNeutralButton("Atualizar",(d,w)->web.reload()).setNegativeButton("Trocar URL",(d,w)->new AlertDialog.Builder(this).setTitle("Trocar central?").setMessage("A sessão local será encerrada ao conectar outra URL.").setPositiveButton("Trocar",(d2,w2)->setup()).setNegativeButton("Voltar",null).show()).show());toolbar.addView(options,new LinearLayout.LayoutParams(dp(90),dp(43)));root.addView(toolbar,new LinearLayout.LayoutParams(-1,dp(47)));
    web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
    WebView.setWebContentsDebuggingEnabled(false);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setGeolocationEnabled(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setJavaScriptCanOpenWindowsAutomatically(false);CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.addJavascriptInterface(new Bridge(),"SamNative");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return navigate(request.getUrl());}
      @Override public boolean shouldOverrideUrlLoading(WebView view,String value){return navigate(Uri.parse(value));}
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon){ready=false;}
      @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();new AlertDialog.Builder(MainActivity.this).setTitle("Conexão segura indisponível").setMessage("Confira o certificado HTTPS da central antes de continuar.").setPositiveButton("Fechar",null).show();}
      @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())Toast.makeText(MainActivity.this,"A central não respondeu. Confira sua internet e a URL.",Toast.LENGTH_LONG).show();}
    });
    web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(pick,41);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}});
    web.loadUrl(origin+"/"+(BuildConfig.IS_ADMIN?"#central":"#explorar"));
  }
  private boolean navigate(Uri uri){if(own(uri))return false;if(scheme.equals(uri.getScheme())){handleLink(uri);return true;}external(uri.toString());return true;}
  private void external(String value){
    try{Uri u=Uri.parse(value);String h=u.getHost();boolean mp=h!=null&&(h.equals("mercadopago.com")||h.endsWith(".mercadopago.com")||h.equals("mercadopago.com.br")||h.endsWith(".mercadopago.com.br"));if(!"https".equals(u.getScheme())||u.getUserInfo()!=null||(!mp&&!own(u)))return;startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){Toast.makeText(this,"Não foi possível abrir o navegador.",Toast.LENGTH_SHORT).show();}
  }
  private class Bridge {
    @JavascriptInterface public boolean isAdminApp(){return BuildConfig.IS_ADMIN;}
    @JavascriptInterface public void openExternal(String url){runOnUiThread(()->{if(own(Uri.parse(web.getUrl())))external(url);});}
    @JavascriptInterface public void openAuthentication(){runOnUiThread(()->{
      try{if(!own(Uri.parse(web.getUrl())))return;byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);String verifier=android.util.Base64.encodeToString(bytes,android.util.Base64.NO_PADDING|android.util.Base64.NO_WRAP|android.util.Base64.URL_SAFE);String challenge=android.util.Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes("UTF-8")),android.util.Base64.NO_PADDING|android.util.Base64.NO_WRAP|android.util.Base64.URL_SAFE);prefs.edit().putString("verifier",verifier).putLong("verifierTime",System.currentTimeMillis()).apply();external(origin+"/mobile-auth.html?challenge="+challenge+"&client="+(BuildConfig.IS_ADMIN?"adm":"user"));}catch(Exception e){Toast.makeText(MainActivity.this,"Não foi possível iniciar o login.",Toast.LENGTH_SHORT).show();}
    });}
    @JavascriptInterface public void webReady(){runOnUiThread(()->{if(own(Uri.parse(web.getUrl()))){ready=true;deliver();if(BuildConfig.IS_ADMIN&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED&&!prefs.getBoolean("notificationAsked",false)){prefs.edit().putBoolean("notificationAsked",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},77);}}});}
    @JavascriptInterface public void notify(String title,String message,String eventId){runOnUiThread(()->{if(own(Uri.parse(web.getUrl())))notifyEvent(title,message,eventId);});}
  }
  private void notifyEvent(String title,String message,String eventId){
    if(eventId==null||eventId.length()>150)return;if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);String channel="sam_operacao";if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(channel,"Operações da plataforma",NotificationManager.IMPORTANCE_DEFAULT));
    Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,channel):new Notification.Builder(this);Intent intent=new Intent(this,MainActivity.class);PendingIntent click=PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    b.setSmallIcon(R.drawable.ic_notification).setContentTitle(title==null?"SAM CONECTA":title.substring(0,Math.min(title.length(),150))).setContentText(message==null?"":message.substring(0,Math.min(message.length(),500))).setContentIntent(click).setAutoCancel(true);manager.notify(eventId.hashCode(),b.build());
  }
  private void consumeIntent(Intent intent){if(intent!=null&&intent.getData()!=null)handleLink(intent.getData());}
  private void handleLink(Uri uri){if(!scheme.equals(uri.getScheme()))return;if("auth".equals(uri.getHost())){String code=uri.getQueryParameter("code");if(code!=null&&code.matches("[A-Za-z0-9_-]{10,100}"))pendingCode=code;}else if("payment".equals(uri.getHost())){String order=uri.getQueryParameter("order");if(order!=null&&order.matches("[A-Za-z0-9_-]{1,128}"))pendingOrder=order;}if(web!=null&&ready)deliver();}
  private void deliver(){
    if(!ready||web==null||!own(Uri.parse(web.getUrl())))return;
    if(!pendingCode.isEmpty()){
      String verifier=prefs.getString("verifier","");long since=System.currentTimeMillis()-prefs.getLong("verifierTime",0);String code=pendingCode;pendingCode="";
      if(verifier.isEmpty()||since>900000){Toast.makeText(this,"Login expirou. Inicie novamente no aplicativo.",Toast.LENGTH_LONG).show();return;}
      web.evaluateJavascript("window.completeMobileLogin&&window.completeMobileLogin("+JSONObject.quote(code)+","+JSONObject.quote(verifier)+")",null);prefs.edit().remove("verifier").remove("verifierTime").apply();
    }
    if(!pendingOrder.isEmpty()){String order=pendingOrder;pendingOrder="";web.evaluateJavascript("window.onNativeReturn&&window.onNativeReturn("+JSONObject.quote(order)+")",null);}
  }
  @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);consumeIntent(intent);}
  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==41&&fileCallback!=null){fileCallback.onReceiveValue(resultCode==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}}
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("SamNative");web.destroy();}super.onDestroy();}
}
