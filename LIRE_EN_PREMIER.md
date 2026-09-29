# Ariane — lire en premier

**Seul document d'état** (D6, 29/09/2026) : ce qui est installé, ce qui est en
cours, où en sont les mesures. Le plan est dans `PLAN_SUITE.md`, les règles
dans `PASSATION_4.8.0.md`, les problèmes dans `KNOWN_ISSUES.md` (trié le
29/09). `PROJECT_STATE.md` n'est plus que l'historique.

## État au 29 septembre 2026

| | |
|---|---|
| **Version stable** | **Ariane 4.8.0**, étiquette `v4.8.0` (`fabd77e`), paquet final `38aa29a2…` ; installée chez l'opérateur |
| **Retour arrière** | 4.7.21, étiquette `v4.7.21` (`ead1cd1`), `RETOUR_ARRIERE.md` |
| **En cours** | **4.8.5 test 1** (J1), branche `claude/friendly-gauss-1p9c6q` : D5 (outils de portes), D6 (documents), D1 (numérotation, cohabitation) et D2 (garde d'écartement bas) faits ; D4, D3 en cours, puis D7 (revue, paquet `4.8.5.1`, essai Chromium) ; aucun paquet avant la fin des chantiers |
| **Portes de J1** | `node tools/portes-j1.cjs` (`audit/portes-j1/`) : au 28/09, 633 cuts de validation VERT ; 8 jeux ROUGE (attendu tant que D2 n'est pas codé) |
| **Mesures 4.8** | `audit/rapport-sortie-4.8.md` : C1 tenu (parties 9 et 12 : 79,3 % et 79,2 %), C4 4 faux sur 161 jugés, C3 0 hors contrat. Après la sortie : partie 11, 44 jugés, 0 faux ; partie 15, C1 76,5 %, **C4 non mesuré** (D-060) |
| **Problème ouvert du terrain** | KI-067 (fin de partie après un différé), corrigé par D3 |
| **Prochaine tâche de l'opérateur** | J2, quand le paquet test 1 sera livré : un lot sur une partie neuve, puis sa relecture Écho (`consignes/operateur-suite.md`) ; la 4.8.0 reste installée à côté, **une seule Ariane active à la fois** (D-060) |

## Démarrer avec Ariane 4.8.0 (version stable)

**Banane devient Ariane.** Le mode Natif devient **Écho** (Ariane observe ton
travail dans ESV et l'enregistre), le mode Pilote devient **Orbite** (Ariane
place et valide les rails d'un lot de cuts). Version officielle **4.8.0**,
validée par la direction le 28/09 (D-058), avec les corrections de l'audit
qualité d'Astra (D-059).

Installe `ariane-v4.8.0.zip` **final du 28/09** (`38aa29a2…`, empreinte dans
`PASSATION_4.8.0.md` ; le paquet du matin, `d3874290…`, est remplacé) dans
Edge **par-dessus la 4.7.21** ou le paquet du matin, dans le même dossier
(bouton « Recharger » de la page des extensions) : ne supprime pas
l'extension, sinon le stockage en cours est perdu. Termine ou arrête le lot en
cours avant, puis **recharge la page ESV**. Vérifie **4.8.0** sous ARIANE sur
l'accueil, et **Ariane 4.8.0 · ouvrir** sur le bouton blanc au bas d'ESV.

**Nouvelle permission « Téléchargements »** : Ariane enregistre ses fichiers
par le gestionnaire de téléchargements d'Edge, qui lui dit si chaque fichier
est bien écrit. Écho ne supprime plus rien de son stockage sans cette
confirmation, et chaque export te dit s'il est enregistré.

**Taille de la fenêtre d'ESV** : Ariane pose les rails en cliquant dans la
vue d'ESV ; plus cette vue est large, plus la pose est précise. Garde-la
d'au moins 600 pixels de large (la 4.8.0 finale tolère jusqu'à 300 ; en
dessous, la pose peut être refusée et le message le dit).

### Ce que l'audit qualité a fait corriger (D-059)

- Écho ne purge plus un nuage LiDAR tant que le fichier qui le contient n'est
  pas confirmé écrit (KI-064).
- En fin de lot, le bouton principal est **« Tout télécharger pour
  l'analyse »** ; s'il manque un fichier ou une capture, le message le dit et
  reste affiché.
- La tuile « Couverture » compte comme le rapport (C1) : posés sur tous les
  cuts du lot, dernier cut compris.
- Écho n'est plus proposé pendant une reprise manuelle d'Orbite ; couleurs
  d'état plus lisibles.

### Ce que la 4.8 change sur le terrain

- **ESV lent : F5 puis « Reprendre ».** Quand les nuages n'apparaissent pas
  ou que la vue ne se recentre pas, Ariane redemande d'abord le recentrage
  (trois fois), puis se met en pause et te demande de rafraîchir ESV (F5).
  ESV repart alors du premier cut non validé : clique sur « Reprendre »,
  Ariane revient seule au cut du lot avec « cut non validé suivant », **sans
  rien valider**, rattache le lot à la nouvelle page et reprend. Même chose
  après « adaptateur sans réponse ». Si le F5 tombe **pendant une pose**,
  Ariane ne sait pas si le rail a été posé : contrôle le cut dans ESV,
  clique sur « Archiver le résultat interrompu », puis sur « Reprendre ».
  En Écho : « Connecter » puis « Reprendre ».
- **Plus d'arrêt sur un silence d'ESV** : Ariane attend jusqu'à environ
  70 s (« ESV ne répond pas encore… ») et reprend seule ; « Pause » et
  « Arrêter » restent respectés ; une annulation en retard ne coupe plus le
  lot suivant (KI-063).
- **Tout télécharger pour l'analyse** : journal, bilan, diagnostic et corpus
  en un clic, dans les détails d'Orbite. C'est ce qu'il faut m'envoyer après
  un lot. Edge peut demander d'autoriser plusieurs téléchargements.
- **Fichiers `ariane-…`** : les exports s'appellent désormais
  `ariane-journal-v4-…`, `ariane-bilan-v4-…`, etc. Les anciens restent lisibles.
- **Interface** : « Masquer / Afficher les détails », « partie » partout,
  légende SKIP seulement si un SKIP a servi, bouton d'ouverture blanc et
  discret dans ESV.
- **Ce qui ne change pas** : le moteur, la décision sur le lot, les contrôles
  avant commande, le contrat d'écartement, les formats de données.

En cas de problème, reviens à la 4.7.21 (`RETOUR_ARRIERE.md`).

Historique des versions précédentes : `CHANGELOG.md`, `PASSATION_4.7.21.md`, `audit/historique/lire-en-premier-4.7.21.md`.
