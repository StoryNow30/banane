# Orbite : la variante A retenue, reprise (14 octobre 2026)

Mic a retenu la variante A « Accueil » (`../variantes/A-accueil.html`) et
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
