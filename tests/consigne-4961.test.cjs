'use strict';
/* Consigne de la 4.9.6 test 1 (UI-L1) : courte, en français simple, avec le contrôle de l'empreinte, la version, l'essai du nouveau panneau,
 * les exports et le retour arrière à la test 13. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-4.9.6-test-1-ui-2026-10-20.md'),'utf8');
test('consigne 4.9.6 test 1 : empreinte, version, écrans à essayer, exports, retour arrière',()=>{
 assert.ok(texte.includes('Get-FileHash .\\ariane-4.9.6-test.1.zip -Algorithm SHA256'));
 assert.ok(texte.includes('« 4.9.6 test 1 (UI-L1) »'));
 for(const m of ['Accueil','Orbite','Revue','Réglages','Pause demandée','Ancien panneau','ne change pas de cut dans ESV'])assert.ok(texte.includes(m),m);
 assert.match(texte,/Reviens à la \*\*4\.9\.5 test 13 \(L1\)\*\*/);
 assert.ok(texte.includes('## Pas vérifié'));
 assert.ok(texte.split('\n').length<60,'une page');
});
