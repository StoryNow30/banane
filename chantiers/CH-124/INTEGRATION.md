# CH-124 : ce qu'il faut pour intégrer le levier N (refus d'ancre), éteint par défaut

Deux patchs, à appliquer dans cet ordre sur le tronc 9feb278 (vérifié : ils s'y appliquent sans rejet) :

| patch | sha256 | fichiers |
|---|---|---|
| `ancre.patch` | `55c63f314ac2c379dff3c9eeed9aae60a4a9f65bf6d6517198d5895bc868467c` | `src/ancre-trajectoire.js` (nouveau), `src/gcv2-l1.js`, `tools/banc-differes.cjs`, `tests/ch124-ancre.test.cjs` (nouveau), `tests/gcv2-l1-cap5.test.cjs` |
| `sw-ancre.patch` | `5c7c1fef2d3c0af5126af147dd1d9ccecdd0c44089dc2026213815b198940f31` | `background.js` |

`ancre-reprise.patch` (N+) n'en fait pas partie.

## Fichiers protégés touchés, ligne par ligne
- **`src/gcv2-l1.js`** : une clé ajoutée à la fin de `LEVIERS_V4`, `ancre:null`, avec son commentaire. Aucune autre ligne. Nulle, la décision est celle d'avant.
- **`src/ancre-trajectoire.js`** (nouveau, module de décision) : module pur `BananeAncreTrajectoire`, version `ancre-trajectoire-1`. Il ne lit ni la page, ni le stockage, ni ESV. Entrées : la table décompactée de la liste (`src/liste-memoire.js`), la pose de départ d'une capture, les positions d'une pose. Réglage figé dans `REGLAGE` (θ 75 mm, a 4 m, w 14 m, règles de silence).
- **`background.js`**, neuf endroits :
  1. `importScripts` : `'src/ancre-trajectoire.js'` juste après `'src/gcv2-l1.js'` (la suite attendue par `tests/version-49514.test.cjs` est gardée).
  2. `commandLot` : dernier appel, `if(ancreAllumee())command=await ancreCommande(…)`. Coupé : aucune attente ajoutée.
  3. `holdLotAnchor` : la pose refusée reste l'appui qu'elle aurait été (marque `fantome`).
  4. Après `l1eTable` : `ancreAllumee`, `ancreEtat` (modèle calculé une fois par lot et par partie), `ancreFantomes`, `ancreCommande`.
  5. `l1Voisins` devient `l1VoisinsReels` + `l1VoisinsAvecFantomes` ; sans pose refusée, la liste rendue est celle d'avant.
  6. Promotion des appuis : un appui fantôme est promu comme si son cut avait été validé ; il n'entre pas dans `lotPosed`.
  7. `reglesMetierNoter` : un cut refusé est noté comme le livré l'aurait noté (posé).
  8. `passeDiffOmbre` : une pose de la passe refusée reste au transport (entrée `transportSeul`, mécanisme existant), est comptée dans la passe, n'est ni posée ni reprise.
  9. Commentaire d'en-tête du levier.
- **Non touchés** : `src/engine.js`, `src/adapter-page.js`, `src/geometry*.js`, `src/lot-decision.js`, `src/gcv2-l1e.js`, `src/settings.js`, l'écriture vers ESV (`passeDiffEcrire`, `passeDiffPoser`), la reprise après redémarrage du service worker, `manifest.json`, la version, le paquet.

## À déclarer à l'intégration
1. **Garde des fichiers de pose** (`tests/pose-lot-inchanges-4959.test.cjs`, ligne 239) : `src/ancre-trajectoire.js` est un fichier nouveau de `src/`. Ajouter une liste, par exemple `const ANCRE_TRAJECTOIRE=['ancre-trajectoire.js'];`, à la suite comparée. Sans elle, cet essai échoue (attendu).
2. **Paquet** : `tools/package.py` prend tout `src/` ; rien à déclarer. `manifest.json` : rien (le module est chargé par `importScripts`).
3. **Clé de réglage** : levier `ancre` de la décision L1-e. `null` = coupé (livré). `true` = N au réglage figé. Un objet règle `thetaMm`, `a`, `w` et les autres champs de `REGLAGE` (mesure seulement). Le service worker ne lit ce levier que dans la recette livrée (`LEVIERS_LIVRES` de `src/gcv2-l1.js`) : il n'y a pas d'interrupteur au panneau. L'allumer, c'est écrire `ancre:true` dans une recette livrée, sur décision écrite de l'opérateur.
4. **Journal**, levier allumé seulement : `lotObservation.ancre` par cut (`refus`, `ecartMm`, `axeMm`, `cinematiqueMm`, `thetaMm`, ou `muet`, ou `erreur`) ; différé de motif `ancre` ; `passe-differes-ombre` avec `decision:'rien', motif:'ancre'`. Nombres seulement, aucun identifiant nouveau.
5. **Deuxième passe et plafond de 10** : une pose de la passe que l'ancre refuse n'entre pas dans la liste d'écriture. Elle ne prend aucune des 10 écritures. Le patch ne touche pas à l'écriture.

## Règle de production que le levier suppose
La liste de la partie est lue avant le premier cut du lot (instantané pris au chargement de la liste), une fois par lot ; le modèle est calculé une fois, à la première commande. Sans liste, ou si la pose de départ d'un cut ne se cale pas sur sa ligne, l'ancre se tait : la commande est celle du livré. Une panne du module laisse la commande du livré.

## Preuves
Voir `rapport.md` (éteint = livré, garde d'octobre jugée contre la vérité, corpus, examens vierges par CH-116, parité).
