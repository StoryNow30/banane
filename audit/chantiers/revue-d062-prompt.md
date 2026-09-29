# Relecture indépendante de D-062 (pour Grok ou une session neuve)

À faire : coller le prompt ci-dessous, puis le contenu de `revue-d062.patch` (46 Ko, diff `36b8242..0d29e54` de
`background.js`, `panel.js`, `src/adapter-page.js`, `src/bridge.js`, avec 15 lignes de contexte). Le relecteur n'a
accès ni au dépôt ni à ESV : il ne juge que ce que le diff montre.

```text
Tu es relecteur de code indépendant. Contexte : Ariane est une extension Edge/Chrome (Manifest V3) qui pose des rails sur des coupes LiDAR affichées dans une page web (ESV). Son mode « Orbite » enchaîne les coupes d'un lot. Deux composants : un « adaptateur » injecté dans la page (src/adapter-page.js) qui exécute les commandes (capture, pose, validation, navigation), et un service worker (background.js) qui pilote le lot et écrit son état. Le diff joint applique la décision D-062 ; il ne touche ni le moteur de décision ni la géométrie. Le reste du diff est le changement de version 4.8.5.1 → 4.8.5.2.

Décision D-062 :
(a) M, le nombre de cuts de la partie, vient du compteur « N on M treated » d'ESV, lu par une instrumentation passive ; les cuts sont numérotés de 0 à M−1, donc le dernier cut est M−1.
(b) Après un cut DIFFÉRÉ (sans pose) suivi du départ d'ESV hors de la page, à la reprise le lot se ferme toujours ; la fin de partie n'est MÉMORISÉE (retenirFinPartie) que si ESV affiche alors une partie SUPÉRIEURE ET si le cut N du dernier différé vaut M−1. Sinon rien n'est mémorisé et le panneau explique pourquoi.
(c) Si une autre extension commande l'onglet pendant une pose : la pose en cours va à son terme, la validation suivante est refusée, le lot passe en pause.
(d) Risque accepté : dans ce cas l'opérateur contrôle la pose dans ESV avant tout rafraîchissement.

Vérifie en lisant le diff, sans rien supposer :
1. FIN DE PARTIE (background.js : rangerReleve, totalPartie, departApresDiffere, finApresDiffere). Existe-t-il un chemin où une FAUSSE fin de partie est mémorisée ? Pense à : M lu sur un autre cut que N, plusieurs compteurs dans la page, M illisible ou incohérent (N ≥ M), partie affichée inférieure ou égale, relevé périmé ou arrivé après le départ, valeur `dernier` calculée puis obsolète, intention de navigation qui a changé entre le départ et la reprise.
2. MISE EN SÉCURITÉ PENDANT UNE POSE (src/adapter-page.js : intrusion, EN_SECURITE, SUITE, refusSecurite et le gestionnaire de messages). Existe-t-il un chemin où l'adaptateur pose, valide ou navigue après l'intrusion sans que l'opérateur soit prévenu, où une pose non validée est laissée sans message clair, ou où l'état devient irrécupérable ?
3. MESSAGES (panel.js et les `notice` de background.js) : contradiction entre deux phrases affichées, message qui invite à une action dangereuse (par exemple saisir comme borne un cut qui n'est pas le dernier).
4. RÉGRESSIONS : tout changement de comportement en dehors de ces deux points.

Réponds en 8 lignes au plus. Pour chaque point : « OK » ou « PROBLÈME », le fichier et la ligne du diff, le scénario précis qui échoue, puis « VÉRIFIÉ » (tu l'as lu dans le diff) ou « SUPPOSÉ » (tu déduis sans voir le code appelé, absent du diff). Ne propose pas de refonte : signale seulement ce qui peut faire mémoriser une fausse fin de partie, ou poser ou valider à tort. Les tests (972 réussis) et la reproductibilité du paquet sont vérifiés à part : ne les commente pas.
```
