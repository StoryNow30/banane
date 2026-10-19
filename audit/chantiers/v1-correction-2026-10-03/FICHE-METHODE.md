# V1 — méthode corrigée, avant relecture et terrain

Une ligne par visite, lot, session et horloge monotone du service worker. Ne pas joindre deux horloges, compléter un marqueur avec D5, ni confondre un journal synthétique avec un lot terrain. Médiane, p90, maximum et effectif par phase ; union des appels V4.6 pour éviter le double compte. Les 48 % / 63 % historiques (audit/orchestration-480-485-490-2026-09-28.md:118 ; audit/lot-485-p25-2026-09-29.md:21) restent historiques : les bornes suivantes diffèrent et aucune confirmation/infirmation n’est annoncée.

| Étape | D5, événements durables historiques | V1, jalons de réception dans le service worker |
|---|---|---|
| Navigation/capture | cut-target-changed ciblant la coupe → before-captured | cible observée → capture-received |
| Analyse | before-captured → proposed | capture-received → proposed |
| Décision lot | proposed → gcv1-shadow-observed | proposed → decision (gcv1-shadow-observed) |
| Pose | gcv1-shadow-observed → applied-verified | decision → pose-readback (applied-verified) |
| Après pose | applied-verified → after-captured | entrée finish → réponse adapter.state, span after-state-read |
| Validation | after-captured → validation-accepted | réponse state after-read → validation-accepted durable |
| Suivante | validation-accepted → cut-target-changed | acceptation locale durable → next-observed réel |

Sources : tools/perf-lot.cjs:101-128 ; tools/perf-phases.cjs:14-46 ; src/perf-phase.js:115-127,186-191 ; src/engine.js:153-161,255-256,809-812. D5 utilise la date murale des événements ; V1 utilise une seule horloge monotone corrélée et ses bornes de réception. D5 exclut les chaînes répétées, désordonnées et lentes ; V1 les expose avec leurs manques/chevauchements, sans effacer des visites.

Après pose, la 4.8.6 lit adapter.state : ce n’est pas une nouvelle capture LiDAR. La phase V1 dédiée ne comprend pas toute la sauvegarde durable qui suit cette réponse. Les bornes proposed, decision, pose-readback et accepted sont observées après l’écriture de leurs événements métier ; les enveloppes peuvent donc inclure stockage, contrôles et ordonnancement, et ne constituent pas un chronomètre CPU pur. Le coût local d’instrumentation est compté, le coût asynchrone du stockage demeure inconnu (tools/perf-phases.cjs:90-104). Aucun chiffre CPU ne peut être obtenu en soustrayant des médianes de cohortes différentes.

Navigation avant acceptation locale : overlapMs est la quantité positive de chevauchement, ms reste null. Ne pas substituer zéro ou « inapplicable ». Projet absent : identité insuffisante, même si les durées sont calculables. La proposition séparée décrit le traitement à soumettre à Mic ; la porte reste inchangée.

Export : budget technique commun de 250 ms pour toutes les écritures V1 en attente et la santé finale, sans allonger les opérations moteur. Une écriture lente peut finir après expiration ; elle reste en attente, jamais déclarée enregistrée. Les quatre exports transmettent v1TimingExport, y compris quand la santé ne peut pas être stockée. L’analyste doit garder ces métadonnées avec le journal : timeout, santé absente/rejetée, pertes, mauvais lot/horloge/séquence empêchent coverage.complete. Un statut flushed ne signifie pas que la porte terrain est satisfaite. Sources : src/perf-phase.js:28-56,149-167 ; background.js:921-922 ; tools/perf-phases.cjs:71-85.

Cette borne porte sur l’attente asynchrone de V1, pas sur le temps total d’export métier, le débit disque, ni un service worker dont la boucle JavaScript est suspendue. Aucune modification des règles de purge KI-064. Pas de purge avant preuve d’enregistrement. Aucun essai ESV autorisé par cette livraison.
