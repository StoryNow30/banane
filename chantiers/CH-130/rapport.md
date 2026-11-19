# CH-130 : rapport (télécommande : adresse du relais par défaut, panneau complet sur le téléphone, D-361)

Branche `chantier/CH-130`, partie de `0a78516` (`claude/50-test17`). Exécutant : session Claude fille. 16/11/2026. Plan validé par l'intégrateur ; ses quatre précisions sont traitées.

## Livré
- **Adresse par défaut** : `tools/relais_paquet.py` lit `ARIANE_RELAIS`, sinon `~/.ariane/relais.txt`, contrôle l'adresse (https, hôte en `.workers.dev`, rien après ; sinon le paquet ne se fabrique pas) et l'écrit dans le zip seulement (`telecommande-relais.json`), sans jamais l'imprimer. `chantiers/CH-130/package.patch` branche cet outil dans `tools/package.py` (protégé) et refuse le paquet si ce fichier traîne dans le dépôt (`.gitignore`). La feuille du panneau propose : la dernière saisie, sinon l'adresse du paquet, sinon rien.
- **Panneau complet sur le téléphone** : la page dessine avec `src/signal-rendu.js` et `panel-signal.css` eux-mêmes, servis par le relais depuis le dépôt (aucune copie). `src/telecommande-instantane.js` (nouveau, pur) fabrique l'instantané du rendu d'après la vue d'Ariane et filtre le HTML : il ne reste que la navigation locale (onglets, tiroir, détails, menu) et les ordres offerts à cet instant.
- **Vue** (`src/telecommande.js`) : schéma 2, un champ `detail` ajouté (dernier cut, partie affichée, Écho, Constellation, Aurore). Les champs lus par la page de CH-111 sont inchangés.
- **Pouvoir** : les 7 ordres de CH-111, inchangés, même chemin (`traiterPanneau`), mêmes gardes. Aucun ordre nouveau. Ouvrir un cut de l'Aurore, lancer, reprendre la Constellation, SKIP, valider, poser : retirés du HTML, puis refusés par la page, puis par le service worker.
- **Relais ancien** : la feuille du panneau le dit en une ligne (`HEAD /telecommande-instantane.js` → 404) ; le téléphone garde alors la page réduite, qui marche.
- `telecommande/INSTALLATION.md` § B, D, G (mise à jour du relais, avec ou sans Node.js), H (adresse proposée d'office, identité de l'extension).

## Prouvé (ÉTABLI, mesuré ici)
- **Aucun hôte `*.workers.dev` réel** dans les 148 commits disponibles, toutes branches, ni dans les fichiers suivis. Seul permis : l'hôte fabriqué `*.exemple.workers.dev` (`tests/ch130-adresse.test.cjs`, à chaque passage).
- **Paquet sans source** : identique au paquet d'aujourd'hui, fichier pour fichier (CRC), hors `BUILD` et `tools/package.py` lui-même. **Avec `ARIANE_RELAIS`** : le même plus `telecommande-relais.json`. L'adresse n'apparaît pas dans la sortie.
- **Vue** : rien de l'état chargé ne fuit (code projet, UUID, adresse, texte libre) ; entiers et mots fermés seulement. Listes bornées (20 parties, 150 lignes d'Aurore). La vue la plus chargée fait 12 408 caractères chiffrée (limite du relais : 16 384). La liste fermée tient : 6 listes de mots ajoutées, aucun texte.
- **Rendu** : 76 écrans (19 états × 4 onglets) sans erreur. Les 4 onglets sont toujours présents. Seules restent les actions permises. Les ordres offerts tombent sur les 7 ordres.
- **Relais** : les 4 fichiers du panneau sont servis octet pour octet ; rien d'autre (8 chemins refusés). Le déploiement à blanc par **wrangler 4.162** est accepté (Durable Object compris), avec les fichiers embarqués tels quels.
- **Bout en bout dans Chromium, 390 × 844** (`tests/esv-maquette/ch130-telephone.test.cjs`, 5 sur 5 verts) :
  - l'adresse du paquet est proposée ;
  - les onglets Orbite, Écho, Constellation et Aurore sont visités ;
  - les onglets n'envoient rien au relais ;
  - « Pause » passe par le service worker ;
  - « Arrêter » demande confirmation ;
  - « hors ligne » grise les ordres ;
  - le relais ne voit aucun mot en clair ;
  - pas de défilement horizontal.
  
  Un état fabriqué « lot + Écho » a été refusé par la garde réelle (« Écho est actif ») : c'est le bon chemin. L'essai de CH-111 est adapté à la nouvelle page : 6 sur 7 verts, un échec au premier passage, cause non relevée.
- **Identité de l'extension** (Chromium) : elle dépend du dossier ; même dossier avec une nouvelle version, même identité.
- **Jeton Cloudflare** : un jeton est actif et injecté dans l'environnement de cette session (`tokens/verify`, lecture seule).
- Essais ciblés verts : ch130 (21) et ch111 (24). Scan d'identité propre (motifs publics seulement).

## Non prouvé
- Rien n'a tourné sur un vrai iPhone ni sur le vrai Cloudflare. Les droits du jeton sur les Workers ne sont pas vérifiés (SUPPOSÉ). Rien n'a été déployé.
- Écart entre le dessin servi par le relais et celui de l'extension après un changement de `src/signal-rendu.js` sans redéploiement : le téléphone garde l'ancien dessin. Ce n'est détecté que pour la forme de la vue (« schéma »).
- CH-129 (D-362) déplace le bilan de la Constellation : `ch130-telephone` lit `.sg-registre`, à ajuster si le rendu change.

## Pour l'intégrateur
1. Fichiers : `src/telecommande.js`, `src/telecommande-instantane.js` (nouveau), `src/telecommande-panneau.js`, `telecommande/{worker.js,wrangler.toml,telephone.html,INSTALLATION.md}`, `tools/relais_paquet.py` (nouveau), `.gitignore`, `tests/ch130-*.test.cjs`, `tests/esv-maquette/ch130-telephone.test.cjs`, `tests/esv-maquette/ch111-telecommande.test.cjs`, `tests/helpers/ch111-relais-local.cjs`. Patch : `chantiers/CH-130/package.patch` (tools/package.py). Aucun autre fichier protégé, `background.js` intact.
2. Fabriquer la Vision 19 avec `ARIANE_RELAIS` dans ton shell. Ce zip ne va qu'à l'opérateur, ni dans le dépôt ni dans `banane-data`.
3. **Redéployer le relais une fois** (geste de l'opérateur, ou le tien sur son accord écrit ; je n'ai rien déployé) : dans `telecommande/`, `CLOUDFLARE_API_TOKEN=factice npx wrangler deploy` (fiche § G). Sans droits du jeton : route de l'opérateur, § G. Ne jamais recopier l'adresse affichée.
4. **Après CH-129** : ce que mes essais lisent de la structure du rendu, à ajuster si CH-129 la change.
   - `tests/ch130-instantane.test.cjs` :
     - `role="tablist"` et les libellés exacts `>Orbite</button>`, `>Écho</button>`, `>Constellation</button>`, `>Aurore</button>` ;
     - les `data-act` (liste permise dans `src/telecommande-instantane.js`, `ACTES` et `NAVIGATION`) ;
     - les textes « Pose du cut `<span class="sg-mono">`345 », « Interrompu », « Relecture en pause », « Rattrapage » ;
     - dans l'Aurore, `data-k="c:12:400"`, « corrigé · 1 rail » et « ouvert dans ESV » ;
     - dans la Constellation, `data-partie="13"` et « arrêtée par l’opérateur » (le motif du **bilan par partie**, que D-362 met derrière un bouton : cette assertion est à déplacer sur l'écran ouvert, ou à retirer).
   - `tests/esv-maquette/ch130-telephone.test.cjs` :
     - `[role="tablist"] button` et `aria-selected` ;
     - `.sg-fen[data-activite]`, `.sg-tu-etat .sg-mot`, `.sg-barre-note`, `button[data-ordre]` (posé par la page) ;
     - `.sg-chaine li[data-partie="23"][data-etat="en-cours"]` ;
     - `.sg-registre` contenant « fin normale » (le **bilan**, D-362 : à ouvrir d'abord par son bouton, ou à retirer) ;
     - `[data-k="c:22:50"]`.
   - `tests/esv-maquette/ch111-telecommande.test.cjs` : `.sg-tu-etat .sg-mot`, `.sg-tu-etat .sg-partie`, `.sg-tu-etat .sg-phrase`, `.sg-tu-etat .sg-chiffre`, `.sg-barre-note`, `button[data-ordre]`.
   - La page du téléphone gère les actions `sg:details`, `sg:tiroir`, `sg:fermer`, `sg:menu` et `mode:*`, et les onglets. Si CH-129 ajoute un bouton d'en-tête (par exemple `sg:bilan`) : l'ajouter à `NAVIGATION` dans `src/telecommande-instantane.js` **et** à la page (`telecommande/telephone.html`, gestionnaire de clic, état `ui`). Sinon, le filtre le retire du téléphone : sûr, mais le bilan ne s'ouvre plus là.

## Clos le 19/11/2026
Le point 3 de « Pour l'intégrateur » (redéployer le relais une fois) est fait : déploiement par GitHub Actions (D-377), run `44482350002` réussi; page servie 19 459 octets, identique au dépôt, avec les quatre onglets; `signal-rendu.js` et `panel-signal.css` servis identiques au dépôt; contrôle de l'opérateur sur son iPhone : « tout fonctionne »; jeton supprimé ensuite. « Non prouvé » reste vrai pour le rendu iPhone (observation de l'opérateur, pas mesure de banc) ; les quatre essais de structure cités au point 4 ont été ajustés à CH-129 puis à CH-137.
