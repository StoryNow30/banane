# CH-064 — Étape 1 : rapport de clôture (06/11/2026)

Plan validé par l'intégrateur (`etape-1-plan.md`, réponses du 06/11 ; D-294 : architecture A). Tout est mesuré dans ce dépôt, données réelles lues hors dépôt dans `banane-data`.

| Livrable | État | Preuve |
|---|---|---|
| Espace Cargo `ariane-rs/`, hors paquet | fait ; membres de l'équipe (L, D, E) posés, blocs du cœur réservés | `tools/package.py` l'exclut ; `cargo test` 34 essais verts ; clippy pedantic `-D warnings` propre (cible WASM comprise) |
| Sémantique JS en Rust (`ariane-js`) | hypot, round, max, min, sign, tri et médiane, exp correctement arrondi (natif) | `sonde-math.json` : std de Rust diverge de V8 (hypot 70 072 sur 200 000), portages 0 en Node et dans Chromium ; transcendantes importées du JS (elles changent d'une version de V8 à l'autre : ÉTABLI) |
| Format d'échange VBA (spécification `vba.md`) | codecs Rust et JS canoniques | **`vba-corpus.json` : 173 documents réels (tous ceux des 04 et 05/11, et 14 du 06/11), 3,98 Go de JSON, 831 226 événements, 13 972 nuages, 24 millions de points : aller-retour JS identique 173/173, par le cœur Rust identique 173/173, trame réencodée par Rust identique octet pour octet 173/173** ; 25 cas synthétiques (−0, NaN, trous, ordre des clés) identiques, 7 refus explicites. ÉTABLI |
| Coquille JS | chargement synchrone, ABI à un point d'appel, erreurs à l'identique, `HorsDomaine` → rejeu JS | essais de parité de l'étape 2 |
| Mémoire du cœur | arène à pointeur remise à zéro à chaque appel, croissance par doublement, réinstanciation au-delà d'un seuil | défaut trouvé : avec dlmalloc, chaque `memory.grow` déclenchait un ramasse-miettes complet du tas JS (journal de 125 Mo : plus de dix minutes) ; avec l'arène : 132 Mo en 1,5 s. Haute eau de tout le corpus : 1,5 Gio, 9 réinstanciations au seuil de 256 Mio |
| Banc de parité générique (`tools/ch064-parite.cjs`) | Node et Chromium (référence), comparaison stricte, empreintes, contrôle négatif | `tools/ch064-essais.cjs` (lanceur à part ; rien dans `tests/`) |
| CSP d'ESV | ni en-tête ni balise (relevé de l'opérateur, une page) ; le monde isolé suit la CSP de la page (CH-061) | WASM possible dans la page sans changer le manifeste (PROBABLE) ; patch de relevé passif proposé, non appliqué |
| Coûts de traversée (Node, médianes par Mo) | JSON.parse 10,2 ms, JSON.stringify 11,9 ; encodage VBA 8,0, décodage 11,5 ; cœur (copie, décodage Rust, réencodage) 2,5 | `vba-corpus.json` |

Écarts au plan, dits : la réinstanciation n'a pas encore été mesurée en mémoire rendue au système dans Chromium (banc de temps, étape 2) ; le plafond `--max-memory` de 256 Mio est validé par l'intégrateur, à poser à la fusion de CH-064-L.
