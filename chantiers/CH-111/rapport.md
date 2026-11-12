# CH-111 : rapport (télécommande d'Ariane sur iPhone, D-345)

Branche `chantier/CH-111`, partie de `9afc140`. Exécutant : session Claude fille. 12/11/2026.

## Livré
- `src/telecommande.js` (service worker) : appairage (clé de 256 bits tirée par WebCrypto, code de 53 caractères avec somme de contrôle), HKDF-SHA256 → clé AES-GCM 256 et identifiant de canal, enveloppe `{v, iv, d}`, données associées « canal|sens », anti-rejeu (numéro croissant gardé, 30 s au plus), vue en liste blanche (`vueReduite` : entiers et mots fermés), liste fermée de 7 ordres, motif de refus nettoyé, reconnexion seule, battement de 15 s, « Couper ». Éteint sans appairage.
- `background.js` : module chargé ; la branche du message `panel` sortie telle quelle en `traiterPanneau(m, respond)`, appelée par `onMessage` ET par la télécommande (mêmes gardes, mêmes refus, même transition « erreur ») ; actions `telecommande-etat|code|appairer|couper`.
- Panneau : Réglages › « Télécommande (iPhone) » (`src/signal-rendu.js`, une ligne ; `src/ui5.js`, une action) ouvre `src/telecommande-panneau.js` : adresse du relais, `chrome.permissions.request` sur le clic, QR code (`src/qr.js`, encodeur maison) et code à taper, « Couper » (rend aussi la permission).
- `telecommande/` : `worker.js` (Worker + Durable Object SQLite à hibernation, logique `CanalLogique` séparée), `telephone.html` (page iPhone « Épure »), `wrangler.toml`, `INSTALLATION.md`.
- `chantiers/CH-111/manifest.patch` : seulement `optional_host_permissions: ["https://*.workers.dev/*"]`.

Ordres (téléphone → action du panneau) : lot-pause → `pause`, lot-reprendre → `resume`, lot-arreter → `stop`, relecture-pause / -reprendre / -arreter → mêmes noms, constellation-arreter → `file-arreter`. Tout autre nom : refusé (`ordre-inconnu`). Pas de reprise de Constellation (dans le panneau c'est `file-demarrer`, qui relance des lots) ni d'Écho.

## Prouvé (ÉTABLI, mesuré ici)
- 21 essais Node verts : module (13), vrai service worker en VM (2), vrai code du Worker (4), QR (2 ; +1 avec décodeur). Le relais simulé ne lit rien ; trafiqué, autre sens, autre clé, rejeu (aussi après redémarrage du SW), ordre périmé, ordre hors liste : refusés ; journal `telecommande-ordre` sans clé ni texte ; état chargé d'UUID, codes projet, adresses, noms : rien ne sort.
- Bout en bout Chromium (`tests/esv-maquette/ch111-telecommande.test.cjs`, 3 fois sur 3) : extension réelle patchée ↔ relais local (HTTPS + WebSocket, vrai `worker.js`) ↔ page du téléphone 390 × 844. « En direct » ~55 ms après le lien ; changement d'état vu en 830 à 930 ms ; Pause → lot en pause et téléphone à jour en 160 à 235 ms ; reconnexion ~1,03 s après coupure du relais ; « Ariane hors ligne · dernier état à HH:MM » ; Arrêter avec confirmation ; refus affiché = refus du bouton du panneau mot pour mot (« Sélectionne un onglet ESV. ») ; Couper → clé oubliée, téléphone hors ligne ; le relais n'a vu aucun mot en clair.
- QR : 107 textes (1 à 213 octets, versions 1 à 10, 8 masques) relus à l'identique par jsQR 1.4.0 (hors dépôt).
- Non-régression : les 113 fichiers d'essai qui chargent `background.js` (644 verts, 1 sauté ; le seul échec, ordre des scripts de `panel.html`, est corrigé), plus `ui5-panneau`, `signal-rendu`, `lancement-ariane5`, `package`. Scan d'identité propre (motifs publics seulement : `ARIANE_MOTIFS_INTERDITS` absent de la session).
- Chromium sans tête : `chrome.permissions.request` est appelé sur le clic avec l'hôte du relais mais ne répond jamais (aucune invite) ; la WebSocket du service worker vers le relais a fonctionné sans la permission accordée.

## Non prouvé
- Rien n'a tourné sur le vrai Cloudflare ni sur un vrai iPhone : déploiement `wrangler`, Durable Objects SQLite sur l'offre gratuite et ses limites, Safari d'iOS (écran d'accueil qui garde `#k=`, sockets coupées en arrière-plan) : SUPPOSÉ.
- Durée de vie du service worker : les messages WebSocket le gardent éveillé (Chrome 116 et après, PROBABLE d'après la documentation) ; une Ariane au repos qui s'endort apparaît « hors ligne » : SUPPOSÉ.
- L'invite de permission dans un vrai Chrome : non vue.

## Pour l'intégrateur
1. Appliquer `manifest.patch` ; mettre alors l'empreinte de `tests/version-49514.test.cjs` (ligne 53) à `06ccc179daaaabc7aab4f0fbec79344e883bf25f099625064e12bc42f1bfef94`.
2. Garde de pose et parité : aucun fichier de décision touché ; la seule ligne de `background.js` sur le chemin du panneau est le déplacement de la branche `panel` dans `traiterPanneau`.
3. Hub : je n'ai rien posté (`tools/hub.cjs` passe par `gh`, que cette session n'a pas le droit d'utiliser hors recherche).
