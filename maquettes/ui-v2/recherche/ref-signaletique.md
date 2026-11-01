# Référence : signalétique et design d'information hors ferroviaire — famille « info- »

Consigne de l'intégrateur reçue en cours d'étude : pas de métaphore de voie, rail, quai, signalisation ferroviaire, ni de nuage de points. Je n'ai donc **ouvert aucune charte de chemin de fer ou de métro** ; la piste « tableau de départs » du brief est abandonnée. J'ai cherché ailleurs : aviation, alarmes industrielles, santé, sécurité, pictogrammes, horlogerie.

## Ouvert exactement (Chromium, lecture ordinaire)
| Page | Statut | Lu |
|---|---|---|
| Wikipédia « ISO 7010 » | 200 | ÉTABLI |
| Wikipédia « Annunciator panel » (et la redirection « Master caution ») | 200 | ÉTABLI |
| Wikipédia « Engine-indicating and crew-alerting system » | 200 | ÉTABLI |
| Wikipédia « Alarm management » | 200 | ÉTABLI |
| Wikipédia « Glass cockpit », « Primary flight display » | 200 | ÉTABLI |
| Wikipédia « High performance HMI » | **404** (article inexistant) | — |
| Wikipédia « Early warning score » (redirigé vers « Early warning systems ») | 200 | ÉTABLI |
| Wikipédia « Monitoring (medicine) » | 200 | ouvert, survolé — PROBABLE |
| Wikipédia « Isotype (picture language) », « Otl Aicher » | 200 | ÉTABLI |
| Wikipédia « Egg timer » | 200 | ÉTABLI ; « Time Timer » : **404** |
| Wikipédia « Highway Gothic » | 200 | ÉTABLI ; « Overpass typeface » : **404** |
| NHS digital service manual : composants « Tag » et « Warning callout » | 200 | ÉTABLI |
| GOV.UK Design System : composants « Task list » et « Tag » | 200 | ÉTABLI |

## Ce que j'y ai lu (ÉTABLI)
- **ISO 7010** : cinq couples forme-couleur — interdiction (cercle barré, rouge), obligation (cercle plein, bleu), avertissement (triangle équilatéral aux coins arrondis, jaune), condition sûre (carré ou rectangle, vert), incendie (carré, rouge). But : « une information de sécurité qui s'appuie aussi peu que possible sur les mots ». S'il manque un symbole : signe général + texte.
- **Annonciateurs (aviation)** : rouge = alerte, état critique, attention immédiate ; ambre = précaution, attention prochaine ; vert = système en service ou prêt ; blanc/bleu = information. Les voyants « maîtres » clignotent **jusqu'à l'acquittement** par l'équipage, puis restent fixes tant que l'anomalie dure. Un bouton de test allume tout.
- **Alarm management** : le problème majeur est l'**inondation d'alarmes** (« alarm flood ») ; quand alarmer devient gratuit, on alarme tout ; normes ISA 18.2, EEMUA 191. La tendance : sortir les alarmes critiques de la liste vers des fenêtres fixes, car la reconnaissance de motif bat la liste à faire défiler.
- **Écran de vol principal** : tout l'essentiel sur un seul écran, « une énorme quantité d'information d'un seul coup d'œil » une fois la disposition apprise ; la variabilité des dispositions entre fabricants est un défaut.
- **Scores d'alerte précoce (santé)** : chaque constante reçoit un score selon son écart à la normale, la **somme** déclenche un niveau d'escalade ; une observation normale vaut 0 ; les soignants préfèrent une coloration graduée par mesure ; les tableaux ne gardent que les observations les plus prédictives (« les observations en plus diluent »).
- **Isotype** : une quantité plus grande se montre par **plus de pictogrammes identiques**, pas par un pictogramme plus grand ; jamais de perspective ; c'est une « langue d'appoint », toujours accompagnée de mots.
- **Pictogrammes des Jeux de 1972** (article sur leur concepteur) : un système de pictogrammes cohérent sur une grille, conçu comme un tout.
- **NHS Tag / GOV.UK Tag** : un tag dit un état, **un adjectif, pas un verbe** (un verbe fait croire qu'on peut cliquer) ; jamais cliquable ; garder la même couleur partout ; commencer avec le moins d'états possible.
- **NHS Warning callout** : titre court et précis ; **pas plus de deux encadrés d'alerte par page** (« rassurer, pas effrayer ») ; les titres clairs valent mieux qu'une icône point d'exclamation, mal interprétée.
- **GOV.UK Task list** : la ligne entière est cliquable ; l'état à droite, en mot ; les utilisateurs cliquaient sur les étiquettes d'état quand elles ressemblaient à des boutons.
- **Minuteur de cuisine** : compte à rebours sur un cadran réglable ; la version « parcmètre » comptait jusqu'à 60 minutes.
- **Highway Gothic** : police de la signalisation routière américaine, dessinée pour la lecture à distance et en mouvement (Overpass en est une interprétation libre — l'article Overpass n'existe pas, je ne cite pas plus).

## Ce que j'en retiens pour Ariane
1. **« Cockpit sombre »** (principe tiré des annonciateurs : ce qui va bien ne s'allume pas) : un lot qui tourne normalement est gris et calme ; la couleur n'apparaît que pour « à regarder » (ambre) ou « à agir » (rouge).
2. **Acquittement** : une alerte s'impose une fois (deux pulsations lentes), puis reste fixe ; jamais de boucle.
3. **Grammaire de formes ISO** réinterprétée : carré = normal / information, triangle = à regarder, octogone = à agir (forme d'arrêt). Jamais la même forme avec deux couleurs (Carbon).
4. **Somme graduée** (scores santé) : la gravité du panneau est la plus haute des gravités présentes ; une seule échelle partout.
5. **Isotype** : les quantités (différés, verts) se comptent en marques identiques répétées quand elles sont petites (≤ 12), en chiffre au-delà.
6. **Tags = adjectifs** (« différé », « à examiner », « posé »), jamais des verbes ; les actions restent des boutons à verbe (« Examiner », « Ouvrir dans ESV »).
7. **Au plus deux encadrés d'alerte** par écran.

## Ce que j'écarte
- Les couleurs ISO bleu (obligation) et vert (sûr) comme couleurs d'état : elles feraient cinq couleurs ; je ne garde que la grammaire des formes.
- La signalisation ferroviaire et les tableaux de départs (consigne de l'intégrateur).
