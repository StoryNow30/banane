'use strict';
/* 4.9.5 test 6 — outils communs des essais des choix pour le lot (empreinte de la base, version ramenée, comparaison hors VM). */
const crypto=require('node:crypto');
const GOLDEN=require('../fixtures/choix-lot-50-base.json');
const h=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
/* L'empreinte a été prise sous la version de base : chaque `apply` porte `extensionVersion`, ramenée à celle de l'empreinte (rien d'autre). */
const VERSION=require('../../manifest.json').version;
const versionGolden=x=>JSON.parse(JSON.stringify(x).split(`"extensionVersion":"${VERSION}"`).join(`"extensionVersion":"${GOLDEN.version}"`));
const j=x=>JSON.parse(JSON.stringify(x));
const scopeDe=b=>b.get('engine').s.batch.scope;
const debutsDeLot=b=>b.store.events.filter(e=>e.type==='batch-started').map(e=>e.batch.scope);
module.exports={GOLDEN,h,versionGolden,j,scopeDe,debutsDeLot};
