#!/usr/bin/env node
'use strict';
/*
 * jeu-apprentissage.cjs — JEU D'APPRENTISSAGE depuis un ou plusieurs exports
 * d'Ariane (Orbite ou Écho), hors ligne, sans navigateur. Pour chaque cut
 * rejouable : identité, repère, pose de départ d'ESV, référence (pose finale
 * humaine en Écho, pose d'Ariane en Orbite), écart départ → référence en mm et
 * en repère profil (le long de la voie, en travers, vertical), voisins à
 * référence dans la fenêtre, prédiction par INTERPOLATION entre les deux voisins
 * les plus proches (D-098 à D-100) et son écart, points par rail ; et, si le
 * rapport d'un rejeu (tools/banc-esv.cjs --json) est donné, l'écart de la pose
 * d'Ariane rejouée à la référence.
 *
 *   node tools/jeu-apprentissage.cjs EXPORT [EXPORT…] [--rejeu RAPPORT.json] [--fenetre 3] [--points] [--sortie JEU.json]
 *
 * Format de sortie : `banane-apprentissage-v1`. Les coordonnées sont celles du
 * scénario de la maquette (monde réel quand l'export porte des écritures
 * observées, sinon monde factice par repère : dit par `monde`). Aucun
 * identifiant de projet, aucune donnée d'ESV. Rien n'est inventé : un cut sans
 * référence a `reference: null`, un cut sans voisins n'a pas d'interpolation.
 */
const fs=require('node:fs'),path=require('node:path');
const C=require('../vendor/capture-core.js');
const L=require('../tests/esv-maquette/lecteur-export.cjs');
const SIDES=['left','right'];
function args(argv){const o={exports:[],rejeu:null,fenetre:3,points:false,sortie:null};
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--points')o.points=true;else if(a.startsWith('--'))o[a.slice(2)]=argv[++i];else o.exports.push(a);}
  o.fenetre=Number(o.fenetre);return o;}
const stats=v=>{const s=v.filter(Number.isFinite).sort((a,b)=>a-b);if(!s.length)return null;const q=p=>s[Math.min(s.length-1,Math.floor(p*(s.length-1)))];
  return {n:s.length,mediane:r1(q(.5)),p90:r1(q(.9)),max:r1(s.at(-1))};},r1=v=>Math.round(v*10)/10;
const mm=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))*1000;
/* Matrice monde d'un rail du scénario (position, quaternion, échelle), et repère profil → monde. */
function matriceRail(r){return C.worldMatrix({position:{x:r.position[0],y:r.position[1],z:r.position[2]},quaternion:{x:r.quaternion[0],y:r.quaternion[1],z:r.quaternion[2],w:r.quaternion[3]},scale:{x:r.scale[0],y:r.scale[1],z:r.scale[2]}});}
function pointsParRail(cut){const out={left:0,right:0};const inv=Object.fromEntries(SIDES.map(s=>[s,C.inverse(matriceRail(cut.rails[s]))]));
  for(const n of cut.noeuds)for(let i=0;i<n.positions.length;i+=3){const p=[n.positions[i]+cut.origine[0],n.positions[i+1]+cut.origine[1],n.positions[i+2]+cut.origine[2]];
    for(const s of SIDES){const l=C.point(inv[s],p);if(Math.abs(l[0])<=.5&&Math.abs(l[1])<=.4&&Math.abs(l[2])<=.3)out[s]++;}}
  return out;}
function construire(o){
  const parties=[];const rejeu=o.rejeu?JSON.parse(fs.readFileSync(o.rejeu,'utf8')):null;
  const ecartsRejeu=new Map((rejeu?.resume?.ecartsReferenceMm||[]).map(e=>[e.rowKey,e]));
  for(const entree of o.exports){const s=L.construire(entree);
    for(const p of s.parties){const cuts=p.cuts.map(c=>{const depart=Object.fromEntries(SIDES.map(x=>[x,c.rails[x].position]));
        const ref=c.reference?{source:c.reference.source,...Object.fromEntries(SIDES.map(x=>[x,c.reference.monde[x]]))}:null;
        const local=ref?Object.fromEntries(SIDES.map(x=>{const inv=C.inverse(matriceRail(c.rails[x]));const d=C.point(inv,ref[x]);return [x,d.map(v=>Math.round(v*1e4)/10)];})):null; /* mm, repère profil (x le long de la voie, y en travers, z vertical) */
        return {part:p.part,cut:c.cut,index:c.index,repere:c.frame,monde:c.monde,statut:c.status,preValide:!!c.preValide,intent:c.intent,source:c.source,
          depart,reference:ref,ecartDepartMm:ref?Object.fromEntries(SIDES.map(x=>[x,r1(mm(depart[x],ref[x]))])):null,deltaLocalMm:local,
          points:pointsParRail(c),noeuds:c.noeuds.length,rejeu:ecartsRejeu.get(`${p.part}-${c.cut}`)||null,
          ...(o.points?{pointsScene:c.noeuds.flatMap(n=>n.positions)}:{})};});
      /* Interpolation entre les deux voisins à référence les plus proches, un avant et un après, dans la fenêtre, même repère (ou monde réel). */
      for(const c of cuts){const voisin=sens=>{let best=null;for(const v of cuts){if(v===c||!v.reference||Math.sign(v.cut-c.cut)!==sens||Math.abs(v.cut-c.cut)>o.fenetre)continue;
          if(v.repere!==c.repere&&!(v.monde==='reel'&&c.monde==='reel'))continue;if(!best||Math.abs(v.cut-c.cut)<Math.abs(best.cut-c.cut))best=v;}return best;};
        const a=voisin(-1),b=voisin(1);c.voisins={avant:a?.cut??null,apres:b?.cut??null};
        if(a&&b){const t=(c.cut-a.cut)/(b.cut-a.cut),pred=Object.fromEntries(SIDES.map(x=>[x,a.reference[x].map((v,i)=>v+(b.reference[x][i]-v)*t)]));
          c.interpolation={prediction:pred,ecartReferenceMm:c.reference?Object.fromEntries(SIDES.map(x=>[x,r1(mm(pred[x],c.reference[x]))])):null,ecartDepartMm:Object.fromEntries(SIDES.map(x=>[x,r1(mm(pred[x],c.depart[x]))]))};}
        else c.interpolation=null;}
      parties.push({export:path.basename(entree),nature:s.provenance.nature,part:p.part,reperes:s.monde.reperes,exclus:s.provenance.exclus,cuts});}}
  const tous=parties.flatMap(p=>p.cuts),avecRef=tous.filter(c=>c.reference);
  const resume={cuts:tous.length,avecReference:avecRef.length,parIntent:Object.fromEntries([...new Set(tous.map(c=>c.intent))].map(i=>[i,tous.filter(c=>c.intent===i).length])),
    ecartDepartMm:Object.fromEntries(SIDES.map(x=>[x,stats(avecRef.map(c=>c.ecartDepartMm[x]))])),
    interpolation:{cuts:tous.filter(c=>c.interpolation&&c.reference).length,ecartReferenceMm:Object.fromEntries(SIDES.map(x=>[x,stats(tous.filter(c=>c.interpolation&&c.reference).map(c=>c.interpolation.ecartReferenceMm[x]))]))},
    rejeu:rejeu?{cuts:tous.filter(c=>c.rejeu).length,ecartReferenceMm:{left:stats(tous.filter(c=>c.rejeu).map(c=>c.rejeu.gaucheMm)),right:stats(tous.filter(c=>c.rejeu).map(c=>c.rejeu.droitMm))}}:null,
    mondeReel:tous.filter(c=>c.monde==='reel').length};
  return {format:'banane-apprentissage-v1',generatedAt:new Date().toISOString(),parametres:{fenetre:o.fenetre,points:o.points,rejeu:o.rejeu?path.basename(o.rejeu):null},
    note:'Repère profil : x le long de la voie, y en travers, z vertical ; monde réel seulement si l’export porte des écritures observées (4.9), sinon factice par repère.',resume,parties};
}
module.exports={construire,args};
if(require.main===module){const o=args(process.argv.slice(2));if(!o.exports.length){console.error('Usage : EXPORT [EXPORT…] [--rejeu RAPPORT.json] [--fenetre 3] [--points] [--sortie JEU.json]');process.exit(2);}
  const jeu=construire(o);if(o.sortie)fs.writeFileSync(o.sortie,JSON.stringify(jeu,null,1));
  console.log(JSON.stringify({resume:jeu.resume,parties:jeu.parties.map(p=>({export:p.export,nature:p.nature,part:p.part,cuts:p.cuts.length,exclus:p.exclus.total}))},null,1));}
