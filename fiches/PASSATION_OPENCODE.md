# Passage de la main à OpenCode (D-364, 17/11 au 17/12)

But : à la fin du mois, OpenCode fait seul la production et le développement d'Ariane ; Claude ne fait plus que relire quand l'opérateur le demande. Chaque étape ne s'ouvre que si la précédente est **tenue**, constaté par l'intégrateur et écrit au hub.

## Ce que l'opérateur prépare sur le VPS (une fois)
1. Accès GitHub en lecture et écriture à `StoryNow30/banane` et `StoryNow30/banane-data` (jeton ou application GitHub), `git config user.name/user.email`.
2. Node.js 22, Python 3, Chromium (pour la maquette ESV : `CHROMIUM=<chemin> node tests/esv-maquette/essais.cjs`), et Playwright.
3. Clones : `banane` sur `claude/50-test17`, `banane-data` sur `claude/execute-prompt-00-18ra5a`.
4. L'adresse du relais dans `~/.ariane/relais.txt`, hors dépôt (elle contient son nom).
5. OpenCode lit `AGENTS.md` à la racine (renvoi vers `CLAUDE.md`).

## Étapes
| Étape | Qui fait quoi | Tenue quand |
|---|---|---|
| **1. Prise en main** (semaine du 17/11) | OpenCode : CH-131, refabriquer la Vision 19.1 sur le VPS, verify, maquette, paquet, et dire où il diffère du livré. | Paquet identique au livré fichier pour fichier (hors `BUILD`), verify vert, rapport au hub. |
| **2. Exécutant** (semaine du 24/11) | OpenCode : chantiers `chantier/CH-NNN` (analyses d'exports par script, correctifs). Claude : tickets, relecture de chaque diff, intégration, paquets. | Deux chantiers rendus sans retouche de fond, essais rouges puis verts, aucun interdit franchi. |
| **3. Intégrateur sous relecture** (semaine du 1/12) | OpenCode : intégration sur une branche `integration/…`, verify, maquette, paquet, journal des versions. Claude : relit et autorise l'avance du tronc. | Une version livrée par OpenCode, acceptée par l'opérateur sur le terrain. |
| **4. La main entière** (à partir du 8/12) | OpenCode pousse le tronc, écrit les tickets, propose la direction à l'opérateur. Claude : relecture à la demande. | Décision écrite de l'opérateur. |

## Ce qui ne change pas
Les interdits de `CLAUDE.md` (aucune donnée de terrain ni nom dans `banane`, jamais SKIP, plafond de 10, pas de réécriture d'historique, aucun nom de modèle d'IA, adresse du relais hors dépôt) ; les décisions de l'opérateur (`DECISIONS.md`, jamais réécrites) ; une version = un verify complet, la maquette si un chemin navigateur change, les parités si un module de décision change.

## État
- **17/11 : SUSPENDU par l'opérateur (D-365)** : d'abord clore Ariane 5.0. Rien n'est lancé chez OpenCode.
- 17/11 : D-364 écrite, `AGENTS.md` et ce plan au tronc, émetteur `opencode` reconnu par le hub, ticket CH-131 prêt. En attente : le VPS prêt (liste ci-dessus).
