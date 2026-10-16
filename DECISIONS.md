# Décisions techniques

## D-099 - Test 12 (4.9.0.12) livrée : test 11 + retour à une coupe + panneau Orbite variante A (14 octobre 2026)

**Décision de l'orchestrateur (pleins pouvoirs D-096).** Branche `claude/49-test-12` (c9db895) = `claude/49-retour-coupe` (977108e) fusionnée avec `claude/ux-variantes` (e3820af, variante A « Accueil » retenue par Mic). verify 1490 réussis / 0 échec / 2 sautés. Paquet `ariane-4.9.0-test.12.zip`, SHA-256 `949afdb108bf2911a0b2d8fab2935e92719488efbbda4f7549ff69d4e9c38e1e`. Retour arrière : test 11 (SHA-256 a9675f28…1a1c). Le retour à une coupe n'est appelé nulle part et n'a pas de bouton. D-045 maintenue (politique dans « Détails du lot », pastille si hors défaut). Mic n'avait pas encore testé les tests 10 et 11 : la 12 contient tout, une seule installation suffit.

## D-098 - Retour à une coupe livré en lecture seule (branche `claude/49-retour-coupe`, 977108e) ; D-045 maintenue pour l'UX (14 octobre 2026)

**Décision de l'orchestrateur (pleins pouvoirs D-096).** (1) Retour à une coupe : action d'adaptateur `goToCut` (événement interne d'ESV si un écouteur est visible, sinon pas à pas par les boutons précédent/suivant, sinon refus avec raison), action de service worker `goto-cut` / `goto-cut-cancel`, événement de journal `goto-cut`, réglage `retourCut`. Lecture seule : zéro validation, zéro SKIP, zéro rail. Refusé pendant un lot sans pause effective, une pose, une validation ; garde D-067 : après un retour en pause, Reprendre/Réessayer/SKIP/Reprise manuelle refusés tant qu'ESV n'affiche pas de nouveau le cut du lot. Aucun bouton de panneau (la session UX réécrit le panneau). Rien n'est appelé par la décision de pose : ni moteur, ni vitesse changés. verify 1483 réussis / 0 échec / 2 sautés ; essai Chromium 7/7 sur page synthétique. **Non vérifié sur le vrai ESV** (hypothèses du banc local : index = N, partie en texte, boutons précédent/suivant sans décision). Aucun appel automatique tant que Mic n'a pas validé l'usage sur le terrain. (2) UX : le bloc « Ce lot applique » quitte la vue principale à la demande de Mic ; la politique effective reste affichée dans « Détails du lot » (+ pastille discrète si politique non par défaut) : l'invariant D-045 est maintenu.

## D-097 - Test 11 (4.9.0.11) livrée ; chantier UX lancé en session séparée (13 octobre 2026, nuit)

**Décision de l'orchestrateur (pleins pouvoirs D-096).** La test 11 = test 10 + B1 en mode ombre (calculé à côté, consigné `b1-ombre`, jamais appliqué) + correctif de sauvegarde KI-070. Branche `claude/49-test-11` (286d924 + version), verify 1465 réussis / 0 échec / 2 sautés. Le travail de l'agent B1 (coupé par un redémarrage du conteneur) était déjà commité : relu par l'orchestrateur, poussé, vérifié. Paquet `ariane-4.9.0-test.11.zip`, SHA-256 `a9675f286a14fcdba2e1acf8521241ccc5dc8a734d29a1d88bd2f7f1b36c1a1c`. Activation de B1 : seulement après lecture des notes `b1-ombre` d'un lot de terrain (justes perdus, faux ajoutés).
**Chantier UX (demande de Mic)** : la moitié basse de la vue Orbite est jugée illisible. Session dédiée (niveau fort), branche `claude/ux-variantes`, brief `design/ux-2026-10/BRIEF.md`, références Porsche et capture actuelle dans `design/references/ux-2026-10/` : quatre variantes, Mic choisit, puis intégration sans toucher aux identifiants du panneau. L'intégration au panneau sera rapatriée dans la ligne de test après le choix (merge des fichiers `panel.*` seulement).

## D-096 - Pleins pouvoirs de décision à l'orchestrateur jusqu'à la livraison de la 4.9 ; B1 accepté en lecture de la liste des coupes ; B1 lancé en mode ombre (13 octobre 2026)

**Réponses de Mic du 13 octobre 2026** (consignées par l'orchestrateur) : 398/402, B1, retour à une coupe, B2, B3 et apprentissage : « ok » ; report de B2, B3 et de l'apprentissage dans la définition de la 5.0 : « ok » ;
lecture des bords et du statut des cuts voisins dans la liste des coupes d'ESV, en lecture seule, sans rien stocker d'autre, aucune commande ni échange ajouté : « complètement ok ». Et : « Tout le reste est ok, je t'accorde
la liberté de valider, pousser et entreprendre sans l'attente de mon accord ce que tu veux jusqu'à la livraison finale de la 4.9. Les décisions t'appartiennent. » Il laisse aussi le choix du modèle, tâche par tâche.

1. **Portée de l'autonomie** : validation, poussée sur les branches de travail, lancement de chantiers et d'agents (en gardant l'économie de jetons de Mic : agents rares, relectures proportionnées, D-081, D-083), choix du
   modèle et de l'effort. **Non couvert, à demander** : fusion dans `main`, étiquette, publication, mise en production de la version stable (règle antérieure maintenue, aucune parole de Mic ne la lève nommément) ; pas de PR sans demande.
2. **KI-070 corrigé** (`claude/49-test-11`, `8806f05`) : `src/engine.js` (4 lignes), vrai essai (il échoue sans le correctif), baseline moteur ré-épinglée. Le correctif est dans la future 4.9.0.11, pas dans la test 10.
3. **B1 + 398/402** : constats mesurés sur un lot réel de 125 cuts (monde − scène = translation constante) ; fiche `fiches/FICHE_B1.md` ; implémentation confiée à un agent (modèle fort, mandat borné, branche `claude/49-test-11`)
   en **mode ombre** (réglage `appuisListe` à `ombre` : rien ne change dans les poses ; la décision hypothétique est seulement consignée) ; l'activation exigera le rejeu 398/402 et un lot terrain en ombre.
4. **Ordre de la suite** : B1 en ombre (4.9.0.11) → retour à une coupe → activation de B1 selon l'ombre → version stable 4.9.0 → 4.9.5 déclarée. V4, B2, B3, l'apprentissage : 5.0 (D-095).

## D-095 - Périmètre de la 4.9.5 rapide ; V4 sorti de la 4.9.0 ; trois mesures publiées ; relecture ciblée du moteur V5 lancée (13 octobre 2026)

**Réponse de Mic du 13 octobre 2026** (consignée par l'orchestrateur) : « Je valide tout le reste sinon », à la suite de mes recommandations : la 4.9.5 doit être rapide et efficace pour bouger sur la 5.0 (« que je vais
redéfinir avec toi »). **Lecture retenue** par l'orchestrateur (à corriger par Mic si elle est fausse) : Mic valide l'ensemble de ce qui a été proposé sans réserve nommée.

1. **V4 sorti de la 4.9.0** (levier de 0,3 % du cycle, D-076) : reporté à la 5.0 avec l'état actuel de sa préparation.
2. **4.9.5 rapide** : (a) **B1 + 398/402**, un seul chantier (même levier : lire les voisines validées dans la liste des coupes d'ESV, en dernier recours et comme garde de continuité au premier passage) ;
   (b) **retour à une coupe**. **Renvoyés à la 5.0** (définie avec Mic) : **B2, B3 et l'apprentissage**. Cela modifie D-086 point 1 (« non déplacés hors de la 4.9 »), sur l'accord de Mic.
3. **Trois mesures du cahier (§ 4.3)** : publiées avec la comparaison de `tools/perf-v3.cjs` (cycle médian hors silences avec P90, max et silences ; durée totale du lot ; arrêts pour 100 cuts avec causes séparées).
   Les interventions manuelles restent « non mesurées » (leur liste d'événements n'est pas établie). Essai ajouté ; tête `claude/49-test-10` ; le paquet test 10 n'est pas modifié (outil seulement).
4. **Relecture indépendante ciblée du diff de moteur V5** (`src/engine.js`, 87 lignes depuis la 4.8.6) lancée : un agent, lecture seule, (D-081, D-083). Résultat (un agent, 92 000 jetons, 16 appels) : **aucune perte de donnée dans le chemin normal** (arrêt entre l'écriture IndexedDB et la sauvegarde d'état, échec d'écriture, ordre, doublons, clé
   `recordId||id` identique : vérifiés ; `tests/v5-sauvegarde.test.cjs` 12/12). Trois constats, relus par l'orchestrateur sur le code : (i) **défaut latent** (`src/engine.js` `init`/`save`) : si la relecture des
   visites échoue au démarrage, un `save()` ultérieur réécrirait `recordIds` et `incompleteIds` vides (les visites restent dans IndexedDB, leur lien à l'état se perdrait) ; risque faible, le service worker n'accepte aucun
   message avant la fin de l'initialisation, et l'essai existant qui devait couvrir ce cas ne prouve rien (il vérifie un état jamais modifié) ; (ii) après un vidage puis un redémarrage, la validation du cut courant ne
   retrouve plus sa visite supprimée et n'en met pas à jour les champs (gênant, aucune donnée perdue, la visite avait été vidée après export) ; (iii) en migration depuis la 4.9.0.7, une visite jamais écrite dans IndexedDB
   est archivée dans `banane3VisitesHorsCache`, clé que rien ne relit ni n'exporte. **Correctif proposé, non appliqué** (3 lignes dans `src/engine.js` + essai réel + ré-épinglage du moteur, donc accord de Mic) : (i) ; (ii)
   et (iii) sont notés dans `KNOWN_ISSUES.md`.
5. **Accord requis avant B1** : la lecture de la liste des coupes d'ESV (bords X/Y/Z, statut) n'a aucun chemin trouvé hors d'un objet interne d'ESV ; la piste passive est de lire les réponses de la liste que l'observateur
   hooke déjà (`list-page`), en lecture seule, sans stocker d'adresse. C'est une lecture d'ESV hors du périmètre actuel de l'observateur (comptes seulement) : **décision de Mic demandée**.

## D-094 - Départ d'Astra : plus d'audit d'Astra ; 4.9 bientôt délivrée, 4.9.5 à suivre (13 octobre 2026)

**Déclaration de Mic du 13 octobre 2026** (consignée par l'orchestrateur) : « Astra nous quitte, nous n'aurons plus besoin de ses audits. […] Je considère que nous avons bientôt délivré la 4.9 :
il reste seulement à aboutir et peaufiner ce qui reste à faire pour la livraison d'une version stable. Nous allons pouvoir aussi bientôt effectuer les chantiers de la 4.9.5. »

1. **Audit d'Astra du diff avant toute version stable (D-061, cahier § 7) : retiré** des portes de la 4.9.0, par décision de la direction. Le texte signé du cahier n'est pas réécrit ; cette décision le remplace.
2. **L'audit indépendant du changement de moteur (V5, `src/engine.js`, D-089, D-091 point 3)** est lié à ce départ : il n'était pas nommé « Astra » mais restait dû avant toute version stable. Le seul
   changement de code gelé de la 4.9 est le diff de V5. **Proposition de l'orchestrateur, non décidée** : une seule relecture indépendante ciblée de ce diff (un agent, D-081, accord de Mic requis par D-083), ou l'abandon de cette
   relecture sur décision de Mic.
3. **Reste pour la version stable (4.9.0)** : test 10 sur une partie (fiche de départ, confirmation de la vitesse sur partie neuve, § 4) ; signature par Mic du critère D-073 (V1) ; publication des trois mesures ensemble (durée
   totale, arrêts pour 100 cuts) ; sortie de V4 de la 4.9.0 (recommandé, en attente de Mic) ; signature des portes ; fusion, étiquette et publication : décisions de Mic, jamais faites sans lui.
4. **4.9.5** : chantiers B1, B2, 398/402, apprentissage, retour à une coupe, un à la fois après la stable ; ordre à décider avec Mic.

## D-093 - Réponses de Mic sur U3 et lancement de la 4.9.0.10 : fiche de départ des parties, raccourcis écrits ; préchargement non inclus (13 octobre 2026)

**Réponse de Mic du 13 octobre 2026** (consignée par l'orchestrateur) : « D c'est pour passer au cut de droite. Maj + espace c'est pour valider un cut. […] Tu peux lancer la 0.10. »
Sur l'identifiant de projet de `DECISIONS.md` (ligne 487, session ancienne) : « m'en fou » : **laissé tel quel**, aucune modification.

1. **U3** : actions écrites : `D` = passer au cut de droite, `Maj + Espace` = valider un cut (actions d'ESV ; elles corrigent la lecture « rail droit » de l'étude E). Aucun
   raccourci ajouté ; essais que ni l'un ni l'autre n'est doublé ou détourné (`tests/u3-raccourcis.test.cjs`). Fiche : `fiches/FICHE_U3_RACCOURCIS.md`. Porte MINIMUM de U3 atteinte
   en essais hors ligne ; le comportement réel d'ESV sur ces touches repose sur la parole de l'opérateur.
2. **Fiche de départ des parties** (demande de Mic : retrouver les validés et invalides de chaque partie, oubliés avant une séance) : le résumé de liste d'ESV d'avant séance
   (`list-summary`, déjà observé) alimente une fiche (heure, partie, validés, invalides, total), gardée dans une clé à part de `chrome.storage.local` (`banane3FichesDepart`, 200
   fiches au plus), que le vidage du cache ne touche pas ; affichée dans le panneau (bloc « Départs des parties »), recopiée dans chaque export (`fichesDepart` du bilan,
   `CONTENU.txt`). Cette fiche ne peut pas remonter les parties passées : elle ne couvre que les séances faites avec la 4.9.0.10.
3. **Préchargement du cut suivant : non inclus.** Rien ne démontre qu'il soit faisable sans toucher à ce qu'ESV charge : la vue d'un cut ne se charge qu'une fois la navigation
   faite, et la pose du cut courant exige que ce cut reste affiché pendant l'analyse (0,6 à 0,9 s). Le transfert de la capture ne pèse que ~0,1 s. Piste à étudier à part : relever,
   par cut, quels nœuds de points ESV charge (sans stocker d'adresse) pour voir si un chargement anticipé par le cache HTTP est possible. Décision de Mic nécessaire avant tout essai.
4. **Version de test 4.9.0.10** « 4.9.0 test 10 » = 4.9.0.9 + points 1 et 2 : `ariane-4.9.0-test.10.zip`, SHA-256 `09c32aaf…03949`, 1 296 165 octets, tête `2698492`
   (`claude/49-test-10`, poussée) ; verify 1442/1440/0/2 (moteur et géométrie inchangés) ; **aucune relecture par agent** (D-081, D-083 : lecture de données sans suppression, essais
   sur le service worker réel, relecture du diff par l'orchestrateur ; un défaut trouvé par le banc : une minuterie du panneau décalait le rang que des essais lui attribuent, corrigé).
   Consigne `consignes/seance-terrain-test-10-2026-10-13.md` (retour arrière vers la 4.9.0.9).

## D-092 - Fin des essais de volume : la direction juge suffisants les lots reçus ; passage à la suite du cycle (13 octobre 2026)

**Décision de Mic du 13 octobre 2026** : « On va s'arrêter là. Nous n'avons pas besoin d'aller jusqu'à 300 cuts, la direction estime ce nombre suffisant. Nous pouvons passer à la
suite du cycle de développement du projet. » Consignée par l'orchestrateur. Le critère « un lot d'au moins 300 cuts sans vidage » (D-087, D-089) est **levé** par la direction ; il n'a
pas été atteint en un seul lot, et le texte ne prétend pas le contraire.

Preuves terrain disponibles (aucune n'est un lot unique de 300 cuts) :
- 4.9.0.8 (tirage un cut sur deux) : cinq lots du 13 octobre, environ 600 cuts : rapide −60 à −62 % du cycle médian, part posée égale ou meilleure, écartement identique, aucune dérive
  (cycle stable par tiers de lot), un incident en mode référence (recentrage refusé par ESV, hors rapide).
- 4.9.0.9 (un cut sur dix en référence, `echantillon`) : partie 13 (138 cuts) et partie 15 (139 cuts), 277 cuts dont 252 en rapide : −53 à −64 %, part posée 80,7 % et 89,8 % en rapide,
  C3 observé à 0 (écartements posés de 1 424 à 1 465 mm), 0 capture en erreur, lecture par rail mesurée (0,26 s), exports allégés produits sur le poste (environ −25 % par cut ;
  les nuages denses pèsent plus). Les trois derniers cuts de la partie 13 à 0 point sont une fin de ligne normale (confirmé par Mic) ; une partie des reports de la partie 13 vient d'une
  coupure de connexion de l'opérateur (Ariane a reporté sans poser).
- Non vérifié : lot unique de 300 cuts ou plus, Edge, Chrome/Edge avant la version 129, réseau lent, audit indépendant du moteur.

Suite du cycle (propositions, rien d'autre n'est décidé) : (1) U3, bloqué par l'action de `D` à fixer par Mic ; (2) 4.9.0.10 : préchargement du cut suivant et fiche de départ des parties
(validés, invalides, total, conservée hors du cache et exportée) ; (3) audit d'Astra du diff avant toute version stable ; (4) signature des portes du cahier § 7.

## D-091 - Décisions de Mic sur le lot 4.9.0.8 : mode rapide sur neuf cuts sur dix, allègement A des exports, moteur V5 validé ; version de test 4.9.0.9 (13 octobre 2026)

**Réponse de Mic du 13 octobre 2026** aux trois décisions de D-090 : « 1. Je valide et avec le temps et la confiance nous pourrions l'étendre voire supprimer cela.
2. Oui. 3. Je valide. » Consignée par l'orchestrateur.

1. **Mode rapide généralisé** (réglage `modeRapide: 'echantillon'`) : un cut sur dix, tiré d'après son numéro (même hachage que le tirage, premier dixième), reste en
   référence pour surveiller la qualité ; répartition régulière (un cut de référence tous les 5, 8 ou 13 cuts, 28 à 32 sur 300). L'échantillon pourra être réduit ou
   supprimé avec le temps et la confiance (Mic). La règle est consignée à la fin de chaque capture (`regleLecture`).
2. **Allègement A des exports** (réglage `export.mode: 'allege'`) : sondes de diagnostic retirées des seuls nœuds sans point retenu dont aucune sonde ne touche la zone ;
   `nearestToRailOrigin`, points, intensité, classe, pointSources, visibilité inchangés au bit près ; chaque nuage allégé porte `exportLightening`. Rejoué sur l'export du lot
   4.9.0.8 : corpus 21,7 → 14,6 Mo compressés (−33 %), 2 711 nœuds allégés, touches de zone des sondes inchangées (357), aucun autre champ modifié, nuage source intact, rejeu
   des décisions du lot (acceptance-report) fidèle sur 112 cuts sur 112. Écarts à ce que D-090 chiffrait (−48 %) : les 121 nœuds vides dont une sonde touche la zone (anomalie
   à comprendre) gardent leurs sondes ; l'arrondi des points au micromètre est abandonné après relecture indépendante (il faisait échouer le rejeu exact à 0,3 µm : 103 sur 112).
3. **Moteur** : le changement de `src/engine.js` fait pour V5 (D-089) peut aller au-delà des versions de test ; l'audit indépendant avant toute version stable reste dû ; la
   baseline le note.
4. **Mesure** : chaque étape de la page porte son heure (`pageMs`) ; `tools/perf-v3.cjs` l'utilise. Au banc ESV local, vrai code de page : lecture par rail en rapide 0,17 à
   0,48 s à l'heure de la page, contre 0 à 11 ms à l'heure de réception (artefact de D-090) ; en référence les deux concordent.
5. **Analyse** : `tools/perf-v3.cjs` range chaque visite selon le mode consigné de sa capture (un lot repris après retour arrière ou lu avec `--tous` peut mêler deux règles,
   et le rapport le dit) ; rapport du lot 4.9.0.8 inchangé.
6. **Version de test 4.9.0.9** « 4.9.0 test 9 » = 4.9.0.8 + points 1, 2, 4 et 5 : `ariane-4.9.0-test.9.zip`, SHA-256 `0d9637b0…5fba7`, 1 290 817 octets, tête `4faf5a2`
   (`claude/49-test-9`, poussée) ; verify 1424/1422/0/2 ; relecture indépendante (un agent : deux défauts d'analyse corrigés et revérifiés, aucun défaut de pose) ; banc ESV local
   avec le vrai code de page. Consigne `consignes/seance-terrain-test-9-2026-10-13.md` (retour arrière vers la 4.9.0.8). Recette d'analyse d'un lot pour toute session :
   `PILOTAGE_REPRISE.md` § 8.

## D-090 - Premier lot terrain en 4.9.0.8 : mode rapide −64 % sur le temps par cut, qualité identique (13 octobre 2026)

**Lot de Mic** du 13 octobre (export privé, hors dépôt) : 4.9.0.8, une partie, 112 cuts (95 posés, 17 différés) en 8 min 24 s, fin de partie traitée (dernier cut validé
en place, compteur passé de N à N+1). Tirage cut par cut : 46 référence (comme la 4.9.0.5), 66 rapides. Calculs de l'orchestrateur (`tools/perf-v3.cjs`, scripts privés) ;
le workflow d'analyse à 4 agents s'est arrêté sur la limite de session sans rendre de résultat (environ 426 000 jetons dépensés) : vérifications refaites sans agent.

1. **Vitesse** : cycle médian V1 **2,44 s** en rapide contre **6,73 s** en référence (**−63,7 %**, intervalle à 95 % de −4,77 à −3,63 s ; bruit A/A 7 %). Mesure indépendante
   (intervalle entre deux changements de cut) : 2,79 s contre 7,05 s (−60 %). Capture 1,35 s contre 5,11 s ; pose (phase V1) 0,19 s contre 0,86 s. 132 vues lues au signal, 0 repli
   sur 800 ms en rapide ; 0 relecture, 0 erreur, 0 repli de pose. Voisinage : un cut rapide après un rapide 2,32 s, une référence après une référence 6,55 s (−65 % si tout était rapide).
2. **Qualité** (même lot, deux moitiés) : part posée 84,8 % dans les deux bras ; points par capture 3 574 contre 3 579 ; écartement des paires posées médiane 1 436,7 mm dans
   les deux bras (1 429 à 1 448 mm) ; reports au même taux (rails « flanc interne insuffisamment observé » : 10,6 % des cuts rapides, 10,9 % des cuts référence) ; un cut rapide reporté
   pour écartement hors contrat (1 312 mm), cas unique, non attribuable sans relecture ; preuves de validation identiques (navigation). Aucun incident.
3. **V5** (deux bras) : phases des cuts posés, analyse 0,51 à 0,54 s et validation 0,21 à 0,24 s, contre 1,25 s et 1,04 s sur le lot du 12 octobre (autre partie, lot long avec
   historique) ; tiers du cycle rapide 2,79 / 2,56 / 2,29 s : pas de dérive sur ce lot court. À confirmer sur un lot d'au moins 300 cuts.
4. **Artefact de mesure** : en rapide, la lecture par rail apparaît à 0,00 s (l'étape « capture-read » est horodatée par le pont après la lecture, la suite de `scheduler.yield`
   passant avant la tâche de message) ; la durée totale de capture est juste. Correctif proposé : horodater les étapes dans la page.
5. **Proposé à Mic** : (a) généraliser le mode rapide (`modeRapide: 'toujours'`) en gardant un échantillon de référence d'un cut sur dix pour la surveillance ; (b) allègement A
   des exports (−48 % du corpus sur ce lot) ; (c) horodatage des étapes dans la page ; puis préchargement du cut suivant et réduction du transfert de la capture.

## D-089 - V5 : sauvegarde de l'état à taille constante (4.9.0.8) ; inventaire du poids des exports (13 octobre 2026)

**Instruction de Mic du 13 octobre 2026** : « Constat confirmé sur terrain, quand on ne pouvait pas vider le cache et qu'Ariane conservait l'historique des précédents lots, au bout
de quelques lots, Ariane devenait affreusement long à poser. […] quel que soit le poids des données, elles ne devraient pas ralentir la pose. Deuxièmement, […] poursuivre le
développement des json contenus dans le ZIP, trouver des pistes d'allègement sans pour autant perdre en qualité et précision des données capturées. » Consignée par l'orchestrateur.

1. **Cause mesurée dans un vrai Chromium** (extension de mesure, privée) : `chrome.storage.local.set` coûte environ **50 ms par Mo** (0,14 Mo : 4,5 ms ; 1,1 Mo : 57 ms ; 2,1 Mo : 133 ms ;
   4 Mo : 220 ms ; 7,9 Mo : 470 ms ; 2 Ko : 0,6 ms). Le moteur réécrivait **tout** son état à chaque événement (une vingtaine par cut), **visites de tous les lots comprises** :
   `s.records` n'était jamais réduit, **même après « Vider le cache des exports »** (le vidage ne touche que IndexedDB ; `background.js` le disait : « l'état du moteur, lui, garde tout »).
   Export du 12 octobre : 235 visites = 1,6 Mo (environ 7 Ko chacune) ; quelques lots = plusieurs Mo, donc plusieurs secondes de sauvegarde par cut. Le constat de Mic est expliqué.
2. **Version de test 4.9.0.8** « 4.9.0 test 8 » = 4.9.0.7 + V5 :
   - une visite ou capture abandonnée dont l'écriture IndexedDB est **confirmée** n'est sauvegardée que par son identifiant, à sa place ; toute autre entrée reste recopiée (rien ne repose
     sur une écriture non sûre) ;
   - au démarrage, visites relues dans IndexedDB ; une visite absente a été vidée après export : retirée et comptée. **Ancien format** : les visites absentes d'IndexedDB (déjà vidées)
     sont **archivées une fois** hors de l'état (`banane3VisitesHorsCache`), rien n'est effacé ; sans archive possible, elles restent comme avant ;
   - les événements d'information (étapes de la page, diagnostics du pont), déjà dans IndexedDB, ne réécrivent plus l'état.
   - `records` et `incomplete` restent écrits vides : une version antérieure (retour arrière) relit l'état sans planter ; ses ajouts sont repris à la remise à jour.
   **Moteur ré-épinglé** (`audit/v4.6.0-engine-baseline.json`, périmètre déclaré) : `src/engine.js` change ; géométrie, GCV1 et lecteur LiDAR inchangés. **À valider par Mic.**
   **Relecture indépendante** (un agent, lecture seule) : rien de bloquant en marche normale ; deux pertes possibles sur panne d'IndexedDB (identifiants effacés si la base est
   illisible au démarrage ; modification perdue si une réécriture échoue), **corrigées avec essais**. **Vrai Chromium, vraie extension** : chrome.storage rend les objets clés triées
   (défaut trouvé et corrigé) ; ancien état de 600 visites (4,3 Mo, 104 ms par sauvegarde) migré en 4,6 Ko et **0,97 ms par sauvegarde** ; 200 visites vidées archivées, 400 relues.
3. **Inventaire du poids des exports** (export du 12 octobre, 219 Mo bruts, 54 Mo compressés) : le corpus LiDAR fait 88 % du ZIP. Dans un nuage : les nœuds 52 %, dont 85 % de **sondes
   de diagnostic** (« for diagnostics only ») surtout sur des nœuds sans point retenu (6 nœuds sur 30 ont des points) ; les points 27 %, écrits avec 17 chiffres alors que la source
   (Float32 de Potree) n'a qu'une précision de 61 µm ou plus à ces distances. Chiffré sur un vrai segment (11,3 Mo compressés) : sondes des nœuds sans point retirées → 7,0 Mo ;
   + textes répétés et doublons exacts factorisés, visibilité en 0/1 → 7,0 Mo ; + points arrondis au micromètre (écart max 0,5 µm, sous le pas Float32 : rien de mesuré n'est perdu)
   → **5,7 Mo (−49 %)** ; toutes les sondes retirées → 4,5 Mo (−60 %). **Propositions, non appliquées : décision de Mic** (les sondes sont des diagnostics du lecteur ; le lecteur
   `vendor/lidar.js` reste gelé : l'allègement se ferait à l'export, ou à la réception dans le service worker).

Réalisé : branche `claude/49-test-8` (base `claude/49-test-7`, tête `e95dbae`, poussée, non fusionnée), `verify` 1407 essais, 1405 réussis, 0 échec, 2 sautés ; paquet
`ariane-4.9.0-test.8.zip` (SHA-256 `c58af02781c0a5a7caf81cd11e772e8e63a571d37323c0f60696d0f9bfcb53a4`, 1 283 050 octets, sans `tests/`) ; consigne `consignes/seance-terrain-test-8-2026-10-13.md`
(un lot d'au moins 300 cuts, puis si possible un second lot sans vider le cache entre les deux ; la test 8 contient les tests 5 à 7, non essayées sur le terrain). Mesures privées
(`scratchpad/v5/`, hors dépôt). **Non autorisé** : fusion, étiquette, publication, production ; allègement des exports (propositions du point 3) avant la décision de Mic.

## D-088 - V3 « mode rapide » : trois attentes de prudence retirées sur un cut sur deux (4.9.0.7), prouvé au banc ESV local (13 octobre 2026)

**Instruction de Mic du 13 octobre 2026** : « J'ai l'impression qu'on rame vraiment sur cette mission du gain de temps […] tu dois innover, réfléchir à des solutions que
personne n'aurait pensé, exploiter le code au mieux, trouver des failles (pour ça qu'on a fait un ESV local), cherche […] sans relâche, cette mission ne doit pas être un échec. »
Consignée par l'orchestrateur Claude Code ; travail fait sans autre agent qu'une relecture indépendante du diff (D-081 : le code touche la pose).

1. **Où part le temps** (lot du 12 octobre, 181 cuts posés, cycle médian 8,49 s) : capture 4,83 s (par rail : sélection 0,29 s, stabilité 0,85 s, lecture 1,05 à 1,11 s),
   analyse 1,25 s, décision 0,18 s, pose 1,35 s (dont 0,65 s de recentrages), validation 1,04 s. Les attentes de prudence (sélection, 800 ms de stabilité, recentrages de la pose)
   font environ 2,5 s par cut ; le service worker (analyse, pose, validation hors commandes ESV) environ 3 s, en dérive (V5).
2. **Trois failles d'ESV exploitables, lues dans son code et prouvées au banc ESV local** (code d'origine d'ESV et de Potree, essai `x_turbo`) :
   - **Pose sans recentrage (P1)** : le clic sur le canevas pose le rail du côté COURANT au point où le rayon de la caméra coupe le plan de coupe (5 × 7 m, les deux rails dedans) ;
     ESV ne vérifie pas que ce point est dans la vue. Le bouton de rail change le côté tout de suite, la caméra ne suit qu'à l'image suivante. Un clic calculé avec la caméra active,
     dans la même tâche, pose donc le rail visé même hors de la vue : 5 poses sur 5 sous 0,6 mm, 1 à 4 ms chacune ; l'écriture de validation porte exactement ces positions.
   - **Sélection à l'image (I2)** : le rail demandé est dans la vue dès l'image qui suit le clic (6 sur 6), au lieu de trois sondages immobiles à 80 ms.
   - **Signal de fin de chargement (I3)** : « aucun chargement en cours et mêmes nœuds sur deux images de suite » donne les mêmes nœuds qu'après 800 ms dans 32 vues sur 32 ;
     il ne conclut jamais quand un bloc d'ESV reste pendu (4 sur 4) : la règle des 800 ms reste le repli.
3. **Version de test 4.9.0.7** « 4.9.0 test 7 » = 4.9.0.6 + I2, I3, P1, sur le **même tirage cut par cut** (`pilote.modeRapide = 'tirage'`) : un cut « rapide » a les quatre pièces
   (I1 compris), un cut « référence » fait tout comme la 4.9.0.5. Chaque pièce se coupe seule (`pilote.rapide`). Gardes : côté d'ESV relu sur la classe de son bouton avant le clic,
   l'autre rail ne doit pas bouger (sinon arrêt, état à réconcilier), pose à 1 mm sinon recentrage comme avant ; lecture au signal contrôlée (rien ne change pendant la lecture,
   sinon relecture à la règle des 800 ms). **Le mode rapide groupe trois changements dans un bras** : écart à la règle « une modification par version » du cahier, proposé parce que
   le tirage cut par cut mesure le tout dans un seul lot et que chaque pièce reste isolable par réglage. **À valider par Mic.**
4. **Preuve de bout en bout au banc** (essai `x_ariane` : le vrai code de page d'Ariane injecté dans le vrai ESV, cache de Potree vidé avant chaque coupe, latence simulée 40 et
   120 ms par bloc, une session par mode, mêmes coupes) : **points lus identiques 12 visites sur 12** ; capture médiane 2,96 s contre 5,45 s (120 ms) et 2,25 s contre 4,66 s (40 ms) ;
   pose 7 ms contre 655 ms ; écart des poses rapides au plus 0,64 mm. Gain au banc : environ 3 s par cut. **Non mesuré sur le vrai ESV** (carte graphique, réseau, Edge).
5. **Relecture indépendante** (un agent, lecture seule, confrontée au code d'ESV et de Potree) : rien de bloquant. Appliqué : le signal exige aussi la même caméra et la même
   découpe sur ses deux images (Potree choisit les nœuds avec celles de l'image précédente) ; une lecture de la scène qui échoue est réessayée à l'image suivante. Banc après
   correction : mêmes empreintes de points 6 visites sur 6, lecture au signal sur les deux vues.
6. **Suite proposée** : V5 (stockage incrémental, dérive du service worker) en 4.9.0.8 après la mesure de la 4.9.0.7 ; puis, selon ce que la 4.9.0.7 laissera dans
   l'attente de chargement, préchargement des nœuds du cut suivant (I6, idée nouvelle, non essayée).

Réalisé : branche `claude/49-test-7` (base `claude/49-test-6`, tête `adfcd8d`, poussée, non fusionnée), `verify` 1391 essais, 1389 réussis, 0 échec, 2 sautés (corpus natif privé absent) ;
paquet `ariane-4.9.0-test.7.zip` (SHA-256 `f2d01aef4d4eb65d0a9f0d7a2931d975ec2d2fef7a7a65bcb6397b1cab26876a`, 1 276 335 octets, sans `tests/`) ; consigne
`consignes/seance-terrain-test-7-2026-10-13.md` (un lot d'au moins 300 cuts, partie neuve ; la test 7 contient la test 6, qui n'a pas été essayée sur le terrain). Essais du banc privés
(`missions/B_ESV/banc/essais/x_turbo.cjs`, `x_ariane.cjs`, hors dépôt). **Non autorisé** : fusion, étiquette, publication, production ; mode rapide hors version de test ; tout seuil ou porte du
cahier (le regroupement de trois changements dans un bras reste une proposition jusqu'à la réponse de Mic).

## D-087 - A/A calculé sur les exports reçus ; V3 : expérience I1 tirée cut par cut (4.9.0.6) ; dérive mesurée, V5 déclenchable (13 octobre 2026)

**Instructions de Mic du 12 et 13 octobre 2026** : « Tu peux lancer la suite des chantiers notamment sur celui du gain de temps » ; « Tu as eu assez d'exports pour le faire » ;
« Ok après la 4906 continue les chantiers ». Consignées par l'orchestrateur Claude Code, sans agent.

1. **A/A (cahier § 4.2, M3) calculé sur les exports reçus**, au lieu de deux lots neufs : cinq lots d'au moins 40 cuts en 4.9.0.2, 4.9.0.3 et 4.9.0.4 (capture, analyse et décision
   inchangées depuis le 29/09), cycle V1 (navigation → cut suivant observé, ≤ 60 s, la définition des portes). Scripts privés, résultats :
   - **Entre parties** (lots d'au moins 150 cuts) : cycles médians de 7,16 à 8,30 s. Comparer deux versions sur deux parties différentes est inutilisable.
   - **Blocs alternés simulés (M1)**, blocs de 10 à 30 cuts : écart P95 de 12,5 à 18,7 %.
   - **Tirage fixe cut par cut** (règle de la 4.9.0.6) : écarts réalisés de 0,4 à 1,6 % ; P95 sur 500 autres tirages de 4 à 7 % (lots d'au moins 150 cuts). **T3 proposé : 7 %** sur le
     cycle médian. **C1** (part posée) entre deux moitiés tirées : P95 de 8 à 13 points ; tolérance proposée **8 points** sur un lot d'au moins 300 cuts.
   - **Dérive dans un lot** : du 1er au 3e tiers, +30 % et +38 % sur le cycle des deux plus longs lots, toute dans le service worker (analyse, décision, pose, validation). Voir 4.
2. **Méthode de comparaison proposée** (change la décision M1 du 30/09, cahier § 2.4, **à valider par Mic**) : les deux modes sont comparés **dans un même lot**, chaque cut tiré une fois
   pour toutes d'après son numéro. Bruit deux à trois fois plus faible que les blocs alternés, aucun changement d'extension entre blocs, ni partie, ni heure, ni dérive dans l'écart.
   « Une seule modification par version » est tenu : la moitié « référence » lit exactement comme la 4.9.0.5.
3. **V3, expérience I1** (D-078 : option de pause existante de `vendor/lidar.js`, fichier inchangé, version de test seulement) : version **4.9.0.6** « 4.9.0 test 6 » = 4.9.0.5 + I1 tirée cut par cut
   (`pilote.lectureI1 = 'tirage'`). Mêmes points lus quelle que soit la pause (essai sur le banc de 500 000 points). Mode consigné par cut dans le journal. Outil de mesure :
   `tools/perf-v3.cjs` (deux modes d'un même lot : cycle, C1, étapes de la capture par rail, intervalle à 95 %). Sur la partie 5 (sans I1), l'outil rend 1,9 % d'écart, dans le bruit.
   Décomposition de la capture (8 lots) : par rail, sélection 0,30 s, stabilité 0,83 s (à 67 % exactement le délai de 800 ms), lecture 0,95 s ; I1 vise la lecture (labo 0,90 → 0,29 s).
4. **V5** : cause probable lue dans le code, `save()` réécrit tout l'état à chaque événement (environ 30 par cut) et l'état garde tous les enregistrements depuis le dernier vidage
   (2 Mo et 30 ms de copie par sauvegarde avec 432 enregistrements, contre 0,4 Mo et 7 ms au départ). Fiche : `fiches/FICHE_V5.md`. **Seuil de dérive proposé : +10 % du 1er au 3e tiers
   d'un lot d'au moins 150 cuts** (cahier § 11 n° 15) ; mesuré +30 et +38 % : V5 serait déclenché. Décision de Mic.

Réalisé : branche `claude/49-test-6` (base `claude/49-test-5`, tête `81e6e6f`, poussée, non fusionnée), `verify` 1372 essais, 1370 réussis, 0 échec, 2 sautés (corpus natif privé absent) ;
paquet `ariane-4.9.0-test.6.zip` (SHA-256 `91b4240627bf3b1456cf54b5aded5a6d9943e04b16be39c54c443a4b238ca7b2`, 1 269 166 octets, sans `tests/`) ; non essayé dans Chromium ni sur le vrai ESV ; consigne
`consignes/seance-terrain-test-6-2026-10-13.md` (un lot d'au moins 300 cuts, partie neuve). **Non autorisé** : fusion, étiquette, publication, production ; I1 hors version de test ; tout seuil
ou porte du cahier (T3, tolérance C1, méthode et seuil V5 restent des propositions jusqu'à la réponse de Mic).

## D-086 - Sessions courtes par chantier, routage des modèles, compaction ; coupes difficiles et apprentissage maintenus en 4.9 (12 octobre 2026)

**Réponses de Mic du 12 octobre 2026** au point d'étape de l'orchestrateur Claude Code :
1. **Non** : les coupes difficiles (retour à une coupe, 398/402, B1, B2, B3), l'apprentissage et V5 **ne sont pas déplacés hors de la 4.9** (D-066, D-068 maintenus).
2. **Oui, très d'accord** pour une session courte par chantier avec fiche de reprise ; et « pour chaque tâche tu saches évaluer quel modèle Claude utiliser avec le niveau d'effort adéquat,
   auto-compact lorsque nécessaire ou opportun ». Règles écrites dans `PILOTAGE_SESSIONS.md` ; première fiche : `fiches/FICHE_AA_V3.md`.
3. **On enchaîne** : version installée par Mic, puis test A/A (la même version sur deux lots comparables), puis V3.

Limites dites à Mic : l'orchestrateur règle le modèle et l'effort de ses agents ; le modèle et l'effort de la conversation, `/compact` et `/clear` restent des commandes de Mic, l'orchestrateur
signale les points de compaction recommandés. Le routage est une recommandation, à corriger avec les coûts mesurés par chantier. Rien d'autre ne change : portes, seuils et critères (D-085 compris).

## D-085 - Borne 1420 mm mesurée puis adoptée ; C4 retiré des portes de la 4.9 ; C4 à retravailler pour la 5.0 (12 octobre 2026)

**Réponses de Mic du 12 octobre 2026** à l'orchestrateur Claude Code (suite de D-084) : sur les paires entre 1405 et 1420 mm, « il y en a quasiment pas » ;
(1) « Oui » : mesurer l'effet de la borne 1420, puis l'adopter ; (2) tout ce que prévoit le cahier de la 4.9 « n'aura pas de grandes influences sur le placement
du champignon par le super cerveau d'Ariane » : **C4 est retiré des portes de la 4.9**, exclusivement pour la 4.9 ; (3) **C4 sera retravaillé entièrement** : Mic a des orientations
différentes de ce qui était prévu pour la 5.0.

Effet : la porte « C1 et C4 non dégradés » du cahier (§ 7) devient « **C1 non dégradé** ». Les autres portes, C3 = 0 et zéro capture perdue compris, sont inchangées. C4 reste
calculé à titre d'information quand une relecture existe ; il ne bloque plus rien en 4.9.

Mesure de la borne 1420 (orchestrateur, sans agent) :
- Lots du 12 octobre (210 coupes, parties neuves) : 0 paire appliquée entre 1405 et 1420 mm (appliquées de 1426,2 à 1465,4 mm) ; les 6 refus d'écartement sont tous sous 1350 mm.
  **Aucune décision ne change sur ces lots.**
- Rapports historiques du dépôt : 1 cas dans la zone, partie 34 coupe 1834, appliquée à 1411,2 mm et jugée FAUSSE (26,5 mm).
- Essais synthétiques : les paires fausses du moteur (poses ESV décalées de 150 à 250 mm) sont à 1415 à 1418 mm ; la nouvelle borne les abstient en amont.
- **Non mesuré** : rejeu du banc de 633 coupes (corpus natif privé absent ici, `verify` en mode partiel).

Réalisé : branche `claude/49-ecartement-1420` (tête `4aa5167`, poussée, base `claude/49-test-4`, non fusionnée) : `src/gauge.js` (`lowMm` 1420), essais de frontière mis à jour, deux essais de fixture
recalés (choix par la voie à 140 mm au lieu de 150 ; instantané sous 1405 pour le chemin KI-053), `verify` 1354 essais, 1352 réussis, 0 échec, 2 sautés. Pas de paquet : la borne partira dans la prochaine
version de test. Les textes signés ne sont pas réécrits.

## D-084 - Limites d'écartement 1420 à 1470 mm ; C4 à faire évoluer (12 octobre 2026)

**Instruction de Mic du 12 octobre 2026**, consignée par l'orchestrateur Claude Code :
1. « Mise à jour des limites d'écartement : **1420 à 1470** » (elles étaient [1405, 1470]).
2. **C4 doit évoluer** : « on ne pourra pas toujours attendre la correction humaine » ; Mic estime que les coupes posées par Ariane sont exactes à environ 97 %.

État au moment de l'enregistrement (lu dans le dépôt, **rien n'est modifié dans le code**) :
- La borne basse 1405 est dans `src/gauge.js` (`lowMm`), dans l'outil de rapport d'acceptation (classe `LOW_INVALID`) et dans les textes signés (cahier, passations,
  `PROJECT_STATE.md`) ; ces textes ne sont pas réécrits, cette entrée fait foi à partir d'aujourd'hui. `src/lot-decision.js` a déjà une garde de première passe
  `lowGaugeGuardMm: 1420`. Passer la borne à 1420 change des décisions pour les paires comprises entre 1405 et 1420 mm : l'effet doit être mesuré par un rejeu du banc
  (633 cuts, 8 jeux) avant adoption, et les critères « décisions identiques » des chantiers V1, V2, V4, U1 à U3 se lisent désormais contre la nouvelle borne.
- C4 actuel (cahier § 5.1) : au moins 100 posés jugés par une relecture humaine, au moins 80 % des posés jugés, au plus 2 faux pour 100 jugés. Références du cahier : 4.8.0 =
  1 faux sur 353 (0,28 %), partie 25 = 2 faux sur 62 (3,2 %, soit 96,8 % exactes). Un taux de 3 % dépasserait le seuil actuel de 2 pour 100.
- Options pour faire évoluer C4 (à choisir par Mic, rien n'est décidé) : (a) relecture humaine d'un échantillon tiré au hasard (30 à 40 coupes par partie) au lieu de 100 et plus,
  avec cumul sur plusieurs parties (D-061) ; (b) pour les chantiers qui changent la capture (V3), comparaison appariée de deux versions sur les mêmes coupes, « zéro écart non
  expliqué », sans relecture humaine (cahier § 5.2, niveau 3) ; (c) étude d'un indicateur sans humain : reprise ultérieure d'une pose par l'opérateur, vue par l'observateur passif ;
  (d) score de justesse hors ligne, sans activation (feuille de route, idée D I-3).
- Aucun changement de seuil, de porte ou de critère n'est appliqué tant que Mic n'a pas choisi.

## D-083 - Consommation de tokens : mode économe (12 octobre 2026)

**Instruction de Mic du 12 octobre 2026** : « Je veux que mes tokens soient utilisés intelligemment, de sorte à ne pas niquer ma consommation
avec tes multi et revérification avec 30 agents à la fois. » Cette entrée consigne cette instruction ; les règles d'application sont celles de
l'orchestrateur Claude Code, qui les applique dès maintenant.

Mesure faite le même jour sur la transcription de la session (estimation, prix des modèles non connus) : environ 59 % du coût vient des
missions d'étude du début (23 agents), 17 % du test 3 (19 agents lancés), 14 % du fil principal, 8 % du test 4. Cause principale : chaque appel
d'outil d'un agent relit tout son contexte (900 M de tokens relus pour 0,5 M produits) ; viennent ensuite les enchaînements
intégrer-relire-vérifier-corriger-revérifier et les arrêts sur limite d'utilisation (21 agents échoués).

Règles :
1. **Analyse d'un export de séance : faite par l'orchestrateur avec les outils du dépôt (`analyse-locale.cjs`, `perf-lot.cjs`), sans agent.**
2. **Chantier de code : un agent d'implémentation. Une relecture indépendante ciblée seulement si le code efface ou peut perdre des données (D-081).**
3. **Au plus 4 agents par chantier, environ 25 appels d'outil par agent (écrit dans le prompt), jamais de relecture en cascade, un seul contrôle complet
   (`verify`) par version.**
4. **Avant tout chantier de plus de 2 agents : estimation du coût donnée à Mic, et accord de Mic.**
5. Lecture par extraits (`grep`, `sed`) plutôt que de fichiers entiers ; rapports courts.
6. Choix du modèle par tâche (proposé à Mic, pas encore décidé) : le plus fort pour la relecture et la correction qui touchent aux données, un modèle
   plus léger pour le mécanique (texte, rapport, relevé, paquet).

## D-082 - Séance terrain test 3 (12 octobre) : résultats ; défaut du vidage ; paquet 4.9.0.4 : enregistrement de l'orchestrateur

Enregistrement, pas une décision nouvelle de Mic. Rien d'autorisé au-delà de D-078, D-079 et D-081 : aucun merge, tag, publication,
activation de production ou d'apprentissage, aucun changement de seuil, de porte ou de critère. L'identifiant du projet et les valeurs
de la séance restent hors dépôt.

1. **Séance du 12 octobre, 4.9.0.3, poste pro, Chrome, extension Claude désactivée, partie 3 d'un projet neuf.** Lot 1 : 192 coupes visées,
   174 validées, 18 reportées, fin de partie. Lot 2 (reprise des 18) : 9 validées, 8 reportées de nouveau, 1 interrompue, fin sur dernier cut
   différé. Total : 183 coupes validées sur 192.
2. **Observateur et exports.** Écritures d'ESV : 375 sur 375 acceptées (statut 204), aucune perdue ; les 174 validations du lot 1 sont toutes
   relevées, dont la dernière, arrivée pendant la grâce de 5 s (c'était le défaut du test 2). Un seul zip par export, chaque nuage une seule fois
   (192 puis 210), aucun nuage manquant, zips intacts. Mesure V1 : 3,0 % de temps non expliqué sur le lot 1 (3,05 % sur le lot de la partie 10).
   Cycle médian 8,3 s (lot 1) : indicatif, pas comparable sans A/A. Qualité des poses (C1 à C4) : non analysée.
3. **Défaut trouvé par Mic : « Vidage impossible : une capture est en cours (STALE) »** après un lot terminé sur son dernier cut différé (la
   capture « avant » de ce cut reste ouverte). Cause : `src/export-cache.js`, règle de refus trop large. Aucune perte (refus côté sûr), mais le vidage
   manuel était inutilisable après ce type de fin de lot, qui est courant. Les cinq relectures du test 3 ne l'avaient pas vu.
4. **Correction : paquet 4.9.0.4** (« 4.9.0 test 4 », branche `claude/49-test-4`, tête `0fcc4f6`, poussée). Après un lot fini pour de bon, une capture
   ouverte ne bloque plus le vidage ; son nuage et ce qui s'y rapporte sont gardés et repartent au prochain export. Refus inchangés : lot arrêté à
   la main avec capture ouverte, lot en cours, en pause ou en erreur, action en cours, Écho, grâce de 5 s. Une course trouvée à la relecture (nuage
   supprimé alors que sa visite reste) est corrigée et revérifiée. verify : 1352 essais, 1350 réussis, 0 échec, 2 sautés (mode partiel). Paquet :
   `ariane-4.9.0-test.4.zip`, 1 258 402 octets, SHA-256 `ddf94276…be8dd`, sans tests ni identifiant de projet. Non vérifié : vrai ESV, Edge, bouton
   « Recharger » du navigateur, lot Orbite complet dans le vrai ESV.
5. **Points ouverts.** (a) Données héritées d'ESV dans l'ancien dépôt (`tests/corpus/` depuis le 15 septembre, `datasets/automatic/` et `audit/native-offline-*`
   dans les paquets) : nature réelle ou fabriquée non vérifiée, en tension avec la règle « aucune donnée d'ESV dans les dépôts » ; à trancher par
   Mic. (b) L'historique de la branche `claude/49-test-4` contient, dans un commit intermédiaire d'essais, des valeurs de la séance (numéro de coupe,
   total, heure de fin de lot), retirées à la tête ; pas d'identifiant de projet. (c) Vidage automatique par défaut : toujours désactivé, décision à
   prendre. (d) Test A/A et V3 : pas commencés.

## D-081 - Relecture proportionnée au risque (12 octobre 2026)

**Réponse de Mic du 12 octobre 2026** : « Oui go », à la proposition de l'orchestrateur Claude Code (même jour), après la question « Il y a réellement besoin autant de relecture à chaque fois ? ».

Constat : pour le test 3 (4.9.0.3) cinq relectures indépendantes ont trouvé cinq points à corriger, mais n'ont pas vu le blocage du vidage du cache rencontré par Mic sur le terrain (lot fini sur un dernier cut différé) ; pour le test 4 (4.9.0.4), trois relectures ont trouvé une perte de données possible (course) et des valeurs de séance dans des essais. Elles ont aussi coûté plusieurs heures et deux arrêts sur limite d'utilisation.

Règle à partir de maintenant :

| Type de changement | Contrôle |
|---|---|
| Ce qui efface ou peut perdre des données (vidage, export, enregistrement) | une relecture indépendante ciblée, parfois deux |
| Mesure, observateur | une relecture ciblée |
| Texte, consigne, affichage | essais et relecture de l'orchestrateur, sans équipe |
| Tout | essais complets à zéro échec, puis séance terrain de Mic |

Rien ne change à la règle « zéro donnée perdue », ni aux portes, seuils et critères du cahier. L'audit d'Astra du diff avant toute version stable (cahier § 7) reste exigé : cette règle ne concerne que les relectures de développement.

## D-080 - Paquet de test 4.9.0.3 prêt pour la séance terrain (12 octobre 2026) : enregistrement de l'orchestrateur

Enregistrement, pas une décision nouvelle de Mic. Rien d'autorisé au-delà de D-078 et D-079 : aucun merge, tag, publication, activation de production
ou d'apprentissage, aucun changement de seuil, de porte ou de critère.

1. **Contenu** (branche `claude/49-test-3`, tête `3cbf304`, poussée) : V2 (exports allégés, zip unique, bouton « Vider le cache des exports »,
   vidage automatique **désactivé par défaut**), grâce de 5 s de l'observateur (dernière écriture rangée), V1 correction (2) (critère D-073 signé),
   corrections du tour 1 de relecture (vidage permis après une fin naturelle, compteurs de vidage exacts, grâce gardée au redémarrage du service worker,
   temps entre cycles publié par l'outil, identifiant de projet ESV retiré de la consigne).
2. **Paquet** : `ariane-4.9.0-test.3.zip`, version 4.9.0.3, 1 245 159 octets, SHA-256 `3612bd38…2fabba`.
   verify : 1296 essais, 1294 réussis, 0 échec, 2 sautés (mode partiel), géométrie inchangée, moteur conforme à la baseline V4.6.0.
3. **Relecture indépendante** : cinq angles, contre-vérification des constats, 16 constats corrigés ou tranchés au tour 1, tous résolus à la revérification
   (rapport privé hors dépôt). Deux observations restantes, sans perte de capture : une écriture tardive d'une autre coupe, rangée pendant la grâce,
   reste rattachée à la dernière visite dans l'outil d'analyse ; un lot en ERROR garde le bouton « Vider » grisé (côté sûr).
4. **Mesure V1 rejouée** sur le lot réel de la partie 10 : identique à la milliseconde (258 cycles, 61,0 s non expliquées sur 1 997,4 s, soit 3,05 %).
   Nouveau : le temps entre deux cycles est publié à part (262 transitions, 199,0 s, dont 112,4 s sans étape) ; l'enregistreur n'est pas modifié.
5. **Non vérifié** : vrai ESV et vrai serveur, Edge, lot Orbite complet jusqu'à sa fin, mémoire sur un export de 400 Mo et plus.
6. **Question ouverte pour Mic** : activer le vidage automatique par défaut ? Recommandation : non, pour le premier test terrain.
   Test A/A (même version sur deux parties neuves) : quand Mic le souhaite.

## D-079 - Séance terrain test 2 (partie 7) : résultats ; D-073 signé ; exports allégés ; données de la partie 7 pour l'ESV local

**Réponse de Mic du 7 octobre 2026** : « je valide tout », aux propositions de l'orchestrateur Claude Code.

1. **Critère D-073 « chronologie complète et expliquée » : signé.** Pour chaque coupe, chronologie réelle avec les chevauchements,
   aucun temps compté deux fois, durée non calculable = « non mesuré » (jamais zéro), aucune commande ESV ajoutée pour séquentialiser,
   chaque seconde attribuée à une étape ou marquée « non expliquée ». La correction (2) de V1 (branche `claude/49-v1-corrections-proposees`,
   `86dc727`) devient **adoptable après relecture indépendante** ; elle n'est pas encore adoptée. V1 reste non accepté (plusieurs lots,
   couverture 100 %, décisions identiques au banc, attestation).
2. **Exports allégés (V2) : lancement autorisé.** Étape A (une seule copie des nuages, événements et diagnostic une fois, sans perte)
   et « Sauvegarder tout » en un clic (un zip). Mode complet : intensité et classe conservées ; mode léger : retirées. Le mode léger
   avec arrondi des points reste conditionné à un rejeu comparé complet/léger. Étude : mesures privées hors dépôt.
3. **Données de la partie 7 pour l'ESV local : mises de côté (décision de Mic du 7 octobre).** L'extension Claude ne convient pas (elle ne doit
   pas lire le jeton de connexion, et naviguer dans ESV n'est pas une lecture pure). Méthode retenue pour plus tard : HAR enregistré par Mic
   dans Chrome sur les coupes laissées de côté, nettoyé des échanges `login.microsoftonline.com` avant envoi (le HAR « nettoyé » de Chrome garde
   les jetons dans le corps de ces réponses ; l'original reçu a été supprimé, copie propre privée sans jeton). Reprise seulement sur besoin précis.
4. **Séance terrain test 2, partie 7 d’un projet neuf (identifiant de projet ESV tenu hors dépôt), poste perso, Chrome 154, 4.9.0.2** : 156 coupes invalides visées,
   121 validées, 35 mises de côté (écartement hors contrat, placements concurrents) ; observateur présent et sans perte ; 120 écritures de
   validation observées avec statut 204 (aucun échec, aucune nouvelle tentative), la 121e validée en place sans écriture dans l'export ;
   V1 cohérent (0 perdue, 0 en attente) ; cycle médian 7,9 s (indicatif : lecture de l'extension à 09:35 pendant les premières minutes, sans effet visible).
   Le lot suivant (partie 10) est lancé sans l'extension. Un script chargé dynamiquement (chemin aléatoire) est vu sur la page ; nature non établie, contenu non lu.
   Aucun merge, tag, publication, activation de production ou d'apprentissage, aucun changement de seuil ou de porte.

## D-078 - Décisions du 6 octobre validées : V1 adopté pour test, U1 et U2 acceptés, lecteur hors gel (test), séance terrain, V4

**Réponse de Mic du 6 octobre 2026** : « Je valide les décisions proposées, tu peux continuer le pilotage », aux cinq
décisions du message de synthèse (voir `FEUILLE_DE_ROUTE_49.md`), avec les recommandations de l'orchestrateur Claude Code :

1. **V1 : réécriture (`37dd5df`) et correction (3) segments et ERROR (`6b9ed26`) adoptées pour la prochaine version de test.**
   Critère « lot rouvert ou en ERROR » **signé** : seuls les intervalles fermés sont publiés, la vie complète d'un lot reste
   « non mesurée » tant que sa dernière fin n'est pas connue, une substitution de lot ne vaut jamais clôture. Patch d'export du
   panneau : **la mission G l'intègre** après sa propre relecture. **Correction (2) chronologie concurrente : non adoptée** ; le critère D-073
   « chronologie complète et expliquée » reste **à signer** par Mic. V1 reste **non accepté** : il le sera après plusieurs lots
   terrain (couverture 100 %, décisions identiques au banc, attestation du projet).
2. **U1 et U2 acceptés** : panneau `3f8a79d` (G) et banc `4da97cd` (F), relus par des équipes indépendantes.
3. **Lecteur de points gelé** : l'appel de `vendor/lidar.js` avec son option de pause existante, fichier inchangé, est
   **hors du gel**, en version de test, avec A/A préalable, un seul changement par version, mêmes points qu'au banc. L'idée I1
   (lecture sans attendre une image d'ESV) est donc autorisée à l'essai, **pas** en production.
4. **Séance terrain de test autorisée** pour V1 adopté plus observateur passif (D-077), en journalisation seulement, aucune décision
   d'Ariane changée, sur une partie à réserver. Le paquet de test est préparé par l'orchestrateur ; Mic lance la séance.
5. **V4** : abandonné comme levier de vitesse (0,3 % du cycle) ; gardé seulement pour la clarté « seul GCV1 commande », après V3.
   V5 : attend la mesure de V3 ; en 4.9 seulement les diagnostics sans réécriture d'état (I4).

**Non couvert, donc non autorisé** : fusion, étiquette, publication, activation en production d'un nouveau comportement,
activation de l'apprentissage, changement de seuil, de porte ou de critère du cahier, collecte ciblée supplémentaire, adoption de
la correction (2), signature du critère D-073. Propriété du manifeste pour l'observateur : mission A (entrée `content_scripts` et version
seulement). Consignée par l'orchestrateur Claude Code.

## D-077 - Observateur passif autorisé en version de test ; ordre ; retour à une coupe ; « le reste » validé

**Réponse de Mic du 5 octobre 2026** : « 1) oui j'autorise ; 2) ça marche 3) ça marche. Je valide le reste », aux trois
décisions posées par l'orchestrateur après sa lecture du code d'ESV (`missions/ANGLES_ESV_RAPPORT.md`, privé).

1. **Observateur passif autorisé**, en version de test, **sans aucune commande ajoutée** : écoute de l'écriture de
   validation d'ESV (statut HTTP et corps), lecture des pages de la liste des coupes de la partie, mesure des
   chargements de points par visite, événements internes pour l'identité. Ouvre le développement de ces lectures
   dans le périmètre de V1 ; il ne change aucune règle de pose.
2. **Ordre** : preuve d'écriture et liste des coupes avant V2.
3. **Retour à une coupe** : saut direct par l'événement interne d'ESV si l'essai du banc le confirme, sinon pas à pas.
4. **« Le reste » : interprété par l'orchestrateur comme l'acceptation de ses recommandations présentées à Mic**, soit :
   correction du débordement du tiroir « Réglages de la collecte » à 200 % et du focus après Pause/Reprendre (patchs
   proposés par la mission F, à appliquer par G, propriétaire du panneau, après sa relecture) ; deux choix d'affichage
   proposés par G (pas de rapprochement de deux pages ESV par le seul numéro de partie après rechargement sans reprise
   du lot ; comptage des coupes 9033 et 9241 de la partie 19 dans le résumé, réversible).

**Non couvert par cette réponse, donc non autorisé** : sortie du gel du lecteur de points (option de pause), activation
en production d'un nouveau comportement, séance terrain, fusion, étiquette, publication, activation de
l'apprentissage, changement de seuil ou de porte, collecte ciblée supplémentaire. Chacun demande sa décision écrite.
Si Mic entendait « le reste » plus largement, il le dira. Consignée par l'orchestrateur Claude Code.

## D-076 - Plan de la suite validé par Mic ; lecture directe du code ESV demandée

**Réponse de Mic du 5 octobre 2026** : « Très bien je valide ton plan », à la recommandation de l'orchestrateur Claude
Code : (1) terminer V1 proprement, car la mesure fiable conditionne tout ; (2) tenter en premier l'idée « lecture des
points » de l'étude de performance (une seule modification par version de test) ; (3) observer le signal de fin de
chargement avant de s'en servir. Rejetés : V4 comme levier de vitesse, raccourcissement aveugle des attentes.

Portée exacte : ordre de travail uniquement. L'idée de lecture touche l'option de pause du lecteur gelé : **la sortie
du gel reste une décision écrite distincte, non prise**. Aucun gain n'est acquis avant un essai terrain.

Mic demande aussi que l'orchestrateur lise lui-même le code source d'ESV pour trouver ce qui améliorerait Ariane ou
simplifierait son usage interne, et joint un complément de collecte (navigation et validation réelles, 4 octobre).
Les résultats sont des propositions à décider, pas des changements. Rapport privé hors dépôt (code ESV).

## D-075 - Envoi des branches de travail sur GitHub autorisé

**Réponse de Mic du 4 octobre 2026 au soir : « Oui »**, à la question de l'orchestrateur Claude Code : envoyer sur
GitHub les branches de travail `claude/…` (pilotage puis équipes, au fur et à mesure), jamais `main`, sans fusion.
But : un point de sauvegarde durable hors du conteneur temporaire (recommandation des trois audits).
Portée : envoi de branches de travail seulement. Ni fusion, ni étiquette, ni publication, ni paquet terrain, ni
écriture dans banane-data ; une branche envoyée n'est pas une branche acceptée. Verify à zéro échec avant chaque
commit envoyé.

## D-074 - Reprise complète par Claude Code ; ESV reconstruit indépendamment ; réécriture du code GPT

**Instruction de Mic du 4 octobre 2026** (`00_DEMARRAGE_CLAUDE_CODE.md` de la passation révisée, consignée par
l'orchestrateur Claude Code le 4 octobre au soir ; cette entrée consigne une instruction reçue, pas une décision
nouvelle de l'orchestrateur).

- Claude Code reprend le pilotage après l'intérim GPT. Mic a demandé l'arrêt des relances aux développeurs GPT ;
  aucun nouveau retour n'est envoyé au précédent développeur ESV.
- Les missions indépendantes sont lancées en parallèle (D-072 et instruction actuelle), sans nouveau go de principe.
- ESV est reconstruit localement à partir des seuls originaux récupérés le 4 octobre, avec une conception
  indépendante ; le précédent prototype est exclu. Le banc reste privé, hors des dépôts Ariane.
- Le code modifié ou apporté par les sessions GPT (tout ce qui suit `042aee6`) est à réécrire pour une architecture
  claire et efficace, sans changer le moteur épinglé ni les décisions ; les réécritures sont des candidats, relus
  indépendamment, non acceptés d'office.
- Étude approfondie d'ESV et d'Ariane (fonctions, efficacité opérateur, captures, géométrie, moteur, super cerveau,
  apprentissage, exports, fiabilité) et feuille de route argumentée (4.9 / expériences / gains mesurés ou espérés).
- Restent réservés à Mic : périmètre, critères d'acceptation, fichiers gelés, activation d'un nouveau comportement,
  nouvelle séance terrain, publication. Les correctifs V1 proposés ne sont pas adoptés. Aucune fusion, étiquette,
  publication, envoi de branche ou écriture dans banane-data sans accord explicite.
- Pilotage : `PILOTAGE_REPRISE.md` (état, propriétaires de fichiers, statuts, preuves).

## D-073 - Présentation des mesures et préparation du test V1

**Décision de Mic du 4 octobre 2026, 08 h 01 (Europe/Paris)** : « C'est OK ». Texte adopté, intact :
`consignes/avenant-D073-presentation-mesures-v1-2026-10-04.md`. Projet absent du fichier : déclaration séparée,
sans inventer `projectId` ; étapes qui se chevauchent : chronologie réelle conservée, aucun double compte ni zéro
fabriqué. Autorise la préparation locale du paquet de test V1 (candidat relu `baa548d`) ; ne relâche pas
`coverage.complete`, n'accepte pas V1 et n'autorise ni séance ESV, ni publication, ni écriture dans banane-data.
Consignée ici par l'orchestrateur Claude Code le 4 octobre au soir (numéro vérifié sans collision).

## D-072 - Développement parallèle de chantiers indépendants

**Décision de Mic du 2 octobre 2026, 08 h 09 (Europe/Paris).**
Le développement indépendant de V1, U1 et de la préparation U2 est autorisé,
avec copies isolées et fichiers réservés. Les portes de qualité, relectures,
acceptations et conditions terrain restent obligatoires. Aucun accord de
fusion ou de publication n’en découle. L’inventaire D-067 reste après
acceptation V1 ; aucun apprentissage anticipé.

Avenant faisant foi : `consignes/avenant-49-d072-parallele-2026-10-02.md`,
restitué exactement depuis l’annexe 1 de la mission U1 remise le 2 octobre.
Cette entrée consigne de nouveau une décision déjà prise, pas une nouvelle
décision de la direction. La copie locale retrouvée à la réception des
livraisons s’arrêtait à D-070 ; D-071 a été restituée textuellement depuis
sa mission, D-072 depuis son avenant. Les anciens objets commits locaux
ne sont pas prétendus retrouvés.

## D-071 - P2 accepté ; démarrage de V1 autorisé

**2 octobre 2026, 07 h 40 (Europe/Paris), opérateur et direction.**
Accord explicite de Mic : **« P2 accepté, go V1 »**, en réponse à la
proposition d'acceptation et au bloc V1 préparés au commit `2f2cc45`.

- **P2 accepté comme mesure d'information** : 31 coupes complètes, 62 rails.
  Latéral absolu médiane/p90/max : 1,45 / 3,84 / 6,05 mm ; vertical :
  1,39 / 4,77 / 8,15 mm. Les limites de D-070 et du rapport indépendant
  restent conservées : déclarations humaines, choix de liste non établi,
  projet absent de l'export, absence d'acquittement serveur et d'étalonnage
  physique indépendant. Aucun seuil modifié ni nouvelle séance P2 demandée.
- La correction d'heure et l'avenant indépendant favorable sont les pièces
  retenues. Les rapports initiaux et le cahier signé restent intacts.
  Fiche d'acceptation : `consignes/acceptation-p2-2026-10-02.md`.
- **V1 autorisé**, conformément au bloc proposé : développement et
  vérification de la mesure par phase, sur la 4.8.6 stable
  `042aee649bc25b89c46a26def481f87f46d047ac`, sans accélération ni changement
  des décisions ou des commandes ESV. Branche retenue :
  `sol/49-v1-mesure-par-phase`, issue de cette base ; jamais `main`.
- Mission de référence à remettre au développeur :
  `consignes/mission-v1-2026-10-02.md`, avec avenants locaux joints.
  Lecture de banane-data autorisée, écriture interdite. Avant le premier
  commit V1 : environnement privé vérifié, relevé portes-j1 et verify sur
  4.8.6 non modifiée. La comparaison d'identité utilise ce relevé 4.8.6,
  sans remplacer la référence historique 4.8.0 de portes-j1.
- Le go ne vaut pas acceptation de V1. Son diff sera relu par l'orchestrateur
  et un relecteur indépendant ; les projets/parties et le nombre de lots
  terrain seront soumis avant les mesures. L'acceptation exige les portes du
  cahier, dont la couverture de 100 % des coupes d'un lot, plusieurs lots
  mesurés et zéro décision changée sur 633 coupes et huit jeux.
- Aucun chantier parallèle, inventaire ou apprentissage lancé. L'inventaire
  D-067 reste après acceptation de V1, avant V2. Aucun dépôt de données,
  paquet terrain, fusion, étiquette, publication ou envoi de branche
  autorisé par cette décision. L'orchestrateur remet la mission ; il n'écrit
  pas le code de l'extension et ne prétend pas avoir lancé la session externe.

## D-070 - Méthode P2 avec validation intermédiaire ; réception de 31 paires

**1er octobre 2026, opérateur et direction.** Mic demande une validation
avec Maj+Espace de la position déplacée, une navigation puis sa propre revisite,
repose et validation. Il indique aussi avoir navigué après sa validation finale.
Le pilote 3717 a été contrôlé séparément avant la séance complète.

- Pour cette séance, cette instruction remplace l'interdiction de valider
  la position déplacée écrite dans D-069. L'historique de D-069 est conservé.
  Écho doit conserver l'origine du premier passage avant tout déplacement.
  Le calcul compare cette origine à la pose finale de Mic, et non à la
  position déplacée qui a été validée entre les deux.
- Projet confirmé par Mic : `RAIL-260826_060933_E_701`, partie 24. L'export
  déclare 4.8.6 ; son `projectId` est absent. Cette absence ne constitue pas
  une preuve de changement de projet.
- Mic confirme les poses d'origine manuelles, l'absence de vue des anciennes
  positions et une liste fixée avant séance : déclarations humaines conservées
  comme telles, sans les attribuer aux journaux. Le mode de constitution de
  la liste n'est pas documenté ; aucun tirage aléatoire n'est revendiqué.
- Réception : 31 paires techniques complètes / 62 rails ; 2 paires descriptives,
  2 non mesurées, 1 coupe seulement traversée. Toutes les paires admissibles
  sont retenues, sans choisir après coup les 30 meilleurs résultats.
- Les calculs publiés concordent avec le recalcul de l'orchestrateur sur le CSV :
  latéral médiane/p90/max 1,45 / 3,84 / 6,05 mm ; vertical 1,39 / 4,77 / 8,15 mm.
  Variation enregistrée entre poses manuelles, sans étalonnage physique indépendant.
- Une correction de colonne d'heure est demandée à l'analyste, sans changement
  attendu des mesures. Relecture indépendante puis acceptation par la direction
  restent requises. **P2 n'est pas accepté par cette réception.** Aucun seuil
  modifié, entraînement, démarrage de V1 ou nouvelle séance demandée à ce stade.
- Pièces : `audit/chantiers/p2-mesure-2026-10-01/` ; transmission préparée dans
  `consignes/relecture-mesure-p2-2026-10-01.md`. L'orchestrateur n'a pas lu le
  fichier brut de la séance complète. Aucun envoi ou dépôt de données autorisé
  implicitement, aucune fusion, étiquette, publication ou modification de code.

**Complément de réception, 01/10 :** correction de la colonne d'heure reçue
et vérifiée par l'orchestrateur. Sur 72 lignes, seules les 66 heures de capture
renseignées changent ; les six cellules vides restent vides. Tous les autres
champs, les classes, les écarts et les statistiques sont identiques.
Les empreintes annoncées concordent ; les originaux sont conservés.
La réserve de présentation est levée, sans acceptation de P2 et sans lancement
de V1. Pièces : `audit/chantiers/p2-mesure-2026-10-01/correction/` ; dossier
de transmission à jour : `consignes/dossier-relecture-mesure-p2-2026-10-01-v02.md`.

**Réception de la relecture indépendante, 02/10 :** son rejeu confirme
31 paires / 62 rails. Les classes, 66 écarts signés, fraîcheurs et distributions
concordent avec les livrables corrigés. Son verdict reste « Correction
nécessaire » : il a examiné le CSV et la méthode initiaux et précise que
les pièces corrigées n'étaient pas jointes. Les autres réserves limitent
la portée de la mesure, sans demander une nouvelle séance.
Un complément ciblé du même relecteur sur les pièces déjà corrigées est
préparé dans `consignes/complement-relecture-p2-2026-10-02.md`. Son rapport
initial est conservé dans `audit/chantiers/p2-mesure-2026-10-01/relecture-independante/`.
P2 reste en attente d'acceptation par la direction ; aucun démarrage de V1.

## D-069 - Préparation P2 par un autre opérateur ; choix délégué de la partie

**1er octobre 2026, opérateur et direction :** « je vais demander à un opérateur
de les déplacer lui-même puis je ferai la nouvelle pose. Choisi seulement
quelle partie. » La direction propose l'aide humaine et délègue le choix
de la partie à l'orchestrateur.

- Partie retenue : **24**, déjà utilisée en Natif et par Orbite ; elle n'est
  pas indiquée comme partie de validation dans le registre consulté
  (`audit/rotation-parties.md:32-33,48`). Cela évite de consommer une partie
  neuve pour P2. Le lot récent a posé 107 coupes et sa relecture en a jugé 103
  (`audit/lots-20-24-33-2026-09-29.md:17`) : ces nombres ne prouvent pas
  30 anciennes poses manuelles indépendantes admissibles.
- But de l'aide : déplacer les deux rails avant que l'opérateur de mesure
  voie la pose initiale. Écho doit déjà enregistrer la session et conserver
  la pose initiale puis l'éloignement d'au moins 50 mm de chaque rail ;
  l'état éloigné ne doit pas être validé. Aucun lot Orbite actif.
- Une coupe pilote hors de la liste reste à cadrer pour vérifier ce chemin.
  Le choix de partie ne prouve pas que le protocole terrain fonctionne.
- Les 30 identités et leur provenance manuelle, la règle des tentatives,
  la préservation des références, la version installée et le transfert
  complet à l'analyste restent à confirmer avant la séance complète.
- P2 reste non mesuré. Aucun chantier V1, code, publication ou dépôt de données
  autorisé par cette décision. Aucun résultat terrain inventé.

## D-068 - Coupes difficiles avancées dans la livraison principale 4.9

**1er octobre 2026, opérateur et direction : « non en 4.9 ».** Correction du
palier 4.9.5 présenté pour les coupes difficiles : retour à une coupe,
étude 398/402, voisins fiables B1, rails hors écran B2, B3 si nécessaire,
font partie de la livraison principale 4.9, sans attendre une 4.9.5.

- Ordre relatif conservé : après les mesures, exports, accélération, U1 à U3
  et V5 conditionnel ; retour à une coupe, étude 398/402, B1, B2, B3 conditionnel.
- Les portes, dépendances, protections et relectures restent exigées ; aucune
  activation de garde ou changement de moteur autorisé par ce déplacement.
- Apprentissage inclus dans la 4.9 selon D-066 ; place précise toujours à
  confirmer, intégration sur décision distincte.
- Avenant : `consignes/avenant-49-d068-2026-10-01.md`, à joindre aux missions
  après D-066 et D-067. Les textes signés ne sont pas réécrits.
- Aucun développement, changement de manifeste, paquet ou publication effectué.

## D-067 - Compléments après audit ; inventaire tôt en série et navigation sûre

**30 septembre 2026, opérateur et direction : « Oui ».** Accord sur les cinq
compléments présentés après le retour d'audit, avec les précautions vérifiées
par l'orchestrateur.

- Réserver et faire approuver les parties nécessaires aux portes avant V3 ;
  les parties 9 et 12 ont déjà servi au réglage, elles ne sont pas neuves.
- Inventorier les exemples réellement exploitables ; 150 rails ne constituent
  pas un seuil d'autorisation du régresseur. Si le volume est insuffisant,
  continuer qualification/collecte ; aucune activation apprise autorisée.
- Vérifier l'environnement réel de l'étude 398/402 par reproduction complète ;
  une annonce de 16 Go de mémoire ne suffit pas.
- Après acceptation de V1, avant V2 : mission d'inventaire et de qualification
  confiée à l'analyste, sans entraînement ni travail parallèle.
- Lire D-066 et son avenant, puis D-067, avant les documents historiques ;
  l'apprentissage est dans la 4.9, sans réécriture du cahier signé.
- Retour à un cut : aucune navigation de consultation pendant pose, validation
  ou déplacement ; pause effective du lot et contrôle d'identité avant reprise.
- Texte adopté : `consignes/avenant-49-d067-2026-09-30.md`. Attendre confirmation
  de l'auditeur puis soumettre la mission P2/V1. Aucun développement lancé,
  aucune autorisation de publication, d'envoi de branche ou de dépôt de données.

## D-066 - Cadrages complémentaires validés ; apprentissage avancé dans la 4.9

**30 septembre 2026, opérateur et direction.** Les cadrages « revenir à un cut »
et « faux 398/402 » sont validés. Pour l'apprentissage des positions, la
direction précise : « Je veux avancer ça dans la 4.9 ». Le report après la
4.9 ne s'applique donc plus à ce chantier.

- Retour à un cut puis étude des faux, au début de la 4.9.5 avant B1, selon
  `consignes/cadrages-complementaires-49-2026-09-30.md`.
- Apprentissage dans la 4.9 : qualification des exemples, essais hors ligne,
  comparaison puis intégration conditionnelle. Sa place précise reste à
  auditer et confirmer ; proposition : après B1 à B3, avant clôture de 4.9.5.
- Aucun changement du moteur épinglé ni activation dans ESV autorisés par cet
  accord de principe. Les critères ouverts seront fixés sur les mesures.
- « S » permet le déplacement vers une coupe voisine selon l'opérateur ; le
  chemin utilisable par l'extension et son contrôle d'identité restent à vérifier.
- Organisation : conversations de cadrage, d'analyse des exports et de
  développement ; transmissions par l'opérateur ; relectures indépendantes.
- Avenant : `consignes/avenant-49-d066-2026-09-30.md`. Cahier signé conservé.
  Prochaine étape : audit séparé avant développement. Aucun accord de merge,
  étiquette, publication, envoi de branche ou dépôt de données à ce stade.

## D-065 - KI-069 : au dernier cut d'une partie, valider par Ctrl+Entrée, sans passer au suivant (4.8.6 test 1)

**30 septembre 2026, opérateur et direction** (retour terrain, partie 36, 4.8.5 stable). Au dernier cut à
valider d'une partie, « valider et passer au suivant » fait charger la partie suivante ; idem pour le
« suivant » d'un différé. Décision : sur le dernier cut de la partie, valider par le raccourci d'ESV
Ctrl+Entrée, qui valide SANS passer au suivant, et n'envoyer JAMAIS « suivant » après un différé sur ce cut.

- **Déclenchement, conservateur** (même exigence que D-062) : le cut N est certainement le dernier quand
  N = M−1, M lu dans le relevé passif du cut N lui-même (même partie, même cut, un seul compteur
  « N on M treated », N < M, relevé postérieur au début du cut). Sinon : comportement de la 4.8.5, inchangé.
  Le dernier cut non validé plus tôt que M−1 (partie 25 : 8338 pour M = 8530) n'est pas détectable : ESV
  quittera encore la partie, accepté.
- **Mécanique** : action `validateInPlace` (`src/adapter-page.js`) ; Ctrl+Entrée relayé comme le raccourci de
  SKIP (keydown puis keyup sur `document`, key/code « Enter », keyCode et which 13, ctrl seul, bubbles,
  cancelable, composed). **Hypothèse de l'opérateur, non vérifiée (aucun accès à ESV ici)** : ce raccourci
  appelle `buttonValidateRail()`, « valider sans suivant ». À confirmer sur le terrain (test 1).
- **Preuve** (moteur `src/engine.js` inchangé) : identité inchangée et compteur « N on M treated » passé de N
  à N+1 (`serverConfirmed`) ; `navigationObserved` n'est JAMAIS vrai. Sans compteur lisible avant, rien n'est
  émis. Sans effet, cut changé ou erreur : arrêt explicite du lot (état d'erreur du moteur, message : pose
  gardée non validée, à valider dans ESV) ; JAMAIS de repli vers « valider et suivant ».
- **Fin de lot** (`lotExitOf`, `closeAtExit`) : « Fin du lot : dernier cut de la partie (M−1) validé ; ESV est
  resté sur ce cut. » Différé à N = M−1 : `engine.deferUnresolved` est enveloppé dans `background.js` (le
  moteur n'est pas modifié) ; aucune commande n'est envoyée, aucune intention de navigation n'est ouverte ;
  « Fin du lot : dernier cut de la partie (M−1), différé ; rien n'a été envoyé à ESV. » Le cut est consigné
  (`DEFER_DERNIER_CUT_SANS_ENVOI`), non compté comme différé confirmé.
- **Repli sélectionnable** (test seulement) : réglage `validationDernierCut: 'bouton'` (`src/settings.js`),
  qui clique le bouton d'ESV dont l'identifiant est `boutonValiderSansSuivant` (celui de
  `buttonValidateRail()`, à relever dans ESV, jamais deviné : nul = refus avant émission). Par défaut :
  Ctrl+Entrée. À n'employer que si l'essai montre que Ctrl+Entrée n'a pas l'effet attendu.
- **Sécurité (D-062 c, d)** : `validateInPlace` n'est PAS dans `EN_SECURITE` (ensemble des actions permises
  une fois l'adaptateur en sécurité) : elle est refusée comme `validateAndNext`, avec « pose faite, non validée ».
- **Journal** : `dernier-cut-detecte`, `validation-en-place` (M, N, commande « ctrl-entrée », compteurs) ou
  `dernier-cut-differe`. Rien d'autre ne change.
- **Conséquence sur D-062 (b)** : à N = M−1 avec relevé frais, ESV ne quitte plus la page au différé ; la fin
  de partie n'est donc plus mémorisée par ce chemin (le code de D-062 est inchangé et reste atteignable
  quand le relevé est périmé). La mémorisation de la fin de partie reste celle de D-062.
- - **Retour terrain du 30/09 (test 1, partie 37, M = 8640) et extension du déclenchement (test 2)** : 8504 était le
  dernier cut À VALIDER de la partie, pas M−1 ; Ariane l'a différé, ESV a quitté la partie (le test 1 n'a jamais
  envoyé Ctrl+Entrée). Le compteur le dit : devant = (M − traités) − (cuts déjà différés par le lot) − 1 ; sur ce
  journal : 75, 74, …, 3, 2, 1, puis 0 à 8504. Devant = 0 : dernier cut à valider (`motif: 'dernier-invalide'`),
  même traitement que M−1 (Ctrl+Entrée puis arrêt ; différé : rien envoyé, arrêt), message « dernier cut à valider
  de la partie (N) ». Sûr par excès : un cut à valider hors lot ou différé par un lot antérieur gonfle « devant »
  (jamais de faux zéro) ; écartés : cut différé situé devant, SKIP ou reprise à la main dans le lot, traités
  illisibles ou ≥ M. Le cas de la partie 25 (8338 pour M = 8530), jugé non détectable plus haut, l'est donc.
  Réserve : un cut validé à la main dans ESV pendant le lot dégonflerait « devant » ; non couvert.
- **Feu vert de l'opérateur (30/09, lot 39)** : journal du test 2 relu : partie 39, cut 8643 = M−1 (M = 8644), différé :
  événement `dernier-cut-differe`, aucune commande « suivant », lot clos sur « Fin du lot : dernier cut de la partie
  (8643), différé ; rien n'a été envoyé à ESV » ; ESV est resté sur la partie. **Non observé sur le terrain** : la
  validation par Ctrl+Entrée elle-même (le cut du lot 39 était un différé) ; l'hypothèse `buttonValidateRail()` reste
  à confirmer au premier dernier cut posé. La 4.8.6 stable reprend le code du test 2 (`69b31c9`) : seuls la version
  et le nom changent (manifeste `4.8.6`, « Ariane »). Cible de retour : 4.8.5. Sans étiquette ni fusion ni publication
  avant l'accord de l'opérateur.
- **Hors périmètre** : KI-068 (export) et la détection « lot terminé sauf différés » restent en 4.9. Une
  politique de faible confiance « SKIP » sur le dernier cut enverrait encore le raccourci de SKIP.
- `src/lot-decision.js`, `src/engine.js`, `src/gauge.js` : `git diff` vide. Version de test 4.8.6.1
  (« 4.8.6 test 1 », D-061), à installer à côté de la 4.8.5 ; cible de retour : 4.8.5.

## D-064 - 4.8.5 stable : feu vert, étiquette et publication

**29 septembre 2026, direction** : « feu vert ». La 4.8.5 devient la version
stable : `main` fusionné (`da89e8b`), étiquette `v4.8.5` sur `323356c` (le
code du paquet), publication GitHub « Ariane 4.8.5 — stable » avec
`ariane-v4.8.5.zip` (SHA-256 `cf4401bf…484d`, empreinte de la publication
vérifiée par l'orchestrateur, identique aux trois constructions). Cible de
retour : 4.8.0 (`v4.8.0`, `fabd77e`). Installation :
`consignes/installation-4.8.5.md`.

## D-063 - Préparer la 4.8.5 stable ; C4 validé sur l'expertise de la direction (partie 25)

**29 septembre 2026, direction** : « go » pour préparer la 4.8.5 stable.

- **Porte C4** : la relecture de la partie 25 (test 1 : 62 posés jugés,
  2 faux, cuts 112 et 113) est jugée suffisante pour la porte C4 de la 4.8.5.
  La qualité est validée **sur l'expertise de la direction**, sans mesure
  conforme à la lettre de la porte (moins de 100 posés jugés) : le rapport de
  sortie le dit (`audit/rapport-sortie-4.8.5.md`), comme D-060 pour la 4.8.0.
- **Lot 33** (test 1) : pas de relecture ; observation de l'opérateur « RAS »
  (non enregistrée).
- **Moteur de décision identique** entre le test 1 et le test 2 (aucun
  changement de `src/lot-decision.js` ni de `src/engine.js` entre `36b8242` et
  `0d29e54`) : la validation de la partie 25 vaut pour le code du test 2. Les
  lots 25 et 33 ont tourné sous le test 1 : le code de fin de partie de
  D-062 (test 2) n'a pas été exercé en réel.
- **Candidat stable** : même code que `0d29e54` (test 2) ; seuls la version
  et le nom changent (`4.8.5`, « Ariane », conventions de D-061). Paquet
  reproductible, portes J1, `verify` à 0, CHANGELOG, retour arrière vers la
  4.8.0, fiche d'installation. **Ni merge, ni étiquette, ni publication** sans
  accord de la direction.
- **KI-068** consigné sans changement de code (export du journal d'Orbite
  alourdi par les données d'Écho) ; correction après la 4.8.5.
- Détail et chiffres : `audit/lot-485-p25-2026-09-29.md` et
  `audit/lots-20-24-33-2026-09-29.md`, branche `claude/banane-48-cahier`.
- **Amendement (29/09, relecture indépendante de D-062)** : D-062 est jugée
  conforme, sauf un message à corriger avant l'étiquette (texte seul) : partie
  supérieure affichée, M connu, cut N ≠ M−1 → « la partie compte M cuts, son
  dernier cut est le M−1 ; le cut N n'est pas le dernier ; rien n'est retenu »,
  sans inviter à saisir N ; l'invitation reste quand M est inconnu. Nouveau
  paquet candidat ; le premier (`8911282`, `ac931b5d…`) n'est ni étiqueté ni
  publié. `SUITE` et la commande `next` restent telles quelles (`next` est
  inatteignable après une pose). Les portes J1 de `8911282` valent pour le
  candidat corrigé : aucun changement de `src/lot-decision.js`,
  `src/engine.js` ni `src/gauge.js` entre les deux.

## D-062 - Fin de partie mémorisée seulement sur preuve M−1 ; mise en sécurité pendant une pose (4.8.5 test 2)

**29 septembre 2026, direction**, après la livraison du paquet test 1 ;
appliquée par la version de test 2 (`4.8.5.2`, « 4.8.5 test 2 ») ; le
paquet test 1 déjà livré n'est pas modifié.

- **(a) Total de la partie** : le total M affiché par ESV est le nombre de
  cuts de la partie ; la numérotation part de 0 ; le dernier cut est M−1
  (confirmé par la direction).
- **(b) Fin de partie après un différé** : la fin de partie n'est mémorisée
  que si, à la reprise, ESV affiche une partie **supérieure** ET le cut du
  dernier différé est **M−1**, M relevé par l'instrumentation passive (D4).
  Sinon le lot se ferme sans rien mémoriser, et le panneau dit que ce cut
  pourrait être le dernier, à saisir comme dernier cut si l'opérateur veut le
  retenir.
- **(c) Mise en sécurité pendant une pose** : la pose en cours va à son
  terme ; la validation suivante est refusée ; le lot passe en pause.
- **(d) Risque restant, accepté par la direction** : « autre Ariane pendant
  une pose : la pose se termine, la validation est refusée, l'opérateur
  contrôle le cut ».

## D-061 - Pilotage de la suite : une version de test à la fois, portes chiffrées, instrumentation passive

**28 septembre 2026, direction** : « je valide toutes tes décisions », sur
l'audit de l'orchestration (`audit/chantiers/audit-orchestration-485.md`).

- **Cadence** : une seule version de test sur le terrain à la fois ; cycle de
  2 à 3 jours (paquet → un lot et sa relecture → mesure et fiche de décision →
  décisions). Pas de nouveau paquet sans retour du précédent, sauf panne
  bloquante.
- **Temps de l'opérateur** : un créneau d'environ 1 h 15 par cycle, dont 20 à
  30 min d'attention ; une seule tâche par cycle (un lot, puis sa relecture) ;
  le reste par l'instrumentation ou une tâche de 10 min au plus.
- **Instrumenter au lieu d'inspecter** : les versions de test relèvent
  passivement des textes et états d'ESV (compteur « N on M treated », présence
  des rails d'autres cuts dans la page), sans aucune commande ni modification
  d'ESV, et les rangent dans le journal. Aucun code d'ESV dans les dépôts.
- **Portes de la 4.8.5 stable** : C1 ≥ 79 % ; C3 : 0 hors contrat ; C4
  évaluable (≥ 80 % des posés jugés), au plus 2 faux pour 100 jugés, chacun
  typé ; 0 interruption non reprenable ; refus de la garde à 1 420 mm comptés
  (0 à 2 attendus).
- **Amendement après le contre-regard d'Astra (28/09, soir)** : le plafond
  « 0 à 2 refus de la garde » n'est plus une porte : chaque refus est examiné
  à la relecture (aucun refus d'une pose qui aurait été juste, sauf décision
  nommée). **Décidé par la direction** : C4 exige au moins 100 posés jugés, pris
  dans l'ordre du lot sans choix, les posés non jugés listés ; **D8 (« Relire ce
  lot dans Écho ») non retenu**. Chaque mesure publie aussi la borne haute de
  Clopper–Pearson à 95 % (information, pas une porte) : 2 faux sur 100 jugés
  donnent 7,0 %, et la 4.8 elle-même (4 faux sur 161) 6,2 %. Démontrer un taux
  sous 2 % demanderait 183 jugés sans faux, 277 avec un, 359 avec deux : c'est
  un objectif cumulé sur plusieurs parties, pas une porte de version (Astra,
  deuxième passe, calcul refait par l'orchestrateur).
  (`audit/chantiers/audit-orchestration-485-astra.md`).
- **Ordre des portes** : code gelé → banc et essais → essai terrain d'une
  version de test → audit indépendant (Astra) avant toute version **stable**
  → décision de la direction en dernier.
- **Numérotation** : version stable = étiquette `vX.Y.Z`, jamais
  reconstruite ; version de test = manifeste `4.8.5.N`, nom « Ariane 4.8.5
  TEST », `version_name` « 4.8.5 test N » ; un nouveau paquet prend N+1.
- **Étiquettes** : créées par la direction sur GitHub (la session ne peut pas
  en pousser) ; l'orchestrateur prépare une branche `release/vX.Y.Z` sur le
  commit à étiqueter.
- Plan de développement et fiche de l'opérateur : `PLAN_SUITE.md`,
  `consignes/operateur-suite.md`.

## D-060 - 4.8.0 fusionnée et stable ; 4.8.5 : garde d'écartement à 1 420 mm, KI-066 et KI-067

**28 septembre 2026, direction**, sur l'audit d'orchestration
(`audit/orchestration-480-485-490-2026-09-28.md`) : « je valide tout ».

- **Fusion** (« go fusion ») : `main` avancé à la branche (avance rapide,
  `64f2d6e`) ; banane-data : `main` avancé de même (`ddc3282`). Étiquettes
  `v4.8.0` sur `fabd77e` (le code du paquet `38aa29a2…`), `v4.7.21` sur
  `ead1cd1` (cible de retour arrière) et `v4.7.0` sur `5928be4` : refusées à
  la session (HTTP 403, la session ne pousse que des branches) ; **créées par
  la direction le 28/09** avec leurs publications GitHub (zip joint à
  `v4.8.0`), vérifiées par l'orchestrateur (`git ls-remote --tags`).
- **La 4.8.0 reste la version stable** de l'opérateur, installée dans ESV.
  Les versions de test (4.8.5…) s'installent à côté, chacune depuis son
  propre dossier, **une seule Ariane active à la fois** (interrupteur de la
  page des extensions, puis F5 sur ESV) : l'adaptateur est injecté dans la
  page ESV, commune à toutes les extensions. Une version de test porte un nom
  distinct et refuse de se connecter si une autre Ariane est active dans
  l'onglet.
- **Qualité finale de la 4.8.0** : relectures de la partie 15 et des 37 cuts
  restants de la partie 11 faites par l'opérateur le 28/09, mais sans
  l'observation Écho active : **validée à 100 % par l'expertise de la
  direction, non enregistrée**. C4 de la partie 15 reste donc non mesuré ; la
  partie 15 n'entre pas au banc comme partie jugée (pas de référence
  enregistrée). La mesure enregistrée reprend avec la partie neuve de la 4.8.5.
- **4.8.5** : KI-066 et KI-067 y entrent (le paquet 4.8.0 validé reste
  intact) ; **garde d'écartement bas à 1 420 mm** sur les premiers passages
  sans appui (garde seulement, jamais une cible ; banc : faux 10 → 9, 0 juste
  perdu, `audit/relecture-p11-2026-09-28.md` §5). Partie de validation de la
  4.8.5 : une partie jamais passée par Ariane, choisie par l'opérateur.
  *Mise en œuvre (D2, 29/09, orchestrateur)* : `lot-decision-v7` ;
  « sans appui » = aucun appui de prédiction (voie encadrée comprise) ; un
  refus n'est jamais reposé par Ariane (ni reprise, ni ornière). Limite
  connue : sur une voie réellement étroite (1 405 à 1 419 mm), sans appui,
  tous les premiers passages seraient refusés ; chaque refus est examiné à la
  relecture (porte J2).
- **Audit de l'orchestration de la suite** confié à Astra
  (`consignes/chantier-9-auditeur.md`).

## D-059 - Audit qualité 4.8 (Astra) : P1 et P2 locaux corrigés dans la 4.8.0, avant sa sortie

**28 septembre 2026.** Audit indépendant de la 4.8.0 demandé par la direction
(code, performances, données, UX/UI ; `consignes/chantier-8-auditeur.md`).
Rapport : `audit/chantiers/audit-qualite-480.md`. Un P1 : Écho purgeait ses
nuages sans preuve de téléchargement (KI-064).

- **Le P1 est corrigé avant la sortie**, par le téléchargement confirmé
  (`chrome.downloads`) plutôt que par la seule neutralisation de la purge :
  la purge garde son rôle (session qui repart de zéro) sans risque de perte.
- **Les P2 locaux sont corrigés dans la même version** (D02, D03, U01, U02,
  U03, P01 pour la vue du panneau, P02, texte de D04) : chacun est petit, et
  deux touchent ce que l'opérateur envoie pour l'analyse.
- **La version reste 4.8.0** (direction : « ça restera une 4.8.0 pas
  .1 ») : les corrections entrent dans la 4.8.0 avant sa sortie. Le paquet
  du matin du 28/09 (`d3874290…`, construit depuis `a68201a`) est **remplacé**
  et ne doit plus être installé ; le nouveau paquet 4.8.0 a sa propre
  empreinte (`PASSATION_4.8.0.md`). Aucune règle métier ni décision sur le
  lot ne change ; la validation D-058 porte sur ce qui est inchangé.
- **Reportés** (réponse : `audit/chantiers/qualite-480/reponse.md`) :
  C02 en 4.8.x ; C01, P01 (stockage), P03, U04 et la provenance de D04 en
  4.9 (`BANANE_4.9_CAHIER.md` §2). La question P03 (comparaison V4.6 à chaque
  cut) et les budgets de latence et de mémoire (questions 3 et 4 de l'audit)
  restent à la direction.
- La fluidité réelle dans ESV et la mémoire sur un long lot ne sont pas
  certifiées : première mesure avec la session de
  `consignes/chantier-8-operateur.md`.

## D-058 - 4.8.0 : Ariane, Écho, Orbite ; C1 atteint ; ESV rafraîchi ; revue d'interface

**27 septembre 2026, direction.** « Comme la 4.8 est un tournant majeur, le
nom de Banane devient ARIANE ; Natif devient Écho ; Pilote devient Orbite » ;
« 79 % c'est comme 80 %, donc objectif atteint, c'est la même moyenne sur les
autres lots » ; « je valide tout le reste » ; « je donne donc le go pour la
4.8 » (photos et vidéo du menu à montrer avant la livraison définitive).

- **Noms** : Ariane (l'extension), Écho (observation du travail manuel, ex-
  Natif), Orbite (lots automatiques, ex-Pilote). Renommés : interface,
  messages, bouton d'ouverture et bandeau dans ESV, manifeste, noms des
  fichiers exportés (`ariane-…`). **Inchangés** : identifiants internes,
  clés de stockage, champs `format` des exports (les outils reconnaissent un
  export par son contenu), noms des dépôts. Le moteur épinglé garde ses
  textes ; le service worker les traduit vers le panneau.
- **C1** : objectif intermédiaire retenu comme atteint à 79 % (parties 9 et
  12 : 79,3 % et 79,2 %). Rapport de sortie : `c1Seuil` 79.
- **ESV lent** (nuages absents, vue qui ne se recentre pas) : le remède est de
  rafraîchir ESV. Après F5, ESV repart du premier cut non validé (direction,
  27/09). **Option 1 retenue** : Ariane se met en pause et le dit ; après F5,
  « Reprendre » revient au cut du lot par « cut non validé suivant » sans
  rien valider, rattache le lot à la nouvelle page (appuis translatés dans le
  nouveau repère, écartés si la translation ne se vérifie pas) et reprend.
  Le rafraîchissement automatique (option 2) a été écrit puis retiré : cinq
  revues de code y trouvaient chaque fois une nouvelle interaction (lectures
  du panneau, pause, arrêt, rechargement en cours) ; la direction avait
  prévu ce repli (« vraiment juste si tu ne trouves aucune solution »).
- **Fin de partie lue dans ESV** : le panneau d'ESV affiche « N on M
  treated » (photo du 27/09 : 6593 on 6732, partie 14). Le lire donnerait la
  fin de partie dès le premier lot : **4.8.5**. Le correctif KI-063 suffit
  pour la 4.8 (direction).
- **Revue d'interface** (skills `artifact-design`, `code-review`) : libellés,
  cohérence, export complet en un clic ; deux défauts de la revue de code
  corrigés avant livraison.
- **Validation (28/09)** : « si tu as suffisamment tout rejoué et tout reçu et
  trouvé aucun potentiel bug je valide la 4.8 ». Rejoué avec le code final :
  tous les lots reçus (parties 9, 11, 12 ; 633 cuts), décisions identiques
  ligne à ligne. Sept revues de code sur la reprise ; la dernière trouvait
  encore la page rechargée **pendant** une commande (erreur Chrome classée
  ERROR, non reprenable) et « Arrêter » grisé pendant une reprise : corrigés,
  chacun avec son essai rouge sans le correctif. Reste simulé seulement :
  le rechargement d'ESV et les textes d'erreur de Chrome (à confirmer au
  premier lot terrain).

## D-057 - Sortie 4.8 : faux isolés tolérés, lot arrêté compté, P2 en 4.9, rotation réglage / validation

**26 septembre 2026, direction**, après la relecture de la partie 12
(`audit/relecture-p12-2026-09-26.md`).

- **Seuil C4 de sortie : faux isolés expliqués tolérés.** « Ne pas exiger zéro
  rail faux sur la 4.8, on a déjà considérablement réduit l'écart avec les
  précédentes versions. » Zéro faux reste la cible, pas une condition de
  sortie. Chaque faux des lots de validation est nommé avec son type dans le
  rapport de sortie ; D-042 s'applique toujours (un type qui se répète appelle
  un correctif). Mesure : 4 faux sur 161 cuts jugés (parties 9 et 12).
- **Un lot arrêté en cours de route compte** (C1 et C4 sur ce qu'il a traité),
  s'il est relu. Un reliquat qui repasse sur les différés d'un lot de la même
  partie est compté par partie, pas en plus (`c1:false`).
- **P2 (précision humaine) reporté en 4.9.** « Banane pose exactement comme un
  autre opérateur l'aurait fait. » C2 est publié comme écart à la relecture de
  l'opérateur, sans plancher humain, et dit comme tel.
- **Rotation réglage / validation adoptée** (« je valide à 100 % »). Chaque
  partie neuve est d'abord une partie de validation : sa mesure est consignée
  avant tout réglage ; ensuite seulement elle entre au banc de réglage, et la
  partie neuve suivante devient la validation. Parties 9 et 12 : mesures
  consignées, elles passent au réglage pour la 4.8.5.
- **Reportés en 4.8.5** : voisins validés comme appuis, en dernier recours
  (D-054, relecture de la partie 9) ; les pistes des faux 7738 (choix à un
  appui, 2e du type après 7026) et 7743 (premier passage à 27,7 mm de la
  voie) ; le biais vertical aux passages à niveau (« je ne le trouve pas mais
  on analysera » : au banc, aucun calage).
- **Feuille de route** : 4.9 (vitesse, UI/UX, code, cerveau, vue réduite, P2
  refait) ; après la 4.9, le « méga cerveau » (précision apprise) ; 5.0
  multi-session ; suivi mobile en lecture seule, éventuellement en 5.5.
- **Interface** : bouton d'ouverture dans ESV redessiné en blanc, discret
  (contrôle Edge du 26/09 : rien d'autre à redire).

## D-056 - Interface Pilote simplifiée : réglages fixes, cerveau actif, détails ouverts, Assisté retiré, bornes remplies (4.7.21)

**26 septembre 2026, direction.** « Je ne devrais plus avoir à activer par
défaut le cerveau de placement, le mode tenter (essai), tenter la proposition
expérimentale… pour moi tout cela j'active par défaut à chaque fois » ;
« afficher par défaut les détails » ; « on peut supprimer le mode assisté » ;
« que Banane remplisse automatiquement le premier et dernier cut d'une partie
[…] si j'ai besoin de modifier, je modifie ».

- **Réglages du lot fixes** : rail non résolu différé, décision sur le lot
  appliquée, proposition expérimentale tentée (le lot GCV1 la forçait déjà,
  KI-033). Sélecteurs et seuil retirés ; pendant un lot, ses politiques
  effectives restent affichées (cahier 4.7 §10).
- **Cerveau de placement actif par défaut**, sélections autorisées en essai.
  Constat : dans un lot Pilote GCV1 il ne change pas les positions posées (la
  sélection est celle de GCV1) ; il agit sur la proposition V4.6 consignée.
- **Détails ouverts par défaut** (journal, diagnostic et corpus GCV1).
- **Assisté retiré de l'interface** ; le moteur garde le mode (épinglé).
- **Bornes remplies par Banane** : premier cut = celui qu'ESV affiche ; dernier
  cut = fin retenue pour la partie (saisie d'un lot précédent, ou fin
  constatée quand ESV a quitté la partie), sinon « fin de partie » : le lot va
  jusqu'à ce qu'ESV quitte la partie et se clôt seul (KI-061). Modifiables.
- Ni le moteur ni la décision sur le lot (`lot-decision-v6`) ne changent.

## D-055 - Bilan C5 : `gaugeGap`, `gaugeCount` et `crossingVoieMm` conservés

**25 septembre 2026.** Les trois réglages sans bilan de variation (C5, rapport
de sortie) ont été déplacés un à la fois sur le banc du 25/09 (règles 4.7.20 ;
jeux du banc D-053 ; partie 9 exclue, c'est la partie de validation) :
`audit/curseurs-c5-4720-2026-09-25.md`.

- `gaugeGap` 10 conservé : 5 ou 15 cuts, aucune décision ne change.
- `gaugeCount` 3 conservé : 2 ou 5 appuis, aucune décision ne change.
- `crossingVoieMm` 10 conservé : à 5 mm, rien ne change ; à 15 mm, un cut de
  plus (partie 31, 7026), jugé juste. Un seul cut, sur des parties de réglage :
  trop mince pour desserrer ; à revoir sur de nouveaux lots de réglage.

Restent sans bilan de variation : `frameGap` et `frameAnchors` (sans effet en
avancée normale ; ils n'agissent que dans un lot « Reprise », dont aucun n'a
encore tourné dans la même page) et `validatedMinInliers` (règle mesurée, sans
source terrain).

## D-054 - §14 I amendé : voisins validés comme appuis, sous garde de cohérence

**25 septembre 2026, direction.** Question ouverte par l'amendement n°13
(§13.3) : dans un reliquat, les cuts isolés n'ont d'appui que dans des cuts
validés à la main. Réponse de la direction : **validé**.

- Des cuts **voisins** validés par l'opérateur peuvent servir d'appuis à la
  voie de la décision sur le lot. Jamais de pose du cut décidé, jamais
  d'écartement cible : le contrat [1405, 1470] mm reste une admissibilité.
- **Garde de cohérence** obligatoire : un voisin n'est gardé que s'il s'aligne,
  sur les deux rails, avec au moins deux autres voisins de la fenêtre (±5 cuts),
  à 8 mm (latéral et vertical, repère du rail du cut décidé) ; moins de trois
  voisins cohérents : aucun appui validé. Mesuré sur la partie 19 : 57 % →
  79 %, 0 faux sur 7 jugés ; le voisin faux (9219, SKIP à 40–55 mm) est écarté
  (`audit/appuis-valides-2026-09-24.md`).
- **4.7.20** : la garde et l'entrée « voisins validés » sont dans
  `src/lot-decision.js` (`consistentValidated`, `decideCut({validated})`),
  partagées par le banc et le Pilote ; décision consignée (`validatedAnchors`).
  **Pas encore de source sur le terrain** : le Pilote ne voit que le cut
  affiché, et ESV ne navigue que vers le « cut non validé suivant ». Lire un
  voisin validé demande une navigation vers un cut donné, ou des poses validées
  enregistrées par Banane dans la même page. À instruire avec l'opérateur
  (cahier, amendement n°14).

Parties 6 et 9 (25/09) : dans un reliquat, c'est le seul levier notable ; la
reprise dans la même page n'ajoute que 3 cuts en partie 6.

Relecture de la partie 9 (mesure du 26/09, `audit/relecture-p9-2026-09-26.md`) :
avec 360 voisins validés avant le lot, la garde livrée gagne 17 cuts (14 justes
sur 15 jugés, 1 faux : 7889, 20 mm) mais retire 6 décisions justes au passage à
niveau 4890–4902 et à 3971 : là, quatre voisins validés sont faux de 31 à 34 mm
et cohérents entre eux, ce que la garde ne voit pas. Utilisés en dernier recours
(seulement pour un cut sinon différé, comme le lecteur d'ornière, D-053) :
aucune décision retirée, 85,3 % au lieu de 80,3 %. **Proposition, non décidée** :
variante née de la partie 9, à confirmer ailleurs avant d'être adoptée.

## D-053 - Passage à niveau en dernier recours, voie encadrée, reprise des différés, arrêt au dernier cut (4.7.19)

**25 septembre 2026.** Demande de l'opérateur après les deux lots 4.7.18
(parties 2 et 3) : un lecteur « passage à niveau » et la reprise encadrée des
différés, à mettre en test sur le terrain. Mesure :
`audit/passage-niveau-lecteur-2026-09-25.md`.

- **`crossing` en dernier recours.** Au passage à niveau, le rail est lu par
  son ornière (`src/level-crossing.js`), seulement sur un cut que la chaîne
  diffère : paire posée si l'écartement est dans le contrat (admissibilité),
  si elle passe la garde d'écartement voisin et, avec des appuis, si elle tombe
  à la voie à `crossingVoieMm` 10 près. Jamais sur un cut décidé, jamais après
  la garde de paire. Banc relu : +45 cuts décidés, 36 jugés, 1 faux (partie 34,
  4551, 10,5 mm), aucun juste perdu ; lots 4.7.18 : +18, 17 jugés, 0 faux ; le
  passage à niveau 5377–5384 est décidé en entier. **Écarté** : le lecteur
  comme arbitre (premier passage gardé seulement si le moteur s'accorde avec
  l'ornière, ni reprise ni choix au passage à niveau), qui retirait 43 cuts
  justes sans arrêter aucun faux.
- **`framed` actif** (`frameGap` 8, `frameAnchors` 3) : un cut qui a des
  appuis posés des deux côtés est prédit par une courbe passant par eux. Sans
  effet en avancée normale.
- **Lot « Reprise des différés »** : il part des cuts posés et validés par le
  lot précédent autour de ses différés, figés dans son périmètre et consignés
  pour le rejeu. Aucun cut validé à la main n'entre (§14 I). Pas encore mesuré.
- **Arrêt au dernier cut du lot** (retour terrain) : paire posée sans
  validation, ou cut non résolu laissé sans commande ni navigation, pour
  qu'ESV ne passe pas à la partie suivante. Par l'état du lot ;
  `src/engine.js` reste épinglé.
- **KI-059** : capture, réponses et exports sous la limite de 64 Mio.
- Règles consignées (`lot-decision-v6` : `crossing`, `framed`) ; les lots
  antérieurs sont rejoués sans lecteur ni voie encadrée.
- **Non retenu, à décider par la direction** : des appuis validés à la main
  pour les cuts isolés d'un reliquat (amendement au §14 I nécessaire).

## D-052 - Un appui est un cut posé ; suites de la relecture 4.7.16 et du chantier 5 (4.7.18)

**24 septembre 2026.** Relecture indépendante de la 4.7.13 à la 4.7.16
(`audit/chantiers/relecture-4716.md`) et chantier 5 (`audit/chantiers/acceptation.md`),
intégrés.

- **Un appui est un cut posé** (constat B1, KI-057 ; question 2 du chantier 5).
  La décision propose un appui ; il n'entre dans la mémoire du lot qu'une fois
  ses positions commandées, appliquées et le cut validé. C'est la règle écrite
  au n°10 (« les cuts déjà placés du même lot »). Mesure
  (`audit/appui-pose-2026-09-24.md`) : Natif inchangé ; sur les lots Pilote,
  434 décisions commandables au lieu de 436, 207 justes au lieu de 209, faux
  inchangés (1). Les deux cuts perdus (partie 2 : 115, 116) n'avaient d'appuis
  que grâce au défaut : 113 et 114, hors de la vue. Règle consignée
  (`anchorRule:'placed'`, `lot-decision-v5`) ; le rejeu d'un lot antérieur garde
  l'ancienne règle, et la parité de la partie 35 reste de 233/233.
  **À confirmer par la direction** : c'est la lecture du cahier, et son seul coût
  mesuré est de deux cuts justes.
- **« Réessayer ce cut » refusé si les rails ont bougé pendant la pause**
  (KI-055) : la pose de l'opérateur n'entre jamais dans le moteur (§10, §14 I).
  Le correctif est dans le service worker ; `src/engine.js` est épinglé.
- **Version de création du lot consignée** (`scope.extensionVersion`, constat
  I1) : le rejeu la préfère à celle de l'export. Les lots déjà exportés restent
  soumis à la limite décrite par le relecteur.
- **C5 dans le rapport d'acceptation** (KI-056) : une ligne par section.
- **Constat I2** (preuve terrain de la 4.7.16 manquante) : il est toujours
  ouvert, et seul un lot neuf, complet et relu le lèvera.
- **Constat M1** (provenance de la navigation dans le statut) : il est traité
  par la 4.7.17 (commande en trois étapes, serveur toujours « non disponible »).
  Le contrôle visuel dans Edge reste à faire.
- **Terrain** (25/09) : l'opérateur est resté en 4.7.14 ; les 4.7.15 à 4.7.17
  n'ont jamais tourné sur ESV. Le premier lot 4.7.18 relu confirme ou non, en
  une fois, les règles de D-047, D-050 et D-052 ; le rejeu isole l'effet de
  chacune. Retour arrière de terrain : 4.7.14.
- Temps du banc (chantier 5, question 6) : les deux essais les plus longs
  (`lot-decision-navigateur*`, 7,2 et 7,6 s sur 10) sont chacun un scénario
  unique. Ils ne sont pas découpés.

## D-051 - Faux de premier passage sans appui : observer, aucune garde

**24 septembre 2026**, sur l'étude du chantier 7 (`audit/chantiers/faux-sans-appui.md`,
branche `chantier-48/faux-sans-appui`, intégrée). Base reproduite : 711 cuts
décidés, 4 faux (398, 402, 983 de la partie 20 ; 137 de la partie 2), tous des
premiers passages. Six gardes simples mesurées en un seul passage, appuis
recalculés : aucune n'arrête ces faux sans perdre de cuts justes. La plus large
(écart à la pose ESV > 50 mm) en arrête trois, mais perd 110 justes et crée
deux faux par ricochet (405, 114) ; celle du calage hors domaine arrête 137 et
perd 12 justes ailleurs. Les seuils ESV ont été choisis après observation des
faux : aucun n'est validé.

- **Retenu : observer, ne rien activer.** Aucun code ne change.
- Ces faux restent nommés dans chaque bilan ; le signal qui les séparerait
  n'existe pas encore dans ce que le moteur publie en premier passage.

## D-050 - 4.7.16 : garde d'écartement voisin à 20 mm, choix à 5 points de dessus

**24 septembre 2026, direction** (« ok pour les deux, je valide »), sur la
recommandation du bilan (`audit/ecartement-voisin-2026-09-24.md`,
`audit/curseurs-lot-2026-09-24.md`).

- **Garde d'écartement voisin, 20 mm** : paire écartée si son écartement
  s'éloigne de plus de 20 mm de la médiane des 3 appuis les plus proches ;
  garde seulement, jamais cible (cahier §3.6, §7 invariant n°1). 15 mm
  écarterait un cut juste où l'écartement change réellement (9047).
- **`minTop` du choix : 5** (était 15). Filtre du choix seulement ; un choix
  n'est jamais appui. 3 et 1 n'ajoutent que 2 justes, dont un au seuil.
- Ensemble, 6 sessions Natif et 5 lots Pilote relus : 711 décidés au lieu de
  690, +13 justes, −1 faux (7026), aucun juste perdu. Réserve : les gains du
  choix viennent du banc Natif ; le premier lot 4.7.16 relu les confirme ou non.
- Écartés : aide au choix par l'écartement et « cible » (aucun cut changé).

## D-049 - 4.9 : décentrer la caméra d'ESV pour atteindre le champignon

**24 septembre 2026, direction.** « Quand l'écartement est trop important et
que la correction à effectuer est hors de la caméra ESV, il faudrait un outil
permettant de décentrer la caméra afin que le super cerveau aille chercher la
portion où placer le champignon sur le nuage de points. » Chantier inscrit au
cahier 4.9 (`BANANE_4.9_CAHIER.md`, §1), ouvert à cette date en brouillon avec
les autres chantiers déjà renvoyés à la 4.9. Rien ne change en 4.8 (D-043).

## D-048 - Relecture ciblée des lots

**24 septembre 2026, direction.** Le prochain lot Pilote (4.7.14) est relu sur
une zone ciblée, pas en entier : la direction juge la fiabilité suffisante pour
ne plus tout relire. Conséquence : C4 et la précision portent sur les seuls
cuts de la zone ; chaque rapport donne la zone, le nombre de cuts jugés et la
part du lot qu'ils représentent, et n'extrapole pas au reste du lot. Le lot
4.7.12 de la partie 35 (233 cuts, 203 placés) ne sera pas relu : relecture non
enregistrée.

## D-047 - Bilan des curseurs de la décision sur le lot ; reprise appui jusqu'à 15 mm (4.7.15)

**24 septembre 2026.** Critère C5, `audit/curseurs-lot-2026-09-24.md`. Chaque
curseur de `src/lot-decision.js` déplacé seul, décision rejouée en un seul
passage (appuis recalculés), garde de paire active, sur 6 sessions Natif et
4 lots Pilote relus. Base (4.7.14) : 652 cuts décidés, 489 jugés, 4 faux
(398, 402, 983, 7026).

- **`chainMm` 10 → 15 mm, desserré en 4.7.15** (autorisé par la direction le
  24/09) : une reprise depuis la voie devient appui si elle tombe à 15 mm au
  plus de la prédiction. +4 justes, 0 faux, 0 juste perdu. La décision consigne
  ses règles (`lot-decision-v3`, `chainMm`) ; le rejeu d'un lot antérieur garde
  10 mm.
- **Conservés** : `guardMm` 30 (20 : −4 justes ; 40 : +1), `chooseMm` 15
  (10 : retire le faux isolé 7026 pour 5 justes, D-042 ; 20 : −2), `gap` 3
  (2 : −14 justes ; 4 : +1 faux, 1835), `anchors` 2 (3 : −1), garde de paire
  (D-044).
- Les quatre faux restants ne dépendent d'aucun de ces curseurs dans les
  plages essayées : 398 et 402 sont des premiers passages sans aucun appui,
  983 est à 3,9 mm de la voie de ses voisins, 7026 est isolé (D-042).
- Filtres du choix (base 4.7.15) : `minFace` 3 et `maxDzMm` 20 conservés
  (2 : +2 justes dont un à 9 mm ; 5 : −6 ; `maxDzMm` 10 : −10, 30 : 0).
  `minTop` du choix : 5 donne +11 justes, 0 faux, 0 perdu, au banc Natif
  seulement (3 et 1 : +13, dont un cut au seuil de 10 mm) — **proposé à 5,
  à trancher par la direction**. `chainMm` 30 ajoute un faux (1205) : 15 est
  confirmé.

## D-046 - Relecture indépendante de la 4.7.12 : corrections et questions ouvertes

**24 septembre 2026.** Livraison du chantier 3 (branche
`claude/banane-relecture-478-vnvl2u`, rapport `audit/chantiers/relecture-478.md`),
intégrée. Corrigé en 4.7.14 :

- **B1, bloquant (KI-053)** : une paire du moteur retirée par la garde de
  continuité n'est plus jamais rendue par un repli (position de la voie hors de
  la vue, caméra inconnue, repère ou écartement non relus, erreur) : le cut est
  différé. C'est l'intention même de la garde ; aucun seuil ne change.
- **I3 (KI-052)** : « Reprendre » sur le cut archivé est refusé avant tout
  changement d'état ; le lot reste arrêté et reprend au cut suivant.
- **Règles du rejeu** : la décision consigne ses règles (`lot-decision-v2`,
  `pairGuard`) ; l'outil d'acceptation les lit dans le lot.
- **C4** : l'outil rapporte aussi les faux sur les seuls cuts validés.

Questions ouvertes à la direction : engager C4 sur les seuls cuts validés
(les acceptations D-040 comptées à part) ; maintenir D-044 (recommandé :
la partie 34, jamais vue, lui donne un faux arrêté et aucun juste perdu) ; les
appuis validés (4.9) feraient entrer des poses humaines dans l'entrée de la
décision : un amendement au test I du §14 serait nécessaire avant tout code.

## D-045 - Interface de la 4.8 : « La ligne »

**24 septembre 2026, direction.** Pour le chantier B (Banane UI Next), la
direction retient la proposition « La ligne » (`design/ui-next-claude/`), de
préférence aux maquettes de Luna. Son intégration au panneau est un chantier
de la phase 3 (version candidate) ; les invariants du test H restent la
condition : politique effective affichée, « Différés : N » fidèle, incertitude
visible avec son cut, aucun bouton présenté comme réussi sur un simple accusé.

## D-044 - Garde de paire active dans le Pilote (4.7.12)

**24 septembre 2026, direction** (« ok »), sur la livraison du chantier 2
(branche `chantier-48/faux-isoles`, commit `c434a9a`, intégrée). Un premier
passage dont un rail est repêché par S1 **et** dont le calage de convention est
hors domaine sur l'un des deux rails est **différé**, et ne devient pas appui
(`src/lot-decision.js`, `pairGuard`). **Rectifié (relecture 4.7.12)** : la garde
ne fait pas que différer — en retirant un appui, elle change les décisions des
cuts suivants (partie 34 : 1835 et 1837 deviennent des choix à un seul appui,
le cas de KI-050 ; justes tous deux à la relecture).

- Mesure (`audit/garde-paire-verification-2026-09-24.md`) : dans le Pilote
  actuel, 241 et 409 arrêtés (faux), aucun juste perdu, 243 gagné ; ne se
  déclenche sur aucun des trois lots Pilote relus ni sur la partie 30.
- Premier déclenchement sur un vrai lot : partie 34 (lot 4.7.11, rejoué avec
  les règles de la 4.7.12), cut 1834. **Relu : faux de 26,5 mm**, seul faux du
  lot ; avec la garde, 0 faux sur 71 jugés.
- Le rejeu de l'outil d'acceptation suit les règles de la version de chaque
  lot ; `--regles-actuelles` impose celles de la version courante.

## D-043 - Cibles hors de la vue d'ESV : pas de chantier 4.8

**24 septembre 2026, direction.** Sur la partie 33, les poses de départ d'ESV
sont à 13–21 cm des rails ; la décision sur le lot les retrouve, mais hors de
la vue de ±20 cm où le Pilote clique (KI-051). « Quand ça m'arrive, je déplace
la caméra en dézoomant et en déplaçant la vue au clic droit. Je ne pense pas
qu'on soit obligé de l'inclure dans les chantiers de la 4.8. »

- La 4.7.11 diffère ces cuts au lieu d'arrêter le lot ; l'opérateur les pose.
- Aucun déplacement automatique de la caméra ni clic en deux temps en 4.8.
- Conséquence déclarée : sur une partie où ESV part loin des rails, la
  couverture du Pilote est bornée par la vue (partie 33, second lot : 78 %).

## D-042 - 4.7.10 sous la forme prévue : un faux toléré, correctif s'il se répète

**24 septembre 2026, direction.** « Franchement, un seul faux, on peut être
tolérant : on peut sortir la 4.7.10 sous la forme initialement prévue, et si
une anomalie identique se répète deux ou trois fois, on apportera un
correctif. »

- La 4.7.10 applique la décision sur le lot telle qu'observée en 4.7.8 et
  4.7.9 — premier passage gardé, reprise depuis la voie, choix par la voie, y
  compris à un seul appui. La condition de D-041 (0 faux) est levée par la
  direction pour ce seul faux (7026, KI-050).
- **Correctif** : dès que l'anomalie de KI-050 (choix à un seul appui, minimum
  loin d'une prédiction juste) se reproduit sur des lots relus, deux ou trois
  fois, je le propose, mesuré sur toutes les données relues
  (`audit/choix-un-appui-2026-09-24.md` §4 donne les candidats). Tout faux d'une
  autre nature est analysé et remonté aussitôt.
- Les faux des cuts placés par la décision sur le lot sont comptés à part
  (`tools/acceptance-report.cjs`, `c4.byLotCommand`).
- Le réglage « Observer seulement » rend la 4.7.9 sans réinstaller.

## D-041 - 4.7.10 : le Pilote applique la décision sur le lot, après la relecture du lot 2

**24 septembre 2026, direction.** Accord pour une grosse mise à jour du Pilote
reprenant les avancées retenues : en 4.7.10, la décision sur le lot
(`src/lot-decision.js`, D-039) **commande** au lieu d'être seulement consignée.
Condition : la relecture du lot 2 de la partie 31 (4.7.9) juge **0 faux** sur
les cuts que la décision sur le lot applique et que le Pilote laissait. Aucun
développement avant cette relecture.

La pause automatique quand ESV ne charge pas le nuage (KI-049) n'est pas
retenue pour l'instant : le cas ne s'est pas reproduit depuis.

**Relecture du lot 2 (24/09) : condition non remplie.** Décision sur le lot :
1 faux sur 69 jugés, le cut 7026, un CHOIX à un seul appui (KI-050). La
4.7.10 ne sort pas sous la forme prévue ; formes possibles et mesures :
`audit/choix-un-appui-2026-09-24.md` §5, en attente de la direction.

**Appuis validés (24/09, direction).** La voie retenue pour les lire est que
le Pilote se déplace seul sur les cuts voisins pour y lire leur pose ;
chantier ultérieur. L'inspection 3 bis (carte d'ESV) sera faite par
l'opérateur.

## D-040 - Relecture : une visite sans correction ni validation vaut acceptation

**24 septembre 2026, direction.** « Pour moi et tous les opérateurs, si on
visite un cut sans le corriger ni le valider, c'est que le cut est bon et bien
placé. » La relecture d'un lot Pilote suit donc la convention des opérateurs :

- visite **sans validation et sans changement de pose**, d'au moins 0,5 s :
  la pose vue est **acceptée** ; le cut est jugé, erreur nulle par
  construction, compté « accepté sans retouche » à part des cuts validés ;
- visite **retouchée sans validation** : pose finale incertaine, non jugeable ;
- passage de moins de 0,5 s (touche Z en rafale) : non jugeable.

C4 (faux) porte sur les cuts validés et acceptés ; **C2 (précision) reste
mesuré sur les seuls cuts validés** : une acceptation dit « pas faux », pas « à
combien de millimètres ». Mise en œuvre : `tools/acceptance-report.cjs`.
Premier lot 4.7.8 de la partie 31 : 34 cuts appliqués jugés sur 35 (9 validés,
25 acceptés), 0 faux.

## D-039 - D1 : choix par la voie autorisé ; 4.7.8 en observation dans le Pilote

Date : 23 septembre 2026. Décision de la direction sur le résultat de la
phase 0 (`audit/lot-choice-2026-09-23.json`). Amendement n°9 du cahier.

- La règle « la prédiction ne fait que déplacer la fenêtre » est levée pour le
  choix par la voie, aux conditions du n°9 §9.1.
- Variante visée : deux passages (reprise des différés en fin de lot), rails
  éligibles élargis aux abstentions de qualité (variante B), chaînage gardé à
  10 mm ; le seul passage est mesuré en parallèle.
- Mise en œuvre : 4.7.8 en observation dans le Pilote, jamais appliquée ;
  activation soumise à D2.

## D-038 - Comparaison des deux audits à mi-parcours ; définitions de mesure

Date : 23 septembre 2026. Sources : `audit/mi-parcours/AUDIT_CLAUDE.md` et
`audit/mi-parcours/AUDIT_ASTRA.md` (indépendant). Les deux convergent sur
l'objectif intermédiaire de 80 % et sur la décision au niveau du lot.

Retenu de l'audit indépendant, sans changer le plan D-037 :

- **Dénominateur de C1** : tous les cuts DISTINCTS d'un lot Pilote complet
  déclaré ; un cut sans entrée, différé, refusé par la garde ou de résultat
  inconnu reste au dénominateur ; une revisite n'est pas un nouveau cut. Le
  taux sur cuts avec entrée est un diagnostic, jamais le dénominateur.
- **Critère « faux » bidimensionnel** : erreur latérale OU verticale au-delà
  de 10 mm, mesurée sur valeurs brutes. Vérifié : sur les 233 cuts jugés
  justes des deux audits du moteur, aucun ne dépasse 10 mm verticalement ;
  les chiffres passés ne changent pas, la définition si.
- **Périmètre explicite** : les cuts 9033 et 9241, exclus à la demande de
  l'opérateur, le sont dans chaque bilan qui les concerne, et le bilan le dit.
- **Minima proches ≠ paires récupérables** : le plafond « ~88 % » de l'audit
  interne n'est pas une mesure ; seule une paire complète, admissible et jugée
  compte (chantier 1, `tools/lot-choice-study.cjs`).
- **Journaliser les candidats** : minima et paires de chaque rail consignés
  dans l'observation, pour séparer absence d'observation, bon rail non choisi
  et paire refusée (prochaine version d'observation).
- **Qualification par côté instrumentée** (chantier 3) : raison, présence,
  visibilité, capture avant geste, doublons.
- **Holdout par partie** et P2 avant toute conclusion de généralisation.

## D-037 - Plan de mi-parcours du cahier 4.8

Date : 23 septembre 2026. Décision de la direction sur l'audit interne à
mi-parcours (l'audit indépendant est en cours ; les deux seront versés
ensemble).

Constat retenu : dans la majorité des cuts différés, le moteur a calculé la
bonne position et ne la choisit pas — ambiguïté entre le rail et un champignon
voisin, ou paire refusée par l'écartement parce qu'un rail est sur ce voisin.
Sur le terrain (Pilote 4.7.6, partie 19), 11 différés sur 13 relèvent du choix.

- **Objectif intermédiaire : 80 % des cuts de lots Pilote**, deux rails dans le
  contrat, 0 cut faux au-delà de 10 mm, rapporté par partie. Les 90 % du §2
  restent le cap.
- **Chantier 1 — décider sur le lot** : utiliser la position prédite par la
  voie pour choisir entre les minima que le moteur calcule déjà ; étude hors
  ligne d'abord (`tools/lot-choice-study.cjs`), amendement ensuite si elle le
  justifie.
- **Chantier 2 — lots Pilote terrain** sur des parties à appareils de voie,
  relus en Natif ; C1 compté sur les cuts du lot.
- **Chantier 3 — aligner le banc sur le Pilote** : le filtre de qualification
  centré sur la pose ESV ne doit plus retirer du banc les cuts que le Pilote
  sait lire.
- **Chantier 4 — P2** : 30 cuts replacés en aveugle.

## D-036 - Observation « continuité » dans le Natif (4.7.7)

Date : 23 septembre 2026. Décision de la direction, sur la base de l'amendement
n°7 du cahier 4.8 et de sa relecture indépendante.

À la fin de chaque première visite Natif, Banane calcule la proposition que le
moteur GCV1 aurait faite en partant de la droite des cuts voisins déjà validés
par l'opérateur, et la consigne dans la visite (`continuityObservation`). Elle
n'est **ni appliquée, ni affichée, ni commandée** : l'opérateur ne doit pas
être influencé, sinon sa pose cesse d'être un juge indépendant.

Règles (`src/continuity-observer.js`), fixées après la relecture :

- ancres : validations fiables et ANTÉRIEURES de la session, aux règles de
  référence du banc (une seule intention VALIDATE, état associé, fraîcheur de
  0 à 1 500 ms), même partie et même repère de scène, à 3 numéros de cut au
  plus ; les 2 plus proches. Jamais une proposition du moteur ;
- sans ancre : aucun calcul (pas de retour à la pose ESV) ;
- points : une capture par côté, prise à la pose ESV exacte avant le premier
  changement de rail, visibilité prouvée, doublons retirés ;
- moteur, calage et garde d'écartement appelés tels quels ; aucune cible
  d'écartement ; l'écart à la prédiction est consigné pour juger toute garde
  de continuité hors ligne ;
- calcul hors de la file des événements, une visite à la fois, au plus 4 en
  attente ; la fin de session attend les calculs en cours (15 s au plus).

Coupure : `BananeSettings.continuity.observe`. Retour : 4.7.6
(`RETOUR_ARRIERE.md`). Critère d'arrêt : si, sur la collecte, le départ par
continuité fait plus de cuts faux que le départ ESV rejoué sur la même entrée.

## D-035 - Bilan des curseurs du cahier 4.8, §8 (critère C5)

Date : 23 septembre 2026. Source : `audit/brain-audit-2026-09-22.json` (moteur
4.7.6, 385 cuts, parties 13, 18, 19, 20), rails abstenus jugés contre la
validation humaine ; « juste au premier rang » signifie que le meilleur minimum
de la grille était à 10 mm ou moins de la pose humaine.

| Curseur | Valeur retenue | Coût mesuré | Décision |
|---|---|---|---|
| `minFace` | 6, avec flanc partiel 3–5 points si le dessus est bien vu | Voir D-031 | **Desserré** en 4.7.5 (D-031). Reste : 60 rails abstenus pour flanc, 27 sur 41 jugés justes au premier rang, avec moins de 3 points de flanc. Pas de nouveau desserrage sans une autre preuve (continuité de voie, D-033). |
| `minTop` | 15 | 15 rails abstenus ; sur 13 jugés, 7 justes au premier rang, 3 à un rang suivant, 3 absents | **Conservé.** Desserrer publierait au mieux 7 justes pour 6 douteux ; aucun bilan de desserrage n'est encore mesuré. Bilan incomplet, à instruire. |
| Competitive set `loss/lmin` (ambiguïté) | 1,5 | 13 rails abstenus ; sur 12 jugés, 7 justes au premier rang, 5 faux au premier rang | **Conservé.** Desserrer publierait 5 rails faux sur 12. Le classement doit venir d'une autre information (continuité de voie), pas d'un seuil plus lâche. |
| Pente hors domaine | inchangée | 10 rails abstenus ; sur 7 jugés, 6 justes au premier rang | **Conservé**, hors liste du §8. Coût réel, gain de desserrage non mesuré. |
| Garde d'ambiguïté S1 | active | KI-031 : une abstention de plus, une erreur > 50 mm de moins | **Conservé.** |
| Seuil de confiance | neutralisé en Pilote GCV1 | 0 cut mis en pause sur 74 (KI-033) | **Conservé.** |
| Fenêtre de fraîcheur de la référence | 1 500 ms | 9 rails sans référence sur 477 qualifiés, contre 145 faute de validation | **Conservée.** Ce n'est pas elle qui prive le banc de références, c'est l'absence de validation (KI-039). |

Le contrat d'écartement n'est pas un curseur (cahier §8) : inchangé.

## D-034 - A1 redéfini deux fois ; A2 écarté de la 4.8

Date : 22 septembre 2026 (cahier 4.8, amendements n°1 et n°4). Le score de
justesse pour classer des hypothèses (A1 d'origine) est sans objet : le
classement déterministe retrouve le meilleur couple admissible 17 fois sur 17.
Le modèle d'abstention qui l'a remplacé est lui aussi sans objet : aucun cut
appliqué n'est faux sur 76 jugés. A1 devient le calage de convention (D-032).
L'inférence embarquée (A2) est écartée de la 4.8 : entrée alors affamée, service
worker MV3 détruit après une trentaine de secondes d'inactivité ; réouverture
par amendement seulement.

## D-033 - Continuité de voie : étudiée, pas activée

Date : 22 septembre 2026 (cahier 4.8, amendement n°3). Dans les appareils de
voie, recentrer la recherche du moteur gelé sur la position prédite par les cuts
voisins appliqués donne 12 cuts justes, 0 faux et 6 différés sur 19 avec des
voisins des deux côtés (7 justes, 0 faux en passage unique). Une seule partie,
un seul jour : outil `tools/continuity-study.cjs`, rien dans l'extension.
Préalables à toute activation : mesure sur au moins deux autres parties avec
appareils de voie, puis observation dans le Pilote sans application.
L'écartement des cuts voisins ne peut servir que de garde, jamais de cible.

## D-032 - Calage de convention des rails publiés (4.7.6)

Date : 22 septembre 2026 (cahier 4.8, amendement n°4). Le moteur pose le gabarit
au milieu de la bande de points LiDAR, l'opérateur en enveloppe : rail 2,8 mm
trop bas, écartement 4,5 mm trop large en médiane. `src/placement-convention.js`
cale chaque rail publié : dessus au 90e centile des points + 1,0 mm, flanc à la
médiane des points − 2,6 mm, pas de correction latérale sous 6 points de flanc,
pas de calage sous 15 points de dessus ni au-delà de 8 mm. Appliqué après S1 et
avant la garde d'écartement ; A_STAR, S1 et seuils inchangés. Hors ligne, chaque
session retenue à tour de rôle : latéral médian 2,39 → 1,60 mm, vertical
2,83 → 1,13 mm, écartement 4,67 → 2,34 mm ; aucune décision de cut changée.

**Validation.** La relecture Natif d'un lot Pilote est ancrée : l'opérateur part
du placement proposé et ne retouche qu'au-delà de sa tolérance (KI-034, KI-035).
La mesure qui fait foi est une collecte Natif indépendante — l'opérateur pose
depuis l'état ESV, sans proposition — sur une partie non utilisée pour
l'ajustement, rejouée hors ligne calage actif puis coupé
(`tools/brain-audit.cjs --convention on|off`). Retour 4.7.5 si le calage y est
plus loin de l'humain que le placement brut, en médiane latérale ou verticale,
ou s'il rend faux au-delà de 10 mm un cut que le placement brut n'aurait pas
rendu faux.

## D-031 - Flanc partiel dans le Pilote (4.7.5)

Date : 22 septembre 2026, décision de la direction (cahier 4.8, amendement n°3).
Un rail dont le dessus a au moins 15 points et le flanc 3 à 5 points peut être
publié, sans pente hors domaine, rapport de perte ≥ 1,5, deux rails exigés,
écartement dans le contrat. Option de laboratoire existante `partialFaceKeep`,
fichier gelé intact. Bilan, moteur réel sur cinq collectes : cuts appliqués
56 → 113, 72 jugés, 0 faux au-delà de 10 mm, pire rail 6,5 mm. Dérogation au
§1.5 (P2) pour cette seule règle. Retour 4.7.4 au premier cut appliqué en flanc
partiel trouvé faux au-delà de 10 mm.

## D-030 - Le Pilote ne lit pas « comme le Natif »

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le Pilote lit déjà tous
les points chargés dans la zone après stabilisation du niveau de détail. Le gain
de résolution mesuré venait de l'entrée du banc, pas de la lecture ; le chantier
envisagé est annulé.

## D-029 - Entrée du banc : lecture complète de la pose de départ

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le banc donne au moteur
l'instantané qualifié plus la suite de la même lecture — même capture, même
côté, même pose — acquise avant la première action humaine. La frontière
anti-fuite (D-026) est inchangée. `first-snapshot` reste disponible pour
comparer ; l'évaluateur historique 4.4 n'est pas modifié.

## D-028 - Collecte Natif au rythme réel (4.7.2 à 4.7.4)

Date : 22 septembre 2026. La lecture Natif n'est plus interrompue par un
mouvement de caméra ; elle lit par tranches de temps avec accès direct aux
buffers ; la garde se réduit à l'identité du cut et à la pose des rails ; une
relecture n'est relancée que pour de nouveaux nœuds chargés tant que la pose
n'est pas qualifiée (4.7.2). La fin de session reste sous la limite de message
de 64 MiB et une modification de la découpe ESV relance la lecture (4.7.3). Plus
aucune lecture après un déplacement de rail par l'opérateur, qui ne nourrirait
jamais le moteur (4.7.4, `collector.captureAfterOperatorRailChange`). Le
placement et le Pilote ne sont pas touchés par ces trois versions.

## D-4.7c - Autorisation d'opération, finalisation déterministe, export par opération

Date : 21 septembre 2026, correctif post red-team Astra.

**Autorisation portée par l'opération (D1).** Une navigation sans décision n'est dispatchée que si son autorisation est encore valide au moment de l'appel, et le contrôle est relu sans qu'aucun `await` ne le sépare de l'appel — le moteur étant mono-tâche, rien ne peut s'intercaler. `stop()` et `pause()` posent l'état du lot et la révocation SYNCHRONEMENT, avant tout `await`. La révocation ne vaut que tant que `dispatchedAt` est absent ; une fois la commande transmise, elle est enregistrée comme demandée après coup et n'autorise à affirmer aucune non-émission. Dans la page, `cancelledOperations` et `invokedOperations` sont corrélés à l'identifiant d'opération et ne sont jamais vidés par une autre requête, contrairement au drapeau global `cancelled` que chaque entrée de l'adaptateur remet à faux. Le résultat ne dépend donc pas de l'ordre d'arrivée du `cancel` et de la requête. Une opération déjà invoquée ne peut pas l'être une seconde fois, et le second appel rend `commandInvoked: 'unknown'` : il n'a pas cliqué, mais l'opération a pu agir.

**Finalisation réparable (D3).** L'événement `defer-finalized` porte un `eventId` déterministe dérivé de l'`operationId` et un `timestamp` figé sur l'instant de finalisation déjà persisté. Réémis après une interruption, il est identique et reste un seul événement logique — le stockage le déduplique par sa clé, le journal en mémoire aussi. Une finalisation durable retrouvée sans son événement est réparée à partir de l'intention durable et de l'entrée deferred de la MÊME opération : aucune commande ESV, aucun second deferred, et aucun champ relu depuis `s.proposal` ou `s.lidarId`, qui décrivent déjà un autre cut au moment d'une reprise.

**Un `deferral` vient d'une seule opération (D4).** L'export regroupe les événements différés par `operationId`, choisit explicitement une opération — finalisation durable unique, sinon intention encore persistée, sinon opération unique — et n'agrège que les siens. L'ordre du tableau et l'ordre lexical des UUID n'entrent jamais dans ce choix : `store.all('events')` rend les événements par clé aléatoire, pas par chronologie. À timestamp égal dans une même opération et pour un même type, l'identifiant sert de départage reproductible entre événements équivalents, jamais de chronologie. Une ambiguïté réelle est publiée telle quelle (`DEFER_AMBIGUOUS`, motif, identifiants en présence) plutôt que résolue arbitrairement, et un événement historique sans `operationId` n'en reçoit jamais un après coup.

**Priorité de la décision opérateur (D2).** La clôture automatique de borne ne s'applique qu'à un lot encore en marche. Un STOP ou une PAUSE demandés pendant la navigation conservent le résultat deferred acquis et l'état opérateur ; la borne atteinte est consignée et sera constatée à la reprise explicite.

## D-4.7 - Différer un unresolved GCV1 par navigation sans décision

Date : 20 septembre 2026. En Pilote TEST, un cut dont GCV1 n'a pas résolu au moins un rail peut être quitté sans décision : aucune application de rail, aucun VALIDATE, aucun SKIP. La politique `unresolvedPolicy` est figée dans le scope du lot à sa création — `defer` par défaut pour un nouveau lot Pilote GCV1, `pause` si l'opérateur le choisit, `pause` pour un lot antérieur qui n'a pas le champ. Ni un redémarrage ni un changement du réglage d'interface ne convertit un lot en cours.

La branche `defer` exige une proposition GCV1 attribuée sans ambiguïté au cut courant, une capture LiDAR référencée, et au moins un rail portant `status: unresolved` avec `source: geometry-candidate-v1-abstention`. Une proposition absente, d'une autre identité, un repli hors GCV1, un delta manquant sans abstention ou une erreur technique gardent leur diagnostic et leur pause : `missing === true` ne suffit jamais à lui seul. Les politiques de faible confiance et l'admissibilité des candidates S1 à confiance non calibrée ne changent pas.

Un différé est une issue du **pilote**, pas une résolution scientifique. `batch.deferred` est une collection distincte de `processed`, `skipped`, `paused`, `interrupted` et `manuallyCompleted` ; elle n'est jamais comptée comme une validation, et un lot qui en contient ne peut pas finir sur « Terminé confirmé ». L'enregistrement `banane-deferred-unresolved-v1` porte `decision: DEFERRED_UNRESOLVED`, `usableForTraining: false`, `trainingExclusionReason: gcv1-unresolved-deferred`, et conserve les statuts GCV1 des deux rails tels quels. Les champs `bananeValidated`, `validationCommandSent`, `skipCommandSent` et `applyCommandSent` décrivent les commandes Banane de cette opération — `commandScope: banane-operation-only` — et non un audit rétroactif de tout ce qu'ESV a connu de ce cut.

## D-4.7b - La commande de navigation utilisée, et l'équivalence Maj+Z observée

Date : 20 septembre 2026. `nextWithoutDecision` clique `O2N3DCutNextInvalid3DRail`, relevé dans les sources V2–V2.4.2 et câblé depuis la V3 ; le chemin SKIP ne passe pas par lui (D-4.4 ci-dessous). L'inspection directe du JavaScript ESV chargé dans Edge, le 20 septembre 2026, établit que ce bouton et le raccourci Maj+Z atteignent **la même fonction native** : le gestionnaire clavier contient `e.shiftKey && 90 == e.which ? t.buttonNextInvalidCut()` et le bouton est câblé par `$("#O2N3DCutNextInvalid3DRail").click(function(){ t.buttonNextInvalidCut() })`, `buttonNextInvalidCut()` appelant `loadNextInvalidCut("positive")`. Les chemins décisionnels sont séparés dans le même code : `buttonValidateRail()` et `buttonValidateRailAndNext()` passent par `railPairUpdated(…, "valid", …)`, `buttonSkipRail()` par `railPairUpdated(…, "skipped", …)`. Le contrat « navigation sans décision » est donc observé, pas supposé, et la preuve retournée porte `shortcutEquivalence.established: true` avec les deux chemins, la source et la date.

Cette preuve vient de l'observation du code chargé, **pas d'une documentation du fournisseur**. `buttonNextInvalidCut`, `loadNextInvalidCut` et l'identifiant DOM restent des symboles internes non publiés, susceptibles de changer à une mise à jour d'ESV : la preuve le dit par `source` et `stability`, et KI-026 tient la limite de maintenance. Aucun `KeyboardEvent` « Z » n'est synthétisé pour autant, bien qu'un gestionnaire clavier soit maintenant observé : le défaut 6 d'`AUDIT_PILOTE.md` rappelle qu'un événement dispatché ne prouve pas sa prise en compte, alors que le bouton expose sa présence et son état `disabled` avant l'action.

La corrélation disponible est celle du bridge — une requête, une réponse, un `operationId` que Banane transporte et qu'ESV ne renvoie pas — plus un contrôle d'identité complète, de page et de part effectué **dans la page**, juste avant l'action. Une navigation manuelle concurrente pendant cette fenêtre reste hors de portée, et le champ `correlation` le dit plutôt que de l'omettre. `commandInvoked` vaut `true` seulement après le retour de l'appel, `false` seulement sur un refus antérieur au clic, et `unknown` partout ailleurs : une incertitude n'est jamais rendue comme un `false` rassurant.

## D-4.4.3 - Fenêtres réellement vivantes plutôt que filtre URL

Date : 13 septembre 2026. Le retour ESV contredit la validation simulée V4.4.2. La présence de Banane est désormais définie par les fenêtres créées et les connexions vivantes de ses cinq pages, sans se fier au filtrage d'onglets par URL d'extension. Ces connexions se rétablissent après arrêt/reprise du service worker. Pour écarter également une règle CSS ESV et les réponses asynchrones obsolètes, le bouton flottant est retiré physiquement du DOM puis réinséré, et les mises à jour plus anciennes sont ignorées. La notification provenant de Banane n'observe ni ne modifie les commandes de Mic dans ESV.

## D-4.4.2 - Preuves acquittées avant les intentions et interface discrète

Date : 13 septembre 2026. Chaque instantané de rail issu des seuls points visibles conserve son identité, sa fenêtre d'acquisition, la pose initiale et les preuves de source/repère. La sauvegarde du bloc est acquittée avant l'événement de checkpoint. La qualification temporelle s'appuie sur l'acquisition plutôt que sur l'arrivée tardive du message de fin ; une contradiction ultérieure révoque explicitement l'instantané. Les exports V4.4.1 ne sont jamais requalifiés rétroactivement. L'ouverture du panneau Banane masque le bouton flottant dans ESV jusqu'à fermeture de la dernière fenêtre, sans action ESV. Aucune modification du moteur de placement.

## D-001 - Préserver la référence originale

Date : 10 septembre 2026.  
La V4.0 d'origine est conservée dans `archive/` et exclue des modifications et du paquet installable.

## D-002 - Placement par gabarit U50 soutenu par les surfaces

Date : 10 septembre 2026.  
La translation proposée utilise le minimum affiné du recalage du contour complet du champignon. Les ajustements du plan de roulement et du flanc interne restent obligatoires comme preuves de support et sont conservés comme diagnostics. Motif : sur les 47 corrections, l'intersection seule était moins proche des pointages humains et pouvait sélectionner des surfaces parasites de passage à niveau.

## D-003 - Refuser l'ambiguïté plutôt que gonfler la confiance

Date : 10 septembre 2026.  
Un second bassin de recalage distant d'au moins 20 mm rend la proposition non applicable lorsque son coût est inférieur à 1,5 fois le meilleur coût. Un déplacement latéral supérieur à 60 mm est également refusé si l'autre rail ne fournit pas au moins 40 mm de soutien latéral. Ces seuils sont des barrières de sécurité expérimentales, évaluées sur les 47 cuts et le corpus historique; ils ne sont pas une règle métier ESV.

## D-004 - Ne pas activer de correction propre à la part 11

Date : 10 septembre 2026.  
Une correction médiane apprise sur les 47 cuts réduit encore l'erreur, mais elle n'est pas intégrée au moteur. Le projet ESV n'étant pas observable, une part numérotée 11 pourrait appartenir à un autre projet. Une calibration ne pourra être appliquée qu'avec une identité de dataset vérifiable et une évaluation sur des portions indépendantes.

## D-005 - Ne pas reconstruire l'écartement ESV par hypothèse

Date : 10 septembre 2026.  
La distance entre origines de profils ou un calcul LiDAR ne remplace pas la valeur ESV sans preuve d'équivalence. `src/gauge.js` fournit uniquement un parseur et une classification pure testables; aucun sélecteur DOM, aucune lecture ESV et aucune action SKIP ne sont inventés.

## D-006 - Séparer sécurité et couverture

Date : 10 septembre 2026.  
Les métriques publient simultanément l'erreur des propositions acceptées et leur couverture. Une baisse d'erreur obtenue par davantage de refus ne doit jamais être présentée seule.

## D-007 - Représenter la décision opérateur explicitement

Date : 10 septembre 2026.  
Les exports de Mes corrections distinguent `operatorDecision: VALIDATE` de `operatorDecision: SKIP`. Un SKIP conserve la paire avant/finale et le LiDAR disponible, mais il est exclu de l'entraînement par `usableForTraining: false` et `trainingExclusionReason: operator-skip`. Aucun motif d'écartement n'est déduit du raccourci.

## D-008 - Relayer le SKIP natif sans le remplacer par une navigation

Date : 10 septembre 2026.  
Après sauvegarde acquittée, `Shift + Backspace` est relayé une fois au gestionnaire clavier ESV. Le chemin manuel SKIP n'appelle pas `O2N3DCutNextInvalid3DRail`. Banane observe ensuite le changement d'identité du cut. Sans navigation dans le délai, la session passe en erreur avec résultat incertain et ne réémet pas la commande.

## D-009 - Ne pas automatiser la règle d'écartement en 4.2

Date : 10 septembre 2026.  
Le seuil inférieur est fixé à 1 410 mm : en dessous, SKIP ; de 1 410 à moins de 1 430 mm, validation avec tolérance. La valeur ESV n'étant pas encore observable de manière fiable, la 4.2 enregistre uniquement la décision humaine. Le pilote automatique et son interface ne reçoivent aucune logique SKIP liée à l'écartement.

**Révisé en 4.7 — voir D-027.** La borne basse passe à 1 405 mm et l'issue « SKIP » disparaît : le mot « définitivement » de la rédaction d'origine ne tient plus.

## D-027 - Contrat d'écartement 1 405 / 1 430 / 1 470, sans SKIP automatique

Date : 21 septembre 2026.  
Contrat opérateur en vigueur : sous 1 405 mm `LOW_INVALID`, de 1 405 à moins de 1 430 mm `TOLERANCE` (admissible), de 1 430 à 1 470 mm inclus `NOMINAL` (admissible), au-delà `HIGH_INVALID`. Les trois bornes n'existent qu'à un endroit, `src/gauge.js`.

Deux changements par rapport à D-009. La borne basse passe de 1 410 à **1 405 mm**. Et un hors-contrat n'est **jamais** un SKIP : c'est une **abstention**. Le module d'écartement ne rend plus aucune issue décisionnelle, et aucune voie automatique ne peut dériver un SKIP d'une mesure — le SKIP reste une décision de l'opérateur seul. Ce que D-009 refusait d'automatiser était la *décision* ; ce que 4.7 automatise est le *refus d'agir*, qui n'est pas la même chose.

Contrairement à D-009, la règle est désormais **appliquée** au runtime, sur l'écartement **prévu** après application des deltas — jamais sur l'état avant, qui est précisément ce que Banane corrige. Deux étages : la composition GCV1 rend les deux rails abstenus, et `Engine.apply()` refuse de commander. Ce dernier étage est global à tous les modes, parce que le contrat est une contrainte physique de la voie et non une règle propre à GCV1.

## D-010 - Différer le correctif de couverture du pilote automatique

Date : 10 septembre 2026.  
Mic rapporte que le pilote 4.1 s'interrompt beaucoup plus souvent que le 4.0 lorsqu'un des deux rails ne reçoit aucune proposition. Aucun seuil géométrique ni comportement du pilote n'est modifié avant l'analyse des corrections récentes par Terra. Ce retour est conservé comme régression d'usage à mesurer, pas comme preuve suffisante pour desserrer immédiatement les garde-fous.

## D-011 - Quatre preuves indépendantes après commande

Date : 10 septembre 2026.  
`commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved` ne sont jamais déduits les uns des autres. Une navigation ne confirme ni l'état final ni l'enregistrement serveur. Une cible changée avant relecture met le lot en pause avec une anomalie explicite.

## D-012 - Pause par défaut sur proposition incomplète

Date : 10 septembre 2026.  
Un rail non résolu conserve l'identité, l'avant, le LiDAR, la proposition partielle, les motifs et confiances. Le pilote se met en pause sur le même cut et n'envoie aucune validation partielle. Le SKIP n'est possible que par action explicite de l'opérateur.

## D-013 - Les validations sans mouvement sont positives

Date : 10 septembre 2026.  
Une décision `VALIDATE` avec deux positions inchangées devient `VALIDATE_NO_MOVEMENT`. Les quatre catégories humaines sont mutuellement exclusives et les deux rails avant/après restent exportés.

## D-014 - Banc hors ligne sans apprentissage

Date : 10 septembre 2026.  
Le banc appelle la géométrie pure sur les nuages et états initiaux, puis compare au résultat humain. Il n'accède pas à ESV, n'envoie aucune commande et ne modifie ni modèle ni seuil. Le build du moteur et ses paramètres sont empreintés dans chaque résultat.

## D-015 - Ne pas intégrer le voisinage au moteur principal

Date : 10 septembre 2026.  
L'ordre réel, les voisins verts, la geominfo et le contexte de voie manquent. `previousCutId`, `nextCutId`, `sequenceIndex` et la structure geominfo sont préparés, mais la continuité ne peut devenir qu'un futur signal secondaire de baisse de confiance ou de pause.

## D-016 - Isoler un Mode Natif strictement passif

Date : 11 septembre 2026.  
Le Mode Natif possède sa propre page, sa machine de session et sa provenance. Son adaptateur n'expose à l'observateur que des lectures et la sauvegarde. Les chemins `apply`, sélection gauche/droite, `next`, `VALIDATE` et `SKIP` ne lui sont pas fournis. Les autres modes sont bloqués tant que sa session est ouverte.

## D-017 - Observer l'entrée dès le chargement sans la capturer

Date : 11 septembre 2026.  
Le script `document_start` relève les événements fiables et les décrit dans un message interne. Il n'appelle jamais `preventDefault`, `stopPropagation` ou `stopImmediatePropagation` pour Natif et ne fabrique aucun événement clavier ou souris. Cette position précoce permet de conserver l'intention même si un gestionnaire ESV ultérieur interrompt sa propre propagation.

## D-018 - Séparer visites et périodes d'observation

Date : 11 septembre 2026.  
Une nouvelle identité affichée ferme la visite active et en ouvre une autre. Un retour sur le même cut crée également un nouveau `visitId`. Pause ferme la période ; Reprendre crée un nouvel `observationPeriodId`. `visitIndex` décrit seulement l'ordre d'observation et ne renseigne jamais `sequenceIndex`, `previousCutId` ou `nextCutId` ESV sans preuve dédiée.

## D-019 - Borner et dégrader la collecte

Date : 11 septembre 2026.  
La file réelle est limitée à 128 événements. La lecture de la vue courante cède la main tous les 512 points et se limite à 512 nœuds, 60 000 points conservés, 1 200 000 inspectés et 300 ms. Une surcharge réduit d'abord la collecte puis passe en métadonnées seules ; les compteurs et motifs sont exportés. Une panne durable produit un signal visible unique.

## D-020 - Ne pas mélanger une observation Natif avec un label explicite

Date : 11 septembre 2026.  
`native-passive-observation` reste séparé de `explicit-manual-session`. Un geste clavier est une intention observée, pas une confirmation serveur. Même lorsqu'une visite respecte les critères de cohérence et reçoit `usableAsNativeReference:true`, elle conserve `usableForTraining:false` jusqu'à une revue et une promotion explicites hors session ESV.

## D-021 - Geler le placement et le pilote en V4.4

Date : 11 septembre 2026.  
Le chantier V4.4 porte uniquement sur la collecte native. `src/geometry.js`, `vendor/capture-core.js` et `src/engine.js` sont inchangés octet pour octet par rapport à la V4.3. Les résultats du banc hors ligne V4.3 restent donc la référence du moteur.

## D-022 - Corriger la perte de points sans toucher au moteur

Date : 13 septembre 2026.  
L'audit des trois exports V4.4 a démontré que la lecture séquentielle des nœuds Potree épuisait presque toujours ses 300 ms avant la zone utile, malgré des sondes dans la ROI. Le lecteur historique `vendor/lidar.js` reste inchangé. Un lecteur réservé au Natif classe les nœuds déjà chargés par sondes et distance, puis lit par portions avec des limites explicites. Aucun clic de sélection, déplacement de caméra, commande native ni navigation ne lui est accessible.

## D-023 - Sauvegarder des observations par rail sans associer des cibles différentes

Date : 13 septembre 2026.  
La gauche et la droite possèdent leurs propres portions LiDAR durables, matrices, poses, identité, vue et horodatage. Un rail qualifié est analysable seul. Une paire peut unir des observations non simultanées si leur identité, repère et poses initiales sont compatibles. Tout changement pendant lecture est rapporté ; aucun état du nouveau cut n'est incorporé à l'ancien.

## D-024 - Séparer candidature géométrique et promotion d'entraînement

Date : 13 septembre 2026.  
Un nuage non vide ne suffit pas : couverture utile, transformation numérique, pose initiale, chunks sauvegardés, intention unique et référence humaine compatible sont vérifiés. `VALIDATE_NO_MOVEMENT` reste distinct de SKIP et du simple passage ; plusieurs intentions restent ambiguës. `usableForOfflineEvaluationByRail` et `usableAsNativeReference` désignent uniquement des candidats ; `usableForTraining:false` reste invariable.

## D-025 - Chronologie et récupération sans fiction

Date : 13 septembre 2026.  
`eventSeq` est monotone par session et distinct de la séquence spatiale ESV. Une période interrompue récupérée indique une fin d'heure inconnue et n'invente pas de dernier état. Les événements et portions sont sauvegardés avant l'export final ; les pertes et plafonds sont tracés.

## D-026 - Rejeu hors ligne à frontière anti-fuite

Date : 13 septembre 2026.  
Le banc Natif reconstruit l'entrée du moteur depuis les portions géométriques et l'état initial, génère les propositions puis seulement compare à la position humaine finale. Les anciens exports V4.4 restent des preuves de panne, pas un nouveau jeu comparable. Aucune amélioration de précision n'est annoncée sans essai ESV 4.4.1 et comparaison sur les mêmes cuts.

## D-097 - Parties 17 et 18 corrigées en Écho : référence d'entraînement (14 octobre 2026)

Mic corrigera à la main, en mode Écho, les parties 17 et 18 (test 12, 4.9.0.12). Ces corrections servent de **vérité terrain** : (1) juger B1 en ombre (28 poses ajoutées à juger, 1 pose retirée sur le cut 5290, partie 18 ; critère d'activation : 0 mauvaise pose ajoutée, 0 bonne pose perdue) ; (2) entraîner le « cerveau » (GCV2) ; (3) analyser le comportement métier pour la 5.0 (déplacement autonome, correction des voisins). Les prochaines sessions Écho sont traitées en priorité d'analyse, avant toute autre mesure. Les exports d'origine (états de pose d'Ariane avant correction) doivent être conservés par Mic : sans eux, la comparaison avant/après est impossible. Aucune donnée de partie dans les dépôts publics.

## D-098 - Premier apprentissage hors ligne sur l'Écho de la partie 17 (14 octobre 2026)

Hors ligne uniquement, aucune activation. Sur 600 cuts avec pose finale humaine, prédiction « pose = interpolation entre les deux voisins finalisés les plus proches » (cuts espacés d'environ 1 m ; le voisin le plus proche seul est faux de 1 m) : médiane 4,5 mm, P90 9,7 mm, P99 25 mm, y compris sur les 66 rails de cuts différés par Ariane (pose de départ : 44 mm médian, 116 mm P90). Pour les cuts posés par Ariane : 4,7 mm contre 5,0 mm. La régression linéaire sur plusieurs voisins est moins bonne que l'interpolation des deux plus proches. Limites : voisins pris dans les finales humaines (pas dans les poses d'Ariane), un seul lot, les cuts isolés sans voisin ne sont pas couverts. Suite : B1 doit consigner sa pose en ombre ; rejouer avec des voisins posés par Ariane.

## D-099 - Rejeu de l'interpolation avec voisins posés par Ariane (14 octobre 2026)

Même lot (partie 17, Écho). Voisins = poses de départ d'Ariane (192 cuts posés), cible = pose finale humaine. Cuts différés couverts : 9 sur 35 avec voisins posés à moins de 2 cuts de chaque côté (erreur médiane 5,5 mm, maximum 9 mm ; pose de départ : 70 à 120 mm), 14 sur 35 jusqu'à ±5 (P90 22 mm), 20 sur 35 jusqu'à ±20 (P90 67 mm, maximum 84 mm). Cuts posés recalculés par leurs voisins : 6,2 mm médian (pose propre d'Ariane : 5,0 mm). Les trous de 19 cuts (5976 à 5979) donnent 28 à 84 mm : au-delà de ±5, l'interpolation n'est plus fiable. Règle candidate pour la 5.0 : interpoler seulement si les deux voisins posés sont à ±3 cuts ; ne rien poser au-delà. 15 cuts différés sur 35 restent sans solution (voisins absents ou trop loin). Un seul lot : à confirmer sur d'autres parties avant tout test terrain.

## D-100 - Confirmation de l'interpolation sur un autre lot : partie 20, Écho du 23 septembre (14 octobre 2026)

Lot indépendant (partie 20, version 4.7.6, 238 cuts à pose finale humaine, cuts 109 à 989). Voisins = poses finales humaines. Interpolation entre les deux voisins les plus proches (écart jusqu'à ±3 cuts) : 208 cuts sur 238 couverts, erreur médiane 2,8 mm, P90 7,1 mm, P99 13,9 mm, maximum 152 mm. Pose de départ : médiane 4,9 mm mais P90 115 mm. Même conclusion que D-098 et D-099 : la méthode corrige les grosses erreurs sans abîmer les bonnes poses. Réserve : voisins pris dans les finales humaines ; la classe « posé ou différé par Ariane » n'existe pas pour ce lot (4.7.6). Deux lots concordent ; il reste à tester avec des voisins posés par Ariane sur un deuxième lot 4.9.

## D-101 - Règles métier de validation sauvegardées pour la 5.0 (14 octobre 2026)

Mic a partagé la conversation de formation d'un opérateur (ADV, rouges isolés, passages à niveau, « un vert n'est pas forcément bon »). Sauvegardée dans `fiches/METHODES_METIER_5.0.md`, avec la limite qu'elle impose à D-098 à D-100 : les zones à risque (ADV, PN, voisinage d'un invalide) n'ont pas été séparées dans les mesures, et un voisin posé y peut être faux. Pas de gros travaux avant la 5.0 (décision de Mic). Priorité : terminer la 4.9.

## D-102 - Réponses de Mic du 14 octobre 2026 : B3 dans la 4.9, UX renforcée, accord sur le reste

Décisions de Mic :
1. **B3 (transitions du lot) entre dans la 4.9 finale** (modifie D-095 : B3 n'est plus renvoyé à la 5.0). B2 et l'apprentissage restent en 5.0. Porte du cahier § 10 : décisions inchangées au banc ; reprise, pause, arrêt, F5 inchangés. Chantier confié à une session dédiée (`claude/49-b3-transitions`, base test 12), sans changement de comportement, version distincte de l'UX.
2. **UX** : (a) la tuile du lot du maquette retenu (« Lot », progression en %, nombre de cuts, plage premier → dernier cut, pagination) manque dans le panneau réel ; (b) « Départs des parties » doit avoir plus d'importance et de cohérence (une carte par partie, même langage visuel) ; (c) soin général : clarté, lisibilité, couleurs, thèmes clair et sombre. Confié à la session UX (`claude/ux-variantes`, cible 4.9.0.13), aucune fonction nouvelle.
3. **Accord de Mic sur le reste** de la proposition du même jour : B1 reste en ombre dans la 4.9.0 (une bonne pose retirée, partie 18 cut 5290 ; la pose proposée n'est pas consignée) ; B1 doit consigner la pose qu'il proposerait ; relecture ciblée du moteur V5 ; recalcul de C1 et C3 sur les parties 17 et 18 ; rejeu de l'export allégé sur la partie 17.
4. Rappel : fusion dans `main`, étiquette et publication de la 4.9.0 stable restent à demander à Mic en une ligne, avec l'état complet.

## D-103 - Test 13 (4.9.0.13) livrée : panneau UX validé par Mic (14 octobre 2026)

Branche `claude/ux-variantes`, tête `ff27df0` (version 4.9.0.13 ; `background.js` : seule la chaîne de version de secours). Contenu : grande tuile du lot, cartes « Départs des parties », contrastes WCAG AA, aucun changement de comportement ; Mic a validé les captures. verify 1494 réussis, 0 échec, 2 ignorés. Paquet reconstruit par l'orchestrateur : `ariane-4.9.0-test.13.zip`, SHA-256 `a55f60bb6eb5e23424c45aa31ef4189b42b349c8e68895aee1549f5c0bfbf201` (1 336 170 octets ; celui de la session UX, `f7915e60…`, diffère car les dates des fichiers entrent dans le zip : seul `a55f60bb…` est celui livré). Retour arrière : test 12, `949afdb1…e38e1e`. Écarts avec la maquette : pas de pourcentage tant que la fin de partie est inconnue ; trois points = étapes du cut, pas de pagination. À fusionner avec B3 (`claude/49-b3-transitions`) avant la stable.

## D-104 - B3 livré (14 octobre 2026)

Branche `claude/49-b3-transitions` (base test 12, tête `a41a56e`, 4 commits, version inchangée, panneau et `src/engine.js` non touchés). Neuf transitions nommées (démarrage, pause, reprise, arrêt, rechargement, cut suivant, différé, fin de lot, erreur) dans un coordinateur de `background.js` qui appelle chaque action tout de suite et rend son résultat tel quel ; journal des noms en mémoire seulement, jamais exporté. 9 essais ajoutés (d'abord rouges en caractérisation, attendus jamais modifiés) ; verify : 1 501 essais, 0 échec, 2 sautés (corpus privé absent). Relecture de l'orchestrateur du diff de `background.js` (hors déplacement de « Démarrer », sans modification) : enveloppes fidèles, aucune attente ni effet ajoutés, aucun constat. **Non prouvé** : le banc complet avec corpus (poste de Mic) n'a pas été lancé ; la preuve restante est une séance terrain. Fusion prévue : test 15 = test 14 (UX) + B3, paquet séparé pour pouvoir revenir à la test 14 sans perdre l'UX. Conflit attendu sur `audit/verification.*` : à régénérer après fusion.

## D-105 - Tests 14 et 15 livrées (14 octobre 2026)

Test 14 (4.9.0.14, `claude/ux-variantes` e996262) : correction de la tuile du lot (vert vide en « fin de partie »). Règle : fin connue de la partie, sinon M−1 lu au compteur d'ESV (même partie, source compteur) ; sinon bande animée « fin de partie inconnue », jamais de pourcentage ; le vert garde le plus loin atteint dans le lot. Paquet reconstruit par l'orchestrateur : SHA-256 `8e36e2326cefe5c8c9bc40d617b05aaf8a9ca27feca8bd7fb4a0af3ed98abf72` (retour arrière : test 13, `a55f60bb…bf201`). Cas réel de Mic (partie 23, lot du cut 1, fin factice 999999, compteur relevé une seule fois à 7591 sur 9260) repris en essai, commit 5ad0e83.
Test 15 (4.9.0.15, tête `b9652df`) : test 14 + B3 (fusion `e1b8f6d`, code de B3 inchangé), verify 1 514 réussis, 0 échec, 2 ignorés. Paquet reconstruit : SHA-256 `cdbb6fe9f7d9aa41963499fdfc49485da5a61d74dad5ae000f043f89bcc896ce` (retour arrière : test 14).
Partie 23 de Mic (test 13, 12:01 à 12:48 UTC, arrêtée par lui) : cycle médian 3,07 s (rapide) contre 7,33 s (référence), −58 % ; part posée 75,8 % contre 74,5 % (C1 non dégradé sur trois parties) ; départ 8 599 + 661 = 9 260 ; B1 en ombre : 50 poses ajoutées à juger, 1 pose retirée (cut 2029, garde 16,9 mm) ; B1 reste en ombre.

## D-106 — Test 15 évalué, test 16 livrée (2026-10-15)

- Test 15 (partie 24, lot « fin de partie ») : B3 tient sur le terrain (pause/reprise, F5 en plein lot, arrêt en plein cut, fin de partie) ; 514 cuts invalides traités une fois chacun (409 posés, 105 différés), 0 capture perdue. Cycle rapide 2,65 s contre 5,71 s en référence (−54 %), C1 79,2 % contre 79,6 %. Non couverts : lot à plage fixe, erreur dans l'avis.
- Défauts vus : reprise après « Arrêter » posait la proposition d'avant l'arrêt sans relire les rails (confirmé par essai) ; « Reprendre » après la fin rejouait la fin ; journal B3 absent de l'export.
- 4.9.0.16 (branche `claude/49-test-16`, 6c61bdb ; paquet SHA-256 1d69dff2c58eb337e2a579c01eb44266e64296fc90d4c388f8875627d2c79926) : export en volumes zip autonomes ≤ 17 Mo, historique des départs par partie, sélecteur d'onglet lisible et désambiguïsé, tuile Lot animée (réduire les animations respecté), pluriels, garde-fou rails à la reprise, « Lot déjà terminé », `transitionsLot` exporté. verify : 1 538 réussis, 0 échec, 2 ignorés. `src/engine.js` inchangé.

## D-107 — Test 16 mesurée, test 17 livrée (2026-10-15)

- Test 16 (partie 26, lot sur toute la partie, sans intervention) : 370 invalides traités une fois (311 posés, 59 différés), 0 arrêt, 16,8 min. Cycle rapide 1,69 s contre 5,91 s en référence (−71 %), C1 84,0 % contre 84,6 %. Export en 4 volumes autonomes (13,8 à 15,9 Mo) : le découpage marche ; `transitionsLot` présent.
- Le gain par rapport au test 15 (2,65 s) vient de l'attente de stabilité (0,80 s → 0,03 s par rail : 627 vues lues au signal, 35 au repli 800 ms, contre 445 / 489). Enquête sur le code : aucun changement de la .16 ne touche la capture (`src/adapter-page.js` identique) ; cause attribuée à la page ou partie ESV, à confirmer sur une autre partie.
- 4.9.0.17 (branche `claude/49-test-17`, 9a329b6 ; SHA-256 84dbe34ee0b3291592fbd4d65e09e750fe7142e8d0f86b8473af51f4ca4a6b76) : % de la tuile = invalides traités ÷ invalides de la fiche de départ pour un lot sur toute la partie (« N / M invalides »), position sinon ; heure de Paris dans le panneau et CONTENU.txt (JSON en UTC) ; bornes alignées ; bord lumineux caché sous 1,5 %. verify : 1 553 réussis, 0 échec, 2 ignorés. `src/engine.js` inchangé.

## D-108 — Partie 25 (test 16) : le gain de la partie 26 venait d'ESV (2026-10-15)

- Même code (4.9.0.16), partie 25 : cycle rapide 3,12 s contre 6,00 s en référence (−48 %), C1 81,0 % contre 83,0 % ; stabilité par rail revenue à 0,80 s (353 vues au signal, 461 au repli 800 ms). Confirme D-107 : le 1,69 s de la partie 26 tenait à ESV. Fourchette durable du mode rapide : −48 % à −58 %, jusqu'à −71 % quand ESV signale proprement la fin du chargement.
- 454 cuts sur 485 invalides traités une fois ; pause de sécurité au cut 9228 (« Lecture LiDAR instable, vue non recentrée ») : comportement voulu. Export en 10 volumes (max 15,96 Mo), complet.
- Retour de Mic : « carré, rien à signaler ». Reste à voir sur le terrain avec la 4.9.0.17 : % des invalides, heure de Paris, essais B3 avec interventions.

## D-109 — Test 17 (partie 27) et piste majeure : le signal de fin de chargement s'éteint ~10 min après le chargement de la page ESV (2026-10-15)

- Test 17, partie 27 : lot 1 (cut 0 → 5430, 288 posés, 68 différés), pause de sécurité « LiDAR instable » au cut 5430, reprise, F5 en pleine validation du cut 5440 (adaptateur sans réponse, comme prévu). Mic a ensuite démarré un nouveau lot depuis le cut 535 (premier invalide restant affiché par ESV après F5) : il a revisité les 68 différés du lot 1 (66 re-différés, 2 posés) puis fini la partie ; dernier invalide (9240) validé en place. Cut 5440 posé deux fois (la validation du premier passage avait été coupée par le F5) : sans effet nuisible. CONTENU.txt en heure de Paris : conforme.
- Vitesse : sur toute la séance, rapide 2,51 s contre 5,80 s (−57 %). Lot 2, page ESV fraîche après F5 : 1,72 s (−71 %), 420 vues au signal, 0 au repli 800 ms.
- Piste (signal-age, 5 pages ESV, tests 15 à 17) : pendant les ~10 premières minutes d'une page ESV, la plupart des vues sont lues au signal ; ensuite le signal disparaît (0 lecture au signal) et tout passe au repli 800 ms, sauf une page (1868, partie 26) qui l'a gardé. Un F5 rétablit le signal. Hypothèse : `Potree.numNodesLoading` ne revient plus à 0 au bout d'un moment. Si elle se confirme, garder le signal (ou rafraîchir la page à bon escient) vaut −70 % durable au lieu de −50 %. Chantier candidat pour la 4.9.5, à instruire hors ligne d'abord (consigner `numNodesLoading` et les conditions du signal à chaque repli).

## D-110 — Relecture finale de la 4.9.0 : D1 et D2 corrigés, D3 renvoyé à la 4.9.5, B3 validé sur le terrain, exports non tenus renvoyés (2026-10-15)

- **Relecture finale indépendante** de la version candidate (branche `claude/49-rc`, code de la 4.9.0.17) : aucun défaut de pose, aucune fuite de données, aucune permission nouvelle. Trois défauts relevés.
- **D1, corrigé dans la 4.9.0** : vidage du cache refusé indéfiniment (« la clôture de la mesure V1 du lot n'est pas terminée ») après une fin de lot hors de la boucle du moteur : « Clôturer le résultat incertain », fin de partie après un différé (cas fréquent, KI-067) et SKIP explicite du dernier cut ; « Arrêter » est caché sur ces lots. Correctif (`background.js`, `cloreMesureHorsBoucle`) : la mesure V1 est close à ces trois endroits avec l'état réel du lot, comme pour « Arrêter » hors tâche ; jamais pendant une tâche, jamais deux fois. Essai : `tests/rc490-d1-vidage-fin-hors-boucle.test.cjs` (rouge sans le correctif, vert avec).
- **D2, corrigé dans la 4.9.0** : fiche de départ fausse possible. Le résumé de la question « y a-t-il des invalides ? » d'ESV (`listKey` 'undefined', une ligne) devenait une fiche 0 / 1 / 1, écrite en parallèle et sans verrou : elle pouvait écraser la vraie (7 602 / 137 / 7 739). Correctif (`src/export-cache.js`) : ces résumés sont ignorés (`listKey` 'undefined' ou absent, liste de moins de 2 lignes) et les écritures des fiches sont mises en file. Essai : `tests/rc490-d2-fiche-depart.test.cjs`.
- **Outil hors ligne** (`tools/perf-phases.cjs`) : une version stable à trois nombres (4.9.0, 4.9.5) est rangée après ses versions de test 4.9.0.N : l'état de l'observateur est dit pour les journaux de la 4.9.0 stable.
- **D3, renvoyé à la 4.9.5** : une écriture refusée par ESV (HTTP 500) est quand même comptée comme acceptée. Identique en 4.8.6 ; jamais vu sur 924 écritures observées. Correctif proposé : dans l'enveloppe `adapter.validateAndNext` de `background.js`, attendre l'observation `write` qui suit `validateInESV` (500 ms au plus, dernier essai par `railPairId`) ; réponse non 2xx → erreur → pause « résultat incertain » ; pas d'observation → comportement actuel.
- **B3, quatre derniers essais validés sur le terrain par Mic le 15 octobre avec la 4.9.0.17, sans export** : Arrêter puis Reprendre refusé si les rails ont bougé ; Reprendre après la fin → « Lot déjà terminé » ; lot à plage fixe jusqu'à sa fin ; erreur dans l'avis. Mic confirme aussi la reprise automatique au bon endroit après une mise en veille du PC suivie d'un F5.
- **Exports non tenus (porte, lignes 8b et 8c) : décision de Mic du 15 octobre** : il accepte la 4.9.0 sans « Préparer pour analyse » à zéro différence ni le −40 % de taille ; les deux critères sont renvoyés à la 4.9.5.
- Fusion dans `main`, étiquette et publication : toujours à la décision de Mic.
