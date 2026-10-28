# Orbite : la variante A retenue, reprise (14 octobre 2026)

L'opérateur a retenu la variante A « Accueil » (`../variantes/A-accueil.html`) et
demandé : plus de sobriété, des couleurs, de la cohérence, et un motion design
montré en vidéo. Il ne veut plus le bloc « Ce lot applique » dans l’interface.

- `orbite.html` : la maquette (données fictives). `?theme=sombre|clair` ;
  `?demo` joue la démonstration en boucle ; `?t=4800` fige un instant.
- `orbite-sombre.png`, `orbite-clair.png` : la page entière, au repos.
- `orbite-motion-sombre.mp4`, `orbite-motion-clair.mp4` : la démonstration
  (13,5 s, 30 i/s, 960 × 1760).
- Refaire : `node design/ux-2026-10/retenue/filmer.cjs`
  (`FILM_CLAIR=1` pour filmer aussi le thème clair).

## Ce qui change par rapport à A

**Couleurs : quatre rôles, pas un de plus.**
- Vert : seulement l’avancée (la tuile Lot, le cut en cours) et l’effet
  observé (navigation observée, ESV connecté).
- Ambre : les différés.
- Rouge : Arrêter le lot, et la garde de 30 mm.
- Tout le reste est neutre.

Le bleu « voie » disparaît : sur la ligne, un cut posé par la voie est une
case **creuse**, un cut posé par le moteur une case pleine. C’est la forme qui
porte l’état. Le titre « En cours » et l’interrupteur ne sont plus verts.

**Cohérence.**
- Une échelle de tailles : 104, 40, 34, 17, 15, 13, 11.
- Un seul rayon (18 px) et deux espacements : 10 px entre deux tuiles, 32 px
  entre deux sections.
- Tous les grands chiffres pèsent pareil, toutes les unités sont en 15 px.
- La courbe d’écart reprend le pas de la ligne.

**Sobriété.**
- La tuile à interrupteur mélangeait le bandeau et l’écart à la voie. Ce sont
  maintenant deux choses distinctes : une tuile « Écart à la voie » et une
  ligne « Bandeau dans ESV » avec son interrupteur.
- « pose · capture ✓ » devient trois points et un mot.
- « 3 étapes » de la commande : « Serveur non disponible » tient sur une ligne.
- La couverture suit le lot (« 43 sur 46 » après le cut suivant).

**Retiré.** Le bloc « Ce lot applique ».

## Le mouvement

Une seule courbe pour tout (sortie douce, rapide puis lente), un léger rebond
pour ce qui se dresse. Rien ne clignote. Avec « réduire les animations », tout
est figé.

| Instant | Ce qui bouge |
|---|---|
| 0–2 s | Le halo s’allume ; les blocs montent en cascade ; les chiffres du cut apparaissent un à un et se précisent ; la ligne se dresse en vague ; la tuile Lot se remplit ; la courbe se trace. |
| En continu | Le point « En cours » respire ; un reflet traverse lentement le vert du lot. |
| 2,7 s | Le cut passe à l’étape suivante (pose, puis validation). |
| 3–4,7 s | La commande « Valider » : la barre « émise » se remplit, puis « navigation observée » en vert ; le serveur reste en pointillé. |
| 4,3 s | Cut suivant : le dernier chiffre monte et s’efface, le nouveau arrive par en dessous. La case verte passe au cut 8456. Posés 42 → 43, 45 → 46 cuts, 43 sur 46. Une ligne d’activité arrive en haut et pousse les autres. Le point de 8455 rejoint la courbe. |
| 5,6–9,4 s | La vue descend jusqu’à l’écart et l’activité, puis remonte. |
| 9,9 s | Pause : la tuile s’enfonce. « En cours » laisse la place à « En pause » en ambre. Le halo et le vert du lot se désaturent. L’icône devient « Reprendre ». |
| 12 s | Reprendre : tout se rallume. |

## À trancher

D-045 exige que **la politique effective soit affichée**, et ce bloc était
cette preuve. Il est retiré comme demandé. Deux options :
- le mettre dans « Détails du lot » (un toucher) ;
- lever l’invariant (décision à inscrire dans `DECISIONS.md`).

## Intégration au panneau (14 octobre)

Décision de la session de pilotage sur D-045 : la règle n’est pas levée. La
politique effective quitte la vue principale et va dans « Détails du lot »
(fermé par défaut), avec les mêmes libellés et les mêmes `id=`. Si la
politique du lot n’est pas celle par défaut, une pastille courte le dit sur la
vue (`#lot-politique-pastille`, seul identifiant ajouté).

- `panel.html` : vue Orbite réordonnée (Détails du lot, héros avec la ligne et
  l’écart, commandes en tuiles, tuile du lot, Ce lot, dernière commande,
  activité, résumé de la partie). Tous les `id=` sont conservés.
- `panel.css` : nouveaux jetons (fond vert profond, tuiles), section « 4.9 —
  chantier UX » ; en pause, le halo et le vert du lot s’éteignent ; en cours,
  un reflet lent traverse le vert. Tout est figé si le système réduit les
  animations.
- `panel.js` : « Détails du lot » fermé par défaut ; `#lot-pct` écrit
  « 20 % » ; la pastille de politique.
- Essais : `tests/panel-ligne-suite.test.cjs` (Détails fermé par défaut),
  `tests/panel-h.test.cjs` (texte du pourcentage), nouveau
  `tests/ux-49-orbite.test.cjs` (pastille, politique dans les détails).
- `panneau-sombre.png`, `panneau-clair.png` : rendu du vrai `panel.html` et du
  vrai `panel.css` (sans `panel.js`, données fictives) par `rendre-panneau.cjs`.
- `node tools/verify.cjs` : 1444 réussis, 0 échec, 2 ignorés (corpus privé
  absent, comme avant le chantier).

Intouchés : `background.js`, `src/`, `vendor/`.

## Suite après la test 12 (14 octobre) — validée par l'opérateur

Demandes de l'opérateur après la test 12, et ce qui est fait :

1. **La tuile du lot**, grande, comme la maquette. Elle affiche :
   - le vert qui se remplit avec « 20 % », puis « 42 cuts » (les cuts traités) ;
   - la plage seule (« 8410 → 8640 ») ;
   - les trois points de l’étape du cut (capture, pose, validation).

   Les chiffres roulent quand ils changent.
   - Pourcentage : c’est la même règle qu’avant (position du cut courant dans la plage).
   - Lot « jusqu’à la fin de partie » : tant que la fin n’est pas connue, le panneau ne la connaît pas. La tuile montre alors les cuts traités, sans pourcentage ; rien n’est inventé.
   - Les trois points sont les étapes du cut, pas une pagination.
2. **Départs des parties** : la liste passe de « Détails du lot » à la vue. Il y a une carte par partie, avec sa fiche la plus récente : validés, invalides et total en grands chiffres, puis « dont N ignorés ». La partie en cours vient en tête et est cernée. Les chiffres restent posés en texte, jamais en HTML.
3. **Contrastes WCAG AA** (texte ≥ 4,5:1 sur le fond et sur les tuiles, dans les deux thèmes) : ambre, rouge, vert et gris tertiaire ajustés. Le blanc sur le vert du lot vaut 3,6:1, ce qui suffit pour du grand texte (3:1).

- `panneau-vivant.cjs` : le **vrai** panneau, `panel.js` compris, dans Chromium avec un ESV simulé. Il produit `vivant-*.png` et `vivant-motion-*.mp4` (le mouvement réel : entrée, cut suivant, défilement, pause, reprise).
- `rendre-panneau.cjs` : rendu statique (`panneau-*.png`, et `panneau-fin-*.png` pour un lot « jusqu’à la fin de partie »).
- Essais : `tests/d092-fiche-depart.test.cjs` (la structure du bloc change) et `tests/panel-h.test.cjs` (`#lot-pct` porte le nombre, le « % » est à côté). `tests/ux-49-orbite.test.cjs` gagne un essai qui rend les cartes de départ.
- `node tools/verify.cjs` : 1491 réussis, 0 échec, 2 ignorés (corpus privé absent).

## 4.9.0.14 — le vert de la tuile du lot (retour de l'opérateur sur la test 13)

« Le vert ne se remplit pas » : le lot de l'opérateur allait « jusqu’à la fin de partie », et le panneau ne connaissait pas la fin, donc le vert restait vide et muet.

L’essai `tests/ux-49-tuile-lot.test.cjs` a d’abord échoué sur 3 cas sur 4. La règle est maintenant :

- **Plage fixe** : comme avant.
- **« Jusqu’à la fin de partie »** : la fin retenue pour la partie si elle est connue. Sinon, le dernier cut est M−1, avec M lu au compteur d’ESV « cut N sur M » pendant le lot (`b.totalReleve` : même partie, source « compteur », cuts < M). C’est la règle de D-062.
  - La fiche de départ n’est pas utilisée : son total est le nombre de lignes de la liste d’ESV, et rien ne prouve qu’il donne le dernier cut.
- **Fin inconnue** : bande animée et « fin de partie inconnue » (`#lot-progres-note`, seul identifiant ajouté), jamais un faux pourcentage.
- Le vert avance à chaque cut et **ne recule pas** sur un retour à un cut. Il garde le plus loin atteint dans le lot, puis repart de zéro au lot suivant.

Rendus du vrai panneau : `vivant-fin-compteur-*.png` et `vivant-fin-inconnue-*.png` (`SCENARIO=… node panneau-vivant.cjs`).
