# D-073 — présentation des mesures et préparation du test V1

**Décision de Mic, 4 octobre 2026, 08 h 01 (Europe/Paris).**

La direction répond « C’est OK » à l’explication des deux règles et de leur portée. Cet accord autorise la préparation de la version de test V1. L'acceptation terrain de V1 et la sortie de la 4.9 restent à établir.

## But

Mesurer où Ariane perd du temps, en identifiant les lots et en respectant les étapes qui peuvent s'exécuter simultanément.

## Règles adoptées

1. **Projet absent du fichier : déclaration séparée.** Le projet et le périmètre sont documentés à côté de l'export, avec la date, l'opérateur, la partie, les coupes, la version et l'empreinte du fichier correspondant. Les données brutes restent intactes et projectId n'est pas inventé. Le rapport sépare identité observée et identité déclarée. Une déclaration ne résout pas une contradiction ou une liaison incertaine entre coupes.
2. **Étapes qui se chevauchent : chronologie réelle conservée.** Les événements et le chevauchement sont publiés. Une durée non calculable reste non mesurée. Ne pas compter deux fois le même temps, fabriquer un zéro ou ajouter une commande ESV pour rendre le cycle artificiellement séquentiel.

## Portée exacte

Ces règles organisent la présentation et la préparation des essais. Elles ne relâchent pas coverage.complete, ne valident pas des mesures manquantes, ne remplacent pas les contrôles de santé/export et n'autorisent pas à accepter V1. L'utilisation de ces catégories pour la porte finale nécessite des critères précis proposés et une décision distincte de Mic.

Le candidat corrigé relu est baa548d81a0bf7059ae1711163527a918cf2257d. Le rapport indépendant ciblé clôt les deux réserves techniques sur les cas contrôlés. Autorisation : documents, métadonnées de version, contrôles et génération locale du paquet de test. Aucun changement des règles de pose, aucune accélération, aucun correctif V4, aucun entraînement.

La préparation ne lance pas de séance ESV, ne publie rien et n'autorise pas d'écriture dans banane-data. P2 reste accepté ; V1 terrain reste non mesuré/non accepté. Les autres décisions, gels, dépendances et conditions d'acceptation restent en vigueur. Le cahier signé et les rapports historiques ne sont pas réécrits.

## Trace

- Proposition complète de l'orchestrateur : Decision_V1_apres_relecture_2026-10-03.zip.
- Explication en langage simple : V1 chronomètre Ariane ; le nom du projet est noté à côté lorsqu'il manque ; les étapes simultanées sont signalées pour éviter le double compte ; accord permettant de préparer une version de test sans déclarer V1 terminé.
- Réponse de la direction : « C’est OK », le 4 octobre 2026 à 08 h 01.

Ce texte est l'avenant local adopté, fourni au développeur. Il n'est pas annoncé comme déjà commité ou publié dans le dépôt. Vérifier l'absence de collision de numéro lors de sa consignation, sans écraser l'historique.
