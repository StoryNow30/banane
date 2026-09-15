# Problèmes connus

Dernière mise à jour : 13 septembre 2026.

| Identifiant | Gravité | État | Problème |
|---|---|---|---|
| KI-023 | Élevée | V4.4.2 échouée en ESV ; V4.4.3 à vérifier | Le bouton flottant reste visible en V4.4.2 malgré une fenêtre Banane ouverte. Le test précédent ne reproduisait pas un filtre URL de fenêtre indisponible ni un statut asynchrone obsolète ; nouvelle présence par fenêtre/port et retrait du DOM testés localement. La cause précise de l'affichage Edge reste à confirmer sur place. |
| KI-020 | Élevée | À vérifier dans ESV 4.4.2 | L'export réel V4.4.1 a 539 309 points, mais zéro rail dont un checkpoint de stockage avant intention est démontré ; aucun résultat géométrique réel V4.4.2 ou superposition visuelle n'est disponible. |
| KI-021 | Moyenne | Régression terrain observée | Le masquage V4.4.2 ne fonctionne pas chez Mic : capture du bouton encore visible. Correction V4.4.3 à contrôler dans Edge ; fluidité Edge/Potree et persistance IndexedDB toujours non mesurées. |
| KI-022 | Moyenne | Limite de source | Une écriture Potree sur place sans incrément de version ni changement de références pourrait échapper à la détection ; l'unité du repère n'est pas calibrée indépendamment. |
| KI-001 | Bloquant | Ouvert | La source, la fraîcheur et la précision interne de l'écartement ESV ne sont pas observées. |
| KI-002 | Élevée | À tester dans ESV | `Shift + Backspace` est relayé dans Mes corrections sans appeler « prochain cut invalide », mais son effet serveur et sa navigation réels ne sont pas encore observés. |
| KI-003 | Élevée | Ouvert | L'identifiant projet ESV vaut `not-observed`, ce qui interdit une calibration sûre propre au dataset. |
| KI-004 | Élevée | Partiellement documenté | Les trois premiers exports sont en V4.4.0 et un export réel supplémentaire en V4.4.1 existe. Il ne fournit aucune paire comparable prouvée selon la chronologie requise ; aucun export V4.4.3 ni test complet de fluidité ESV n'existe. |
| KI-005 | Élevée | Accepté en TEST | Sur les 110 corrections humaines, le moteur inchangé ne produit deux rails comparables que pour 68 cuts ; 47 rails restent non résolus. |
| KI-006 | Moyenne | Ouvert | Les 47 cuts historiques proviennent d'une seule part et sont principalement des passages à niveau ; la généralisation n'est pas démontrée. |
| KI-007 | Moyenne | Corrigé, à vérifier ESV | Une fermeture avec adaptateur muet produit `PAUSED_ADAPTER_UNRESPONSIVE` ; une action envoyée sans preuve serveur produit `FINISHED_WITH_UNCONFIRMED_ACTIONS`. |
| KI-008 | Moyenne | Ouvert hors Natif | Le nettoyage du relais de Mes corrections reste à vérifier dans le DOM ESV réel. Le relais Natif réutilise exactement les mêmes options à l'installation et au retrait. |
| KI-009 | Moyenne | Ouvert | Aucune confirmation serveur exploitable n'est observée ; une navigation n'est pas une preuve d'enregistrement. |
| KI-010 | Résolu | Fermé en 4.2.1 | Le seuil inférieur est fixé de manière unique à 1 410 mm. |
| KI-011 | Élevée | Mesuré, algorithme inchangé | Le banc confirme une couverture limitée et des divergences maximales d'environ 101 mm à gauche et 67 mm à droite. Aucune amélioration de placement n'est revendiquée en V4.4. |
| KI-012 | Moyenne | Données manquantes | Les exports historiques ne contiennent aucune geominfo brute, aucun contexte explicite de passage à niveau et aucun ordre ESV précédent/suivant certifié. |
| KI-013 | Élevée | Blocage documenté | Aucun attribut ESV vérifié ne permet au Mode Natif de distinguer sûrement un cut vert d'un cut rouge. Le champ reste non observé au lieu d'être déduit. |
| KI-014 | Moyenne | Correctif local, contrôle ESV attendu | Le LiDAR Natif ne couvre que la vue et le LOD déjà chargés. Le lecteur 4.4.1 priorise les nœuds utiles mais sa couverture réelle et son budget 1 800 ms doivent être mesurés sur un nouveau JSON. Un rail absent ou un changement donne une capture partielle avec motif. |
| KI-015 | Élevée | À mesurer dans Edge | La mesure de fluidité actuelle est une simulation Node. L'impact réel sur le rendu WebGL, Potree, IndexedDB et la navigation rapide doit être mesuré avec Natif inactif puis actif. |
| KI-016 | Moyenne | Garde-fou actif | Les visites Natif restent `usableForTraining:false`, même lorsqu'elles sont éligibles comme référence après revue. Aucun outil de promotion contrôlée n'est encore livré. |
| KI-017 | Élevée | Cause démontrée, correctif à confirmer dans ESV | Sur 115 captures V4.4, 114 atteignaient une limite, 103 avaient au moins une sonde dans une zone de rail, mais seulement 4 points ont été exportés. La lecture séquentielle épuisait les 300 ms avant les nœuds utiles et le statut `no-points` masquait parfois la limite. Le lecteur Natif 4.4.1 priorise les nœuds et distingue les causes ; efficacité réelle encore inconnue. |
| KI-018 | Élevée | Blocage de preuve terrain | Le JSON V4.4.1 audité contient 76 visites et 539 309 points, mais 0 rail comparable prouvé faute de checkpoint de stockage antérieur à l'intention. La superposition visuelle réelle, les métriques géométriques V4.4.3 et la fluidité Edge restent à certifier. |
| KI-019 | Moyenne | Incertitude de qualification conservée | La convention d'unités ESV n'est pas calibrée indépendamment et une validation native observée n'est pas une certification humaine revue. Les exemples restent candidats à l'analyse hors ligne et exclus de l'entraînement automatique. |

Les anciens exports restent lisibles. Aucun problème connu n'autorise à modifier rétroactivement les références, à leur attribuer une conformité d'écartement ou à confondre une intention opérateur avec une confirmation serveur.
