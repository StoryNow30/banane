# Registre de rotation des parties (D9, 29/09/2026)

Parties d'ESV déjà passées par Ariane (Banane avant la 4.8), pour choisir une
**partie neuve** à chaque lot de mesure (D-057 : rotation réglage /
validation ; les parties de validation ne servent jamais à régler). Une ligne
par passage : lot (Pilote / Orbite), relecture (Natif / Écho) ou session Natif.
« Posés » : cuts où Ariane a appliqué une paire (Natif et relectures : aucune
pose d'Ariane, « — »).

Sources : banane-data `collections/*/NOTES.md` (une collecte par date et
version) et les audits de ce dépôt cités. **À tenir à jour à chaque lot**
(une ligne, avec la collecte ou la source).

| Partie | Version | Date | Passage | Cuts posés | Source |
|---|---|---|---|---|---|
| 2 | 4.7.14 | 24/09 | 3 lots Pilote (cuts 20–138) ; relecture Natif ciblée (110–138) | lot `dfe095a5` : 25 / 42 ; autres lots non détaillés | `collections/2026-09-24_v4.7.14_/` ; `audit/cas-decalage-esv-p2-2026-09-24.md` |
| 2 | 4.7.18 | 25/09 | lot Pilote reliquat (768–8099) ; relecture Natif ; Natif passage à niveau 7801–7806 | 16 / 30 | `collections/2026-09-25_v4.7.18_/` ; `audit/lot-4718-p2-2026-09-25.md` |
| 3 | 4.7.18 | 25/09 | lot Pilote « long » (0–8209) ; relecture Natif | 49 / 82 | `collections/2026-09-25_v4.7.18_/` ; `audit/lot-4718-p3-2026-09-25.md` |
| 6 | 4.7.19 | 25/09 | lot Pilote reliquat (526–8131) | 73 / 125 | `collections/2026-09-25_v4.7.19_/` ; `audit/lot-4719-p6-2026-09-25.md` |
| 9 | 4.7.18 | 25/09 | lot Pilote « long » (0–8539) — **partie de validation** | 262 / 346 | `collections/2026-09-25_v4.7.18_/` |
| 9 | 4.7.19 | 25/09 | lot Pilote sur les différés (638–8819) ; relecture Natif (521 cuts) | 14 / 85 | `collections/2026-09-25_v4.7.19_/` ; `audit/lot-4719-p9-2026-09-25.md`, `audit/relecture-p9-2026-09-26.md` |
| 11 | 4.7.20 | 26/09 | lot Pilote (556–8146) — **partie de validation** | 82 / 96 | `collections/2026-09-26_v4.7.20_/` |
| 11 | 4.8.0 | 28/09 | lot Orbite d'essai (523–649) ; relecture Écho | cumul avec le lot 4.7.20 : 83 / 100 | `collections/2026-09-28_v4.8.0_/` ; `audit/terrain-4800-2026-09-28.md`, `audit/relecture-p11-2026-09-28.md` |
| 12 | 4.7.20 | 26/09 | lot Pilote (1–8144) — **partie de validation** ; relecture Natif (4.7.21) | 84 / 106 | `collections/2026-09-26_v4.7.20_/` ; `audit/lot-4720-p12-2026-09-26.md` |
| 13 | 4.7.21 | 26/09 | 3 lots Pilote (dès 0, dès 101, reprise des différés) | 33 / 46, 69 / 85, 40 / 75 | `collections/2026-09-26_v4.7.21_/` ; `audit/interruptions-4721-2026-09-26.md` |
| 14 | 4.7.21 | 26/09 | 2 lots Pilote (dès 1, dès 410) | 1 / 1, 57 / 63 | idem |
| 15 | 4.8.0 | 28/09 | lot Orbite d'essai (dès 1, arrêté au 104) | non relevé | `collections/2026-09-28_v4.8.0_/essai/` ; `audit/terrain-4800-2026-09-28.md` |
| 15 | 4.8.0 | 28/09 | lot Orbite (106 → fin de partie) | 192 / 251 | `collections/2026-09-28_v4.8.0_/lot p15/` ; `audit/lot-4800-p15-2026-09-28.md` |
| 19 | 4.7.6 | 23/09 | lot Pilote (29 cuts) ; relecture Natif (9019–9408) ; cuts 9033 et 9241 exclus | 15 / 29 | `collections/2026-09-23_v4.7.6_/` |
| 20 | 4.7.6 | 23/09 | 2 sessions Natif (107–995, 1099–1154) | — | idem |
| 22 | 4.7.6 | 23/09 | session Natif courte (1196–1205) | — | idem |
| 24 | 4.7.7 | 23/09 | session Natif (176 cuts, 764–8457) | — | `collections/2026-09-23_v4.7.7_/` |
| 20 à 24 | 4.8.0 | 28–29/09 | passages sous 4.8.0 signalés par la direction (29/09) | **non versé** : type, dates et posés inconnus | aucune collecte |
| 25 | 4.8.5 test 1 (4.8.5.1) | 29/09 | lot Orbite J2 (0 → fin de partie) ; partie déjà validée à 99 % au départ | 69 / 81 | `collections/2026-09-29_v4.8.5.1_/` (branche `claude/banane-47-gate-audit-vaktr1` de banane-data) ; `audit/lot-485-p25-2026-09-29.md` (branche `claude/banane-48-cahier`) |
| 30 | 4.7.7 | 24/09 | session Natif (83 cuts, 2473–8755) | — | `collections/2026-09-24_v4.7.7_/` |
| 30 | 4.7.8 | 24/09 | session Natif courte (9163–9172) | — | `collections/2026-09-24_v4.7.8_/` |
| 31 | 4.7.8 | 24/09 | lot Pilote ; relecture Natif | 35 / 51 | idem |
| 31 | 4.7.9 | 24/09 | lot Pilote, fin de partie (5062–9230) ; relecture Natif | 47 / 78 | `collections/2026-09-24_v4.7.9_/` |
| 33 | 4.7.10 | 24/09 | 2 lots Pilote (8065 → 8088 ; 8090 → 9201) | 20 traités ; 65 / 83 | `collections/2026-09-24_v4.7.10_/` |
| 34 | 4.7.11 | 24/09 | lot Pilote ; relecture Natif | 73 / 96 | `collections/2026-09-24_v4.7.11_/` |
| 35 | 4.7.12 | 24/09 | lot Pilote | 203 / 233 | `collections/2026-09-24_v4.7.12_/` |

## Parties déjà utilisées, en bref

2, 3, 6, 9, 11, 12, 13, 14, 15, 19, 20, 21, 22, 23, 24, 25, 30, 31, 33, 34, 35 ;
**18** figure aussi dans la liste de la fiche opérateur
(`consignes/operateur-suite.md`, étape 6) sans collecte retrouvée.
Parties de validation (jamais pour régler) : 9, 11, 12.

## Trous connus

- **Collecte Natif V4.6 du 16/09** (`collections/2026-09-16-native-v4.6/`) :
  3 sessions, 611 cuts distincts ; le manifeste ne consigne pas les parties.
- **Parties 20 à 24 sous 4.8.0** : aucun export versé ; à compléter (type de
  passage, dates, posés) si l'opérateur les dépose.
- **Partie 18** : aucune source.
- **Partie 25** : déjà validée à 99 % avant le lot (8 450 cuts sur 8 530) ; elle
  ne peut pas fournir les 100 posés jugés de J2 : le lot J2 suivant demande une
  partie avec au moins ~200 cuts non validés.
