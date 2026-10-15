#!/usr/bin/env python3
"""Assemble consignes/dossier-passation-externe.md : un seul fichier autonome pour un modèle qui n'a pas accès au dépôt.
Le préambule est écrit à la main ; le reste est recopié tel quel depuis les fichiers du dépôt (rien n'est résumé).
Usage : dossier-passation-externe.py [--output F.md]"""
import argparse, re, subprocess
from pathlib import Path

R = Path(__file__).resolve().parent.parent

PREAMBULE = """# Dossier de passation Ariane — pour un modèle sans accès au dépôt

Généré depuis la branche `main` du dépôt `banane` (tête : {tete}). Ce fichier est autonome : lis-le en entier avant de répondre.

## 0. Ton rôle

Tu aides la **direction** (l'opérateur, qui travaille dans les SIG) à **orchestrer, décider et cadrer** la version 4.9 d'Ariane :
brainstorm, cahier des charges, choix d'ordre et de portes chiffrées, grilles d'essai, prompts de développement. Tu n'as ni le dépôt
ni ESV : tu ne peux ni exécuter d'outil ni vérifier du code. Donc :
- **N'invente aucun chiffre ni aucun comportement d'ESV.** Les chiffres viennent des scripts du projet (rapports, `verify`, portes) ; ce
  dossier en donne l'état. Marque tes affirmations **VÉRIFIÉ** (lu dans ce dossier) ou **SUPPOSÉ** (déduit).
- Ce que tu produis est une **proposition** : la direction la relit, puis Claude (Opus pour le code risqué, Sonnet pour le bien spécifié)
  la vérifie contre le code et écrit ou **réécrit** le code. Ne prétends pas qu'un changement est fait, testé ou livré.
- Réponses courtes, en français. Une chose à la fois : le quota de la direction est limité.

## 1. Le projet en dix lignes

- **Ariane** (ex-Banane) est une extension Edge/Chrome (Manifest V3) qui pose des **rails** sur des coupes LiDAR (« cuts ») affichées dans
  la page web **ESV LiDAR**. Une **partie** est une suite de cuts numérotés de 0 à M−1.
- **Écho** observe le travail de l'opérateur (relecture) ; **Orbite** enchaîne automatiquement un **lot** de cuts : capture, décision,
  pose des deux rails, validation, cut suivant. « Deux rails ou rien » : sans pose fiable des deux rails, le cut est **différé** et
  l'opérateur le traite.
- Trois composants : un **adaptateur** injecté dans la page ESV (`src/adapter-page.js`, monde principal), un **pont** (`src/bridge.js`),
  un **service worker** (`background.js`) qui pilote le lot. Le **moteur** (`src/engine.js`) est **épinglé** (ne pas le modifier) ; la
  décision (`src/lot-decision.js`, `src/gauge.js`) ne change que sur décision datée de la direction, avec les portes J1.
- **Mesures** : C1 = part des cuts posés, C3 = poses hors contrat d'écartement (doit être 0), C4 = taux de **faux** (erreur > 10 mm, latéral
  ou vertical, contre le travail de l'opérateur à la relecture). Les rapports viennent de `tools/acceptance-report.cjs` ; l'analyse des
  exports lourds se fait chez l'opérateur (`tools/analyse-locale.cjs`, page `reducteur-exports.html`).
- **Portes** : `node tools/verify.cjs` (essais), portes J1 (`tools/portes-j1.cjs`), paquet reproductible (trois constructions identiques),
  puis la direction pose l'étiquette. **Ni merge, ni étiquette, ni publication sans l'accord de la direction.**

## 2. État au 30 septembre 2026

- **Stable : Ariane 4.8.5** (étiquette `v4.8.5` = `323356c`, publiée). Retour arrière : 4.8.0 (`v4.8.0`).
- **4.8.6 test 1 en essai** (branche `claude/banane-486-ki069`, décision D-065 non encore dans `main`) : corrige KI-069, voir §6.
- **Mesures 4.8.5** : lots 25 et 33 (test 1) C1 85,2 % et 84,0 %, C3 0 ; C4 partie 25 : 2 faux sur 62 jugés, **validé sur l'expertise de la
  direction** (pas une mesure conforme à la porte : moins de 100 jugés). 4.8.0, parties 21 à 24 : 1 faux sur 353 jugés.
- **Astra** (auditeur d'orchestration, autre modèle) est indisponible environ une semaine. Grok relit des diffs.
- **Décision de la direction (30/09), option B, chemin normal** : la porte de la 4.9.0 reste **cycle médian −25 %** (donc le chantier V3),
  C1 et C4 non dégradés ; aucun raccourci de périmètre ni de procédure ; « pas pressé, la meilleure version ». Chemin : 4.8.5 stable →
  **cahier 4.9 v0.2** (chantiers ordonnés, portes chiffrées) → audit d'Astra → **signature de la direction** → chantiers.

## 3. Règles de collaboration (non négociables)

- Décisions numérotées `D-0xx` dans `DECISIONS.md` ; une décision de la direction est citée telle quelle.
- Aucun code ni capture d'écran d'ESV dans les dépôts. Aucun identifiant de modèle dans les fichiers du dépôt.
- Pas de VALIDATE ni de SKIP automatique d'un cut non résolu ; cuts 9033 et 9241 exclus ; écartement [1405, 1470] mm en admissibilité seulement.
- Commits avec `Co-Authored-By` et `Claude-Session` ; un commit par chantier, préfixé `[Vn]`.

## 4. Ce que la direction attend de toi pour la 4.9

Un **brouillon de cahier 4.9 v0.2** à partir de `PLAN_SUITE.md` §3 et des mesures (§ « Mesures »), des **portes chiffrées** discutables, un
**ordre** des chantiers, des **risques** et des **questions ouvertes** ; puis, chantier par chantier, un **prompt de développement** précis
que Claude exécutera. Signale toute incohérence entre ce dossier et ce que tu supposes.

## 5. Contenu de ce dossier (recopié tel quel)

1. `LIRE_EN_PREMIER.md` (état) · 2. `PASSATION_4.8.0.md` (règles) · 3. `PLAN_SUITE.md` (plan, chantiers 4.9) · 4. `DECISIONS.md` D-057 à D-064 ·
5. `KNOWN_ISSUES.md`, lignes KI-061, KI-063, KI-066 à KI-069 · 6. `audit/lots-20-24-33-2026-09-29.md` (mesures) · 7. `consignes/analyse-locale.md`
(chaîne d'analyse) · 8. `consignes/demarrage-session-49.md` (décision B et ordre) · 9. `BANANE_4.9_CAHIER.md` (brouillon 0.1 du 24/09).

## 6. Point d'actualité : KI-069 / 4.8.6

Au dernier cut à valider d'une partie, Orbite valide avec le bouton d'ESV « valider et passer au suivant » : ESV charge alors la partie
suivante (terrain, partie 36 : « Cut 8785 of part 36 », « 8760 on 8786 treated » ; M = nombre de cuts, dernier cut = M−1). Correctif en essai
(4.8.6 test 1) : sur le dernier cut **certain** (N = M−1, M lu dans le compteur), Orbite valide par le raccourci d'ESV **Ctrl+Entrée**, qui valide
sans avancer (hypothèse de l'opérateur, à confirmer sur le terrain), vérifie l'effet (identité inchangée, compteur N → N+1) et ferme le lot ;
pas de repli automatique vers « valider et suivant ». Hors périmètre : export alourdi (KI-068), détection « lot terminé sauf différés ».

---
"""

def section(fichier, titre):
    return f"\n\n# ═══ {titre} ═══\n\n" + (R / fichier).read_text(encoding='utf-8').rstrip() + "\n"

def decisions():
    t = (R / 'DECISIONS.md').read_text(encoding='utf-8')
    d = t.index('## D-064'); f = t.index('## D-056')
    return "\n\n# ═══ DECISIONS.md — D-057 à D-064 ═══\n\n" + t[d:f].rstrip() + "\n"

def lignes_ki():
    ki = {'KI-061', 'KI-063', 'KI-066', 'KI-067', 'KI-068', 'KI-069'}
    out = [l for l in (R / 'KNOWN_ISSUES.md').read_text(encoding='utf-8').split('\n') if re.match(r'\| (KI-\d+) \|', l) and re.match(r'\| (KI-\d+)', l).group(1) in ki]
    return "\n\n# ═══ KNOWN_ISSUES.md — lignes KI-061, KI-063, KI-066 à KI-069 ═══\n\n| N° | Gravité | État | Description |\n|---|---|---|---|\n" + "\n".join(out) + "\n"

def main():
    p = argparse.ArgumentParser(); p.add_argument('--output', default=str(R / 'consignes/dossier-passation-externe.md')); o = p.parse_args()
    tete = subprocess.run(['git', '-C', str(R), 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'inconnue'
    txt = PREAMBULE.format(tete=tete) + section('LIRE_EN_PREMIER.md', 'LIRE_EN_PREMIER.md') + section('PASSATION_4.8.0.md', 'PASSATION_4.8.0.md') \
        + section('PLAN_SUITE.md', 'PLAN_SUITE.md') + decisions() + lignes_ki() + section('audit/lots-20-24-33-2026-09-29.md', 'audit/lots-20-24-33-2026-09-29.md') \
        + section('consignes/analyse-locale.md', 'consignes/analyse-locale.md') + section('consignes/demarrage-session-49.md', 'consignes/demarrage-session-49.md') \
        + section('BANANE_4.9_CAHIER.md', 'BANANE_4.9_CAHIER.md (brouillon 0.1)')
    Path(o.output).write_text(txt, encoding='utf-8', newline='\n')
    print(f'{o.output} : {len(txt.encode()) // 1024} Ko, {txt.count(chr(10))} lignes')

if __name__ == '__main__': main()
