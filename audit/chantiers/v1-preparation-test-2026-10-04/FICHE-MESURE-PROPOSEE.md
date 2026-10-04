# V1 — proposition de mesure à faire adopter

4 octobre 2026. Préparation documentaire uniquement. Développement recevable après relecture et D-073 ; terrain non mesuré/non accepté. Ce document n'autorise ni installation terrain ni séance. La préparation du paquet reste soumise à verify à zéro échec. P2 accepté, ne pas recommencer.

## Objectif et lots proposés

Chronométrer où Orbite attend ou calcule sur la référence exacte 4.8.6 + V1 corrigé, sans accélération ni changement des décisions. Les événements simulés prouvent des chemins de code ; ils ne donnent aucun temps terrain.

Proposition initiale : **trois lots sur trois parties différentes, 50, 50 et 150 coupes distinctes attendues (250 au total)**. Deux lots courts permettent de voir des profils différents sans engager immédiatement une partie entière ; le troisième triple leur longueur pour observer les temps par rang. Ce nombre et ces tailles sont à faire adopter avec le budget opérateur ; ce ne sont ni une puissance statistique démontrée ni la définition du « long lot » de V5. Les lots historiques de 47 à 213 coupes pouvant être trop courts pour V5, 150 ne prouve pas une absence de dérive. Aucun identifiant de partie, projet ou coupe n'est réservé ici.

Avant l'examen de la difficulté, faire proposer par l'opérateur des périmètres disponibles, puis fixer parties et listes ordonnées selon disponibilité et diversité du contexte, sans sélectionner seulement les coupes faciles ni retirer a posteriori les différés/arrêts. Exclure 9033 et 9241 ainsi que toute partie réservée à une validation future. Vérifier projet exact + partie, usages/réglages antérieurs, réservations existantes et nombre de coupes réellement disponibles : un numéro de partie ou compteur seul ne suffit pas. Les parties 9/12 ont servi au réglage ; 24 (P2) n'est pas réservée à V1. L'accord doit porter sur listes, budget et rôle de chaque lot. Si les disponibilités manquent, reporter ce choix ; ne pas lancer l'inventaire général D-067 ici. Il reste après acceptation V1, avant V2 ; ses réservations doivent être achevées/approuvées avant V3.

Sources : consignes originales/mission-v1-2026-10-02.md:214-234,359-393,436-445 ; cahier signé:297-307,411-421 ; D-073:17-25. Ces pièces sont jointes intactes à la transmission ; elles ne sont pas remplacées par le cahier historique plus ancien du code 4.8.6.

## Fiche opérateur — à exécuter seulement après feu vert terrain

| Action et but | Contrôle ou trace à conserver |
|---|---|
| Identifier exactement la référence, pour rattacher les temps à un produit | Version du manifeste, commit et SHA-256 du paquet réellement installé ; version interne exportée notée séparément, aucune identité inventée. La version 4.9.0.1 proposée est locale/provisoire tant que la réservation globale n'est pas vérifiée. |
| Fixer le périmètre avant de lancer, pour compter aussi les manques | Projet observé ou absent, projet déclaré séparément, partie et liste ordonnée des coupes attendues, exclusions et réservations, opérateur, date/fuseau. Attestation reliée aux SHA-256 de tous les fichiers, remplie après la séance. |
| Stabiliser les conditions, pour interpréter les différences | Même machine/poste, OS et navigateur, fenêtre ESV ≥600 pixels (dimensions exactes), zoom navigateur/ESV, réglages d'affichage, extensions actives, versions ESV si réellement observables. Noter une information inconnue comme inconnue. |
| Protéger les références et le travail, puisque Orbite peut poser et valider | Sauvegardes utiles et exports précédents préservés avant toute séance ultérieure ; la préparation ne lance aucune validation. Pas de purge pour faire de la place avant preuve d'enregistrement. |
| Repérer les contextes et interruptions | Heure murale de début/fin et fuseau ; lot/session/clockId réellement exportés ; pauses, reprises, causes, changements de projet/partie et de réglages. Une nouvelle horloge n'est jamais raccordée artificiellement à l'ancienne. |
| Surveiller sans modifier le déroulement, pour observer le vrai cycle | Utiliser les commandes existantes ; ne pas ajouter de commande ESV pour séquentialiser les étapes. Noter arrêt de protection, reprise, différé, passage inattendu et absence de réponse. |
| Terminer et sauver, pour prouver les mesures durables | Journal brut et Bilan complet, tous leurs segments, dictionnaires et métadonnées v1TimingExport ; si « Tout télécharger » est utilisé, garder aussi diagnostic/corpus. Vérifier les fichiers réellement enregistrés avant transfert ou purge ; consigner SHA-256, tailles, ordre et statut de chaque fichier dans le manifeste externe. |

**Arrêter la séance autorisée** et préserver les traces si le projet/partie sort du périmètre, identité ambiguë, comportement de pose inattendu, protection, adaptateur sans réponse, export incomplet, fichier non enregistré, v1TimingExport avec pertes/écritures encore en attente/santé incomplète/timeout. Un statut flushed seul ne rend pas la couverture complète. Ne pas purger, élargir le lot ni poursuivre ailleurs pour obtenir une couverture verte ; documenter la visite manquante et les reprises.

KI-069 reste une limite terrain connue : navigation/validation au dernier cut, Ctrl+Entrée et passage de partie ne sont pas encore entièrement démontrés dans ESV. La base comporte ses corrections historiques, aucun nouveau correctif ici. Un passage de partie ferme le lot ; consigner identités/arrêt et ne pas autoriser le traitement de la nouvelle partie. Source : KNOWN_ISSUES.md:41 ; mission originale:124-134.

## Fiche analyste — calcul et limites

Utiliser les outils inchangés du commit baa548d81a0bf7059ae1711163527a918cf2257d : tools/perf-lot.cjs et tools/perf-phases.cjs. Leur mode d'emploi et les sept bornes exactes sont dans FICHE-METHODE_INTACTE.md jointe. Aucun calcul terrain n'est disponible aujourd'hui.

1. Vérifier SHA-256, CRC si archive, liste/ordre de tous les segments et intégrité des dictionnaires ; garder les originaux intacts. Recenser chaque lot/session/horloge et l'attestation. Séparer identité observée et déclarée. Ne pas inscrire un projectId absent. Les bruts vont à l'analyste ; l'orchestrateur reçoit résumé, tableaux et statut d'intégrité, jamais les bruts.
2. Conserver **toutes** les visites et tous les jalons attendus, y compris différés, reprises et chevauchements. Contrôler santé finale, export, pertes, batchSeq, trous, conflits d'identifiants, séquence attendue/absente. Publier coverage.complete tel que calculé aujourd'hui, sans correction documentaire au vert.
3. Par phase et par lot : attendues, mesurées, inapplicables (motif justifié), chevauchées (overlapMs positif, ms null), manquantes (motif), effectif n, médiane/p90/maximum sur les seules durées calculables ; aucune durée manquante transformée en zéro. Les catégories de phase forment une partition par visite ; un contexte incomplet reste visible.
4. Publier durée totale murale début-fin avec pauses, durée totale issue du même clockId lorsqu'elle est calculable, temps de pause/arrêt et leurs limites de mesure. Ne pas soustraire une interruption déclarée d'une horloge incompatible. Publier chaque cause d'arrêt et arrêts/100 coupes **distinctes**, plus revisites séparées. Arrêt sans dénominateur connu = ratio non mesuré.
5. Publier nombre et durée de silences, chaque intervalle, cycles actifs et cycles >60 s séparés. La règle existante est >60000 ms ; sa confirmation reste à Mic, aucune nouvelle valeur fixée. Publier la distribution des écarts, sans supprimer des visites pour améliorer une médiane.
6. Montrer les spans V4.6 imbriqués et leur union temporelle, à l'intérieur et hors analyse ; ne pas ajouter ce temps une seconde fois au cycle. Un chevauchement réel reste publié ; ne pas sommer les médianes pour reconstruire une durée totale. Si une somme et son résidu sont montrés par l'outil, signaler la cohorte commune et que cette décomposition n'est pas une identité CPU.
7. Publier coût d'instrumentation : événements/octets UTF-8, maxEventBytes, coût local relevé, pertes, attente d'export plafonnée V1 à 250 ms. Le stockage asynchrone non isolé demeure inconnu/null ; ni zéro ni chiffre déduit par soustraction de médianes. Débit disque, IndexedDB réel et service worker suspendu restent non mesurés par les preuves Node.

Quantiles de l'outil : index floor(p×(n−1)+0,5), pas une autre convention silencieuse. Sources : tools/perf-phases.cjs:9-12,64-104,114-137 ; src/perf-phase.js:28-56,149-167 ; background.js:921-926.

**D5 vs V1.** Les 48 %/63 % historiques ne sont ni confirmés ni infirmés par des bornes différentes. D5 utilise événements durables/heure murale et sélection historique ; V1 suit des jalons reçus dans une horloge SW monotone, toutes les visites visibles. Après pose, adapter.state est une lecture d'état, pas une nouvelle capture LiDAR. Joindre les deux méthodes sans compléter une borne V1 manquante par D5. Sources : FICHE-METHODE_INTACTE.md:3-25 ; tools/perf-lot.cjs:101-128 ; tools/perf-phases.cjs:14-46 ; src/engine.js:153-161,255-256,809-812.

**Observation V1 puis comparaison future.** Ces lots mesurent seulement la référence 4.8.6+V1. Ils n'annoncent aucun gain et ne remplacent pas l'A/A de référence puis les blocs alternés de V3. Les tolérances durée totale/arrêts/C1 viennent du bruit A/A et doivent être adoptées par Mic ; aucune tolérance arbitraire ici. Le coût local de la mesure est publié, sa charge asynchrone reste non isolée. Sources : cahier signé:126-145,175-228 ; mission originale:228-234.

## Collecte existante vérifiée par lecture

Le journal lit événements/enregistrements directement dans IndexedDB et assemble un Blob par morceaux : panel.js:934-946,970-974. Il ne filtre pas les événements V1 et conserve les métadonnées retournées par journal-meta. Le Bilan transmet {...meta,events,records}, puis writeSegments conserve toutes les métadonnées hors cloudIds ; il garde donc v1TimingExport, événements, enregistrements et dictionnaires : panel.js:633-665,931,945-946 ; background.js:921-926. Les quatre commandes d'export demandent la santé V1 avec attente bornée ; ce contrôle est différent de la preuve d'enregistrement disque.

Budget par défaut Bilan : 48 Mio, réserve 4 Mio, plancher 48 objets de chaque côté de la coupe ; métadonnées et queue peuvent dépasser le réglage. KI-044 documente leur répétition. Le journal ne possède pas cette segmentation ; lecture directe évite le message runtime de 64 Mio, pas toute limite mémoire/disque. Repli par message possible si lecture directe indisponible ; signaler ce risque et arrêter si l'export échoue. Aucun nombre de fichiers, taille finale ou journal long en navigateur n'est garanti. Sources : panel.js:601-632,678-695,934-974 ; KNOWN_ISSUES.md:36,50-51.

Conserver Journal + Bilan complet et manifeste externe de **tous** les fichiers/segments, jamais seulement le dernier ; vérifier correspondance lot/horloge/santé. « Tout télécharger » continue après un échec et annonce les manques : lire son statut final, pas seulement le premier téléchargement (panel.js:982-992). Le réducteur Relecture efface events/clouds et reconstruit des records allégés : tools/reducteur-exports-core.js:34-74. La garantie historique concerne acceptance-report, pas V1. **Aucun export allégé utilisé pour cette étude** : conserver le journal et v1TimingExport sans réduction ; aucune refonte V2 ni collecte Écho supplémentaire requise pour V1.

## Proposition de critères pour une décision ultérieure

D-073 adopte la présentation seulement. L'analyseur et coverage.complete sont strictement inchangés. Les catégories ci-dessous restent incomplètes aujourd'hui ; elles ne peuvent être admises à la porte finale sans décision distincte de Mic et mission appropriée.

| Catégorie envisagée | Critères proposés, tous exigés ; aucune admission actuelle |
|---|---|
| Projet seulement déclaré | Attestation datée/signée par opérateur avec projet exact, partie, liste attendue, version/commit/paquet ; SHA-256 et noms de chaque export/segment ; unicité lot/session/horloge ; liaison univoque page/frame/forme/partie/coupe dans chaque visite ; changements explicitement partitionnés ; aucune contradiction observée ni correspondance incertaine. Projet observé/absent séparé. Tous jalons, visites, santé et preuves d'écriture restent exigés. |
| Jalons présents, chevauchement réel | Tous les jalons requis présents une fois, même capture/analyse/visite et même horloge monotone ; séquence et identités prouvées ; chronologie brute publiable ; overlapMs positif et ms null si non calculable ; union des intervalles calculables et cohortes publiées sans double compte. Aucune commande ESV ajoutée ni durée reconstruite pour combler une absence. Toute ambiguïté, jalon absent ou mauvais contexte reste incomplet. |

Pour chaque visite attendue, publier l'une des catégories et le motif, sans supprimer une visite ni transformer une inapplicabilité non prouvée en mesure. Toute perte, conflit, trou, liaison incertaine ou écriture non prouvée bloque cette proposition aussi. L'absence de projectId ou un chevauchement continue de rendre coverage.complete false dans l'outil actuel. Sources : tools/perf-phases.cjs:14-46,64-80 ; D-073:11-21.

Questions restant à la direction : nombre/tailles/budget et périmètres des lots ; accès et mission terrain ; réservation de numéro ; critères distincts éventuels d'admission ; règle de silence/long lot/seuil de dérive ; seuils et bruit A/A avant V3. Aucun essai ni chantier suivant n'est lancé.
