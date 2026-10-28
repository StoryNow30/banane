# Fiche de reprise : A/A puis V3 (capture plus rapide) : 12 octobre 2026

**État au 13 octobre (D-087).** A/A fait sur les exports reçus (T3 proposé 7 %) ; V3 expérience I1 livrée en 4.9.0.6, tirée cut par cut dans un même lot ; en attente du lot de l'opérateur,
mesuré par `node tools/perf-v3.cjs BILAN.json`. Les étapes 1 à 3 ci-dessous sont remplacées par la consigne du test 6. Suite : V5 (`fiches/FICHE_V5.md`).

**But.** (1) Mesurer le bruit du protocole : test A/A = la même version, sans accélération, sur deux lots comparables (cahier § 4.2, M3). (2) Puis V3 : une
expérience de capture par version de test, comparée à la référence (M1, blocs alternés). Porte 4.9.0 : cycle médian −25 %, C1 non dégradé (C4 retiré, D-085),
C3 = 0, zéro capture perdue.

**Départ.** Référence de mesure = **4.9.0.5** = 4.9.0.4 (vidage permis après un dernier cut différé) + borne d'écartement 1420 mm (D-085). Branche `claude/49-test-5`.
Une seule version sert à tout l'A/A. Acquis : mesure V1 par phase (`tools/perf-lot.cjs`, `tools/perf-phases.cjs`), observateur passif, exports zip, analyse locale
(`node tools/analyse-locale.cjs DOSSIER`). Lots déjà mesurés (partie 3, 4.9.0.3) : cycle médian 8,3 s et 9,5 s, non comparables (coupes différentes), C1 90,6 %.

**Reste, dans l'ordre.**
1. L'opérateur installe 4.9.0.5 (par-dessus), vérifie la version, vide le cache (nouveauté du vidage), me donne le message.
2. A/A : deux lots (même poste, même Chrome, même fenêtre ESV d'au moins 600 px, mêmes réglages, mêmes extensions), deux parties neuves de difficulté comparable, Orbite
   seulement, un lot chacune ; noter taille de fenêtre, zoom, extensions actives, heure (cahier § 4.1). Zips à me renvoyer (morceaux de 20 Mo si besoin).
3. Orchestrateur, sans agent : `analyse-locale` + `perf-lot` sur les deux lots ; publier les trois mesures ensemble (cahier § 4.3 : temps médian par cut hors silences,
   durée totale avec interventions manuelles, arrêts pour 100 cuts) ; l'écart entre les deux lots = bruit (T3, § 4.4) ; l'opérateur valide la tolérance.
4. V3, expérience 1 : une seule modification, d'abord I1 (lecture sans attendre une image d'ESV, labo −1,3 s, sortie du gel du lecteur déjà autorisée « hors gel en test », D-078),
   puis I2, puis I3. Chaque version de test = un cycle de terrain (2 à 3 jours) et un lot comparé à la référence.

**Critères et références.** Cahier § 4 (protocole), § 4.3 (trois mesures), § 4.4 (tolérance), § 6 V3, § 7 (portes), `FEUILLE_DE_ROUTE_49.md` § 2 (gains espérés, non mesurés).

**Décisions de l'opérateur en attente.** Tolérance issue de l'A/A (après mesure). Définition du temps médian hors silences (le cahier propose de garder `SILENCE_MS = 60000`).

**À ne pas relire.** Les rapports de missions A à G, les relectures des tests 3 et 4, `verification.txt`.

**Modèle et effort.** Analyse des lots : niveau rapide, bas. Conception de l'expérience V3 : niveau fort, élevé. Code V3 : niveau fort, élevé, tests rouges d'abord. Relecture : un seul agent de niveau fort, seulement si le code touche l'ordre des lectures ou l'enregistrement.
