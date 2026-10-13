'use strict';
/* D-092 (4.9.0.10) — U3, RACCOURCIS `D` ET `Maj + Espace` (cahier § 6, U3). Actions fixées par la direction (Mic, 13 octobre 2026) :
 *   D            = passer au cut de droite (action d'ESV) ;
 *   Maj + Espace = valider le cut (action d'ESV).
 * Porte MINIMUM : aucune action d'ESV doublée ou détournée. Ariane n'ajoute aucun raccourci : elle laisse passer `D`, et ne retient
 * `Maj + Espace` (comme Entrée et Maj + Retour arrière) que lorsque la garde d'une séance Écho ou Corrections est active, pour
 * l'enregistrer puis le transmettre UNE seule fois à ESV (« relais unique ») ; en Orbite, la garde est inactive. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){const handlers=new Map(),messages=[];const ctx={window:null,location:{origin:'https://esv.lidar.altametris.xyz'},
 addEventListener:(type,fn)=>{if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},postMessage:m=>messages.push(m)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/early-input.js'),'utf8'),ctx);
 let native=0;for(const t of ['keydown','keyup','click','pointerdown','mousedown'])ctx.addEventListener(t,()=>native++);
 function emit(extra={}){let stopped=false;const event={type:'keydown',isTrusted:true,code:'KeyD',key:'d',shiftKey:false,
   target:{closest:s=>s==='canvas'},preventDefault(){},stopImmediatePropagation(){stopped=true;},...extra};
   for(const fn of handlers.get(event.type)||[]){fn(event);if(stopped)break;}return stopped;}
 return {ctx,messages,emit,native:()=>native};}
const D=(o={})=>({code:'KeyD',key:'d',shiftKey:false,...o}),MAJ_ESPACE=(o={})=>({code:'Space',key:' ',shiftKey:true,...o});

test('hors séance Écho ou Corrections (Orbite, ou rien) : `D` et `Maj + Espace` arrivent à ESV intacts, rien n’est retenu ni relayé',()=>{
 const f=fixture();
 for(const e of [D(),MAJ_ESPACE(),MAJ_ESPACE({type:'keyup',shiftKey:false}),D({type:'keyup'})])assert.equal(f.emit(e),false,JSON.stringify(e));
 assert.equal(f.native(),4);assert.equal(f.messages.length,0,'aucun message : ni détourné ni doublé');
});
test('séance active, hors préparation : `D` passe à ESV (non détourné) ; `Maj + Espace` est retenu une fois, relayé une fois, jamais transmis deux fois',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase:'READY',channel:'canal'});
 assert.equal(f.emit(D()),false,'D n’est pas retenu');assert.equal(f.native(),1);assert.equal(f.messages.length,0,'D : aucun relais');
 assert.equal(f.emit(MAJ_ESPACE()),true,'Maj + Espace retenu avant ESV');assert.equal(f.native(),1,'ESV ne reçoit pas la frappe originale');
 assert.equal(f.messages.length,1,'un seul relais');assert.equal(f.messages[0].input.code,'Space');assert.equal(f.messages[0].input.shiftKey,true);
 assert.equal(f.emit(MAJ_ESPACE({repeat:true})),true);assert.equal(f.messages.length,2,'la répétition de la frappe est relayée comme frappe, sans validation supplémentaire côté garde');
 assert.equal(f.emit(MAJ_ESPACE({type:'keyup',shiftKey:false})),true);assert.equal(f.native(),1,'le relâchement est retenu avec la frappe');
 assert.equal(f.emit(MAJ_ESPACE({isTrusted:false})),false,'la frappe rejouée par Ariane (non fiable) atteint ESV : c’est l’unique transmission');assert.equal(f.native(),2);
});
test('pendant l’enregistrement de la paire (PREPARING, SAVING, AWAITING_NAV) : `D` est retenu (pas de rail déplacé pendant la sauvegarde), `Maj + Espace` aussi ; la saisie dans un champ reste libre',()=>{
 for(const phase of ['PREPARING','SAVING','AWAITING_NAV']){
  const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase,channel:'canal'});
  assert.equal(f.emit(D()),true,phase+' : D retenu');assert.equal(f.native(),0);
  assert.equal(f.emit(MAJ_ESPACE()),true,phase+' : Maj + Espace retenu');
  assert.equal(f.emit(D({target:{closest:s=>s.startsWith('input')}})),false,phase+' : frappe dans un champ');assert.equal(f.native(),1);}
});
test('observation d’Écho (garde native) : `D` et `Maj + Espace` restent passifs : jamais retenus, relevés une fois chacun',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4NativeGate,{active:true,channel:'natif'});
 assert.equal(f.emit(D()),false);assert.equal(f.emit(MAJ_ESPACE()),false);assert.equal(f.native(),2);
 const vus=f.messages.filter(m=>m.kind==='banane4:native-input');assert.equal(vus.length,2);
 assert.deepEqual(vus.map(m=>[m.input.code,m.input.shiftKey]),[['KeyD',false],['Space',true]]);
});
test('Orbite n’émet jamais `D` ni `Maj + Espace` : elle ne rejoue que Maj + Retour arrière (passer) et Ctrl + Entrée (valider sans suivant) ; aucun raccourci d’extension déclaré',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 const inits=[...src.matchAll(/const init=\{key:'([^']+)',(?:code:'([^']+)')?/g)].map(m=>m[2]||m[1]);
 assert.deepEqual([...new Set(inits)].sort(),['Backspace','Enter'],'seuls ces deux raccourcis d’ESV sont rejoués');
 assert.equal((src.match(/const init=\{key:/g)||[]).length,2,'deux seuls gabarits de touches émises');
 assert.ok(!/key:'d'|code:'KeyD'|code:'Space'|key:' '/i.test(src),'ni D ni Espace n’apparaissent comme touches émises');
 const manifest=require('../manifest.json');assert.ok(!('commands' in manifest),'aucun raccourci d’extension déclaré : rien ne double une touche d’ESV');
});
