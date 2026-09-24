# Relecture indépendante 4.7.8 — chantier 3

Base exclusive : `a74c22532200f153e6b93ce2dd14f36f17ba74f5`.
Branche : `chantier-48/relecture-478`.

## État provisoire du 24 septembre 2026

**Relecture en cours, pas d'autorisation D2.** Aucun fichier de production
n'est corrigé. Le nettoyage automatique du répertoire de travail a supprimé
les premiers artefacts avant leur publication. Le code a été récupéré au
commit prescrit ; les preuves doivent être reconstituées et publiées.

Les sorties effectivement consultées avant cette interruption établissaient :

- banc initial : 644 tests, 642 réussis, 2 ignorés faute du corpus privé ;
  empreintes gelées et baseline moteur conformes ;
- parité des étapes et des positions : 176/176 sur la partie 24, 56/56 sur
  la partie 20 courte et 10/10 sur la partie 22 ;
- contre-exemple de comptage : 10,04 mm est arrondi à 10 mm puis classé juste
  dans l'étude et la matrice, contrairement à D-038 ;
- contre-exemple de dénominateur : une visite sans pose initiale disparaît de
  l'étude, mais reste comptée par la matrice ;
- contre-exemple de parité : l'étude examine un minimum de rang 24 (25e),
  là où le module embarqué tronque la liste aux 24 premiers ;
- la garde de continuité ne mesure que le latéral ; un décalage vertical
  synthétique de 50 mm est accepté comme ancre ;
- les commandes du harnais du Pilote restent identiques avec des positions
  sentinelles dans les étapes first-pass, window, choice, deferred et error.

**Ces résultats historiques ne remplacent pas les artefacts reproductibles
à livrer.** Les calculs longs sur la partie 20 et la partie 19 n'avaient pas
de sortie finale consultée. Ni le total §9.2 ni 312/312 ne sont donc encore
certifiés par cette relecture. Les performances Node ne sont pas une mesure
du service worker Edge. Aucun verdict d'activation ne peut en être déduit.
