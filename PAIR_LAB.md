# Pair Lab V1

Banc hors ligne. Il mesure une seule grandeur de **paire**, parce que le contrôle
rail par rail a manqué le défaut vu à l’œil sur le cut 6/9480.

## Grandeur

`pairOriginDistance` : distance euclidienne entre les origines de profil
gauche et droite, dans le repère de scène exporté.

- ce n’est **pas** l’écartement ESV ;
- ce n’est **pas** une valeur en millimètres certifiés ;
- le facteur ×10³ est une échelle d’affichage, identique à celle déjà utilisée
  dans `AUDIT_PILOTE.md` ;
- aucune cible n’est imposée, y compris 1436 ;
- aucun seuil, aucun SKIP, aucun entraînement, aucune commande ESV.

Les origines lues sont `profileOriginSceneRelative` si elle existe, sinon
`positionSceneRelative`.

Quatre séries, quand les poses existent :

| série | source |
|---|---|
| `initial` | origines avant geste |
| `human` | origines après correction humaine |
| `engine` | origines obtenues en appliquant les deltas du moteur **gelé** aux poses initiales |
| `brain` | même chose après le post-traitement du cerveau, sans modifier `src/brain.js` |

Le cerveau n’invente pas de candidat. S’il s’abstient, la colonne `brain`
reprend la paire moteur ou reste indisponible.

## Témoin obligatoire — part 6 / cut 9480

Fait rapporté (défaut 7 d’`AUDIT_PILOTE.md`), pas un rejeu local : le JSON de
cette visite n’est pas dans le dépôt.

| source | pairOriginDistance ×10³ |
|---|---:|
| initial ESV | 1499,93 |
| Banane observée | 1517,73 |
| moteur gelé seul | 1518,19 |

Banane et le moteur gelé **augmentent** la distance de paire. Sur d’autres
parts, la correction humaine **resserre** fortement la dispersion de cette
même grandeur. Ces deux observations ne sont pas encore une règle.

## Chiffres humains rapportés, non recalculés ici

Tant que les JSON Natif / corrections correspondants ne sont pas passés au
banc :

- parts 17/20 (n rapporté = 211 cuts sur plusieurs parts, détail 17/20) :
  avant ≈ 1482,85 ± 35,79 ; après humain ≈ 1437,07 ± 5,20
- part 6 : avant ≈ 1438,71 ± 27,10 ; après humain ≈ 1435,99 ± 3,85

Le banc les recopie comme `reported-not-recomputed`. Dès qu’un fichier
`banane-corrections-session-v4` ou `banane-offline-evaluation-v1` est fourni,
il **calcule** initial / humain / moteur / cerveau et agrège **par part**.

## Pouvoir prédictif

Question posée, pas tranchée : `pairOriginDistance` sépare-t-il les mauvaises
propositions mieux que l’erreur rail à rail ?

Le banc publie seulement :

- la moyenne (moteur − humain) de la paire ;
- le Pearson entre `|paire moteur − paire humaine|` et le max des erreurs rail
  déjà calculées par le rejeu hors ligne, quand il est fourni ;
- le Pearson entre `|paire initiale − paire humaine|` et la même erreur rail.

n < 3 ⇒ corrélation `null`, jamais une valeur inventée. Une corrélation nulle
n’autorise aucun seuil.

## Reproduire

```bash
node --test tests/pair-lab.test.cjs

node tools/pair-lab.cjs \
  --out audit/pair-lab-v1.json \
  --markdown audit/pair-lab-v1.md

node tools/pair-lab.cjs \
  datasets/automatic/offline-evaluation-v4.3.0.json \
  --out audit/pair-lab-v1.json \
  --markdown audit/pair-lab-v1.md
```

Sans fichier d’entrée, le rapport contient le témoin 6/9480 et les séries
humaines rapportées. Avec l’évaluation hors ligne V4.3, le moteur et le
cerveau sont recalculés sur les poses initiales déjà stockées — le fichier
`src/geometry.js` n’est pas modifié.

## Hors périmètre V1

- lire l’écartement affiché par ESV (toujours `KI-001`) ;
- brancher une contrainte de paire dans le moteur ou le cerveau ;
- régler quoi que ce soit sur le jeu réservé 9031–9047 ;
- appeler les unités de scène des millimètres.
