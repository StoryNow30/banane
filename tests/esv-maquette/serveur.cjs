'use strict';
/*
 * serveur.cjs — serveur local de la maquette ESV : fichiers du dépôt (statique)
 * + « serveur ESV » factice (liste des coupes paginée, écriture de validation).
 * Aucun code ni contenu d'ESV. Rien n'est écrit sur disque.
 *
 *   node tests/esv-maquette/serveur.cjs [port] [--export FICHIER_OU_DOSSIER]   → http://localhost:PORT/tests/esv-maquette/esv.html[?source=export]
 *   (ou BANANE_MAQUETTE_EXPORT=/chemin) : un vrai export d'Ariane devient la partie rejouée (tests/esv-maquette/lecteur-export.cjs)
 *
 * API (chemins relatifs à l'origine, comme ceux qu'Ariane observe) :
 *   GET  /maquette/scenario.json?cuts=12&debut=100&part=23   scénario synthétique (tests/esv-maquette/scenario.cjs)
 *   GET  /maquette/scenario.json?source=export[&part=N]      scénario rejoué depuis l'export chargé
 *   GET  /rails/<table>[?npk=<table>&nrk=<indice>]   liste des coupes par pages de 1 000 lignes chaînées (`suite:{npk,nrk}`, comme l'observe Ariane)
 *   PUT  /rails/<table>/<RowKey>        écriture de validation : corps JSON, réponse 204, journalisée
 *   GET  /maquette/journal              {ecritures:[…], requetes:[…]}
 *   POST /maquette/reset                vide le journal et les statuts modifiés
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const S=require('./scenario.cjs');
const racine=path.resolve(__dirname,'../..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const PAGE=1000;
function demarrer(options={}){
  const journal={ecritures:[],requetes:[]};const scenarios=new Map();const statuts=new Map();
  const exportation=options.exportation||process.env.BANANE_MAQUETTE_EXPORT||null;
  const scenario=q=>{if(q.source==='export'){if(!exportation)throw Error('aucun export chargé (option --export ou BANANE_MAQUETTE_EXPORT)');
      const cle='export|'+(q.part??'')+'|'+(q.valides??'');if(!scenarios.has(cle))scenarios.set(cle,require('./lecteur-export.cjs').construire(exportation,{part:q.part!==undefined?Number(q.part):undefined,valides:q.valides!==undefined?Number(q.valides):0}));return scenarios.get(cle);}
    const cle=JSON.stringify([q.cuts,q.debut,q.part,q.partie2]);if(!scenarios.has(cle))scenarios.set(cle,S.construire(q));return scenarios.get(cle);};
  const tables=()=>[...scenarios.values()].flatMap(s=>s.parties);
  const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
  const serveur=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost'),p=u.pathname,q=Object.fromEntries(u.searchParams);
    journal.requetes.push({methode:req.method,chemin:p+u.search,at:new Date().toISOString()});
    const corps=[];req.on('data',c=>corps.push(c));
    req.on('end',()=>{try{
      if(p==='/favicon.ico'){res.writeHead(204);return res.end();}
      if(p==='/maquette/scenario.json')return json(res,200,scenario(q));
      if(p==='/maquette/journal')return json(res,200,journal);
      if(p==='/maquette/reset'){journal.ecritures.length=0;journal.requetes.length=0;statuts.clear();return json(res,200,{ok:true});}
      let m=/^\/rails\/([^/]+)$/.exec(p);
      if(m&&req.method==='GET'){const t=tables().find(x=>x.table===m[1]);if(!t)return json(res,404,{error:'table inconnue'});
        const depuis=q.npk!==undefined?Math.max(0,Number(q.nrk)||0):0,lignes=S.lignes(t).map(l=>statuts.has(l.RowKey)?{...l,...statuts.get(l.RowKey)}:l);
        const value=lignes.slice(depuis,depuis+PAGE),fin=depuis+PAGE;
        return json(res,200,{value,suite:fin<lignes.length?{npk:t.table,nrk:fin}:null,total:lignes.length});}
      m=/^\/rails\/([^/]+)\/([^/]+)$/.exec(p);
      if(m&&req.method==='PUT'){let body=null;try{body=JSON.parse(Buffer.concat(corps).toString('utf8')||'null');}catch{body={illisible:true};}
        journal.ecritures.push({table:m[1],rowKey:m[2],body,status:204,at:new Date().toISOString()});
        if(body&&typeof body==='object'){const s={};for(const k of ['ExtractionStatus','TreatedByOperator','SeenByOperator','XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'])if(k in body)s[k]=body[k];statuts.set(m[2],{...(statuts.get(m[2])||{}),...s});}
        res.writeHead(204);return res.end();}
      /* statique */
      const fichier=path.normalize(path.join(racine,decodeURIComponent(p==='/'?'/tests/esv-maquette/esv.html':p)));
      if(!fichier.startsWith(racine)||!fs.existsSync(fichier)||fs.statSync(fichier).isDirectory()){res.writeHead(404);return res.end('introuvable');}
      res.writeHead(200,{'content-type':MIME[path.extname(fichier)]||'application/octet-stream','cache-control':'no-store'});
      fs.createReadStream(fichier).pipe(res);
    }catch(e){json(res,500,{error:e.message});}});
  });
  return new Promise((resolve,reject)=>{serveur.on('error',reject);serveur.listen(options.port??0,'127.0.0.1',()=>{const port=serveur.address().port;
    resolve({port,url:`http://127.0.0.1:${port}`,journal,fermer:()=>new Promise(r=>serveur.close(r)),scenario,exportation});});});
}
module.exports={demarrer};
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--export');demarrer({port:Number(a.find(x=>/^\d+$/.test(x))||8124),exportation:i>=0?a[i+1]:null}).then(s=>console.log(`Maquette ESV : ${s.url}/tests/esv-maquette/esv.html${s.exportation?'?source=export':''}`),e=>{console.error(e.message);process.exit(1);});}
