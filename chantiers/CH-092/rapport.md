# CH-092 — Rapport : relecture en adversaire de « Vision 8 » à « Vision 10 »

Diff relu : `d4238bf..40df88a` (CH-081, 083, 084, 085, 086, 087, 088, 089), fichiers protégés compris. Aucun fichier de `src/` ni `background.js` modifié. ÉTABLI = reproduit par un essai rouge marqué `todo` (`tests/ch092-*.test.cjs`, 10 essais, corps rouges, fichiers verts). Aucun chiffre de terrain : tout est mesuré en vm, données synthétiques.

## Défauts, du plus grave au moins grave

**1. MOYEN, ÉTABLI — après une pause `ECRITURE_NON_CONFIRMEE`, « Reprendre » ne repasse aucune porte (CH-086).** `src/engine.js:132-146` (`porteEcritures`), `:1050-1054` (pause), `:1206` (`resume`).
- Chemin exact : la validation du cut N revient (fenêtre ouverte) ; IndexedDB refuse `putEvent` à partir de cet instant. À la porte « intention-de-pose » du cut N+1, les écritures en vol ont échoué, la reprise unique (`reecrireFenetre`) échoue aussi : pause motivée, `fenetreEcritures` remis dans l'état. Mais `this.fenetre` vaut déjà `null` (mis à null à l'entrée de la porte) et `resume()` ne relit pas `fenetreEcritures`.
- Conséquence 1 (stockage réparé, puis Reprendre) : le lot finit, mais les événements de la fenêtre ne sont jamais réécrits dans IndexedDB. Perdus du journal dans l'essai : `validation-observation`, `validation-accepted` du cut N, `cut-target-changed`, `before-captured`, `proposed` du cut N+1. La fenêtre suivante écrase la liste `fenetreEcritures`. Seul un redémarrage du service worker (`init()`) les rattrape, tant qu'ils sont dans les 150 derniers événements de l'état.
- Conséquence 2 (stockage toujours en panne, Reprendre) : la pose du cut N+1 part quand même (`apply:102` dans l'essai), puis l'écriture attendue échoue et le lot passe en rapprochement. Le message de pause dit « Reprendre quand le stockage répond » ; rien ne le vérifie.
- Non reproduit : aucune pose ni validation en double, aucun SKIP, aucun cut validé sans décision. L'état (chrome.storage) garde `validation-accepted` ; la perte touche le journal IndexedDB.
- Voisin, SUPPOSÉ (non reproduit) : sur délai, la reprise continue en fond après l'abandon et fait `delete this.s.fenetreEcritures` plus tard ; si une nouvelle fenêtre s'est ouverte entre-temps, c'est sa liste qui est effacée.
- Essai : `tests/ch092-moteur-reprise-apres-porte.test.cjs` (1a, 1b, 1c).

**2. MOYEN, ÉTABLI (mécanisme) — après la pause de CH-089, le préchauffage ne repart plus si un de nos `load()` a échoué.** `src/prechauffage.js:411, 496, 502, 571-573, 696`.
- Chemin : 5xx d'ESV sur un de nos `load()`. Le nœud reste `loading===true` (comportement de Potree repris de CH-062, non remesuré ici) ; `nosEnVol()` le compte pour la vie de la page.
- Ligne de base allumée (réglage livré) : le compteur effectif retire l'échec, donc `chargements() !== nosEnVol()` pour toujours ; toute opération sort en `reseau-occupe`, l'opération lointaine n'est plus jamais libre. Sans ligne de base : deux nœuds bloqués prennent les `enVolMax` places.
- Conséquence : `actif` reste vrai, aucun `refus-serveur` posté. La panne de « Vision 9 » (un 502 arrête le préchauffage pour le lot) revient, muette. L'essai de CH-089 simule le 502 par une entrée de ressource, sans nœud bloqué.
- Essai : `tests/ch092-prechauffage-noeud-bloque.test.cjs`.

**3. MOYEN, ÉTABLI — plus de `hierarchiesMax` (8) frontières dans la boîte : la cible ne finit jamais.** `src/prechauffage.js:499, 504` (proche), `:578, 582` (lointaine).
- Chemin : la frontière au-delà du plafond est sautée (`continue`) sans entrer dans `lances` ; « cible finie » n'est jamais vrai. Opération proche : aucun événement `prechauffage`, les cibles suivantes du passage ne sont pas servies jusqu'au changement de coupe. Opération lointaine : l'arbre est reparcouru à chaque image (400 parcours en 400 images dans l'essai).
- Plus de 8 pages non lues dans une boîte réelle : PROBABLE, non mesuré. Coût d'un parcours sur le fil d'ESV : non mesuré.
- Essai : `tests/ch092-prechauffage-hierarchies.test.cjs`.

**4. FAIBLE, ÉTABLI (mécanisme) — `cache-inutile` (règle de CH-077) éteint la voie potree pour la page.** `src/prechauffage.js:446`. Cinq coupes justes où Potree redemande hors cache un nœud à nous : `actif=false`, opération lointaine `eteint`. Le déclencheur de terrain est SUPPOSÉ. Essai : `tests/ch092-prechauffage-cache-inutile.test.cjs`.

**5. FAIBLE, ÉTABLI — l'opération proche parcourt l'arbre à chaque image même sans place libre.** `src/prechauffage.js:496-498` (30 parcours en 30 images ; la lointaine, 0). Ralentissement d'ESV : PROBABLE, non mesuré. Essai : même fichier que le 3.

**6. FAIBLE, ÉTABLI — `enCapture` reste vrai après une capture qui lève.** `src/prechauffage.js:539, 632` ; `src/adapter-page.js:490, 541`. L'opération lointaine ne lance plus rien jusqu'à la prochaine capture réussie. Rien de bloqué pour le lot. Essai : `tests/ch092-prechauffage-capture-echec.test.cjs`.

**7. FAIBLE, corrigé sur le tronc (791ac2a) — motif `pause-serveur` absent des listes du service worker** (`background.js`, `OBS_PRECH_MOTIFS`, `OBS_PRECH_MOTIFS_LOIN`) : le journal recevait `motif:null`. Reproduit avant la correction ; pas d'essai livré ici.

**8. FAIBLE, déjà connu (CH-087) — prénom de l'opérateur dans une chaîne livrée**, `background.js:2655` (raison d'une décision des règles métier, coupées aujourd'hui). Pas d'essai livré.

## Longue séance (plusieurs centaines de coupes sans F5) : ce qui ne se remet jamais à zéro
- `erreursPassageres` : jamais remis à zéro après un succès ; le 3e épisode arrête tout, même à des heures d'écart. Un `load()` réussi mais plus lent que `delaiMs` compte. Écrit ainsi dans CH-089 ; risque sur un long lot PROBABLE, non mesuré.
- `memoire.octetsMax` (256 Mo par vie de la page) : atteint, plus rien jusqu'au F5 ; le motif posté est alors `plafond-noeuds` (`:503`), trompeur.
- Nœud bloqué du défaut 2 : compté pour la vie de la page.
- `loadHierarchy()` sans échéance : une page qui ne répond jamais garde une place jusqu'à la fin de l'opération (SUPPOSÉ).
- Sans accumulation : `nosCles`, `ok200`, `attente`, `propres` (vidés par plafond), `volNous` (purgé au-delà de 64), `nosNoeuds` (WeakSet). Moteur : la fenêtre est fermée à chaque cut ; `s.events` plafonné à 150.

## Zones relues sans rien trouver
- **(a) CH-084, attentes observées** (`src/adapter-page.js`) : l'écriture « valid » doit être de ce cut, envoyée après la frappe (même horloge que l'observateur), puis libellé stable ; le délai de 1 500 ms reste. Repli court et `imagesMin` : paramètres décidés (D-315), pas de chemin vers une mauvaise coupe trouvé.
- **(a) CH-086, arrêt du service worker dans la fenêtre** : les commandes vers ESV restent derrière les portes ; pas d'état durable nouveau trouvé.
- **(a) préchauffage** : aucune écriture dans ESV, caméra, `pointBudget`, `pointLoadLimit` (lus seulement).
- **(c) fuites** : champs postés = entiers, booléens, listes fermées, réduits deux fois ; `echecs` du moteur = messages du stockage.

## Non relu, non fait
- `tools/*`, `tests/esv-maquette/*`, `design/`, documents : lus en diagonale seulement. Aucun essai navigateur écrit (maquette non relancée : aucun chemin navigateur changé).
- Le comportement réel de Potree et d'ESV (nœud en échec, nombre de frontières par boîte) n'est pas mesuré : il faut un lot.
