# Démarrage de la session de développement 4.8.5

Pour une **nouvelle session** Claude Code, avec les plugins **Superpowers** (obra)
et **Modern Web Guidance** (Google Chrome) activés ; **playwright** (Microsoft)
en option pour l'essai Chromium de D7. Design et Data attendront la 4.9.
Copie le bloc tel quel, comme premier message.

```text
Tu reprends Ariane (ex-Banane), extension Edge MV3 qui pose les rails sur ESV
LiDAR, pour développer la 4.8.5. Tu es l'orchestrateur : code, bancs,
paquets, documents. Réponses courtes, en français ; je suis l'opérateur et la
direction.

DÉPÔTS : StoryNow30/banane (pars de la tête de claude/banane-48-cahier) et
StoryNow30/banane-data. Vérifie d'abord l'état : branche, tête, étiquettes
(v4.8.0 = fabd77e, stable ; v4.7.21 = ead1cd1, retour arrière).

LIS, DANS CET ORDRE :
1. PASSATION_4.8.0.md (règles non négociables) ;
2. DECISIONS.md, D-057 à D-061 ;
3. PLAN_SUITE.md : le plan, ta feuille de route (§1 définition de « fini »,
   §2 chantiers D1 à D7) ;
4. audit/chantiers/audit-orchestration-485-astra.md : les scénarios de panne
   d'Astra, à transformer en essais rouges avant de coder D1, D3, D4 ;
5. KNOWN_ISSUES.md, KI-066 (fait) et KI-067 ;
6. banane-data travail/2026-09-28_banc-485/PREPARER.md : reconstruire les
   entrées du banc.

ORDRE : D5 (outils de portes) et D6 (clôture J0) d'abord ; puis D1 → D2 →
D4 → D3 ; puis D7 (revue, paquet « Ariane 4.8.5 TEST », version 4.8.5.1,
essai Chromium de cohabitation). Un commit par chantier, préfixé [Dn].
Utilise les skills test-driven-development, systematic-debugging et
verification-before-completion (Superpowers), chrome-extensions (Modern Web
Guidance) pour D1 (injection dans la page, monde principal, MV3), et
code-review sur chaque diff.

RÈGLES : `node tools/verify.cjs` à 0 avant chaque commit ; src/engine.js
épinglé ; écartement [1405, 1470] mm en admissibilité seulement ; deux rails
ou rien ; pas de VALIDATE ni de SKIP automatique d'un cut non résolu ; cuts
9033 et 9241 exclus ; aucune capture d'écran ni code d'ESV dans les dépôts ;
pas de merge, d'étiquette, de publication ni de force push sans mon accord ;
commits avec Co-Authored-By et Claude-Session ; aucun identifiant de modèle
dans les fichiers.

Commence par vérifier que les plugins Superpowers et Modern Web Guidance sont
chargés dans cette session (liste tes plugins) ; puis dis-moi en 5 lignes l'état que tu
trouves et ton premier pas.
```
