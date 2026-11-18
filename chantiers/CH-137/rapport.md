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
- **Nouveaux** : `src/mix-rendu.js`, `panel-mix.css`, `tests/ch137-glacier-mix.test.cjs`, `tests/ch137-mix-rendu.test.cjs`, `tests/ch137-mix-navigateur{,-2,-3,-4}.test.cjs`, `chantiers/CH-137/outils/{scenes,photos,audit,page}.cjs`, ce rapport.
- **Modifiés** : `src/ui5.js`, `src/signal-rendu.js` (ligne Interface, « Vue du lot »), `panel.html`, `tests/ui5-panneau.test.cjs`, `tests/pose-lot-inchanges-4959.test.cjs`, `tests/helpers/signal-navigateur.cjs`, `tests/ui5-navigateur-signal-{normal,compact}.test.cjs`, `tests/ch134-vue-fil{,-navigateur}.test.cjs`.
- **Renommé** : `tests/integration-cloture-vue-fil-mix-navigateur.test.cjs`.
- **Retirés** : `src/cadran-rendu.js`, `panel-cadran.css`, `tests/ch135-cadran-*.test.cjs`.
- Aucun fichier protégé ; `manifest.json`, la version et le paquet n'ont pas bougé.

## Reste à faire (arrêt propre demandé : quota de l'opérateur)
- Maquette ESV (`tests/esv-maquette/essais.cjs`) : lancée, puis arrêtée avant son résultat ; non rejouée.
- Essais du panneau en Mix (`UI5_VARIANTE=mix`) et en Glacier, en entier : non rejoués. Sont verts seulement les fichiers cités plus haut (essais CH-137, ui5-panneau, pose-lot-inchanges, signal-normal, signal-compact, ch134-vue-fil, vue fil en Mix, connexion-t21, ch136-*). Liste à rejouer : les 35 fichiers qui chargent `tests/helpers/signal-navigateur.cjs`, puis ui5-*, ch129 à ch136, télécommande et intégration.
- Audit des écrans neufs (validés par l'opérateur, D-374) sur 320 à 720 px × 2 thèmes : non fait ; seuls les 13 écrans de la planche ont été audités.
- D-374 fait : « Suivre dans Orbite » est l'action pleine de la Constellation en cours et en passage, en Mix seulement (essai rouge puis vert).

## Ce qui reste
- Le retour de l'opérateur sur les écrans neufs (page de captures envoyée), puis leur audit ; la question de la mère sur l'action pleine de la Constellation en cours et en passage. Détails techniques et pastille de la barre : finis.
