'use strict';
require('./relecture-reglable.cjs');
/* Outils communs des essais de la relecture après le lot (tests/relecture-sw-*.test.cjs) : empreinte de la base, lot sans le champ
 * `relecture` du scope, réglages permissifs d'essai, commandes après le lot. Un fichier par essai : chaque fichier d'essai doit
 * finir en moins de 20 s (délai de tools/verify.cjs), et un lot réel en prend 3 à 6. */
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const H=require('./relecture-lot.cjs');
const GOLDEN=require('../fixtures/relecture-lot-50-base.json');
const empreinte=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),j=x=>JSON.parse(JSON.stringify(x));
/* Le lot sans le champ `relecture` de son scope (la seule différence permise entre les modes). */
const sansRelecture=x=>JSON.parse(JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)&&'relecture' in v?Object.fromEntries(Object.entries(v).filter(([c])=>c!=='relecture')):v));
/* Réglages d'essai COMPLETS et valides (sinon la passe reste en ombre : revue, correction 5) : ceux du fichier proposé, avec les abords
 * ouverts à 12 mm, la PN à 8 mm, et la cohérence du défaut (6 mm entre les rails, écartement à 8 mm de la médiane). */
const PERMISSIF={format:'ariane-relecture-reglages-1',statut:'essai',etagesPermis:['first-pass','window'],roles:['vert'],jamais:['cut différé par le lot','cut posé par le lot'],
 voie:{lateralMaxMm:45},coherence:{diffLateraleMaxMm:6,diffVerticaleMaxMm:6,ecartementMaxMm:8},variante:{proposition:'chaine+h'},
 zones:{pn:{corriger:true,seuilMm:8,confianceMin:0},adv:{corriger:false,seuilMm:8,confianceMin:0},abords:{corriger:true,seuilMm:12,confianceMin:0},'vert-hors-zone':{corriger:false,seuilMm:8,confianceMin:0}}};
const apresLot=(b,lot)=>b.commands.slice(b.commands.indexOf(lot.at(-1))+1);
const LECTURES=new Set(['ping','state','goToCut','capture',null,undefined]);
/* L'empreinte a été prise sous la version de base : `extensionVersion` (portée par les poses) est ramenée à celle de l'empreinte (revue, R9). */
const VERSION=require('../../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${GOLDEN.version}"`));
const empreinteLot=lot=>empreinte(versionGolden(H.neutre(lot)));
/* Commandes de la page qui suivent un `goToCut` par la carte (« auto ») sans pas entre les deux : jamais une pose (revue, correction 3). */
function posesApresSaut(commandes){let dernier=null;const out=[];
 for(const c of commandes){if(c.action==='goToCut')dernier=c.args?.[1]?.chemin??null;else if(c.action==='apply'&&dernier!=='pas')out.push(c);}return out;}
async function coupee(nom,mode){
 const {b,lot}=await H.lotRelecture({mode,decisions:{109:14}});await H.attendre(80);
 assert.equal(empreinteLot(lot),GOLDEN.empreinteCommandes,nom+' : lot identique à la base');
 assert.deepEqual(lot.map(c=>c.action??null),GOLDEN.actions,nom);
 assert.deepEqual(apresLot(b,lot).filter(c=>!['state','ping'].includes(c.action)),[],nom+' : après le lot, rien d’autre que les lectures du panneau');
 assert.equal(b.commands.some(c=>c.action==='goToCut'),false,nom);
 assert.equal(b.get('relecture').passe,null,nom);assert.equal(b.store.events.some(e=>/^relecture-/.test(e.type)),false,nom);
 assert.equal('relecture' in b.get('engine').s.batch.scope,false,nom);
 assert.equal(b.store.events.filter(e=>e.type==='batch-started').every(e=>!('relecture' in e.batch.scope)),true,nom);
 assert.equal('relecture' in await b.api('view'),false,nom+' : la vue du panneau est celle d’avant');}
module.exports={H,GOLDEN,empreinte,empreinteLot,versionGolden,j,sansRelecture,PERMISSIF,apresLot,LECTURES,coupee,posesApresSaut};
