'use strict';
/* RELECTURE INDÉPENDANTE 4.7.12 (audit/chantiers/relecture-478.md, constat B1).
 * La garde de continuité retire un premier passage à plus de 30 mm de la voie
 * (`decideCut`, guardDeferred) ; si la reprise depuis la voie aboutit mais que
 * sa cible tombe hors de la vue d'ESV (KI-051), `commandRails` se replie sur
 * `runtimeRails` — la paire du moteur que la garde vient de retirer — et
 * `commandLot` la remet telle quelle à `Engine.apply()`.
 * Scénario : fixture du banc, pose ESV à +210 mm de la vraie position, deux
 * appuis justes, vues de ±0,2 comme celles du Pilote. L'essai affirme le
 * comportement ATTENDU (garde retirée ⇒ jamais la paire du moteur) ; corrigé en
 * 4.7.14 (KI-053) : la paire retirée n'est jamais commandée, le cut est différé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs'),{withCameras}=require('./helpers/navigateur.cjs');
const SIDES=['left','right'];
const capture=rails=>({identity:{part:23,cut:105,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const s0=Shadow.scientificProposeBoth(capture(base.rails));
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,w=K.C.point(P,s0.rails[side].next.delta),o=K.C.point(P,[0,0,0]);
  return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const anchorAt=cut=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,truth[s].positionSceneRelative]))});
const worstMm=(rails,runtime)=>{const e=K.expectedPoses({rails},runtime);return Math.max(...SIDES.map(s=>{const m=rails[s].sceneRelativeToProfileLocal,
  a=K.C.point(m,e[s].positionSceneRelative),h=K.C.point(m,truth[s].positionSceneRelative);return Math.max(Math.abs(a[1]-h[1]),Math.abs(a[2]-h[2]))*1000;}));};

/* D-084 (12 octobre 2026) : la borne basse du contrat d'écartement passe de 1405 à 1420 mm. La paire FAUSSE du moteur de ce
 * scénario (+210 mm) est à 1415,8 mm : admissible avec 1405, elle est maintenant hors contrat et GCV1 s'abstient en amont
 * (aucun candidat, rien à retirer par la garde). Le chemin testé ici — `commandRails` se replie sur la paire du moteur que la
 * garde vient de retirer (KI-053) — existe toujours ; l'instantané « paire du moteur + décision » calculé sous 1405 par la version
 * 4.9.0.4 (`tests/fixtures/relecture-478-contrat-1405.json`) le garde sous essai. Le scénario vivant, lui, est asserté dans le
 * dernier essai : sous 1420 le moteur s'abstient. */
const rails=shifted(truth,210),cap=capture(rails);
const vivant=Shadow.toRuntimeRails(Shadow.scientificProposeBoth(cap));
const figé=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures','relecture-478-contrat-1405.json'),'utf8'));
const runtimeRails=figé.runtimeRails,decision=figé.decision;
const command=cameras=>L.commandRails({decision,runtimeRails,before:rails,expectedPoses:K.expectedPoses,cameras});

test('préalables du scénario : moteur applicable sur une paire fausse, retirée par la garde, cible de la voie hors de la vue',()=>{
  assert.ok(SIDES.every(s=>runtimeRails[s].status==='candidate'),'le moteur publie les deux rails');
  assert.ok(worstMm(rails,runtimeRails)>100,'paire du moteur fausse : '+worstMm(rails,runtimeRails).toFixed(1)+' mm');
  assert.equal(decision.guardDeferred,true);assert.ok(decision.guardMm>30,String(decision.guardMm));
  assert.equal(decision.stage,'window');
  assert.match(command(L.viewCameras(withCameras(cap))).reason,/hors-vue-/);
});

test('garde retirée, cible hors de la vue : la paire retirée du moteur ne doit pas être commandée',()=>{
  const out=command(L.viewCameras(withCameras(cap)));
  const commandee=SIDES.every(s=>out.rails[s].status==='candidate');
  assert.ok(!commandee,commandee?`action ${out.action}/${out.reason} : paire du moteur commandée à ${worstMm(rails,out.rails).toFixed(1)} mm de la vraie position`:'');
  assert.equal(out.action,'defer');assert.equal(out.reason,'guard-hors-vue-left');
});

test('garde retirée, caméra inconnue : même repli, même paire retirée',()=>{
  const out=command(null);
  assert.ok(!SIDES.every(s=>out.rails[s].status==='candidate'),`action ${out.action}/${out.reason}`);
  assert.equal(out.action,'defer');assert.match(out.reason,/^guard-vue-inconnue/);
});

test('D-084 : sous le contrat 1420, la paire fausse du moteur à +210 mm (1415,8 mm) est abstenue en amont',()=>{
  assert.ok(SIDES.every(s=>vivant[s].status!=='candidate'),'GCV1 ne publie plus cette paire : '+SIDES.map(s=>vivant[s].status).join('/'));
});
