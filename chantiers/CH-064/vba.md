# VBA — valeurs binaires Ariane, version 1 (spécification, CH-064)

Format d'échange entre la coquille JS et le cœur WASM. But : transporter une valeur JS **sans aucune perte observable** (`Object.is` sur chaque nombre, ordre des clés, clé absente distincte d'une clé à `undefined`, trous de tableau), plus vite que JSON pour les tableaux de nombres. Code : `ariane-rs/crates/ariane-vba` (Rust), `ariane-rs/coquille/vba.js` (JS). Preuve d'aller-retour : `tools/ch064-vba-corpus.cjs`.

## Trame
`56 42 41 01` (« VBA », version 1), puis une seule valeur racine, puis rien. Tout entier est petit-boutiste, toute longueur est un `u32` (une valeur ou une chaîne de plus de 4 Gio est refusée).

## Valeurs (une étiquette `u8`, puis la charge)
| étiq. | nom | charge | valeur JS rendue |
|---|---|---|---|
| `00` | indéfini | — | `undefined` |
| `01` | nul | — | `null` |
| `02` / `03` | faux / vrai | — | `false` / `true` |
| `04` | nombre | 8 octets IEEE 754 binaire64 | le nombre, bits compris (−0 ; NaN sans charge garantie) |
| `05` | chaîne | `u32` n, n octets UTF-8 | la chaîne |
| `06` | tableau | `u32` n, n valeurs (dont `07`) | `Array` de longueur n |
| `07` | trou | — (seulement comme élément d'un `06`) | indice absent du tableau |
| `08` | objet | `u32` n, n × (`u32` l, l octets UTF-8 de la clé, valeur) | objet simple, clés dans l'ordre de la trame |
| `09` | bloc de nombres n×k | `u32` n, `u8` k (1 à 255), bourrage à 0 jusqu'à un multiple de 8 depuis le début de la trame, n×k binaire64 | `Array` de n `Array` de k nombres |
| `0A` | tableau de nombres | `u32` n, bourrage à 8, n binaire64 | `Array` de n nombres |
| `0B` | tableau de booléens | `u32` n, n octets `00`/`01` | `Array` de n booléens |
| `0C` | erreur | chaîne `nom` (`u32` + UTF-8), chaîne `message` | sortie seulement : la coquille lève `Error` (ou `TypeError`, `RangeError`) avec ce message |

## Règles d'encodage (canoniques : une valeur n'a qu'une trame)
- Nombre isolé : toujours `04`. Tableau dense dont tous les éléments sont des nombres, n ≥ 1 : `0A`. Tableau dense de n ≥ 1 tableaux denses de même longueur k (1 ≤ k ≤ 255), tous de nombres : `09`. Tableau dense de n ≥ 1 booléens : `0B`. Sinon `06` (le tableau vide est `06` avec n = 0).
- Objet : seulement un objet simple (prototype `Object.prototype`). Un objet sans prototype (`Object.create(null)`) est refusé : le décodage rendrait un objet simple. Les clés sont celles de `Object.keys`, dans leur ordre (comme JSON et `structuredClone` : les symboles et les propriétés non énumérables ne passent pas). Le décodage les réaffecte dans l'ordre : le moteur rend donc le même ordre (les clés entières sont triées par le moteur, des deux côtés).
- **Refus explicites** (erreur, jamais d'altération silencieuse) : chaîne mal formée (surrogat isolé : UTF-8 ne la représente pas) ; `bigint`, `symbol`, `function` ; objet non simple (`Date`, `Map`, `Set`, tableaux typés, instances de classe) ; tableau portant des propriétés non indicielles ; profondeur au-delà de 512.
- Le bourrage de `09` et `0A` rend la charge alignée sur 8 octets : la coquille la lit par une vue `Float64Array` sans copie ; le Rust la lit en `&[f64]`.

## Ce que le format ne prétend pas
- Il ne conserve pas l'identité des références (deux chemins vers le même objet deviennent deux copies ; un cycle est refusé par la profondeur). Les modules portés reçoivent des données arborescentes : à vérifier module par module.
- Il ne conserve pas la charge des NaN (le JS ne l'observe pas).
