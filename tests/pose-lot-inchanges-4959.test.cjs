'use strict';
/* RM-11 (test 9) — LA POSE NE CHANGE PAS ET LE LOT NE CHANGE PAS. La raison de la correction est une étiquette posée par Mic dans Écho : elle ne touche ni
 * à l'endroit où Orbite pose les rails, ni à la façon dont un lot se déroule.
 *  1. Tout ce que la pose et le lot lisent (`src/*.js`, réglages de la relecture, empreintes gelées de la géométrie) est identique octet pour octet à la
 *     test 8 (tests/pose-inchangee-4958.json, empreintes prises sur d58a6f1 avant la fonction). Seuls changent les fichiers de la liste ci-dessous, qui
 *     ne sont pas des fichiers de pose : la session Écho, l'observateur de page d'Écho, les réglages d'Écho, l'en-tête d'export, et les chaînes de version.
 *  2. Les réglages sont ceux de la test 8, hors la ligne `echo.raison`.
 *  3. Un lot joué avec la raison allumée au panneau envoie à ESV les mêmes commandes, octet pour octet, que le lot de la base (empreinte déjà gardée par
 *     tests/choix-lot-clic-sw.test.cjs), avec le même scope ; le choix du lot (`choix-lot-etat`) garde sa forme. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const REF=require('./pose-inchangee-4958.json');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
/* Les seuls fichiers de `src/` qui changent, et pourquoi. */
const ECHO={'src/native-session.js':'la session Écho : la raison, la collante, le résumé','src/native-page.js':'l\'observateur de page d\'Écho : la frappe d\'un chiffre de raison est essentielle',
 'src/settings.js':'les réglages d\'Écho : `echo.raison`','src/native-export.js':'l\'en-tête d\'export : `raisonSeries` écrit une seule fois'};
const VERSION_SEULE=['src/core.js','src/bridge.js'];   // le numéro de version, rien d'autre
/* 4.9.5.13 (test 13, profil du lot « L1 ») : le moteur rend son réservoir SUR DEMANDE (sortie par défaut inchangée, tests/gcv2-l1.test.cjs) ; deux
 * modules nouveaux, lus par le service worker seulement quand le lot porte le profil « L1 ». Le profil « actuel » joue le lot de la 4.9.5.9. */
const L1={'src/gcv1-shadow.js':'le réservoir du moteur sur demande (`scientificProposeBothAvecReservoir`), la sortie par défaut est inchangée',
 'src/adapter-page.js':'4.9.5.13 : `apply` rend en plus `vueFin` (position de chaque rail dans la vue à la fin de la pose, lecture seule, après la pose ; tests/apply-vue-fin-page.test.cjs)'};
/* 4.9.5.14 (test 14) : la décision L1-e des différés (fiches/L1_APPRENTISSAGE.md), lue par src/gcv2-l1.js sous le profil « L1-se ». */
const NOUVEAUX=['gcv2-l1.js','gcv2-l1e.js','gcv2-parametres-l1.js','raison-correction.js'];
/* Test 17 : fichiers de l'habillage du panneau (`src/ui5*.js`) : aucun ne lit ni ne commande la pose. */
const HABILLAGE=['ui5-rendu.js','ui5.js','ui5-variante.js'];
/* Test 17 : la carte « Relecture » du panneau ne propose plus « Lancer la relecture » pendant une pause (elle repartirait de zéro) ; module du panneau, il ne parle qu'au service worker. */
const PANNEAU={'src/carte-relecture.js':'la carte « Relecture » du panneau : « Lancer la relecture » caché pendant une pause'};
/* Test 17 : module du panneau pour la pause de la relecture : il ne parle qu'au service worker (relecture-*), jamais à ESV ni à la pose. */
const RELECTURE_PAUSE=['relecture-pause.js'];

test('la pose et le lot lisent les mêmes fichiers que la test 8, octet pour octet',()=>{
 const deplaces=[];
 for(const [f,empreinte] of Object.entries(REF.fichiers)){
  if(ECHO[f]||L1[f]||PANNEAU[f])continue;
  const texte=VERSION_SEULE.includes(f)?lire(f).split('4.9.5.16').join('4.9.5.8').split('4.9.5 test 16 (L1-e5)').join('4.9.5 test 8'):lire(f);
  if(sha(texte)!==empreinte)deplaces.push(f);}
 assert.deepEqual(deplaces,[],'fichiers de pose ou de lot changés');
 assert.ok(Object.keys(REF.fichiers).length>=49);assert.ok(REF.fichiers['src/engine.js']&&REF.fichiers['src/geometry.js']&&REF.fichiers['src/lot-decision.js']);
 assert.ok(fs.existsSync(path.join(racine,'src/raison-correction.js')),'le seul fichier de src/ en plus');
 const nouveaux=fs.readdirSync(path.join(racine,'src')).filter(f=>f.endsWith('.js')&&!REF.fichiers['src/'+f]).sort();assert.deepEqual(nouveaux,[...NOUVEAUX,...HABILLAGE,...RELECTURE_PAUSE].sort());
});
test('le moteur est celui de la baseline V4.6.0 (src/engine.js intact)',()=>{
 const base=require('../audit/v4.6.0-engine-baseline.json');
 assert.equal(sha(lire('src/engine.js')),REF.fichiers['src/engine.js']);
 assert.ok(JSON.stringify(base).includes(REF.fichiers['src/engine.js']),'l\'empreinte du moteur est celle de la baseline déclarée');
});
test('les fichiers modifiés ne sont pas des fichiers de pose : ni l\'adaptateur de page, ni la garde d\'entrée, ni le lot ne les lisent pour poser',()=>{
 for(const f of Object.keys(ECHO))assert.ok(REF.fichiers[f],f+' existait');
 /* L'adaptateur et la garde d'entrée (qui posent et valident) n'ont pas bougé : ils sont dans la liste comparée ci-dessus. */
 /* 4.9.5.13 : l'adaptateur de page ne change que par `vueFin` (lecture seule après la pose) : sans ces lignes, il est celui de la test 8. */
 const ap=lire('src/adapter-page.js').replace("if(!vue){const fin=snapshot();fin.vueFin=vueFin(fin);return fin;}",'if(!vue)return snapshot();').replace('fin.vueFin=vueFin(fin);','')
  .replace(/\n \/\* 4\.9\.5\.13 \(analyse du lot 2:19[\s\S]*?catch\(e\)\{return \{version:'vue-fin-v1',erreur:String\(e\?\.message\|\|e\)\.slice\(0,80\)\};\}\}/,'');
 assert.equal(sha(ap),REF.fichiers['src/adapter-page.js'],'src/adapter-page.js hors vueFin');
 for(const f of ['src/early-input.js','src/engine.js','src/geometry.js','src/geometry-brain.js','src/geometry-candidate-v1.js','src/placement-convention.js','src/lot-decision.js',
  'src/regles-metier.js','src/hauteur-apprise.js','src/faux-vert-ombre.js','src/relecture-ombre.js','src/relecture-critere.js','src/verts-a-controler.js','src/voie-recentree.js'])
  assert.equal(sha(lire(f)),REF.fichiers[f],f);
 /* La session Écho ne touche pas au lot : elle ne lit rien du lot en plus (`differesDuLot`, mémoire des différés, existaient). */
 const diff=lire('src/native-session.js');assert.ok(!/batch\.scope|startBatch|lotCommands|applyInESV/.test(diff.slice(diff.indexOf('RM-11 (fiches/RM11'),diff.indexOf('summariseGesture(record,observed){'))));
});
test('les réglages sont ceux de la test 8, hors la ligne echo.raison et la recapture des captures vides (coupée)',()=>{
 const S=require('../src/settings.js'),canon=v=>JSON.stringify(v,(k,x)=>typeof x==='function'?'<fn>':x);
 const {echo,...reste0}=S,{raison,...echoSans}=echo,{profil,recaptureVide,...lotSans}=S.lot,reste={...reste0,lot:lotSans};
 assert.equal(profil,'L1-se','test 14 : profil du lot « L1-se » par défaut (L1-s, D-221, avec la décision L1-e des différés)');
 /* Test 16 (cap 5, 8cb7958) : seul réglage ajouté, la recapture d'une capture presque vide pendant un lot, COUPÉE par défaut ; le reste est l'empreinte d'avant. */
 assert.deepEqual(Object.keys(S.lot).filter(k=>!(k in lotSans)).sort(),['profil','recaptureVide']);
 assert.equal(recaptureVide.actif,false,'recapture des captures vides : coupée par défaut');
 assert.equal(sha(canon(reste)),REF.reglages.reste,'réglages de la pose, du lot, de l\'export, de la relecture : inchangés');
 assert.equal(sha(canon(echoSans)),REF.reglages.echo,'réglages d\'Écho hors la raison : inchangés');
 assert.equal(raison.actif,false,'coupée par défaut');
});
test('les réglages proposés et par défaut de la relecture, et les empreintes gelées de la géométrie, sont inchangés',()=>{
 for(const f of ['datasets/relecture-reglages-defaut.json','datasets/relecture-reglages-proposes.json'])assert.equal(sha(lire(f)),REF.fichiers[f],f);
 for(const [f,e] of Object.entries(REF.fichiers))if(f.startsWith('audit/v4.'))assert.equal(sha(lire(f)),e,f);
});

test('lot : avec la raison allumée au panneau, les commandes envoyées à ESV sont celles de la base, octet pour octet, et le scope du lot est le même',async()=>{
 const {lotClic,neutre}=require('./helpers/choix-lot.cjs'),{GOLDEN,h,versionGolden,j,scopeDe}=require('./helpers/choix-lot-essais.cjs');
 const CLE='banane50Raison';
 const avec=await lotClic({choix:{[CLE]:{actif:true,touches:'alt-chiffres'}}});
 assert.deepEqual(avec.commandes.map(c=>c.action??null),GOLDEN.clic.actions);
 assert.equal(h(versionGolden(neutre(avec.commandes))),GOLDEN.clic.empreinteCommandes,'commandes identiques à celles de la base (empreinte gardée), octet pour octet');
 assert.deepEqual(j(avec.options),GOLDEN.clic.applyOptions,'apply sans option');
 const scope=scopeDe(avec.b);assert.ok(!JSON.stringify(scope).includes('raison'),'aucune raison dans le scope du lot');
 assert.equal('clicHumain' in scope,false,'le scope du lot est celui d\'avant');assert.equal('lotProfil' in scope,false,'profil « actuel » : le scope n\'en porte rien');assert.equal('regleGrappeDifferes' in scope,false);
 const etatLot=neutre(avec.b.get('engine').s.batch);assert.ok(!JSON.stringify(etatLot).includes('raison'),'aucune raison dans l\'état du lot');
 /* Le choix du lot garde sa forme : deux clés, rien de la raison. */
 assert.deepEqual(Object.keys(await avec.b.api('choix-lot-etat')).sort(),['clicHumain','regleGrappeDifferes']);
 assert.equal((await avec.b.api('raison-choix-etat')).actif,true,'le choix de la raison est à part');
});
