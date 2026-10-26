# Réseau d'IA du projet Ariane : qui fait quoi, et comment

Écrit le 26/10/2026 après la pause décidée par l'opérateur (42 % du quota hebdomadaire consommé le lundi, pour un gain jugé faible). Principe : **une seule tête, des bras interchangeables, des juges qui ne sont pas des IA.** Les règles courtes sont dans `CLAUDE.md` à la racine ; ce document explique l'organisation.

## 1. Les rôles

| Rôle | Tenu par | Fait | Ne fait jamais |
|---|---|---|---|
| **Décideur, testeur terrain** | L'opérateur | Fixe les objectifs, tranche (D-xxx), essaie dans ESV et Edge, exporte après chaque partie | |
| **Intégrateur** | Claude Code en session cloud, modèle économique | Écrit les tickets, relit les diffs des chantiers, fusionne dans le tronc, lance le verify et la garde une fois par version, fabrique le paquet et la consigne, tient `DECISIONS.md` et le cahier, archive les exports dans `banane-data` | Coder les gros morceaux ; lire un journal à la main ; lancer plusieurs verify |
| **Exécutant** | Même harnais Claude Code mais sur un modèle à bas coût (plan de code GLM via Z.ai, ou Kimi Code) sur le poste de l'opérateur, ou Cursor pour l'interface | Un ticket borné : essais rouges, code, essais verts, commits sur `chantier/<ticket>`, rapport d'une demi-page | Les modules de décision et d'écriture (liste dans `CLAUDE.md`), la version, le paquet, le tronc, les exports |
| **Chercheur GCV2** | Claude Code, agents sur le modèle économique, Opus seulement pour concevoir | Le chantier des différés : banc, ESV local (maquette), garde, mesure, itère jusqu'au gain | Livrer sans la garde verte et la parité |
| **Relecteur froid** | Le modèle le plus fort, une fois par version | Revue adversaire du diff qui touche la sécurité, la pose ou l'écriture | Tout le reste |
| **Juges mécaniques** | Scripts, sans IA | `tools/verify.cjs`, `tools/garde-gcv2.cjs`, parités, maquette ESV, `banane-data/outils/analyse-lots/` (jugement des lots contre l'Écho), archivage | |

Pourquoi le même harnais pour l'intégrateur et l'exécutant : Claude Code lit `CLAUDE.md`, les mêmes outils et les mêmes essais ; seul le modèle change. Les plans de code de Z.ai (GLM) et de Moonshot (Kimi Code) se branchent sur Claude Code par une variable d'environnement de base d'API. Cursor garde une place pour l'interface, où voir le résultat compte, et pour les retouches de l'opérateur lui-même ; son mode agent ne prend pas de modèle externe.

## 2. Le circuit d'un chantier

1. **Ticket.** L'intégrateur écrit `chantiers/CH-NNN.md` (une page) : but mesurable, fichiers autorisés, essais à écrire, critère de fin, interdits, coût prévu. Sans ticket, pas de chantier.
2. **Exécution.** L'exécutant part du tronc, branche `chantier/CH-NNN`, lit le ticket et `CLAUDE.md`, écrit l'essai rouge, le code, l'essai vert, lance les essais ciblés (pas le verify complet), pousse sa branche, écrit `chantiers/CH-NNN.rapport.md` (une demi-page : fait, pas fait, mesures).
3. **Revue.** L'intégrateur lit le diff en entier, vérifie les interdits par `git diff --stat` et un grep des motifs interdits, fait tourner les essais du ticket. Il renvoie à l'exécutant si une règle est touchée. Si le diff touche la sécurité, la pose ou l'écriture : passage au relecteur froid.
4. **Intégration.** Fusion dans le tronc (commit de fusion, pas de rebase). Une version de test regroupe plusieurs chantiers ; **un seul** verify complet, la garde, la parité, la maquette, puis paquet, SHA-256, consigne terrain.
5. **Terrain.** L'opérateur exporte avant d'installer, installe par-dessus, essaie, exporte après chaque partie, envoie les zips.
6. **Archivage et jugement.** Scripts : copie, SHA-256, CRC, scan d'identité, `NOTES.md`, puis le tableau standard du lot (jugés, > 20 mm, > 50 mm, mauvaise voie, différés, « poserait », garde). Un agent n'intervient que si le tableau montre une anomalie.

## 3. Les branches et les dépôts

- `banane`, tronc `claude/50-test17` : le code. Seul l'intégrateur y pousse, en avance simple. `chantier/<ticket>` pour les exécutants.
- `banane-data`, branche `claude/execute-prompt-00-18ra5a` : exports archivés (`collections/`), scripts d'analyse (`outils/`), documents de pilotage. Jamais ouvert à un exécutant externe.

## 4. Les données qui ne sortent pas

Vers un fournisseur externe (Z.ai, Moonshot, Cursor, autre), seul part le code du dépôt `banane`. **Jamais** un export terrain, un nuage, un journal, un code de projet ESV, une adresse d'ESV, un nom. Avant d'ouvrir le dépôt à un nouvel exécutant, l'intégrateur fait un scan des motifs interdits sur l'arbre entier et corrige ce qui reste. Dans Cursor, le mode privé est activé.

## 5. Le budget

- Quota hebdomadaire Claude : **30 % au plus** pour tout le projet, soit à titre indicatif 10 % intégration et paquets, 10 % tickets et revues, 10 % réserve (anomalies, recherche GCV2). L'intégrateur dit où on en est à chaque livraison.
- Modèle économique par défaut (D-250). Le plus fort pour concevoir et relire, en le disant.
- Un agent, un verify complet par version. Pas d'agent lancé en parallèle sur la même machine quand un verify tourne.
- Une session neuve par version ou par chantier d'intégration ; `LIRE_EN_PREMIER.md` et `CLAUDE.md` servent de passation. Une session qui se compacte plusieurs fois coûte plus qu'elle ne rend.

## 6. Les objectifs retenus (26/10/2026)

Dans l'ordre, chacun avec sa mesure ; le reste du cahier (`BANANE_5.0_CAHIER_V2.md` § 6) est en sommeil tant qu'ils ne sont pas tenus :

1. **Différés** : passer sous 5 % des cibles d'un lot, puis sous 3 %, par la correction de la GCV2 dans le lot et le déplacement de la vue (chantier 12, essai Edge de l'opérateur attendu). Chercheur GCV2, sous la garde, mesuré au banc et sur l'ESV local avant tout terrain.
2. **Interface** : la simplicité et le code couleur de Signal sont acquis et ne bougent pas. À reprendre : le mode palette (utilité à repenser) et le mouvement (animations jugées pauvres). Exécutant, tickets courts, revue visuelle de l'opérateur.
3. **Vitesse de la relecture** : la mesurer par phase, puis la réduire. Le temps par cut en lot est jugé acceptable par l'opérateur ; la cible de 2,44 s reste au banc seulement.
4. **Écriture de la deuxième passe** : aucun développement ; elle se rouvre par décision de l'opérateur quand 125 « poserait » jugés sans faute seront accumulés par les exports (au 26/10 : 27 jugés, 0 à plus de 50 mm).

En sommeil : file de parties (T27), SKIP en ombre, choix de voie en ADV, précision sous 5 mm, contre-expertise des verts, refonte de l'accueil.

## 7. Le modèle externe

Choix du 26/10 (prix relevés sur des sources secondaires, à vérifier sur les pages des fournisseurs avant d'acheter) : **plan de code GLM de Z.ai**, palier d'entrée (de l'ordre de 18 $ par mois), branché sur Claude Code. Raisons : il tourne dans le harnais que le projet utilise déjà, donc mêmes règles, mêmes essais, même `CLAUDE.md` ; il est facturé à la requête et non au jeton, donc prévisible. Solution de repli : Kimi Code (abonnement Moonshot, palier d'entrée du même ordre). Cursor reste pour l'interface et les retouches de l'opérateur ; ses modèles tiers sont facturés au prix d'API sur crédit prépayé, et son mode agent ne prend pas de modèle externe.
