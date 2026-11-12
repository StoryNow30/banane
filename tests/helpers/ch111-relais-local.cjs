'use strict';
/* CH-111 — RELAIS SIMULÉ LOCAL (Node, sans dépendance) : le VRAI code de telecommande/worker.js (routes, enveloppes, `CanalLogique`) derrière un
 * petit serveur HTTPS + WebSocket (RFC 6455, trames texte, ping, fermeture). Certificat de test fabriqué à l'exécution (openssl) ; le navigateur
 * des essais l'accepte par --ignore-certificate-errors. Ne sert qu'aux essais : rien d'ici ne part chez Cloudflare. */
const https=require('node:https'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'../..');

/* worker.js est un module ES qui importe la page comme texte (règle « Text » de wrangler) : on remplace cet import par la page elle-même. */
async function chargerWorker(){const src=fs.readFileSync(path.join(racine,'telecommande/worker.js'),'utf8'),page=fs.readFileSync(path.join(racine,'telecommande/telephone.html'),'utf8');
 const ligne="import PAGE from './telephone.html';";if(!src.includes(ligne))throw Error('import de la page introuvable dans worker.js');
 const code=src.replace(ligne,'const PAGE='+JSON.stringify(page)+';');
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}

function certificat(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch111-cert-')),key=path.join(dir,'k.pem'),cert=path.join(dir,'c.pem');
 const r=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{encoding:'utf8'});
 if(r.status!==0)throw Error('openssl : '+(r.stderr||r.error?.message));return {key:fs.readFileSync(key),cert:fs.readFileSync(cert)};}

/* Une connexion WebSocket côté serveur, avec l'interface que `CanalLogique` attend (send, close). */
class Socket{constructor(s){this.s=s;this.ouverte=true;this.tampon=Buffer.alloc(0);this.morceaux=[];this.onmessage=null;this.onclose=null;
  s.on('data',d=>{this.tampon=Buffer.concat([this.tampon,d]);this.lire();});s.on('close',()=>this.fin());s.on('error',()=>this.fin());}
 trame(op,donnees){const n=donnees.length,t=n<126?Buffer.from([0x80|op,n]):n<65536?Buffer.from([0x80|op,126,n>>8,n&255]):(()=>{const b=Buffer.alloc(10);b[0]=0x80|op;b[1]=127;b.writeBigUInt64BE(BigInt(n),2);return b;})();
  this.s.write(Buffer.concat([t,donnees]));}
 send(texte){if(!this.ouverte)throw Error('fermée');this.trame(1,Buffer.from(String(texte)));}
 close(code=1000){if(!this.ouverte)return;const b=Buffer.alloc(2);b.writeUInt16BE(code>=1000&&code<5000?code:1000);try{this.trame(8,b);}catch{}this.s.end();this.fin();}
 fin(){if(!this.ouverte)return;this.ouverte=false;this.onclose?.();}
 lire(){for(;;){const b=this.tampon;if(b.length<2)return;const op=b[0]&15,fin=(b[0]&0x80)!==0,masque=(b[1]&0x80)!==0;let n=b[1]&127,i=2;
  if(n===126){if(b.length<4)return;n=b.readUInt16BE(2);i=4;}else if(n===127){if(b.length<10)return;n=Number(b.readBigUInt64BE(2));i=10;}
  const k=masque?b.subarray(i,i+4):null;if(masque)i+=4;if(b.length<i+n)return;
  const d=Buffer.from(b.subarray(i,i+n));if(k)for(let j=0;j<d.length;j++)d[j]^=k[j&3];this.tampon=b.subarray(i+n);
  if(op===8){this.close();return;}if(op===9){this.trame(10,d);continue;}if(op===10)continue;
  this.morceaux.push(d);if(fin){const texte=Buffer.concat(this.morceaux).toString('utf8');this.morceaux=[];this.onmessage?.(op===2?null:texte);}}}}

/* Le « ctx » d'un Durable Object, en mémoire : sockets étiquetées, stockage. */
function ctxCanal(){const tags=new Map(),stock=new Map();
 return {tags,stock,acceptWebSocket(ws,t){tags.set(ws,t);},getWebSockets(t){return [...tags].filter(([w,x])=>w.ouverte&&(!t||x.includes(t))).map(([w])=>w);},getTags(ws){return tags.get(ws)||[];},
  storage:{get:async k=>stock.get(k),put:async(k,v)=>{stock.set(k,v);}}};}

async function demarrer({port=0}={}){const W=await chargerWorker(),canaux=new Map(),vus=[];
 const canal=id=>{if(!canaux.has(id)){const ctx=ctxCanal();canaux.set(id,{ctx,l:new W.CanalLogique(ctx)});}return canaux.get(id);};
 const serveur=https.createServer(certificat(),async(req,res)=>{
  const url='https://'+req.headers.host+req.url,r=await W.default.fetch(new Request(url,{method:req.method,headers:req.headers}),{CANAL:null});
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));});
 serveur.on('upgrade',async(req,s)=>{const r=W.route('https://'+req.headers.host+req.url);
  if(!r.canal||(req.headers.upgrade||'').toLowerCase()!=='websocket'){s.end('HTTP/1.1 400 Bad Request\r\n\r\n');return;}
  const acc=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+['258EAFA5','E914','47DA','95CA','C5AB0DC85B11'].join('-')/* GUID de la RFC 6455 */).digest('base64');
  s.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  const ws=new Socket(s),C=canal(r.canal);ws.role=r.role;
  ws.onmessage=t=>{vus.push({canal:r.canal,role:r.role,texte:t});void C.l.message(ws,t);};ws.onclose=()=>C.l.fermeture(ws);
  await C.l.accepter(ws,r.role);});
 await new Promise(ok=>serveur.listen(port,'127.0.0.1',ok));
 const adresse='https://127.0.0.1:'+serveur.address().port;
 return {adresse,canaux,vus,W,
  /* Coupe toutes les sockets (le relais « redémarre ») sans fermer le serveur. */
  couperTout(){for(const {ctx} of canaux.values())for(const w of ctx.getWebSockets())w.close(1012);},
  fermer(){for(const {ctx} of canaux.values())for(const w of ctx.getWebSockets())try{w.s.destroy();}catch{}return new Promise(ok=>serveur.close(()=>ok()));}};}
module.exports={demarrer,chargerWorker};
