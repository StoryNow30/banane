'use strict';
/* CH-070 : crochet de relevé (node -r tools/ch070-releve-crochet.cjs …). Enveloppe les fonctions portées des modules de
 * session quand un essai du tronc les charge, et consigne chaque entrée (trame VBA, copie au moment de l'appel) dans
 * $CH070_RELEVE (JSONL : {f, t}). Une entrée non encodable (fonction, Map…) est comptée, pas consignée. Rien n'est changé
 * au comportement : la fonction d'origine est appelée avec les mêmes arguments et son résultat est rendu. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const Vba=require('../ariane-rs/coquille/vba.js');
const SORTIE=process.env.CH070_RELEVE;if(!SORTIE)return;
const CIBLES={
 'src/part-summary-49.js':{exports:['projectEvent','summarize','fromJournal','contextOf','deferKind']},
 'src/historique-parties.js':{exports:['finDe','ficheFin','ajouterFin','historique']},
 'src/core.js':{exports:['expectedPoses','pairCorpus']},
 'src/native-reconstruction.js':{exports:['reconstruireRail','reconstruireCut','etiquette','memeEtiquette','distMm']},
 'src/native-session.js':{exports:['railDelta','referenceParEcriture'],prototype:['classify','chooseGeometry','health','accountQuality','referenceFromWrite','mergeMetrics','redactedEvent','exportAdvice','visitRelation']},
};
const RACINE=path.resolve(__dirname,'..'),vus=new Set();let refus=0;
/* Bornes (le relevé reste petit) : 150 entrées par fonction et par processus d'essai, 1 Mo par trame. */
const PAR_FONCTION=150,TRAME_MAX=1<<20,nombre={};
function consigner(f,valeur){if((nombre[f]=(nombre[f]||0)+1)>PAR_FONCTION)return;
 try{const t=Vba.encoder(valeur);if(t.length>TRAME_MAX)return;fs.appendFileSync(SORTIE,JSON.stringify({f,t:Buffer.from(t).toString('base64')})+'\n');}catch{refus++;}}
/* Ce que chaque méthode lit de `this` (le reste n'est pas copié). */
const CECI={mergeMetrics:s=>({metrics:s.e?.s?.native?.metrics}),health:s=>({native:s.e?.s?.native}),exportAdvice:s=>({native:s.e?.s?.native})};
const charger=Module._load;
Module._load=function(demande,parent,estPrincipal){
 const m=charger.apply(this,arguments);
 let nom;try{nom=path.relative(RACINE,Module._resolveFilename(demande,parent,estPrincipal));}catch{return m;}
 const c=CIBLES[nom];if(!c||vus.has(nom)||!m)return m;vus.add(nom);
 for(const k of c.exports||[])if(typeof m[k]==='function'){const o=m[k];m[k]=function(...a){consigner(nom+':'+k,{a});return o.apply(this,a);};}
 const S=m.Sessions;
 if(S&&c.prototype)for(const k of c.prototype){const o=S.prototype[k];if(typeof o!=='function')continue;
  S.prototype[k]=function(...a){let ceci=null;try{if(CECI[k])ceci=CECI[k](this);}catch{}consigner(nom+':proto.'+k,ceci?{a,ceci}:{a});return o.apply(this,a);};}
 return m;
};
process.on('exit',()=>{if(refus)try{fs.appendFileSync(SORTIE,JSON.stringify({refus})+'\n');}catch{}});
