# CH-066 — Rapport : fuzz différentiel du format VBA (06/11/2026)

Base : tête de `chantier/CH-064` (4ceb766) fusionnée. Rien de corrigé dans `ariane-vba`, `ariane-js` ni la coquille : essais rouges et `.patch` seulement. Cible `wasm32-unknown-unknown` installée : le croisé passe par le vrai cœur (`coeur.js`, fonction 0 = écho).

## Cas générés (ÉTABLI, graines fixes)
- **JS** (`tools/ch066-fuzz-vba.cjs`, graines 66, 67, 68) : 60 063 valeurs (21 ciblées par graine + 20 000 aléatoires), dont 48 372 acceptées passées aussi par le cœur WASM ; 60 057 trames malformées (19 forgées + 20 000 mutations par graine) décodées par le JS ET par le Rust. Résultats : `fuzz-graine-6{6,7,8}.json`.
- **Rust** (`ariane-vba/tests/ch066_proprietes.rs`, sans dépendance) : 20 000 valeurs, 20 000 trames mutées, 20 000 trames aléatoires, toutes les troncatures de 200 trames, 272 trames forgées (tailles 2^32-1, 0x80000001, 0x20000000 ; étiquettes 0D à FF ; 513 niveaux…). 0,04 s en `--release`.
- **Croisé natif** (`ch066_croise.rs`) : 5 000 trames JS relues par le Rust ; 20 000 trames canoniques Rust relues par le JS.

**Ce qui tient** (ÉTABLI) : aucune panique du décodeur Rust ; toute trame lue par le Rust se réencode octet pour octet ; 0 divergence d'acceptation JS/Rust sur 60 057 trames ; les 48 372 trames JS reviennent du cœur à l'octet ; les 5 000 trames JS sont déjà `canonique()` côté Rust ; -0, NaN, ±Infinity, sous-normaux, entiers > 2^53, U+FEFF, U+0000, `__proto__`, `constructor`, clés numériques, trous, blocs 1 à 255 : intacts.

## Défauts
| réf. | gr. | défaut (reproduction exacte dans l'essai rouge) | mesure |
|---|---|---|---|
| J1 | P1 | `a=[1,2]; defineProperty(a,'0',{value:1,enumerable:false}); a.extra=9` est **accepté, `extra` perdu** : `clesEnPlus` compare des comptes, l'indice non énumérable compense la clé en plus. | 133 à 145 cas par graine |
| J2 | P1 | Sous-classe de `Array`, tableau sans prototype, ligne de bloc sous-classe : **acceptés, rendus en `Array` simple** (aucun contrôle de prototype pour les tableaux, contrairement aux objets). | 151 à 153 par graine |
| J4 | P2 | `coeur.js` : un objet métier `{__erreurVba:true,nom,message}` rendu par le cœur est **levé en `Error`** au lieu d'être rendu. | 2 à 5 par graine |
| R1 | P2 | Décodeur Rust : `Vec::with_capacity(min(n, 65 536))` avant de lire un élément. 512 tableaux `n = 2^32-1` imbriqués (2 564 octets) : **1 611 650 731 octets réservés** en natif ; trappe du cœur en WASM (récupérée en `HorsDomaine`). | allocateur compteur |
| J5 | P3 | Décodeur JS : UTF-8 invalide → `TypeError` du `TextDecoder` **sans préfixe « VBA : »**, que les façades ne rattrapent pas. Inatteignable depuis le Rust (une `String` est toujours valide) : PROBABLE sans effet en production. | 467 à 505 trames par graine |
| R2 | P3 | `encoder(&Valeur::Bloc{k:0,..})` **panique** (division par zéro). En WASM : trappe, repli JS. | essai R2 |
| R3 | P3 | `encoder` écrit des trames que tout décodeur refuse : `Nombres`/`Booleens`/`Bloc` vides, bloc de longueur non multiple de k (valeur bâtie sans `canonique()`). Repli de format de la façade. | essai R3 |
| R4 | P3 | `canonique()` garde l'ordre Rust des clés d'index et les clés en double ; le JS range les index d'abord et garde une clé (première place, dernière valeur) ; `champ()` lit la première, le JS la dernière. 3 032 des 20 000 trames Rust réécrites autrement par le JS : 0C (sortie seulement, attendu), clés en double, clés d'index hors ordre, charge de NaN (déclarée). | classement par cause |
| D1 | P3 | Altérations non refusées : accesseur rendu en donnée (193 à 214), gel/extensibilité perdus (398 à 424), symboles (197 à 207) et propriétés non énumérables (194 à 211) perdus, **y compris sur les tableaux** alors que `vba.md` dit « tableau portant des propriétés non indicielles : refus ». Références partagées dédoublées (déclaré) ; trame exponentielle : graphe sans cycle de profondeur 20 → trame de 15 576 496 octets en 255 ms, doublée à chaque niveau. Cycles : refusés en 1,5 ms. | à trancher par le chef : refuser ou documenter |
| D2 | P3 | Trame valide de 9,5 Mio (10 millions de trous) : trappe du cœur au plafond 256 Mio (34 Mio de mémoire pour 1 Mio de trame) ; repli `HorsDomaine`. | écho WASM |

## Correctifs proposés (`chantiers/CH-066/*.patch`, appliqués à blanc : rouges → verts)
- `correctif-coquille-js.patch` (J1, J2, J4, J5) : dernière clé d'`Object.keys` contrôlée (un indice, sinon refus) ; prototype des tableaux = `Array.prototype` ; classe `ErreurTransportee` pour l'étiquette 0C (`coeur.js` teste `instanceof`, `__erreurVba` reste lisible) ; UTF-8 invalide refusé « VBA : ». `Reflect.ownKeys` a été essayé puis écarté : `RangeError` sur 20 millions d'éléments (essai du plafond de `ch064-essais-coquille.cjs`).
- `correctif-ariane-vba.patch` (R1 à R4) : longueur annoncée > octets restants refusée avant toute réservation, `Vec::new()` ; vides et blocs invalides écrits comme le JS ; `canonique()` fusionne les clés en double et range les index.
- Avec les deux : `ch066-essais-rouges.cjs` 5/5, `ch066_rouges` 4/4, `ch064-essais-coquille.cjs` 9/9, `cargo test --workspace` sans échec, clippy `-D warnings` vert ; le fuzz ne garde que D1 et les trames non canoniques. Coût de `Vec::new()` sur le corpus réel : non mesuré, au chef de le mesurer (`ch064-vba-corpus.cjs`).

## Relancer
`node tools/ch066-fuzz-vba.cjs --graine 66 --cas 20000` ; `node --test tools/ch066-essais-rouges.cjs` ; `cargo test -p ariane-vba` puis `-- --ignored` pour les rouges ; croisé natif : `--ecrire-trames F` puis `CH066_TRAMES_JS=F cargo test -p ariane-vba --test ch066_croise`.
