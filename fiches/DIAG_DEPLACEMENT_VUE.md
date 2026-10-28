# Déplacement de la vue : pourquoi la molette ne déplace rien (CH-007)

Lecture seule des journaux, puis un geste proposé, non appliqué. Niveaux : ÉTABLI, PROBABLE, SUPPOSÉ. Aucune coordonnée, aucun identifiant.

## Cause

La caméra ne bouge pas du tout après le cran. Ce n'est pas un cran trop petit, ni une cible loin : le plan choisit le dézoom, le pixel et le NDC restent identiques, et le glissement qui aurait suffi tient dans la limite.

**ÉTABLI**, journal de `collections/2026-10-23_cache-tests-18-19_export-18-volumes` (version 4.9.5.19) :

| Relevé | Compte |
|---|---|
| `deplacer-vue` | 30 décisions, 30 refus `pre-vol:camera-immobile` (29 partie 0, 1 partie 33) |
| `molette` | 70 gestes, 70 `camera: immobile`, sens +1 (dézoom), 93 crans |
| Pré-vol | 30/30 : pixel identique avant et après, NDC identique |
| Plan | 30/30 `dezoom`, jamais le glisser. Partie 0 : `panPx` de 0,4 à 120,1 (médiane 24,3), les 29 ≤ 250. Partie 33 : 36,9. Dézoom partie 0 : 1,001 à 1,27 (médiane 1,055) |
| Cuts restés différés, motif hors-vue | **18** (17 partie 0, 1 partie 33), tous avec un glisser dans la limite |

L'analyse du 23/10 disait 18 cuts sur la partie 0 et 30 tentatives. Ici : 30 décisions, 17 cuts en partie 0 et 1 en partie 33. Les 64 gestes de la partie 0 à 8 h recoupent la correction du 25/10 (64 envois).

Le code (`amenerVue`) prend la molette dès que le dézoom tient dans `dezoomMax` et le pixel. Pour un rail à 1–4 % hors de la vue, c'est toujours la molette, alors que `panPx` est de l'ordre de 20 px.

**PROBABLE.** Un `wheel` synthétique n'atteint pas un écouteur `mousewheel` (`isTrusted` faux). Déjà mesuré (fiche `DEPLACER_VUE.md` § 1.1) et rejoué ici : essai « mousewheel seulement » de `tests/deplacer-vue-page.test.cjs`, et la maquette ci-dessous. Le journal ne dit pas quel écouteur ESV a posé : `mousewheel` seul, ou un contrôle d'`isTrusted`. Les deux donnent la même caméra immobile.

**SUPPOSÉ, non lu.** Les gestes de l'opérateur sont dans l'Écho, pas dans ces journaux de lot. On ne sait donc pas si sa molette, elle, déplace la vue. Un réglage d'ESV qui couperait toute molette n'est ni établi ni écarté.

24 autres gestes `molette` (caméra immobile aussi) portent sur des cuts dont le motif du lot n'est pas hors-vue (sans appui, surtout). **PROBABLE** : le profil du lot appelle `amenerDansLaVue` sans consigner `deplacer-vue` (`l1PlanVue`). Ils ne sont pas dans les 18.

## Geste proposé

Si la molette laisse la caméra immobile et que `panPx` ≤ `glissementPxMax`, tenter le glisser avant d'abandonner. Fichier non appliqué : `chantiers/CH-007/propositions/deplacement-vue.patch` (diff contre `src/adapter-page.js`). `src/adapter-page.js` n'est pas modifié.

Preuve, modèle de navigation qui n'écoute la molette qu'en `mousewheel` et qui suit le glisser (ce n'est pas ESV) :

- VM, horloge simulée : sans le patch, refus `camera-immobile` après une molette ; avec le patch, molette immobile puis glisser, NDC 0,800, vue recentrée. `node --test tests/deplacer-vue-page.test.cjs` : 14/14.
- Maquette : `NODE_PATH` vers Playwright, `CHROMIUM=/usr/local/bin/google-chrome` (`/opt/pw-browsers/chromium` absent), `node --test tests/esv-maquette/deplacement-vue.test.cjs` : 2/2. Sans le patch, un geste molette, caméra immobile, aucun rail bougé. Avec le patch, le glisser amène la cible (NDC dans la marge), 0 cran `mousewheel` reçu, au moins un glisser reçu.

**SUPPOSÉ** sur le vrai ESV : le gain en millimètres, et que le glisser synthétique est accepté. Le clic de pose l'est déjà alors qu'il n'est pas fiable : c'est le seul indice, pas une mesure.
