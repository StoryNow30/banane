# Démarrer avec Banane V4.7.5 TEST — flanc partiel dans le Pilote

**Ce n'est pas une release.** La 4.7.5 active dans le Pilote la règle « flanc
partiel » que tu as validée : un rail dont le dessus est bien vu mais dont le
flanc intérieur n'a que 3 à 5 points LiDAR peut maintenant être placé, au lieu
d'être différé. Tout le reste est identique à la 4.7.4. La release officielle
reste la **4.7.0**, étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.5-test.zip` dans Edge, exactement comme la 4.7.4.

Vérifie d'abord **V4.7.5 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.5 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées. Si tu lis encore 4.7.4, l'ancienne copie est toujours chargée.

## Ce qui change pour toi

Dans un lot Pilote, **moins de cuts différés sur les parties peu denses** (parties
18 et 19 notamment). Mesuré hors ligne sur tes cinq collectes : 56 cuts
appliqués deviennent 113, et sur les 72 que tes relectures permettent de juger,
aucun n'est faux de plus de 10 mm (pire rail 6,5 mm). Les deux rails restent
exigés et l'écartement reste vérifié : la règle ne desserre aucune garde.

**Ce qui ne change pas : les appareils de voie et contre-rails.** Là, le flanc
est bien vu ; c'est la pose de départ d'ESV qui est trop loin du vrai rail
(jusqu'à 115 mm), et le moteur trouve le contre-rail. Ces cuts restent différés.
La solution par les cuts voisins est à l'étude pour la 4.8 (cahier 4.8,
amendement n°3).

## Ce qu'il faut faire avec ce build

1. Un lot **Pilote** sur une plage mêlant voie courante et appareils de voie,
   idéalement sur une partie peu dense (18 ou 19).
2. Puis la **relecture en Natif des mêmes cuts** : valide chaque cut
   (Maj+Espace), corrige ceux qui sont faux. C'est elle qui juge le Pilote.
3. Envoie les deux exports.

**Règle d'arrêt :** si un cut appliqué par le Pilote avec un flanc partiel est
faux de plus de 10 mm, on revient à la 4.7.4 (voir `RETOUR_ARRIERE.md`) et le
cas est consigné.

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
