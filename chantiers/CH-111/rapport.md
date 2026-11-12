# CH-111 : rapport (télécommande d'Ariane sur iPhone, D-345)

Branche `chantier/CH-111`, partie de `9afc140`. Exécutant : session Claude fille. 12/11/2026. Les cinq précisions de l'intégrateur (12/11, 06:37) sont appliquées.

## Livré
- `src/telecommande.js` (service worker) : clé de 256 bits (WebCrypto), code de 53 caractères avec somme de contrôle, HKDF-SHA256 → AES-GCM 256 et identifiant de canal, données associées « canal|sens », anti-rejeu (numéro croissant gardé, 30 s au plus), vue en liste blanche (entiers et mots fermés), 7 ordres, refus réduits à un code fermé, reconnexion seule, battement de 15 s. Éteint sans appairage, et sous Chrome 116 (message dit au panneau).
- `background.js` : la branche du message `panel` est sortie telle quelle en `traiterPanneau(m, respond)`, appelée par `onMessage` et par la télécommande ; actions `telecommande-etat|code|appairer|couper`.
- Panneau : Réglages › « Télécommande (iPhone) » (une ligne dans `src/signal-rendu.js`, une action dans `src/ui5.js`) ouvre `src/telecommande-panneau.js` : adresse du relais, `chrome.permissions.request` sur le clic, QR code (`src/qr.js`) et code à taper, « Couper ».
- `telecommande/` : `worker.js` (Worker et Durable Object SQLite à hibernation), `telephone.html` (page iPhone « Épure »), `wrangler.toml`, `INSTALLATION.md`. `chantiers/CH-111/manifest.patch` : `optional_host_permissions` seulement.
- Ordres : lot-pause → `pause`, lot-reprendre → `resume`, lot-arreter → `stop`, relecture-pause, -reprendre, -arreter → mêmes noms, constellation-arreter → `file-arreter`. Exclus : reprise de la Constellation (`file-demarrer`), Écho.
- Refus au téléphone : un code parmi `pas-d-onglet-esv`, `esv-muet`, `pas-en-pause`, `deja-en-pause`, `rien-a-reprendre`, `deja-arrete`, `reglage-eteint`, `a-controler`, `occupe`, `autre`, plus au plus un numéro de cut ; le téléphone affiche une phrase fixe par code. Le texte complet reste au journal local (`telecommande-ordre`, 300 caractères au plus) et dans le panneau.

## Prouvé (ÉTABLI, mesuré ici)
- Essais Node verts (30) : module (15), vrai service worker en VM (4), vrai code du Worker (4), QR (2, +1 avec décodeur). Ils prouvent :
  - le relais simulé ne lit rien ;
  - un message trafiqué, renvoyé dans l'autre sens, rejoué (même après redémarrage du service worker) ou périmé est refusé ;
  - un refus contenant une fausse adresse, un faux UUID ou un faux code projet n'en laisse rien passer ;
  - chaque ordre de la liste produit exactement le message `{kind:'panel', action, args:{}}` du bouton (espion sur `dispatch`) ;
  - 16 noms hors liste n'atteignent jamais le service worker, dont `skip`, `explicit-skip`, `start`, `retry`, `goto-cut`, `passe-differes-ecrire` et `file-demarrer` ;
  - au réveil du service worker, l'appairage gardé se reconnecte seul et renvoie l'état ;
  - sous Chrome 116, aucune connexion, avec le message.
- Bout en bout dans Chromium (`tests/esv-maquette/ch111-telecommande.test.cjs`, vert à chaque passage) : extension réelle patchée ↔ relais local (HTTPS + WebSocket, vrai `worker.js`) ↔ page du téléphone.
  - « En direct » en 50 à 115 ms ; changement d'état vu en 740 à 930 ms ; Pause exécutée et affichée en 160 à 235 ms ; reconnexion des deux côtés en environ 1,03 s après une coupure du relais.
  - La clé est effacée de l'adresse et rangée dans le téléphone ; « Ariane hors ligne » s'affiche ; Arrêter passe par une confirmation ; le refus est dit par son code ; « Couper » fonctionne.
  - Le relais n'a vu aucun mot en clair.
- QR code : 107 textes (versions 1 à 10, les 8 masques) relus à l'identique par jsQR 1.4.0, installé hors dépôt.
- Le refactor `traiterPanneau` est iso-fonctionnel. Les 125 fichiers d'essai du service worker et du panneau, avant (`9afc140`) et après : **701 essais, 700 verts, 1 sauté, 0 échec** des deux côtés. Diff des fichiers de décision (engine, adapter-page, geometry*, gcv2*, lot-decision, manifest) : vide.
- Vie du service worker, appairé et au repos 90 s : 7 messages reçus par le relais (un état, puis un battement toutes les 15 s), la liaison tenue.
- Sous Playwright, le service worker n'est jamais endormi en 90 s, même **sans** appairage : l'effet du battement sur l'endormissement n'est pas mesurable ici.
- Permission d'hôte : en Chromium sans tête, `chrome.permissions.request` est bien appelé sur le clic, avec l'hôte du relais, mais ne répond jamais (aucune invite). La WebSocket du service worker vers le relais a fonctionné **sans** la permission accordée. La demande est gardée (utile pour un futur `fetch`).
- Scan d'identité propre (motifs publics ; `ARIANE_MOTIFS_INTERDITS` absent de la session).

## Non prouvé, et limites
- Rien n'a tourné sur le vrai Cloudflare ni sur un vrai iPhone. Restent SUPPOSÉS :
  - le déploiement `wrangler`, les Durable Objects SQLite et les limites de l'offre gratuite ;
  - le comportement de Safari d'iOS (sockets coupées en arrière-plan) ;
  - l'écran d'accueil : la clé étant effacée de l'adresse, l'icône peut demander le code une fois si iOS ne partage pas sa mémoire avec Safari (PROBABLE).
- Garder le service worker éveillé tant qu'un téléphone est appairé est l'effet attendu du battement (Chrome 116 et après, documentation de Chrome : PROBABLE), non mesuré.
- **Sécurité** : la page du téléphone est servie par le relais. Le chiffrement protège contre Cloudflare à l'état passif ; un Worker modifié pourrait servir une page qui vole la clé. C'est acceptable parce que le Worker est celui de l'opérateur, et c'est écrit dans la fiche.
- Garde GCV2 et parité non lancées : aucun fichier de décision n'est touché, et la garde demande les lots archivés hors dépôt.

## Pour l'intégrateur
1. `manifest.patch`, puis l'empreinte de `tests/version-49514.test.cjs`, ligne 53 : `06ccc179daaaabc7aab4f0fbec79344e883bf25f099625064e12bc42f1bfef94`.
2. `tools/scan-identite-exclusions.json` : trois exclusions motivées ajoutées (le motif `workers.dev` du manifeste et du patch, l'hôte ESV des lignes de contexte du patch).
3. Hub : rien de posté d'ici (`tools/hub.cjs` passe par `gh`, interdit dans cette session hors recherche).
