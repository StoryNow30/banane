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
 *   GET  /maquette/ept-data/<part>/<cut>/noeuds.json   nœuds de points d'un cut (chargés par la page AU CHARGEMENT DU CUT, comme
 *        Potree charge ses nœuds ; le chemin `ept-data` est celui que l'observateur 4.9 classe « ressource de points »)
 *   GET/POST /maquette/pannes              pannes simulées (JSON ; POST remplace) : ecritureRefusee {cuts|'toutes', http}, ecritureLenteMs,
 *        listeIllisible, railsAbsents {cuts}, nuageInstable {cuts, dureeMs}, nuageVide {cuts}, changementPartie {apresCut}
 *   GET  /maquette/journal              {ecritures:[…], requetes:[…], refus:[…]}
 *   POST /maquette/reset                vide le journal et les statuts modifiés
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const S=require('./scenario.cjs');
const racine=path.resolve(__dirname,'../..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const PAGE=1000;
function demarrer(options={}){
  const journal={ecritures:[],requetes:[],refus:[]};const scenarios=new Map(),idScenario=new Map();const statuts=new Map();let pannes={},lecturesListe=0;
  const concerne=(regle,cut)=>!!regle&&(regle.cuts==='toutes'||Array.isArray(regle.cuts)&&regle.cuts.includes(cut));
  /* Règles de panne normalisées une fois (numéros de cut en nombres, http en nombre, listeIllisible → {apres}) : la page reçoit la forme normalisée. */
  const normaliser=p=>{const out={};for(const [k,v] of Object.entries(p||{})){if(v===null||v===undefined||v===false)continue;
    if(k==='listeIllisible'){out[k]=v===true?{apres:1}:{apres:Number(v.apres??1)};continue;}
    if(k==='ecritureLenteMs'){out[k]=Number(v)||0;continue;}
    const r=typeof v==='object'?{...v}:{};if(r.cuts!=='toutes'&&r.cuts!==undefined)r.cuts=[].concat(r.cuts).map(Number).filter(Number.isFinite);
    if('http' in r)r.http=Number(r.http);if('apresCut' in r)r.apresCut=Number(r.apresCut);if('dureeMs' in r)r.dureeMs=Number(r.dureeMs)||0;out[k]=r;}
    return out;};
  /* Le scénario servi à la page ne porte pas les nœuds (chargés par cut) : squelette + comptes. */
  const squelette=(s,id)=>({...s,parties:s.parties.map(p=>({...p,cuts:p.cuts.map(({noeuds,...c})=>({...c,points:{noeuds:noeuds.length,n:noeuds.reduce((a,x)=>a+x.positions.length/3,0)},noeudsUrl:`/maquette/ept-data/${id}/${p.part}/${c.cut}/noeuds.json`}))}))});
  const exportation=options.exportation||process.env.BANANE_MAQUETTE_EXPORT||null;
  const garder=(cle,fabrique)=>{if(!scenarios.has(cle)){scenarios.set(cle,fabrique());idScenario.set(cle,'s'+idScenario.size);}return {scenario:scenarios.get(cle),id:idScenario.get(cle)};};
  const scenario=q=>{if(q.source==='export'){if(!exportation)throw Error('aucun export chargé (option --export ou BANANE_MAQUETTE_EXPORT)');
      return garder('export|'+(q.part??'')+'|'+(q.valides??''),()=>require('./lecteur-export.cjs').construire(exportation,{part:q.part!==undefined?Number(q.part):undefined,valides:q.valides!==undefined?Number(q.valides):0}));}
    return garder(JSON.stringify([q.cuts,q.debut,q.part,q.partie2]),()=>S.construire(q));};
  const tables=()=>[...scenarios.values()].flatMap(s=>s.parties);
  const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
  const serveur=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost'),p=u.pathname,q=Object.fromEntries(u.searchParams);
    journal.requetes.push({methode:req.method,chemin:p+u.search,at:new Date().toISOString()});
    const corps=[];req.on('data',c=>corps.push(c));
    req.on('end',()=>{try{
      if(p==='/favicon.ico'){res.writeHead(204);return res.end();}
      if(p==='/maquette/scenario.json'){const {scenario:s,id}=scenario(q);return json(res,200,q.inline==='1'?s:squelette(s,id));}
      let m=/^\/maquette\/ept-data\/(s\d+)\/(\d+)\/(\d+)\/noeuds\.json$/.exec(p);
      if(m){const cle=[...idScenario].find(([,id])=>id===m[1])?.[0],s=cle!==undefined?scenarios.get(cle):null,part=Number(m[2]),cut=Number(m[3]);
        const c=s?.parties.find(x=>x.part===part)?.cuts.find(x=>x.cut===cut);if(!c)return json(res,404,{error:'cut inconnu pour ce scénario'});
        return json(res,200,{part,cut,noeuds:concerne(pannes.nuageVide,cut)?[]:c.noeuds});}
      if(p==='/maquette/pannes'){if(req.method==='POST'){let brut;try{brut=JSON.parse(Buffer.concat(corps).toString('utf8')||'{}');}catch(e){return json(res,400,{error:'pannes : JSON invalide'});}
          pannes=normaliser(brut);journal.refus.length=0;lecturesListe=0;}
        return json(res,200,pannes);}
      if(p==='/maquette/journal')return json(res,200,journal);
      if(p==='/maquette/reset'){journal.ecritures.length=0;journal.requetes.length=0;journal.refus.length=0;statuts.clear();pannes={};lecturesListe=0;return json(res,200,{ok:true});}
      m=/^\/rails\/([^/]+)$/.exec(p);
      if(m&&req.method==='GET'){const t=tables().find(x=>x.table===m[1]);if(!t)return json(res,404,{error:'table inconnue'});
        /* listeIllisible {apres:N} : les N premières lectures de liste réussissent (le démarrage de la page), les suivantes rendent du texte illisible. */
        if(pannes.listeIllisible&&++lecturesListe>pannes.listeIllisible.apres){journal.refus.push({table:m[1],liste:true,at:new Date().toISOString()});res.writeHead(200,{'content-type':'application/json'});return res.end('<html>liste indisponible</html>');}
        const depuis=q.npk!==undefined?Math.max(0,Number(q.nrk)||0):0,lignes=S.lignes(t).map(l=>statuts.has(l.RowKey)?{...l,...statuts.get(l.RowKey)}:l);
        const value=lignes.slice(depuis,depuis+PAGE),fin=depuis+PAGE;
        return json(res,200,{value,suite:fin<lignes.length?{npk:t.table,nrk:fin}:null,total:lignes.length});}
      m=/^\/rails\/([^/]+)\/([^/]+)$/.exec(p);
      if(m&&req.method==='PUT'){let body=null;try{body=JSON.parse(Buffer.concat(corps).toString('utf8')||'null');}catch{body={illisible:true};}
        const cut=Number(String(m[2]).split('-').pop()),refus=pannes.ecritureRefusee;
        const repondre=()=>{if(concerne(refus,cut)){const http=refus.http===0?0:(Number.isFinite(refus.http)?refus.http:500);journal.refus.push({table:m[1],rowKey:m[2],http,at:new Date().toISOString()});
            if(http===0){req.socket.setTimeout(0);return;} /* jamais de réponse : délai côté page */
            res.writeHead(http,{'content-type':'application/json'});return res.end(JSON.stringify({error:'écriture refusée (panne simulée)'}));}
          journal.ecritures.push({table:m[1],rowKey:m[2],body,status:204,at:new Date().toISOString()});
          if(body&&typeof body==='object'){const s={};for(const k of ['ExtractionStatus','TreatedByOperator','SeenByOperator','XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'])if(k in body)s[k]=body[k];statuts.set(m[2],{...(statuts.get(m[2])||{}),...s});}
          res.writeHead(204);res.end();};
        const lent=Number(pannes.ecritureLenteMs)||0;if(lent>0)setTimeout(repondre,lent);else repondre();return;}

      /* statique */
      const fichier=path.normalize(path.join(racine,decodeURIComponent(p==='/'?'/tests/esv-maquette/esv.html':p)));
      if(!fichier.startsWith(racine)||!fs.existsSync(fichier)||fs.statSync(fichier).isDirectory()){res.writeHead(404);return res.end('introuvable');}
      res.writeHead(200,{'content-type':MIME[path.extname(fichier)]||'application/octet-stream','cache-control':'no-store'});
      fs.createReadStream(fichier).pipe(res);
    }catch(e){json(res,500,{error:e.message});}});
  });
  return new Promise((resolve,reject)=>{serveur.on('error',reject);serveur.listen(options.port??0,'127.0.0.1',()=>{const port=serveur.address().port;
    resolve({port,url:`http://127.0.0.1:${port}`,journal,fermer:()=>new Promise(r=>serveur.close(r)),scenario:q=>scenario(q).scenario,exportation,pannes:p=>{pannes=normaliser(p);journal.refus.length=0;lecturesListe=0;return pannes;}});});});
}
module.exports={demarrer};
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--export');demarrer({port:Number(a.find(x=>/^\d+$/.test(x))||8124),exportation:i>=0?a[i+1]:null}).then(s=>console.log(`Maquette ESV : ${s.url}/tests/esv-maquette/esv.html${s.exportation?'?source=export':''}`),e=>{console.error(e.message);process.exit(1);});}
