# Réservation locale proposée — 4.9.0 test 1

Version manifeste proposée 4.9.0.1 ; version_name « 4.9.0 test 1 ». Aucun changement de permissions, hôtes, commandes ou scripts. Numéro à confirmer auprès de la direction : le registre des réservations non publiées n'est pas disponible. Inventaire Git récupéré dans preuves-preparation/versions-connues.json ; aucune publication ni étiquette effectuée.

Les scripts restent ceux du candidat corrigé baa548d81a0bf7059ae1711163527a918cf2257d. src/core.js expose toujours VERSION=4.8.6 ; panel.html et src/bridge.js affichent toujours la référence 4.8.6. Le seul libellé ajusté est action.default_title. Ne pas présenter ces identités comme déjà harmonisées.

Obstacle confirmé par verify : tests/package.test.cjs:6 exige manifeste.version = src/core.js.VERSION et une version /^4\.8\.\d+(\.\d+)?$/ ; :11-16 exige l'affichage exact du manifeste dans panel.html et src/bridge.js. Une version 4.9.0.N ne peut satisfaire ces contraintes avec les scripts/tests inchangés. tools/verify.cjs:23-29 lance ce test et s'arrête sur son échec, avant les autres étapes de vérification. Aucun assouplissement de test ou changement runtime n'est autorisé ici.

Sans verify à zéro échec, aucun commit de préparation, git archive du candidat documentaire ou paquet installable de transmission n'est produit. La proposition reste un diff local révisable. Demander un arbitrage de périmètre précis pour tests/package.test.cjs, version interne et affichages avant une nouvelle mission ; ne pas appliquer ces changements ici.

D-073 est consigné intact dans consignes/avenant-D073-presentation-mesures-v1-2026-10-04.md. DECISIONS.md du code s'arrête à D-065 : D-066 à D-072 ne sont pas inventés ni insérés. La direction conserve la responsabilité de leur intégration et du registre de décisions. Cahier et anciens rapports restent intacts.

Contrôle fraîchement exécuté : 1 067 tests, 1 060 réussis, 5 échecs de numérotation/cohérence de version, 2 sautés, aucun annulé. Fichiers concernés : tests/cohabitation-485.test.cjs:12-33 (deux cas), tests/package.test.cjs:5-17, tests/revue-globale-485.test.cjs:71-79, tests/settings.test.cjs:95-101. Ce ne sont pas de nouveaux défauts de pose détectés ; ils bloquent néanmoins le zéro échec requis. La sortie audit/verification.json reste celle du candidat corrigé du 3 octobre, car verify n'arrive pas à son écriture.
