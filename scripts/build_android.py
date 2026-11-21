#!/usr/bin/env python3
"""Compila os dois canais sem dependências Java externas. Requer JDK 17+ e Android SDK 35."""
import argparse, os, pathlib, shutil, subprocess, zipfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
def run(args,env=None):
    subprocess.run([str(x) for x in args],check=True,env=env)
def main():
    p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT'));p.add_argument('--java-home',default=os.environ.get('JAVA_HOME'));p.add_argument('--keystore',required=True);p.add_argument('--alias',default='samconecta');p.add_argument('--output',default=str(ROOT.parent/'deliverables'));args=p.parse_args()
    if not args.sdk or not args.java_home:p.error('Informe --sdk e --java-home ou ANDROID_HOME/JAVA_HOME.')
    if not os.environ.get('ANDROID_STORE_PASSWORD'):p.error('Defina ANDROID_STORE_PASSWORD no ambiente (nunca na linha de comando).')
    sdk=pathlib.Path(args.sdk);java=pathlib.Path(args.java_home)/'bin';bt=sdk/'build-tools'/'35.0.0';jar=sdk/'platforms'/'android-35'/'android.jar';out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True);ext='.exe' if os.name=='nt' else ''
    env=os.environ.copy();env['JAVA_HOME']=str(args.java_home);env['PATH']=str(java)+os.pathsep+env.get('PATH','');env.setdefault('ANDROID_KEY_PASSWORD',env['ANDROID_STORE_PASSWORD'])
    for admin in [False,True]:
        channel='ADM' if admin else 'USUARIO';package='br.com.samconecta.adm' if admin else 'br.com.samconecta.app';label='SAM CONECTA ADM' if admin else 'SAM CONECTA';scheme='samconecta-adm' if admin else 'samconecta';build=ROOT/'android'/'build'/channel
        if build.exists():shutil.rmtree(build)
        (build/'res').mkdir(parents=True);shutil.copytree(ROOT/'android'/'res',build/'res',dirs_exist_ok=True);(build/'gen').mkdir();(build/'classes').mkdir();(build/'dex').mkdir()
        (build/'res'/'values'/'config.xml').write_text('<resources><string name="app_name">'+label+'</string></resources>')
        manifest=(ROOT/'android'/'AndroidManifest.xml').read_text().replace('package="br.com.samconecta.app"','package="'+package+'"').replace('${appScheme}',scheme);(build/'AndroidManifest.xml').write_text(manifest)
        (build/'gen'/'BuildConfig.java').write_text('package br.com.samconecta.app; public final class BuildConfig { public static final boolean IS_ADMIN = '+str(admin).lower()+'; }')
        run([bt/('aapt2'+ext),'compile','--dir',build/'res','-o',build/'res.zip'],env)
        run([bt/('aapt2'+ext),'link','-o',build/'resources.apk','-I',jar,'--manifest',build/'AndroidManifest.xml','--java',build/'gen','--custom-package','br.com.samconecta.app','--min-sdk-version','23','--target-sdk-version','35','--version-code','1','--version-name','0.1.0',build/'res.zip'],env)
        sources=list((ROOT/'android'/'src').rglob('*.java'))+list((build/'gen').rglob('*.java'))
        run([java/('javac'+ext),'-encoding','UTF-8','--release','8','-classpath',jar,'-d',build/'classes',*sources],env)
        with zipfile.ZipFile(build/'classes.jar','w',zipfile.ZIP_DEFLATED) as z:
            for f in (build/'classes').rglob('*.class'):z.write(f,f.relative_to(build/'classes'))
        run([java/('java'+ext),'-cp',bt/'lib'/'d8.jar','com.android.tools.r8.D8','--min-api','23','--lib',jar,'--output',build/'dex',build/'classes.jar'],env)
        shutil.copy2(build/'resources.apk',build/'unsigned.apk')
        with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
            for f in (build/'dex').glob('*.dex'):z.write(f,f.name)
        run([bt/('zipalign'+ext),'-f','4',build/'unsigned.apk',build/'aligned.apk'],env)
        apk=out/f'SAM-CONECTA-{channel}-0.1.0.apk'
        run([java/('java'+ext),'-jar',bt/'lib'/'apksigner.jar','sign','--ks',args.keystore,'--ks-key-alias',args.alias,'--ks-pass','env:ANDROID_STORE_PASSWORD','--key-pass','env:ANDROID_KEY_PASSWORD','--out',apk,build/'aligned.apk'],env)
        run([java/('java'+ext),'-jar',bt/'lib'/'apksigner.jar','verify','--verbose',apk],env)
        run([bt/('zipalign'+ext),'-c','4',apk],env)
        print(f'Gerado: {apk.name} ({apk.stat().st_size} bytes)')
if __name__=='__main__':main()
