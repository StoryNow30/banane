# Vision 21 : intégrer CH-137 et CH-138 (D-371 à D-375)

**Qui :** OpenCode, intégrateur (D-375). Lis `fiches/PASSATION_OPENCODE.md` § 5 (une version) avant de commencer. Prérequis : CH-131 rendu (le VPS refait la Vision 20 à l'identique).

## Ce qui entre
1. **CH-137**, `chantier/CH-137` à `91601a5` (ou plus récent) : interface alternative « Mix » d'après la planche Q4 sombre (D-372), écrans neufs validés (D-374), « Glacier » par défaut (ex-Instrument), Cadran retiré, « Vue du lot / Vue fil », « Suivre dans Orbite » en action pleine de la Constellation en cours et en passage. Maquette : `banane-data/maquettes/figma-signal-mix-q4/`. Rapport : `chantiers/CH-137/rapport.md`.
   - **Reste à faire avant l'intégration** (section « Reste à faire » du rapport) : la maquette ESV ; tous les essais du panneau rejoués en Glacier ET en Mix (`UI5_VARIANTE=mix`) ; l'audit des écrans neufs (débordement, défilement, troncature, contraste 4,5:1, rien sous 11 px, recouvrement des boutons, 320 à 720 px, deux thèmes : outil `chantiers/CH-137/outils/audit.cjs`). Tout défaut se corrige sur la branche du chantier, essai rouge puis vert.
2. **CH-138**, `chantier/CH-138` : compteur des cuts appris à jour (D-371). Lis son rapport : si la génération n'était pas finie, il donne la commande exacte (`tools/compteur-gcv2.cjs`, sources `datasets/compteur-gcv2-sources.json`) et le doublon possible de la partie 0 (10 006 et 10 008 lignes) à trancher par la clé de trajectoire et le recouvrement des cuts corrigés. Rien d'identifiant (code de projet, adresse, UUID) dans `banane` : `node tools/scan-identite.cjs`.

## Fabriquer
Branche `integration/vision21` partie du tronc ; `git merge --no-ff` de chaque chantier ; essais ciblés ; `node tools/verify.cjs` (machine au repos) ; maquette ESV ; `CHANGELOG.md` (entrée « Vision 21 » sur le modèle de la Vision 20 : contenu, preuves, non couvert, installation) ; `LIRE_EN_PREMIER.md` ; paquet `python3 tools/package.py --output vision21.zip` ; avance simple du tronc ; zip remis à l'opérateur par le canal convenu (jamais dans un commit ni une publication : il contient l'adresse du relais). `main` reste à la 5.0 sauf décision de l'opérateur.

## Rendre compte
Au hub (`--de opencode --type rapport`) : comptes du verify et de la maquette, SHA-256 du paquet, ce qui n'est pas couvert.
