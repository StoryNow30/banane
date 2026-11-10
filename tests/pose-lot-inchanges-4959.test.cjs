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
const racine=path.resolve(__dirname,'..');
/* Vision 9 (CH-087, accord de l'opérateur) : le prénom de l'opérateur est retiré des COMMENTAIRES de l'adaptateur et de lot-decision.js ; pour comparer à
 * l'empreinte de référence, ces seules tournures sont remises telles qu'elles étaient. Toute autre modification de ces fichiers reste détectée. */
const PRENOM_RETIRE=[["D-164, l'opérateur : «","D-164, Mic : «"],["le geste de l'opérateur.","le geste de Mic."],["l'opérateur valide TOUJOURS","Mic valide TOUJOURS"],
 ["(l'opérateur, deux fois, D-179)","(Mic, deux fois, D-179)"],["comme l'opérateur la fait","comme Mic la fait"],
 ["pose de l'opérateur − pose d'Ariane, « + » = l'opérateur remonte","pose de Mic − pose d'Ariane, « + » = Mic remonte"]];
const lire=f=>{let t=fs.readFileSync(path.join(racine,f),'utf8');if(f==='src/adapter-page.js'||f==='src/lot-decision.js')for(const [a,b] of PRENOM_RETIRE)t=t.split(a).join(b);return t;};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
/* CH-065 (D-293) : lecture directe du LiDAR et recherche élaguée, patchs déclarés à parité au bit (chantiers/CH-065/blocs.json) ; ces blocs retirés,
 * src/geometry.js et src/geometry-candidate-v1.js sont ceux de la test 8. Toute autre modification reste détectée. */
const CH065=require('../chantiers/CH-065/appliquer.cjs');
const sansCH065=(f,t)=>CH065.BLOCS[f]?CH065.versions(racine,f).origine:t;
/* CH-086 : écritures après la validation en fond, patchs déclarés (chantiers/CH-086/engine.patch, et engine-baseline.patch qui ré-épingle
 * audit/v4.6.0-engine-baseline.json). Quand un fichier porte le sien (marque), il est retiré à l'envers sur une copie : le reste doit être,
 * octet pour octet, celui de la test 8. Un patch
 * qui ne se retire plus net échoue (texte rendu inchangé, donc empreinte différente). Toute autre modification reste détectée. */
const CH086={'src/engine.js':['engine.patch','porteEcritures'],'audit/v4.6.0-engine-baseline.json':['engine-baseline.patch','previousHashCH086']};
/* CH-091 : reprise d'un lot arrêté entre la capture avant et l'analyse, patchs déclarés de la même façon (chantiers/CH-091/engine.patch et
 * engine-baseline.patch, posés PAR-DESSUS ceux de CH-086) : ils sont retirés d'abord, puis ceux de CH-086. */
const CH091={'src/engine.js':['engine.patch','captureAvantDejaFaite'],'audit/v4.6.0-engine-baseline.json':['engine-baseline.patch','previousHashCH091']};
const sansPatch=(dossier,table)=>(f,t)=>{const c=table[f];if(!c||!t.includes(c[1]))return t;
 const os=require('node:os'),{spawnSync}=require('node:child_process'),d=fs.mkdtempSync(path.join(os.tmpdir(),'ch086g-'));
 fs.mkdirSync(path.join(d,path.dirname(f)),{recursive:true});fs.writeFileSync(path.join(d,f),t);
 const r=spawnSync('patch',['-s','-R','-p1','-d',d,'-i',path.join(racine,'chantiers',dossier,c[0])],{encoding:'utf8'});
 const sortie=r.status===0?fs.readFileSync(path.join(d,f),'utf8'):t;fs.rmSync(d,{recursive:true,force:true});return sortie;};
/* CH-094 : après une pause « écriture non confirmée », la reprise repasse la porte ; patchs déclarés de la même façon (chantiers/CH-094/engine.patch
 * et engine-baseline.patch, posés PAR-DESSUS ceux de CH-091) : ils sont retirés d'abord, puis ceux de CH-091, puis ceux de CH-086. */
const CH094={'src/engine.js':['engine.patch','fenetreRestee'],'audit/v4.6.0-engine-baseline.json':['engine-baseline.patch','previousHashCH094']};
const sansCH094=sansPatch('CH-094',CH094),sansCH091=(f,t)=>sansPatch('CH-091',CH091)(f,sansCH094(f,t)),sansCH086=(f,t)=>sansPatch('CH-086',CH086)(f,sansCH091(f,t));
/* CH-096 (D-319) : trois défauts de l'adaptateur et du noyau corrigés par patchs déclarés de la même façon (chantiers/CH-096/adapter-page.patch :
 * l'arrêt pendant une pose recliquée n'est plus rattrapé, `validerMajEspace` reçoit son suivi ; chantiers/CH-096/core.patch : « Niveau de détail non
 * stabilisé. » suivi d'une erreur de lecture reste passager). Posés en DERNIER : retirés d'abord, avant tout autre retrait. Aucun ne change une pose,
 * une validation ni une commande d'un lot sans panne (tests/ch096-*.test.cjs). Toute autre modification de ces fichiers reste détectée. */
const CH096={'src/adapter-page.js':['adapter-page.patch','CH-096'],'src/core.js':['core.patch','CH-096']};
const sansCH096=sansPatch('CH-096',CH096);
/* Les seuls fichiers de `src/` qui changent, et pourquoi. */
const ECHO={'src/native-lidar.js':'CH-049-A : la lecture passive d\'Écho compare la découpe d\'ESV à chaque pause (N.capture n\'est appelé que par nativeCapture, l\'Écho ; Orbite ne l\'utilise pas)','src/native-session.js':'la session Écho : la raison, la collante, le résumé','src/native-page.js':'l\'observateur de page d\'Écho : la frappe d\'un chiffre de raison est essentielle',
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
/* CH-062 (A, réglage `lot.signalEteint.ligneDeBaseEchecs`, coupé) : ligne de base du compteur de Potree par les requêtes de points en échec ;
 * sans ces lignes, l'adaptateur est celui d'avant (chargementsEffectifs rend chargementsEsv quand le réglage est coupé). */
const sansCH062=t=>t.replace(/\n \/\* CH-062 \(PROPOSÉ ; réglages `lot\.signalEteint\.ligneDeBaseEchecs`[\s\S]*?\n   return out;\}/,'')
 .split('chargementsEffectifs()').join('chargementsEsv()').split(',...releveLigneBase()').join('')
 .replace(/\n   try\{const t=trouEchec\(expected\);if\(t\)data\.readStrategy\.trouEchec=t;\}catch\{\/\* CH-062 : relevé seulement \*\/\}/,'');
/* CH-062 : l'observateur relaie l'événement `ligne-base-repli` du patch de la page (lecture seule, aucune pose) ; sans ces lignes, il est celui de la test 8. */
/* D-305, piste 0 : relevé en lecture seule du cache, de l'attente du serveur et du transfert des nœuds ept-data, retiré pour comparer. */
const sansD305Obs=t=>t.replace(/\n      \/\* D-305, piste 0 \(mesure en lecture seule\)[\s\S]*?x\.trf=\(x\.trf\|\|0\)\+\(end-rq\);\}/,'')
  .replace(",\n      ...(a.ept.cache?{depuisCache:a.ept.cache}:{}),...(Number.isFinite(a.ept.srv)?{attenteServeurMs:Math.round(a.ept.srv),transfertMs:Math.round(a.ept.trf)}:{})}:{})});","}:{})});");
/* CH-080 (D-309) : `voisins` rend à la demande UNE ligne de plus (`loin` : cible ou suivante non validée de la table), pour le préchauffage seulement ;
 * le relais garde `saut` et `source` (dans le bloc de CH-077, retiré avec lui). Retiré pour comparer. */
const sansCH080Obs=t=>t.replace(/\n  \/\* CH-080 \(D-309\) : UNE ligne de plus au plus[\s\S]*?if\(t\.st\[i\]!==STATUS_CODE\.valid\)\{loin=ligne\(i\);break;\}\}/,'').replace(',rows,...(loin!==undefined?{loin}:{})};',',rows};');
/* CH-081 (D-311) : `voisins` rend aussi, à la demande, la première ligne non validée de toute la table (`premiere`), pour le préchauffage seulement. Retiré pour comparer. */
const sansCH081Obs=t=>t.replace(/\n  \/\* CH-081 : `premiere:true`[^\n]*\n[^\n]*premiere===true[^\n]*/,'');
/* CH-088 : `voisins` rend aussi, à la demande, la prochaine cible lointaine de la chaîne des non validés (`loin`), pour le préchauffage seulement. Retiré pour comparer.
 * Les champs relayés de CH-088 (bilan à l'arrivée, `prechauffage-loin`, `camera`) sont dans le bloc de CH-077, retiré avec lui. */
const sansCH088Obs=t=>t.replace(/\n  \/\* CH-088 : `loin:S`[\s\S]*?prec=i;\}\}/,'');
/* CH-077 : l'observateur relaie les événements du préchauffage (comptes et classes seulement), retirés pour comparer. */
const sansCH077Obs=t=>t.replace("if(Object.hasOwn(PRECH_CHAMPS,k)){if(enabled)record(reduirePrechauffage(k,x));return;}/* CH-077 */",'').replace(/ \/\* CH-077 : champs gardés[\s\S]*?  return out;\}\n/,'');
const sansCH062Obs=t=>sansD305Obs(sansCH077Obs(sansCH080Obs(sansCH081Obs(sansCH088Obs(t))))).replace(",'diag-compteur-bloque':null,'ligne-base-repli':null});   /* CH-062 : posté par le patch proposé de la page */",",'diag-compteur-bloque':null});")
 .replace(/\n    \/\* CH-062 : ligne de base du compteur abandonnée[\s\S]*?pageMs:finite\(x\.pageMs\)\?Math\.round\(x\.pageMs\*10\)\/10:null\}\);\}/,'}');
const sansPatchs=texte=>sansPatchCH018(sansCH062(texte).replace(/\n \/\* CH-017 \(T27a, PROPOSÉ[\s\S]*?return \{ok:true,\.\.\.base,demandeA:Date\.now\(\)\};\}/,'').replace("capacites:['changerPartie',...MODES_PARTIE.filter(m=>m!=='lien').map(m=>'changerPartie:'+m)],",'').replace('nativeSnapshot,changerPartie,capture','nativeSnapshot,capture'));
/* Test 27 (CH-026) : `changerPartie` gagne trois modes (lien, invalide-suivant, suivant-dernier : clic sur le bouton d'ESV qui porte la commande, jamais de touche, de pose, de validation ni de SKIP) ; l'ajout (chantiers/CH-026/adaptateur-changement-partie.patch) fait partie du même retrait que celui de la test 25.
/* Test 25 (CH-017, D-268) : `changerPartie` (clic sur l'entrée « p=N » du sélecteur de parties, jamais de pose ni de validation) ajouté à l'adaptateur et à la liste du pont ; retiré ici avant la comparaison à la test 8. */
const sansChangerPartiePont=s=>s.replace("'changerPartie',",'');
const sansPatchCH018=texte=>{const os=require('node:os'),{spawnSync}=require('node:child_process'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ch018-'));
 fs.mkdirSync(path.join(tmp,'src'),{recursive:true});fs.writeFileSync(path.join(tmp,'src/adapter-page.js'),texte);
 /* Test 34 (CH-038) : la remise de la vue ne lève plus (`vueNonRestituee`), retirée la première (chantiers/CH-038/adaptateur-remise-vue.patch). */
 const r38=spawnSync('patch',['-R','-p1','-d',tmp,'-i',path.join(racine,'chantiers/CH-038/adaptateur-remise-vue.patch')],{encoding:'utf8'});assert.equal(r38.status,0,'le patch de CH-038 se retire de l\'adaptateur : '+(r38.stderr||r38.stdout));
 /* Test 29 (CH-031) : la durée de la remise de la vue (`dureeMs`, lecture de l'horloge) s'ajoute à `remettreVue` ; retirée d'abord, avant celle de CH-018. */
 const r31=spawnSync('patch',['-R','-p1','-d',tmp,'-i',path.join(racine,'chantiers/CH-031/adapter-page-remise.patch')],{encoding:'utf8'});assert.equal(r31.status,0,'le patch de CH-031 se retire de l\'adaptateur : '+(r31.stderr||r31.stdout));
 const r=spawnSync('patch',['-R','-p1','-d',tmp,'-i',path.join(racine,'chantiers/CH-018/adapter-deplacement.patch')],{encoding:'utf8'});
 assert.equal(r.status,0,'le patch de CH-018 se retire de l\'adaptateur : '+(r.stderr||r.stdout));return fs.readFileSync(path.join(tmp,'src/adapter-page.js'),'utf8');};
const PANNEAU={'src/esv-observer.js':t=>sansCH062Obs(t),'src/gestes-vue.js':sansClicDroit,'src/carte-relecture.js':s=>s.replace("enCours||p?.etat==='en-pause'||!!c","enCours||!!c").replace("${c.origine==='passe'?'de la deuxième passe':'de la relecture'}",'de la relecture')};
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
/* CH-028 : la liste de cuts à corriger (correction dans Orbite), module pur lu par le service worker APRÈS le lot clos (`correction-liste`) ; elle ne lit ni
 * ne commande la pose, et le lot ne la lit pas. */
const CORRECTION=['correction-liste.js'];
/* CH-034 : la recherche large (src/recherche-large.js), module pur lu par le service worker au moment de la commande du lot, ÉTEINT par défaut
 * (réglage `lot.rechercheLarge`) ; éteint, les commandes sont celles d'avant (tests/recherche-large-sw.test.cjs). */
const RECHERCHE_LARGE=['recherche-large.js'];
/* CH-051 : la garde « série de captures vides » (src/serie-captures-vides.js), détecteur pur lu par le service worker autour de la capture du lot,
 * ALLUMÉE par défaut depuis D-283 (décision de l'opérateur du 05/11, réglage `lot.serieCapturesVides`, retour arrière `actif:false`) ; coupée, la capture est celle d'avant (tests/lot-serie-captures-vides-sw.test.cjs). */
const SERIE_VIDES=['serie-captures-vides.js'];
/* CH-055 : la règle de voie « b1-ecart » EN OMBRE (src/voie-b1-ecart.js, mesure chantiers/CH-053/M-rapport.md), module pur lu par le service worker après
 * la commande d'un cut différé (réglage `lot.voieB1EcartOmbre`, consigné seulement) ; coupé ou actif, les commandes sont celles d'avant (tests/voie-b1-ecart-ombre-sw.test.cjs). */
const VOIE_B1_ECART=['voie-b1-ecart.js'];
/* CH-059 : l'état est ÉCRIT en morceaux (`src/etat-morceaux.js`, lu par `src/storage.js`) ; l'état relu en mémoire est identique à l'état
 * sauvegardé (tests/ch059-etat-borne.test.cjs) : ni la pose ni le lot ne lisent autre chose qu'avant. */
/* CH-079 (D-308) : la garde de voie et le serrage du lot, EN OMBRE (src/garde-voie-ombre.js, src/serrage-lot-ombre.js) : modules purs qui calculent et rendent un événement ; ni la pose ni la décision du lot ne les lisent (tests/ch079-garde-serrage.test.cjs). */
const CH079=['garde-voie-ombre.js','serrage-lot-ombre.js'];
const ETAT_MORCEAUX=['etat-morceaux.js'];
const STOCKAGE={'src/storage.js':'CH-059 : écriture de l\'état en morceaux, relecture identique (tests/ch059-etat-borne.test.cjs, tests/ch059-morceaux.test.cjs)'};
/* CH-053-S : la file prioritaire des cuts à corriger (src/file-prioritaire.js), module pur NON BRANCHÉ (ni service worker ni panneau) : il range des candidats, ne lit ni ne commande la pose. */
const FILE_PRIORITAIRE=['file-prioritaire.js'];
/* CH-053-C : la reconstruction de l'état initial d'Écho (src/native-reconstruction.js), module pur lu HORS LIGNE par tools/taux-apprenables.cjs (définition assouplie) : ni le service worker, ni la page, ni le lot ne le lisent. */
const RECONSTRUCTION=['native-reconstruction.js'];
/* CH-058 : l'index du journal en mémoire (lectures bornées d'IndexedDB) : il enveloppe le stockage du service worker et ne fait que choisir
 * quelles clés lire ; chaque appelant refiltre, résultat identique à la lecture complète. Il ne lit ni ne commande la pose. */
const JOURNAL_INDEX=['journal-index.js'];
/* CH-060 : le signal de fin de chargement d'ESV éteint pendant la relecture (src/relecture-signal.js) : partie pure, lue par la relecture seule (après le
 * lot) ; elle ne lit ni ne commande la pose. Son réglage `relectureSignalEteint` est ALLUMÉ depuis D-290 (vérifié plus bas). */
const SIGNAL_RELECTURE=['relecture-signal.js'];

/* D-284 (ordre de l'opérateur du 05/11) : la sélection de la relecture relit les voisins d'un cut « À contrôler » et bouche les trous de 3 cuts au
 * plus ; sans ces lignes, src/relecture-ombre.js est celui de la test 8. Toute autre modification du fichier reste détectée. */
/* D-289 (opérateur, 06/11 : « plafond oui ») : plus de plafond pour les abords ; sans ces lignes, le plafond est celui de la test 8. */
const sansD284=t=>t
 .replace(/\n  \/\* D-289 \(opérateur, 06\/11[\s\S]*?\*\/\n  plafondParZone:Object\.freeze\(\{adv:null,abords:null,/,"\n  plafondParZone:Object.freeze({adv:null,abords:70,")
 .replace(/\n  \/\* D-284 \(ordre de l'opérateur du 05\/11[\s\S]*?aControler:Object\.freeze\(\{marge:1\}\),trouMaxCuts:3,/,'')
 .replace(",trou:'trou bouché'};","};")
 .replace(/\n   if\(motif==='a-controler'\)\{const m=[^\n]*/,'')
 .replace(/\n  \/\* D-284 : trou de 1 à[\s\S]*?\}\}\}/,'')
 .replace("(p.zone||ZONE[p.motif]||'vert-hors-zone')===z)for(let c=p.a;c<=p.z;c++)if(!zoneDe.has(c))","(ZONE[p.motif]||'vert-hors-zone')===z)for(let c=p.a;c<=p.z;c++)if(!zoneDe.has(c))")
 .replace("'ecartement','trou']),","'ecartement']),");
/* D-296 (CH-064, étape 6 a) : lecture LiDAR en Rust dans la page. Un fichier de page en plus (src/lidar-rust.js, le chargeur), et l'adaptateur
 * qui choisit la variante de la lecture quand le noyau est chargé et le réglage `rust.lidar` allumé. La sortie de capture() est identique au bit près
 * (parité sur les 4 647 captures réelles du 04 au 06/11, Node et Chromium ; tests/rust-lidar.test.cjs) ; sans ces lignes, l'adaptateur est celui d'avant. */
const RUST_LIDAR=['lidar-rust.js'];
/* CH-077 (D-305, piste 3 ; D-307 : intégré et ALLUMÉ pour un lot d'essai) : le préchauffage du cache du navigateur pour la coupe suivante (src/prechauffage.js),
 * branché dans l'adaptateur par chantiers/CH-077/adapter-page.patch : un bloc de branchement, l'annulation au début de capture() et l'appel non attendu
 * à la fin d'une capture réussie. Il ne lit ni ne commande la pose ; sans ces lignes, l'adaptateur est celui d'avant. */
/* CH-081 (D-311) : deux modules purs de la page lus par src/prechauffage.js (zone en boîte de découpe, anticipation) ; ni pose ni validation. */
const PRECHAUFFAGE=['prechauffage.js','prechauffage-boite.js','prechauffage-anticipation.js'];
/* CH-080 (D-309, Vision 6) : le branchement du préchauffage passe à l'observateur UNE ligne de plus (`cible` ou `suivante`) et la cible du service worker
 * (`expected.prechauffage`) à `apresCapture` ; ni pose ni validation. Retiré avant CH-077. */
/* CH-081 (D-311, Vision 8) : le branchement passe `premiere` à l'observateur et la vue de Potree (lecture seule) à `apresCapture` ; ni pose ni validation. Retiré avant CH-080. */
/* CH-083 (D-314) : chantiers/CH-083/adapter-page.patch ajoute `pointLoadLimit` (lecture seule de Potree) à cette même vue, sur la même ligne : retiré avec elle.
 * La phase mémoire vit dans src/prechauffage.js (liste PRECHAUFFAGE) ; ses champs relayés sont dans les blocs de CH-077 de l'observateur et du service worker. */
/* CH-088 : chantiers/CH-088/adapter-page.patch fait passer `loin` (et `max`) à l'observateur dans la même ligne : retiré avec `premiere`. */
const sansCH080=t=>t.replace(":quoi?.premiere===true?{premiere:true}:Number.isInteger(quoi?.loin)?{loin:quoi.loin,...(Number.isInteger(quoi.max)?{max:quoi.max}:{})}:{};   /* CH-081 : premiere ; CH-088 : loin (cible lointaine de la liste du lot) */return new Promise(",":{};return new Promise(")
 .replace(":quoi?.premiere===true?{premiere:true}:{};   /* CH-081 : premiere */return new Promise(",":{};return new Promise(")
 .replace(/suivante:expected\?\.prechauffage\?\?null,\n     \/\* CH-081 : caméra active[^\n]*\n     vue:\(\)=>\(\{[^\n]*?\}\)\}\)\)\.catch/,"suivante:expected?.prechauffage??null})).catch")
 .replace(/\n \/\* CH-080 \(D-309\) : `quoi` ajoute[^\n]*/,'')
 .replace("function voisinsB1(cut,world,quoi){const plus=Number.isInteger(quoi?.cible)?{cible:quoi.cible}:quoi?.suivante===true?{suivante:true}:{};return new Promise(","function voisinsB1(cut,world){return new Promise(")
 .replace("fenetre:10,world,...plus},location.origin)","fenetre:10,world},location.origin)")
 .replace(/pointclouds:c\.viewer\?\.scene\?\.pointclouds\|\|\[\],\n     suivante:expected\?\.prechauffage\?\?null\}\)\)\.catch\(\(\)=>\{\}\);\}catch\{\}\}[^\n]*/,"pointclouds:c.viewer?.scene?.pointclouds||[]})).catch(()=>{});}catch{}}");
/* CH-084 (réglages `pilote.repliCourt` et `pilote.imagesMin`, éteints par défaut) : deux attentes de `attendreChargement`, sorties identiques éteintes
 * (tests/ch084-attentes-capture.test.cjs) ; sans ces lignes, l'adaptateur est celui d'avant CH-084. Sans effet tant que le tronc ne porte pas CH-084. */
const sansCH084=t=>t.replace("attenteClicMs:5000,\n   repliCourt:{actif:false,silenceMs:600},imagesMin:3};   /* CH-084 : les deux attentes de la capture, éteintes par défaut */","attenteClicMs:5000};")
 .replace(/\n   \/\* CH-084 \(réglages `pilote\.imagesMin`[^\n]*\n[^\n]*\n[^\n]*\n   const IMIN=[^\n]*/,'')
 .replace("f-f0>=IMIN&&libre","f-f0>=3&&libre").replace("f-f0<IMIN?'images'","f-f0<3?'images'")
 .replace("     const silence=Date.now()-depuis,court=RCMS!==null&&ch===0&&silence>=RCMS&&silence<stableForMs;\n     if(sig.count>0&&(silence>=stableForMs||court)){","     if(sig.count>0&&Date.now()-depuis>=stableForMs){")
 .replace(",...releveLigneBase(),...(court?{rc:1}:{})}};}",",...releveLigneBase()}};}");
const sansCH077=t=>sansCH080(sansCH084(t))
 .replace(/\n \/\* CH-077 \(réglage `lot\.chargement\.prechauffer`[\s\S]*?\n function prechaufferApres\(expected\)[^\n]*\n[^\n]*\n[^\n]*catch\{\}\}/,'')
 .replace("{try{PRECH?.annuler('capture');}catch{}noterCompteurDebutCut();","{noterCompteurDebutCut();")
 .replace(/\n   prechaufferApres\(expected\);   \/\* CH-077[^\n]*/,'');
/* CH-084 (D-313) : fin de la fenêtre de la validation sur place (Maj+Espace, relecture « corriger ») par l'écriture « valid » vue, réglage
 * `validationSurPlace` ; le lot ne l'appelle pas (tests/u3-raccourcis.test.cjs). Retiré pour comparer : l'adaptateur est celui d'avant. */
const sansCH084v=t=>t
 .replace(/\n \/\* CH-084 \(D-313\) — fin de la fenêtre sur place[\s\S]*?\n     else await sleep\(P\.sondageMs\);\}\}/,'')
 .replace(/\n   let envoiEpoch=null;try\{const t=performance\.timeOrigin\+performance\.now\(\);envoiEpoch=Number\.isFinite\(t\)\?t:null;\}catch\{envoiEpoch=null;\}/,'')
 .replace(/\n   const fenetre=VSP\.actif\?[^\n]*\n   const apres=VSP\.actif\?fenetre\.apres:(await attendreAutreCut\(identity,Math\.min\(P\.attenteNavigationMs,FENETRE_SUR_PLACE_MS\)\));\n   if\(VSP\.actif\)evidence\.finFenetre=[^\n]*/,'\n   const apres=$1;')
 .replace("window.addEventListener('message',async e=>{if(e.source===window&&e.origin===location.origin&&e.data?.kind==='banane5:esv-observation'){noterEcritureObservee(e.data.entry);return;}\n   if(e.source!==window","window.addEventListener('message',async e=>{if(e.source!==window");
const sansRustLidar=t=>t
 .replace(/\n \/\* D-296 \(CH-064, étape 6 a\) : lecture LiDAR en Rust\.[\s\S]*?\n const lecteurLidar=\(\)=>RUST_LIDAR&&LR&&LR\.pret\(\)\?LR:L;/,'')
 .replace("async function captureOnce(expected,guard,lecture='reference',progress=null,cote=null){guard();const c=context();const lu=lecteurLidar();\n   const data=await lu.capture({",
  "async function captureOnce(expected,guard,lecture='reference'){guard();const c=context();\n   const data=await L.capture({")
 .replace(/\n   \/\* étape `rust` : servi, repli, raison[^\n]*\n   if\(progress&&\(LR\|\|RUST_LIDAR\)\)[^\n]*/,'')
 .replace("captureOnce(expected,guard,piece(lecture,'lecture')?'rapide':'reference',progress,side)","captureOnce(expected,guard,piece(lecture,'lecture')?'rapide':'reference')");
/* CH-087 : retrait du prénom de l'opérateur dans les COMMENTAIRES de ces fichiers (aucune ligne de code ne change : `git diff -w` ne montre que des
 * lignes de commentaire). L'empreinte de référence est remplacée, fichier par fichier, par celle du texte après ce retrait ; tout autre changement
 * redevient rouge. Retrait déclaré, comme les autres retraits de cette garde. */
const CH087={
 'src/export-cache.js':'ec75c86fc041d0c6b21aa23072baff8e5cb8ab613d1030eb6f86dd0636fc8441',
 'src/liste-memoire.js':'0adb19635ddc562389f20592e7d23caa68c62ac9be38e77bea56beabdd750956',
 'src/regles-metier.js':'43a4e6015a68fcfb94de9cccfdf5ed0781a285fb91dad66bca8c68ca287e8ab4',
 'src/relecture-critere.js':'c6e24713e40d96a0ca320df914d9e682b7a8005e5ce3fe43d679893e0e9195ad',
 'src/relecture-ombre.js':'d0739ce530bf5489f4b167d55ea91c7609120a6b7c23db333b0383e338d919e2'};
test('la pose et le lot lisent la test 8 : octets identiques, ou AST identique pour CH-075',()=>{
 const deplaces=[];
 for(const [f,empreinte] of Object.entries(REF.fichiers)){
  if(ECHO[f]||L1[f]||STOCKAGE[f])continue;
  const texte=f==='src/relecture-ombre.js'?sansD284(lire(f)):PANNEAU[f]?PANNEAU[f](lire(f)):VERSION_SEULE.includes(f)?sansChangerPartiePont(sansCH096(f,lire(f))).split("VERSION='5',VERSION_NAME='5'").join("VERSION='4.9.5.8',VERSION_NAME='4.9.5 test 8'").split('Ariane 5 · ouvrir').join('Ariane 4.9.5 test 8 · ouvrir'):sansCH086(f,sansCH065(f,lire(f)));
  if(f==='src/appuis-liste.js'){
   /* CH-075 : annotations seules ; --origine rattache la preuve AST au SHA historique sans imposer Git aux archives. */
   const T=require('../tools/typage-ch075.cjs');assert.equal(empreinte,T.ORIGINE);T.identite();
  }else if(sha(texte)!==(CH087[f]||empreinte))deplaces.push(f);}
 assert.deepEqual(deplaces,[],'fichiers de pose ou de lot changés');
 assert.ok(Object.keys(REF.fichiers).length>=49);assert.ok(REF.fichiers['src/engine.js']&&REF.fichiers['src/geometry.js']&&REF.fichiers['src/lot-decision.js']);
 assert.ok(fs.existsSync(path.join(racine,'src/raison-correction.js')),'le seul fichier de src/ en plus');
 const nouveaux=fs.readdirSync(path.join(racine,'src')).filter(f=>f.endsWith('.js')&&!REF.fichiers['src/'+f]).sort();assert.deepEqual(nouveaux,[...NOUVEAUX,...HABILLAGE,...RELECTURE_PAUSE,...HISTORIQUE,...GARDE_PASSE,...SKIP_OMBRE,...FILE_PARTIES,...GARDE_APRES_DIFFERE,...CORRECTION,...RECHERCHE_LARGE,...SERIE_VIDES,...FILE_PRIORITAIRE,...RECONSTRUCTION,...VOIE_B1_ECART,...CH079,...ETAT_MORCEAUX,...JOURNAL_INDEX,...SIGNAL_RELECTURE,...RUST_LIDAR,...PRECHAUFFAGE].sort());
});
test('le moteur est celui de la baseline V4.6.0 (src/engine.js intact)',()=>{
 const base=require('../audit/v4.6.0-engine-baseline.json');
 assert.equal(sha(sansCH086('src/engine.js',lire('src/engine.js'))),REF.fichiers['src/engine.js']);
 assert.ok(JSON.stringify(base).includes(REF.fichiers['src/engine.js']),'l\'empreinte du moteur est celle de la baseline déclarée');
});
test('les fichiers modifiés ne sont pas des fichiers de pose : ni l\'adaptateur de page, ni la garde d\'entrée, ni le lot ne les lisent pour poser',()=>{
 for(const f of Object.keys(ECHO))assert.ok(REF.fichiers[f],f+' existait');
 /* L'adaptateur et la garde d'entrée (qui posent et valident) n'ont pas bougé : ils sont dans la liste comparée ci-dessus. */
 /* 4.9.5.13 : l'adaptateur de page ne change que par `vueFin` (lecture seule après la pose) : sans ces lignes, il est celui de la test 8. */
 const ap=sansPatchs(sansRustLidar(sansCH077(sansCH084v(sansCH096('src/adapter-page.js',lire('src/adapter-page.js')))))).replace("if(!vue){const fin=snapshot();fin.vueFin=vueFin(fin);return fin;}",'if(!vue)return snapshot();').replace('fin.vueFin=vueFin(fin);','')
  .replace(/\n \/\* 4\.9\.5\.13 \(analyse du lot 2:19[\s\S]*?catch\(e\)\{return \{version:'vue-fin-v1',erreur:String\(e\?\.message\|\|e\)\.slice\(0,80\)\};\}\}/,'')
  /* T20a : relevé en lecture seule du sélecteur de parties, au ping de contrat (aucun clic, aucune écriture) : sans ces lignes, l'adaptateur est celui de la test 8. */
  .replace(/ \/\* T20a — RELEVÉ DU SÉLECTEUR DE PARTIES[\s\S]*?return \{status:'ok',current:c\.length===1\?c\[0\]\.part:null,parts\};\}\n/,'')
  .replace(/\n   const selecteur=options[^\n]*/,'').replace(",...(selecteur?{selecteurParties:selecteur}:{})",'')
  /* CH-050 (D-283) : diagnostic du repli de stabilité (CH-049-A), quatre entiers ajoutés à la sortie de `attendreChargement`, jamais lus par la décision : sans ces lignes, l'adaptateur est celui de la test 8. */
  .replace(/\n   \/\* CH-049-A — DIAGNOSTIC DU REPLI[\s\S]*?   let vu=false,ch=0,tc=0,gm=0;/,'')
  .replace("if(sig.value!==valeur){const precedent=depuis;valeur=sig.value;depuis=Date.now();if(vu){ch++;gm=Math.max(gm,depuis-precedent);tc=depuis-debut;}vu=true;}","if(sig.value!==valeur){valeur=sig.value;depuis=Date.now();}")
  .replace(',pc,nc,vc,ch,tc,gm,at:Date.now()-debut}}',',pc,nc,vc}}').replace(',pc,nc,vc,m:manque,ch,tc,gm,at:Date.now()-debut}}',',pc,nc,vc,m:manque}}')
  /* D-304 : règle « echantillon50 » (témoin à un cut sur cinquante), sans ces lignes l'adaptateur est le même. */
  .replace(/\n \/\* D-304 \(opérateur, 08\/11\)[\s\S]*?const CINQUANTIEME=85899346; \/\/ ⌈2\^32 \/ 50⌉/,'')
  .replace("&&regle!=='echantillon50')return 'reference';",")return 'reference';").replace("\n   if(regle==='echantillon50')return h<CINQUANTIEME?'reference':'rapide';",'');
 assert.equal(sha(ap),REF.fichiers['src/adapter-page.js'],'src/adapter-page.js hors vueFin');
 for(const f of ['src/early-input.js','src/engine.js','src/geometry.js','src/geometry-brain.js','src/geometry-candidate-v1.js','src/placement-convention.js','src/lot-decision.js',
  'src/regles-metier.js','src/hauteur-apprise.js','src/faux-vert-ombre.js','src/relecture-ombre.js','src/relecture-critere.js','src/verts-a-controler.js','src/voie-recentree.js'])
  {const h=sha(f==='src/relecture-ombre.js'?sansD284(lire(f)):sansCH086(f,sansCH065(f,lire(f))));assert.equal(h,CH087[f]||REF.fichiers[f],f);}
 /* La session Écho ne touche pas au lot : elle ne lit rien du lot en plus (`differesDuLot`, mémoire des différés, existaient). */
 const diff=lire('src/native-session.js');assert.ok(!/batch\.scope|startBatch|lotCommands|applyInESV/.test(diff.slice(diff.indexOf('RM-11 (fiches/RM11'),diff.indexOf('summariseGesture(record,observed){'))));
});
test('les réglages sont ceux de la test 8, hors la ligne echo.raison et la recapture des captures vides (coupée)',()=>{
 const S=require('../src/settings.js'),canon=v=>JSON.stringify(v,(k,x)=>typeof x==='function'?'<fn>':x);
 const {skipExplicite,echo,passeDifferesDefaut,file,relectureDefaut,relectureSignalEteint,validationSurPlace,ecrituresApresValidation,eveil,correctionEntreParties,rust,...reste000}=S,{repliCourt,imagesMin,...piloteSans}=reste000.pilote,reste00={...reste000,pilote:piloteSans},{deplacement:_dep,actif:_dvActif,...deplacerVueSans0}=reste00.deplacerVue,deplacerVueSans={actif:false,...deplacerVueSans0},reste0={...reste00,deplacerVue:deplacerVueSans},{raison,...echoSans}=echo,{profil,recaptureVide,passeDifferes,gardeApresDiffere,rechercheLarge,serieCapturesVides,voieB1EcartOmbre,gardeVoieOmbre,serrageLotOmbre,signalEteint,chargement,...lotSans}=S.lot,reste={...reste0,lot:lotSans};
 /* D-296 (CH-064) : clé ajoutée au premier niveau, la lecture LiDAR en Rust, ALLUMÉE par défaut (accord de l'opérateur), sortie identique au bit près. */
 assert.deepEqual({...rust},{lidar:true},'D-296 : lecture LiDAR en Rust, allumée par défaut');
 /* CH-084 (D-313) : clé ajoutée au premier niveau, la fin de la fenêtre de Maj+Espace sur l'écriture vue, ALLUMÉE pour le lot d'essai (relecture seulement). */
 assert.deepEqual({...validationSurPlace},{actif:true,libelleStableMs:300,imagesMin:3},'CH-084 : validation sur place, fin sur l’écriture vue');
 /* CH-086 : clé ajoutée au premier niveau, les écritures après la validation en fond, ALLUMÉES pour le lot d'essai ; `enFond:false` : chemin d'avant. */
 assert.deepEqual({...ecrituresApresValidation},{enFond:true,delaiMs:2000},'CH-086 : écritures après la validation en fond');
 assert.equal(profil,'L1-se','test 14 : profil du lot « L1-se » par défaut (L1-s, D-221, avec la décision L1-e des différés)');
 /* D-320 (opérateur, 10/11) : seul réglage ajouté, le bouton « SKIP explicite » du panneau, MASQUÉ ; il ne touche ni la pose ni le lot ; le reste est l'empreinte d'avant. */
 assert.deepEqual({...skipExplicite},{bouton:false},'D-320 : bouton SKIP explicite masqué');
 /* Test 16 (cap 5, 8cb7958) : seul réglage ajouté, la recapture d'une capture presque vide pendant un lot, COUPÉE par défaut ; le reste est l'empreinte d'avant. */
 assert.deepEqual(Object.keys(S.lot).filter(k=>!(k in lotSans)).sort(),['chargement','gardeApresDiffere','gardeVoieOmbre','passeDifferes','profil','recaptureVide','rechercheLarge','serieCapturesVides','serrageLotOmbre','signalEteint','voieB1EcartOmbre']);
 /* CH-077 : préchauffage du cache pour la coupe suivante, ÉTEINT par défaut (D-305 : accord écrit de l'opérateur au moment de livrer). */
 assert.deepEqual(Object.keys(chargement),['prechauffer']);assert.equal(chargement.prechauffer.actif,true,'D-307 : préchauffage allumé (lot d\'essai, accord de l\'opérateur)');assert.equal(chargement.prechauffer.rayonM,0.75,'D-307 : réglage sobre');
 /* CH-062 : rechargement d'ESV quand son signal s'éteint pendant le lot, COUPÉ par défaut (un événement seulement). */
 assert.equal(signalEteint.actif,false,'CH-062 : signal éteint pendant le lot, coupé par défaut');
 assert.deepEqual({...voieB1EcartOmbre},{actif:true,fenetreListe:5,fenetreMm:30,choixMm:15,accordMm:20,gRefDefautMm:1435,essaisMax:4},'CH-055 : règle b1-ecart en OMBRE (consignée seulement), allumée par défaut');
 /* CH-079 (D-308) : garde de voie et serrage du lot en OMBRE (consignés seulement), mesurés dans chantiers/CH-079/rapport.md. */
 assert.deepEqual({...gardeVoieOmbre},{actif:true,seuilMm:15,fenetre:20,voisinesMin:5},'CH-079 : garde de voie en ombre');assert.deepEqual({...serrageLotOmbre},{actif:true,plafondMm:20,fenetre:20,voisinesMin:5},'CH-079 : serrage du lot en ombre');
 assert.equal(serieCapturesVides.actif,true,'D-283 : la garde « série de captures vides » est ALLUMÉE par défaut (décision de l\'opérateur)');
 assert.equal(rechercheLarge.actif,false,'CH-034 : la recherche large est ÉTEINTE par défaut (ordre de l\'opérateur, 02/11 : tant que son temps de calcul n\'est pas supprimé, CH-041)');assert.equal(rechercheLarge.mode,'differer');assert.equal(rechercheLarge.soutienTop,60);assert.equal(rechercheLarge.grainesMode,'grille');
 /* Test 25 (CH-019) : la garde « après un différé », livrée ALLUMÉE (règle R3) ; `actif:false` rend le lot d'avant (tests/garde-apres-differe-coupee-sw.test.cjs). */
 assert.deepEqual({...gardeApresDiffere},{actif:false,ombre:true,regle:'R3',coupures:2,appuisMin:2},'D-288 : garde après un différé coupée, en ombre (R3, 2 cuts, moins de 2 appuis consignés)');
 assert.equal(recaptureVide.actif,false,'recapture des captures vides : coupée par défaut');
 /* Test 17 : la deuxième passe des différés, ALLUMÉE par la décision de l'opérateur ; test 21 (D-251, 26/10) : livrée EN OMBRE ; test 24 (D-259, 28/10) : livrée ALLUMÉE EN ÉCRITURE, plafonnée à 10 cuts par lot ; le reste est l'empreinte d'avant. */
 assert.deepEqual([passeDifferes.ombre,passeDifferes.ecriture,passeDifferes.ecritureMax],[true,true,10],'deuxième passe des différés : écriture, 10 cuts au plus par lot (D-259)');
 /* CH-017 : seule clé ajoutée au premier niveau après la passe, la file de parties, ÉTEINTE à la livraison. */
 assert.equal(file.actif,true,'file de parties : allumée par défaut dans la test 25 (D-268, ordre de l\'opérateur) ; la file ne part que si l\'opérateur la lance');
 /* Test 27 (CH-026, ordre de l'opérateur du 30/10) : clé ajoutée au premier niveau, la relecture « corriger » par défaut, non réglable. */
 assert.deepEqual({...relectureDefaut},{mode:'corriger',modifiable:false},'relecture après le lot : « corriger » par défaut, non réglable');
 assert.equal(relectureSignalEteint.actif,true,'CH-060, D-290 : rechargement d\'ESV quand son signal s\'éteint pendant la relecture : ALLUMÉ (la relecture seulement ; le lot n\'est pas concerné)');
 /* CH-035 : clé ajoutée au premier niveau, l'Aurore entre les parties d'une Constellation, ÉTEINTE tant que l'opérateur ne l'a pas éprouvée. */
 assert.equal(correctionEntreParties.actif,true,'Aurore entre les parties : allumée par défaut (CH-037, décision de l’opérateur du 01/11), sans effet sur le lot');
 assert.equal(passeDifferesDefaut,passeDifferes,'les valeurs livrées de la passe (seule clé ajoutée au premier niveau) sont celles du lot');
 /* D-304 (opérateur, 08/11) : seule valeur changée, le témoin de qualité à un cut sur cinquante ; le reste est l'empreinte d'avant. */
 assert.equal(S.pilote.modeRapide,'echantillon50','D-304 : témoin à un cut sur cinquante');
 /* CH-084 : deux réglages ajoutés au pilote, ALLUMÉS par D-315 (opérateur) : repli court à 600 ms, deux images ; le reste est l'empreinte d'avant. */
 assert.deepEqual({...repliCourt},{actif:true,silenceMs:600},'CH-084, D-315 : repli court allumé');assert.equal(imagesMin,2,'CH-084, D-315 : deux images');
 assert.equal(sha(canon(reste.pilote?{...reste,pilote:{...reste.pilote,modeRapide:'echantillon'}}:reste)),REF.reglages.reste,'réglages de la pose, du lot, de l\'export, de la relecture : inchangés');
 assert.equal(sha(canon(echoSans)),REF.reglages.echo,'réglages d\'Écho hors la raison : inchangés');
 assert.equal(raison.actif,false,'coupée par défaut');
});
test('les réglages proposés et par défaut de la relecture, et les empreintes gelées de la géométrie, sont inchangés',()=>{
 for(const f of ['datasets/relecture-reglages-defaut.json','datasets/relecture-reglages-proposes.json'])assert.equal(sha(lire(f)),REF.fichiers[f],f);
 for(const [f,e] of Object.entries(REF.fichiers))if(f.startsWith('audit/v4.'))assert.equal(sha(sansCH086(f,lire(f))),e,f);
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
 assert.deepEqual(Object.keys(await avec.b.api('choix-lot-etat')).sort(),['aurorePassage','clicHumain','passeDifferes','regleGrappeDifferes']);assert.equal('passeDifferes' in scope,false);assert.equal('aurorePassage' in scope,false,'CH-037 : l’interrupteur de l’Aurore n’entre pas dans le lot');
 assert.equal((await avec.b.api('raison-choix-etat')).actif,true,'le choix de la raison est à part');
});
