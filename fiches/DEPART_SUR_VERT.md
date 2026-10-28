# Départ d'un lot sur un cut vert : aucune écriture sur lui (test 7)

Origine : D-169 (« Ariane pose le cut 1 de chaque partie et le cut 0 de la partie 2 ») et l'audit P-5 (C1, C2, H12, H13).
Code : `background.js` (`departSurVert`, `passerAuRouge`, `cloreDepartSurVert`), `panel.js` (lignes de fin). `src/engine.js`
n'est pas touché.

## 1. Ce qui se passait

Le lot part du cut affiché par ESV. Si ce cut est déjà vert (`valid`, ou `skipped`), le lot le traitait comme un rouge :
capture, pose (`apply`), validation (`validateAndNext`, ou Ctrl+Entrée si le compteur faisait croire à un dernier cut).

- Partie 9 (test 6) : le cut 0, vert et non traité, est posé puis validé (écartement 1 434,0 → 1 429,7 mm). Le lot suivant
  repose le cut 1, déjà traité.
- Relance de la partie 8 (10 h 02) : départ au cut 5948, validé par le lot précédent. Le compteur dit 9 909 sur 9 911. Les
  2 rouges restants sont les cuts 1 et 899, différés par le lot précédent, donc **derrière** 5948. Le lot repose et revalide
  5948. ESV ne trouve aucun cut non validé devant et charge la partie 9. Ensuite : `capture-failed`, deux `batch-error`, pause
  `PAUSED_ADAPTER_UNRESPONSIVE`, et le lot ne se clôt jamais.

Banc (ESV simulé avec sa liste, comme la maquette de `claude/esv-locale-audit`), commandes reçues par ESV **avant** :

| Scénario | Commandes |
|---|---|
| p9 : départ au cut 0 vert, rouges 2 et 4 | `apply`@0, `validateAndNext`@0, `apply`@2, `validateAndNext`@2, `apply`@4, Ctrl+Entrée@4 |
| p9 : départ au cut 1 vert, rouges 3 et 7 | `apply`@1, `validateAndNext`@1, puis comme ci-dessus sur 3 et 7 |
| p8 : départ au cut 8 vert, rouges 1 et 3 derrière | `apply`@8, `validateAndNext`@8, puis ESV passe à la partie suivante |
| p8 sur la vraie liste du départ de 10 h 02 (9 911 cuts, rouges 1 et 899), départ 5948 | `apply`@5948, `validateAndNext`@5948, sortie de la partie |

## 2. Règle

Au **premier** cut du lot (rien de traité, un seul cut dans la séquence), après l'analyse et **avant toute commande**, et
seulement si la règle « partie complète » n'a pas joué :

1. le relevé du compteur « N on M treated » de ce cut (même partie, même cut, après le début du cut) donne M et N ;
2. la liste d'ESV en mémoire de la page (table de l'observateur, tenue à jour des écritures vues) est lue par le pont
   (`liste-instantane`). Il faut une seule table complète de M lignes ; la ligne i est le cut i ;
3. le cut y est vert (`valid` ou `skipped`).

Si l'une de ces informations manque ou est ambiguë, rien ne change, à l'octet près : sans elles, Ariane ne sait pas que le
cut est vert. Un cut rouge n'est jamais retenu.

Si le cut est vert, Ariane **n'y écrit rien**, puis :

| Cas | Ce qu'Ariane fait |
|---|---|
| Le premier cut non validé **devant** est rouge et dans les bornes | « Cut non validé suivant » (Maj+Z), puis le même lot repart sur ce cut |
| Aucun cut non validé devant, rouges **derrière** | Arrêt. Avis : « Partie P : le cut C est déjà validé. Plus aucun cut rouge après lui. Il reste N cuts rouges derrière : 1, 899. Rien n'a été envoyé à ESV. Pour les traiter : ouvre le cut 1 dans ESV, puis lance un lot depuis ce cut. » |
| Plus aucun rouge | Arrêt de la règle « partie complète » : « Partie P : plus aucun cut rouge à traiter. Le lot s'arrête ici. Aucune pose ni validation n'a été envoyée à ESV. » |
| Le cut non validé devant est passé (SKIP) ou de statut inconnu | Arrêt, rien envoyé |
| Le premier rouge devant est au-delà du dernier cut du lot | Arrêt, rien envoyé |
| La liste ne concorde pas avec le compteur (nombre de rouges ≠ M − N) | Arrêt, rien envoyé |
| « Cut non validé suivant » refusé par ESV, ou cut atteint inattendu (autre partie, hors bornes, rails pas prêts) | Arrêt dit ; rien d'écrit |

« Reprendre » sur un lot arrêté ainsi ne rejoue rien. Si le service worker redémarre entre la décision et la navigation,
« Reprendre » refait la navigation, jamais la pose sur le cut vert.

## 3. Le geste choisi, et pourquoi

**« Cut non validé suivant »** : bouton `O2N3DCutNextInvalid3DRail`, raccourci Maj+Z, action `nextWithoutDecision` de
`src/adapter-page.js`.

- C'est le geste de l'opérateur pour passer au rouge suivant **sans décision**. Dans le code d'ESV, il appelle
  `buttonNextInvalidCut()` puis `loadNextInvalidCut("positive")`. Les écritures `railPairUpdated('valid' | 'skipped')`
  passent par d'autres chemins.
- Il mène au **cut non validé suivant**, pas au cut suivant. Pas besoin de parcourir les verts.
- Le lot l'emploie déjà pour chaque différé : bouton contrôlé avant le clic, au plus un clic par opération, cut d'arrivée
  relu.
- Sur la maquette, comme ses titres le disent, il saute les cuts `valid`, s'arrête sur un `skipped`, et il est désactivé
  s'il n'y a rien devant. Ariane ne l'utilise donc que si la liste montre un rouge devant.

**Pourquoi ne pas revenir aux rouges derrière** (cas de la partie 8) :

- ils sont hors des bornes du lot, que l'opérateur a validées (premier cut 5948) ;
- le retour à un cut par l'événement interne d'ESV (`goToCut`, chemin « événement ») n'est pas vérifié sur le vrai ESV ;
- le chemin pas à pas est borné à 40 cuts (il en faudrait 5 049 pour aller de 5948 à 899) ;
- élargir les bornes de soi-même changerait le choix de l'opérateur.

Ariane s'arrête donc, sans rien envoyer, et nomme les cuts. L'opérateur les ouvre d'un clic.

## 4. Ce que le serveur d'ESV voit

D'après le code d'ESV observé et la maquette ; non revérifié sur le vrai ESV.

| | Avant | Après |
|---|---|---|
| Cut vert de départ | une écriture de validation (PUT de la ligne : `ExtractionStatus: valid`, six bords issus de la pose d'Ariane, `TreatedByOperator`, `SeenByOperator`) | **aucune écriture d'Ariane**. La capture lit les points déjà affichés, comme un opérateur qui regarde le cut |
| Passage au rouge suivant | ESV charge le cut non validé suivant après la validation | ESV charge le même cut, après Maj+Z : mêmes chargements (rails, points), même éventuelle marque « vu » qu'ESV pose lui-même sur un cut affiché |
| Lectures de départ (compteur, liste) | — | mémoire de la page seulement : aucune requête réseau |
| Arrêt (rouges derrière, rien devant…) | validation du cut vert puis chargement de la partie suivante | **rien** |

À partir du premier rouge, les commandes et leurs arguments sont **identiques** à ceux d'avant : mesuré au banc, base et
branche, empreintes égales.

## 5. Mesures (banc, base contre branche)

| Scénario | Avant | Après |
|---|---|---|
| p9, départ au cut 0 vert | 2 écritures sur le cut 0 | 0 écriture ; Maj+Z ; puis 2, 4 identiques |
| p9, départ au cut 1 vert | 2 écritures sur le cut 1 | 0 écriture ; Maj+Z ; puis 3, 7 identiques |
| p8 synthétique, rouges derrière | 2 écritures, sortie de la partie | 0 commande ; arrêt avec la liste |
| p8 sur la vraie liste (5948, rouges 1 et 899) | 2 écritures sur 5948, sortie de la partie | 0 commande ; arrêt sans erreur, avis « 1, 899 » |
| Premier cut rouge | — | identique à l'octet |
| Partie complète, cut vert | 0 commande (règle d'avant) | identique |

## 6. Limites

- Sans compteur lisible pour ce cut, ou sans table unique de M lignes, rien ne change. Le lot peut alors encore écrire sur
  un cut vert, puisqu'Ariane ne sait pas qu'il l'est.
- `dernierCutCertain` compte encore comme « devant » les rouges qui sont derrière (audit P-5, C1). Au banc, sans liste, un
  départ sur un cut vert avec un seul rouge restant devant est validé sur place (Ctrl+Entrée) comme un « dernier cut ».
  Avec la liste, la règle ci-dessus passe avant. La fonction n'est pas modifiée ici.
- La sémantique exacte de « cut non validé suivant » sur le vrai ESV (s'arrête-t-il sur un SKIP ? que fait-il sans rouge
  devant ?) vient de la maquette et des titres des boutons. Ariane ne s'en sert que si la liste montre un rouge devant, et
  contrôle le cut atteint.
