# CH-131 : prise en main par OpenCode — refabriquer la Vision 20 (D-364, D-373) : rapport

**Exécutant :** OpenCode, sur le VPS de l'opérateur. Branche `chantier/CH-131`, partie du tronc `claude/50-test17`.
**Verdict en une ligne : le paquet est identique au livré, fichier pour fichier (1 111 fichiers, 0 écart de CRC-32 ni de taille).** Le VPS refait la Vision 20 à l'octet près.

## 1. Ce que la machine a dit

`node tools/vps-pret.cjs` : **9 points sur 11**. Manquent, par construction, l'adresse du relais et les motifs du scan — l'opérateur a décidé de s'en passer temporairement (D-375, séance du 18/11). Tous les autres points sont verts : Node v22.22.1, Python 3.14.4, clone complet, tronc connu, identité git, Playwright 1.65.1, Chromium 159 (dépendances système installées), `gh` connecté, `banane-data` présent.

Ajouté pour cet environnement : `typescript@5.9.3` (déclaré en `devDependencies`, jamais installé), `unzip`, `7z`.

## 2. Verify sur le build de la Vision 20 (`a19c5ed5`, détaché)

`node tools/verify.cjs`, 2 cœurs ARM, machine au repos.

| | Essais | Réussis | Échecs | Annulés | Sautés |
|---|---|---|---|---|---|
| Référence (intégrateur, 18/11) | 3 732 | 3 724 | 0 | 0 | 8 |
| Ce VPS, premier passage | 3 707 | 3 661 | 4 | 33 | 9 |

**Les quatre échecs et les trente-trois annulations ont trois causes, toutes instruites.**

**a) Un module manquant (ÉTABLI).** `tools/typage-ch075.cjs` exige `typescript`. Deux essais tombaient pour cette seule raison : `typage-ch075` et `pose-lot-inchanges-4959`. Après `npm install --no-save typescript@5.9.3` : **5 sur 5 et 6 sur 6**. Rien à corriger dans le dépôt.

**b) Le budget de 20 s par fichier (ÉTABLI).** Les 33 annulations sont toutes des `testTimeoutFailure`, sur des fichiers lourds (`*-sw.test.cjs`, navigateur). Rejoués seuls avec `BANANE_TEST_TIMEOUT_MS=60000` — le délai que le dépôt réserve aux exécuteurs plus lents (hub, `chantier.yml`) — ils rendent **83 essais, 83 réussis, 0 échec, 0 annulé**. La cause est la machine (2 cœurs), pas le code.

**c) Un défaut réel du livré, et un essai rouge du tronc.** Les deux restants ne se corrigent pas par la machine :

- `tests/noms-modeles.test.cjs` **échoue sur `a19c5ed5`** : `fiches/PASSATION_SESSION.md:7` porte deux noms de modèles d'IA. Le fichier est **corrigé sur le tronc** par D-373 ; l'essai y est vert (2 sur 2). Mesuré : le défaut est dans le build livré, pas dans le tronc. **À vérifier avant toute republication** : si `fiches/` entre dans le paquet — c'est le cas — alors le zip remis à l'opérateur porte ces deux noms, ce que `CLAUDE.md` interdit. Le défaut est corrigé en aval ; il n'y a rien à faire sur le livré, seulement à ne pas le reproduire.
- `tests/lot-signal-eteint-rechargement.test.cjs` **échoue sur `a19c5ed5` et sur le tronc**, 3 fois sur 3, de façon déterministe. Ce n'est pas une régression d'aujourd'hui : l'essai date de CH-062. Il s'arrête à 8,4 s, soit exactement sa borne interne (`etape(b,'repris', ms=8000)`), et n'a vu que `detecte` puis `pause`. **PROBABLE : fragilité de l'essai face à la lenteur**, et non défaut du produit — la boucle de `background.js` qui précède le rechargement attend le moteur jusqu'à 10 s (`for(let i=0;i<400&&(engine.task||engine.busy);i++)`), soit plus que la fenêtre de 8 s que l'essai s'accorde. Non établi : je n'ai pas mesuré la durée réelle de cette boucle sur ce VPS. À traiter en ticket séparé, pas dans CH-131.

## 3. Maquette ESV

`node tests/esv-maquette/essais.cjs` : 15 suites. **13 vertes d'emblée**, deux échecs, tous deux **verts à la relance unique** que la règle autorise :

| Suite | Premier passage | Relance seule |
|---|---|---|
| `correction-parties` | dépassement des 180 s du fichier | **3 sur 3**, 151 s |
| `correction-signal` (CH-028, essai fragile connu) | `waitForSelector` 10 s | **1 sur 1**, 36,8 s |

CH-110 (« préchauffage allumé »), l'autre fragile connu, est vert du premier coup. Aucun essai sauté ni désactivé.

## 4. Le paquet

`python3 tools/package.py --output vision20-vps.zip`, arbre propre, sans l'adresse du relais.

| | Livré | Reconstruit ici |
|---|---|---|
| Fichiers (hors `BUILD` et `telecommande-relais.json`) | 1 111 | 1 111 |
| Octets sur disque | 9 865 265 | 9 865 077 |

L'écart de 188 octets est **le fichier du relais, absent** : `telecommande-relais.json` n'est pas construit sans son adresse, et la référence CRC l'exclut pour cette raison.

Comparaison par `chantiers/CH-131/comparer-crc.py` contre `chantiers/CH-131/crc-vision20.txt` : **IDENTIQUE — aucun fichier manquant, aucun en plus, 0 CRC-32 différent, 0 taille différente.** ÉTABLI.

## 5. Le lot de terrain, et la règle « branche »

`node tools/bilan-lot.cjs` sur les 21 volumes du lot du 17/11 reproduit exactement les notes : **750 validés, 95 différés, 11 parties ; 10 écritures de la deuxième passe sur 4 parties**. Mesure propre des motifs de décision derrière ces 10 écritures, lue au journal :

**« branche » 4, « recherche-adv » 5, « consensus » 1.**

Trois lignes, pour le lot A1 du plan d'Ariane 6 :

1. Sur ce lot, la deuxième passe a écrit dix cuts, et **quatre viennent d'une décision au motif « branche »** — le motif que A1 doit mesurer sur tout le corpus.
2. Les notes du lot disent que sur 16 écritures jugées par l'Écho (16 et 17/11), les 6 poses au motif « branche » étaient **4 fois fausses** (26 à 50 mm), quand les 7 au motif « recherche-adv » étaient **7 fois justes** : la discrimination est dans le motif, pas dans la passe.
3. L'effectif est trop petit pour une règle : A1 doit rejouer « la passe ne pose plus sur branche » sur tout le corpus, au banc fidèle, avant toute proposition chiffrée. Aucun code dans A1.

## 6. Fichiers de ce chantier

- **Nouveaux** : `chantiers/CH-131/comparer-crc.py` (l'outil de comparaison, écrit pour ce chantier), ce rapport.
- **Aucun fichier d'Ariane modifié.** Aucun fichier protégé touché. `audit/verification.*` non commité.

## 7. Ce qui n'est pas couvert

- Les comptes du verify ne sont **pas comparables** tels quels à la référence : le budget de 20 s par fichier n'est pas tenable sur 2 cœurs. Les deux passages sont donnés, avec leurs causes.
- Le VPS n'a **pas** l'adresse du relais : le paquet reconstruit est identique hors ce fichier, et la télécommande restera muette tant que l'adresse n'est pas posée.
- La cause de l'échec de `lot-signal-eteint-rechargement` est **PROBABLE**, non mesurée.
- Aucune donnée de terrain (adresse, code de projet, UUID, coordonnée) dans ce rapport ni dans un fichier de `banane`.
