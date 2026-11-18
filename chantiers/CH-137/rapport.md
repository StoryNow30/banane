# CH-137 : l'interface alternative « Mix » remplace le Cadran ; « Instrument » devient « Glacier » (D-371, D-372) : rapport

Branche `chantier/CH-137`, partie du tronc `claude/50-test17` (6f23171), tronc 30a7514 fusionné (merge, sans rebase). Maquette : banane-data `maquettes/figma-signal-mix-q4/` (d45e552). La finition « Riche » (D-371) a été abandonnée en cours de route (D-372) : rien n'en a été codé.

## Ce qui est livré
- **Glacier** : Réglages › Interface « Glacier / Mix » ; la valeur gardée reste `signal`, aucune clé de stockage renommée. Plus aucun « Instrument » à l'écran ; il n'apparaissait que sur la ligne Interface. Le bouton de vue de CH-134 dit « Vue du lot » / « Vue fil » (réponse de la mère : « Instrument » quitte l'écran ; essai dans `tests/ch137-mix-rendu.test.cjs`).
- **Cadran retiré** : `src/cadran-rendu.js`, `panel-cadran.css`, six essais `ch135`. Un choix gardé `cadran` ou `riche` ouvre en Mix.
- **`src/mix-rendu.js`** (pur) : part du rendu et du modèle de Glacier. L'anneau devient le gros chiffre (Plex Mono 44) avec sa légende et la réglette graduée 0 / milieu / N. L'aiguille est ambre pendant le lot et claire en pause ; les marques désignent les cuts à poser ; pour Écho, un trait par visite. Rien sans donnée : pas de réglette sans total ciblé ; pas de chiffre là où la planche n'en porte pas (à toi, interrompu, rattrapage, hors ligne, fin). L'icône d'état vient de la planche. « Ce qui reste » titre la ligne du tiroir. La ligne « Palette » est retirée en Mix.
- **Deux extras marqués `data-mx-extra`**, raccourcis vers des commandes du menu de Glacier : le bouton « Commandes » de la barre et le pied « Cache des exports », qui reprend le bouton du menu avec sa garde. La planche ne donne pas la taille du cache (« 1 lot, 190 Mo ») et le panneau ne la connaît pas : le pied dit seulement quand le cache est vidable.
- **`panel-mix.css`** sous `#ui5.u-mix` : jetons exacts de `jetons.json`, aucun dégradé, aucune couleur neuve. La base des couches reprend celle du Cadran, qui avait passé l'audit.
  - **Clair** : mêmes rôles que le sombre, avec les valeurs du mode clair du même fichier Figma (`figma-signal-riche/jetons.json` : fond, surfaces, encres, filets). L'ambre y devient #8a570a et le corail #b2372b (« attention » et « alerte » de ce mode).
  - **Écarts** : `--encre3` (3,9:1 sur le fond) ne sert jamais au texte ; le « repère » de la planche passe de 10 à 11 px (règle : rien sous 11 px).
- **Écrans neufs (D-372)**, première passe montrée à la mère avant d'être finie : Constellation, Aurore, couches, vue fil, relecture et bornes, rattrapage, Écho sans séance, bandeau « Réglages neufs ».
- **Téléphone** : reste en Glacier (`src/telecommande-instantane.js` force `variante: 'signal'`, gardé par un essai).
- **`src/ui5.js`** : variantes `signal` et `mix` ; la garde du pied couvre la ligne du tiroir en Mix, qui est sous les actions comme au Cadran.

## Preuves (mesurées)
- `tests/ch137-glacier-mix.test.cjs` : rouge (4 échecs), puis vert 5/5. Le 5ᵉ, sur le téléphone, garde un comportement existant : il n'a pas été rouge.
- `tests/ch137-mix-rendu.test.cjs` : rouge (module absent), puis vert 7/7. Il vérifie, sur 14 états × 8 couches, que Mix rend les mêmes `data-act` dans le même ordre, les mêmes boutons grisés et les mêmes champs que Glacier (extras et Palette mis à part, et l'essai vérifie que les extras mènent à des commandes du menu de Glacier). Il vérifie aussi le chiffre, la réglette, les icônes, le pied, la Palette, la vue fil, la pureté du module et que toute la feuille est sous `#ui5.u-mix`. ÉTABLI.
- Essais navigateur `tests/ch137-mix-navigateur{,-2,-3,-4}.test.cjs`, écrits après le code (pas rouges d'abord) :
  - bascule sans recharger, choix gardé, Palette absente, retour à Glacier, `cadran` et `riche` repliés ;
  - mêmes messages au service worker qu'en Glacier sur 8 clics, pied du cache compris (son clic envoie bien un message). ÉTABLI.
  - Chaque fichier passe en 12 s au plus.
- Vue fil en Mix (`tests/integration-cloture-vue-fil-mix-navigateur.test.cjs`) : un seul bouton `sg:vue-lot`, `data-vue="fil"`, aucun message au service worker. ÉTABLI.
- `ui5-panneau` 19/19 et `pose-lot-inchanges-4959` 6/6, mis à jour (nouveau script et nouveau fichier `src/`). ÉTABLI.
- `ui5-navigateur-signal-normal`, `-compact`, `ch134-vue-fil` et `ch134-vue-fil-navigateur` dépendent maintenant de la variante (classe, police, allure de Mix) : verts en Glacier et en Mix (`UI5_VARIANTE=mix`). ÉTABLI.
- Le rail de la Constellation n'écrit plus « +1 » ni « ? » en Mix : essai rouge puis vert. Glacier n'est pas changé.
- Audit (`chantiers/CH-137/outils/audit.cjs`) des 13 écrans de la planche. Il mesure : débordement, zone à défiler, troncature, contraste 4,5:1, rien sous 11 px, et un bouton recouvert (mesure ajoutée, vérifiée sur un recouvrement posé exprès). ÉTABLI.
  - Premier passage : 11 largeurs × 2 thèmes = 286 vues, 66 défauts.
    - Le menu de la barre sortait de 2 px à 560 px : 26 défauts.
    - Le pied était coupé par une ellipse à 320 px : 38 défauts.
    - « File terminée » défilait de 108 px à 320 px : 2 défauts.
  - Les trois sont corrigés ; contrôle : 286 vues, 0 défaut.
  - Le bandeau « Réglages neufs » ne recouvre aucune action, à 320 px compris.
  - Les écrans neufs ne sont pas encore audités : ils attendent le retour de l'opérateur.

## Fichiers
- **Nouveaux** : `src/mix-rendu.js`, `panel-mix.css`, `tests/ch137-mix-agencement.test.cjs`, `tests/ch137-mix-recouvrements.test.cjs`, `tests/ch137-mix-parite.test.cjs`, `tests/ch137-glacier-mix.test.cjs`, `tests/ch137-mix-rendu.test.cjs`, `tests/ch137-mix-navigateur{,-2,-3,-4}.test.cjs`, `chantiers/CH-137/outils/{scenes,photos,audit,page}.cjs`, ce rapport.
- **Modifiés** : `src/ui5.js`, `src/signal-rendu.js` (ligne Interface, « Vue du lot »), `panel.html`, `tests/ui5-panneau.test.cjs`, `tests/pose-lot-inchanges-4959.test.cjs`, `tests/helpers/signal-navigateur.cjs`, `tests/ui5-navigateur-signal-{normal,compact}.test.cjs`, `tests/ch134-vue-fil{,-navigateur}.test.cjs`.
- **Renommé** : `tests/integration-cloture-vue-fil-mix-navigateur.test.cjs`.
- **Retirés** : `src/cadran-rendu.js`, `panel-cadran.css`, `tests/ch135-cadran-*.test.cjs`.
- Aucun fichier protégé ; `manifest.json`, la version et le paquet n'ont pas bougé.

## Audit des écrans neufs — fait le 18/11 (intégrateur)

`chantiers/CH-137/outils/audit.cjs` sur les **38 scènes**, 11 largeurs de 320 à 720 px et deux thèmes : **836 vues, 100 défauts**. Les 13 écrans de la planche, audités plus haut, restent à 0 ; les 100 défauts sont tous sur les écrans neufs validés par l'opérateur (D-374). ÉTABLI.

Répartition mesurée, neuf familles :

| Défaut | Nombre | Où |
|---|---:|---|
| `ZONE A DEFILER` | 30 | vue fil (22), bornes de relecture (8) |
| `SORT` du menu de la barre (28 px, puis 12 px) | 28 | Constellation (14 vues), bilan de la Constellation (14) |
| `RECOUVERT` — bouton « Ouvrir » de l'Aurore | 28 | toutes les largeurs, deux thèmes, sous `.sg-actions`, `BUTTON`, `entree`, `sg-secondaire`, `mx-pied` |
| `RECOUVERT` — autres boutons et un champ | 14 | tiroir, bornes |
| **Total** | **100** | Aurore 32, vue fil 22, bornes 10, tiroir 8, sept scènes de Constellation 4 chacune |

Corrections, chacune avec son essai navigateur (`tests/ch137-mix-recouvrements.test.cjs`, `tests/ch137-mix-agencement.test.cjs`), dans `panel-mix.css` seulement :

- **Aurore** : tête, comptes et lignes plus denses (40 px par cut, motif à 18 px de ligne ; en compact 11/14 px, le détail `sg-d` masqué) et actions du pied resserrées. Plus aucun « Ouvrir » ni « Examiner » sous les actions ou le pied, à aucune largeur.
- **Tiroir** : en compact, chaque action garde son nom accessible mais prend la largeur de son icône (30 px) au lieu de déborder la zone.
- **Barre de la Constellation** : espaces resserrés quand le bouton du bilan est présent ; sous 400 px la pastille ESV ne garde que son point (son libellé était déjà masqué à cette largeur) au lieu de réserver 60 px. Le menu rentre.
- **Vue fil** : contrat de CH-134 tenu — la zone prend la hauteur libre et ce qui ne tient pas est **masqué**, pas défilé.
- **Bornes de relecture** : sous 560 px la réglette s'efface au profit du choix des deux cuts et du gros chiffre ; la zone ne défile plus, aucune borne recouverte.

**Aucune exclusion de critère n'a été ajoutée.** La règle `ZONE A DEFILER` de `chantiers/CH-104/outils/capturer.cjs` et la mesure `RECOUVRE` de `chantiers/CH-137/outils/scenes.cjs` sont utilisées sans changement : c'est la mise en page qui a changé.

Contrôle final : **836 vues, 0 défaut.** ÉTABLI.

## Essais du panneau en Glacier et en Mix — faits le 18/11 (intégrateur)

Les **36 fichiers** qui montent le panneau par `tests/helpers/signal-navigateur.cjs` ont été rejoués deux fois, un fichier à la fois : en Glacier, puis avec `UI5_VARIANTE=mix`. **68 essais sur 68 dans les deux**, zéro annulé. ÉTABLI.

Le premier passage en Mix donnait **13 rouges sur 65**. Ce n'étaient pas des régressions : six fichiers décrivent la **structure de Glacier** — l'anneau `.sg-anneau`, le `.sg-chiffre`, la ligne « Palette » des Réglages (retirée en Mix, D-371 : la palette ne vaut que pour Glacier), la trace masquée à 600 px, les temps dans la tuile — et la variable d'environnement les faisait mesurer Mix. Ces six fichiers fixent maintenant leur variante (`delete process.env.UI5_VARIANTE`, commenté et justifié) : un essai dit ce qu'il mesure, il ne l'hérite pas de l'environnement.

Ce qu'ils portaient de **comportemental** est repris, mesuré en Mix, dans `tests/ch137-mix-parite.test.cjs` (3 essais, verts) :

- l'Aurore liste ses deux parties, et une fois ouverte, « Ouvrir » sert aussi pour la partie 14 (traversée allumée) ;
- la Constellation garde le bouton « Bilan et départs des parties » et ses deux écrans ;
- le gros nombre de Mix suit le cut affiché, et l'anneau n'est plus dans le document (D-372).

**Mesure non jugée, à savoir** : en Mix, à 380 × 640, la ligne d'état de la tuile est à **20 px** du haut, pour un seuil de « moins de 20 px » écrit pour la tuile de Glacier (CH-115). Même alignement, densité différente : le critère ne vise pas cette tuile-là, et je ne l'ai pas modifié. ÉTABLI comme mesure, non tranché comme exigence.

## Reste à faire
- Maquette ESV (`tests/esv-maquette/essais.cjs`) : non rejouée sur cette branche ; elle se rejoue sur l'arbre intégré, une fois.
- Le retour de l'opérateur sur les écrans neufs : page de captures envoyée, retour non encore consigné.
