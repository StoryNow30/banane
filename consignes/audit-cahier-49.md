# Audit d'orchestration du cahier 4.9 v0.2 (session séparée)

À donner à une **session neuve** (Sol 6.1), différente de la future session de développement de la 4.9 : l'auditeur ne code pas,
il ne règle rien, il ne signe pas. Il a accès au dépôt `StoryNow30/banane` en lecture ; il écrit son rapport sur une branche à
lui. Astra est indisponible environ une semaine : cet audit la remplace pour le cahier, pas pour l'audit du diff avant une
version stable (D-061), qui reste à elle ou à une relecture indépendante.

```text
Tu es l'auditeur d'orchestration indépendant du projet Ariane (extension Edge MV3 qui pose les rails sur ESV LiDAR). Tu n'es
pas le développeur : tu ne modifies aucun fichier du dépôt sauf ton rapport, tu ne tranches aucun critère ouvert (c'est la
direction), tu ne signes rien. Réponds en français, court, chiffres sourcés.

DÉPÔT : StoryNow30/banane, branche `claude/banane-49-cahier-v02` (cahier v0.2, deux commits). Ton rapport va sur une branche
`sol/49-audit-cahier` créée à partir de celle-là, dans `audit/chantiers/audit-cahier-49.md`. Jamais main ; pas de merge, de
tag ni de force push.

LIS, DANS CET ORDRE :
1. BANANE_4.9_CAHIER.md (le document audité) ;
2. consignes/besoins-4.9-2026-09-30.md (les besoins de la direction : la source de vérité) ;
3. PASSATION_4.8.0.md (règles non négociables), PLAN_SUITE.md §§ 1 et 3, DECISIONS.md (D-054 ; D-057 à D-064), KNOWN_ISSUES.md
   (KI-059, 060, 064, 066 à 069) ;
4. audit/lots-20-24-33-2026-09-29.md, audit/lot-485-p25-2026-09-29.md, audit/orchestration-480-485-490-2026-09-28.md
   (les mesures citées), consignes/analyse-locale.md ;
5. sur la branche `claude/banane-486-ki069` : DECISIONS.md D-065 (la 4.8.6, base de code décidée le 30/09).

CE QUE TU VÉRIFIES :
A. Chiffres et citations. Tous les chiffres des portes et des mesures de départ (§ 3, § 4, § 5), et au moins 20 autres
   citations tirées au hasard (fichier:ligne) : exactes ? Tu écris « non vérifié » pour ce que tu n'as pas pu contrôler.
B. Traçabilité. Chaque exigence des besoins (minimum, objectif, exploration, conditions, exports, ordre) a-t-elle un chantier,
   une porte et une mesure dans le cahier ? Tableau besoins → cahier ; signale ce qui manque et ce qui a été ajouté sans
   demande.
C. Cohérence interne. Les décisions du § 2.4 sont-elles reflétées partout (§ 1, 2.3, 4, 5, 6, 9, 11, 12) ? Reste-t-il des
   contradictions entre sections, des dépendances circulaires, un ordre de chantiers qui ne tient pas ?
D. Mesurabilité. Chaque porte peut-elle être décidée par une mesure, avec quelle donnée ? Attention particulière : V3 (−25 % du
   cycle médian, 0 capture perdue), C4 (seuil respecté ≠ non-dégradation démontrée), « décisions identiques » (banc de
   633 cuts), l'A/A et la tolérance T3, le poids « −40 % » de V2.
E. Risques et sécurité du produit. Une optimisation peut-elle, par construction, poser ou valider un cut dont l'identité ou
   les données sont incertaines (V3 : préchargement), différer plus de cuts, ou perdre des données à l'export (V2, KI-064) ?
   Les règles non négociables (deux rails ou rien ; aucune validation ni SKIP automatique d'un cut non résolu) sont-elles
   tenues dans chaque chantier ?
F. Autonomie. Lis le cahier comme le ferait un exécutant qui n'a ni notre historique ni notre conversation : liste chaque
   endroit où tu devrais poser une question, et ce qui manque pour que la première question ne soit pas « où est-ce ». Vérifie
   la carte du code du § 14 (chemins, fonctions, essais) contre le dépôt.
G. Les 10 questions du § 12 : donne ton avis sur chacune (une à trois phrases, motivé).
H. Ce qui manque : chantier, porte, risque, mesure ou décision que le cahier oublie.

FORMAT DU RAPPORT (audit/chantiers/audit-cahier-49.md) : résumé de 10 lignes ; constats classés BLOQUANT (empêche la signature) /
À CORRIGER AVANT SIGNATURE / À NOTER, chacun avec la citation, fichier:ligne, ce que tu as constaté, une proposition ; tableau de
traçabilité ; avis sur les 10 questions ; verdict : « signable en l'état », « signable après les corrections listées » ou « à
refaire », avec la raison en deux lignes. Tu peux lancer `node tools/verify.cjs` (2 à 3 min) mais ce n'est pas demandé ; tu
peux lancer les outils de mesure (`tools/perf-lot.cjs`, `tools/analyse-locale.cjs`) sur les audits du dépôt pour contrôler un
chiffre. Aucune capture d'écran ni code d'ESV dans le dépôt. Ne réécris pas le cahier : propose.

Pousse ton rapport, puis réponds en 10 lignes maximum : branche, commit, verdict, les trois constats les plus graves.
```
