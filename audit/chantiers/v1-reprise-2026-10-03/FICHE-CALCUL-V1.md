# Fiche de calcul V1 — méthode de reconstruction

Statut : outil V1 implémenté et essais Node ; mesures terrain non mesurées. Référence de comparaison : 4.8.6 + instrumentation V1 à identifier par son commit local final. Aucun objectif de gain ni accélération dans V1.

Conserver le journal et ses événements. Le réducteur actuel vide `events` (`tools/reducteur-exports-core.js:63-64`) ; cet export n'est pas une entrée suffisante. Toute refonte d'export reste V2. Un export interrompu, sans début/fin, sans santé ou sans visite attendue ne démontre jamais 100 %.

Chaque enregistrement possède session, lot, horloge SW monotone propre au démarrage, visite et identité complète (projet/page/repère/profil/partie/coupe). Projet absent reste absent, avec portée limitée. Les requêtes sont corrélées à leur visite d'émission ; aucune trace tardive de la visite précédente ne complète la suivante. Aucun événement Écho ou autre lot ne comble une lacune.

| Phase | Bornes | Cas particuliers |
|---|---|---|
| Navigation → capture | Cible observée → réponse capture reçue | Première coupe déjà affichée : navigation inapplicable ; recapture : nouvelle tentative sans navigation |
| Analyse | Capture reçue → proposition durable | Inclut les opérations intermédiaires, pas géométrie pure |
| Décision | Proposition → décision observée durable | Ne prouve aucun ACK serveur |
| Pose | Décision → application relue durable | Différé sans pose : inapplicable |
| Après pose | Entrée dans finish → retour de sa lecture state | Bornes propres ; ce n'est pas du LiDAR |
| Validation | Après relu → acceptation locale durable | Une intention/commande seule ne vaut pas acceptation |
| Suivant | Acceptation → nouvelle cible observée | Navigation combinée antérieure : chevauchement séparé, durée non mesurée ; validation en place : inapplicable |

Chaque phase est mesurée, inapplicable avec raison, manquante ou chevauchée. Les lacunes ne deviennent jamais 0 ms. Toutes les visites sont publiées, y compris pause/reprise, différé, dernière coupe et nouvelle capture. La décision d'inapplicabilité ne supprime aucune phase déjà réalisée ou attendue manquante.

Cadence : cycles complets de navigation observée à suivant observé ; cycles > 60 000 ms exclus entièrement, nombre et durée publiés. Les silences sont les écarts strictement > 60 000 ms entre jalons utiles, pas des écritures de santé tardives. Quantiles identiques à l'outil historique : index arrondi `floor(p*(n-1)+0.5)`. Durée totale : bornes explicites de début et clôture du lot sur une même horloge, pauses comprises ; redémarrage = total non mesuré, aucun recalage wall clock implicite.

Arrêts : 100 × nombre d'arrêts / nombre de coupes distinctes sous leur identité complète. Publier séparément opérateur, protection, adaptateur sans réponse, ESV muet, garde et arrêt définitif. Les interventions manuelles et reprises restent visibles. Ne pas compter deux fois un même arrêt via commande opérateur et batch-state.

V4.6 : paire comparative complète (cerveau inclus) distincte des mono-rails scientifiques. Les bornes explicites de façade et d'appel public scientifique distinguent initial/seeded lorsque prouvées ; sinon catégorie non attribuée. Union des spans dans la fenêtre analyse et portion hors fenêtre ; aucune addition au cycle déjà mesuré. Les lectures/écritures internes non isolables restent non mesurées.

Écart : même cohorte comportant sept phases mesurées, somme des médianes, médiane des sommes et médiane des cycles publiées séparément, résidu expliqué par intervalles non couverts. Cohorte vide : non mesuré. Poids : JSON UTF-8 des événements réellement produits ; fenêtre synchrone de construction/envoi des événements séparée des opérations asynchrones de stockage et du coût complet des enveloppes non isolés. Tests synthétiques Node ≠ mesures Edge/terrain ; aucune promesse de taille totale de lot long.

Avant mesures terrain : relecture de l'orchestrateur et indépendante, puis mission distincte approuvant projets/parties, nombre de lots et lot long. Aucune partie réservée par cette fiche. KI-069 demeure à observer sans correction V1.

Usage, après conservation et autorisation de traitement : `node tools/perf-lot.cjs EXPORT_COMPLET.json --json mesures.json --md mesures.md`. Le JSON contient les résultats historiques et une annexe `v1`. Lire `v1.visits`, `v1.lots[].coverage` et les statuts avant toute médiane ; ne pas utiliser les résultats D5 pour remplir les lacunes V1. Sources candidat : `tools/perf-phases.cjs:14-98`, `tools/perf-lot.cjs:158-167`. Plusieurs fins (STOPPED puis reprise) ou horloges : total non mesuré ; toutes les visites restent publiées.
