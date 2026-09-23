# Démarrer avec Banane V4.7.6 TEST — placements calés sur ta façon de poser

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.6-test.zip` dans Edge, exactement comme la 4.7.5.

Vérifie d'abord **V4.7.6 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.6 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées. Si tu lis encore 4.7.5, l'ancienne copie est toujours chargée.

## Ce qui change pour toi

L'audit du moteur (`AUDIT_CERVEAU_4.7.5.md`) a trouvé que le Pilote ne pose
jamais un cut faux sur tes données, mais qu'il pose **tous** ses rails un peu
différemment de toi : le moteur met le profil **au milieu** des points LiDAR,
toi tu le poses **en enveloppe** — le dessus au-dessus des points, le flanc
côté voie. Résultat mesuré : rail 2,8 mm trop bas et écartement 4,5 mm trop
large, en médiane.

La 4.7.6 **cale** chaque rail publié sur ta façon de poser, à partir de ses
propres points. Mesuré sur tes sept sessions, chaque session tenue à l'écart
de l'ajustement : écart au placement humain divisé par 1,5 en latéral, par 2,5
en vertical, écartement ramené de +4,5 à +0,4 mm de biais. Le calage ne choisit
rien, ne vise aucun écartement, et la garde d'écartement juge la paire calée.
Le flanc partiel de la 4.7.5 reste actif.

Ce qui ne change pas : les cuts différés (appareils de voie, flanc insuffisant)
restent différés.

## Ce qu'il faut faire avec ce build

Deux collectes, qui mesurent deux choses différentes (précisé le 23/09,
amendement n°5 du cahier 4.8) :

1. **Une collecte Natif sur une partie nouvelle**, sans lancer le Pilote : tu
   poses chaque cut toi-même depuis l'état ESV et tu valides chaque cut
   (Maj+Espace). C'est la seule mesure honnête du calage : en relecture d'un lot
   Pilote, tu pars de la proposition et tu ne retouches pas un écart de 2 mm,
   ce qui est normal mais ne permet pas de le juger.
2. **Un lot Pilote**, puis la **relecture en Natif des mêmes cuts**, en validant
   chaque cut. Elle mesure la couverture réelle du Pilote et repère les erreurs
   franches, au-delà de 10 mm.
3. Envoie les exports.

**Règles d'arrêt :** retour à la 4.7.5 si, sur la collecte de la partie nouvelle,
le placement calé est plus loin de ta pose que le placement brut, ou s'il rend
faux de plus de 10 mm un cut que le placement brut aurait bien placé ; retour à
la 4.7.4 si un cut appliqué en flanc partiel est faux de plus de 10 mm (voir
`RETOUR_ARRIERE.md`).

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
