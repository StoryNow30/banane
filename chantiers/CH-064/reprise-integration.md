# CH-064 — reprise mesurée du 08/11/2026

**ÉTABLI.** Reprise depuis `da422ebd`, puis fusion du dernier tronc validé `5699f688` (`b6296a70`). CH-075 reste séparé : sa maquette réelle est bloquée par une politique administrée du navigateur. Aucun réglage métier nouveau, aucune intégration au tronc ni paquet lors de cette reprise.

- `99c89ee7` : les outils refusent le corpus absent, vide ou sans document exploitable ; le cache de décision reste dans le dépôt de données. Les cinq essais de garde passent (rouge constaté avant correction). Le lot Chromium par défaut est ramené à 20.
- `0669dc57` : huit lignes adaptées aux contrôles de Clippy 1.99.1, sans désactiver de lint : tranches de taille fixe, `unwrap_or` au lieu d'une application identité, condition au lieu d'une boucle à un élément. Aucun changement voulu du calcul.
- Clippy de l'espace, natif et `wasm32-unknown-unknown`, avec `--all-targets -- -D warnings` : deux exécutions terminées avec le code 0.
- Les quatre anciens rouges CH-066 ont été lancés explicitement : quatre réussites. `18ae4b98` retire leurs omissions ; `cargo test --workspace` réussit ensuite **85 essais, zéro échec et zéro omission**.
- Les gardes d'identité et de noms passent (13 essais). Le scan public passe ; les deux variables de motifs confidentiels sont absentes, leur contrôle reste non effectué.

Le cœur WASM a été reconstruit sur ces sources : 1 897 629 octets. Sa section mémoire annonce un minimum de 1 114 112 octets et un **maximum de 268 435 456 octets (256 Mio)**. Le plafond a donc été lu dans le binaire, en plus de sa configuration Cargo.

Le corpus de données est au commit `4ba702e5`, limité aux collections des 04–06/11 : **85 archives, 1 012 312 490 octets**. Les données et caches restent hors du dépôt de code. La régénération des fixtures de décision parcourt **102 fichiers sans échec**, enregistre **18 333 appels** et signale **811 appels non clonables** ; fichier produit de 156 996 655 octets. Ce sont des compteurs de fixtures, pas une preuve de parité complète.

La lecture des cinq journaux de ce corpus (407 121 294 octets) trouve **zéro événement de type `rust`**. Elle ne fournit donc aucune mesure de lecture servie ou de repli du paquet Vision. Deux journaux portent un identifiant de construction, dont la provenance précise n'a pas été classée ; l'absence d'un essai Vision n'est pas déduite de ce seul comptage.

**EN COURS.** Parité D complète dans Chromium, lots de 20, avec le plafond de 256 Mio et une limite de tâche de deux heures. Le résultat est d'abord conservé côté données, puis sera inspecté avant toute copie de son bilan dans le code. Aucun verdict final de cette passe n'est encore acquis. Après la parité : patchs CH-070 et CH-071, puis preuves de CH-074 selon la passation. Les anciens résultats non poussés avant renouvellement de l'environnement ne sont pas réutilisés comme résultats de cette tête.
