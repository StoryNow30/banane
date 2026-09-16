# Banane data registry

Ce dépôt de code ne doit pas héberger les grosses collectes terrain directement.

Les collectes Natif volumineuses sont référencées dans un dépôt privé séparé (`StoryNow30/banane-data`) avec :
- un manifeste par collecte ;
- SHA-256 de chaque archive ;
- version Banane et provenance ;
- nombre de visites / parts / cuts ;
- notes terrain utiles ;
- grosses archives stockées comme assets de release ou via Git LFS, pas comme blobs Git ordinaires.

Structure cible du dépôt de données :

```
banane-data/
  README.md
  collections/
    YYYY-MM-DD-native-vX.Y/
      manifest.json
      NOTES.md
      sha256.txt
```

Ne jamais renommer ni modifier une archive brute après enregistrement de son SHA-256. Toute transformation (fusion, extraction, qualification) doit produire un nouvel artefact avec son propre SHA-256 et une référence vers la source brute.
