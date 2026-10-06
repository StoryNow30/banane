'use strict';
/* Fausse page pour les essais de l'observateur passif (VM sans navigateur).
 * Données SYNTHÉTIQUES : aucune capture ni aucun code d'ESV. Une « page »
 * garde le journal de TOUT ce que son propre code fait (appels, valeurs,
 * événements) et le « réseau » garde ce qui part réellement : comparer deux
 * pages, avec et sans observateur, montre que l'observateur ne change rien. */
const {install}=require('../../src/esv-observer.js');
const ORIGIN='https://esv.test',HREF=ORIGIN+'/rails_validation/part';
const tick=()=>new Promise(r=>setImmediate(r));
function world({observe=true,routes=()=>({status:200,text:'{}'}),failPost=false,failTimers=false,document}={}){
 const log=[],network=[],posts=[],listeners=[],observerTimers=[];let clock=0,po=null;
 class XHR{
  constructor(){this.L={};this.status=0;this.readyState=0;this.responseType='';this.responseText='';this.onreadystatechange=null;}
  open(method,url,...rest){log.push(['open',method,String(url),...rest]);if(url==='THROW')throw new Error('open-invalide');this._m=method;this._u=String(url);this.readyState=1;}
  setRequestHeader(k,v){log.push(['setRequestHeader',k,v]);}
  getResponseHeader(k){log.push(['getResponseHeader',k]);return null;}
  getAllResponseHeaders(){log.push(['getAllResponseHeaders']);return '';}
  addEventListener(t,fn){(this.L[t]=this.L[t]||[]).push(fn);}
  fire(t){for(const fn of this.L[t]||[])fn.call(this,{type:t});}
  send(body){if(this.throwOnce){this.throwOnce=false;log.push(['send-leve']);throw new Error('send-invalide-une-fois');}
   log.push(['send',this._m,this._u,body===undefined?null:body]);network.push([this._m,this._u,body===undefined?null:body]);
   if(this._m==='BOOM')throw new Error('send-invalide');
   queueMicrotask(()=>{const r=routes(this._m,this._u,body)||{status:200,text:'{}'};this.status=r.status;this.responseText=r.text??'';this.readyState=4;
    if(this.onreadystatechange)this.onreadystatechange();this.fire('readystatechange');this.fire(r.status===0?'error':'load');this.fire('loadend');});}
 }
 class PO{constructor(cb){this.cb=cb;po=this;}observe(o){this.options=o;}emit(entries){this.cb({getEntries:()=>entries});}}
 const originalFetch=async function fetch(u){log.push(['fetch',String(u)]);network.push(['FETCH',String(u)]);return {status:200};};
 const win={XMLHttpRequest:XHR,fetch:originalFetch,PerformanceObserver:PO,
  performance:{now:()=>{if(failTimers&&clock>5)throw new Error('horloge-en-panne');return clock+=0.5;},timeOrigin:1e12},
  location:{origin:ORIGIN,href:HREF},crypto:{randomUUID:()=>'observer-test'},
  postMessage:(m,o)=>{if(failPost)throw new Error('postMessage-en-panne');posts.push({m,o});},
  addEventListener:(t,fn)=>{listeners.push({t,fn});},
  setTimeout:(fn,ms)=>{if(failTimers)throw new Error('minuterie-en-panne');observerTimers.push({fn,ms});return observerTimers.length;}};
 win.self=win;if(document!==undefined)win.document=document;
 const ctl=observe?install(win):null;
 return {win,XHR,po:()=>po,log,network,posts,observerTimers,ctl,originalFetch,
  runTimers:()=>{while(observerTimers.length){const t=observerTimers.shift();t.fn();}},
  deliver:(data,{source=win,origin=ORIGIN}={})=>{for(const l of listeners)if(l.t==='message')l.fn({source,origin,data});},
  observed:()=>posts.filter(p=>p.m?.kind==='banane5:esv-observation').map(p=>p.m.entry)};
}
/* Script de la page : tout ce qu'ESV pourrait faire, y compris des erreurs. */
async function pageScript(w){
 const {win,log}=w,out=[];
 const call=(label,fn)=>{try{out.push([label,'ok',fn()]);}catch(e){out.push([label,'throw',e.message]);}};
 const xhr=(method,url,body,{headers=true,responseType}={})=>{const x=new win.XMLHttpRequest();
  x.open(method,url,true);if(responseType)x.responseType=responseType;if(headers)x.setRequestHeader('Authorization','Bearer SECRET-TOKEN-123');
  x.addEventListener('loadend',function(){log.push(['page-loadend',this.status]);});x.onreadystatechange=()=>log.push(['page-readystate',x.readyState]);
  x.send(body);return x;};
 const rows=n=>JSON.stringify({value:Array.from({length:n},(_,i)=>({Id:i,Status:['valid','invalid','skipped'][i%3==0?1:i%5==0?2:0],SeenByOperator:i%2===0}))});
 w.rows=rows;
 call('open-invalide',()=>{const x=new win.XMLHttpRequest();x.open('GET','THROW');});
 call('send-invalide',()=>{const x=new win.XMLHttpRequest();x.open('BOOM','https://esv.test/api/x');x.send(null);});
 xhr('PUT',ORIGIN+'/api/u3d/projects/p-secret/rails/traj__00+0071551.725/00071552.685?merge=true',JSON.stringify({a:1.5,b:-2.25,c:0,RailType:'U50',SeenByOperator:true,nested:{x:1},arr:[1],tok:'Bearer '+'a'.repeat(60),['bad key']:3}));
 xhr('GET',ORIGIN+'/api/u3d/projects/p-secret/rails?status=invalid&top=1000&$skiptoken=zzz',undefined,{headers:true});
 xhr('GET','https://login.microsoftonline.com/tenant/oauth2/v2.0/token?client_id=secret-client',null,{headers:false});
 xhr('GET',ORIGIN+'/other/thing?x=1',null);
 call('fetch',()=>win.fetch(ORIGIN+'/api/ept.json'));
 await tick();await tick();
 return out;
}
module.exports={world,pageScript,tick,ORIGIN};
