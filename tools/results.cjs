const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const v=JSON.parse(fs.readFileSync(path.join(root,'audit/verification.json'))),o=JSON.parse(fs.readFileSync(path.join(root,'datasets/automatic/offline-evaluation-v4.3.0.json'))),
 f=JSON.parse(fs.readFileSync(path.join(root,'audit/native-fluidity-v4.4.3.json'))),loss=JSON.parse(fs.readFileSync(path.join(root,'audit/native-geometry-loss-v4.4.0.json'))),native=JSON.parse(fs.readFileSync(path.join(root,'audit/native-offline-v4.4.1-baseline.json'))),real=JSON.parse(fs.readFileSync(path.join(root,'audit/native-v4.4.1-real-audit.json')));
const n=x=>Number.isFinite(x)?x.toFixed(2).replace('.',','):'n/a',g=o.metrics.global,p=f.scenarios.find(x=>x.name==='paced'),b=f.scenarios.find(x=>x.name==='burst');
const report=`# Résultats — Banane V4 TEST 4.4.3

La V4.4.2 enregistre et acquitte des instantanés qualifiés par rail avant l'intention opérateur, indépendamment du résumé de capture tardif ; une contradiction explicite les révoque. **Dans ESV, le bouton flottant est resté visible malgré une fenêtre ouverte : le masquage V4.4.2 a échoué sur le terrain.** La V4.4.3 suit les fenêtres et pages ouvertes, retire physiquement le bouton et empêche une réponse de statut tardive de le réafficher. Cette correction est vérifiée localement, pas encore dans Edge. Ni placement, ni pilote, ni lecteur LiDAR partagé ne changent : leurs empreintes SHA-256 restent figées.

## Vérifications réellement exécutées

Exécution finale : ${v.finishedAt}. Node ${v.node}, plateforme ${v.platform}.

| Contrôle | Résultat |
|---|---|
| Tests Node | ${v.counts.pass}/${v.counts.tests} réussis ; ${v.counts.fail} échoué, ${v.counts.skipped} ignoré, ${v.counts.cancelled} annulé |
| Syntaxe des scripts exécutables | ${v.runtimeFilesSyntaxChecked} fichiers contrôlés |
| Observation passive simulée | 0 blocage, 0 réémission, 0 commande native Banane |
| Sauvegarde progressive | Chunks par rail et visite récupérés après redémarrage simulé |
| Corpus hors ligne conservé | ${o.certificate.recalculated.humanCorrections} cuts, ${o.certificate.recalculated.humanLidarPoints.toLocaleString('fr-FR')} points |
| Edge et ESV réels | Non exécutés |

## Retour terrain et correctif d'interface

Mic a fourni une capture montrant « Banane V4 · ouvrir » encore visible après ouverture d'une fenêtre. L'essai V4.4.2 invalide le masquage annoncé par nos tests précédents ; la cause technique exacte dans son navigateur reste à déterminer. Des tests V4.4.3 contrôlent la fenêtre suivie malgré un filtre URL d'extension vide, deux fenêtres ouvertes, une réponse tardive, l'absence physique du bouton dans le DOM et la reconnexion d'une page après interruption du service worker. Seul un nouvel essai dans Edge confirmera le résultat.

## Audit reproductible du JSON réel V4.4.1

L'export ${real.source.file} (SHA-256 ${real.source.sha256}) contient ${real.counts.visits} visites, ${real.counts.events} événements, ${real.counts.captures} captures et ${real.counts.chunks} portions, soit ${real.counts.points.toLocaleString('fr-FR')} points exportés : ${real.counts.pointsByRail.left.toLocaleString('fr-FR')} gauche et ${real.counts.pointsByRail.right.toLocaleString('fr-FR')} droite. Parmi eux, ${real.counts.visibility.true.toLocaleString('fr-FR')} sont visibles dans le clipping déclaré et ${real.counts.visibility.false.toLocaleString('fr-FR')} hors zone visible. Les terminaisons sont ${real.counts.terminations.VIEW_CHANGED} VIEW_CHANGED, ${real.counts.terminations.TARGET_CHANGED} TARGET_CHANGED, ${real.counts.terminations.RAIL_STATE_CHANGED} RAIL_STATE_CHANGED, ${real.counts.terminations.RESOURCE_LIMIT} RESOURCE_LIMIT et ${real.counts.terminations.NONE} NONE.

Le format 4.4.1 ne prouve pas la sauvegarde d'un instantané utilisable **avant** l'intention : ${real.counts.exportedComparableRails} rail comparable. Le filtre exploratoire « visible et pose initiale » trouve ${real.counterfactualScreens[2].visitRails} rails-visites sur ${real.counterfactualScreens[2].visitsWithBothRails} visites à deux rails ; leurs captures finissent toutes interrompues. Ces nombres ne sont **pas** des références promues, ni une mesure de précision. Les anciens fichiers restent en lecture seule. Recalcul : node tools/audit-native-v441.cjs --input /chemin/export.json --output audit/nouveau-resultat.json.

## Cause reproduite sur trois exports Natif V4.4

Les ${loss.aggregate.visits} visites et ${loss.aggregate.captures} captures auditées annoncent des dizaines de millions de points en buffers ; le parcours séquentiel sous contrainte de temps n'en a conservé et exporté que **4**. Le rapport audit/native-geometry-loss-v4.4.0.md sépare les points présents, lus, transformés, retenus, sauvegardés et exportés et montre la priorité insuffisante donnée aux zones utiles. Un nouveau lecteur Natif priorise ces zones, enregistre par portions et qualifie séparément chaque rail. Aucune session post-correctif n'est encore disponible pour confirmer l'efficacité terrain.

## Fluidité hors ESV

Sur ${p.inputEvents.toLocaleString('fr-FR')} événements cadencés, le p95 du gestionnaire est de ${n(p.collector.inputHandlerMs.p95)} ms, son maximum de ${n(p.collector.inputHandlerMs.max)} ms, la file atteint ${p.collector.queueDepthMax} et aucune entrée n'est perdue. Une rafale artificielle de ${b.inputEvents.toLocaleString('fr-FR')} événements remplit la file de test à ${b.collector.queueDepthMax}, abandonne explicitement ${b.collector.dropped.toLocaleString('fr-FR')} observations et passe à \`${b.collector.degradationLevel}\`. Cette mesure Node ne prouve pas la fluidité du rendu Edge/Potree.

## Rejeu des 110 corrections humaines conservé

| Mesure | Gauche | Droite |
|---|---:|---:|
| Erreur latérale médiane / p90 / max | ${n(g.errors.left.lateral.medianMm)} / ${n(g.errors.left.lateral.p90Mm)} / ${n(g.errors.left.lateral.maximumMm)} mm | ${n(g.errors.right.lateral.medianMm)} / ${n(g.errors.right.lateral.p90Mm)} / ${n(g.errors.right.lateral.maximumMm)} mm |
| Erreur verticale médiane / p90 / max | ${n(g.errors.left.vertical.medianMm)} / ${n(g.errors.left.vertical.p90Mm)} / ${n(g.errors.left.vertical.maximumMm)} mm | ${n(g.errors.right.vertical.medianMm)} / ${n(g.errors.right.vertical.p90Mm)} / ${n(g.errors.right.vertical.maximumMm)} mm |
| Erreur euclidienne médiane / p90 / max | ${n(g.errors.left.euclidean.medianMm)} / ${n(g.errors.left.euclidean.p90Mm)} / ${n(g.errors.left.euclidean.maximumMm)} mm | ${n(g.errors.right.euclidean.medianMm)} / ${n(g.errors.right.euclidean.p90Mm)} / ${n(g.errors.right.euclidean.maximumMm)} mm |

${g.cutsComparable} cuts sur ${g.cutsRead} reçoivent deux propositions comparables ; ${g.unresolvedRails} rails restent non résolus. Aucune amélioration de précision n'est revendiquée.

## Rejeu des anciens exports Natif

Le banc Natif qualifie ${native.metrics.usableByRail.left} rail gauche, ${native.metrics.usableByRail.right} rail droit et ${native.metrics.usablePairs} paire sur ${native.metrics.visitsRead} visites V4.4.1 anciennes. Il ne produit aucune preuve visuelle réelle ni score de précision : ces exports documentent le défaut antérieur. Les tests synthétiques vérifient que le moteur reçoit les points réellement visibles et l'état initial **sans** la référence humaine finale.

## Limites

Le statut vert/rouge, le projet, la geominfo brute, l'ordre spatial, l'écartement frais et la confirmation serveur n'ont pas de source ESV vérifiée. Ils restent absents ou \`not-observed\`. Les matrices sont cohérentes numériquement mais les unités ne sont pas calibrées indépendamment. Le test terrain V4.4.3, les superpositions visuelles sur de nouveaux exemples et la comparaison de fluidité avec/sans Natif sont obligatoires avant toute conclusion d'usage. Voir \`NATIVE_GEOMETRY_ACCEPTANCE.md\` et \`TEST_REPORT.md\`.
`;
fs.writeFileSync(path.join(root,'RESULTATS.md'),report);console.log('Résultats V4.4.3 écrits depuis les vérifications, les exports Natif et le rejeu hors ligne conservé.');
