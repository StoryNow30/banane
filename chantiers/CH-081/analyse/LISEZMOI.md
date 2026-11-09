# CH-081 — Scripts d'analyse de l'étude (scripts seulement, aucune donnée)

Les exports vivent dans `banane-data` ; on dézippe un export dans un dossier hors de `banane`, puis :

1. `node vues.cjs <dossier dézippé> > vues.json` : reconstitue, pour chaque capture du corpus, la caméra, la boîte de découpe, les rails et les nœuds visibles de chaque vue (fichier de travail, à garder hors de `banane`).
2. `node rejeu.cjs vues.json` : pose de la caméra et de la boîte par rapport aux rails, puis rejeu de la sélection de Potree 1.8 (frustum ∩ boîte).
3. `node diag.cjs vues.json` et `node diag2.cjs vues.json` : nœuds visibles qui échouent au frustum ou à la boîte, et leur écart à la fenêtre de capture.
4. `node transitions.cjs vues.json '<fenêtres>' [W]` : nœuds nouveaux par saut, couverts par la boîte et par le cube. `<fenêtres>` est un tableau JSON `[[début ISO, fin ISO, mode], …]` lu dans le journal du lot (événements `batch-started`, `relecture-debut`, …) ; `W` est le nombre de captures d'avant prises comme « déjà chargées ».
5. `node exces.cjs vues.json` : nœuds connus qui coupent la boîte sans être visibles (en trop).

Le rejeu avec le module livré est `tools/ch081-rejeu-corpus.cjs`. Les sorties ne contiennent que des comptes ; `vues.json` contient des positions : il ne doit jamais entrer dans `banane`.
