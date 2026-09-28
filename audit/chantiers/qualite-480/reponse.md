# Réponse à l'audit qualité 4.8 (Astra) — corrections intégrées à la 4.8.0

Audit : `audit/chantiers/audit-qualite-480.md` (branche `audit/qualite-480`,
`0ebb244`, intégrée telle quelle). Chaque constat a été vérifié dans le code
avant correction. Les cinq essais de caractérisation d'Astra
(`tests/audit-qualite-480.test.cjs`) sont **inversés** : ils exigent
désormais le comportement sûr, et échouent sur le code audité (vérifié en
remettant `panel.js`, `panel.html`, `panel.css`, `background.js` et
`src/native-session.js` de `a4d5e62` : 6 essais rouges, dont les nouveaux).
La version reste **4.8.0** (direction, 28/09) : ces corrections entrent dans
la 4.8.0 avant sa sortie ; le paquet du matin (`d3874290…`) est remplacé.

| Constat | Priorité | Suite | Preuve |
|---|---|---|---|
| **D01** purge d'Écho sans preuve de téléchargement | P1 | **Corrigé.** Les fichiers passent par `chrome.downloads` (permission `downloads`), qui rend l'état final ; seul un segment **confirmé** (`complete`) est purgé. Écrit sans confirmation : sorti de la file du vidage, gardé dans IndexedDB, repris par l'export final. Sans l'API : repli sur le lien, jamais purgé. | `tests/audit-qualite-480.test.cjs` (D01), `tests/budget-liberation.test.cjs` (acquittement sans confirmation), `tests/echo-vidage-audit-480.test.cjs` (fichier confirmé ou refusé ; l'export final attend un vidage en cours, fenêtre de course relevée à la relecture du correctif) ; Chromium réel : `telechargements.json` |
| **D02** couverture du panneau ≠ C1 | P2 | **Corrigé.** Couverture = posés sur les cuts distincts du lot, dernier cut sans décision compris ; seul le cut en cours d'un lot ouvert n'y est pas encore. p12 : 84 sur 106. | essai D02 |
| **D03** export groupé masque l'incomplétude | P2 | **Corrigé.** Chaque export rend ses fichiers (confirmés ou non) et ses alertes ; un export qui échoue n'arrête pas les autres ; le message final dit ce qui manque et reste affiché. | essai D03 ; Chromium : refus → « Export incomplet — … » |
| **U01** Écho proposé pendant une reprise manuelle | P2 | **Corrigé.** Bouton désactivé, message : terminer la reprise manuelle dans Orbite. | essai U01 |
| **U02** contrastes des petits textes colorés | P2 | **Corrigé.** Vert clair `#11834a` (4,81:1), ambre clair `#a46200` (4,85:1), bleu de la voie sur noir `#4a74e6` (4,93:1). | calcul WCAG 1.4.3 dans `panel.css` |
| **U03** export conseillé pas mis en avant | P2 | **Corrigé.** « Tout télécharger pour l'analyse » est dans la barre d'action, bouton plein en fin de lot ; le bilan seul passe dans les détails. | `tests/panel-ligne*.test.cjs` |
| **P01** copie de tout l'état avant allègement | P2 (projection) | **Corrigé pour la vue du panneau** : le lourd (enregistrements, `lotPosed`) est retiré avant la copie, même résultat qu'avant. La sauvegarde complète à chaque événement est dans le moteur épinglé : **4.9** (P3). | `tests/vue-panneau-audit-480.test.cjs` |
| **P02** intervalle « analyse » mal nommé | P2 | **Corrigé** dans `tools/perf-lot.cjs` : GCV1 (→ `proposed`), décision sur le lot (→ observation), analyse complète. p12 : 372 / 512 ms (médianes), comme mesuré par l'audit. | essai P02 ; kit `mesures/` régénéré |
| **D04** texte F5 obsolète du rapport de sortie | P2 (texte) | **Corrigé** ; C1 à C5 inchangés. Traçabilité automatisée du manifeste : **4.9**. | `audit/rapport-sortie-4.8.md` |
| **C02** essais du vrai panneau | P2, M | **En partie** : essai des téléchargements dans un vrai Chromium (`tools/navigateur-telechargements.cjs`, hors banc). Suite complète sur `panel.html` (clavier, focus, mouvement réduit) : **4.8.x**. | — |
| **C01** responsabilités autour du moteur gelé | P3 | **4.9** : coordinateur de lot, transitions nommées. | — |
| **P03** double calcul V4.6 + GCV1 | P3 | **4.9**, décision de la direction (question 3 de l'audit). | — |
| **U04** suivi par partie | P3 | **4.9**. | — |

Hors correctifs : la question de la mémoire et de la fluidité réelles dans ESV
reste ouverte tant que la session de `consignes/chantier-8-operateur.md`
n'a pas eu lieu.
