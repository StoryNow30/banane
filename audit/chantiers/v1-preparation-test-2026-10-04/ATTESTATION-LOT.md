# Déclaration de projet pour un lot V1

Modèle à remplir uniquement pour une séance effectivement réalisée. Ce modèle n'identifie aucun projet ou lot à l'avance et n'autorise aucune séance.

| Information | À renseigner |
|---|---|
| Date, heure et fuseau | |
| Nom exact du projet | |
| Partie et plage de coupes attendues | |
| Opérateur | |
| Version test, commit et empreinte du paquet | |
| Machine, largeur de fenêtre ESV, zoom et extensions actives | |
| Identifiants lot/session effectivement exportés | |
| Début, fin, pauses et changements de contexte | |
| Nom et SHA-256 de chaque export/segment correspondant | |
| Projet observé dans l'export ou absent | |

Déclaration de l'opérateur : « Ce lot correspond au projet et au périmètre indiqués ci-dessus. Les éventuels changements de projet ou de partie sont signalés. »

Les données brutes ne sont pas modifiées. Cette déclaration reste distincte d'un identifiant de projet observé par Ariane. Elle ne comble pas un manque de mesure, une perte, un conflit ou une association incertaine entre coupes.

## Compléments pour garantir le périmètre

Liste ordonnée exacte des coupes attendues (avec exclusions motivées), usages antérieurs et réservations contrôlées : à compléter après validation du périmètre. Autorisation de séance et budget : référence à renseigner, aucune autorisation créée par ce modèle.

| Export/segment effectivement enregistré | Ordre et lot/session/horloge observés | Taille octets | SHA-256 | État disque confirmé |
|---|---|---:|---|---|
| À renseigner | | | | |

Joindre tous les segments, dictionnaires/manifeste existants et ce manifeste externe ; identifier les doublons et tentatives non confirmées sans effacer les originaux. Projet absent reste absent.

Début/fin : dates, heures et fuseau ; pauses/reprises et leur cause ; changement de projet/partie/réglage : à renseigner. Dimensions exactes de fenêtre ESV, zoom, OS/navigateur/ESV observables, extensions actives : à renseigner.

Statut v1TimingExport et santé : à relever de chaque export ; toute perte, timeout, écriture en attente ou santé absente reste signalée. Signature/date opérateur : à renseigner pour la séance réellement effectuée. Ce document ne valide ni couverture complète ni acceptation V1.
