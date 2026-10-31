# Bilan de la 5.0 (brouillon de l'intégrateur, 31/10/2026)

Chaque chiffre dit sa source. ÉTABLI = mesuré ici (journal, essai, outil) ; TÉMOIGNAGE = dit par l'opérateur, non mesuré ; PROBABLE / SUPPOSÉ = lecture non prouvée. Rien n'est tiré de la 4.9 sans source : la comparaison de qualité avec la 4.9 n'est pas faite ici (voir « Ce qui manque »).

## 1. Le chemin
- 29 versions de test de la 4.9.5 (4.9.5.1 à 4.9.5.29) ; 273 décisions de l'opérateur (`DECISIONS.md`, D-001 à D-273) ; verify de la 4.9.5.29 : 2 876 essais, 0 échec, 2 ignorés (exports réels absents) ; moteur, géométrie, GCV2 et décision du lot inchangés depuis la base V4.6.0 (diff vide, garde du verify).
- Chantiers CH-001 à CH-033 : qualité de pose (CH-012, fermé, D-267 : aucune hypothèse ne montre mieux que 5 mm ou 3 mm), rejeu du déplacement de vue (CH-015), file de parties (CH-017), déplacement de vue au clic droit (CH-018), garde après un différé (CH-019), cadrage de la qualité (CH-021), maquettes de Signal (CH-020, CH-022 à CH-024 ; l'opérateur garde l'actuelle, D-271), file visible et son onglet (CH-025, CH-026), correction dans Orbite (CH-028), éveil du système (CH-027), journal de la remise de vue (CH-031) ; ouverts : CH-029, CH-030, CH-033.

## 2. Ce qui marche, mesuré sur un vrai ESV (ÉTABLI, exports de `banane-data`)
- **La file de parties enchaîne les parties sans intervention** : 3 parties le 30/10 (2, 3, 4) et 4 parties le 31/10 (5 à 8, 24 minutes), changements de partie par les gestes de l'opérateur (« Next non validated cut » quand tout est traité ; sinon dernier cut puis « Next cut »), 5 changements réussis en 10 à 12 s, aucun SKIP, aucune validation par le geste. 4.9.5.28 sans arrêt à tort.
- **Lots** (cibles / posés / différés) : partie 10 : 217 / 211 / 6 (2,8 %) ; partie 4 (30/10) : 51 / 48 / 3 ; parties 5 à 8 : 186 / 176 / 10 (5,4 %, tous dans la partie 6). La partie 20 (28/10) restait à 889 / 721 / 168 (18,9 %) : les parties se comparent mal entre elles (difficulté variable).
- **Relecture « corriger »** (par défaut) : 4,5 % à 17 % des cuts relus sont corrigés selon la partie (parties 2 à 8 du 30 au 31/10).
- Défauts trouvés et corrigés par les essais terrain : arrêt de la file à 6 s (bouton « Arrêter le lot » sous « Lancer », 4.9.5.27), arrêt à tort à la fin du lot pendant la deuxième passe (4.9.5.28), course de fin de lot (CH-026-b).

## 3. Qualité de pose : ce que l'on sait, ce que l'on ne sait pas
- ÉTABLI sur la partie 20 (jugée contre l'Écho, avant la garde après un différé) : 172 jugés, 53,5 % sous 3 mm, 63,4 % sous 5 mm, 81,4 % sous 10 mm ; 21 poses à plus de 50 mm (12,2 % des jugés ; au moins 2,9 % des posés, environ 7 % si les non jugés ressemblent aux jugés, SUPPOSÉ). **Le budget D-223 (plus de 50 mm : 3 % au plus des posés) n'est pas tenu sur cette partie.**
- La mesure a un plafond : pixel du clic 0,5 mm, bruit de référence environ 1 mm par rail ; « sous 3 mm » est abandonné (D-270).
- **Aucune partie récente n'a d'Écho dans les exports** (parties 0, 4, 10, 5 à 8) : la qualité des poses récentes, de la garde après un différé (3 à 6 déclenchements par lot) et de la deuxième passe n'est pas jugée. À surveiller : deux cuts écrits par la passe dans la partie 6 avec des déplacements d'environ 111 et 115 mm.

## 4. Ce qui n'est que témoignage ou non éprouvé
- L'éveil du système (4.9.5.29) face à la veille de Windows ; la correction dans Orbite sur un vrai ESV (liste, séance Écho de correction, rattachement des validations) ; le déplacement de vue au clic droit (aucun déplacement dans les journaux récents) ; le test sous Edge.
- Précision de la liste « à corriger » (CH-028) : 36 % [23 ; 52] à plus de 50 mm sur la partie 20, taux de base 12 %, partie antérieure à la garde (hors ligne).

## 5. Ce qui reste avant de pouvoir dire « finie » (décisions de l'opérateur)
1. Séance terrain de la 4.9.5.29 et export (éveil, correction).
2. Au moins une partie jugée à l'Écho avec la version actuelle, pour le budget D-223.
3. Test sous Edge.
4. **Ordre écrit de publier** (fusion dans `main`, étiquette) : interdit tant qu'il n'est pas donné.

## 6. Limites connues
- Dépendance au contrat d'ESV (empreinte des boutons ; le sélecteur de parties disparaît par moments de la page) : un changement d'ESV peut casser Ariane ; le banc d'essai (CH-029) vise à rapprocher la maquette du vrai ESV.
- La barre de fenêtre de Chrome ne se personnalise pas (D-272, reportée à 5.1 ou 6).
