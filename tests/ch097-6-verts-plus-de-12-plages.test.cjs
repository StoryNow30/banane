'use strict';
/* CH-097, défaut 6 — PLUS DE 12 PLAGES DE VERTS : le panneau n'affiche que 12 plages puis une ligne « … et N autres plages, dans l'export ».
 * Signal recomptait les verts en additionnant le « · N » lu dans chaque ligne affichée : au-delà de 12 plages il sous-comptait « verts à contrôler »
 * (donc « à examiner ») et prenait la ligne « … et N autres » pour une plage vide. Maintenant le nombre vient de la liste elle-même
 * (`ArianePanel.vertsListe()`, son `aControler`) et la ligne de renvoi n'est plus une plage. Affichage seul. Habillage réel en vm. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {monter}=require('./helpers/ui5-page.cjs');
const LOT_FINI={id:'L1',state:'COMPLETED',scope:{part:23,start:1,end:99},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[]};
const etat=()=>({mode:'automatic-test',current:{identity:{part:23,cut:99}},batch:LOT_FINI,connection:{status:'ready'}});
const PLAGES=Array.from({length:15},(_,i)=>({debut:100+10*i,fin:102+10*i,nombre:3,libelle:'plage '+(i+1),motif:'voisin'}));   // 15 plages de 3 cuts : 45 verts
const LISTE={actif:true,partie:23,aControler:45,tempsEstimeS:166,plages:PLAGES};
/* Les lignes telles que panel.js les écrit dans `#verts-plages` : 12 plages, puis le renvoi (`class="muted"`, sans <b> ni <span>). */
const li=(b,span,className='')=>({className,textContent:(b||'')+(span||''),querySelector:q=>q==='b'?(b===null?null:{textContent:b}):q==='span'?(span===null?null:{textContent:span}):null});
const lignes=()=>[...PLAGES.slice(0,12).map(p=>li(p.libelle,`${p.debut}–${p.fin} · ${p.nombre} cuts`)),li(null,null,'muted')];
async function page({liste=LISTE,avecListe=true}={}){const p=await monter({etat:etat()});
 p.els['verts-controle'].hidden=false;p.els['verts-ligne'].textContent='45 cuts à contrôler · environ 2 min 46 s';
 p.els['verts-plages'].querySelectorAll=()=>lignes();
 if(avecListe)p.ctx.ArianePanel.vertsListe=()=>liste;
 return p;}

test('15 plages (45 verts) : Signal compte 45 verts à contrôler, pas les 36 des 12 plages affichées ; « à examiner » suit',async()=>{
 const a=(await page()).ui.instantane(etat()).ar;
 assert.equal(a.vertsNombre,45);assert.equal(a.aExaminer,45,'0 différé + 45 verts');});

test('la ligne « … et N autres plages » n’est pas une plage : 12 plages, aucune ligne vide',async()=>{
 const a=(await page()).ui.instantane(etat()).ar;
 assert.equal(a.verts.length,12);assert.ok(a.verts.every(v=>v.libelle&&v.detail),'aucune plage sans libellé ni détail');});

test('sans la liste du panneau (ancien panneau) : repli sur le compte des lignes, la ligne de renvoi toujours écartée',async()=>{
 const a=(await page({avecListe:false})).ui.instantane(etat()).ar;
 assert.equal(a.verts.length,12);assert.equal(a.vertsNombre,36);});

test('12 plages ou moins : rien ne change (nombre de la liste = somme des lignes) ; carte cachée : nombre inconnu, pas zéro',async()=>{
 const p=await page({liste:{...LISTE,aControler:6,plages:PLAGES.slice(0,2)}});p.els['verts-plages'].querySelectorAll=()=>lignes().slice(0,2);
 const a=p.ui.instantane(etat()).ar;assert.equal(a.vertsNombre,6);assert.equal(a.verts.length,2);
 p.els['verts-controle'].hidden=true;assert.equal(p.ui.instantane(etat()).ar.vertsNombre,null);});

test('le panneau expose sa liste des verts à Signal (`ArianePanel.vertsListe`)',()=>{
 assert.match(fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8'),/globalThis\.ArianePanel=Object\.freeze\(\{[^\n]*vertsListe:\(\)=>verts\.liste/);});
