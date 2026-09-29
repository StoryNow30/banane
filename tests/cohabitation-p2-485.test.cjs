'use strict';
/* D-062, P2 (version de test 2) — cohabitation poussée.
 * 1. ENTRELACEMENT CONTRÔLÉ de deux installations d'Ariane (deux identifiants
 *    d'extension) qui se connectent au même onglet : chaque injection
 *    (sonde et tampon, fichiers de la page, bridge) attend son tour ; les 20
 *    ordres de libération sont joués. Une installation refusée s'arrête (dès
 *    sa sonde, le plus souvent) : les entrelacements réellement joués sont
 *    relevés et comptés. Invariant : une seule se connecte, elle est
 *    propriétaire de l'adaptateur, l'autre reçoit un refus définitif qui la
 *    nomme. Les fichiers de la page sont simulés (règles de
 *    src/adapter-page.js, éprouvées sur l'adaptateur réel dans
 *    cohabitation-485 et revue-globale-485).
 * La reprise complète après une intrusion : tests/reprise-intrusion-485.test.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');
const K=require('../src/core.js');

/* Monde principal de l'onglet, partagé par les deux extensions ; les fichiers de
 * la page s'y comportent comme `src/adapter-page.js` : marqueur tiré du tampon,
 * tampon effacé ; adaptateur déjà là → tampon effacé, rien d'autre. Le ping
 * répond comme l'adaptateur réel : à son propriétaire, sinon refus nommé. */
function scenario(ordre){const fenetre={},attentes={A:[],B:[]},faits=[];
  const tour=nom=>new Promise(r=>attentes[nom].push(r));
  const installation=(nom,id)=>{
    const executeScript=async o=>{await tour(nom);const etape=o.func?'sonde':o.world==='ISOLATED'?'bridge':'fichiers';faits.push(nom+':'+etape);
      if(o.func)return [{frameId:0,result:vm.runInNewContext(`(${o.func})(...args)`,{window:fenetre,args:o.args||[]})}];
      if(o.files?.includes('src/adapter-page.js')){if(!fenetre.__BANANE_V3_PAGE){const t=fenetre.__ARIANE_PROPRIETAIRE;
          fenetre.__BANANE_V3_PAGE=Object.freeze({version:t?.version??K.VERSION,versionName:t?.versionName??null,proprietaire:typeof t?.id==='string'?t.id:null});}
        delete fenetre.__ARIANE_PROPRIETAIRE;}
      return [{frameId:0,result:undefined}];};
    const b=background({shadow:shadowHarness(),executeScript,runtimeId:id});
    b.adapter.ping=async()=>{const m=fenetre.__BANANE_V3_PAGE;if(!m)throw Error('Could not establish connection. Receiving end does not exist.');
      if(m.proprietaire!==id)throw Error(`Une autre Ariane (${m.versionName||m.version}) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV.`);
      return {version:m.version,versionName:m.versionName,pageId:'p',proprietaire:id,intrusion:null};};
    return b;};
  const A=installation('A','ext-a'),B=installation('B','ext-b');
  return {fenetre,faits,run:async()=>{
    const fin={A:null,B:null},res={};
    for(const [nom,b] of [['A',A],['B',B]])res[nom]=b.api('connect',{tabId:1}).then(()=>({ok:true}),e=>({erreur:e.message})).finally(()=>{fin[nom]=true;});
    /* L'ordonnanceur libère une injection à la fois, dans l'ordre donné ; une
     * installation qui a fini (connectée ou refusée) laisse passer son tour. */
    const attendre=()=>new Promise(r=>setImmediate(r));
    for(const nom of ordre){for(let i=0;i<200&&!attentes[nom].length&&!fin[nom];i++)await attendre();
      if(attentes[nom].length)attentes[nom].shift()();}
    for(let i=0;i<400&&!(fin.A&&fin.B);i++){for(const n of ['A','B'])if(attentes[n].length)attentes[n].shift()();await attendre();}
    return {A:await res.A,B:await res.B};}};}
/* Tous les ordres de trois injections par installation : C(6,3) = 20. */
function ordres(){const out=[];(function rec(s,a,b){if(!a&&!b){out.push(s);return;}if(a)rec(s+'A',a-1,b);if(b)rec(s+'B',a,b-1);})('',3,3);return out;}

test('entrelacement contrôlé de deux installations : 20 ordres de libération, une seule connectée, l’autre refusée en la nommant',async()=>{
  const vus=new Set(),joues=new Set();
  for(const ordre of ordres()){const s=scenario(ordre),r=await s.run();
    const connectees=['A','B'].filter(n=>r[n].ok);
    assert.equal(connectees.length,1,`${ordre} : ${JSON.stringify(r)} (${s.faits.join(' ')})`);
    const gagnante=connectees[0],autre=gagnante==='A'?'B':'A',id={A:'ext-a',B:'ext-b'};
    assert.equal(s.fenetre.__BANANE_V3_PAGE?.proprietaire,id[gagnante],`${ordre} : l’adaptateur est à la connectée`);
    assert.match(r[autre].erreur,/Une autre Ariane \(4\.8\.6 test 1\) est active dans cet onglet/,`${ordre} : refus nommé`);
    vus.add(gagnante);joues.add(s.faits.join(' '));}
  assert.equal(vus.size,2,'chacune gagne selon l’ordre : aucune n’est favorisée par construction');
  /* Entrelacements distincts réellement joués (la perdante s'arrête tôt) : 6 aujourd'hui. */
  assert.ok(joues.size>=6,`${joues.size} entrelacements distincts : ${[...joues].join(' | ')}`);
  assert.ok([...joues].some(j=>/A:sonde B:sonde/.test(j))&&[...joues].some(j=>/B:sonde A:sonde/.test(j)),'sondes croisées jouées dans les deux sens');
});

