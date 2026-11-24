# CH-160 — Conception : verts des trous de grappe, validés pendant le lot

Décision **D-383** (opérateur, 24/11/2026, piste 1). Ce texte verrouille l'accroche et les règles. Il ne copie aucun export terrain.

## Module

Nouveau module pur `src/lot-verts-trous.js` (nom interne `BananeLotVertsTrous`), sans I/O, sans commande ESV.

Fonction exportée principale :

```
vertsTrousGrappe(cutsLot, options?) → { grappes, trous, cuts }
```

- `cutsLot` : numéros entiers distincts des cuts du lot (invalides du périmètre), déjà triés ou à trier.
- Défauts : `trouCuts = 5`, `min = 3`, `trouMaxCuts = 3`, alignés sur `src/relecture-ombre.js` (`grappe.trouCuts`, `grappe.min`) et sur D-284 (`trouMaxCuts`).
- Regrouper les cuts du lot en autorisant un écart d'au plus `trouCuts`. Un groupe d'au moins `min` cuts du lot est une grappe. Isolés et paires : aucun trou absorbé.
- Pour chaque grappe, tout intervalle ouvert `]gauche, droite[` entre deux cuts du lot consécutifs dans le groupe, de longueur 1 à `trouMaxCuts`, produit un trou. Longueur 4 ou 5 : ignorée.
- `cuts` : liste plate, ordre croissant, des numéros à visiter (candidats, avant le filtre de statut live).

Autres exports utiles aux essais et au bilan : inchangés si `options.actif === false` (liste vide, objet stable).

## Réglage

Dans `src/settings.js`, sous `lot` :

```
absorberVertsTrous: { actif: true, trouCuts: 5, min: 3, trouMaxCuts: 3 }
```

Allumé par défaut. `actif: false` : aucun candidat, aucun événement, aucun compteur, chemin du lot antérieur au bit près.

## Calcul des candidats

S'arme uniquement si un lot Orbite est ouvert, et si le réglage est actif. Jamais en Écho.

Source de la liste : la table déjà lue pour le lot, `liste-instantane` / `liste-memoire` décompactée (statut 0 = valid, drapeau `TreatedByOperator`). Les cuts du lot = les invalides du périmètre (bornes du lot, `endMode`). Précalcul au départ du lot, ou dès que la table est disponible et concordante (même règle de concordance que CH-151 / CH-152, au moins 80 % des cuts du lot présents, ou l'équivalent déjà en place).

Si la liste est absente, illisible ou non concordante : abstention consignées (`lot-vert-trou` avec motif `liste-absente` ou `liste-non-concordante`, une fois par lot), aucun candidat, le lot continue comme aujourd'hui. On n'invente pas les trous par un simple « next invalid » (un trou entre deux invalides n'est une grappe que si le groupe a au moins 3 cuts du lot ; cela exige la liste complète).

Les candidats sont gardés dans l'état du lot (liste de trous : gauche, droite, cuts, bornes de grappe), pour le bilan et pour l'insertion.

## Accroche dans le cycle du lot

Après la clôture d'un cut du lot (validation prouvée, ou différé finalisé, ou équivalent déjà existant qui passe au suivant), et avant la navigation vers le prochain invalide (`validateAndNext` / « cut non validé suivant ») :

1. S'il existe un trou précalculé dont le cut gauche vient d'être clos, visiter ses cuts dans l'ordre.
2. Pour chaque cut : relire le statut live (liste ou état affiché). Visiter seulement si `valid`, non traité, hors du lot. Sinon : événement `ignore` (motif `deja-traite`, `plus-valid`, `cut-du-lot`, etc.), passer au suivant.
3. Navigation : `allerAuCut` / `goToCut` uniquement. Contrôle d'identité : le cut affiché est bien le candidat. Puis `validerMajEspace`. Pas de pose, pas de SKIP, pas de différé.
4. Succès : événement `valide`, incrément du compteur. Échec de navigation ou de Maj+Espace : événement `echec`, le lot n'est pas bloqué, on passe au candidat suivant (ou au cut du lot droit). On ne diffère pas un vert déjà valide.
5. Garde du dernier cut d'une partie (Maj+Espace ne doit pas quitter la partie) : un trou absorbé est toujours intérieur à deux cuts du lot, donc ce n'est pas le dernier cut ; conserver quand même la garde existante si un cas limite apparaît.
6. Ensuite, reprendre le chemin normal vers le cut du lot suivant.

Ne pas détourner « cut non validé suivant » pour atteindre un vert : ce bouton le saute.

## Journal et bilan

Événement distinct `lot-vert-trou`, un par cut candidat (et une fois pour une abstention de liste) :

- `cut`, `part`, `lotId`
- `resultat` : `valide` | `ignore` | `echec` | `abstention`
- `motif`
- `trou` : `{ gauche, droite, longueur }`
- `grappe` : `{ debut, fin }`

Compteur de bilan / résumé du lot, à côté de `poses` / `differes` / `traites`, sans mélanger :

```
vertsTrous: { candidats, valides, ignores, echecs }
```

`traites`, `poses` et `differes` restent les compteurs du lot d'invalides. Ces validations sur place ne sont pas des poses et ne sont pas des différés.

## Essais (fixtures synthétiques uniquement)

Fichier proposé : `tests/ch160-lot-verts-trous.test.cjs`.

Couvrir au minimum :

- trous de 1, 2 et 3 absorbés ;
- trous de 4 et de 5 non absorbés, y compris à l'intérieur d'une grappe (`trouCuts = 5`) ;
- paire (2 cuts du lot, trou de 2) non absorbée ; isolé non absorbé ;
- cut déjà traité ignoré ; cut plus valid ignoré ; cut du lot non visité à ce titre ;
- réglage éteint : aucun candidat, aucun événement ;
- Écho : la fonction ne s'arme pas, aucune commande ;
- ordre d'insertion entre le cut gauche et le cut droit ;
- forme de l'événement et du compteur de bilan ;
- liste absente : abstention, lot inchangé.

La fonction pure doit permettre à l'intégrateur, hors git, de retrouver 13 / 9 / 6 cuts sur les listes 30–32, et notamment 1904, 1905, 1906.

## Risques

- Course avec « next invalid » : l'insertion doit précéder toute navigation automatique vers l'invalide suivant, sinon le trou est sauté.
- Identité avant Maj+Espace : refuser d'envoyer le geste si le cut affiché n'est pas le candidat (même garde que la relecture).
- Liste périmée : on filtre encore le statut live juste avant la visite.
- `TreatedByOperator` déjà vrai (reprise, opérateur, passe antérieure) : ignore, pas d'écriture.
