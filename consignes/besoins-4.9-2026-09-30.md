# Ariane 4.9 — besoins finaux pour le cahier v0.2

**Date : 30 septembre 2026.**

**Statut : proposition consolidée à transmettre pour la rédaction du cahier 4.9 v0.2.** Ce document rassemble les besoins et les précisions retenus dans les échanges. Il ne vaut ni cahier signé, ni validation du développement. Les mesures, la faisabilité et les critères encore ouverts doivent être vérifiés avant la signature de la direction.

Sources : dossier de passation externe, notamment `PLAN_SUITE.md` §3, D-057 à D-064 et les mesures des lots 20 à 33 ; précisions échangées le 30 septembre. **VÉRIFIÉ** signifie documenté dans le dossier, sans vérification indépendante du dépôt. Les chiffres supplémentaires fournis dans les échanges restent à confirmer par les outils du projet.

## 1. Accélérer Orbite en conservant la qualité

| Niveau | Exigence |
|---|---|
| **Minimum de sortie** | Réduction d'au moins **25 % du temps médian par cut**, sans baisse de la proportion de cuts posés automatiquement (C1), sans pose hors des limites d'écartement (C3 = 0), avec la qualité des poses dans le seuil prévu (C4). |
| **Objectif** | Viser **40 % de réduction**, avec les mêmes exigences de qualité. Cet objectif ne remplace pas le minimum de sortie et ne bloque pas à lui seul la sortie. |
| **Exploration** | Rechercher des gains supérieurs, y compris 50 % si une piste sûre le permet. Atteindre 25 % ne justifie pas d'abandonner une piste sûre identifiée. Aucun gain supérieur n'est promis avant mesure. |

Les optimisations doivent conserver les vérifications avant pose et validation. Une amélioration ne peut pas gagner du temps en différant davantage de cuts ou en laissant plus de travail manuel à l'opérateur.

Le préchargement du cut suivant est une piste à tester, pas une solution acquise. Le critère d'arrêt est clair : **aucune pose ni validation si l'identité du cut ou l'appartenance de ses données est incertaine**. Les adaptations éventuelles doivent préserver la reprise, la pause et l'arrêt du lot.

### Base de comparaison à fixer avant les essais d'accélération

La référence retenue est la **4.8.5 stable**, équipée de la mesure du temps par étape (V1), **sans accélération et sans changement des règles de décision**. La version accélérée doit être mesurée avec la même instrumentation. La référence et son contenu exact doivent être identifiés dans le rapport.

Le protocole est écrit avant V3 : mêmes cuts ou même partie selon une méthode réalisable et documentée, même machine, mêmes conditions d'affichage, vue ESV d'au moins 600 pixels de large. La méthode doit tenir compte des validations déjà présentes dans ESV et ne pas utiliser la relecture d'un cut pour régler sa propre décision.

Trois mesures sont publiées ensemble :

- le **temps médian par cut hors silences**, avec une définition fixe et explicite des silences exclus ;
- la **durée totale du lot**, attentes et pauses comprises, avec les interventions manuelles identifiées ;
- le **nombre d'arrêts pour 100 cuts**, avec les pauses et les causes séparées.

Une réduction du temps habituel par cut ne suffit pas si le traitement total se rallonge ou si les interruptions augmentent. La règle de comparaison de ces deux contrôles complémentaires doit être précisée dans le cahier avant V3, sans inventer ici une tolérance chiffrée.

**VÉRIFIÉ :** le dossier indique environ 48 % pour la capture dans une mesure antérieure. Le retour du 30 septembre précise que cette mesure vient de la 4.8.0, partie 15, et fournit 4,3 s sur 6,7 s pour « navigation vers capture » du lot 25. Ces durées ne couvrent pas exactement la même étape. V1 doit vérifier leur définition et les confirmer sur plusieurs lots ; aucune de ces proportions ne constitue une constante de référence pour la 4.9.

La règle C4 doit être recopiée précisément dans le cahier. Le dossier donne notamment au moins 100 posés jugés et 80 % des posés, dans l'ordre sans sélection, au plus 2 faux pour 100 jugés, avec les faux et les posés non jugés listés. La validation par expertise de la 4.8.5 ne remplace pas cette mesure pour la 4.9. Le cahier doit aussi préciser comment contrôler la non-dégradation de qualité souhaitée sans confondre respect du seuil et démonstration statistique.

## 2. Alléger et simplifier les fichiers d'Orbite et d'Écho

### Deux actions claires

| Action proposée | Résultat attendu |
|---|---|
| **Sauvegarder tout** | Un fichier complet par lot Orbite ou session Écho, contenant tout le nécessaire pour conserver, vérifier et réanalyser le travail. |
| **Préparer pour analyse** | Un petit fichier prêt à transmettre manuellement, sans tri ni regroupement de morceaux. Cette action ne transmet rien à un tiers. |

Le fichier complet contient aussi une partie préparée pour l'analyse. Le petit fichier peut être récupéré directement par la seconde action, sans ouvrir et parcourir la sauvegarde complète.

### Sauvegarde complète

Le ZIP unique est le format proposé, sous réserve de faisabilité sur les longues sessions. L'objectif utilisateur reste un seul fichier à récupérer ; les éventuels segments internes sont regroupés automatiquement.

Avant de promettre ce résultat, le développement doit démontrer une construction progressive qui ne nécessite pas de réunir plusieurs Go dans la mémoire du navigateur. La possibilité d'écrire progressivement vers le disque doit être vérifiée sur le poste réel de l'opérateur, avec ses restrictions éventuelles. Une impossibilité doit être remontée à la direction avec une solution de remplacement concrète, sans réintroduire silencieusement le tri de dizaines de fichiers.

L'allègement passe par la compression et la suppression des copies inutiles. **Les points LiDAR et les autres informations nécessaires aux analyses complètes sont conservés.** Le petit fichier d'analyse est un complément ; il ne remplace pas la sauvegarde complète. La lecture des anciens exports reste possible.

Le plan initial propose une réduction de taille de **40 % pour V2**. Le cahier doit fixer le périmètre et la base de cette comparaison, en distinguant le gain dû à la suppression des données d'autres sessions du gain obtenu sur les seules données utiles. Aucun pourcentage identique n'est présumé pour Écho sans mesure.

### Petit fichier : essai obligatoire avant livraison

L'analyse du petit fichier doit produire **exactement les mêmes résultats que l'analyse de la sauvegarde complète** pour le même lot ou la même session : C1 à C4 quand ils sont calculables, écarts de pose, temps et états non évaluables. **Zéro différence** est la condition d'acceptation ; un résultat non mesuré ne devient pas un résultat nul.

Le contenu doit être limité au lot ou à la session sélectionné, en conservant ses références nécessaires. Les visites et événements étrangers sont exclus. Cela reprend la correction KI-068, documentée dans le dossier.

### Fiabilité de l'enregistrement

- Le fichier doit être déclaré complet seulement si son contenu attendu est présent et son enregistrement confirmé.
- En cas d'échec ou d'interruption, les données sources restent disponibles et l'opérateur peut réessayer.
- Aucun effacement automatique ne se fonde uniquement sur le lancement du téléchargement.
- Les essais couvrent notamment un enregistrement refusé ou interrompu, un fichier incomplet, un nouvel essai et une longue session représentative.

Ces exigences conservent la protection déjà introduite contre la perte de données à l'export, **VÉRIFIÉE dans le dossier pour KI-064**.

## 3. Nommer les fichiers clairement

Nom proposé :

`Ariane_2026-09-30_1345_Partie-36_Orbite_v4.9.0.zip`

Les noms contiennent la date, l'heure, le numéro de partie, le mode Orbite ou Écho et la version d'Ariane. Le petit fichier reprend ces éléments et ajoute `Analyse`. La version est également enregistrée dans le contenu, afin que la lecture ne dépende pas uniquement du nom.

Deux exports ne doivent pas s'écraser si leur heure est identique. Le développement choisit une distinction simple, sans recréer des noms difficiles à lire. Le traitement des rares sessions couvrant plusieurs parties doit être précisé avant livraison.

## 4. Conserver le reste du programme initial

| Élément | Résultat attendu et place dans le programme |
|---|---|
| **Résumé de partie — U1** | Voir les lots, les cuts distincts traités, les différés restants et ce qui reste inconnu, sans compter deux fois une reprise. Prévu en 4.9.0. |
| **Contrôle du panneau — U2** | Vérifier le clavier, le passage du focus entre les commandes, l'affichage agrandi à 200 % et le fonctionnement avec les animations réduites. |
| **Raccourcis — U3** | Préciser les actions de `D` et `Maj + Espace`, sans détourner ni doubler une action d'ESV. `Maj + Espace` valide déjà dans ESV selon les échanges. |
| **Régularité humaine — P2** | Reposer 30 cuts en aveugle, une fois, pour mesurer la variabilité de la référence humaine avant de conclure sur la précision. Ne pas modifier automatiquement les seuils de qualité à partir du résultat. |
| **Longues sessions — V5** | Mesurer les dérives de mémoire ou de temps ; chantier de stockage conditionnel si elles sont constatées. La faisabilité de l'export unique reste à vérifier dans tous les cas. |
| **Rails voisins validés — B1** | En 4.9.5, utiliser des voisins fiables en dernier recours si leur identité, leur validation, leurs coordonnées et leur fraîcheur sont confirmées. C1 en hausse, aucun faux ajouté sur les cas évalués. |
| **Déplacement de la vue — B2** | En 4.9.5, rendre accessibles les rails hors écran, après vérification terrain de la commande possible. Aucun faux ajouté, deux rails ou aucun, contrôle de la pose avant validation et temps supplémentaire mesuré. |
| **Organisation des transitions du lot — B3** | En 4.9.5 seulement si le déplacement de la vue l'exige ; reste dans le programme conditionnel. |
| **Origine des mesures** | Identifier la version exacte, les fichiers d'entrée et les commandes de calcul de chaque rapport. Garder une partie de validation neuve avant tout réglage. |

Le correctif de fin de partie KI-069, en essai dans la 4.8.6 d'après le dossier, reste suivi séparément. Son résultat et la base de code réellement retenue doivent être précisés avant les chantiers 4.9, sans intégrer un correctif non validé ni changer silencieusement la référence de mesure 4.8.5.

L'apprentissage d'un nouveau moteur reste après la 4.9 ; le fonctionnement sur plusieurs sessions, onglets et parties reste prévu pour la 5.0.

## 5. Ordre et passage au développement

1. **Mesurer : P2 et V1.** Fixer et documenter la référence avant toute accélération.
2. **Alléger et simplifier les exports : V2 et KI-068.** Orbite et Écho, sauvegarde complète et fichier d'analyse, noms lisibles, faisabilité du fichier unique et sécurité de l'enregistrement.
3. **Accélérer Orbite : V4 puis V3.** Retirer du traitement automatique la comparaison secondaire V4.6, qui reste accessible à la demande ; essayer un réglage à la fois, avec mesure et relecture.
4. **Finaliser le suivi : U1 à U3.** Une chose à la fois ; V5 selon le résultat des longues sessions. Le contrôle du panneau intervient avant livraison.
5. **Traiter les cuts difficiles en 4.9.5 : B1, B2, puis B3 si nécessaire.**

Le moteur épinglé et les protections existantes restent respectés : deux rails ou rien ; aucune validation ni aucun SKIP automatique d'un cut non résolu ; écartement admissible de 1 405 à 1 470 mm, jamais utilisé comme cible ; cuts 9033 et 9241 exclus.

**Étape suivante :** rédiger le cahier 4.9 v0.2 à partir de ces besoins, vérifier les chiffres et la faisabilité contre les mesures et le dépôt, préciser les critères encore ouverts, puis le soumettre à l'audit d'orchestration et à la signature de la direction. La mise en œuvre suit le cahier signé ; merge, étiquette et publication restent soumis à l'accord explicite de la direction.

---

## Vérification par l'orchestrateur (30/09/2026), à intégrer au cahier

Le texte ci-dessus est celui de la direction, inchangé. Vérifié contre le dépôt (`banane`, `main`) :

1. **Correction du §1 (« ne couvrent pas exactement la même étape ») : c'est bien la MÊME étape.** Le tableau de
   `audit/orchestration-480-485-490-2026-09-28.md` (ligne 118) donne, pour la partie 15 (4.8.0), « Navigation → capture
   reçue » : **4,54 s, 48 %** du cycle. Le lot 25 (4.8.5.1, `audit/lot-485-p25-2026-09-29.md`) donne « navigation → capture
   reçue » : **4,3 s, 63 %** de 6,7 s. La durée de la capture est **stable** (4,3 à 4,5 s) ; sa **part** a augmenté parce que le
   reste du cycle a raccourci (analyse 1,8 s → 0,5 s). Deux lots, deux parties : à confirmer par V1 sur plusieurs lots.
2. **Conséquence chiffrée** (à mesurer, non promise) : sur 6,7 s, −40 % vise environ 4,0 s ; le reste du cycle (analyse, pose,
   validation, ≈ 2,4 s) étant déjà court, il faudrait réduire « navigation → capture » d'environ 60 % si rien d'autre ne bouge.
3. **Cycle médian mesuré (hors silences), pour la base de départ** : 6,0 à 14,5 s selon les lots 4.8.0 (parties 20 à 24) ; 6,7 s
   (partie 25) et 8,7 s (partie 33) en 4.8.5.1. La variation entre parties est plus grande que le gain visé : le protocole de
   comparaison (mêmes cuts ou même partie, même machine) est donc indispensable. Source : `audit/lots-20-24-33-2026-09-29.md`.
4. **Exports** : 1,2 Mo environ par cut visité ; le journal du lot 33 a pesé 1,03 Go pour 100 cuts (KI-068 : données d'Écho
   embarquées). Limites de message de 64 Mio (KI-059) et exports en segments (KI-060) : ce sont les contraintes du ZIP unique.
5. **Les autres points du texte** (règle C4, V2 −40 %, ordre, B1 à B3, KI-064, règles du moteur) sont conformes à
   `PLAN_SUITE.md`, `DECISIONS.md` et `KNOWN_ISSUES.md`.
