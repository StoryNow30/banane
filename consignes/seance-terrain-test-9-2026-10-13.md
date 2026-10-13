# Séance terrain « test 9 » : mode rapide sur neuf cuts sur dix et exports allégés (D-091) (13 octobre 2026)

**Rien ne change dans ce qu'Ariane décide, pose ou valide.** Le mode rapide de la test 8 passe sur **neuf cuts sur dix**. Un cut sur
dix, tiré au sort une fois pour toutes d'après son numéro, reste en **référence** (comme la 4.9.0.5) pour surveiller la qualité.
Sur ton lot de 112 cuts de la 4.9.0.8 : 2,44 s par cut en mode rapide contre 6,73 s en référence, avec la même part de cuts posés,
les mêmes points lus et le même écartement.

**Ce que tu vas voir de différent, et c'est normal** : comme dans la test 8, sur les cuts rapides, la vue d'ESV ne suit pas toujours
le rail qu'Ariane pose, et c'est maintenant presque tous les cuts. La pose est relue au millimètre après chaque clic, comme avant.
Un cut sur dix environ est plus lent : c'est un cut de référence.

**Nouveau dans la test 9 : des exports plus légers.** Le zip de « Tout télécharger » pèse environ 30 % de moins. Ariane retire les sondes
de diagnostic qui ne disent rien (nœuds sans aucun point retenu, aucune sonde dans la zone du rail). Les points restent exacts au chiffre
près, et chaque nuage allégé le dit. Sur ton lot du matin, rejoué : nuages de 21,7 à 14,6 Mo, aucun autre champ modifié, et le rejeu
des 112 décisions donne exactement les mêmes poses.

**Invisible pour toi** : chaque étape de la page porte maintenant sa propre heure, ce qui corrige la mesure de la lecture en mode rapide.

## Le paquet

`ariane-4.9.0-test.9.zip`, version 4.9.0.9, nom « 4.9.0 test 9 ». L'empreinte SHA-256 et la taille sont dans mon message (cette consigne
est dans le paquet : elle ne peut pas porter sa propre empreinte).

## 1. Installer et vérifier (environ 10 minutes)

1. Tout ce que l'ancienne Ariane garde doit être **déjà exporté**. Tes zips de ce matin le sont : garde-les jusqu'à ma confirmation de réception.
2. **Contrôle l'empreinte du zip.** PowerShell, dans le dossier du zip : `Get-FileHash .\ariane-4.9.0-test.9.zip -Algorithm SHA256` (ou `certutil -hashfile ariane-4.9.0-test.9.zip SHA256`).
   Les 64 caractères doivent être identiques à ceux de mon message. Sinon, n'installe pas et dis-le-moi.
3. **Pose la test 9 par-dessus l'ancienne** : décompresse le zip dans le même dossier que l'ancienne Ariane, en remplaçant les fichiers. Ne désinstalle rien. Puis, dans
   `chrome://extensions`, clique sur **Recharger** sur la carte Ariane. Le cache est gardé. Une seule Ariane active à la fois.
4. **Recharge l'onglet ESV (F5)**, puis choisis cet onglet dans Ariane. Un seul onglet ESV.
5. **Vérifie la version** : la carte dans `chrome://extensions` dit « 4.9.0 test 9 », le panneau dit « ARIANE 4.9.0 test 9 » et le bouton blanc sur la page ESV dit
   « Ariane 4.9.0 test 9 · ouvrir ». Dans les réglages du panneau, la ligne « Mode rapide (V3) » dit « neuf cuts sur dix (un sur dix en référence, tiré au sort) »
   et la ligne « Allègement des nuages » dit « actif (sondes sans information retirées) ». Sinon, ne lance rien et dis-le-moi.
6. **Vide le cache seulement après ma confirmation** que tes zips précédents sont reçus et complets : « Vider le cache des exports », confirme avec OK,
   et envoie-moi le message affiché. En attendant, tu peux lancer le lot sans vider : Ariane ne ralentit plus avec l'historique.

## 2. Le lot

- **Une partie neuve**, jamais traitée, avec **au moins 300 coupes** si possible (deux lots sur deux parties neuves si une seule partie n'en a pas assez ; dis-le-moi avant).
- **Mêmes conditions que d'habitude** : fenêtre ESV d'au moins **600 pixels de large** (plein écran de préférence), extension Claude désactivée, pas d'autre application lourde,
  un seul onglet ESV, **onglet ESV au premier plan** (Ariane attend les images d'ESV ; un onglet caché la ralentit).
- **Orbite seulement**, aucun réglage à changer. **Ne touche à rien pendant le lot**, sauf si Ariane se bloque.
- **Regarde ESV de temps en temps** : si l'image saccade ou se fige plus qu'avant, note l'heure.
- **Arrête tout de suite** si Ariane affiche « Le clic a déplacé le rail … au lieu du rail … » : note l'heure, puis va à la partie 4.
- **Note** : heure de début et de fin, partie et projet (dis-les-moi dans la conversation), et chaque intervention ou message « Lecture LiDAR instable ».
- **Plusieurs lots à la suite, sans vider le cache entre eux** : c'est la preuve que l'historique ne ralentit plus Ariane (le dernier lot
  doit aller aussi vite que le premier). Un export à la fin suffit pour tous.

## 3. À la fin du lot

1. Attends 5 secondes, puis « Tout télécharger pour l'analyse ».
2. Vérifie le zip dans Téléchargements (taille non nulle, aucun message « Export incomplet »).
3. Envoie-le-moi. S'il fait plus de 20 Mo, **découpe-le en morceaux de 20 Mo** avec le script ci-dessous, et envoie tous les morceaux
   avec la ligne SHA-256 affichée.
4. Une fois que je t'ai confirmé la réception, « Vider le cache des exports ».

Script de découpe, à coller tel quel dans PowerShell (il traite tous les `ariane-lot-*.zip` de Téléchargements, crée `….zip.001`, `….zip.002`…,
et ne modifie pas le zip d'origine) :

```powershell
$max = 20MB
Get-ChildItem "$env:USERPROFILE\Downloads\ariane-lot-*.zip" | ForEach-Object {
  $src = $_.FullName; $n = [math]::Ceiling($_.Length / $max)
  if ($n -lt 2) { Write-Host "$($_.Name) : moins de 20 Mo, a envoyer tel quel"; return }
  $taille = [math]::Ceiling($_.Length / $n); $buf = New-Object byte[] $taille; $in = [IO.File]::OpenRead($src)
  for ($i = 1; $i -le $n; $i++) {
    $lu = 0; while ($lu -lt $taille) { $r = $in.Read($buf, $lu, $taille - $lu); if ($r -le 0) { break }; $lu += $r }
    $out = [IO.File]::Create(('{0}.{1:D3}' -f $src, $i)); $out.Write($buf, 0, $lu); $out.Close()
  }
  $in.Close(); Write-Host "$($_.Name) : $n morceaux, SHA-256 $((Get-FileHash $src -Algorithm SHA256).Hash)"
}
```

Je mesure alors le mode rapide contre l'échantillon de référence (`node tools/perf-v3.cjs`) : temps par cut, part posée, poses,
lectures au signal, points lus, et cette fois la lecture par rail réelle. Chaque cut est rangé selon le mode qu'Ariane a consigné pour lui,
même si un lot mêle deux versions.

## 4. Si quelque chose ne va pas

Arrête, note l'heure et le message exact, exporte et envoie-moi le zip. **Ne désinstalle pas Ariane** (ça efface le cache). Retour arrière : exporte, vérifie et envoie le zip, puis
**désactive** la test 9 (interrupteur dans `chrome://extensions`, sans la supprimer) et pose la 4.9.0.8, éprouvée ce matin (`ariane-4.9.0-test.8.zip`, SHA-256
`c58af02781c0a5a7caf81cd11e772e8e63a571d37323c0f60696d0f9bfcb53a4`), puis F5 sur ESV. La 4.9.0.8 relit tout ce que la test 9 a gardé.

## 5. Ce qui n'est pas vérifié

L'échantillon d'un cut sur dix et l'heure des étapes : essayés hors ligne et au banc ESV local (vrai code de page), jamais sur le vrai ESV. L'allègement : rejoué sur
l'export de ton lot de 112 cuts, jamais produit sur ton poste. Toujours non vérifiés : Edge, Chrome et Edge avant la version 129 (lecture avec un
repli), un vrai réseau lent ou en panne (repli prévu : l'attente de 0,8 seconde de la test 5).
