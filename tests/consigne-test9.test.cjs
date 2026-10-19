'use strict';
/* Consigne de la séance « test 9 » (D-091 : mode rapide sur neuf cuts sur dix, exports allégés) : installer par-dessus, vérifier
 * la version et les deux lignes de réglage telles que le panneau les affiche, ne vider qu'après confirmation de réception, lots
 * sans vidage, script de découpe, message qui impose l'arrêt, retour vers la 4.9.0.8 avec sa seule empreinte, aucune donnée de
 * projet ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const texte=fs.readFileSync(path.resolve(__dirname,'..','consignes/seance-terrain-test-9-2026-10-13.md'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const S=require('../src/settings.js');
test('installation : empreinte avant la pose, par-dessus sans désinstaller, version et réglages vérifiés, vidage après confirmation',()=>{
 const s=section('1. Installer et vérifier');
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 9'),'le contrôle vient avant la pose');
 for(const m of ['Get-FileHash','ariane-4.9.0-test.9.zip','Ne désinstalle rien','Recharger','4.9.0 test 9','Vider le cache des exports','seulement après ma confirmation'])assert.ok(s.includes(m),m);
 // Les libellés et valeurs annoncés sont ceux que le panneau affiche réellement avec les réglages livrés.
 for(const nom of ['Mode rapide (V3)','Allègement des nuages']){const l=S.describe().find(x=>x.nom===nom);assert.ok(l,nom);assert.ok(s.includes(`« ${l.nom} » dit « ${l.valeur} »`),nom);}
});
test('ce que l\'opérateur verra : neuf cuts sur dix rapides, un sur dix en référence, la vue ne suit pas toujours, exports plus légers',()=>{
 const debut=texte.slice(0,texte.indexOf('## Le paquet'));
 for(const m of ['neuf cuts sur dix','Un cut sur','référence','la vue d\'ESV ne suit pas toujours','relue','2,44 s','6,73 s','30 %','restent exacts','mêmes poses','21,7 à 14,6 Mo'])assert.ok(debut.includes(m),m);
});
test('le lot : partie neuve, 300 coupes, 600 pixels, onglet au premier plan, arrêt sur un rail déplacé à tort, lots sans vidage ; fin : vérifier avant de vider',()=>{
 const a=section('2. Le lot'),f=section('3. À la fin du lot');
 for(const m of ['partie neuve','300 coupes','600 pixels','premier plan','Orbite seulement','Ne touche à rien','extension Claude','saccade','Lecture LiDAR instable','sans vider le cache entre eux'])assert.ok(a.includes(m),m);
 assert.ok(a.includes('« Le clic a déplacé le rail … au lieu du rail … »'));
 assert.ok(fs.readFileSync(path.resolve(__dirname,'..','src/adapter-page.js'),'utf8').includes("'Le clic a déplacé le rail '+"));
 for(const m of ['20 Mo','Export incomplet','Attends 5 secondes','tools/perf-v3.cjs','SHA-256'])assert.ok(f.includes(m),m);
 assert.ok(f.indexOf('Vérifie le zip')<f.indexOf('Vider le cache'),'vérifier avant de vider');
});
test('script de découpe : morceaux de 20 Mo, numérotés, zip d’origine intact, empreinte affichée',()=>{
 const f=section('3. À la fin du lot'),script=/```powershell\n([\s\S]*?)```/.exec(f)?.[1];assert.ok(script,'script présent');
 for(const m of ['$max = 20MB','ariane-lot-*.zip','OpenRead','{0}.{1:D3}','Get-FileHash $src -Algorithm SHA256'])assert.ok(script.includes(m),m);
 assert.doesNotMatch(script,/Remove-Item|Delete|Move-Item|OpenWrite\(\$src/,'le zip d’origine n’est ni supprimé ni réécrit');
 // Recollage côté analyse : la concaténation des morceaux rend le fichier d'origine (même logique, en Node).
 const max=20*1024*1024,src=Buffer.alloc(Math.floor(2.6*max),7);src[0]=1;src[src.length-1]=9;
 const n=Math.ceil(src.length/max),taille=Math.ceil(src.length/n),parts=[];for(let i=0;i<n;i++)parts.push(src.subarray(i*taille,Math.min(src.length,(i+1)*taille)));
 assert.equal(n,3);assert.ok(parts.every(p=>p.length<=max));assert.ok(Buffer.concat(parts).equals(src));
});
test('retour arrière vers la 4.9.0.8 ; aucune autre empreinte ; aucun identifiant de projet ESV',()=>{
 const r=section('4. Si quelque chose ne va pas');
 assert.match(r,/Ne désinstalle pas Ariane/);assert.match(r,/désactive/);assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
 assert.match(r,/4\.9\.0\.8/);assert.match(r,/ariane-4\.9\.0-test\.8\.zip/);
 const hex=[...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
 assert.deepEqual(hex,['c58af02781c0a5a7caf81cd11e772e8e63a571d37323c0f60696d0f9bfcb53a4']);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
});
