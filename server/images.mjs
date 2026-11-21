import {getStorage} from 'firebase-admin/storage';
import {firebaseServices} from './store.mjs';
import {assert,image,id,now,key} from './domain.mjs';
export class FirebaseImages {
  constructor(store,env){this.store=store;this.env=env;}
  bucket(){assert(this.env.FIREBASE_STORAGE_BUCKET,409,'STORAGE_SETUP','Configure FIREBASE_STORAGE_BUCKET para enviar fotos, ou use uma URL HTTPS de imagem.');return getStorage(firebaseServices(this.env).app).bucket(this.env.FIREBASE_STORAGE_BUCKET);}
  async put(value,uid){
    const checked=image(value);if(!checked.startsWith('data:'))return checked;
    const m=checked.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/),buffer=Buffer.from(m[3],'base64'),kind=m[2];assert(buffer.length<=256000,400,'IMAGE_SIZE','Use uma imagem de até 250 KB.');
    const signature=kind==='jpeg'?buffer.subarray(0,3).equals(Buffer.from([255,216,255])):kind==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
    assert(signature,400,'IMAGE_FORMAT','O arquivo não corresponde ao formato de imagem informado.');
    const imageId=id(),objectPath=`samConecta/images/${key(uid)}/${imageId}.${kind}`;
    await this.bucket().file(objectPath).save(buffer,{resumable:false,metadata:{contentType:m[1],cacheControl:'public,max-age=86400'}});
    await this.store.set('publicImages',imageId,{objectPath,contentType:m[1],size:buffer.length,createdAt:now()});return `/api/images/${imageId}`;
  }
  async read(imageId){
    const record=await this.store.get('publicImages',key(imageId));assert(record,404,'IMAGE_NOT_FOUND','Imagem não encontrada.');
    const [buffer]=await this.bucket().file(record.objectPath).download();return new Response(buffer,{headers:{'Content-Type':record.contentType,'Content-Length':String(buffer.length),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
}
