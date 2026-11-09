'use strict';
/* CH-079 (D-308) — NEUF CUTS VALIDÉS FAUX, CAS DE CONTRÔLE PERMANENTS. Le corpus (un fichier par cut : capture, appuis, décisions enregistrées, pose d'Ariane, écart de
 * l'opérateur) vit dans le dépôt de données, jamais ici ; `CH079_CORPUS=<dossier>` le désigne, sans elle l'essai se saute (comme les autres corpus privés).
 * Il rejoue le moteur et la décision du lot (`LotDecision.decideCut`) sur chaque capture, rapporte par cut l'écart de la pose rejouée à la pose de l'opérateur, et ÉCHOUE
 * si une version pose plus faux qu'aujourd'hui (écart actuel enregistré dans le corpus, tolérance 1 mm). Ne plus poser un cut faux n'est jamais un échec.
 * Seuls 220, 360 et 361 (étages « first-pass » et « choice ») sont rejouables en entier : les six autres sont posés par la décision L1-e (GCV2) après un différé du
 * lot, qui dépend de l'état du lot (voisins, poses transportées, zones) absent d'un petit corpus ; leur pose enregistrée sert de témoin, et la garde et le serrage
 * en ombre sont appliqués dessus. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const DOSSIER=process.env.CH079_CORPUS,TOL_MM=1;
const saute=!DOSSIER||!fs.existsSync(DOSSIER)?'CH079_CORPUS absent : corpus privé non fourni (dépôt banane-data)':false;
const L=require('../src/lot-decision.js'),K=require('../src/core.js'),Shadow=require('../src/gcv1-shadow.js'),V=require('../src/voie-recentree.js');
const G=require('../src/garde-voie-ombre.js'),S=require('../src/serrage-lot-ombre.js');
const SIDES=['left','right'],FR={left:'gauche',right:'droite'};
const arr=v=>Math.round(v*100)/100;
/* Pose de l'opérateur dans le repère profil de chaque rail : pose d'Ariane + écart enregistré. */
const cible=(c,s)=>{const l=V.localMm(c.capture.rails[s],c.poseAriane[s]),h=c.humain[FR[s]];return [l[0]+h.longitudinalMm,l[1]+h.lateralMm,l[2]+h.verticalMm];};
const ecartA=(c,positions)=>Math.max(...SIDES.map(s=>{const l=V.localMm(c.capture.rails[s],positions[s]),t=cible(c,s);return Math.hypot(l[0]-t[0],l[1]-t[1],l[2]-t[2]);}));
/* Table décompactée de la liste vue du cut : seulement ses voisins validés avant lui (écartements enregistrés, en 1/10 mm). */
function tableVoisins(c){const g=c.voisinsEcartementsMm,n=c.cut+1,st=new Array(n).fill(1),fl=new Array(n).fill(0),ed=new Array(6*n).fill(null);
  g.forEach((mm,j)=>{const i=c.cut-g.length+j;st[i]=0;ed[6*i+1]=-mm*5;ed[6*i+4]=mm*5;ed[6*i]=ed[6*i+3]=ed[6*i+2]=ed[6*i+5]=0;});return {n,st,fl,ed};}
const lire=()=>fs.readdirSync(DOSSIER).filter(f=>/^cut-\d+-\d+\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(DOSSIER,f),'utf8')));
const rejouer=c=>{const cap=c.capture,identity=K.completeIdentity(cap.identity),science=Shadow.scientificProposeBoth(cap);
  return L.decideCut({capture:{identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes},science:{rails:science.rails,summary:science.summary},anchors:c.appuis,Shadow});};

test('corpus : neuf cuts, trois de mauvaise voie et six d\'imprécision',{skip:saute},()=>{
  const cs=lire();assert.equal(cs.length,9);
  assert.deepEqual(cs.filter(c=>c.famille==='mauvaise-voie').map(c=>c.cut),[220,360,361]);
  for(const c of cs){assert.equal(c.format,'ch079-cas-controle-v1');assert.ok(c.ecartActuelMm>=5&&c.ecartActuelMm<=180,`écart actuel du ${c.cut}`);}
});
test('moteur et lot rejoués : aucun cut ne se pose plus faux qu\'aujourd\'hui',{skip:saute},t=>{
  const lignes=[];
  for(const c of lire()){
    const rejouable=c.lotEnregistre.stage!=='deferred',d=rejouer(c);let ecart=null,statut;
    if(rejouable){
      assert.equal(d.stage,c.lotEnregistre.stage,`cut ${c.cut} : l'étage du lot a changé (enregistré ${c.lotEnregistre.stage}, rejoué ${d.stage}) ; relire le cas`);
      const fidele=SIDES.every(s=>Math.hypot(...d.positions[s].map((v,i)=>v-c.lotEnregistre.positions[s][i]))*1000<=TOL_MM);
      ecart=ecartA(c,d.positions);statut=fidele?'rejoué fidèle':'rejoué, pose différente de l\'enregistrée';
      assert.ok(ecart<=c.ecartActuelMm+TOL_MM,`cut ${c.cut} : posé plus faux (${arr(ecart)} mm contre ${c.ecartActuelMm} mm aujourd'hui)`);
    }else{
      assert.equal(d.stage,'deferred',`cut ${c.cut} : le lot posait un cut que L1-e posait ; relire le cas`);
      statut='différé par le lot, posé par L1-e (témoin enregistré)';ecart=c.ecartActuelMm;
    }
    lignes.push(`${String(c.cut).padStart(3)} ${c.famille.padEnd(13)} écart à l'opérateur ${String(arr(ecart)).padStart(7)} mm (aujourd'hui ${String(c.ecartActuelMm).padStart(7)}) — ${statut}`);
  }
  t.diagnostic('\n'+lignes.join('\n'));
});
test('garde de voie en ombre : attrape 220, 360 et 361, pas les six d\'imprécision',{skip:saute},t=>{
  const lignes=[];
  for(const c of lire()){const e=G.evaluer({cut:c.cut,positions:c.poseAriane,table:tableVoisins(c),valide:true,reglage:{avantSeulement:true}});
    lignes.push(`${c.cut} écartement ${e.ecartMm} / voisins ${e.referenceMm} : ${e.ecartAuVoisinageMm} mm → ${e.auraitPause?'PAUSE':'—'}`);
    if(c.famille==='mauvaise-voie')assert.equal(e.auraitPause,true,`la garde manque le cut ${c.cut} (${e.ecartAuVoisinageMm} mm)`);}
  t.diagnostic('\n'+lignes.join('\n'));
});
test('serrage en ombre : écart à l\'opérateur avant et après, par cut (rapport)',{skip:saute},t=>{
  const lignes=[];
  for(const c of lire().filter(c=>c.famille==='imprecision')){const s=S.evaluer({cut:c.cut,positions:c.poseAriane,table:tableVoisins(c),reglage:{avantSeulement:true}});
    const apres=Math.max(...SIDES.map((side,i)=>{const l=V.localMm(c.capture.rails[side],c.poseAriane[side]),t2=cible(c,side),sh=-(i===0?s.deltaGaucheMm:s.deltaDroiteMm);return Math.hypot(l[0]-t2[0],l[1]+sh-t2[1],l[2]-t2[2]);}));
    lignes.push(`${c.cut} écartement ${s.ecartAvantMm} → ${s.ecartApresMm} (réf. ${s.referenceMm}) : écart ${c.ecartActuelMm} → ${arr(apres)} mm`);}
  t.diagnostic('\n'+lignes.join('\n'));
});
