# Démarrer avec Banane V4.7.11 TEST — le Pilote décide sur le lot

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.11-test.zip` dans Edge, exactement comme la 4.7.10.

Vérifie d'abord **V4.7.11 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.11 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées.

## Ce qui change pour toi

**Le Pilote place plus de cuts.** Quand le moteur diffère un cut, ou le refuse
pour son écartement, le Pilote le reprend à partir de la voie tracée par les
cuts **qu'il vient de placer dans le même lot**, puis applique la position
trouvée. Sur ton lot 2 de la partie 31, il aurait placé 72 cuts sur 78 au lieu
de 47. Les règles ne changent pas : les deux rails sont exigés, l'écartement
[1 405, 1 470] mm n'est qu'un contrôle d'admissibilité, jamais une cible.
Comme tout cut que le Pilote place, un cut repris ainsi est **validé** dans ESV
avant de passer au suivant ; un cut qu'il ne sait pas placer reste différé,
sans VALIDATE ni SKIP.

**Un faux connu est accepté** (D-042) : sur ce même lot, un cut (7026) aurait
été placé à 20 mm, un choix fait avec un seul cut voisin (KI-050). Relis donc
comme d'habitude : un cut faux se corrige et se valide.

**4.7.11 — plus d'arrêt « Position proposée hors de la vue ».** Le Pilote
place un rail en cliquant dans la vue d'ESV, qui ne montre que ±20 cm autour du
rail. Quand la position trouvée tombe hors de cette vue (pose ESV de départ très
éloignée, comme sur la partie 33), le cut est désormais **différé** au lieu
d'arrêter le lot (KI-051). Pose-le à la main, comme tu le fais : dézoome et
déplace la vue au clic droit (D-043).

**Si le Pilote s'arrête sur une erreur** : **Archiver le résultat interrompu**,
puis lance **un nouveau lot** à partir du cut suivant. N'utilise pas
« Reprendre » après un archivage : il s'arrête sur une erreur sans rien faire
(KI-052).

**Réglages du lot → Décision sur le lot** : « Appliquer » par défaut ;
« Observer seulement » rend exactement le Pilote de la 4.7.9. Le réglage est
figé à la création du lot.

## Ce qu'il faut faire avec ce build

**F1 — des lots Pilote, puis leur relecture** (idéalement sur des parties
jamais collectées) :

1. Lance un lot Pilote GCV1 avec **Décision sur le lot : Appliquer**.
2. À la fin du lot, exporte le **diagnostic GCV1**, le **corpus LiDAR** et le
   **journal** (Dépannage → Télécharger le journal).
3. Puis **relis le lot en Natif** :
   - **passe sur chaque cut du lot** : un cut que tu visites sans le corriger
     ni le valider est compté comme bon (D-040) ; **si tu le corriges,
     valide-le** (Maj+Espace), sinon il n'est pas jugeable. Au moins une
     demi-seconde par cut ;
   - **passe aussi (Z, sans valider) sur les 5 cuts de part et d'autre** de
     chaque cut du lot.
   Exporte ensuite la session Natif.

Je compte à part les faux des cuts **placés par la décision sur le lot** (ceux
que la 4.7.9 n'aurait pas placés). Si l'anomalie du 7026 (choix à un seul
appui) se reproduit, je propose le correctif (D-042).

**Si ESV ne charge pas le nuage** (plusieurs cuts de suite « différés sans point
LiDAR ») : arrête le lot, rafraîchis la page ESV, recharge si besoin l'onglet,
puis relance un lot sur la suite (KI-049).

**F2 — P2, le plancher humain : 30 cuts replacés en aveugle**, quelques jours
après leur première pose :

1. En Natif, reviens sur 30 cuts d'une collecte déjà faite.
2. Avant de poser, **éloigne grossièrement les deux rails** (au moins 5 cm) pour
   ne pas partir de ton ancienne pose, puis replace-les et valide.
3. Exporte la session. La comparaison avec ta première pose donnera ton propre
   écart : le plancher sous lequel aucune précision n'a de sens.

## Mise à jour

1. Décompresse le ZIP et remplace les fichiers dans **le dossier de Banane déjà chargé dans Edge**. L'identité de l'extension et son stockage sont conservés.
2. Dans `edge://extensions`, clique sur **Recharger**. Recharge ensuite **la page ESV**.
3. Ouvre Banane.

## Ce que la 4.7 change pour toi

**Un cut que le moteur ne sait pas résoudre n'arrête plus le lot.** Avant, le lot se mettait en pause et t'attendait. Maintenant, par défaut, Banane quitte ce cut par une navigation sans décision — la même action que **Maj+Z** — et continue. Le cut est compté à part, dans **Différés : N**.

Un cut différé n'est **ni validé, ni skippé, ni corrigé**. Banane n'envoie rien dessus. Il est simplement mis de côté pour que tu le regardes plus tard. Les compteurs le disent : « cuts traités » et « Différés » ne se mélangent jamais.

Tu gardes le choix. Dans **Réglages du lot**, *Lorsqu'un rail n'est pas résolu* propose **Continuer et le différer** (le nouveau défaut) ou **Mettre le lot en pause** (l'ancien comportement). Le choix est figé au démarrage du lot : le changer ensuite n'affecte que le lot suivant.

**Un écartement de rails aberrant n'est plus appliqué.** Sur le lot du 21 septembre, dix paires avaient été appliquées puis validées avec un écartement entre 1 503 et 1 564 mm, hors du contrat ferroviaire. Chaque rail semblait plausible tout seul ; c'est la paire qui était fausse. Banane mesure désormais l'écartement **prévu** avant d'agir et refuse de commander hors contrat. Ces cuts-là sont différés, pas corrigés.

**Le panneau dit ce qui s'applique vraiment.** En lot Pilote GCV1, le réglage de faible confiance est neutralisé — la publication GCV1 est sa propre frontière. Le panneau l'annonce désormais au lieu d'afficher un réglage sans effet.

## Ton essai

Lance un lot Pilote TEST sur une plage où tu sais qu'il y a des cuts difficiles, et regarde :

- les propositions normales sont appliquées et validées comme avant ;
- un cut non résolu est quitté sans décision, et **Différés** augmente de 1 ;
- aucun SKIP ne part tout seul ;
- les numéros de cut peuvent sauter — c'est ESV qui décide du suivant, Banane n'en invente aucun ;
- ferme puis rouvre la fenêtre : les compteurs sont identiques, et rien n'est rejoué.

Si une navigation reste incertaine, Banane te le dit avec le numéro du cut et **ne la renvoie pas**. Contrôle ce cut dans ESV, puis clôture le résultat depuis **Dépannage**.

À la fin, **Télécharger le bilan et les LiDAR** produit le fichier de diagnostic complet.

## Les autres modes n'ont pas changé

**Mode Natif** observe ton travail manuel sans rien piloter. **Mes corrections** conserve le workflow guidé. L'**assisté** demande une proposition sur un seul cut. Aucun de ces modes n'envoie de VALIDATE, de SKIP ou de navigation à ta place.

Un cut SKIP reste dans le fichier avec son LiDAR et les états avant/final des deux rails, mais il est exclu des exemples d'entraînement. Aucun SKIP n'est déclenché automatiquement.

## Ce qui n'est pas prouvé

La confirmation d'enregistrement côté serveur ESV n'est toujours pas observable : une navigation observée n'est pas une preuve d'enregistrement. Le garde d'écartement intercepte les erreurs grossières de paire, pas les erreurs qui conservent l'écartement. Les limites connues sont listées dans `KNOWN_ISSUES.md`.
