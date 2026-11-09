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
 *   GET  /maquette/ept/ept-data/<D-X-Y-Z>.bin   CH-077 : nœud EPT par adresse, en-tête de cache réglable (pannes eptCache, eptLatenceMs, eptOctets)
 *   GET/POST /maquette/pannes              pannes simulées (JSON ; POST remplace) : ecritureRefusee {cuts|'toutes', http}, ecritureLenteMs,
 *        listeIllisible, railsAbsents {cuts}, nuageInstable {cuts, dureeMs}, nuageVide {cuts}, nuageSansPoints {cuts} (CH-051 : les nœuds
 *        arrivent, mais sans aucun point près des rails, comme pendant le blocage du chargeur d'ESV du 04/11), changementPartie {apresCut}
 *   GET  /maquette/journal              {ecritures:[…], requetes:[…], refus:[…]}
 *   POST /maquette/reset                vide le journal et les statuts modifiés
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const S=require('./scenario.cjs');
const racine=path.resolve(__dirname,'../..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const PAGE=1000;
function demarrer(options={}){
  const journal={ecritures:[],requetes:[],refus:[],ept:{}};const scenarios=new Map(),idScenario=new Map();const statuts=new Map();let pannes={},lecturesListe=0;
  const concerne=(regle,cut)=>!!regle&&(regle.cuts==='toutes'||Array.isArray(regle.cuts)&&regle.cuts.includes(cut));
  /* Règles de panne normalisées une fois (numéros de cut en nombres, http en nombre, listeIllisible → {apres}) : la page reçoit la forme normalisée. */
  const normaliser=p=>{const out={};for(const [k,v] of Object.entries(p||{})){if(v===null||v===undefined||v===false)continue;
    if(k==='listeIllisible'){out[k]=v===true?{apres:1}:{apres:Number(v.apres??1)};continue;}
    if(k==='ecritureLenteMs'||k==='eptLatenceMs'||k==='eptOctets'){out[k]=Number(v)||0;continue;}
    if(k==='eptCache'){out[k]=String(v);continue;}
    const r=typeof v==='object'?{...v}:{};if(r.cuts!=='toutes'&&r.cuts!==undefined)r.cuts=[].concat(r.cuts).map(Number).filter(Number.isFinite);
    if('http' in r)r.http=Number(r.http);if('apresCut' in r)r.apresCut=Number(r.apresCut);if('dureeMs' in r)r.dureeMs=Number(r.dureeMs)||0;out[k]=r;}
    return out;};
  /* Le scénario servi à la page ne porte pas les nœuds (chargés par cut) : squelette + comptes. */
  const squelette=(s,id)=>({...s,parties:s.parties.map(p=>({...p,cuts:p.cuts.map(({noeuds,...c})=>({...c,points:{noeuds:noeuds.length,n:noeuds.reduce((a,x)=>a+x.positions.length/3,0)},noeudsUrl:`/maquette/ept-data/${id}/${p.part}/${c.cut}/noeuds.json`}))}))});
  const exportation=options.exportation||process.env.BANANE_MAQUETTE_EXPORT||null;
  const garder=(cle,fabrique)=>{if(!scenarios.has(cle)){scenarios.set(cle,fabrique());idScenario.set(cle,'s'+idScenario.size);}return {scenario:scenarios.get(cle),id:idScenario.get(cle)};};
  const scenario=q=>{if(q.source==='export'){if(!exportation)throw Error('aucun export chargé (option --export ou BANANE_MAQUETTE_EXPORT)');
      return garder('export|'+(q.part??'')+'|'+(q.valides??''),()=>require('./lecteur-export.cjs').construire(exportation,{part:q.part!==undefined?Number(q.part):undefined,valides:q.valides!==undefined?Number(q.valides):0}));}
    /* CH-080 : scénario « saut » (une coupe à faire toutes les N), gardé à part (ligne suivante inchangée : ancre de tools/relecture-maquette.cjs). */
    if(q.saut!==undefined)return garder('saut|'+JSON.stringify([q.cuts,q.debut,q.part,q.partie2,q.parties,q.saut,q.grappe,q.pas]),()=>S.construire(q));
    return garder(JSON.stringify([q.cuts,q.debut,q.part,q.partie2,...(q.parties!==undefined?[q.parties]:[])]),()=>S.construire(q));};
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
        /* nuageSansPoints : chaque nœud ne garde que ses trois points de remplissage loin des rails (ceux qu'un nœud vide a déjà, tests/esv-maquette/scenario.cjs) :
         * la page a des nœuds, la capture d'Ariane n'a aucun point dans la découpe. */
        const sansPoints=c.noeuds.map((n,i)=>({source:n.source,positions:[12+i,20,-3, 12.5+i,20.5,-3.2, 13+i,21,-2.8],intensite:[],classe:[]}));
        return json(res,200,{part,cut,noeuds:concerne(pannes.nuageVide,cut)?[]:concerne(pannes.nuageSansPoints,cut)?sansPoints:c.noeuds});}
      /* CH-077 : nœud EPT par adresse (comme les `ept-data` de Potree) : corps fixe de `eptOctets` (64 Kio), après `eptLatenceMs` (60 ms), avec l'en-tête
       * de cache `eptCache` (défaut « public, max-age=3600 » ; « no-store » pour l'essai négatif). Le journal compte les requêtes par nœud (`ept`). */
      /* CH-085 (lot « Vision 7 », ÉTABLI : nos fetch reçoivent 401, ceux de Potree 200) : panne `eptAuth` : nœuds et pages de hiérarchie exigent l'en-tête
       * `x-esv-jeton` que seul le Potree simulé de la page envoie (comme ESV authentifie ses propres requêtes) ; sans lui, 401, compté (`refusEpt`). */
      if(pannes.eptAuth&&/^\/maquette\/ept(?:\/p\d+)?\/ept-(?:data|hierarchy)\//.test(p)&&req.headers['x-esv-jeton']!=='1'){journal.refusEpt=(journal.refusEpt||0)+1;res.writeHead(401,{'content-type':'text/plain','cache-control':'no-store'});return res.end('non autorisé');}
      m=/^\/maquette\/ept(?:\/p\d+)?\/ept-data\/(\d+-\d+-\d+-\d+)\.(?:bin|laz)$/.exec(p);   /* CH-080c : .laz (EptLaszipLoader) */
      if(m&&req.method==='GET'){journal.ept[m[1]]=(journal.ept[m[1]]||0)+1;const n=Number(pannes.eptOctets)||65536,lat=pannes.eptLatenceMs!==undefined?Number(pannes.eptLatenceMs):60;
        return setTimeout(()=>{res.writeHead(200,{'content-type':'application/octet-stream','content-length':n,'cache-control':pannes.eptCache||'public, max-age=3600'});res.end(Buffer.alloc(n,7));},lat);}
      /* CH-080 : fichier de hiérarchie EPT (comme `ept-hierarchy/<clé>.json` de Potree 1.8) : la clé et ses descendants sur `eptPas` niveaux (2), jusqu'à
       * `eptProfondeur` (7) ; les clés du dernier niveau valent −1 (sous-hiérarchie dans un autre fichier) sauf au fond de l'arbre. Mêmes latence et cache que les
       * nœuds ; journal `eptHier`. */
      /* CH-080c : `…/ept/p<N>/…` : pas de N niveaux par fichier (p7 : toute la hiérarchie dans la page racine, comme ESV pendant le lot du 09/11). */
      m=/^\/maquette\/ept(?:\/p(\d+))?\/ept-hierarchy\/(\d+)-(\d+)-(\d+)-(\d+)\.json$/.exec(p);
      if(m&&req.method==='GET'){const pasUrl=m[1];m=[m[0],...m.slice(2)];const [d,x,y,z]=m.slice(1).map(Number),pas=Number(pasUrl)||Number(pannes.eptPas)||2,prof=Number(pannes.eptProfondeur)||7,h={};
        journal.eptHier=journal.eptHier||{};journal.eptHier[m.slice(1).join('-')]=(journal.eptHier[m.slice(1).join('-')]||0)+1;
        /* Clés du COULOIR des coupes seulement (à 4 m de la ligne des cuts, cube de 128 m autour de l'origine du monde, comme la hiérarchie synthétique de la page) :
         * un pas de 7 niveaux reste petit. Hors couloir, Potree ne les visite jamais. */
        const sc=[...scenarios.values()][0],O=sc?.monde?.origine,Dir=sc?.monde?.direction,m0=O?O.map(v=>v-64):null;
        const dansCouloir=(dd,xx,yy,zz)=>{if(!O)return true;const t=128/2**dd,c=[m0[0]+(xx+.5)*t,m0[1]+(yy+.5)*t,m0[2]+(zz+.5)*t].map((v,i)=>v-O[i]),u=c[0]*Dir[0]+c[1]*Dir[1]+c[2]*Dir[2];
          return Math.hypot(c[0]-u*Dir[0],c[1]-u*Dir[1],c[2]-u*Dir[2])<=4+t*0.87;};
        const ajouter=(dd,xx,yy,zz,r)=>{if(!dansCouloir(dd,xx,yy,zz))return;h[`${dd}-${xx}-${yy}-${zz}`]=r===pas&&dd<prof?-1:1000;
          if(r<pas&&dd<prof)for(const a of [0,1])for(const b of [0,1])for(const c of [0,1])ajouter(dd+1,2*xx+a,2*yy+b,2*zz+c,r+1);};
        ajouter(d,x,y,z,0);
        const corpsH=JSON.stringify(h),lat=pannes.eptLatenceMs!==undefined?Number(pannes.eptLatenceMs):60;
        return setTimeout(()=>{res.writeHead(200,{'content-type':'application/json','content-length':Buffer.byteLength(corpsH),'cache-control':pannes.eptCache||'public, max-age=3600'});res.end(corpsH);},lat);}
      if(p==='/maquette/pannes'){if(req.method==='POST'){let brut;try{brut=JSON.parse(Buffer.concat(corps).toString('utf8')||'{}');}catch(e){return json(res,400,{error:'pannes : JSON invalide'});}
          pannes=normaliser(brut);journal.refus.length=0;lecturesListe=0;}
        return json(res,200,pannes);}
      if(p==='/maquette/journal')return json(res,200,journal);
      if(p==='/maquette/reset'){journal.ecritures.length=0;journal.requetes.length=0;journal.refus.length=0;journal.ept={};statuts.clear();pannes={};lecturesListe=0;return json(res,200,{ok:true});}
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
    resolve({port,url:'http://127.0.0.1:'+port,journal,fermer:()=>new Promise(r=>serveur.close(r)),scenario:q=>scenario(q).scenario,exportation,pannes:p=>{pannes=normaliser(p);journal.refus.length=0;lecturesListe=0;return pannes;}});});});
}
module.exports={demarrer};
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--export');demarrer({port:Number(a.find(x=>/^\d+$/.test(x))||8124),exportation:i>=0?a[i+1]:null}).then(s=>console.log(`Maquette ESV : ${s.url}/tests/esv-maquette/esv.html${s.exportation?'?source=export':''}`),e=>{console.error(e.message);process.exit(1);});}
