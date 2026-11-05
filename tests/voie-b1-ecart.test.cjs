'use strict';
/* CH-055 — RÈGLE DE VOIE « B1-ECART » EN OMBRE (src/voie-b1-ecart.js) : module pur, essayé sur la fixture synthétique de
 * tools/rejeu-voie-predite.cjs (voie droite fabriquée, aucune donnée réelle). La règle est celle mesurée par CH-053-M (variante
 * « b1-ecart-serie ») : sur un cut que le lot DIFFÈRE, (1) la chaîne de l'ombre (ses propres poses), (2) les lignes valides de la
 * liste d'ESV autour du cut (B1), (3) le rail que le moteur a trouvé complété par l'écartement de référence, le moteur relancé
 * depuis la paire ; sa qualification décide. Elle ne pose rien : elle calcule et rend un événement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/voie-b1-ecart.js'),R=require('../tools/rejeu-voie-predite.cjs'),Shadow=require('../src/gcv1-shadow.js'),K=require('../src/core.js'),L=require('../src/lot-decision.js');
const SIDES=['left','right'];
const T0=[1234.5,2345.25,3.125];   // translation monde − scène de la liste synthétique
/* Table décompactée de la liste d'ESV (format de src/liste-memoire.js `decompacter`) : une ligne par cut, bords monde au dixième de mm.
 * `valides` : cuts dont la ligne est valide à la VRAIE pose ; les autres sont invalides à leur pose de départ. */
function table(fx,valides){
  const n=Math.max(...fx.captures.keys())+1,st=new Array(n).fill(3),fl=new Array(n).fill(0),ed=new Array(6*n).fill(null);
  for(const [cut,c] of fx.captures){
    const mic=fx.ref.get(cut).mic;
    const pos=s=>valides.includes(cut)?L.positionOf(c.rails[s],mic[s].map(v=>v/1000)):c.rails[s].positionSceneRelative;
    st[cut]=valides.includes(cut)?0:1;
    SIDES.forEach((s,k)=>pos(s).forEach((v,i)=>{ed[6*cut+3*k+i]=Math.round((v+T0[i])*1e4);}));
  }
  return {n,st,fl,ed,partie:1};
}
const capture=c=>({identity:K.completeIdentity(c.identity),rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes});
/* `poseMm` : [long, lat, vert] par rail (format commun des ombres, voie-recentree `poseMm`). */
const ecart=(ev,mic)=>Math.max(...SIDES.map(s=>Math.hypot(ev.poseMm[s][1]-mic[s][1],ev.poseMm[s][2]-mic[s][2])));
const differe=(cap,science)=>L.decideCut({capture:cap,science:{rails:science.rails,summary:science.summary},anchors:[],Shadow});

test('constantes : version, réglage par défaut (fenêtre de liste, fenêtre et choix de la reprise, accord, écartement par défaut), aucune pose',()=>{
  assert.equal(M.VERSION,'voie-b1-ecart-ombre-v1');
  assert.deepEqual({...M.REGLAGE},{fenetreListe:5,fenetreMm:30,choixMm:15,accordMm:20,gRefDefautMm:1435,essaisMax:4,solutionPorteeMm:320,solutionPasMm:1,solutionTolMm:0.5});
  assert.ok(Object.isFrozen(M.REGLAGE));
});

test('complément par l\'écartement : un rail trouvé, l\'autre à 230 mm ⇒ l\'autre rail est retrouvé à l\'écartement de référence, source « ecart »',()=>{
  const fx=R.fixtureSynthetique({premiers:0,coupes:2,decalageMm:{left:6,right:230}});
  const c=fx.captures.get(1),cap=capture(c),science=Shadow.scientificProposeBoth(cap),d0=differe(cap,science);
  assert.equal(d0.stage,'deferred');
  const mem=M.creerMemoire('lot-essai');
  const {evenement:ev,r}=M.evaluer({mem,capture:cap,science,Shadow,table:null,ancresReelles:[],decisionReelle:d0});
  assert.equal(ev.version,'voie-b1-ecart-ombre-v1');assert.equal(ev.source,'ecart');assert.equal(ev.verdict.posable,true);
  assert.ok(ecart(ev,fx.ref.get(1).mic)<=5,'pose à 5 mm de la vérité : '+JSON.stringify(ev.poseMm));
  assert.equal(ev.gRef.source,'defaut');assert.ok(ev.essais>=1&&ev.essais<=4);
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(ev)),'aucune position de scène dans l\'événement');
  assert.ok(r.decision&&r.decision.stage!=='deferred');
});

test('liste d\'ESV (B1) : des lignes valides à la vraie pose autour du cut ⇒ source « b1 », repère T lu sur la ligne du cut lui-même',()=>{
  /* 16 cuts : lignes valides (à la vraie pose) pour 1 à 13, le cut 14 est jugé, le 15 suit. L1-e demande au moins `voisinesMin` lignes valides non
   * touchées pour la référence d'écartement. */
  const fx=R.fixtureSynthetique({premiers:0,coupes:16,decalageMm:230});
  const tb=table(fx,[1,2,3,4,5,6,7,8,9,10,11,12,13]);
  const c=fx.captures.get(14),cap=capture(c),science=Shadow.scientificProposeBoth(cap),d0=differe(cap,science);
  assert.equal(d0.stage,'deferred','sans appui, la voie à 230 mm est hors de la fenêtre du moteur');
  const rows=M.lignesDeTable(tb,14,5);
  assert.deepEqual(rows.map(x=>x.i),[9,10,11,12,13,14,15,16],'la fenêtre de ±5 lignes, bornée à la table');assert.equal(rows.find(x=>x.i===14).statut,'invalid');assert.equal(rows.find(x=>x.i===9).statut,'valid');
  assert.deepEqual(M.lignesDeTable(tb,1,5).map(x=>x.i),[0,1,2,3,4,5,6]);assert.equal(M.lignesDeTable(tb,1,5)[0].statut,'autre');
  const rep=M.repereDepuisLigne(rows,14,cap.rails);
  assert.equal(rep.etat,'calibre');T0.forEach((v,i)=>assert.ok(Math.abs(rep.T[i]-v)<1e-3,'T retrouvée'));
  const mem=M.creerMemoire('lot-essai');
  const {evenement:ev}=M.evaluer({mem,capture:cap,science,Shadow,table:tb,ancresReelles:[],decisionReelle:d0});
  assert.equal(ev.source,'b1');assert.equal(ev.verdict.posable,true);assert.ok(ev.appuis.length>=1&&ev.appuis.every(k=>[9,10,11,12,13].includes(k)),'appuis = lignes valides de la fenêtre : '+ev.appuis);
  assert.deepEqual(ev.lignesValides,[9,10,11,12,13]);assert.equal(ev.repere,'calibre');
  assert.ok(ecart(ev,fx.ref.get(14).mic)<=5,'pose à 5 mm : '+JSON.stringify(ev.poseMm));
  assert.equal(ev.gRef.source,'liste');assert.ok(Math.abs(ev.gRef.mm-1430)<2,'écartement des lignes valides non touchées : '+ev.gRef.mm);
  /* Chaîne de l'ombre : la pose de 14 devient appui de l'ombre pour 15 ; sans table, 15 vient de la série. */
  const c5=fx.captures.get(15),cap5=capture(c5),sc5=Shadow.scientificProposeBoth(cap5);
  const {evenement:e5}=M.evaluer({mem,capture:cap5,science:sc5,Shadow,table:null,ancresReelles:[],decisionReelle:differe(cap5,sc5)});
  assert.equal(e5.source,'serie');assert.deepEqual(e5.appuisOmbre,[14]);assert.ok(ecart(e5,fx.ref.get(15).mic)<=5);
});

test('abstention : aucun rail trouvé et aucune ligne valide ⇒ rien n\'est posé, la raison est dite ; une panne du moteur donne un événement « erreur »',()=>{
  const fx=R.fixtureSynthetique({premiers:0,coupes:1,decalageMm:230});
  const c=fx.captures.get(1),cap=capture(c),science=Shadow.scientificProposeBoth(cap),d0=differe(cap,science);
  const {evenement:ev}=M.evaluer({mem:M.creerMemoire('x'),capture:cap,science,Shadow,table:table(fx,[]),ancresReelles:[],decisionReelle:d0});
  assert.equal(ev.verdict.posable,false);assert.equal(ev.source,null);assert.equal(ev.poseMm,null);assert.match(ev.verdict.raison,/ecart:aucun-rail-trouve/);
  const panne={...Shadow,scientificProposeBoth(){throw Error('panne simulée');}};
  const fx2=R.fixtureSynthetique({premiers:0,coupes:1,decalageMm:{left:6,right:230}}),c2=fx2.captures.get(1),cap2=capture(c2),s2=Shadow.scientificProposeBoth(cap2);
  const {evenement:e2}=M.evaluer({mem:M.creerMemoire('x'),capture:cap2,science:s2,Shadow:panne,table:null,ancresReelles:[],decisionReelle:differe(cap2,s2)});
  assert.equal(e2.etat,'erreur');assert.equal(e2.verdict.posable,false);assert.match(e2.message,/panne simulée/);
});

test('la décision réelle n\'est pas modifiée et le module ne lit que des copies : l\'évaluation ne change ni la capture ni la science',()=>{
  const fx=R.fixtureSynthetique({premiers:0,coupes:1,decalageMm:{left:6,right:230}});
  const c=fx.captures.get(1),cap=capture(c),science=Shadow.scientificProposeBoth(cap),d0=differe(cap,science);
  const avant=JSON.stringify({cap:cap.rails,sc:science.rails,d0});
  M.evaluer({mem:M.creerMemoire('x'),capture:cap,science,Shadow,table:null,ancresReelles:[],decisionReelle:d0});
  assert.equal(JSON.stringify({cap:cap.rails,sc:science.rails,d0}),avant);
});
