# Architecture du développement restant de la 5.0 (22 octobre 2026)

Cadre le reste du chemin autour de `BANANE_5.0_CAHIER_V2.md` (D-239). Lecture seule au moment de l'écriture : rien n'est lancé, rien n'est modifié dans le code. Le tronc de code est `claude/50-test17` (test 18, 4.9.5.18) ; cette fiche doit y être reportée avec le cahier v2 et D-239.

## 0. Auto-audit du cahier v2 (corrigé dans le cahier le même jour)

| Faille trouvée | Correction |
|---|---|
| La base gelée (§ 3) n'était pas recalculée par l'orchestrateur, et le juge qui la produit est hors dépôt | Base gelée seulement une fois recalculée par le juge versé au dépôt (chantier 1), scellée par SHA-256 |
| Un total inchangé de cuts sans pose peut cacher un cut perdu et un cut gagné | Garde par cut : liste des cuts qui perdent leur pose, en plus de ceux dont l'erreur augmente de plus de 2 mm |
| La garde du banc ne prouve pas le vrai code de l'extension | Parité extension/banc rejouée à chaque changement du service worker |
| « Autonomie » n'était pas calculable | Définition : cut sans retouche = Écho ne le déplace pas de plus de 10 mm et ne change pas sa voie ; instrument : la jointure Écho-Orbite |
| Les parties d'examen pouvaient être réutilisées sous la même étiquette | Une partie d'examen s'ouvre une fois, gelée avant ; puis passe en apprentissage par décision écrite |
| Le cahier v2 et D-239 ne sont pas sur le tronc de code ; `DECISIONS.md` est éclaté sur deux branches | Report sur `claude/50-test17` au premier chantier, un seul `DECISIONS.md` |

Non corrigé, à décider par Mic : le cahier garde « deuxième passe allumée en écriture, sans limite » (son choix D-237) alors qu'aucune écriture réelle n'a encore eu lieu ; § 5 ci-dessous propose un protocole de première écriture plutôt qu'un retour en arrière.

## 1. Le système tel qu'il est (ce sur quoi on construit)

```
ESV (page Potree + jQuery)
   ▲ commandes DOM / lecture       │ événements, liste d'ESV, nuage
src/bridge.js (contenu)  ◄────────┘
   ▲
background.js (service worker, un seul onglet ESV : selectedTab)
   ├─ src/engine.js            GELÉ (épinglé) : chaîne de pose GCV1, premier passage
   ├─ src/lot-decision.js      décision du lot (first-pass, choice, window, crossing, deferred)
   ├─ src/gcv2-l1.js           GCV2 « L1 » : décision des différés en lot (recherche recentrée,
   │                           voie absolue, garde de voie, leviers v6)
   ├─ src/voie-recentree.js    paires recentrées dans le nuage
   ├─ src/regles-metier.js     zones PN / ADV (en ombre dans le lot)
   ├─ src/hauteur-apprise.js   correction verticale apprise (EN OMBRE)
   ├─ passe différés (dans background.js) : fin de lot, décision avec poses avant/après,
   │                           écriture dans ESV sous gardes, interrupteur Réglages
   ├─ relecture (dans background.js) : verts à contrôler, « Ombre » / « Corriger », pause
   └─ relevés en lecture seule, journal, export (journal, bilan, corpus, liste, verts)
   ▲
panel.js + src/ui5*.js (ancien panneau, v2, palette)

Hors ligne (banane + banane-data)
   exports ──► banane-data/collections (archive brute, SHA-256)
   tools/banc-differes.cjs rejouer   rejeu de la chaîne sur un lot archivé
   juger.cjs (HORS DÉPÔT, scratchpad)  jugement contre la vérité Écho
   cv.cjs (hors dépôt)               validation croisée par partie
   tools/parite-l1se-sw.cjs          parité extension / banc (--passe)
   tools/jointure-echo-orbite.cjs    jointure Écho ↔ Orbite par cut
   tools/gcv2-jeu.cjs, gcv2-apprendre.cjs   hypothèses et apprentissage hors ligne (G1-a/b)
   tools/hauteur-apprise.cjs         modèle de hauteur
   datasets/manifeste-parties.json   apprentissage / examen / témoin
```

Points d'appui déjà là : le générateur d'hypothèses par cut (H0 à H5, `gcv2-jeu.cjs`), la décision des différés avec voisins avant et après (passe), la jointure Écho-Orbite, le manifeste, la parité. Trous : juge hors dépôt, aucune maquette ESV dans `verify`, aucune classe de provenance des appuis, décision de voie purement locale.

## 2. Modules à construire, et où ils se branchent

| # | Module | Emplacement | Se branche sur | Livrable mesurable |
|---|---|---|---|---|
| A | **Garde de non-régression GCV2** | `tools/garde-gcv2.cjs` ; `datasets/garde-gcv2/` (vérités Écho en comptes/mm/numéros, résultats attendus, SHA256SUMS) ; essai `tests/garde-gcv2.test.cjs` sur une fixture | `banc-differes rejouer` + juge versé (`tools/juger.cjs`, porté du scratchpad) | Une commande : rejoue la base, juge, compare au scellé, imprime la liste par cut (perdus, dégradés > 2 mm, gagnés), code de sortie rouge au premier recul |
| B | **Tableau de bord** | `tools/tableau-bord.cjs` ; sortie `fiches/TABLEAU_BORD.md` par version | juge, jointure Écho-Orbite, manifeste | Les 4 indicateurs du cahier § 4, chacun avec sa population et son intervalle (Wilson), par partie puis total |
| C | **Diagnostic « oracle » de la voie** | `tools/voie-oracle.cjs` (hors ligne, lecture seule) | `gcv2-jeu.cjs` (hypothèses), vérité Écho, zones `regles-metier` | Par bloc d'ADV : part des cuts où une paire de la bonne voie existe parmi les candidats à 5 / 10 / 20 mm ; part « candidat manquant » / « mal classé » / « appui contaminé » |
| D | **Décodage global de la voie** | `src/voie-decodage.js` (nouveau, pur, sans accès DOM), appelé d'abord par la passe différés | passe différés (elle a déjà avant + après et une zone) ; plus tard la décision du lot en ADV | Chemin de voie par zone (états = paires candidates dédupliquées, émissions = preuves du nuage, transitions = continuité écartement/dévers, changement de voie seulement en ADV), **abstention** si la marge au second chemin imposant une autre paire au cut est insuffisante. Jamais de pose sans preuve directe des deux rails |
| E | **Provenance des appuis (M2)** | `src/lot-decision.js` et `gcv2-l1.js` : classe sur chaque appui `{humain, chaine, l1, passe}` ; règle par zone | D-221 déjà : une pose L1 n'est jamais appui. Étendre : pose de la passe jamais appui ; en ADV, verts de chaîne non contrôlés = appuis faibles | Rejeu de la base sans perte (garde A) ; sur 3:0, les 4 verts de chaîne faux ne se propagent plus (mesuré) |
| F | **Contre-expertise des verts de chaîne** | déjà codée (leviers `contreChaine*`, banc seulement) ; à câbler dans `background.js` si Mic l'allume | gcv2-l1 | Gain net mesuré (verts rendus justes − verts dégradés) sur la base et sur 3:0 ; parité |
| G | **Maquette ESV dans `verify`** (S4, F2) | `tests/esv-maquette/` porté de `claude/esv-locale-audit` (f4f2720) ; rejeu court (~40 cuts) dans `verify`, complet avant paquet | bridge, background | Campagne de pannes exécutable : worker arrêté en pleine capture / pose / validation / écriture de la passe, F5 à chaque étape, 500 puis 204, 502 relancé, nuage vide, onglet caché, cible hors de la vue |
| H | **Preuve serveur (F4)** | `background.js` autour de `applied-verified` | relevés existants | Comprendre d'abord pourquoi `serverConfirmed` est faux sur 68/68 poses du lot de la partie 2 (normal ou défaut) ; puis 204 observé → confirmé, Δ au F5 |
| I | **Deuxième passe : cible hors de la vue** | `engine.js` (gelé) → décision de Mic sur le ré-épinglage ; sinon contournement par « déplacer la vue » (D-156) hors moteur | passe différés | Le majorant du banc se rapproche du réel : poses écrites / poses décidées sur les lots de terrain |
| J | **Précision sous 5 mm** | protocole hors ligne : 60 cuts repointés deux fois sans voir la pose précédente (lecteur hors ligne à écrire : `tools/repointage.cjs` sur les nuages archivés) ; comparaison hauteur apprise / correction nulle | hauteur-apprise.js, corpus archivés | Plafond de bruit mesuré (différences signées par axe, σ/√2 seulement si indépendance vérifiée) ; décision d'activer ou non la hauteur apprise au lot, sous la garde A |
| K | **Livraison** | fusion des lignées vers un tronc, `DECISIONS.md` unique, cahier signé, Edge, ancien panneau, étiquette | tout | 5.0 stable selon cahier v2 § 7 |

## 3. Dépendances et ordre

```
A garde ──► tout le reste (aucun paquet sans elle)
B tableau de bord ──► mesure de base d'autonomie (3:1, 3:5, Écho partie 2)
C oracle ──► D décodage (seulement si C dit « mal classé » plutôt que « candidat manquant »)
          └► élargissement de la génération d'hypothèses (si « candidat manquant »)
E provenance ──► D (les appuis typés sont les observations fortes/faibles du décodage)
G maquette ──► toute nouvelle écriture dans ESV (I, F allumée, D en écriture)
H preuve serveur ──► lecture fiable des lots de terrain
J précision : indépendant, démarre quand Mic a 2 × 1 h pour repointer
K : à la fin, mais le report sur le tronc se fait dès le chantier A
```

Ordre de travail proposé : **A** (et report cahier/D-239 sur le tronc) → **B** avec les Échos 3:1 / 3:5 et l'Écho des 63 cuts de la partie 2 → **C** → **E** → **D** → **G** en parallèle de C/E/D → **H** court dès maintenant (lecture seule) → **F** sur décision → **I** sur décision → **J** quand l'opérateur est disponible → **K**.

Effort (jours d'agent, S ≈ 0,5–1, M ≈ 2–3, L ≈ 5+) : A M · B M · C S · D L · E M · F S · G L · H S puis M · I M · J M · K M. Total de l'ordre de 25 à 30 jours d'agent, loin des 95 de la version 1 : le cœur est resserré.

## 4. Règles de fabrication (valables pour chaque chantier)

1. Une branche par chantier depuis le tronc, une fiche `fiches/PASSATION_<CHANTIER>.md`, essai rouge d'abord.
2. `node tools/verify.cjs` : 0 échec, 0 annulé (un essai lourd par fichier, délai de 20 s jamais allongé).
3. Garde A verte, liste par cut jointe ; parité rejouée si le service worker change.
4. Relecture indépendante (Opus) pour tout code qui touche l'écriture dans ESV ou la décision d'un cut ; Sonnet pour le reste ; Fable réservé au cadrage.
5. Jamais de nom d'opérateur, de code de projet, de capture d'ESV ni d'identifiant de modèle dans le dépôt ; `engine.js` intact sauf décision écrite de ré-épinglage.
6. Une nouveauté active à la fois dès qu'elle écrit dans ESV.

## 5. Protocole de première écriture réelle de la deuxième passe

La passe n'a jamais écrit dans le vrai ESV (lot de la partie 2 : 1 différé, 0 écrit). Avant de la considérer éprouvée :

1. Un lot sur une partie d'apprentissage avec au moins 3 différés attendus, Mic présent, export Orbite immédiat après le lot.
2. Attendu dans le journal : `passe-differes-ecriture-*` avec relecture à 1 mm et preuve de validation pour chaque cut écrit ; arrêt au premier refus avec le motif.
3. Écho des seuls cuts écrits par la passe le jour même ; jugement contre la vérité ; les poses de la passe entrent dans le tableau de bord à part (« posées par la passe »).
4. Tant que ce protocole n'est pas passé, le gain de la passe reste un majorant du banc dans toute communication.

## 6. Risques et parades

| Risque | Parade |
|---|---|
| Pose fausse écrite sans relecture humaine, définitive | Garde A, maquette G avant toute nouvelle écriture, protocole § 5, budgets D-223 avec intervalles |
| Chiffres de réglage pris pour des preuves | Tableau de bord par population ; parties d'examen ouvertes une fois |
| Décodage global qui renforce une voie fausse par des appuis autocorrélés | E avant D ; marge au second chemin ; ne jamais compter deux fois la même information (émission puis transition) |
| Juge et base divergent du scratchpad au dépôt | Chantier A recalcule la base et la scelle ; tout chiffre antérieur est dit « non scellé » |
| Disque et mémoire (1,9 Go libres) | Pas de copie de lots hors scratchpad ; instantanés supprimés après chaque rejeu ; un rejeu lourd à la fois |
| Quota : 9 % hebdomadaire | Fable pour ce cadrage seulement ; Sonnet par défaut ; Opus en relecture courte ; pas d'agent de recherche sans demande explicite |

## 7. Décisions attendues de Mic avant de lancer

1. Lancer le chantier A maintenant (rejeux longs, disque serré) ?
2. Contre-expertise des verts de chaîne : allumer pour mesure sous la garde, ou laisser coupée ?
3. Ré-épinglage de `engine.js` pour la cible hors de la vue (I), ou contournement hors moteur ?
4. Deux séances de repointage d'environ 1 h pour J, et une séance pour l'Écho des 63 cuts de la partie 2 ?
5. Projet de rattachement de la partie 2 (pour le manifeste).
