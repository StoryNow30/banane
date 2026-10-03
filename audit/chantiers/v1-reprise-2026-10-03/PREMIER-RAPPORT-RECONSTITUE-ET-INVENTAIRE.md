# Premier rapport et inventaire de reprise

Le premier rapport original de l'interruption n'est pas présent dans le ZIP remis. L'archive sauvegardée `V1-controle-prealable-reprise-2026-10-02.zip` est identifiée (166 012 octets, version 0). Une tentative du 3 octobre pour en récupérer les octets échoue : `library file transfer failed: download failed with HTTP status 502`, code 1. Aucun nouvel essai en boucle, aucun ancien checkpoint remplacé ou vidé. Ce document reconstitue le statut ; il ne remplace pas une preuve originale.

Constats historiques de la conversation : une copie p11 altérée avait empêché le contrôle complet ; sa conservation avait été demandée. Après reconstruction des entrées, un contrôle préalable puis le développement V1 avaient été entrepris. Le travail non commité et ses 25 tests annoncés ont ensuite disparu lors de l'entretien automatique. Le J1 candidat définitif, verify final et commit n'étaient pas établis. Les anciens résultats ne sont pas réutilisés et aucun contrôle historique n'est proclamé réussi dans cette reprise.

| Pièce | Statut actuel |
|---|---|
| Base ZIP, mission, avenants, complément et relecture V4 remis le 3 octobre | Récupérés localement, originaux conservés |
| Objet Git 4.8.6 et commit documentaire | Retrouvés séparément, preuves fraîches |
| Ancienne copie p11 altérée et preuves binaires de son échec | Introuvables dans les fichiers accessibles ; aucune altération fabriquée |
| Premier rapport original / archive de contrôle du 2 octobre | Identifié, octets indisponibles (502) ; présent résumé explicitement reconstitué |
| Patch V1 perdu, anciens 25 tests et anciennes sorties | Introuvables ; reconstruction autorisée, aucun résultat repris |
| Nouvelle copie p11 | Recréée en nouveau dossier ; comparaison octet pour octet avec source vérifiée et JSON valide (`p11-integrity.json`) |
| Entrées privées de J1 | 39 sources Git vérifiées et nouvelles extractions ; sources/segments conservés ; hors dépôt et transmission |
| Corpus natif propre à verify | Trois fichiers absents (`tools/native-corpus.cjs:20`) ; deux tests concernés sautés, non réussis |

La reprise remet des preuves neuves. La livraison finale distingue code reconstitué, documents historiques reçus et originaux indisponibles. Aucune mesure terrain ni acceptation V1 revendiquée.
