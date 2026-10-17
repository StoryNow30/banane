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
- Note du 15 octobre 2026 (D-115) : inexact sur un point, le mode allégé conserve l'intensité des points (D-091).

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
- Correction (D-113) : 2 écritures refusées (HTTP 502) sur ~3 530, relancées par ESV et acceptées en 204 ; voir D-113.

## D-111 — 4.9.0 fusionnée dans main ; 4.9.5 test 1 livrée (2026-10-15)

- Feu vert de Mic (15 octobre) : `claude/49-rc` fusionnée dans main (PR #5, 5444245) après fusion des documents de cadrage du 30/09 présents sur main (code inchangé, verify 1 560 / 0 échec). Paquet final `ariane-v4.9.0.zip`, SHA-256 341a0d0bf4957face8fa072d772ee5e2b72c3af2648c71c6e20fd7a5db75b3ac. L'étiquette `v4.9.0` n'a pas pu être poussée depuis le conteneur (403) : Mic crée l'étiquette et la publication depuis GitHub.
- 4.9.5 test 1 (branche `claude/495-test-1`, 543279d ; SHA-256 2c78f3d1bc12008b7db0c46a571d87443ec1e9a4e6de42296f6a462b67650269) : (A) relevé `diag` à chaque lecture de vue (condition manquante au repli, `numNodesLoading`, âge de la page, compteurs Potree, mémoire), décision de lecture inchangée, ≈ 0,4 % de journal en plus, outil `tools/signal-age.cjs` ; (B) D3 sans attente : écriture de validation non 2xx observée sans 2xx dans les 2 s → événement `ecriture-refusee` et pause au prochain point sûr avec message ; sans observation, comportement 4.9.0. verify 1 580 / 0 échec. Séance demandée : 30 min d'Orbite sans F5, puis un F5 et 10 min.

## D-112 — Réponses de Mic à l'audit Écho ; cadrage 5.0 (15 octobre 2026)

**Cadrage 5.0** : priorités de Mic = (A) poser juste plus souvent, (B) traiter seul les zones difficiles (ADV, PN, voisinage des rouges), (D) apprendre des corrections Écho sans réglage manuel. « Plusieurs sessions, onglets et parties » est **retiré** du cahier. Écho parfait (audit `fiches/AUDIT_ECHO_5.0.md`, branche `claude/echo-audit`) et l'ESV locale comme banc de preuve (`fiches/AUDIT_ESV_LOCALE.md`, branche `claude/esv-locale-audit`) sont **nécessaires en 4.9.5** pour développer la 5.0.

**Réponses de Mic aux demandes de l'audit Écho (§ 4.4)** :
1. Validation en Écho : **Maj+Espace = valider** (sa commande habituelle) ; **Ctrl+Entrée = valider et passer au suivant** ; **Ctrl+flèche avant/arrière = passer au cut suivant/précédent sans valider**. À modéliser dans la maquette ESV locale (relevé à confirmer sur le vrai ESV : les gestionnaires clavier n'ont pas été relevés).
2. Mic ne corrige **que quand Écho est actif** (jamais avant le démarrage, ni pendant une pause, ni après un F5 sans reprise).
3. **Oui** à la reprise automatique d'Écho après un F5 (Écho n'envoie rien à ESV).
4. **Oui** à un signalement de la raison de la correction, **sur l'interface d'Écho** (panneau Ariane), pas dans ESV.
5. **Oui** à l'export Écho en volumes zip de 17 Mo avec CONTENU.txt, comme Orbite.
6. **Oui** à la lecture passive de la liste des coupes à chaque visite (±10 lignes, rien d'écrit).
7. ESV reste en anglais ; un seul onglet ESV pendant Écho.
8. **Oui** à l'instantané du nuage après une grosse correction.
9. Question de Mic : **faire tourner Orbite en même temps qu'une session Écho** (candidat 5.0 ; exige des états séparés par onglet ; en contradiction partielle avec 7 et avec le retrait des multi-onglets : à trancher dans le cahier 5.0).
10. Demande de Mic : **améliorer Écho** (les quatre étapes 4.9.5 de l'audit, puis les chantiers 5.0 : contexte métier, poses comparées, raison, manifeste de corpus).

## D-113 — Première récolte d'idées pour la 5.0 ; correction de D-110 sur les écritures refusées (15 octobre 2026)

- `fiches/IDEES_5.0.md` : 17 idées (causes mesurées des 399 différés des 4 lots 4.9 : flanc absent 29 %, pente 18 %, garde de paire 20 %, paire/ambiguïté 10 % ; angles morts d'ESV : événements jQuery non écoutés, colonnes de liste jetées, appariement cut ↔ ligne établi à 0 mm, SeenByOperator/TreatedByOperator). Deux angles de recherche sur six menés ; les quatre autres arrêtés pour le budget de jetons, relançables.
- **Correction de D-110** : deux écritures de validation refusées (HTTP 502) ont bien eu lieu sur le terrain (partie 25, test 16, cuts 760 et 770) ; ESV a relancé seul et obtenu 204 ; Ariane a accepté les deux sans le voir. Compte juste : 2 refus sur 3 530 écritures observées. Le correctif D3 de la 4.9.5.1 (fenêtre 2 s) tolère cette relance.
- Trois questions posées à Mic (relevé Success*/RailSpacing/RailType ; trace laissée dans ESV ; export d'un relevé de liste).

## D-114 — Idées 5.0 validées ; trace dans ESV ; premier export Écho 4.9.5 ; recherche relancée (15 octobre 2026)

- Mic valide toutes les idées de `fiches/IDEES_5.0.md` (D-113). Les quatre angles de recherche arrêtés (données et apprentissage ; métier et opérateur ; fiabilité, plateforme et banc ; regard extérieur) sont relancés à sa demande ; la synthèse sera fusionnée dans la fiche.
- **Trace dans ESV (exigence de Mic : « exactement la même trace qu'un traitement manuel par un humain »).** Ariane n'écrit rien elle-même sur le serveur : pour valider, elle envoie à la page le raccourci Ctrl+Entrée (`src/adapter-page.js:780`) et c'est ESV qui fait son PUT, comme pour un humain ; pour un cut différé, elle s'y rend puis repart, et c'est ESV qui pose `SeenByOperator`, comme pour un humain qui regarde et passe. Aucune marque distincte d'Ariane : conforme. Seules différences observables : le rythme (régulier, un cut toutes les 3 à 4 s) et le raccourci (Mic valide par Maj+Espace) ; à vérifier au relevé (point suivant) que le corps du PUT est le même pour les deux raccourcis.
- Réponses de Mic : 1) oui au relevé de 2 min des colonnes Success*/RailSpacing/RailType ; 2) aucune marque distincte d'Ariane ; 3) « relevé de liste » à expliquer (lire la liste ESV après la correction manuelle d'une partie et exporter l'écart avec les poses d'Ariane : vérité terrain sans capture).
- **Premier export Écho 4.9.5.1** (5,5 min, 37 visites, 31 validations, 6 passages sans décision) : 26 paires utilisables sur 31 ; 12 rails perdus « référence validée non observée », 8 pour nuage insuffisant ; aucune touche Ctrl utilisée (validation par Maj+Espace uniquement, caméra par W/A/D), donc Ctrl+Entrée et Ctrl+flèche restent à observer ; 36 captures coupées par un changement de clip, 28 par la limite de ressources, 27 sautées après déplacement du rail ; 17 Mo pour 5,5 min.
- Fiches de départ du jour (D-092), avant Orbite : partie 24 : 9 275 cuts, 514 invalides ; partie 26 : 9 184, 370 ; partie 25 : 9 261, 485 ; partie 27 : 9 260, 523.

## D-115 — Seconde récolte d'idées 5.0 : six angles, trois juges, 12 idées retenues (15 octobre 2026)

- Recherche relancée à la demande de Mic et menée à terme (six chercheurs, trois juges, synthèse) ; `fiches/IDEES_5.0.md` remplacé par la note finale (12 idées regroupées sur 56, 19 angles morts d'ESV, 23 idées écartées, 9 questions, socle 4.9.5). Le tableau des différés de la première récolte est gardé en annexe.
- Trois constats transversaux : (1) la liste des coupes d'ESV est une archive exacte des poses (PUT = pose d'Ariane + T, dispersion 0,00 mm ; ligne N = pose de départ du cut N à 0,0 mm sur 100 % des cuts) ; (2) le moteur refuse surtout pour des raisons de modèle (flanc 29 %, pente 17 %, garde de paire 19 %), aucune des trois portes jugée contre la pose humaine depuis D-035/D-044 ; (3) `AUDIT_SUPER_CERVEAU` § 1 décrit l'inverse du code : le delta publié est la graine du gabarit, l'intersection reste dans `metrics.surfaceIntersection`. À corriger.
- Idées de tête : relire la liste après la relecture de Mic (vérité terrain à 100 % sans Écho) ; convention refusée (410 rails posés bruts, biais ~9 mm) et garde de paire (89 différés pour 2 cuts d'origine) ; graine contre intersection ; rail « dessus seul » ; porte de pente ; T calibrée sur la pose de départ et provenance des appuis (77 à 87 % des appuis B1 sont des verts d'extraction) ; ombre GCV1 à chaque visite Écho ; cohérence voisins ; seconde passe utile ; famine de flanc (LOD ou nuage) ; bus jQuery d'ESV ; carte de la partie. Coût total ≈ 35 jours dont ~10 de mesure hors ligne.
- Premier outil à écrire : la jointure Écho ↔ Orbite par cut (AUDIT_ECHO C-03) ; une dizaine de mesures en dépendent.
- Questions déjà répondues : trace dans ESV (aucune marque distincte, D-114) ; relevé console (oui). Sept questions restent ouvertes (bords monde au-delà de D-096 ; D-044 et ré-épinglage ; cuts ADV/PN connus ; visite de verts ; Écho sur une partie 24 à 27 ; reprise automatique bornée ; protocole de relecture).

## D-116 — Cadrage de Mic sur la seconde récolte ; la 4.9.0.20 devient la base d'Écho (15 octobre 2026, soir)

- Mic valide tout, avec une règle : **chaque élément est traité avec le même niveau d'importance**, pas d'ordre de priorité entre les 12 idées.
- **Méthodes métier** (`fiches/METHODES_METIER_5.0.md`) : importance n° 2, voire n° 1, du cahier 5.0.
- **Écho** : la capture parfaite et l'export alignés sont dans la 4.9.5 (outil de collecte) ; l'apprentissage à partir de ces corrections est dans la 5.0. Objectif rappelé par Mic : « arriver avec une 5.0 grave boostée ».
- **Super cerveau et méga cerveau en parallèle** : combler les lacunes du cerveau actuel (portes trop sévères, idées 2 à 5) tout en concevant GCV2.
- **Base Écho : la branche `claude/49-echo-corrections` (4.9.0.18 → 4.9.0.20)**, conçue par la session de l'audit Écho à partir de la 4.9.0.17 : toutes les validations reconnues (Maj+Espace, Ctrl+Entrée, Entrée, bouton), dernière référence, pose de départ avant le premier geste, reprise automatique après F5, écritures ESV jointes au cut par numéro de ligne, export Écho en volumes zip, export Orbite sans données Écho (KI-068) ; vérifiée sur un export de Mic (partie 24, 103 validations = 103 confirmées). On s'appuie dessus, on ne redéveloppe pas. Elle ne contient ni D1/D2 (RC 4.9.0) ni D3 et le diagnostic du signal (4.9.5.1) : essai de fusion local avec `claude/495-test-1` : seuls les libellés de version, le CHANGELOG, l'audit et les tests de version sont en conflit. Proposition : 4.9.5 test 2 = 4.9.0.20 + 4.9.5.1.
- Conséquence : l'export Écho 4.9.5.1 reçu aujourd'hui (D-114) a été fait sans ces corrections ; les 12 rails « référence validée non observée » et les touches non reconnues sont déjà traités par la .20. Les lots Écho à venir doivent être faits avec la .20 (ou la 4.9.5 test 2).

## D-117 — Cahier des charges 5.0 (v1) et organisation du développement soumis à Mic ; 4.9.5 test 2 lancée (15 octobre 2026, soir)

- « Go » de Mic pour la **4.9.5 test 2** = 4.9.0.20 (corrections Écho) + 4.9.5.1 (D3, diagnostic du signal) ; confiée à un agent de niveau rapide (worktree, branche `claude/495-test-2`, verify, paquet, consigne).
- `BANANE_5.0_CAHIER.md` (v1, ~3 900 mots) : objectifs A/B/D mesurables ; règles non négociables de la 4.9 + trace identique à un humain, Écho passif, trois états (hors ligne → ombre → actif, 0 mauvaise pose ajoutée), manifeste DEV/RÉSERVÉ ; socle 4.9.5 (S1 à S8) avec porte ; cinq lots de chantiers de même importance (M méthodes métier, P poser juste, E Écho et données, G méga cerveau, F fiabilité), chacun avec porte de sortie et coût ; portes de version ; 9 questions ; plan en 9 phases (≈ 95 jours d'agent). Statut : projet, signé quand Mic écrit « signé ».
- `fiches/ORGANISATION_DEV_5.0.md` : niveaux de modèle par coût (éclair 1, rapide 20, fort 40, le plus fort 100), effort par tâche, rôles (orchestrateur, développeur, relecteur, mesureur, juges), table niveau ↔ tâche du cahier, lecture de l'outil « advisor » de l'API (exécuteur rapide + conseiller fort aux trois moments : brief, blocage, fin ; pas disponible dans Claude Code, mais c'est notre façon de travailler rendue systématique), dix règles d'économie de jetons, sept règles pour la fenêtre de 5 h (lourd en début de fenêtre, un agent lourd à la fois, suivi écrit, reprise automatique à la réinitialisation, sessions distantes, 20 % réservés à l'analyse des exports), cycle type d'un chantier, ce que Mic décide (proposition : 60 % de fenêtre sans demander).

## D-118 — 4.9.5 test 2 livrée (15 octobre 2026, soir)

- Branche `claude/495-test-2` : fusion `--no-ff` 7caf929 de la 4.9.0.20 (corrections Écho) et de la 4.9.5.1 (D3, diagnostic du signal), puis b436040 (consigne : Ctrl+flèche = passage sans validation, D-112). Conflits résolus sur les seuls libellés de version, le CHANGELOG (les deux séries gardées), l'audit régénéré et un test de version unique `tests/version-4952.test.cjs`. `src/engine.js` identique à main (baseline V4.6.0 confirmée par verify). verify : 1 604 réussis, 0 échec, 2 ignorés (corpus privé absent).
- Paquet `ariane-4.9.5-test.2.zip`, 1 522 686 octets, SHA-256 `65288703cc9fe0d07a3568fb97a750449b24e8c67c4d54bd78e7a8a14904f38a`, un seul manifeste à la racine (4.9.5.2 / « 4.9.5 test 2 »), consigne `consignes/seance-terrain-4.9.5-test-2-2026-10-15.md` incluse. Fait par un agent de niveau rapide (≈ 112 000 jetons, 13 min) : premier chantier mené selon `fiches/ORGANISATION_DEV_5.0.md`.
- Hygiène à traiter en S8 : des fichiers hérités des branches d'origine (`consignes/demarrage-session-49.md`, un passage du CHANGELOG) citent un nom de modèle ; à retirer.

## D-119 — Cahier 5.0 signé par Mic ; plan détaillé ; développement autonome lancé (15 octobre 2026, soir)

- Mic : « Signé ». `BANANE_5.0_CAHIER.md` v1 est le cahier de référence de la 5.0 ; les décisions ultérieures le complètent dans ce fichier sans le réécrire. Les neuf questions du § 7 restent ouvertes ; l'orchestrateur les a reposées avec une réponse proposée pour chacune.
- `fiches/PLAN_5.0.md` : tableau de bord des chantiers (branche, niveau et effort, entrées, livrables, porte, jetons estimés, état) et ordre de lancement en huit vagues ; budget estimé ≈ 17 M de jetons au niveau rapide + 2,5 M de relectures fortes, lissé sur six à huit semaines de terrain.
- Mic autorise le lancement autonome « selon les articles » : l'orchestrateur applique `fiches/ORGANISATION_DEV_5.0.md` (niveaux, un agent lourd à la fois, 60 % d'une fenêtre sans demander, reprise programmée après la limite). Vague V0 lancée ce soir : S3 (jointure Écho ↔ Orbite, niveau rapide) et S8 (documents, niveau éclair).

## D-120 — S8 livré ; paquet 4.9.5 test 2 reconstruit (consigne) (15 octobre 2026, nuit)

- S8 (`claude/50-s8-docs`, 86dd817 puis 80299de) : AUDIT_SUPER_CERVEAU § 1 corrigé (le moteur publie l'amorce du gabarit, pas l'intersection), FICHE_B1 constat 3 dépassé, noms de modèles hérités remplacés par des niveaux dans six documents ; `DECISIONS.md` retiré de la branche (ses deux notes sont reportées ici : D-079, D-110). Niveau éclair, ≈ 105 000 jetons.
- Défaut trouvé par S8 : l'essai de consigne de la 4.9.5 test 2 échouait depuis b436040 (libellé « Ctrl+flèche » reformulé). Corrigé en 5c775b7 ; paquet reconstruit : `ariane-4.9.5-test.2.zip`, 1 522 687 octets, SHA-256 `f48cb48c9009405c27c2bb4a8a6acf886e6d17e9ecbab02b28fa4457a51adba9`. Seule la consigne change entre les deux paquets ; le code est identique.
- Leçon pour l'organisation : un chantier mécanique a servi de relecture gratuite du chantier précédent ; verify complet (15 min) est à lancer une fois par livraison, pas par chantier de documents.

## D-121 — S3 livré : jointure Écho ↔ Orbite ; première mesure des faux verts (15 octobre 2026, nuit)

- `claude/50-s3-jointure` (5aa2ccb) : `tools/jointure-echo-orbite.cjs`, essai sur fixture synthétique, `fiches/JOINTURE_ECHO_ORBITE.md`. verify 1 613 réussis, 0 échec, 2 ignorés ; rien sous `src/`. Niveau rapide, ≈ 196 000 jetons, 21 min. Écart au prototype `cmp.cjs` : identique sur les différés, +1 à +4 cuts sur les posés et hors journal (l'outil garde la dernière validation quand une visite sans validation suit, le prototype les perdait).
- **Partie 17 (Écho du 14 octobre joint au lot Orbite)** : 266 des 268 cuts du journal joints. Cuts posés par Ariane avec référence humaine : 192 ; écart 3D à la pose de Mic : médiane 5,0 mm, P90 11,1, max 20,0 ; **47 cuts corrigés de plus de 10 mm (24 %)**, 132 de plus de 5 mm ; la correction est surtout verticale (médiane 3,6 mm vertical, 1,1 latéral), ce qui rejoint l'idée 2 (convention refusée, biais vertical ~9 mm). Différés : 35, médiane 43 mm (pose de départ = gabarit). **Cuts visités par Mic hors journal d'Ariane** (verts d'extraction et autres) : 372 avec référence, médiane 5,3 mm, **126 corrigés de plus de 10 mm (34 %)** : première mesure du « un vert n'est pas forcément juste ».
- Partie 24 (Écho de 5 min) : 10 cuts joints, effectifs trop faibles.
- Constat utile : l'Écho et le journal n'ont pas la même origine de scène, translation constante estimée par l'outil ; résidu 0,0 mm sur les deux parties.
- Manques pour P0 (à prévoir dans S6 ou dans le rejeu) : pas de grandeur « intersection » dans le journal (seulement `uSeed`, `uMedian`, `zMedian`), convention réduite à un booléen dans la table (le journal a `convention.dzMm`), `slopeLimited` booléen sans pente brute. P0 (a) et (c) passeront par le rejeu de `Candidate.propose` sur le corpus GCV1, pas par le journal. Échos 18 et 20 à joindre à leur tour.

## D-122 — Réponses de Mic aux neuf questions du cahier 5.0 (15 octobre 2026, nuit)

1. **Oui** : Ariane garde localement, par partie, les bords qu'elle a écrits et exporte un instantané compact de la liste (dans les zips de Mic seulement). Lève la réserve de D-096 pour ce seul usage. Débloque E1 étape 2, M2, M4 (2).
2. **Oui** (« top ») : D-044 et le ré-épinglage du moteur de géométrie peuvent être touchés si les mesures P0 le justifient, avec rejeu des quatre lots. Débloque P1, P2.
3. **Oui** aux numéros de cuts d'un ADV et d'un PN connus : à recevoir de Mic (partie dont l'export est disponible).
4. **Oui** : Ariane peut visiter des cuts verts en lecture seule, autour d'un rouge, jamais en Écho (M5).
5. **Oui** à un Écho sur une partie 24 à 27 : Mic rappelle qu'il existe déjà (Écho de la partie 24 fait avec les tests 19/20, 124 visites, 103 validations, reçu par la session de l'audit Écho). À rapatrier dans cette session (Mic renvoie les volumes) pour juger les 241 décisions hypothétiques de B1 (S3 joint déjà la partie 24 : 10 cuts seulement avec l'Écho de 5 min).
6. **Oui** à la reprise automatique bornée (F3) : liste blanche, trois par lot, visible dans le panneau. Modifie D-058.
7. **Oui** : Mic relit tous les cuts posés par Ariane ; « inchangé » vaut donc « confirmé » dans E1.
8. Orbite et Écho en même temps : Mic demande pourquoi « non en 5.0 ». Réponse de l'orchestrateur : dans un même profil Chrome, Ariane a un seul état et un seul observateur ; Orbite envoie des commandes qu'Écho prendrait pour des gestes humains, et D-112 point 7 impose un seul onglet pendant Écho ; les séparer exige des états par onglet, c'est le multi-onglets retiré. **Mais c'est possible dès aujourd'hui sans développement** avec deux profils Chrome (ou Chrome et Edge) : chaque profil a sa propre Ariane, son état, ses exports ; Orbite dans l'un, Écho dans l'autre, sur deux parties différentes. À vérifier une fois au banc (aucune interférence côté serveur attendue : parties distinctes). Reste hors 5.0 dans un même profil.
9. **Marges ADV : 20 cuts** avant la pointe d'aiguille et après la fin de l'appareil (M3).
- Conséquence sur le plan : les vagues V4 et V5 n'attendent plus que les mesures ; seuls les numéros de cuts ADV/PN (Q3) et les volumes de l'Écho partie 24 (Q5) restent à recevoir.

## D-123 — Chaque vague testée sur un second projet ESV (15 octobre 2026, nuit)

Demande de Mic : « Il faudra tester la vague V0 sur un autre projet également. » Règle ajoutée au plan : toute vague (outils, relevés, poses) est rejouée sur un **second projet ESV** avant d'être tenue pour acquise. Tous les exports disponibles à ce jour (parties 7 à 27, Échos 17, 20, 24) viennent d'un même projet ; les résultats de la jointure (D-121) valent donc pour ce projet seul. Il faut de Mic : un lot Orbite (4.9.5 test 2) et un Écho sur une partie d'un autre projet, avec le relevé des cuts ADV/PN s'il y en a.

## D-124 — Mode autonome pendant l'absence de Mic ; base 5.0 ; vague V1 lancée (15 octobre 2026, nuit)

- Mic : « avance sur tous les projets que tu peux avancer et relance automatiquement une session chaque fois après la limite de 5 h ; programme la prochaine dans 1 h 35 et ainsi de suite ». Protocole écrit dans `fiches/REPRISE_AUTONOME.md` (réveil suivant programmé en premier, recueil, relance, lancement, 60 % de fenêtre, compte rendu, conditions d'arrêt). Premier réveil : 23 h 14 UTC.
- Session orchestratrice passée au niveau fort (modèle changé par Mic) ; règles de `fiches/ORGANISATION_DEV_5.0.md` inchangées.
- Branche `claude/50-base` = 4.9.5 test 2 + S3 + S8 (essais ciblés verts, moteur inchangé) : base de tous les chantiers 5.0.
- Vague V1 lancée : S6+S7 (relevés en lecture seule et repli `phase-timing`, → 4.9.5 test 3) et E1 (instantané de liste, `diff-liste`, puis mémoire locale des bords, Q1 = oui).

## D-125 — E1 livré (relire la liste ESV) ; M6 lancé (15 octobre 2026, nuit)

- `claude/50-e1-liste` (6323954), intégré à `claude/50-base` (17d7579) : instantané compact de la liste à chaque chargement complet (326 Ko brut, 106 Ko zippé pour 9 000 lignes) exporté dans les volumes Orbite et Écho ; `tools/diff-liste.cjs` (deux instantanés, ou instantané contre les écritures d'un journal) ; `src/liste-memoire.js` : mémoire par partie des bords écrits par Ariane (≈ 100 octets par cut), événement `ecart-liste` et compteur « corrections constatées » au démarrage d'une séance sur une partie connue (Q1 = oui). verify 1 623 réussis, 0 échec. Niveau rapide, ≈ 170 000 jetons, 10 min.
- Rejeu sur un journal réel (test 17) : 418 validations exploitables lues ; décalages injectés retrouvés exactement. Pas encore d'instantané réel : il en faudra un au terrain.
- Protocole pour Mic (dans `fiches/E1_LISTE.md`) : relire la partie, F5, démarrer une séance Ariane sur la partie, exporter. Limites : la mémoire ne voit que les écritures d'un lot en cours (pas la pause ni Écho) ; un autre opérateur ou une ré-extraction change aussi des lignes.
- Chantier léger suivant lancé : M6 outil (`coherence-voisins.cjs`, liste « à relire »).

## D-126 — M6 outil livré : la liste « à relire » n'atteint pas la cible ; le calage de convention refusé est le meilleur indice (15 octobre 2026, nuit)

- `claude/50-m6-relire` (9ed71cf), intégré à `claude/50-base` : `tools/coherence-voisins.cjs`, essai, `fiches/M6_A_RELIRE.md`. verify 1 631 réussis, 0 échec. Retrouve la mesure de l'idée 8 sur le test 15 (latéral 1,8/4,4/12,2 mm ; vertical 3,0/9,5/34,2 ; zone de 12 cuts). Ajout utile : les voisins d'un autre cadre (après F5) sont écartés, sinon 934 mm d'écart fictif.
- **Jugé sur la vérité terrain (partie 17, 47 poses corrigées de plus de 10 mm par Mic)** : à 5 % des cuts posés, le score n'en retient que 10,6 % ; il faut 30 % des cuts pour en retenir 60 % (AUC 0,71). **Porte du cahier (≥ 60 % dans ≤ 5 %) non atteinte.** Causes : corrections de Mic petites (médiane 5 mm) et surtout verticales ; les voisins d'Ariane portent le même biais vertical ; la moitié des cuts posés n'a pas de voisins posés à ±3.
- **Résultat le plus utile** : quand le calage de convention est refusé, **38 %** des cuts posés sont corrigés de plus de 10 mm par Mic, contre **12 %** quand il est appliqué (meilleur terme du score, AUC 0,70). Cela confirme l'idée 2 : le chantier P0(b)/P1 (convention refusée, biais ~9 mm) est le premier levier de justesse.
- Décision : le panneau « à relire » (M6 étape 2) est suspendu jusqu'à ce que P1 et E2 aient changé la donne ; P0(b) avance en tête de la vague V2.

## D-127 — 4.9.5 test 3 livrée (S6 relevés, S7 export allégé, logo) et intégrée à la base 5.0 (15 octobre 2026, nuit)

- `claude/495-test-3` (730ac7b), version 4.9.5.3. **S6** : 12 relevés en lecture seule, chacun derrière un réglage actif par défaut (ressources Potree, `flushPct` à chaque cut, profondeur et budget de capture, noms des champs de la liste, compteur bloqué, avis `fetch-rails`, empreinte du contrat ESV à « Connecter », écouteurs jQuery en ombre, T de départ, revisite d'un différé, audit serveur, en-tête machine). **S7** : jalons `phase-timing` repliés par visite à l'export du panneau ; journal réel −35,7 % (gzip −46 %), cible −40 % presque atteinte ; perf-v3 et perf-phases donnent les mêmes chiffres sur l'ancien et le replié. **Logo** « La voie » (choix de Mic, commit a426771 d'une autre session) déclaré dans le manifeste.
- verify : 1 663 essais, 0 échec, 2 ignorés ; moteur inchangé. Paquet `ariane-4.9.5-test.3.zip`, 1 585 386 octets, SHA-256 `b6d2928eb88762ff43985b7cae6dd23cd2e9b88abcea8785e2031aab728b282d`, envoyé à Mic.
- Doutes à lever au terrain : l'empreinte inclut le nombre d'écouteurs jQuery (fausse alerte possible si ESV en ajoute légitimement) ; `responseStatus` vaut 0 sans `Timing-Allow-Origin` (échecs possiblement surcomptés ; statuts bruts consignés) ; relevés 5, 8, 10 et l'audit essayés sur ESV simulé seulement.
- Intégré à `claude/50-base` (d27ea7b) : conflits panel.html et settings.js ; le banc `perf-production` traitait la lecture `liste-instantane` d'E1 (mémoire de la page, sans requête ESV) comme une commande ESV, corrigé dans le banc. verify 1 681, 0 échec. La test 3 ne contient pas E1 ni M6 (base antérieure) : ils viendront avec le prochain numéro de test.

## D-128 — E5 livré : jeu d'apprentissage v1 et métriques par version (16 octobre 2026, nuit)

- `claude/50-e5-metriques` (6f5fd3a), intégré à `claude/50-base` (avance rapide) : `tools/jeu-apprentissage.cjs` (format `ariane-jeu-apprentissage-v1`, JSON lignes, un cut joint par ligne : traits d'Ariane, étiquette de Mic, qualité de la référence ; sans coordonnée absolue par défaut ; voisinage limité aux cuts de numéro inférieur, aucun trait tiré de la référence de Mic), `tools/metriques-version.cjs` (lisible + JSON ; mode `--journal-seul`), essai, `fiches/E5_METRIQUES.md`. verify 1 688 réussis, 0 échec. Niveau rapide, ≈ 168 000 jetons, 11 min.
- Partie 17 retrouvée à l'identique de D-121 : 192 posés avec référence, 47 corrigés > 10 mm (24,5 %), 132 > 5 mm, écart 3D 5,0 / 11,1 / 20,0 mm. Faux verts entre 20,3 % (borne basse, 47/232 posés : 38 posés sans validation de Mic observée) et 24,5 %. Différés 35/268 (13,1 %). Débit 811 cuts/h en mode rapide.
- Limites : un seul Écho exploitable (partie 17) ; zone, raison de correction, grandeurs P0 et manifeste absents des données ; « 0 mauvaise pose ajoutée » demande un rejeu de deux versions sur les mêmes cuts ; un total sur plusieurs versions est refusé sans `--version`.

## D-129 — P0 livré : plafonner le calage de convention à 8 mm ; ne toucher ni à la garde de paire, ni à l'estimateur, ni à la pente (16 octobre 2026, nuit)

- `claude/50-p0-mesures` (76c4052), intégré à `claude/50-base` (d3c19be) : `tools/p0-commun.cjs`, `p0b-convention.cjs`, `p0a-estimateurs.cjs`, `p0c-pente.cjs`, essai (11 cas), `fiches/P0_MESURES.md`. Rien sous `src/`. verify 1 690 réussis, 0 échec. Niveau rapide, ≈ 486 000 jetons, 50 min.
- **(b) Convention refusée** (partie 17) : les rails refusés sont posés bruts avec un biais vertical réel de −6,5 mm (n = 98) ; le « 9 mm » du cahier est le décalage prédit, la convention exagère d'un tiers au-delà de ~6 mm. Rails corrigés > 10 mm par Mic : 35/98 aujourd'hui, **10 avec un décalage plafonné à 8 mm**, 15 avec calage plein ; rails calés : 18/277. Cuts posés corrigés > 10 mm : **47 → 25 sur 188** avec le plafond (25 gagnés, 3 perdus) ; > 5 mm : 128 → 110. Domaine porté à 12 mm : moins bon (28, 7 perdus).
- **(b) Garde de paire** : sur 12 cuts 'pair-guard' avec pose de Mic, 4 à 5 seraient posés à > 10 mm sans la garde ; aucune variante ne récupère sans mauvaise pose. La porte « ≥ 50/89 » est atteignable en nombre (83 avec le domaine à 12 mm), pas en justesse. **Recommandation : ne pas changer.**
- **(a)** La graine reste la meilleure (6,4 mm médian, contre 8,4 pour l'intersection et 6,7 pour la moyenne, partie 17 ; égalité sur la partie 20) ; aucune classe de flanc ne change le gagnant ; |graine − intersection| inutile pour M6 (AUC 0,55). **Ne pas changer** ; corriger AUDIT_SUPER_CERVEAU § 1.
- **(c)** Rails appliqués à pente 0,3–0,5 : 19 % corrigés > 10 mm contre 10 % sous 0,3 ; lever la borne poserait 2 cuts sur 8 à > 10 mm. **Ne pas changer** ; P2 n'est pas lancé.
- Conséquence sur le plan : **P1 se réduit au plafond de 8 mm** (le reste du décalage consigné). Q2 (D-122) permet de toucher D-044 si P0 le justifie : c'est le cas. Développement sur branche, porte : rejeu des quatre lots au banc sans régression ; **activation au terrain seulement avec Mic**.
- Limites : Écho 18 introuvable, Écho 24 long absent, aucun cut de PN connu (Q3), un seul projet ; peu de poses de Mic sur les cas 'pair-guard' (ordres de grandeur) ; simulation statique (appuis voisins non rejoués).

## D-130 — P1 codé : plafond de convention à 8 mm, coupé par défaut ; activation à décider avec Mic (16 octobre 2026, matin)

- `claude/50-p1-convention` (ce93d40, 5b2598b), intégré à `claude/50-base` (b6aed57) ; AUDIT_SUPER_CERVEAU § 1 corrigé d'après P0(a) (1c6ae32). `src/placement-convention.js` (+ plafond : décalage appliqué à 8 mm au plus par axe, dans son signe ; `capped`, `capMm`, `applied*`, `rest*` consignés ; motif `shift-out-of-domain` conservé pour que la garde de paire D-044 lise toujours le rail) et `src/settings.js` (`conventionPlafond = false`). `src/engine.js`, géométrie et `lot-decision.js` inchangés. Réglage coupé : résultat identique octet pour octet sur 151 cas figés. verify 1 713 réussis, 0 échec ; épinglages intacts. Outil `tools/p1-plafond.cjs`, fiche `fiches/P1_CONVENTION.md`. Niveau rapide, ≈ 290 000 jetons, 39 min.
- **Rejeu avec le vrai code** (six lots, 2 263 cuts ; parité avec la décision consignée 2 262/2 263) : partie 17 avec l'Écho, cuts posés corrigés > 10 mm par Mic **47 → 25 sur 188** (25 gagnés, 3 perdus), > 5 mm 128 → 110, médiane 7,05 → 5,76 mm, P90 12,69 → 10,87. Posés 1 846 → 1 854, différés 417 → 409 (11 différés deviennent posés, 3 posés deviennent différés).
- **Portes non tenues, donc pas d'activation en l'état** :
  1. « Aucune pose nouvelle hors des rails refusés » : 8 des 11 nouveaux posés n'ont pas de rail refusé (ricochet : les appuis voisins bougent de quelques mm). Le seul jugeable avec la pose de Mic est faux de 29 mm.
  2. Un cut de passage à niveau 'pair-guard' (partie 27) échappe à la garde : le décalage latéral plafonné sort l'écartement du contrat, puis le repli du passage à niveau le pose. 1 cut sur 104, mais c'est exactement le genre de pose que la garde doit empêcher.
  3. Le journal compact (`gcv1-shadow.js`) ne reprend pas `capped`/`rest*`.
- Suite proposée (avant toute activation) : variante qui n'applique le plafond qu'à l'axe vertical (le biais mesuré est vertical) et laisse le latéral refusé, ce qui devrait supprimer le cas du passage à niveau et réduire le ricochet ; puis rejeu identique. Activation : seulement avec Mic, après lecture d'un lot réel.

## D-131 — P1 bis (plafond vertical) : même gain, mais ne règle ni le passage à niveau ni le ricochet ; P1 ter lancé (16 octobre 2026, matin)

- Mic : « pas besoin d'attendre le prochain réveil, go ». Le réveil automatique de 11 h 26 est annulé : Mic a repris la main, le protocole autonome s'arrête.
- `claude/50-p1-vertical` (e1e851f), intégré à `claude/50-base` (avance rapide) : `conventionPlafond = false | 'vertical' | true` ; `gcv1-shadow.js` reprend `capped`, `capMm`, `capAxes`, `applied*`, `rest*` dans le journal compact, seulement quand le plafond a joué. Défaut `false`, identique octet pour octet. verify 1 723 réussis, 0 échec ; épinglages intacts.
- Rejeu (six lots) : le mode vertical donne exactement le même résultat que les deux axes (partie 17 : 47 → 25 au-delà de 10 mm ; 11 posés en plus, dont 8 par ricochet, et 3 en moins).
- **Ma prévision était fausse** : le cut 'pair-guard' de passage à niveau de la partie 27 échappe toujours à la garde. En mode vertical, le du du rail (−1,9 mm, dans le domaine) est appliqué en entier alors qu'il ne l'était pas avant, et l'écartement prédit tombe sous le plancher de 1 420 mm. Le ricochet vient des appuis dont dz a bougé de 8 mm, pas du latéral.
- Lancé : **P1 ter `'hauteur'`** (dz plafonné seul, du = 0, latéral strictement comme aujourd'hui), rejeu en quatre colonnes, et analyse chiffrée d'une garde contre le ricochet dans `lot-decision.js` (proposition seulement, non codée).

## D-132 — Réponses de Mic du 16 octobre au matin ; archivage des exports bloqué tant que banane-data est public (16 octobre 2026)

- Séance 4.9.5 test 3 : Mic commence par là. Exports de la test 2 : à venir si encore disponibles. Écho partie 24 long (Q5) : probablement perdu.
- Q3 : Mic signalera l'entrée en aiguillage et la marge avant et après.
- D-123 : changement de projet ESV aujourd'hui, donc un second projet arrive.
- **Q8 précisée** : Mic n'utilise que Google Chrome, dans un seul profil, en plusieurs fenêtres. Exemple : un lot Orbite dans une fenêtre, une correction manuelle d'une autre partie dans une autre fenêtre au premier plan. Changer d'onglet dans la même fenêtre arrête Ariane. L'Écho ne peut donc pas observer cette correction pendant le lot ; ce serait possible avec un second profil Chrome, à proposer sans imposer.
- Version de test avec le plafond de convention activé : **accord de Mic**, après le choix de variante (P1 ter), pour un lot qu'il relira entièrement.
- **Archivage des exports** : Mic demande de les archiver dans banane-data dès réception. La tentative est **refusée par le contrôle de sécurité de la session** : publier des exports bruts dans un dépôt public est traité comme une fuite de données. banane-data est public par choix du propriétaire (README, 23/09), mais rien n'a été archivé depuis le 29/09. **À trancher par Mic** : rendre banane-data privé, ou créer un dépôt privé d'archives. Je n'archive rien et je ne contourne pas ce refus en attendant.
- ESV local (maquette, `claude/esv-locale-audit`) : la maquette est bouclée (rejeux 4.9.0.15 et 4.8.6 identiques au terrain cut par cut, campagne de pannes faite). Il reste à l'intégrer à verify : **S4 lancé** (`claude/50-s4-banc`).
- Suite le 16/10 : Mic maintient banane-data public, et sa direction ordonne d'y publier les exports. Une nouvelle tentative, avec cette autorisation écrite, est encore refusée par le contrôle automatique de la session (mode Auto). Je ne contourne pas le refus. Deux voies : Mic passe la session en mode « Accept edits » le temps de l'archivage et approuve chaque commande ; ou il dépose les archives lui-même avec GitHub Desktop (voie du 23/09), et j'écris les manifests et l'index.

## D-133 — Exports reçus archivés dans banane-data ; réflexe d'archivage à chaque réception (16 octobre 2026)

- Mic a passé la session en « Accept edits » et approuvé chaque commande. 11 collectes sont créées dans `banane-data` (branche `claude/execute-prompt-00-18ra5a`, commits 5c2b50c, 73d4dfd et 9223d33), avec 87 volumes, environ 1,6 Go, du 7 au 15 octobre :
  - Ariane 4.9.0.2 : lots p7 et p10 ;
  - 4.9.0.3 et 4.9.0.4 : lots p3 et p5 ;
  - 4.9.0.8 : lots p7 à p10 ;
  - 4.9.0.9 : lots p1, p13 et p15 ;
  - 4.9.0.12 : lots p17 et p18, et **Écho p17** ;
  - 4.9.0.13 : lot p23 ;
  - 4.9.0.15 : lot p24 ;
  - 4.9.0.16 et 4.9.0.17 : lots p25 à p27 ;
  - 4.9.5.1 : segment 1 d'un Écho.
- Chaque volume est déposé tel qu'envoyé (zip ou 7z d'origine, intégrité contrôlée par réassemblage), avec un `SHA256SUMS`, un `NOTES.md` par collecte et une ligne dans `INDEX.md`.
- Non archivés, par prudence : le paquet de passation du 04/10 (documents de travail, pas un export), la capture réseau ESV du 05/10 (HAR, même nettoyée), et les captures d'écran. À déposer si Mic le demande.
- Disque : environ 3,4 Go de fichiers temporaires d'essais supprimés dans `/tmp` pour faire la place.
- **Réflexe désormais** : tout export reçu de Mic est archivé dans `banane-data` dès réception, avec la même procédure. En mode Auto, le contrôle automatique refuse cette publication : il faudra repasser en « Accept edits » le temps du dépôt. La branche `claude/execute-prompt-00-18ra5a` de banane-data n'est pas fusionnée dans `main` : à faire avec l'accord de Mic.

## D-134 — Partie 29 (4.9.5 test 3, Écho soigné de Mic) et partie 12 (opérateur débutant) analysées (16 octobre 2026)

- Exports archivés dans banane-data (bf6a3cc, 95cd4a5, 9f44b87). Analyses hors ligne dans le scratchpad (`p29/RAPPORT.md`, `p12/RAPPORT.md`, `jeu-p29.jsonl`, `jeu-p12.jsonl`), sans commit.
- **Partie 29** :
  - **Faux verts** : 7/192 posés corrigés de plus de 10 mm (3,6 %), contre 24,5 % sur la partie 17. Écart 3D par rail : 3,4 / 7,3 / 19,8 mm. Différés : 34/245. Débit : 1 361 cuts/h. La baisse n'est **pas attribuable** à la version : les verts d'extraction baissent aussi de moitié, et partie, version et soin de la relecture varient ensemble.
  - **Convention refusée** : 22/418 rails (5 %), contre 23 % sur la partie 17.
  - **Plafond P1** : gain nul ou négatif (tous étages 6 → 7). Un ricochet jugé faux : cut 305, de 5,5 à 16,2 mm. Un autre dans un PN : cut 1660, de 7,8 à 10,5 mm. → **P1 ne sera pas activé ; une suite éventuelle passe par une garde contre le ricochet dans `lot-decision.js`, pas par une variante d'axe.**
  - **Méthode métier** : les poses fausses d'Orbite ne se concentrent pas dans les PN et ADV (1/37 en zone, 6/164 hors zone). Les verts d'extraction faux se concentrent près des rouges : 18 à 27 % à 1–3 cuts d'un rouge, 51 % entre les rouges d'une grappe, 1,4 % à plus de 10 cuts. Autour d'une aiguille, les gros écarts tiennent dans environ −5 à +8 cuts. Après la sortie d'un PN, 5/17 cuts dépassent 10 mm, contre 2/13 avant l'entrée.
- **Relevés S6 sur le vrai ESV** :
  - Ressources Potree : 2 450, toutes en statut 200, 0 échec, aucun statut 0. Le doute de D-127 est levé.
  - `flushPct` ≥ 50 sur exactement 22 cuts, tous dans les PN, sans faux positif : **indice de PN pour M1**.
  - `tDepart` à 0,0 mm de la T actuelle (243 cuts).
  - `esv-event` concorde à 100 % avec les validations de Mic (725/725).
  - Journal replié −35 %.
  - `list-fields` et `audit-serveur` sont vides parce que la liste est lue avant la séance. De plus, l'export Écho ne garde pas `audit-serveur` (pas de `nativeSessionId`).
- **F5 en Écho** : aucune donnée perdue, mais trois défauts cumulés. La reprise part à 0,35 s, avant le chargement de la liste ESV. La reprise automatique n'existe qu'en séance. Chaque démarrage raté crée une période fantôme (six en 8 s). À corriger avant de redemander un F5 ; protocole de reproduction proposé pour la maquette.
- **Défauts d'outil** : `jointure-echo-orbite.cjs` mélange deux sessions Écho (`visitIndex` repart de 0) et ignore les fichiers `ariane-echo-*` en mode dossier ; `perf-phases.cjs` ignore les relevés S6. Les jointures d'Échos multi-sessions sont à revérifier.
- **Partie 12** (Mic corrige un opérateur débutant, 107 cuts) :
  - 47 % de cuts non touchés, contre 8 à 19 % chez Ariane, et seulement 4 % de retouches entre 5 et 10 mm. Mais **28 erreurs de 25 à 45 mm**, presque toutes sur le rail droit (environ +34 mm latéral, −14 mm vertical) ; Ariane n'en a aucune de cette taille sur les parties 17, 24 et 29.
  - Le grain fin de Mic (2 à 4 mm, surtout vertical) est le même pour les deux ; il remonte le débutant de +2,2 mm, mais descend Ariane de −2 mm sur la partie 29.
  - Parcours : ordre croissant, sans trou, environ 1,6 s par cut.
- **Règle « visité sans action = bon »** : sans effet sur les faux verts d'Orbite. Les survols sont très courts (0,65 s en médiane) : proposer à Mic une durée minimale d'environ 1 s, nuage chargé.

## D-135 — Partie 13 (partie humaine corrigée par Mic) : la signature des 30–40 mm confirmée, l'écartement la détecte parfaitement (16 octobre 2026)

- 223 cuts : 66,8 % non touchés ; 11,7 % à 25 mm ou plus (26 cuts, dont 25 sur le rail droit, +30,9 mm latéral, −13,3 mm vertical, 3D de 25,8 à 39,3 mm). C'est la même signature qu'en partie 12, absente des poses d'Ariane (parties 17, 24, 29). Même opérateur ou même méthode de pose : compatible, mais non prouvé.
- **Écartement de la pose de départ à plus de 10 mm de sa médiane : 54 « mauvais objets » humains repérés sur 54** (parties 12 et 13), et aucune fausse alerte sur 199 cuts non touchés. C'est un contrôle simple pour la relecture de poses humaines, et un trait pour M6 et GCV2.
- Les PN concentrent 81 % des mauvais objets de la partie 13, au centre du PN (36 %) plutôt qu'aux bords (8 %). ADV1 : Mic corrige surtout l'entrée de la zone ; l'aiguille (cut 4682) ne se voit qu'à son arrêt de 69 s, pas dans la géométrie. ADV2 : la sortie réelle serait vers le cut 4963, et non 4936, et l'« aiguille au cut 4682 » de cette ligne paraît copiée de la ligne d'ADV1 (à confirmer par Mic). PN 6100 : fin probable 6115.
- Parcours de Mic : validation cut par cut en PN et en entrée d'ADV (1,7 s par cut), survol ailleurs (0,8 s par cut).
- Tableau de synthèse « par cut, > 10 mm » : débutant p12 29 %, p13 13 % ; Ariane p17 24,5 %, p24 32 %, p29 3,5 %. Les humains font peu d'erreurs moyennes, mais de grosses erreurs d'objet ; Ariane ne fait aucune erreur d'objet, mais beaucoup d'erreurs moyennes de 5 à 25 mm.

## D-136 — Réponses de Mic sur les parties 12 et 13 ; les 30–40 mm viennent de PN non contrôlés (16 octobre 2026)

- Les grosses erreurs des parties 12 et 13 sont des **poses d'extraction dans des PN que le débutant n'a pas contrôlés en entier** : rails verts sur la carte, donc non visités. Elles ne sont pas des poses humaines. Mic contrôle tout le PN ; c'est ce qu'Orbite doit apprendre (règle 3 renforcée, `fiches/METHODE_MIC_P29.md`).
- Zones confirmées : p12, cuts 7276–7289 = PN ; p13, PN 6100–6115 ; ADV2 4911–4963, aiguille entre 4935 et 4936. Les parties 12 et 13 ont été traitées par la même personne.
- Seuil de la règle « visité sans action = bon » : **0,8 s**.
- Mic a cité le code du projet ESV dans la conversation. Il n'est reporté nulle part dans les dépôts, conformément à la règle « aucun identifiant de projet ».
- À vérifier dans les exports : `SeenByOperator` faux au départ sur les cuts à 30–40 mm.

## D-137 — Reprise de l'Écho après un F5 corrigée (16 octobre 2026)

- `claude/50-echo-f5` (32bbdce : essais rouges ; d043f7d : correctif), intégré à `claude/50-base` par avance rapide.
- Après un rechargement, la reprise Écho attend le libellé du cut lisible (partie ≥ 1) et la liste ESV lue puis silencieuse depuis 2,5 s. Sans liste, elle exige un cut réel après 10 s, et n'accepte jamais le cut 0. Délai maximal : 60 s, relancé à chaque nouveau rechargement ; au bout, aucune période n'est créée.
- La **même session** continue, avec une nouvelle période. Un démarrage raté marque sa période, et l'essai suivant la remplace : au plus une période marquée.
- Aucune requête ESV nouvelle, aucune marque d'Ariane.
- 7 essais rouges devenus verts ; le F5 pendant un lot Orbite reste vert. verify : 1 731 réussis, 0 échec, moteur identique.
- Joué seulement sur le banc simulé. Délais tirés d'un seul relevé terrain : à vérifier au terrain avant de redemander un F5 à Mic. Fiche : `fiches/ECHO_F5.md`.

## D-138 — Jointure v2 : Écho multi-sessions, Écho seul, « visité sans action = bon » (16 octobre 2026)

- `claude/50-jointure-v2` (255ef64, 07f4b7e, 243ae89, 506af7e), intégré à `claude/50-base`.
- Clé de visite (session, `visitIndex`), dans l'ordre du temps. Les exports `ariane-echo-*` sont lus en mode dossier. Mode `--sans-journal` pour un Écho seul (poses humaines). Option `--visite-sans-action-bonne [s]`, 0,8 s par défaut (choix de Mic), coupée par défaut, cut 0 exclu.
- 28 essais sur fixtures synthétiques ; verify : 1 744, 0 échec.
- Partie 17 identique ligne pour ligne (192 / 132 / 47 ; 5,0 / 11,1 / 20,0 mm). Partie 29 : 7/192 à plus de 10 mm, 96 à plus de 5 mm ; avec la règle à 0,8 s, 7/198.
- Reste à faire : `tools/p0-commun.cjs` ignore aussi les `ariane-echo-*` ; `perf-phases.cjs` ne lit pas les relevés S6. Les deux corrections sont décrites dans la fiche.

## D-139 — Second projet : lot Orbite de la partie 1 reçu ; fausses alertes « contrat ESV » avec deux fenêtres (16 octobre 2026)

- Lot Orbite 4.9.5.3 de la partie 1 du second projet (D-123), archivé dans banane-data (5fabea9). Projet difficile, avec seulement 2 scanners visibles d'après Mic : **224 posés, 127 différés** (tous `deferred-unresolved`). L'Écho de Mic suit ; ce sera le premier jeu où les abstentions d'Ariane reçoivent une pose humaine.
- **Fausses alertes de contrat** : 5 avis « ESV n'a plus le même contrat » en alternance entre deux empreintes (8ff6ba83 et a1c1d168), entre 10 h 01 et 10 h 52, heure de Paris, pendant que Mic faisait l'Écho des parties 12 et 13 dans une autre fenêtre. L'empreinte est gardée **une seule fois pour tout le navigateur**. Deux onglets ESV dans des états différents (boutons, écouteurs) se la disputent. C'est le doute signalé en D-127. Correctif à faire : empreinte rangée par onglet, et retirer des champs comparés ce qui dépend de l'état de la page, comme les libellés de boutons et le nombre d'écouteurs. Jusque-là, Mic peut ignorer cet avis quand deux fenêtres ESV sont ouvertes.

## D-140 — Première étude d'apprentissage (G0 v1) : aucune porte stricte atteinte, trois pistes solides (16 octobre 2026)

- `claude/50-g0-apprentissage` (25fde86), intégré à `claude/50-base` : `tools/apprentissage-g0.cjs`, `tools/g0-enrichir-jeu.cjs`, essais, `fiches/G0_APPRENTISSAGE_V1.md`. verify : 1 768 réussis, 0 échec. Parties 17, 24 (jointure v2 à 0,8 s : 70 posés avec référence, 21 faux verts) et 29, plus les parties humaines 12 et 13.
- **Faux verts d'Ariane** : quatre traits vont dans le même sens sur les trois parties (`dz` de convention, déplacement vertical depuis ESV, confiance basse, peu de lignes au sommet). Exemple : au-delà de 8,5 mm de `dz`, 33 % de corrections à plus de 10 mm, contre 5 % sous 4,5 mm. Mais aucun modèle ne se généralise d'une partie à l'autre : rappel à 5 % des cuts de 8 % (M6 : 11 %). Porte « 60 % dans 5 % » non atteinte. Elle est même impossible sur les parties 17 et 24, où les fautes dépassent 8,3 % des cuts.
- **PN** : `flushPct` ≥ 30 retrouve 22/24 cuts de PN sur la partie 29, sans fausse alerte (AUC 0,96). Marge de 4 cuts avant et 6 après, cohérente avec le parcours de Mic sur 16 PN. Une seule partie avec relevé S6 : à confirmer.
- **Extraction fausse en PN** : l'écartement tient en validation croisée 12 ↔ 13 (54/54). Il est trop court sur les verts d'extraction des parties 29 et 17, où il rate les sauts verticaux sur un seul rail. Piste : le dénivelé local entre les deux rails (AUC de 0,80 à 0,90 sur les trois parties).
- **Biais vertical** : sur les rails à convention refusée, Mic remonte la pose dans les trois parties (+6,1, +1,8, +3,6 mm) ; c'est le seul signe stable. Une correction apprise ailleurs réduit les cuts à plus de 10 mm de 75 à 63, mais en ajoute 4 au-dessus du seuil : à poser **en ombre (E2)**, pas en activation.
- **Données nécessaires** : une dizaine de parties relues comme la 29 pour juger un rappel à ±10 points ; 5 parties avec relevé S6 et PN notés ; environ 13 parties pour fixer le biais vertical à ±1 mm. Les parties en version courante valent mieux que les anciennes. Le panneau « à relire » reste suspendu.

## D-141 — Second projet, partie 1 : les différés viennent d'une voie décalée ; « déplacer la vue » utile, mais pas suffisante ; nouvelles fautes sur la mauvaise voie (16 octobre 2026)

- Écho de Mic archivé (c39a77c) ; analyse hors ligne dans `scratchpad/pr2p1/RAPPORT.md`, avec le jeu `jeu-pr2p1.jsonl`.
- **Lot** : 224 posés, 127 différés (36 %, contre 13–20 % sur le premier projet) ; débit 1 185 cuts/h. Faux verts : 10/165 (6,1 %, entre 4,5 et 9,0 % selon la règle des 0,8 s). Parmi eux, **3 poses sur la mauvaise voie** (163 à 280 mm, cuts 299, 302 et 315, zone d'ADV 2) : un type de faute jamais vu sur le premier projet, dont le maximum était 23,5 mm.
- **Les 127 différés ont tous été posés par Mic**, à 149 mm en médiane par rail de la pose de départ d'ESV : la voie entière est décalée. 117 sont dans la zone d'ADV 2. 81 % sont « sans ancre » : plus aucun voisin posé pour prédire la suite. Les nuages ne sont **pas** pauvres : mêmes niveaux et budget qu'en partie 29, 253 rails sur 254 avec des points de flanc.
- **Rail hors de la vue ESV** : 32 % des différés (41/127), tous en zone 2, presque tous à gauche, dépassement médian de 10 mm ; un dézoom de ×1,25 couvre 98 % des cas. Hors du cadre de capture : 0 %. **Hors de la fenêtre et de la grille de recherche du moteur (±180 et ±80 mm) : 61 %.**
- **Lecture pour la 5.0** : 11 cuts ouvrent des séries qui contiennent 71 % des différés. Sur ces cuts, la prédiction de voie du lot était juste (3,7 mm) mais hors de la vue, et un dézoom de ×1,06 suffisait. « Déplacer la vue » est donc utile, mais au **départ d'une série**, et ne suffit pas seul. Pour 29 % des différés dans la vue, le moteur avait déjà la bonne paire et s'est abstenu. Un élargissement naïf de la recherche donne 20 justes pour 66 fausses. Il faut d'abord un **a priori de voie** : prédiction de la voie, ou mémoire de voie de GCV2.
- Apprentissage : sur ce projet, les traits « confiance basse », « écart aux voisins », « peu de lignes au sommet » et « concurrents forts » tiennent ; le signe du vertical s'inverse ; M6 fait 3/10 fautes dans 5 % des cuts ; la règle d'écartement tient (AUC 0,91) ; `flushPct` ne se généralise pas sans PN déclarés.
- Questions pour Mic : PN aux cuts 388–396, 405–409 et 447–449 ? Écartement final de 1 631 mm au cut 428 ? Défaut : un événement `audit-serveur` étiquette « partie 29 » avec les totaux de la partie 12 (champ partie faux, à corriger).

## D-142 — Réponses de Mic sur le second projet ; défaut probable de l'Écho au cut 428 (16 octobre 2026)

- PN aux cuts 405–409 du second projet, partie 1 ; les cuts 388–396 et 447–449 n'en sont pas. Sur ce projet, `flushPct` a donc signalé deux plages qui ne sont pas des PN, ce qui confirme qu'il ne se généralise pas seul (D-141).
- **Cut 428** : l'écartement réel est de 1 441 mm (Mic), alors que l'Écho donne 1 631 mm, avec seulement le rail gauche déplacé (132 mm) et le rail droit inchangé. **L'Écho a manqué la correction du rail droit** sur ce cut. C'est un défaut de capture à chercher (événements `railPairUpdated` d'un seul rail, validation qui ne porte qu'un rail, ou correction faite dans une visite non retenue), avant de faire confiance aux étiquettes « un seul rail corrigé ». Les cuts « validés puis SKIP » restent en SKIP, sans importance.

## D-143 — Cut 428 : l'Écho avait bien vu le rail droit ; c'est la référence figée à la touche qui était périmée (16 octobre 2026)

- Mic a cliqué sur le rail droit 7 ms avant Maj+Espace. ESV a appliqué le déplacement (190 mm) 11 ms après la touche. L'Écho fige la « référence humaine » sur le dernier état lu à la touche (`native-page.js` → `native-session.js`, test de fraîcheur sur l'âge seulement), soit 25 ms plus tôt, et ne la met plus jamais à jour. Le déplacement est pourtant consigné dans l'historique et dans l'état final, et l'écriture serveur de validation (PUT 204, les deux rails) donne 1 441,6 mm, comme Mic l'a dit.
- **Ampleur** : 1 cas sur 1 260 validations, sur les Échos des parties 1, 12 et 29. Rare, mais silencieux.
- **Correctif à faire** : dans l'Écho (`noteServerWriteNow`), quand l'écriture de validation de la ligne diffère de plus de 1 mm de la référence, on remplace celle-ci, en gardant l'ancienne et en notant `source: validation-write`. Même règle dans `tools/jointure-echo-orbite.cjs`, pour réparer les exports déjà collectés. L'écriture serveur est l'arbitre.
- **Effet sur D-141** : négligeable. L'écart médian par rail passe de 149 à 150 mm. La voie est décalée dans le même sens sur 109/112 cuts. L'exception à 1 631 mm disparaît. Les nuages ont des points de flanc sur 254/254 rails. Les faux verts, le débit et les différés ne changent pas. D-134 ne change pas.
- Correctif livré (`claude/50-echo-ref-ecriture`, de 3cb4c95 à 8825ec9) et intégré à `claude/50-base` par avance rapide. Une seule fonction pure, `referenceParEcriture`, est partagée par l'Écho et l'outil de jointure. Une écriture antérieure à l'intention est ignorée. Le statut `candidate-observed` est conservé. Le cut 428 passe de 1 631,1 à 1 441,6 mm ; c'est le seul cut corrigé sur 765. Les tables des parties 17 et 29 sont identiques ligne pour ligne. verify : 1 788 réussis, 0 échec. La règle reste à confirmer au terrain avec une Écho équipée du correctif.

## D-144 — Cap de l'apprentissage fixé par Mic : « un cut différé = un cut appris » ; lancement massif (16 octobre 2026)

- Mic : « Tu peux tout massivement lancer, que ce soit la prochaine version, les analyses, l'apprentissage. » Et il fixe un cap, pas un but : **quand on possède un lot Orbite et son Écho, chaque cut différé devient un cas appris qu'Ariane saura poser dans un contexte semblable.**
- Lancé en parallèle :
  - **G1, mémoire des différés** (`claude/50-g1-memoire-differes`), avec trois façons d'apprendre, toutes lisibles :
    - choix dans le pool de candidats ;
    - décalage de voie d'une série, appris sur les premiers cuts corrigés par Mic et réutilisé sur les suivants ;
    - voisin le plus proche entre parties.
    - Jugée hors ligne. Porte : 0 pose sur la mauvaise voie, moins de 5 % de poses fausses.
  - **Voie prédite et « déplacer la vue »** (`claude/50-voie-predite`) : rejeu du moteur sur le vrai nuage, centré sur la voie prédite, avec le décalage d'écran ou le dézoom nécessaire.
  - **4.9.5 test 4** (`claude/495-test-4`) : la base 5.0, plus l'empreinte de contrat par onglet (D-139), le champ partie d'`audit-serveur` corrigé, la correction verticale en **ombre** (E2, jamais appliquée) et le F5 en Écho à nouveau permis. Rien ne change dans la pose.
- Toujours en cours : l'enquête sur le cut 428 (déjà poussée sur la base, à relire : D-143), l'analyse de la partie 24, P1 ter et S4.

## D-145 — Audit indépendant au tournant de la 5.0 : accord de Mic, déclenchement automatique (16 octobre 2026)

- Mic valide un audit en lecture seule, mené avec le modèle le plus fort et ciblé, et me laisse le programmer.
- **Déclencheur** : quand trois chantiers ont rendu leur rapport : G1 (mémoire des différés), la voie prédite et la 4.9.5 test 4. Pas avant, pour ne pas auditer un état périmé.
- **Trois axes** :
  1. le cahier 5.0 face aux données (priorités, abandons, plan d'apprentissage, cap « un différé = un cut appris ») ;
  2. la fiabilité des mesures (capture de l'Écho, cut 428, jointure, biais d'échantillon, petits effectifs) ;
  3. la base de code 5.0 (sécurité de la pose, trace identique à celle d'un humain, moteur intact, commits poussés sans relecture).
- Livrable : un rapport de recommandations classées. J'applique ce qui est simple et sûr ; le reste est soumis à Mic.

## D-146 — 4.9.5 test 4 livrée ; D-143 relu (16 octobre 2026)

- **D-143 relu** (de 3cb4c95 à 8825ec9). C'est de l'observation pure : `native-session.js` et l'outil de jointure. Ni requête ESV, ni écriture, ni pose. La référence remplacée est gardée et marquée `supersededBy`. Accepté.
- **Test 4** : `claude/495-test-4`, version 4.9.5.4, partie de 8825ec9.
  - Contenu : empreinte du contrat par onglet (D-139), partie d'`audit-serveur` lue dans la séance en cours, correction verticale E2 en **ombre** et F5 en Écho permis (D-137).
  - Relecture de `lot-decision.js` : `decideCut` appelle la décision de base telle qu'elle était, puis ajoute seulement la clé `ombreVerticale`. Une erreur rend la décision intacte. `commandRails` ne lit pas cette clé.
  - `src/engine.js` est identique à `main`. verify : 1 814 réussis, 0 échec, 2 ignorés (corpus natif absent). Les trois premiers passages ont dépassé le délai, parce que la machine était saturée par G1 et la voie prédite.
  - Paquet `ariane-4.9.5-test.4.zip`, 1 754 648 octets, SHA-256 `52e09e429937f2c451e3578a411bf53c1a5cd6393305edd8584935a1c9f285d7`.
  - La consigne demande un seul F5 en Écho, en fin de partie, heure notée, et un essai à deux fenêtres ESV.
- **Doutes déclarés par l'agent** :
  - l'empreinte précédente ne survit pas à un redémarrage du navigateur ;
  - les classes des boutons de rail restent comparées : une fausse alerte reste possible ;
  - le F5 en Écho n'a été joué que sur le banc.
- **Pour l'audit (axe 3)** : des noms de modèle figurent dans `DECISIONS.md` (ligne 14), `fiches/FICHE_B1.md` et `PILOTAGE_SESSIONS.md`. Ils sont déjà sur `main` et dans les paquets précédents. À retirer, avec Mic pour `main`.

## D-147 — Voie prédite et « déplacer la vue » : rejeu hors ligne, règle prudente, rien d'activé (16 octobre 2026)

- Livré sur `claude/50-voie-predite` (199bee8). Intégré à `claude/50-base` par avance rapide. Trois fichiers seulement : outil, essai, fiche `fiches/VOIE_PREDITE.md`. Rien sous `src/`, verify vert.
- **Fidélité** : le rejeu appelle les vrais modules. Il refait le lot réel à 0,5 mm près (351/351 en partie 1 du second projet, 244/244 en partie 29). Il retrouve les 10 faux verts de D-141.
- **Partie 1 du second projet, 127 différés** :
  - sans déplacer la vue, aucune pose possible ;
  - vue déplacée, série complète : 42 poses, 2 fausses, 0 sur la mauvaise voie ;
  - **règle prudente** : seulement pour les différés, l'étage moteur, une confiance ≥ 55, une chaîne ≤ 10 et un écartement à 10 mm des appuis. Elle pose 27 cuts (21 %), 0 faux, 0 mauvaise voie. 15 de ces poses demandent un geste sur la vue. Aucun des 224 cuts déjà posés ne change.
- Partie 29 : la règle ne change rien.
- Les seuils sont lus sur ces deux parties : la règle passera un lot neuf **en ombre** avant toute activation, qui se fera avec Mic.
- **Pièce à construire** : `amenerDansLaVue`, avec dézoom ou glisser, au plus 3 gestes par rail. La vue est remise en place avant le cut suivant. Il faut d'abord relever sur la maquette si ESV accepte ces gestes.
- **Écho** : y consigner longueur, durée et caméra des glissers.
- **Confirmé par Mic le 16 octobre** : il déplace la vue en glissant au **clic gauche**, ou en dézoomant. La mention « clic droit » de D-043 est fausse.

## D-148 — G1, mémoire des différés : une seule façon tient, et rien n'est activé (16 octobre 2026)

- Livré sur `claude/50-g1-memoire-differes` (15de62c) et intégré à `claude/50-base` (8f3b369). Seuls l'outil, l'essai et la fiche `fiches/G1_MEMOIRE_DIFFERES.md` changent. Rien sous `src/`, verify vert.
- 236 cas, un par différé posé par Mic : partie 1 du second projet 127, partie 17 35, partie 24 40, partie 29 34. Chaque partie est jugée par un modèle appris sur les trois autres.
- **(a) Choix dans le pool** : 11 posés, 6 sur la mauvaise voie. Le classement ne se transfère pas d'une partie à l'autre. Abandon.
- **(c) Voisin le plus proche** : 6 posés, 5 faux. Abandon.
- **(b) Mémoire de voie de la série** : 56 posés, 53 justes à 10 mm près, 3 faux (5,4 %), 0 sur la mauvaise voie. La porte des 5 % n'est pas démontrée : la borne haute est à 14,6 %. Il faudrait environ 73 poses sans faute sur des parties neuves.
- Le décalage constant par rapport à la pose de départ ESV est faux sur le second projet.
- **Limites** :
  - le gain vient des longues séries ;
  - la tête de série reste à Mic ;
  - le jugement suppose qu'Ariane voit les corrections de Mic pendant le lot, ce qu'elle ne fait pas aujourd'hui ;
  - le réglage de (b) est sensible au protocole de simulation.
- **Suite** : (b) en ombre, dans le lot et l'Écho, avec un événement par différé. Il faut définir avec Mic comment Ariane voit ses corrections. (b) recoupe la règle prudente de D-147 et sera rapprochée d'elle dans l'audit.
- Les trois chantiers du déclencheur de D-145 sont rentrés. L'audit est lancé.

## D-149 — Audit indépendant de la 5.0 : résultats et suites (16 octobre 2026)

- L'audit (D-145) est rendu. Il était en lecture seule et a rejoué 115 essais ciblés. Le rapport complet est hors dépôt, dans le carnet de la session (`audit50/AUDIT_5.0.md`).
- **Ce qui est sûr** :
  - la 4.9.5.4 et la base 5.0 ne changent pas la pose ;
  - `src/engine.js` est identique à `main` ;
  - aucune ombre ne touche `positions` ni les commandes ;
  - D-143 est accepté.
  - Trace dans ESV : Ariane n'émet aucune requête propre, aucun en-tête, aucun champ écrit. Les commandes passent par ESV lui-même.
- **Reste à mesurer sur la trace** : la nature des écritures par cut, Orbite contre Écho, et l'éventuelle télémétrie cliente d'ESV, à vérifier sur la maquette.
- **Bloquant avant toute activation d'une pose nouvelle** :
  - B1 : un manifeste des parties. Les parties 17, 24, 29 et la partie 1 du second projet ont servi à régler. Toute partie neuve est réservée.
  - B2 : la porte doit avoir un effectif, avec une borne de Wilson < 5 % : 73 poses sans faute, ou 110 avec une seule. Seuil de métier, à soumettre à Mic.
- **Appliqué tout de suite** :
  - I1 : noms de modèles d'IA retirés de la branche pilote, remplacés par des niveaux ;
  - I5 : la branche pilote est déclarée « documents seulement » dans `LIRE_EN_PREMIER.md`.
- **Lancé** :
  - hygiène sur la base 5.0 : manifeste des parties, réglages figés, noms de modèles, renommage de l'ombre verticale en P8, verify sous `nice` et verrou, textes à recouper ;
  - jointure par cadre de scène et rejeu de la partie 24 (I2). Le même chantier refuse la règle « visité = bon » après une perte de page ou sur une capture vide (I3 a), et avertit quand deux sessions se chevauchent (U5) ;
  - les ombres : la règle prudente de voie prédite dans Orbite d'abord, puis la mémoire de série dans l'Écho, avec un module commun (I8). Le même chantier ajoute la dernière empreinte connue dans `storage.local` (U1) ;
  - la mesure de la trace (I6).
- **À soumettre à Mic** :
  - B2 ;
  - le seuil de 0,8 s (I3 c) ;
  - les amendements du cahier (I7) ;
  - le mode de travail qui rendrait la mémoire de série active (I8 4) ;
  - une seconde relecture d'une trentaine de cuts pour mesurer le bruit de la référence (U6) ;
  - le retrait des noms de modèles sur `main`.

## D-150 — Base 5.0 : test 4 et hygiène de l'audit intégrées (16 octobre 2026)

- Dans `claude/50-base`, dans l'ordre :
  - la 4.9.5 test 4 (7c0a694) ;
  - l'hygiène de l'audit, `claude/50-audit-hygiene` (5e8e9a0) ;
  - le renommage de l'ombre verticale en P8 (21910eb).
- Le renommage touche les commentaires et le libellé seulement. Les clés `ombreVerticale`, `ombreVerticaleRefusee` et `e2-vertical-refuse-v1` ne changent pas.
- **B1** : `datasets/manifeste-parties.json`. Les parties 17, 24, 29 du projet 1 et la partie 1 du projet 2 sont en apprentissage. Toute autre partie est réservée. Les outils de réglage refusent une partie réservée, sauf avec `--juger-partie-reservee`.
- **I4** : `datasets/reglages-figes.json` (règle prudente D-147, G1 b, ombre verticale à 3,6 mm). Un essai vérifie qu'ils concordent avec le code.
- **I1** : plus aucun nom de modèle d'IA dans la base. Un essai l'interdit, et l'essai de consigne de la test 4 n'écrit plus ces noms en clair.
- **U8** : `verify` tourne en priorité basse. Il refuse de partir si `wt/lourd.lock` existe ; `BANANE_VERROU_LOURD=""` coupe ce contrôle.
- verify : 1 861 réussis, 0 échec, 2 ignorés (corpus natif absent). Le moteur est conforme à la baseline.
- Toute partie de la test 3 ou de la test 4 reçue désormais est **réservée** : elle servira à juger, jamais à régler.

## D-151 — Trace dans ESV : les écritures d'Ariane sont celles d'un humain ; restent les lectures et le rythme (16 octobre 2026)

- Livré sur `claude/50-mesure-trace` (9f2d6c9, fa874c0), intégré à `claude/50-base` par avance rapide. Contenu : l'outil `tools/trace-ecritures.cjs`, son essai et la fiche `fiches/TRACE_ESV.md`. Rien sous `src/`.
- Mesure faite sur les parties 29 et 1 du second projet, lot Orbite contre Écho.
- **Identique à l'opérateur** :
  - les écritures (PUT en XHR, code 204) ;
  - les champs, l'ordre des clés, les valeurs et la précision ;
  - l'ordre « vu » puis « validation » ;
  - aucune écriture qu'un humain ne ferait jamais.
- **Différences, classées par risque** :
  1. **Moyen** : plus de lectures de nuage par cut (4,2 contre 1,7 en partie 29, 2,5 contre 1,8 en partie 1). Elles ont la même forme et restent dans la plage humaine. Cause supposée : les commandes de vue.
  2. **Faible à moyen** : presque aucune pause, 1 % des intervalles au-delà de 5 s contre 7 à 9 % chez l'opérateur. Le cycle est concentré entre 2 et 3 s. Le débit de pointe est le même que celui de l'opérateur.
  3. **Faible** : en partie 29, le lot avance par sauts vers l'avant.
- **Ce que les exports ne montrent pas** : la télémétrie cliente d'ESV, les événements d'interface synthétiques. Il faut le vérifier sur la maquette : capture réseau d'un passage manuel contre un passage en lot, sur les mêmes cuts.
- **Aucune action nouvelle proposée.** Réduire un écart (pauses, lectures) changerait le comportement dans ESV : c'est à Mic de décider.
- **Remarque** : l'essai `memoire-differes` frôle sa limite de 20 s sous charge (15 s seul). À alléger.

## D-152 — Jointure par cadre de scène : la partie 24 était juste, seule une étiquette était fausse (16 octobre 2026)

- Livré sur `claude/50-jointure-cadres` (11b0bfc à 2eef69c), intégré à `claude/50-base` (55a14b9). Seuls l'outil, les essais et les fiches changent, rien sous `src/`.
- **I2** : la translation est estimée pour chaque cadre de scène. Sur la partie 24, le lot a été lancé sur deux pages, d'où deux translations écartées de 65 m. Le P90 passe de 65 m à 0 et les cuts en repli de 17 à 0. Les tables des parties 17, 29 et de la partie 1 du second projet sont identiques ligne pour ligne.
- **I3 (a)** : la règle « visité = bon » est refusée moins de 60 s après une perte de page et pour une visite aux captures vides. Les deux comptes, avec et sans la règle, sont publiés (I3 b).
- **U5** : le résumé signale les sessions Écho qui se chevauchent. Aucune des quatre parties n'en a.
- **Effet** : G0 inchangé (21 faux verts sur 70 en partie 24). G1 (b) inchangé (56 poses, 53 justes, 3 fausses, 0 mauvaise voie). D-147 inchangé. Pour D-141, il faut citer les deux comptes : 10 faux verts sur 165 avec la règle, 10 sur 111 sans.
- Sur la partie 1 du second projet, les 54 cuts « visités = bons » restent 54. 6 d'entre eux n'ont aucune capture ; 44 tiennent sur une visite de moins de 2 s.
- Les 60 s sont un choix, pas une mesure.

## D-153 — Ombres de la voie prédite (Orbite) et de la mémoire de série (Écho) : intégrées, pas encore livrées (16 octobre 2026)

- Livré sur `claude/50-ombres-voie`, jusqu'à 4cadc00. Intégré à `claude/50-base` par avance rapide. verify : 1 917 réussis, 0 échec, 2 ignorés. Moteur intact.
- **Module commun** `src/voie-recentree.js`, « recentrer sur la voie », utilisé par les deux rejeux et par l'extension. Il concorde avec les rejeux : sur la partie 1 du second projet, la règle prudente déclare posables exactement les mêmes 27 cuts. G1 (b) reste à 56 poses, avec un rapport identique.
- **Orbite** : un événement `voie-predite-ombre` par cut différé. Le calcul part après la décision et la commande, sur des copies, et ne rend rien. Relu : `voieOmbrePlanifier` n'écrit ni dans `batch` ni dans les appuis, et n'envoie aucune commande.
- **Écho** : un événement `memoire-differes-ombre`, calculé avant la lecture de la référence humaine, dans la file de la continuité. Il a besoin de la liste des différés du lot, présente dans l'état d'Ariane. S'il ne la trouve pas, il le dit (`differes-inconnus`).
- **U1** : la dernière empreinte de contrat connue est gardée dans `storage.local`. Elle est consignée, sans jamais donner d'avis.
- **Poids** : environ 90 Ko par lot de 350 cuts, soit 0,4 % du journal.
- **Risque à mesurer avant livraison** : l'ombre d'Orbite relance le moteur, jusqu'à 2,5 s, pendant la capture du cut suivant, dans le même service worker. Sur la partie 1, elle l'aurait fait 60 fois. Le cycle du lot pourrait ralentir, et son rythme change la trace (D-151). La test 5 ne partira qu'avec une mesure du cycle sur le banc, ombre coupée puis active. Si le cycle s'allonge, il faudra soit couper l'ombre d'Orbite, soit la différer en fin de lot.
- **Ordre** : la test 5 attend le retour terrain de la test 4.

## D-154 — Cycle du lot avec l'ombre de la voie prédite : coût négligeable sur le poste du terrain (16 octobre 2026)

- Livré sur `claude/50-mesure-cycle-ombre` (2c878f1), intégré à `claude/50-base` par avance rapide. Contenu : l'outil `tools/cycle-ombre.cjs`, son essai et la fiche `fiches/CYCLE_OMBRE.md`. Rien sous `src/`.
- **Banc** : le vrai `background.js` joue un lot contre un ESV simulé qui rend les vrais nuages et les vrais temps de capture de la partie 1 du second projet. Ombre coupée puis active, 3 lots par réglage, en alternance. Le cycle médian est le même (2,83 s), le P90 aussi (5,9 s), et les durées restent dans le bruit. Décisions et commandes sont identiques.
- **Calcul sur tout le lot**, au poste du lot : 18 différés sur 127 sont retardés, 4,1 s en tout (0,4 %), 0,78 s au pire. Sur un poste 2,5 fois plus lent : 35 s (3,3 %), 2,7 s au pire.
- **Décision** : l'ombre reste active pendant le lot, dans la test 5. La différer en fin de lot coûterait environ 190 Mo de mémoire et serait perdue au redémarrage du service worker. Un garde-fou est à prévoir si un poste plus lent montre un retard : plafonner la relance.
- La test 5 relèvera `ms` sur chaque événement d'ombre : il est déjà dans l'événement.
- Limites : une seule partie, banc sous Node et non Chromium, rapport de vitesse estimé sur le moteur seul.

## D-155 — Réponses de Mic à l'audit, cap sur l'autonomie, nuit à gros moyens (16 octobre 2026)

- **Porte d'activation** : Mic trouve les 5 % trop sévères. Proposition, à confirmer dans le cahier v1.1 : jamais de pose sur la mauvaise voie, et pas plus de faux qu'Orbite aujourd'hui (4 à 9 % de faux verts selon les parties), mesurés en ombre sur des parties neuves. Il faut environ 30 à 40 poses, soit une ou deux parties à voie décalée.
- **Mémoire de série (G1 b)** : Mic ne veut pas d'un mode où Ariane dépend de ses corrections pendant le lot. Le but est l'autonomie, avec les règles métier. G1 (b) reste un outil de mesure dans l'Écho, pas un mode de travail. Priorité à la voie prédite, au déplacement de la vue et aux règles métier.
- **Bruit de la référence (U6)** : une seconde relecture à l'aveugle est impossible dans ESV, car Mic y verrait sa propre correction. Le bruit sera mesuré sur les données existantes, sans travail pour Mic.
- **Noms de modèles d'IA sur `main`** : Mic donne son accord. Retirés de `main` (4c9fee0), documents seulement, rien sous `src/`.
- **Nuit du 16 au 17** : Mic demande de grands chantiers aux niveaux forts, avec relance après chaque réinitialisation. Le plan et les règles assouplies sont dans `fiches/REPRISE_AUTONOME.md`.
- Rien n'est activé au terrain sans Mic.

## D-156 — Déplacer la vue : la pièce est écrite et coupée ; la maquette ne réagit pas aux gestes (16-17 octobre 2026)

- Livré sur `claude/50-deplacer-vue` (2209034 à 4e64445), intégré à `claude/50-base` par avance rapide. Essais ciblés verts, et verify de l'agent : 1 955 réussis, 0 échec. Moteur intact.
- **Pièce `amenerDansLaVue`** : dézoom à la molette, sinon glisser au clic gauche, au plus 3 gestes par rail. Elle relit la caméra, reprojette, pose, puis remet la vue. Un pré-vol essaie le geste sans rien poser.
  - Conditions : seulement pour un cut différé parce que la cible est hors de la vue, à l'étage « window », et qui passe la règle prudente D-147.
  - Réglage `deplacerVue.actif=false`. Coupé, les commandes à ESV sont identiques octet pour octet.
- **Gestes vérifiés dans Chromium** : la suite d'événements est la même que celle d'une vraie souris. Le `click` final d'un glisser est volontairement omis, car il poserait le rail. La molette envoie `wheel` avec `wheelDeltaY` (sinon le zoom part dans le mauvais sens). Un faux cran n'atteint jamais un écouteur `mousewheel` : si ESV n'écoute que lui, le dézoom d'Ariane sera sans effet.
- **La maquette ne réagit à aucun geste**. La réaction du vrai ESV n'est donc pas mesurée : gain en mm par pixel, persistance du zoom, lectures de nuage par geste. Les vérifications à faire sur le vrai ESV avant activation sont au § 6 de `fiches/DEPLACER_VUE.md`. Le relevé Écho des gestes de Mic y répondra en partie.
- **Écho** : le relevé des glissers et des crans de molette de Mic est **actif par défaut** (`echo.gestesVue`), en observation pure avec des écouteurs passifs. Il ajoute environ 1 Ko par geste.
- **Remarque à garder pour la trace (D-151)** : la pose directe du mode rapide peut déjà cliquer à des coordonnées hors de la partie visible de la vue, ce qu'un humain ne peut pas faire. À examiner.

## D-157 — Mode rapide : le clic du rail gauche tombe hors de la fenêtre, une marque côté page (17 octobre 2026)

- Enquête en lecture, rapport hors dépôt (`clic-hors-vue/RAPPORT.md` dans le carnet de la session).
- **Constat vérifié** : en mode rapide (`poseDirecte`, 9 cuts sur 10), Ariane presse le bouton du rail gauche puis clique tout de suite, avant que la caméra d'ESV ait suivi. Le clic est donc calculé dans la vue du rail droit, où la cible gauche tombe vers NDC −7 : environ 2 000 px à gauche du canevas, hors de la fenêtre. C'est voulu depuis D-088, et le seul garde-fou est |NDC| < 50.
- Reconstitution sur les lots réels : 185 clics sur 185 en partie 29 et 205 sur 205 en partie 1 du second projet. Les poses sont justes (relues à 1 mm), et le serveur ne voit rien de différent : les écritures sont identiques (D-151).
- **Pourquoi c'est une marque** : un vrai clic humain à ces coordonnées n'atteindrait jamais le canevas. Elle n'est visible que si la page d'ESV relève les coordonnées des clics, ce qui n'est pas vérifié.
- **Correction proposée, non appliquée** : poser avec recentrage, le chemin des cuts de référence, qui refuse une cible hors de la vue. Sans code : `rapide.pose=false`. Coût : 0 cut différé en plus, mais environ +0,67 s par cut rapide, soit +13 à +19 % de durée de lot. Variante : rail droit en direct et rail gauche recentré, pour environ moitié moins de temps.
- **Décision à Mic** : c'est un arbitrage entre le débit et la trace humaine (sa règle « aucune marque distincte »).
- À noter aussi : Chromium arrondit les coordonnées à l'entier, donc les décalages d'un demi-pixel de `DECALAGES_CLIC` donnent 0 ou −1 px.

## D-158 — Bruit de la référence de Mic : environ 1 mm par axe ; le seuil de 10 mm tient, celui de 5 mm comme taux seulement (17 octobre 2026)

- Livré sur `claude/50-bruit-reference` (5d246a6, 2b73df1), intégré à `claude/50-base` (bf47d1c). Seuls l'outil, l'essai et la fiche `fiches/BRUIT_REFERENCE.md` changent, rien sous `src/`.
- Mesuré sur 8 sessions Écho, soit 3 013 cuts dont 2 209 validés :
  - les relectures espacées de Mic retrouvent la même pose à 0,5 mm près dans 79 % des cas, avec un écart maximal de 4,6 mm ;
  - le grain du clic est de 0,386 mm par pixel ;
  - entre voisins, l'écart est de 1,5 mm en latéral et 2,3 mm en vertical (borne haute) ;
  - le dernier pas d'un réglage est de 0,75 mm.
  Fourchette retenue : 0,75 à 1,5 mm par axe en latéral, jusqu'à 2,3 mm en vertical.
- **Le seuil de 10 mm a un sens.** **Celui de 5 mm** a un sens comme taux sur une partie, pas comme verdict sur un cut : la zone grise va de 3,6 à 6,4 mm. Un écart de moins de 3 points entre deux taux ne se lit pas.
- Débutant contre Mic (228 cuts communs) : 41,7 % des références sont la pose de départ elle-même, et 23,7 % sont déplacées de 25 mm ou plus.
- Le biais propre à Mic ne se mesure pas avec un seul opérateur. Les relectures ne sont pas à l'aveugle.
- verify de l'agent : 0 échec, mais 8 fichiers annulés par délai sous charge (load 11). Ils passent seuls. Un verify complet sera relancé sur une machine calme avant la test 5.

## D-159 — Règles métier de Mic, en ombre : PN retrouvés 17 sur 17 ; gain net modeste en différés, fort en relecture (17 octobre 2026)

- Livré sur `claude/50-regles-metier` (d987016 à 6bc01a9), intégré à `claude/50-base`. Les conflits avec « déplacer la vue » ont été résolus en gardant les deux. Les règles métier s'appliquent **après** « déplacer la vue », et ne peuvent que différer.
- **Module** `src/regles-metier.js` et événement `regles-metier-ombre` (ombre active). L'activation est coupée, règle par règle (`zone-validation-en-place`, `pn-chaque-cut`, `grappe-differes`). Une règle activée ne peut que transformer une validation en différé.
- **Détection des PN sans la liste de Mic** : chaussée au ras des rails sur les quatre côtés, sur deux cuts proches. **17 PN de Mic sur 17, et 0 fausse zone**, sur les parties 29, 12, 13 et la partie 1 du second projet. Les plages tombent à 0 à 3 cuts près. Les ADV n'ont pas de signal géométrique fiable : on passe par la grappe de différés.
- **Écartement** : écart à la médiane de la partie supérieur à 15 mm. 54 cas sur 54 chez le débutant, 14 sur 15 en partie 29, 19 sur 19 au second projet, 5 sur 9 en partie 17.
- **Si tout était activé** : 18 faux verts évités sur 85, au prix de 96 cuts différés en plus, soit environ 2 à 5 minutes de Mic sur 4 lots. Les gains viennent de `grappe-differes`, dont les 3 poses sur la mauvaise voie du second projet. `pn-chaque-cut` n'évite aucune faute de plus de 10 mm.
- **Le fort potentiel est la liste des verts à contrôler.** En partie 29, 256 verts signalés contiennent 67 des 83 erreurs de plus de 10 mm. Cela représente environ 8,5 minutes de relecture, alors que Mic a relu 585 verts en 36 minutes. À présenter à Mic.
- Toutes les parties ont servi à régler, réglages figés. Les parties 12 et 13 sont passées en apprentissage dans le manifeste (elles servent depuis D-140).
- Zones à faire confirmer par Mic : partie 24, cuts 6569–6585 et 8518–8535, et un PN possible en partie 12, cuts 4495–4499.

## D-160 — Faux verts : presque tous viennent de la hauteur ; aucune règle de différé fiable (17 octobre 2026)

- Livré sur `claude/50-faux-verts` (ef34ef7 à fbb81e0), intégré à `claude/50-base`. verify complet sur machine calme, toutes branches de la nuit fusionnées : **2 006 réussis, 0 échec**, 2 ignorés, moteur conforme.
- **Typologie des 85 faux verts** :
  - 70 viennent de la **convention verticale**, c'est-à-dire la hauteur ;
  - 4 de la voie décalée, 2 du flanc partiel, 1 du nuage pauvre ;
  - 0 d'un mauvais minimum, 0 d'une validation en place.
  - Dans 81 cas sur 85, Mic garde le même minimum de la grille qu'Ariane et ne fait que corriger la hauteur.
- **Aucun signal ne trie les faux verts** d'une partie à l'autre (AUC de 0,52 à 0,78), comme dans G0. La règle « hauteur ambiguë » (`faux-vert-ombre`, calage ≥ 11 mm et dessus ≥ 14 mm) est consignée seulement. En validation croisée, son bilan net est nul.
- **Le vrai levier est la pose verticale**. Une correction apprise, de la forme a + b × épaisseur du dessus, ferait passer les faux verts de 85 à 66, mais elle en crée 7 nouveaux. Ce serait une pose différente : non livrée. Elle passera d'abord en ombre, et la décision reviendra à Mic. À rapprocher de l'ombre verticale à 3,6 mm (P8) et de l'abandon du plafond P1.

## D-161 — Hauteur apprise, en ombre : 85 → 61 faux verts sans en créer, en validation croisée (17 octobre 2026)

- Livré sur `claude/50-hauteur-apprise` (9503d42 à 6162729), intégré à `claude/50-base` par avance rapide. verify de l'agent : 2 023 réussis, 0 échec. Moteur intact.
- **Modèle** : part × (a + b × épaisseur du dessus), borné à ±5 mm.
  - Rail calé : demi-correction, un dessus épais descend de 1 à 3 mm.
  - Rail refusé : remonté de 5 mm au plus, descendu si le dessus dépasse 16 mm.
  - Abstention dans l'ornière d'un PN, sans calage lisible, ou sous 15 points.
- **Validation croisée par partie** : 85 → 61 faux verts, 24 corrigés, 0 créé. Partie 17 : 47 → 28. Partie 24 : 21 → 19. Partie 29 : 7 → 4. Second projet : 10 → 10.
- À comparer avec P8 (3,6 mm constant) : 85 → 68, avec 1 créé. **Les deux restent en ombre.** Seule la hauteur apprise a un chemin d'activation (`appliquer:false`). Les deux ne doivent jamais s'appliquer ensemble.
- **Preuve « ombre sans effet »** : décisions et commandes identiques sur les 1 380 cuts des 4 lots réels.
- **Limites** :
  - le gain tient dans le bruit de la référence : les cuts passent de 10 à 14 mm à 6 à 10 mm ;
  - le « 0 créé » dépend du seuil de 10 mm (6 créés à 9 mm) ;
  - le gain vient surtout de la partie 17, en 4.9.0.
  - Avant toute activation, il faut régler : l'appui mémorisé non corrigé, le calcul de `faux-vert-ombre` sur la pose non corrigée, et la marge de vue de 2 mm.
- Porte B du cahier v1.1, à juger sur des parties neuves.

## D-162 — Liste des verts à contrôler : 3 erreurs sur 4 en 5 fois moins de relecture ; test 5 lancée (17 octobre 2026)

- Livré sur `claude/50-verts-a-controler` (2de2d30 à 2878e86), intégré à `claude/50-base` (0f96f17). verify complet sur une machine calme : **2 047 réussis, 0 échec**, moteur conforme.
- **Le calcul se fait en fin de lot.** La liste s'affiche dans le panneau, groupée par plages (« grappe 268–278 », « PN 1656–1663 »), avec le temps estimé, et elle est jointe à l'export (`ariane-verts-a-controler-partieN-….json`). **Aucune action dans ESV.** Elle est active par défaut ; le réglage `vertsAControler` la coupe.
- **Le classement** combine l'écart d'écartement à la médiane de la partie, le saut de hauteur par rapport aux voisins, les rouges proches et les différés voisins.
- **Rejeu** :

  | Partie | À contrôler | Verts relus par Mic | Erreurs de plus de 10 mm trouvées | Temps |
  |---|---|---|---|---|
  | 29 | 121 | 584 | 63 sur 83 (76 %), dont 38 des 39 gros écarts | 7,5 min au lieu de 36 |
  | Partie 1 du second projet | 77 | 275 | 27 sur 35 | 4,8 min au lieu de 23 |
  | 17 (4.9.0) | — | — | 53 % seulement | — |

  En validation croisée du seuil, 77 % des erreurs sont trouvées en relisant 25 à 32 % des verts.
- **Limites** :
  - toutes les parties ont servi à apprendre les poids ;
  - la liste réelle sera plus longue (estimation pessimiste en partie 29 : 154 verts, soit 9,5 minutes) ;
  - il faut que la liste ESV ait été chargée en entier ;
  - les ADV restent invisibles.
- **Test 5 lancée** depuis `claude/50-base` (0f96f17), sur `claude/495-test-5`. Elle sera relue au niveau maximal avant d'être envoyée à Mic. Le mode rapide reste tel quel tant que Mic n'a pas tranché D-157.

## D-163 — 4.9.5 test 5 : relue au niveau maximal, envoyée à Mic (17 octobre 2026)

- Construite sur `claude/495-test-5` (fb7dad9, d7b89ba, f89e00b, c2dc0e0), à partir de la base 5.0 (0f96f17), puis réintégrée dans `claude/50-base` par avance rapide. Version 4.9.5.5.
- **Relecture indépendante au niveau maximal, en lecture seule. Verdict : envoyer.**
  - Aucune ombre ne peut toucher la pose, la commande, les appuis ni les cuts envoyés.
  - Tous les chemins d'activation sont coupés.
  - Les écouteurs de l'Écho sont passifs.
  - La liste des verts n'envoie rien à ESV.
  - Déplacer la vue, coupé, est inerte.
- **Deux points importants de la relecture, corrigés avant l'envoi** :
  - I-1 : l'ombre « mémoire des différés » de l'Écho relance deux fois le moteur par différé, et ce coût n'a pas été mesuré au banc. Elle est **coupée au terrain** (`memoireDifferesOmbre.actif=false`), car les données de l'Écho passent avant et Mic ne veut pas de ce mode (D-155). Les essais la jouent toujours active.
  - I-2 : la consigne est complétée (faux vert douteux, message « Liste d'ESV non lue »).
- verify : 2 046 réussis, 0 échec, 2 ignorés. Moteur identique à `main`.
- **Paquet** `ariane-4.9.5-test.5.zip` : 2 075 808 octets, SHA-256 `594a026b13d1fe7e1d159ea246b60f43627dccb977652b7d60f94b72ff7a6fea`. Le premier paquet, construit avant la relecture, n'est pas envoyé.
- **Contenu** : tout ce que contenait la test 4, plus :
  - en ombre : voie prédite, règles métier, faux vert « hauteur ambiguë », hauteur apprise, P8 ;
  - en observation : le relevé des gestes en Écho, la liste des verts à contrôler et la dernière empreinte de contrat ;
  - coupé : déplacer la vue.
  La pose est inchangée. Le mode rapide est inchangé, D-157 attend Mic.
- Points utiles de la relecture, gardés pour la test 6 : le retour arrière sans « Recharger », l'ordre de lecture du journal dans `vertsAControler`, `BananeSettings` non gelé, la liste absente d'un export sans zip.

## D-164 — Vague 4 intégrée : clic humain du mode rapide (3 réglages), détection des ADV, points utiles (17 octobre 2026)

- Le conteneur a redémarré pendant la nuit, mais les trois chantiers avaient fini leurs commits. Je les ai vérifiés et poussés. Ils sont intégrés à `claude/50-base` : verify **2 075 réussis, 0 échec**, moteur conforme.
- **Clic humain du mode rapide** (`claude/50-rapide-humain`, `fiches/RAPIDE_HUMAIN.md`) : réglage `pilote.rapide.clicHumain`.
  - `'tel-quel'` (défaut) : comportement actuel.
  - `'gauche-recentre'` : plus aucun clic hors fenêtre, pour +6 à +9 % de durée de lot. Le rail droit reste posé « à la machine » (clic dans la même milliseconde que le bouton), et l'ordre des rails change.
  - `'tout-recentre'` : +12 à +18 % de durée de lot.
  - Avec les deux modes corrigés : 0 clic hors vue, mêmes poses, 0 différé de plus, mesuré au banc sur deux lots réels.
  - Garde-fou consigné `clic-hors-vue` dans tous les modes.
  - Arrondi des demi-pixels : biais d'environ 0,19 mm par axe, et la reprise à −0,5 px ne sert jamais. Rien n'est changé.
  - **Mic (17 octobre) : « essayer les 2 méthodes »** → test 6 avec un choix dans le panneau.
- **Détection des ADV** (`claude/50-detection-adv`, `fiches/DETECTION_ADV.md`) : signal du « rail de plus » dans le profil en travers (aiguille, contre-rail, cœur).
  - **8 zones de Mic sur 8**, 12 aiguilles sur 12, aucune plage sans ADV, aucun PN pris pour un ADV.
  - Zone `adv` en ombre dans les règles métier. Branchée sur la liste des verts : au second projet, 33 erreurs sur 35 au lieu de 27, et 20 gros écarts sur 20, pour 7 verts de plus.
  - Toutes les parties étiquetées ont servi à régler.
- **Points utiles de la relecture de la test 5** (`claude/50-utiles-t6`) :
  - verts à contrôler : le dernier lot fait foi ;
  - la liste est jointe aussi à l'export sans zip ;
  - `BananeSettings` gelé ;
  - fiches corrigées ;
  - `memoire-differes` coupé en deux fichiers ;
  - la phrase de retour arrière pour la test 6 (désactiver, redécompresser, réactiver, Recharger, F5).

## D-165 — 4.9.5 test 6 : choix du clic et règle « grappe » dans le panneau ; relue au niveau maximal, envoyée (17 octobre 2026)

- Demandes de Mic : « essayer les 2 méthodes » pour le clic du mode rapide, puis « go » pour un interrupteur de la règle grappe.
- Construite sur `claude/495-test-6` (b56172f à 2d60d04), depuis la base a362a29, puis réintégrée dans `claude/50-base` par avance rapide. Version 4.9.5.6.
- **Panneau** :
  - choix du clic : « Comme avant » (défaut), « Variante : rail gauche recentré », « Tout recentré, comme un humain » ;
  - case « Règle métier : grappe », décochée par défaut. Allumée, elle ouvre le chemin d'activation de `grappe-differes` seulement, et ne peut que différer.
  - Les deux choix sont gardés dans `storage.local`, figés par lot, consignés dans `batch-started`, dans l'export et dans `CONTENU.txt`. Les règles restent en ombre dans tous les cas.
- **Relecture indépendante au niveau maximal, en lecture seule. Verdict : envoyer.**
  - Par défaut, l'empreinte des commandes est identique à celle du code de la test 5.
  - Les modes corrigés ne font aucun clic hors de la partie visible.
  - La règle ne fait que différer, et aucun appui n'est pris sur un cut différé.
  - Le coût de l'ADV est de 7 ms par cut.
  - verify : 2 093 réussis, 0 échec.
- **Points de la relecture** :
  - I-1 : en mode corrigé, un clic hors de la fenêtre arrête le lot en erreur, là où « Comme avant » cliquait quand même. Cela n'arrive que si le canevas d'ESV dépasse la fenêtre. Consigne passée à Mic par message : fenêtre grande ; en cas de « Position proposée hors de la vue », exporter et repasser en « Comme avant ».
  - I-2 : mesurer dans l'export l'effet indirect de la règle sur les appuis.
  - Utiles : `CONTENU.txt` ne décrit que le dernier lot, et le `DECISIONS.md` du paquet est en retard.
- **Paquet** `ariane-4.9.5-test.6.zip` : 2 120 050 octets, SHA-256 `63cb96d3dfe30ef23a487f160d9ba45b0f3fa2ba3c777a140bdc4d09ef2d0b6e`.

## D-166 — Premier lot de la test 6 au terrain (partie 8, second projet) : Variante sans clic hors vue, règle grappe active mais jamais déclenchée (17 octobre 2026)

- Lot du 17/10, de 9 h 57 à 10 h 00, archivé dans banane-data (`2026-10-17_v4.9.5.6_projet2-partie-8`). Choix du lot, consignés dans `batch-started` et dans `CONTENU.txt` : `clicHumain: gauche-recentre`, `regleGrappeDifferes: true`.
- 31 invalides : 29 posés (dont 14 par la voie) et 2 différés. Cycle médian 1,78 s, P90 5,9 s : la médiane est la même qu'en partie 29 avec la test 3 (1,76 s).
- **Clic hors vue : aucun événement `clic-hors-vue`.** La Variante a supprimé les clics hors fenêtre (à confirmer sur un lot plus long).
- **Règle grappe** : active, mais aucune grappe dans ce lot (0 différé autour). Aucun cut n'a été mis en attente par la règle.
- **Ombres** : `regles-metier-ombre` voit un PN (« cœur ») sur 7 cuts et des zones d'ADV. La carte « À contrôler » a été vue chez Mic : 17 cuts, ADV 846–911, autour du différé 899, ADV 5467–5555 et PN 5936–5954, environ 1 minute.
- **Défaut d'affichage** : après la fin du lot, la case cochée affiche « Activée pour le prochain lot », alors qu'elle était déjà active pour ce lot. Mic a cru qu'elle n'avait pas servi. Le libellé est à corriger à la prochaine version : dire ce qu'a utilisé le dernier lot et ce qu'utilisera le prochain.

## D-167 — Test 6, partie 9 en « Tout recentré » : la règle grappe agit ; Mic attend que les règles métier s'appliquent aux PN et aux ADV (17 octobre 2026)

- **Partie 9**, second projet. Lot parti à 10 h 04, exporté à 10 h 06, archivé (`2026-10-17_v4.9.5.6_projet2-parties-8-9`), choix `tout-recentre` et règle grappe activée.
  - 29 posés et 13 différés. **La règle grappe a mis 4 cuts en attente** (7002, 7353, 8623, 8624).
  - 0 clic hors vue.
  - Cycle médian 2,41 s, contre 1,78 s en Variante sur la partie 8. Ce sont deux parties différentes, on ne peut pas encore conclure.
  - Ombre : PN reconnu sur 4049–4056.
- **Second lot sur la partie 8 (10 h 01)** : la partie était déjà finie, donc le lot a seulement revalidé le cut 5948 puis il est sorti. Mic a cru à un défaut ; il faut un message clair quand il ne reste rien à faire.
- **Malentendu** : Mic s'attendait à ce que la case « règle métier » applique ses règles aux aiguilles et aux PN. Le libellé « grappe (aiguille, série de rouges) » est trompeur. Sur la partie 8, Ariane a posé 6 cuts dans l'ADV 846–911, 15 dans l'ADV 5467–5555 et 8 dans le PN 5936–5954. Seule l'ombre PN aurait gardé 7 de ces cuts.
- **Proposé à Mic** : trois cases claires (PN, ADV, série de différés), et le choix entre « Ariane me laisse ces zones » et « elle pose et me les signale ».

## D-168 — Mic : « Ariane doit savoir poser par elle-même, c'est le but » ; les zones PN et ADV ne lui sont pas laissées (17 octobre 2026)

- Réponse à D-167 : Mic écarte « Ariane me laisse les zones ». Les cases « me laisser chaque cut d'un PN / d'un ADV » ne seront **pas** construites. Pour l'instant, Ariane pose dans les zones et les signale dans « À contrôler » (choix B).
- **Cap** : qu'Ariane applique elle-même la méthode de Mic dans les zones, y compris le contrôle des **verts**, dont elle ne visite aucun aujourd'hui. Les grosses erreurs d'extraction se trouvent dans ces verts.
- **Chantier lancé** : `claude/50-zones-autonomes`, au niveau fort.
  - Qualité des poses d'Ariane dans les zones.
  - Correction prudente des verts de zone, mesurée sur les Échos.
  - Coût en temps.
  - Trace laissée en visitant un vert.
  - Ombre `zones-ombre` si une règle tient.
- La visite des verts est une action nouvelle dans ESV : elle sera décidée avec Mic, chiffres en main.
- La case grappe reste, avec un libellé à corriger : « série de différés », et non « aiguille ».

## D-169 — Lot des parties 2, 3, 4, 6, 7 du second projet (test 3) : bilan et premières prédictions scellées avant Écho (17 octobre 2026)

- **Bilan** (sans Écho) :

  | Partie | Décidés | Posés | Différés |
  |---|---|---|---|
  | 2 | 89 | 61 | 28 (31 %) |
  | 3 | 38 | 37 | 1 (3 %) |
  | 4 | 55 | 48 | 7 (13 %) |
  | 6 | 83 | 72 | 11 (13 %) |
  | 7 | 151 | 130 | 21 (14 %) |

  - Débit de 1 000 à 1 225 cuts par heure, cycle médian de 2,4 à 2,6 s. Aucun incident.
  - Pas de voie décalée d'ensemble comme en partie 1 : 53 des 68 différés sont en zone d'ADV.
  - Un avis de contrat probablement faux (classes des boutons de rail).
  - Ariane pose le cut 1 de chaque partie et le cut 0 de la partie 2, alors que Mic les ignore en partie 1 (SKIP).
- **Prédictions figées** avec les réglages de `datasets/reglages-figes.json` (empreinte bff4c5ba…) et la base 2d60d04. Fichier `PREDICTIONS.json`, SHA-256 `9deaa9a17cc273e20a5a42d72a17cb629d49cb66c57df9f702a90878387d7196`, déposé dans banane-data (`travail/2026-10-17_predictions-projet2-p2-p7`) **avant toute Écho**. Il prédit :
  - voie prédite : 0 différé posable ;
  - règles métier : 18 PN et 15 ADV, avec 123 cuts qui seraient mis en attente si toutes les règles étaient actives ;
  - hauteur apprise : 41 cuts changés, dont 5 au plafond de +5 mm ;
  - verts à contrôler : entre 103 et 214 verts, soit 6 à 13 minutes.
- Demande à Mic, quand il fera les Échos : noter les PN et les ADV, faire toute la partie 2, les zones d'ADV des parties 6 et 7, les 5 cuts à +5 mm, et relire tous les verts d'une partie courte en chronométrant.

## D-170 — Recadrage de Mic : la 5.0 doit faire elle-même la relecture qu'il fait en Écho (17 octobre 2026)

- **Mic** : « le but n'est pas de me laisser plus de travail avec des contrôles à effectuer ; l'application des règles métier vise à réduire ce travail de contrôle ; Ariane doit savoir le faire ; j'ai distribué de nombreux lots Orbite → Écho montrant la méthode, et c'est ce que j'attends d'Ariane sur la 5.0 ».
- **Ce que je corrige** : la liste « À contrôler » et les mises en attente (règle grappe) ne sont que des étapes. Elles laissent encore le travail à Mic. Le cap de la 5.0 est une **relecture autonome** : après les rouges, Ariane visite ce que Mic aurait visité (autour des rouges, PN, ADV avec leurs marges, cuts isolés, verts compris), corrige comme lui (moteur et hauteur apprise), puis valide.
- **Mesure de réussite** : la part des corrections de Mic, dans ses couples Orbite et Écho, qu'Ariane reproduit seule à 5 et à 10 mm près, face aux cuts justes qu'elle abîme. On la mesure en validation croisée par partie, puis sur des parties réservées.
- Le chantier `claude/50-zones-autonomes` est élargi à toute la relecture : fiche `RELECTURE_AUTONOME.md`.
- **Question posée à Mic** : Ariane peut-elle visiter des cuts verts dans ESV, d'abord sans rien modifier (visite, calcul, note), puis en corrigeant une fois les chiffres validés ?

## D-171 — Accord de Mic : Ariane peut visiter des cuts verts dans ESV, d'abord sans rien modifier (17 octobre 2026)

- Mic : « je suis d'accord ». La relecture autonome (D-170) commence par une **ombre de terrain**. Après le lot, Ariane visite les cuts que Mic aurait relus, verts compris : zones PN et ADV avec leurs marges, abords des rouges et des différés, cuts isolés, liste « À contrôler ». Pour chacun, elle capture, calcule la pose qu'elle donnerait (moteur et hauteur apprise) et note l'écart avec la pose actuelle. **Elle ne modifie rien et ne valide rien.**
- La correction réelle viendra plus tard, avec Mic, une fois les chiffres validés sur des parties réservées avec Écho.
- Chantier lancé : `claude/50-relecture-ombre`, au niveau fort. Réglage coupé par défaut, case dans le panneau. La trace est celle d'une visite humaine.

## D-172 — Règle SKIP de Mic pour les premiers cuts (et tous les autres) (17 octobre 2026)

- Mic : « si aucun point ne s'affiche oui, si un seul scanner s'affiche oui c'est à skip aussi, sinon il ne faut jamais les ignorer, il faut les visiter et corriger si besoin ».
- **Règle** : un cut se met en SKIP seulement si **aucun point** ne s'affiche, ou si **un seul scanner** s'affiche. Dans tous les autres cas, cuts 0 à 3 compris, Ariane le visite et le corrige si besoin, comme les autres.
- Le cut 1 de chaque partie posé par Ariane au lot des parties 2 à 7 (D-169) n'est donc pas une faute en soi : il faut vérifier s'il avait des points des deux scanners.
- Aujourd'hui Ariane refuse tout SKIP. Pour suivre la règle : d'abord une **détection en ombre** (« ce cut serait à SKIP : aucun point / un seul scanner »), notée au journal et comparée aux SKIP de Mic dans les Échos ; l'envoi réel du SKIP, par le même geste qu'un humain, reste coupé et ne s'active qu'avec Mic.

## D-173 — Condition de Mic pour la test 7 : règles métier fonctionnelles et UX réorganisée (17 octobre 2026)

- Mic : la test 7 ne se fabrique **que lorsque l'avancée sur les points du matin est réelle** (D-170 à D-172 : relecture autonome, pose seule en zones PN et ADV, règle SKIP). Elle doit être **fonctionnelle sur les règles métier** : elles agissent, pas seulement en ombre.
- Ce que j'en tire : chaque règle qui agit dans la test 7 doit avoir ses chiffres au banc, mesurés en validation croisée sur parties d'apprentissage puis jugés sur parties réservées, avec 0 mauvaise voie. Ce qui ne tient pas reste en ombre et c'est dit à Mic.
- Mic veut aussi une **réorganisation propre du panneau**, désorganisé par les derniers ajouts. Le chantier `claude/50-panneau-t7` est élargi : inventaire, nouvelle structure (lot, règles du prochain lot, résultats, relecture, détails repliés), sans perte d'information ni changement vers ESV.
- Temps et calcul : gros calculs et essais autorisés jusqu'au retour de Mic.

## D-174 — Relecture autonome : la correction des verts de PN peut agir, le reste reste en ombre (17 octobre 2026)

- **Fait (étude `claude/50-zones-autonomes`, fusionnée dans 50-base)** : la sélection « méthode de Mic » contient 94 % de ses corrections de plus de 10 mm.
- **Règle figée** (`datasets/relecture-reglages-proposes.json`) : 8 mm au moins, 45 mm de latéral au plus, écartement à 15 mm au plus de la médiane, sur les verts seulement, jamais un cut posé ou différé par le lot.
  - En validation croisée : 79 justes, 0 mauvaise voie, 6 abîmés sur 1 445. **PN 36/36.** ADV 18 % d'erreurs, abords 14 %.
  - Sur les parties réservées 1:25 et 1:11 : 0 mauvaise voie, PN 3/3.
- **Décision** :
  - dans la test 7, seule la correction des verts de PN est proposée en mode « corriger » ;
  - ADV, abords, verts hors zone, cuts du lot et SKIP restent en ombre ;
  - le réglage reste coupé par défaut ; Mic choisit le mode dans le panneau.
- **Non démontré** : la porte des 9 % demande 39 actions sans erreur, et il n'y en a que 9 de jugées. Les Échos des parties 2 à 9 du projet 2 suffiraient.
- **Suite** : atelier P-7 pour la pose en ADV, aux abords et dans les grappes. La SKIP « un seul scanner » ne se mesure pas : ESV fond les scanners en un seul nuage.

## D-175 — Revue de la relecture de fin de lot : pas de fusion avant 11 corrections (17 octobre 2026)

- **Revue adverse** : quatre angles (écritures, trace, fidélité à l'étude, régressions), chacun repris par un sceptique. Synthèse dans `scratchpad/revrelo/SYNTHESE_REVUE.md`, hors dépôt.
- **Ce qui tient (F)** :
  - mode coupé : commandes identiques octet pour octet (5 scénarios et un lot réel rejoué, 335 commandes) ;
  - mode ombre : aucune commande d'écriture ;
  - le code rend la décision de l'étude sur 1 323 cuts sur 1 323 ;
  - PN : 36 justes, 0 erreur, 0 mauvaise voie.
- **Ce qui bloque (F)** :
  - le rôle « vert » est présumé : un SKIP de Mic, un cut repris à la main ou le dernier cut d'un lot borné peuvent être corrigés, jusqu'à écraser une correction de Mic ;
  - deux passes peuvent tourner en même temps.
- **Constats importants (F)** :
  - **le geste de validation** : Mic valide toujours par **Maj+Espace** (1 377 fois sur 1 377 dans les Échos), jamais par Ctrl+Entrée ;
  - **les réglages** : s'ils sont absents ou faux, la règle retombe sur un défaut plus permissif ;
  - **le plafond de 120 cuts** coupe les PN ;
  - **la chaîne d'appuis** part des poses du lot, contrairement à l'étude ;
  - **le rythme** : il n'y a pas de pause, et la passe démarre 1,5 s après le lot.
- **Constat (F)** : en ombre, ESV écrit lui-même « vu » sur chaque cut neuf affiché. Une visite de Mic fait la même chose. Mais le panneau et la fiche disaient « ne modifie rien » : il faut les corriger et le dire à Mic.
- **Nuance de chiffre (F)** : 29 des 36 corrections PN justes viennent des parties 12 et 13, qui n'ont pas de lot. Sur des parties traitées par lot, on n'a que 7 PN sur 7.
- **Décision** :
  - la branche n'est pas fusionnée ;
  - un chantier de correction appliquera les 11 points ;
  - le mode « corriger » passera par le geste de Mic (Maj+Espace), ou restera verrouillé tant que ce geste n'est pas prouvé.

## D-176 — Avis de Mic sur la relecture de fin de lot ; rythme et départ (17 octobre 2026)

- **Mic** : « d'accord, on teste, je veux voir ce que ça donne. Je suis un peu dubitatif : je pensais qu'elle le ferait au fur et à mesure, comme un véritable opérateur. »
- **Ce que j'en retiens** : la façon naturelle, c'est d'appliquer la règle **au fil du lot**. Quand le lot passe dans un PN ou une ADV, ou sur un rouge isolé, il visite et corrige aussi les cuts voisins (verts compris), puis il reprend vers le rouge suivant.
  - La logique est la même que celle de la passe de fin de lot : sélection, calcul, règle prudente. Seul change le moment où elle s'applique.
  - La test 7 garde la passe de fin de lot, parce qu'elle est prête et revue. Le mode « au fil du lot » devient le chantier suivant ; il sera comparé à la passe sur les mêmes parties.
- **Rythme** :
  - pas de pauses artificielles, car le lot Orbite n'en fait pas non plus et Mic n'en voit pas l'utilité ;
  - **départ automatique juste après le lot, sans compte à rebours.** Mic : « pas besoin de toute cette fantaisie ; quand Ariane travaille, je ne corrige pas un cut ». Le bouton d'arrêt de la passe reste ;
  - cela remplace le point 10 de D-175, qui demandait des pauses et un départ au clic.

## D-177 — Mic livrera 1 000 à 1 500 corrections, avec une documentation, pour le méga cerveau (17 octobre 2026)

- **Mic** : il livrera « le double ou le triple » des 500 corrections prévues pour la GCV2 (lot G du plan), de quoi mesurer un vrai écart avec l'ancienne version. Il fera aussi joindre une documentation.
- **Protocole retenu** :
  - lot Orbite avec la version courante, puis Écho sur la même partie, exports d'origine gardés ;
  - de préférence des parties neuves, et pas seulement du projet 2 ;
  - les PN et les ADV notés (début, fin, aiguilles).
- **Partage des parties** : dans le manifeste, apprentissage ou réservée, **avant** toute lecture des résultats. Une partie sur trois environ est gardée pour le jugement.
- **Écart avec l'ancienne version** : mesuré hors ligne, en rejouant les mêmes captures avec l'ancien moteur et avec le nouveau. Mic n'a pas à faire tourner deux versions.
- **Documentation** : avant de la verser dans un dépôt, vérifier qu'elle n'est ni propriétaire ni sensible. Les deux dépôts sont publics. Sinon, la garder hors dépôt et n'en reporter que les règles, reformulées.
