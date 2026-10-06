# Feuille de route Ariane 4.9 — proposition de l'orchestrateur (6 octobre 2026)

Statut : **proposition**, rien n'est décidé tant que Mic ne l'a pas dit. Elle s'appuie sur les études C, D, E (contre-vérifiées),
la lecture directe d'ESV, le banc ESV local (B) et les relectures indépendantes de V1, U1 et U2. Aucun gain n'est mesuré sur le
terrain : les chiffres « espérés » viennent de calculs sur les médianes de la partie 23 et **ne s'additionnent pas forcément**.
Le détail privé est dans `missions/*/RAPPORT.md` (hors dépôt). Voir aussi `PILOTAGE_REPRISE.md` (statuts) et `DECISIONS.md`.

## 1. Ordre proposé pour la 4.9 (suit le plan validé en D-076 et D-077)

| Étape | Contenu | Pourquoi dans cet ordre | Gain |
|---|---|---|---|
| 1 | **V1 adopté** : réécriture relue, correction (3) segments et ERROR, patch d'export intégré par G | Sans mesure fiable, aucune vitesse ne se prouve | Fiabilité de la mesure |
| 2 | **Observateur passif** (test, aucune commande ajoutée) : statut et contenu de l'écriture de validation ; pages de la liste des coupes ; chargements de points par visite | Donne la preuve d'enregistrement réelle (V1 : 1 validation sur 75 confirmée) et les comptes exacts | Fiabilité, données. Pas de vitesse |
| 3 | **Inventaire et fin de partie** par la liste des coupes (D-067, KI-069) ; **U1** compté à la source | Remplace les heuristiques ; réserve les parties de validation | Fiabilité |
| 4 | **V2 exports allégés** après les étapes 2 et 3 | Les données exactes viennent de la source | Taille et fiabilité des exports |
| 5 | **Retour à une coupe** par l'événement interne d'ESV (confirmé au banc), pas à pas en repli | D-068, conditions de sécurité D-067 | Confort opérateur |
| 6 | **V3 vitesse**, un changement par version, A/A d'abord : I1, puis I2, puis I3 | Seul levier de vitesse démontré | Voir § 2 |
| 7 | **U3 raccourcis** (action de `D` à décider) | Dépend de l'étude E | Confort |
| – | V4 : la paire comparative pèse 0,3 % du cycle : plus un levier de vitesse | D-076 | – |

## 2. Gains : espéré, mesuré, condition

Cycle de référence : partie 23, 6,6 s médian dont 4,5 s de capture. **Aucun gain terrain mesuré.**

| Idée | Espéré | Mesuré | Condition ou risque |
|---|---|---|---|
| I1 lecture sans attendre une image d'ESV | −1,3 à −1,4 s (environ −20 %) | Labo seulement : 903 → 286 ms par lecture ; points identiques sur 24 lectures (Chromium 141) | **Sortie du gel du lecteur** (décision de Mic). Chrome/Edge 129 à 140 non vérifiés |
| I2 sélection de vue au rythme des images | −0,8 à −1,0 s | Non mesuré | Trois des quatre sélections changent la vue |
| I3 signal de fin de chargement | environ −1,0 s (critère « −15 à −22 % » non démontré) | Non mesuré | Hypothèse non essayée ; l'observateur passif la testera d'abord |
| V5 stockage incrémental | environ −0,7 s par cycle vers la 85e visite | Dérive 5,5 → 7,4 s **confirmée** ; cause non démontrée | Seuil à fixer par Mic ; sinon seulement I4 (diagnostics) |

Lecture honnête de la porte « cycle médian −25 % » : d'après ces espoirs seuls, il faudrait **au moins deux** des trois
idées I1, I2, I3 pour l'atteindre. C'est un calcul d'espoir, pas une promesse.

## 3. Idées pour la précision et les cas difficiles (hors gel, expériences d'abord)

| Idée | État | Gain |
|---|---|---|
| D I-1 : vérifier la complétude du niveau de détail avant la capture | Sensibilité démontrée (8 rails sur 8 non résolus sans le niveau 11) ; cause non démontrée | Moins de rails non résolus. Non mesuré |
| D I-2 : voisines validées lues dans la liste des coupes (B1, 398/402) | Source confirmée ; levier non vérifié ; 398 et 402 sont posées à tort sous la 4.8.6 (rejeu fait) | Non mesuré |
| D I-3 : score de justesse hors ligne, sans activation | À faire hors ligne | Prépare l'apprentissage |
| Apprentissage (D-066) | 902 rails exacts recomptés (partie 20 : 54 %) : sommet de la zone 150 à 1 000 ; fiche de faisabilité non établie ; **aucune activation** | – |
| D I-5 : gabarit orienté par le dévers | Version future | – |

## 4. Expériences hors production (aucune sur le poste de Mic sans accord)

1. A/A du poste (bruit de la mesure) avant tout test de vitesse.
2. Banc ESV local : clé `world` du manifeste (version minimale d'Edge), coexistence de deux Ariane, script injecté par l'hôte.
3. Une validation réelle et un échec réel observés par l'observateur (le banc est simulé ; aucun échec réel jamais vu).
4. Tâche opérateur de 10 minutes pour B2 (rails hors écran, déplacement par la caméra Potree).
5. Plusieurs lots terrain avec V1 adopté, couverture 100 % et attestation du projet.

## 5. Ce que cette feuille de route n'est pas

Pas de date, pas de pourcentage d'avancement (règle du cahier). L'avenant D-067 estimait 11 à 16 cycles de 2 à 3 jours ; ce
calcul n'a pas été refait. Aucun changement de seuil, de porte, de critère ou de gel n'est proposé sans décision de Mic.
