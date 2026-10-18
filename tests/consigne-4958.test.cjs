'use strict';
/* Consigne de la séance « 4.9.5 test 8 » (couverture de la relecture après le lot, d'après l'Écho de la partie 11 : plus de plafond en ADV, liste « À contrôler »
 * relue en entier, cuts à l'écartement hors norme relus et corrigeables) : installer par-dessus la test 7, empreinte SHA-256 contrôlée avant la pose, version
 * vérifiée ; ce qui change est dit en français simple, avec les libellés du panneau ; un lot en « Corriger » (puis en « Ombre ») sur des parties neuves, sans
 * toucher à ESV pendant la relecture, une Écho complète ensuite ; retour arrière avec la phrase de consignes/README.md (désactive, décompresse, réactive,
 * Recharger, F5) ; aucune empreinte ; aucune donnée de projet ESV ; aucune adresse ; aucun nom de modèle d'IA ; une page. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FICHIER='consignes/seance-terrain-4.9.5-test-8-2026-10-18.md';
const texte=fs.readFileSync(path.resolve(__dirname,'..',FICHIER),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'..','panel.html'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');

test('installation : empreinte avant la pose, par-dessus la test 7 sans désinstaller, version vérifiée, dernier choix de la relecture gardé',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la 4.9.5 test 8'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.8.zip','-Algorithm SHA256','par-dessus la test 7','Ne désinstalle rien','Recharger','« 4.9.5 test 8 »','ARIANE 4.9.5 test 8',
  'Ariane 4.9.5 test 8 · ouvrir','« Relecture après le lot »','ton dernier choix est gardé','« Coupée » est cochée sauf si'])assert.ok(s.includes(m),m);
 assert.doesNotMatch(s,/Comme avant|règle est vide/);
});

test('ce qui ne change pas : la pose, le moteur ; la mémoire des différés de l\'Écho et déplacer la vue restent coupés',()=>{
 const debut=plat(texte.slice(0,texte.indexOf('## Ce qui change pour toi')));
 for(const m of ['**La pose ne change pas : Orbite pose les rails au même endroit qu\'avant.**','Le moteur n\'est pas modifié','coupée tant que tu ne la choisis pas'])assert.ok(debut.includes(m),m);
 const s=plat(section('Ce qui change pour toi'));
 for(const m of ['**Toujours coupés**','la mémoire des différés de l\'Écho','**déplacer la vue**'])assert.ok(s.includes(m),m);
});

test('ce qui change : plus de plafond en ADV, liste « À contrôler » entière, écartement hors norme relu et corrigeable ; les chiffres dits sont ceux du code et des réglages',()=>{
 const s=plat(section('Ce qui change pour toi'));
 for(const m of ['**Plus de plafond en ADV**','séparées de 40 cuts au plus','**La relecture dure plus longtemps**','environ 12 minutes','contre 4 minutes','« À contrôler »','relue en entier',
  '**Un cut à l\'écartement hors norme est relu avec son cut d\'avant et son cut d\'après.**','comme un vert d\'abords','8 mm au moins','45 mm en travers au plus','jamais un cut posé ou différé par le lot','jamais un SKIP',
  '« Coupée » (par défaut), « Ombre » et « Corriger »','**Maj+Espace**','« Arrêter la relecture »'])assert.ok(s.includes(m),m);
 /* Les mêmes chiffres dans le code : pas de plafond d'ADV, trou de 40 cuts, marge d'un cut ; réglages proposés : écartement ouvert à 8 mm, 45 mm en travers ; fermé dans le défaut. */
 const R=require('../src/relecture-ombre.js'),Q=require('../src/relecture-critere.js');
 assert.equal(R.DEFAULTS.plafondParZone.adv,null);assert.equal(R.DEFAULTS.adv.fusionTrouCuts,40);assert.equal(R.DEFAULTS.ecartement.marge,1);
 const f=Q.reglages(JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','datasets/relecture-reglages-proposes.json'),'utf8')),'propose');
 assert.deepEqual(f.invalides,[]);assert.equal(f.zones.ecartement.corriger,true);assert.equal(f.zones.ecartement.seuilMm,8);assert.equal(f.voie.lateralMaxMm,45);assert.equal(f.zones.abords.seuilMm,8);
 assert.equal(Q.DEFAUT.zones.ecartement.corriger,false,'fermée sans fichier proposé');
 /* Les libellés du panneau cités. */
 assert.ok(s.includes('« Relecture après le lot »')||plat(section('1. Installer et vérifier')).includes('« Relecture après le lot »'));assert.match(html,/<legend class="lbl">Relecture après le lot<\/legend>/);
 assert.ok(html.includes('id="relecture-corriger" value="corriger"> Corriger (verts sûrs du PN, de l’ADV, des abords et des écartements hors norme, validés par Maj+Espace)'));
 assert.ok(html.includes('Arrêter la relecture</button>'));
});

test('lot en « Corriger » : une partie neuve (parties d\'apprentissage exclues), avant de démarrer, ne rien toucher pendant la relecture, les heures, puis une Écho complète et les cuts repris notés',()=>{
 const s=plat(section('2. Un lot en « Corriger »'));
 for(const m of ['**Une partie neuve**','PN et des ADV','**« Corriger »** **avant** de démarrer le lot','jusqu\'à la fin de la partie (« Dernier cut » vide)','**Ne touche à rien dans ESV pendant qu\'elle travaille.**',
  'l\'heure de début et l\'heure de fin','**une Écho complète**','**combien de cuts tu as dû reprendre parmi ceux qu\'Ariane a corrigés**','les cuts faux qu\'elle a laissés','« J’ai contrôlé le cut »','contrôle ce cut dans ESV'])assert.ok(s.includes(m),m);
 assert.ok(html.includes('J’ai contrôlé le cut</button>'));assert.ok(html.includes('>Lancer la relecture</button>'));assert.ok(fs.readFileSync(path.resolve(__dirname,'..','background.js'),'utf8').includes('Relecture finie :'));
 const M=require('../datasets/manifeste-parties.json'),liste=n=>M.apprentissage.filter(a=>a.projet===n).flatMap(a=>a.parties).sort((a,b)=>a-b);
 const p1=liste(1),p2=liste(2),et=l=>`${l.slice(0,-1).join(', ')}${l.length>1?' et ':''}${l.at(-1)}`;
 assert.deepEqual(p2,[1,11],'la partie 11 du second projet est passée en apprentissage (D-187)');
 assert.ok(s.includes(`pas les parties ${et(p1)} du premier projet, ni les parties ${et(p2)} du second`),'parties d\'apprentissage exclues');
});

test('lot en « Ombre » : une autre partie neuve, avant de démarrer, sans écrire, puis une Écho complète',()=>{
 const s=plat(section('3. Un lot en « Ombre »'));
 for(const m of ['si tu as le temps','autre partie neuve','**« Ombre »** **avant** de démarrer le lot','sans écrire','**une Écho complète**'])assert.ok(s.includes(m),m);
});

test('exports : tous les volumes, SHA-256, les heures ; le choix de la relecture noté ; cache vidé après confirmation',()=>{
 const f=plat(section('4. À la fin : les exports'));
 for(const m of ['Tout télécharger pour l\'analyse','après chaque lot','Le choix de la relecture y est noté (Ombre ou Corriger)','Exporte après « Relecture finie »','**tous les volumes**','SHA-256','tes heures','Terminer et télécharger',
  'Vide le cache seulement après ma confirmation de réception','remets « Coupée »'])assert.ok(f.includes(m),m);
});

test('retour arrière : la phrase de consignes/README.md (désactive, décompresse la test 7, réactive, Recharger, F5)',()=>{
 const r=plat(section('5. Si quelque chose ne va pas'));
 assert.match(r,/Ne désinstalle pas Ariane/);
 const readme=plat(fs.readFileSync(path.resolve(__dirname,'..','consignes/README.md'),'utf8'));
 const modele=readme.match(/« (Retour arrière : exporte[^»]*) »/)[1].replace(/test N-1/g,'test 7').replace(/test N\b/g,'test 8');
 assert.ok(r.includes(modele),'phrase du README');
 for(const m of ['Recharger','réactive','désactive'])assert.ok(r.includes(m),m);
 assert.ok(r.indexOf('envoie')<r.indexOf('désactive'));
});

test('aucune empreinte ; aucun identifiant de projet ESV ; aucune adresse ; aucun nom de modèle d\'IA ; aucun autre opérateur nommé',()=>{
 assert.deepEqual([...texte.replace(/\s+/g,'').matchAll(/[0-9a-f]{64}/g)],[]);
 assert.doesNotMatch(texte,/\d{6}_\d{6}_[A-Z]_/);
 assert.doesNotMatch(texte,/https?:\/\//);
 assert.doesNotMatch(texte,new RegExp(['cla'+'ude','anth'+'ropic','op'+'us','son'+'net','hai'+'ku','fa'+'ble','g'+'pt','gem'+'ini'].join('|'),'i'));
});

test('ce qui n\'est pas vérifié est dit ; la consigne tient sur une page',()=>{
 const s=plat(section('6. Ce qui n\'est pas vérifié'));
 for(const m of ['**Maj+Espace envoyé par Ariane a servi dans le vrai ESV**','18 corrections','aucune écriture refusée','nomme le cut','**Une zone d\'ADV peut encore échapper à Ariane**','cuts 6362 à 6424','Contrôle-la toi-même',
  'pas démontré pour l\'ADV, les abords et les écartements','3 cas seulement','estimée, pas mesurée','pas au fil du lot','Edge n\'a pas été vu'])assert.ok(s.includes(m),m);
 assert.ok(texte.split(/\s+/).length<1000,'une page : moins de 1 000 mots');
});
