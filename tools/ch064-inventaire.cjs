#!/usr/bin/env node
'use strict';
/* CH-064 (D-295) : inventaire du calcul portable en Rust, fichier par fichier, et son pourcentage.
 *   node tools/ch064-inventaire.cjs [--md SORTIE]
 * Tailles lues dans le dépôt (lignes comme wc -l, octets) ; statuts et parts par fichier : table S ci-dessous, établie par analyse
 * syntaxique de chaque fichier (fonctions nommées, marqueurs d'impureté : chrome, DOM, stockage, horloge, réseau, Potree, async,
 * aléa, variables de module) puis lecture des fonctions douteuses et des crates des équipes. Les parts des fichiers mixtes sont
 * ESTIMÉES. P porté, C en cours, X portable non porté, N non portable, D données. Résultat : chantiers/CH-064/inventaire-100.md. */
const fs=require('fs'),path=require('path'),RACINE=path.resolve(__dirname,'..');
const fichiers=['background.js','panel.js','panel-lancement.js',...fs.readdirSync(path.join(RACINE,'vendor')).filter(f=>f.endsWith('.js')).map(f=>'vendor/'+f),
 ...fs.readdirSync(path.join(RACINE,'src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f)].sort((a,b)=>a.includes('/')-b.includes('/')||(a<b?-1:1));
const T=Object.fromEntries(fichiers.map(f=>{const t=fs.readFileSync(path.join(RACINE,f));let n=0;for(const c of t)if(c===10)n++;return [f,[n,t.length]];}));
/* --d296 : totaux de l'inventaire élargi (D-296) depuis chantiers/CH-064/inventaire-d296.json ; écart de taille signalé. */
if(process.argv.includes('--d296')){const J=require(path.join(RACINE,'chantiers/CH-064/inventaire-d296.json')),tot={},ecarts=[];
 for(const [f,[L,O]] of Object.entries(T)){const e=J[f];if(!e){ecarts.push(f+' : absent du relevé');continue;}let l=0,o=0;
  for(const [k,[a,b]] of Object.entries(e.a)){tot[k]=tot[k]||[0,0];tot[k][0]+=a;tot[k][1]+=b;l+=a;o+=b;}
  if(l!==L||o!==O)ecarts.push(f+' : '+L+' l / '+O+' o, relevé '+l+' l / '+o+' o');}
 const O=Object.values(T).reduce((s,v)=>s+v[1],0),nom={P:'porté',C:'en cours',X:'portable D-296 non porté',D:'données',chrome:'non portable : API Chrome',dom:'non portable : DOM',esv:'non portable : page ESV',orch:'non portable : orchestration',trav:'non portable : coût de traversée'};
 console.log(Object.entries(nom).map(([k,n])=>n+' : '+(tot[k]||[0,0])[0]+' l / '+(tot[k]||[0,0])[1]+' o ('+(100*(tot[k]||[0,0])[1]/O).toFixed(1)+' %)').join('\n'));
 if(ecarts.length){console.error('fichiers changés depuis le relevé :\n'+ecarts.join('\n'));process.exitCode=1;}
 return;}
// m = statut principal (P porté, C en cours, X portable non porté, N non portable, D données) ; carve-outs explicites
const S={
'background.js':{m:'N',X:[212,24010],eq:'—',r:"Service worker : chrome.*, files, horloge, état de session (25 variables de module). ~30 fonctions pures ≥ 300 o, surtout de la colle : obsFields 291–317, relectureCalculer 3730–3763 (assemble relecture-ombre + critère + lot, globalThis.Banane* à passer en entrée), avisDepartSurVert 1338–1344, repriseAnchors 2781–2791, lotSignalRefus 863–877, lotSignalTrou 835–841, translationRails 1102–1108, passeDiffReglage 2109–2115, reglesResume 2599–2605. ESTIMÉ."},
'panel.js':{m:'N',X:[103,10508],eq:'—',r:"Panneau : DOM, Blob, chrome.runtime. Pures ≥ 300 o : profilVoie 242–262, dessinerVoie 224–241 (chaîne SVG), commandeDerniere 416–430, tempsParCut 477–488, activiteLot 400–409, verifierSanteExportee 1480–1489, libellesOnglets 981–987. ESTIMÉ, intérêt faible."},
'panel-lancement.js':{m:'N',eq:'—',r:"DOM pur (écran de lancement), < 15 lignes."},
'vendor/capture-core.js':{m:'P',X:[89,5061],eq:'chef',r:"Porté : point, affine, multiply, inverse, rebase, vector, matrix (ariane-capture). Restent purs non portés : identity, distance, translation, compose 66–76, worldMatrix 77–84, rotation 85–90, railState 91–95, equalRails 96–99, serialRail 100–106, reference 107–122, attribute 124–152 (lecteur de tampon Potree, au bord du non portable)."},
'vendor/lidar.js':{m:'N',P:[34,2200],X:[22,1027],eq:'L',r:"Porté : boucle par point de capture() (l. 232–265, ESTIMÉ ~34 l). Le reste de capture() (162–304), inventory, clipSnapshot, boxVisible, cameraSnapshot, inspectNode lisent les objets Potree vivants de la page : non portable. Pures portables : profileLines 99–114, reportedBox 115–119, inRoi 120."},
'src/adapter-page.js':{m:'N',X:[38,3339],eq:'—',r:"Page ESV : DOM, Potree, viewer, horloge (49 Date.now). Petites pures : refusalDetail 513–523, lectureDuCut 186–191, niveauNoeud 379–383, sameRailPose 98–99, projectToView 506–510, noterClicHorsVue 603–605. Intérêt faible ; fichier interdit aux exécutants."},
'src/appuis-liste.js':{m:'C',eq:'J4',r:"Assigné à CH-068 (J4, lancé le 06/11). Fichier entièrement pur (17 fonctions)."},
'src/bridge.js':{m:'N',eq:'—',r:"Pont page ↔ service worker : DOM, messages. Pures (reply, tooBig, obsCopy) < 1 Ko de colle."},
'src/brain.js':{m:'X',eq:'—',r:"Pur en entier : corrigerRail 89–150, corrigerPaire 75–87, candidatsExposes 63–70, ambigue 71–72. Correction du « cerveau » sur la proposition V4.6 ; appelé par geometry-brain.js."},
'src/carte-relecture.js':{m:'N',eq:'—',r:"Carte DOM de la relecture ; texteReglages 27–32 seule pure (< 1 Ko)."},
'src/continuity-observer.js':{m:'X',C:[20,1390],N:[19,1656],eq:'D (partie)',r:"D porte fitAt 82–86, predict 90–96, translated 97–104 (aides.rs). Restent purs non portés : gatherInput 119–148, summarise 149–168, validated 48–58 et selectAnchors 70–81 (Date.parse seul), startRails 173–181, near, cutoffOf, inputSummary, poseEqual. Non portables tels quels : proposeFrom 184–189, observe 200–212 (horloge injectée par défaut, appellent GCV1)."},
'src/core.js':{m:'X',N:[15,1320],eq:'—',r:"Pures : pairCorpus 63–89, expectedPoses 47–58 (appelée par commandRails), manualDecision 90–95, equalPoses 30–32, parse 59–62, cutId/cutKey/identity. Non portables : uid 8 et reference 33–46 (Date, Math.random)."},
'src/correction-liste.js':{m:'C',eq:'E',r:"E porte construire, couverture, statutDe, visitesFusionnees, apprenabilite, bilan, parcours ; lotDe et instant (Date.parse) suivent. Rien de pur hors couverture relevé."},
'src/deplacement-vue.js':{m:'X',N:[17,1223],eq:'—',r:"Pures : juger 66–77, detailRemise 125–133, detailDeplacement 111–116, gesteJournal, sequence 60–64, resume, reglages, classes noterRemise/noterDeplacement. Non portable : deplacer 80–96 (async, émet les gestes)."},
'src/early-input.js':{m:'N',eq:'—',r:"Écoute clavier de la page (DOM, messages)."},
'src/engine.js':{m:'N',eq:'—',r:"Moteur gelé : classe async, horloge (27 new Date). 16 petites aides pures (deferEligibility 388–408, closureSummary 1131–1145, expectedTransition 345–362, deferTransition 414–428 : ~92 l, 7,7 Ko) mais plusieurs lisent this.* : non portables telles quelles."},
'src/esv-observer.js':{m:'N',X:[107,7907],eq:'—',r:"install 204–392 intercepte le réseau de la page (non portable). Pures : classify 79–91, listSummary 120–130, applyWrite 171–178, nearest 180–188, voisins 191–202, inventaireChamps, gardeExtras, addRows, writeBody, clés (URL à analyser : à reproduire)."},
'src/etat-morceaux.js':{m:'C',eq:'E',r:"E porte decouper, clesARelire, recoller (+ aides). Couvert en entier."},
'src/export-cache.js':{m:'N',X:[97,7405],eq:'—',r:"IndexedDB (supprimer, lire, ecrire), Intl (heureParis). Pures : refus 53–73, ficheDepart 196–208, capturesAGarder 89–103, texte 173–183, refusCapture 42–49, nuagesNommes, ajouterDepart."},
'src/faux-vert-ombre.js':{m:'C',eq:'D',r:"D porte evaluer (+ signaux, bande, seuilsDe). Couvert."},
'src/file-parties.js':{m:'X',eq:'—',r:"Machine à états pure en entier : transition 107–189, alertes 253–268, reprise 198–218, planifier 71–81, completerBilan, classerLot, vue, arreter."},
'src/file-prioritaire.js':{m:'X',eq:'—',r:"Pur (ordonner 70–90, apprendreTaux, classe, plages). Non chargé par le manifeste ni le service worker : outils et essais seulement (ÉTABLI par grep)."},
'src/garde-apres-differe.js':{m:'C',eq:'D',r:"Couvert (reglage, voisinsDifferes, juger)."},
'src/garde-passe-appuis.js':{m:'C',eq:'D',r:"Couvert (reglage, deplacementMm, appuiNormalCuts, juger)."},
'src/gauge.js':{m:'P',eq:'chef',r:"assessPair et aides (ariane-geometrie/jauge.rs)."},
'src/gcv1-export.js':{m:'X',N:[14,870],eq:'—',r:"Pures : deferralResult 129–173, runtimeResult 175–208, selectDeferOperation 109–128, linkedEvents 16–32, findCapture 40–53, railView 210–223 ; buildDiagnostic 225–261 pur si exportedAt est passé. Non portable : buildCorpusPlan 263–276 (async getCloud)."},
'src/gcv1-shadow-bootstrap.js':{m:'N',eq:'—',r:"Une affectation globale."},
'src/gcv1-shadow.js':{m:'C',X:[51,3910],N:[69,4158],eq:'D',r:"D porte scientificProposeBoth (+ AvecReservoir) et ses aides 110–520. Restent purs non portés : toRuntimeRails 525–570, compactRuntimeRails 572–576 (lisent la variable de module convention : à passer en entrée). Non portables : configure/state/armOnce/disarm 75–108, proposeBoth 578–612 (état, new Date)."},
'src/gcv2-l1.js':{m:'C',eq:'J4',r:"Assigné à CH-068. Presque tout pur ; à signaler : variable de module LEVIERS (reglerLeviers 587), Date.now pour rech.ms dans deciderL1e 778–779 (mesure, à garder en JS ou passer en entrée)."},
'src/gcv2-l1e.js':{m:'C',eq:'J4',r:"Assigné à CH-068. Pur en entier."},
'src/gcv2-parametres-l1.js':{m:'D',eq:'J4 (lecture)',r:"Données (coefficients figés de la GCV2, 6 lignes, 36,5 Ko) : pas du calcul ; à embarquer ou à passer en entrée par J4."},
'src/geometry-brain.js':{m:'N',eq:'—',r:"Colle à état de module (etat, dernier) autour de brain.js et V4.6."},
'src/geometry-candidate-v1.js':{m:'P',eq:'chef',r:"GCV1 (ariane-geometrie/gcv1.rs)."},
'src/geometry.js':{m:'P',eq:'chef',r:"V4.6 (ariane-geometrie/v46.rs)."},
'src/gestes-vue.js':{m:'X',N:[39,3181],eq:'—',r:"Pures : evenement 140–162, finirGlisser 170–176, finirMolette 177–181, ecartCamera 108–114, apres, approche, besoin, memeCamera. Non portables : sequenceMolette/Glisser/ClicDroit 53–86 (Math.random), construire/emettre 88–100 (DOM)."},
'src/hauteur-apprise.js':{m:'C',eq:'D',r:"D porte evaluer (+ groupe, signaux, signalRail, modeleDe, correctionRail). Couvert."},
'src/historique-parties.js':{m:'X',N:[13,577],eq:'—',r:"Pures : historique 77–108, ficheFin 43–51, ajouterFin 53–59, finDe, comptes (Date.parse / ISO seulement). Non portables : lireFins, noterFin (stockage, variable file)."},
'src/journal-index.js':{m:'C',N:[37,4000],eq:'E',r:"E porte creer et le calcul des clés (journal, journalAppliquer, clesNatif, clesParType). Restent en JS : lireCles 117–123 et la partie IndexedDB d'equiper 43–108 (ESTIMÉ ~30 l)."},
'src/level-crossing.js':{m:'C',eq:'D',r:"Couvert (frameOf, detect, edgeOf, positionAt, read)."},
'src/liste-memoire.js':{m:'C',N:[77,5423],eq:'E',r:"E porte compacter, decompacter, ajouter, comparer, bordsCorps, choisirTable, empreinte, nomFichier, texteResume, actif. Non portables : file, lire, noterEcriture, demanderTable, apresChargement, resume, instantanes, effacer, exportPanneau (chrome, async)."},
'src/lod-signature.js':{m:'X',eq:'— (périmètre nominal de L)',r:"Pur : signature 53–59, jeton 46–52, empreinte 38–42. Dans la liste des modules de CH-064-L, non porté (L n'a porté que la boucle)."},
'src/lot-decision.js':{m:'C',X:[107,8748],eq:'D',r:"D porte decideCut et toutes ses aides 81–422. Non couverts (lot.rs le dit) : rememberAnchor 439–443, commandsPositions 450–455, holdAnchor 460–463, promoteAnchors 467–472, viewCameras 483–489, inView 490–493, deferRails 496–500, fauxVertActivation 505–514, hauteurActivation 522–537 (BananeSettings à passer en entrée), commandRails/commandRailsBase 538–581 (appelle core.expectedPoses)."},
'src/manual-page.js':{m:'N',eq:'—',r:"Mode manuel côté page : async, horloge."},
'src/manual-session.js':{m:'N',eq:'—',r:"Session manuelle : async, horloge, stockage."},
'src/merge-clouds.js':{m:'X',eq:'— (périmètre nominal de L)',r:"Pur : merge 4–25, compactNodes 45–52. Listé pour CH-064-L, non porté."},
'src/native-export.js':{m:'X',eq:'—',r:"Format d'export compact, pur en entier : compact 162–185, expand 207–225, createInterner 62–88, foldRefs/unfoldRefs 91–122, stripDerived/restoreDerived 125–151, deltaMetadonnees 329–346, evenementsParReference, rehydraterEvenements, empreinte, alleger."},
'src/native-lidar.js':{m:'N',X:[58,4337],eq:'— (périmètre nominal de L)',r:"capture 160–408 (async, horloge, uid aléatoire) et prepareNode/directReader/sourceUnchanged (nœuds Potree) : non portables. Pures : coverageFrom 69–81, coverageAccumulator 57–65, rawRoiBounds 102–112, profileLines 23–31, matrixValid, coverage, inBox, draw. ESTIMÉ."},
'src/native-page.js':{m:'N',eq:'—',r:"File d'entrée côté page : async, horloge. Petites pures (metricSnapshot, clés) < 4 Ko, colle."},
'src/native-reconstruction.js':{m:'X',eq:'—',r:"Pur (Date.parse seulement) : reconstruireRail 52–81, couvertureDansRepere 40–49, reconstruireCut. Non chargé à l'exécution : outils et essais (ÉTABLI par grep)."},
'src/native-session.js':{m:'N',C:[39,5054],X:[309,29108],eq:'E (dataset)',r:"E porte l'assemblage de dataset 954–992. Pures non portées : classify 513–564, chooseGeometry 478–512 (Date.parse, this.partialReason), health 823–859, accountQuality 778–819, referenceFromWrite 640–652, mergeMetrics 154–168, referenceParEcriture 45–56, redactedEvent 292–300, railDelta, exportAdvice, visitRelation. handle 301–477 (178 l, 21,7 Ko) est le cœur de la session : async + état, non portable tel quel."},
'src/part-summary-49.js':{m:'X',eq:'—',r:"Module déclaré pur : summarize 200–256, buildLots 126–149, outcomes 165–189, projectEvent 82–96, linkContexts 153–162, fromJournal."},
'src/perf-phase.js':{m:'N',eq:'—',r:"Chronométrage : horloge, enveloppe des méthodes, état de module."},
'src/phase-pli.js':{m:'X',eq:'—',r:"Pur : plierGroupe 48–72, plier 74–97, deplierGroupe 104–119, deplier 121–132, eligible."},
'src/placement-convention.js':{m:'P',eq:'chef',r:"calibrate, bandOffsets, quantile, template (convention.rs) ; plafondMode lit BananeSettings, passé en entrée."},
'src/raison-correction.js':{m:'X',eq:'—',r:"Module déclaré pur : appuyer 81–92, vue 121–127, lireFrappe 39–47, heriter, appliquer, autreGeste, derniereValidation (Date.parse)."},
'src/recherche-large.js':{m:'C',eq:'J4',r:"Assigné à CH-068. decider 159–200 mesure ms par Date.now (à passer en entrée)."},
'src/regles-metier.js':{m:'C',X:[77,6783],eq:'D',r:"D porte surface, railsDePlus, resumer, doitDifferer, evenement. Laissés en JS par D (Map/Set hors VBA, metier.rs le dit) mais purs : creerMemoire 137, evaluer 171–184, noter 186–200, lignes 205–227, zonePN 144–153, zoneADV 157–166, grappeDe, vusSansChaussee."},
'src/relecture-critere.js':{m:'C',eq:'D',r:"Couvert (reglages, correctionPermise, juger)."},
'src/relecture-ombre.js':{m:'C',eq:'D',r:"Couvert (selection, juger, poseCalculee, skipOmbre, confiance…)."},
'src/relecture-pause.js':{m:'N',eq:'—',r:"Carte DOM de la pause."},
'src/relecture-signal.js':{m:'C',eq:'D',r:"Couvert (reglage, lectureDe, creer, observer, recharge, bilan)."},
'src/serie-captures-vides.js':{m:'X',eq:'—',r:"Détecteur déclaré pur : observer 36–55, reglage 21–28, bilan, creer, fermer, attendre, differer."},
'src/settings.js':{m:'N',eq:'—',r:"Constantes (réglages gelés) + describe 564–608 (texte). Les seuils lus par la décision passent en entrée."},
'src/signal-rendu.js':{m:'N',X:[373,40603],eq:'—',r:"Rendu pur du panneau. Modèles de vue (portable, intérêt de présentation) : modele 117–224, ongletCorrectionModele 667–709, ongletFileModele 582–617, fileModele 237–273, modeleEcho 289–306, commandes 449–472, ciblesBornes 44–54… Les *Html (270 l, 40 Ko de chaînes HTML) comptés non portables (présentation). allureLot 30–37 lit l'horloge."},
'src/storage.js':{m:'N',eq:'—',r:"IndexedDB et chrome.storage."},
'src/ui5-variante.js':{m:'N',eq:'—',r:"Une constante globale."},
'src/ui5.js':{m:'N',X:[78,8259],eq:'—',r:"Panneau : DOM, chrome, horloge. Modèles purs : correctionDuPanneau 229–258, fileDuPanneau 187–213, lignesEcho 55–63, departsFile 217–224, statutsLot 51–54. calculAr/calculSig mêlent horloge et messages."},
'src/verts-a-controler.js':{m:'C',eq:'E',r:"E porte liste, signaux, duree, lignesDeInstantane, compacter ; noter, classer, plages, plagesPN appelés par liste. Couvert."},
'src/voie-b1-ecart.js':{m:'C',eq:'J4',r:"Assigné à CH-068. Pur en entier."},
'src/voie-recentree.js':{m:'C',eq:'J4',r:"Assigné à CH-068. Pur en entier (32 fonctions)."},
'src/zip-writer.js':{m:'N',X:[38,1614],eq:'—',r:"Pures : crc32 46–51 et crcTable 35–44 (table paresseuse, pure de fait), dateDos 55–62 (UTC), u16/u32/cat, nomValide, coutEntree. La compression passe par CompressionStream('deflate-raw') du navigateur : aucun deflate dans le dépôt (ÉTABLI), non portable au bit près sans réécrire zlib. createZip/lire/preparer : Blob, flux."},
};
const lab={P:'porté',C:'en cours',X:'portable non porté',N:'non portable',D:'données'};
const tot={P:[0,0],C:[0,0],X:[0,0],N:[0,0],D:[0,0]};
let rows=[];
for(const f of Object.keys(T)){
 const s=S[f]; if(!s){console.error('manque',f);continue;}
 const [L,O]=T[f]; let rl=L, ro=O; const alloc={};
 for(const k of ['P','C','X','N','D']) if(k!==s.m && s[k]){alloc[k]=s[k]; rl-=s[k][0]; ro-=s[k][1];}
 alloc[s.m]=[(alloc[s.m]?alloc[s.m][0]:0)+rl,(alloc[s.m]?alloc[s.m][1]:0)+ro];
 for(const [k,v] of Object.entries(alloc)){tot[k][0]+=v[0];tot[k][1]+=v[1];}
 const x=alloc.X||[0,0];
 rows.push(`| ${f} | ${L} | ${O} | ${lab[s.m]}${Object.keys(alloc).length>1?' (mixte)':''} | ${s.eq} | ${x[0]?x[0]+' l / '+x[1]+' o':'0'} | ${s.r} |`);
}
let out='| fichier | lignes | octets | statut | équipe | part portable non portée | raison / fonctions |\n|---|---:|---:|---|---|---|---|\n'+rows.join('\n')+'\n';
const TL=Object.values(T).reduce((a,v)=>a+v[0],0), TO=Object.values(T).reduce((a,v)=>a+v[1],0);
out+=`\n### Totaux (${Object.keys(T).length} fichiers, ${TL} lignes, ${TO} octets)\n\n| catégorie | lignes | % lignes | octets | % octets |\n|---|---:|---:|---:|---:|\n`;
for(const k of ['P','C','X','N','D']) out+=`| ${lab[k]} | ${tot[k][0]} | ${(100*tot[k][0]/TL).toFixed(1)} | ${tot[k][1]} | ${(100*tot[k][1]/TO).toFixed(1)} |\n`;
const calc=tot.P[1]+tot.C[1]+tot.X[1];
out+=`\nCalcul pur identifié (porté + en cours + portable non porté) : ${tot.P[1]+tot.C[1]+tot.X[1]} o ; part déjà portée ou en cours : ${(100*(tot.P[1]+tot.C[1])/calc).toFixed(1)} % en octets.\n`;
const md=process.argv.includes('--md')?process.argv[process.argv.indexOf('--md')+1]:null;if(md)fs.writeFileSync(md,out);else console.log(out);
const X=f=>{const s=S[f],[L,O]=T[f]; if(s.m==='X'){let l=L,o=O;for(const k of ['P','C','N','D'])if(s[k]){l-=s[k][0];o-=s[k][1];}return [l,o];} return s.X||[0,0];};
const lots={
'200–249 ariane-export':['src/native-export.js','src/phase-pli.js','src/zip-writer.js','src/export-cache.js','src/gcv1-export.js'],
'250–299 ariane-session':['src/native-session.js','src/part-summary-49.js','src/historique-parties.js','src/native-reconstruction.js','src/core.js','src/esv-observer.js'],
'300–349 ariane-file':['src/file-parties.js','src/file-prioritaire.js','src/serie-captures-vides.js','src/raison-correction.js'],
'350–399 ariane-vue':['src/deplacement-vue.js','src/gestes-vue.js'],
'400–449 ariane-lot':['src/lot-decision.js','src/regles-metier.js','src/gcv1-shadow.js','src/continuity-observer.js','src/brain.js'],
'450–499 ariane-nuage':['src/native-lidar.js','src/lod-signature.js','src/merge-clouds.js','vendor/lidar.js','vendor/capture-core.js'],
'500–549 ariane-rendu':['src/signal-rendu.js','src/ui5.js','panel.js','background.js','src/adapter-page.js'],
};
let s2='',tl=0,to=0; for(const [k,fs_] of Object.entries(lots)){let l=0,o=0;const d=fs_.map(f=>{const [a,b]=X(f);l+=a;o+=b;return f.replace('src/','')+' '+a+'/'+b;});tl+=l;to+=o;s2+=`${k} : ${l} l / ${o} o :: ${d.join(' ; ')}\n`;}
console.error(s2+'total lots '+tl+' l / '+to+' o');
