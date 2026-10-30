'use strict';
/* RM-11 (test 9) — LA POSE NE CHANGE PAS ET LE LOT NE CHANGE PAS. La raison de la correction est une étiquette posée par l'opérateur dans Écho : elle ne touche ni
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
/* Test 17 : fichiers de l'habillage du panneau (`src/ui5*.js`, et `src/signal-rendu.js` pour Signal, D-250) : aucun ne lit ni ne commande la pose. */
const HABILLAGE=['ui5.js','ui5-variante.js','signal-rendu.js'];
/* Test 17 et 18 : la carte « Relecture » du panneau ne propose plus « Lancer la relecture » pendant une pause (elle repartirait de zéro) et dit si la correction interrompue est
 * celle de la deuxième passe ; module du panneau, il ne parle qu'au service worker. Ces deux changements retirés, il est celui de la test 8 (contrôlé plus bas). */
/* Test 25 (CH-018) : le déplacement de la vue à geste réglable, éteint par défaut. `gestes-vue.js` gagne `sequenceClicDroit` (non appelée tant que le réglage est éteint) ; l'adaptateur gagne un patch (chantiers/CH-018/adapter-deplacement.patch), retiré ici à l'envers avant la comparaison à la test 8 ; les réglages gagnent `deplacerVue.deplacement` (actif:false). */
const sansClicDroit=s=>s.replace(/ \/\* Glisser au bouton droit \(CH-018\)[\s\S]*?\n   return seq;\n \}\n/,'').replace('sequenceGlisser,sequenceClicDroit,construire','sequenceGlisser,construire');
const sansPatchs=texte=>sansPatchCH018(texte.replace(/\n \/\* CH-017 \(T27a, PROPOSÉ[\s\S]*?return \{ok:true,\.\.\.base,demandeA:Date\.now\(\)\};\}/,'').replace("capacites:['changerPartie',...MODES_PARTIE.filter(m=>m!=='lien').map(m=>'changerPartie:'+m)],",'').replace('nativeSnapshot,changerPartie,capture','nativeSnapshot,capture'));
/* Test 27 (CH-026) : `changerPartie` gagne trois modes (lien, invalide-suivant, suivant-dernier : clic sur le bouton d'ESV qui porte la commande, jamais de touche, de pose, de validation ni de SKIP) ; l'ajout (chantiers/CH-026/adaptateur-changement-partie.patch) fait partie du même retrait que celui de la test 25.
/* Test 25 (CH-017, D-268) : `changerPartie` (clic sur l'entrée « p=N » du sélecteur de parties, jamais de pose ni de validation) ajouté à l'adaptateur et à la liste du pont ; retiré ici avant la comparaison à la test 8. */
const sansChangerPartiePont=s=>s.replace("'changerPartie',",'');
const sansPatchCH018=texte=>{const os=require('node:os'),{spawnSync}=require('node:child_process'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch018-'));
 fs.mkdirSync(path.join(tmp,'src'),{recursive:true});fs.writeFileSync(path.join(tmp,'src/adapter-page.js'),texte);
 const r=spawnSync('patch',['-R','-p1','-d',tmp,'-i',path.join(racine,'chantiers/CH-018/adapter-deplacement.patch')],{encoding:'utf8'});
 assert.equal(r.status,0,'le patch de CH-018 se retire de l\'adaptateur : '+(r.stderr||r.stdout));return fs.readFileSync(path.join(tmp,'src/adapter-page.js'),'utf8');};
const PANNEAU={'src/gestes-vue.js':sansClicDroit,'src/carte-relecture.js':s=>s.replace("enCours||p?.etat==='en-pause'||!!c","enCours||!!c").replace("${c.origine==='passe'?'de la deuxième passe':'de la relecture'}",'de la relecture')};
/* Test 17 : module du panneau pour la pause de la relecture : il ne parle qu'au service worker (relecture-*), jamais à ESV ni à la pose. */
const RELECTURE_PAUSE=['relecture-pause.js'];
/* T20a : l'historique des parties (fiches de départ + fiches de fin de lot, `partsHistory`), module pur lu par le service worker pour la vue du panneau ;
 * il ne lit ni ne commande la pose. */
const HISTORIQUE=['historique-parties.js'];
/* Garde A de la deuxième passe (fiches/GARDE_PASSE_A.md) : module pur lu par le service worker pour la seule passe des différés (fin de lot, profil « L1-se ») ;
 * il ne lit ni ne commande la pose du lot. */
const GARDE_PASSE=['garde-passe-appuis.js'];
/* Test 25 (CH-018) : déplacement de la vue à geste réglable (src/deplacement-vue.js). Le détecteur de SKIP de CH-016 a été retiré à la demande de l'opérateur (D-268). */
const SKIP_OMBRE=['deplacement-vue.js'];
/* CH-017 : la file de parties (machine à états pure), lue par le service worker seulement quand `file.actif` est allumé (éteinte à la livraison) ;
 * elle ne lit ni ne commande la pose ; le lot qu'elle démarre est le lot ordinaire. */
const FILE_PARTIES=['file-parties.js'];
/* Test 25 (CH-019) : la garde « après un différé », module pur lu par le service worker au moment de la commande du lot ; elle ne fait que changer
 * une validation en différé (réglage `lot.gardeApresDiffere`, livré allumé ; coupé, les commandes sont celles d'avant :
 * tests/garde-apres-differe-coupee-sw.test.cjs). */
const GARDE_APRES_DIFFERE=['garde-apres-differe.js'];

test('la pose et le lot lisent les mêmes fichiers que la test 8, octet pour octet',()=>{
 const deplaces=[];
 for(const [f,empreinte] of Object.entries(REF.fichiers)){
  if(ECHO[f]||L1[f])continue;
  const texte=PANNEAU[f]?PANNEAU[f](lire(f)):VERSION_SEULE.includes(f)?sansChangerPartiePont(lire(f)).split('4.9.5.27').join('4.9.5.8').split('4.9.5 test 27 (F-V-G-S)').join('4.9.5 test 8'):lire(f);
  if(sha(texte)!==empreinte)deplaces.push(f);}
 assert.deepEqual(deplaces,[],'fichiers de pose ou de lot changés');
 assert.ok(Object.keys(REF.fichiers).length>=49);assert.ok(REF.fichiers['src/engine.js']&&REF.fichiers['src/geometry.js']&&REF.fichiers['src/lot-decision.js']);
 assert.ok(fs.existsSync(path.join(racine,'src/raison-correction.js')),'le seul fichier de src/ en plus');
 const nouveaux=fs.readdirSync(path.join(racine,'src')).filter(f=>f.endsWith('.js')&&!REF.fichiers['src/'+f]).sort();assert.deepEqual(nouveaux,[...NOUVEAUX,...HABILLAGE,...RELECTURE_PAUSE,...HISTORIQUE,...GARDE_PASSE,...SKIP_OMBRE,...FILE_PARTIES,...GARDE_APRES_DIFFERE].sort());
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
 const ap=sansPatchs(lire('src/adapter-page.js')).replace("if(!vue){const fin=snapshot();fin.vueFin=vueFin(fin);return fin;}",'if(!vue)return snapshot();').replace('fin.vueFin=vueFin(fin);','')
  .replace(/\n \/\* 4\.9\.5\.13 \(analyse du lot 2:19[\s\S]*?catch\(e\)\{return \{version:'vue-fin-v1',erreur:String\(e\?\.message\|\|e\)\.slice\(0,80\)\};\}\}/,'')
  /* T20a : relevé en lecture seule du sélecteur de parties, au ping de contrat (aucun clic, aucune écriture) : sans ces lignes, l'adaptateur est celui de la test 8. */
  .replace(/ \/\* T20a — RELEVÉ DU SÉLECTEUR DE PARTIES[\s\S]*?return \{status:'ok',current:c\.length===1\?c\[0\]\.part:null,parts\};\}\n/,'')
  .replace(/\n   const selecteur=options[^\n]*/,'').replace(",...(selecteur?{selecteurParties:selecteur}:{})",'');
 assert.equal(sha(ap),REF.fichiers['src/adapter-page.js'],'src/adapter-page.js hors vueFin');
 for(const f of ['src/early-input.js','src/engine.js','src/geometry.js','src/geometry-brain.js','src/geometry-candidate-v1.js','src/placement-convention.js','src/lot-decision.js',
  'src/regles-metier.js','src/hauteur-apprise.js','src/faux-vert-ombre.js','src/relecture-ombre.js','src/relecture-critere.js','src/verts-a-controler.js','src/voie-recentree.js'])
  assert.equal(sha(lire(f)),REF.fichiers[f],f);
 /* La session Écho ne touche pas au lot : elle ne lit rien du lot en plus (`differesDuLot`, mémoire des différés, existaient). */
 const diff=lire('src/native-session.js');assert.ok(!/batch\.scope|startBatch|lotCommands|applyInESV/.test(diff.slice(diff.indexOf('RM-11 (fiches/RM11'),diff.indexOf('summariseGesture(record,observed){'))));
});
test('les réglages sont ceux de la test 8, hors la ligne echo.raison et la recapture des captures vides (coupée)',()=>{
 const S=require('../src/settings.js'),canon=v=>JSON.stringify(v,(k,x)=>typeof x==='function'?'<fn>':x);
 const {echo,passeDifferesDefaut,file,relectureDefaut,...reste00}=S,{deplacement:_dep,actif:_dvActif,...deplacerVueSans0}=reste00.deplacerVue,deplacerVueSans={actif:false,...deplacerVueSans0},reste0={...reste00,deplacerVue:deplacerVueSans},{raison,...echoSans}=echo,{profil,recaptureVide,passeDifferes,gardeApresDiffere,...lotSans}=S.lot,reste={...reste0,lot:lotSans};
 assert.equal(profil,'L1-se','test 14 : profil du lot « L1-se » par défaut (L1-s, D-221, avec la décision L1-e des différés)');
 /* Test 16 (cap 5, 8cb7958) : seul réglage ajouté, la recapture d'une capture presque vide pendant un lot, COUPÉE par défaut ; le reste est l'empreinte d'avant. */
 assert.deepEqual(Object.keys(S.lot).filter(k=>!(k in lotSans)).sort(),['gardeApresDiffere','passeDifferes','profil','recaptureVide']);
 /* Test 25 (CH-019) : la garde « après un différé », livrée ALLUMÉE (règle R3) ; `actif:false` rend le lot d'avant (tests/garde-apres-differe-coupee-sw.test.cjs). */
 assert.deepEqual({...gardeApresDiffere},{actif:true,regle:'R3',coupures:2,appuisMin:2},'garde après un différé : R3, 2 cuts, moins de 2 appuis');
 assert.equal(recaptureVide.actif,false,'recapture des captures vides : coupée par défaut');
 /* Test 17 : la deuxième passe des différés, ALLUMÉE par la décision de l'opérateur ; test 21 (D-251, 26/10) : livrée EN OMBRE ; test 24 (D-259, 28/10) : livrée ALLUMÉE EN ÉCRITURE, plafonnée à 10 cuts par lot ; le reste est l'empreinte d'avant. */
 assert.deepEqual([passeDifferes.ombre,passeDifferes.ecriture,passeDifferes.ecritureMax],[true,true,10],'deuxième passe des différés : écriture, 10 cuts au plus par lot (D-259)');
 /* CH-017 : seule clé ajoutée au premier niveau après la passe, la file de parties, ÉTEINTE à la livraison. */
 assert.equal(file.actif,true,'file de parties : allumée par défaut dans la test 25 (D-268, ordre de l\'opérateur) ; la file ne part que si l\'opérateur la lance');
 /* Test 27 (CH-026, ordre de l'opérateur du 30/10) : clé ajoutée au premier niveau, la relecture « corriger » par défaut, non réglable. */
 assert.deepEqual({...relectureDefaut},{mode:'corriger',modifiable:false},'relecture après le lot : « corriger » par défaut, non réglable');
 assert.equal(passeDifferesDefaut,passeDifferes,'les valeurs livrées de la passe (seule clé ajoutée au premier niveau) sont celles du lot');
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
 /* Le choix du lot garde sa forme, rien de la raison ; test 18 : plus l'interrupteur de la deuxième passe, gardé au même endroit mais jamais figé dans le scope. */
 assert.deepEqual(Object.keys(await avec.b.api('choix-lot-etat')).sort(),['clicHumain','passeDifferes','regleGrappeDifferes']);assert.equal('passeDifferes' in scope,false);
 assert.equal((await avec.b.api('raison-choix-etat')).actif,true,'le choix de la raison est à part');
});
