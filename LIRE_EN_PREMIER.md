# Démarrer avec Banane V4.7.8 TEST — le Pilote observe sa décision sur le lot

**Ce n'est pas une release.** La release officielle reste la **4.7.0**,
étiquetée `v4.7.0` dans Git.

Installe `banane-v4.7.8-test.zip` dans Edge, exactement comme la 4.7.7.

Vérifie d'abord **V4.7.8 · TEST** en haut de la fenêtre Banane, et **Banane 4.7.8 · ouvrir** sur le bouton au bas d'ESV quand toutes les fenêtres Banane sont fermées.

## Ce qui change pour toi

**Rien de visible, et le Pilote fait exactement ce qu'il faisait.** Pendant un
lot Pilote, pour chaque cut, Banane calcule en plus ce qu'il aurait fait en
décidant sur le lot (amendement n°9) : vérifier un cut appliqué contre les cuts
déjà passés, et, pour un cut qu'il diffère, reprendre la position que la voie
prédit. Il l'écrit dans le journal du Pilote. **Rien de cela n'est appliqué.**
Le mode Natif garde l'observation de la 4.7.7.

## Ce qu'il faut faire avec ce build

**F1 — deux ou trois lots Pilote sur des parties à appareils de voie**
(idéalement une partie jamais collectée) :

1. Lance un lot Pilote GCV1 complet, comme d'habitude.
2. À la fin du lot, exporte le **diagnostic GCV1** et le **corpus LiDAR** du lot.
3. Puis **relis les mêmes cuts en Natif**, en validant chaque cut (Maj+Espace),
   **y compris ceux que le Pilote a posés et validés** : sans ta validation, un
   cut appliqué ne peut pas être jugé, et sous 80 % de cuts appliqués jugés le
   rapport déclare C4 non évaluable. Exporte ensuite la session Natif.

**F2 — P2, le plancher humain : 30 cuts replacés en aveugle**, quelques jours
après leur première pose :

1. En Natif, reviens sur 30 cuts d'une collecte déjà faite.
2. Avant de poser, **éloigne grossièrement les deux rails** (au moins 5 cm) pour
   ne pas partir de ton ancienne pose, puis replace-les et valide.
3. Exporte la session. La comparaison avec ta première pose donnera ton propre
   écart : le plancher sous lequel aucune précision n'a de sens.

**Arrêt :** si, sur un lot, la décision sur le lot produit un seul cut faux que
le Pilote n'aurait pas fait, elle n'est pas activée (D2). Si le Pilote te semble
plus lent, dis-le : le calcul ajouté est mesuré dans le journal.

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
