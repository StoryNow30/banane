# Chantier 2 — prompt de l’analyste

**Pour :** un analyste de données. **Branche :** `chantier-48/faux-isoles`. **Rapport :** `audit/chantiers/faux-isoles.md`.
Aucune intervention de ta part : toutes les données sont déjà dans banane-data.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es analyste de données. Tu mesures hors ligne et tu proposes une règle ;
tu ne modifies ni le moteur ni le module de décision.

CONTEXTE
Banane est une extension Chrome/Edge (Manifest V3) qui aide un opérateur à
poser les rails sur ESV LiDAR, outil web de validation de coupes LiDAR
ferroviaires. Un « cut » est une coupe transversale de la voie : l'opérateur
y place deux rails (gauche, droite) puis valide. Banane observe (mode
Natif), propose (Assisté) ou enchaîne un lot de cuts (Pilote). Son moteur
géométrique (GCV1) propose la position de chaque rail ou s'abstient ; un cut
que le Pilote ne sait pas placer est « différé » : il le quitte sans décision.

DÉPÔTS
- Code : https://github.com/StoryNow30/banane
  Pars du commit a74c225 (branche claude/banane-48-cahier : code 4.7.8).
  Crée ta branche depuis ce commit : chantier-48/faux-isoles
- Données : https://github.com/StoryNow30/banane-data
  branche claude/banane-47-gate-audit-vaktr1, dossier collections/ :
    2026-09-23_v4.7.6_/pilote + corr/          lot Pilote partie 19 + sa relecture Natif
    2026-09-23_v4.7.6_/session nativ/          Natif partie 20 : session longue
                                               (exports 07-05 à 07-23) et courte (07-46 à 07-48)
    2026-09-23_v4.7.6_/natif p22 logique operateur/   Natif partie 22
    2026-09-23_v4.7.7_/session nativ/          Natif partie 24
  Archives 7z de segments JSON (noms avec espaces : mets les chemins entre
  guillemets). NOTES.md et manifest.json décrivent chaque collecte. Fusion
  des segments : tools/merge-segments.cjs, qui accepte un dossier. La
  session longue est lourde : node --max-old-space-size=12000.

À LIRE D'ABORD, dans cet ordre
LIRE_EN_PREMIER.md ; PLAN_4.8.md ; BANANE_4.8_CAHIER.md §5.5, §6, §7, §14 et
amendements n°6 à n°9 ; DECISIONS.md D-036 à D-039 ; KNOWN_ISSUES.md KI-043
à KI-047. Le cahier est le contrat : s'il contredit cette consigne, il
l'emporte, et tu le signales.

INTERDITS, sans exception
- Aucun push sur main, aucun merge, aucun tag, aucune release, aucun force
  push, aucun reset destructif, aucune réécriture d'historique.
- Aucune modification des fichiers gelés : src/geometry.js,
  vendor/capture-core.js, vendor/lidar.js (empreintes 4.4.0), src/engine.js
  (baseline déclarée) ; ni du moteur : src/gcv1-shadow.js,
  src/geometry-candidate-v1.js, src/placement-convention.js.
- Écartement de voie : contrat [1405, 1470] mm en ADMISSIBILITÉ seulement.
  Jamais une cible : « le candidat le plus proche de 1435 » ne sera jamais
  implémenté, et l'écartement des cuts voisins n'est jamais une cible.
- Aucune application partielle (un seul rail), aucun VALIDATE ni SKIP
  automatique, aucune navigation présentée comme une décision.
- Aucune position humaine (correction de l'opérateur) dans l'entrée du
  moteur : la référence humaine ne sert qu'à JUGER, après coup.
- Cuts 9033 et 9241 exclus de toute mesure, à la demande de l'opérateur.

RÈGLES DE MESURE (D-038)
- Un cut est FAUX si l'erreur latérale OU verticale d'un rail dépasse 10 mm
  par rapport à la pose finale de l'opérateur.
- Couverture = cuts DISTINCTS du lot ; une revisite n'est pas un nouveau
  cut ; les cuts sans entrée, différés ou refusés restent au dénominateur.
- Toute exclusion est explicite, comptée et motivée.

MÉTHODE
- Sépare toujours VÉRIFIÉ (commande exécutée + sortie) et SUPPOSÉ. Un
  chiffre sans commande reproductible n'est pas un résultat.
- Style du code existant : JavaScript compact, modules UMD dans src/, outils
  CommonJS dans tools/, commentaires en français. Aucune dépendance nouvelle.
- Tests : node --test. Banc complet : node tools/verify.cjs ; il lance tous
  les fichiers de test en parallèle avec 10 s par fichier : découpe un test
  lourd en plusieurs fichiers plutôt que d'allonger le délai. Sans le corpus
  privé, 2 tests sont ignorés : c'est normal, dis-le.
- N'écris aucun identifiant de modèle d'IA dans les commits ni les fichiers.

LIVRABLE COMMUN
- Ta branche poussée, commits clairs.
- Le rapport audit/chantiers/faux-isoles.md : fait, vérifié (commandes),
  supposé, questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 2 — FAUX ISOLÉS DU PREMIER PASSAGE

POURQUOI
La décision sur le lot a fait, hors ligne sur 392 cuts jugés, 4 cuts faux
(amendement n°9 §9.2 ; audit/lot-choice-2026-09-23.json) :
- 241, 409, 983 : appliqués dès le premier passage par le moteur depuis la
  pose ESV, sur des cuts « isolés » que la garde de continuité (30 mm contre
  la droite des voisins) ne peut pas contredire (pas d'ancre à moins de 3
  numéros, ou écart sous le seuil) ;
- 407 : second passage, fenêtre déplacée, 144 mm.
Déjà connu : 241 a un rail posé 40 mm trop bas, publié par S1 (repêchage des
ambiguïtés), sur un calage jugé hors domaine (KI-043) ; 983 a un rail à
14–15 mm. Tous sont dans la session Natif longue de la partie 20.
L'objectif 4.8 est 0 faux (D-038). Il faut un signal, lisible par le moteur
SANS position humaine, qui arrête ces cuts en les DIFFÉRANT.

À FAIRE
1. Reproduis d'abord les 4 faux avec tools/lot-choice-study.cjs (en-tête du
   fichier ; variante retenue : --variant B --chain guarded --sides both) sur
   les cinq sessions (parties 19 relecture, 20 longue, 20 courte, 22, 24) ;
   donne la commande exacte et sa sortie. Si tu n'obtiens pas les mêmes
   chiffres que le §9.2, arrête-toi et dis pourquoi : c'est déjà un résultat.
2. Pour CHAQUE cut appliqué (justes et faux, toutes sessions), extrais par
   rail les signaux disponibles au moteur : chemin de publication (A_STAR
   direct, S1, flanc partiel), rapport de perte meilleur/second minimum,
   points de dessus et de flanc sous le gabarit, statut du calage (appliqué,
   hors domaine), densité et visibilité des points, déplacement depuis la
   pose ESV (latéral, vertical), écartement de paire, écart à la droite des
   voisins quand elle existe. Tout est dans le résultat de
   Shadow.scientificProposeBoth (src/gcv1-shadow.js) et dans
   src/lot-decision.js (candidatesOf).
3. Cherche des règles de GARDE (le cut est différé, jamais déplacé) ; pour
   chacune : faux arrêtés / justes perdus, session par session. Préfère une
   règle qui a une raison physique (« S1 sur calage hors domaine => différer »)
   à un seuil ajusté sur 4 cas.
4. Généralisation : règle construite sur la partie 20 longue SEULEMENT, puis
   appliquée telle quelle aux parties 24, 19, 22 et 20 courte ; rapporte les
   deux séparément. Avec 4 cas positifs, dis honnêtement ce que la mesure
   peut et ne peut pas soutenir.
5. Pour 407 (second passage), dis si la même règle l'arrête, sinon ce qui le
   distingue.

HORS PÉRIMÈTRE : modifier src/ ; la règle retenue sera proposée comme
amendement, la direction décide.

LIVRABLE PROPRE AU CHANTIER : tools/isolated-wrong-study.cjs et ses tests
rapides ; audit/chantiers/faux-isoles.md et le relevé JSON ; un tableau
« règle / faux arrêtés / justes perdus / par session ».
```
