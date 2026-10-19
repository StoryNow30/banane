# Littéraux modifiés — référence baa548d8

Toutes les lignes sont celles du candidat relu ; aucun remplacement global.

| Fichier:ligne | Champ/fonction | Ancienne valeur | Nouvelle valeur | Effet |
|---|---|---|---|---|
| manifest.json:4 | version | 4.8.6 | 4.9.0.1 | Identité MV3 |
| manifest.json:nouveau champ | version_name | absent | 4.9.0 test 1 | Nom de test MV3 |
| manifest.json:20 | action.default_title | Ouvrir Ariane 4.8.6 | Ouvrir Ariane 4.9.0 test 1 — V1 | Libellé informatif |
| src/core.js:7 | VERSION | 4.8.6 | 4.9.0.1 | État, lot et version des exports |
| src/core.js:7 | VERSION_NAME | 4.8.6 | 4.9.0 test 1 | Nom de produit et cohabitation |
| background.js:17 | repli VERSION | 4.8.6 | 4.9.0.1 | Identité si constante indisponible |
| background.js:17 | repli VERSION_NAME | 4.8.6 | 4.9.0 test 1 | Nom si constante indisponible |
| src/bridge.js:88 | pill.textContent | Ariane 4.8.6 · ouvrir | Ariane 4.9.0 test 1 · ouvrir | Bouton dans ESV |
| panel.html:2 | title | Ariane 4.8.6 | Ariane 4.9.0 test 1 | Titre |
| panel.html:23 | brand span | 4.8.6 | 4.9.0 test 1 | Bandeau |
| panel.html:150 | footer | Ariane 4.8.6 | Ariane 4.9.0 test 1 | Pied de page |
| panel.js:82 | SOUS.home | 4.8.6 | 4.9.0 test 1 | Sous-titre accueil |

## Contrôles de version

- tests/cohabitation-485.test.cjs:12-33 : contrat stable X.Y.Z / test X.Y.Z.N avec nom exactement lié au quatrième numéro, valeurs MV3 bornées, affichages/replis cohérents ; stables historiques 4.8.0/4.8.6 et cas de test 4.9.0.7 séparés ; incohérences/nom absent/chaîne invalide refusés. Le nom de paquet est calculé indépendamment des constantes de production ; package.py refuse les couples incohérents.
- tests/cohabitation-485.test.cjs:52,81,89 : messages courants utilisent VERSION_NAME, même exigence de refus avant injection/absence de commande ; la fixture étrangère 4.8.6.0 reste historique.
- tests/package.test.cjs:5 : contrat MV3 stable/test et égalité manifeste/core/nom ; contenu, permissions/hôtes, scripts, fixtures exclus et intégrité ZIP conservés.
- tests/settings.test.cjs:95-101 : format X.Y.Z(.N) borné et cohérence VERSION/VERSION_NAME/manifeste ; réglages inchangés.
- tests/revue-globale-485.test.cjs:18,20,34 : attentes sur messages/marqueur/ping de la version courante seulement ; fixtures étrangères 4.8.6.1/.2 conservées. Contrat de cohérence affichages :71-79 conservé.

## Autres littéraux nécessaires signalés avant modification

La consigne prévoit de donner fichier/ligne/effet avant de modifier un fichier hors tableau. Ils ont été signalés en commentaire avant édition ; seules les attentes sur l'identité courante sont adaptées :

| Fichier:ligne initiale | Avant | Après | Garantie conservée |
|---|---|---|---|
| tests/securite-pose-485.test.cjs:33 | Message de refus Ariane 4.8.6 | Message de refus avec VERSION_NAME échappé | Pose de deux rails terminée, validation refusée, aucune navigation |
| tests/cohabitation-p2-485.test.cjs:57 | Refus nommé 4.8.6 | Refus nommé VERSION_NAME échappé | 20 ordres, une seule connectée, propriétaire exact |
| tests/relecture-4716-version-lot.test.cjs:13 | VERSION = 4.8.6 | VERSION = manifest.version | Lot garde la version de création ; règles historiques de rejeu conservées |
| tests/ki069-e-securite-486.test.cjs:11 | Refus Ariane 4.8.6 | Refus avec VERSION_NAME échappé | validateInPlace refusé, aucun raccourci émis ni mouvement |
| tests/reprise-intrusion-485.test.cjs:13 | Refus Ariane 4.8.6, F5/Reprendre | Même message avec VERSION_NAME échappé | Mise en pause, F5 et reprise complète jusqu'à la fin |

Aucun autre fichier de production modifié. Les substitutions détaillées se trouvent dans preuves/remplacements-litteraux.json. Les anciens commentaires et fixtures restent historiques. Les nouveaux documents et sorties de vérification n'affectent aucune règle métier.
