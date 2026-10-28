# Séance terrain : observer en Écho les cuts posés par le lot

Aucune nouvelle version à installer : cette séance se fait avec la **4.9.5 test 23** déjà en place. Elle sert une seule mesure : la **précision des poses du lot**. Aujourd'hui, seules 9 poses du lot sont jugées contre l'Écho (CH-009 : 6 sur 9 à 10 mm ou moins), ce qui ne dit rien de sûr. Il en faut plusieurs dizaines.

## Ce qui manque et pourquoi
Les exports passés observent surtout les cuts **différés** (ceux que le lot n'a pas posés et que l'opérateur corrige à la main). Pour juger une pose du lot, il faut l'inverse : que l'opérateur **passe sur un cut que le lot a posé**, le **contrôle** et le **corrige seulement s'il est faux**, pendant qu'Écho enregistre. Sans cette observation, une pose du lot n'est jamais comparée à une référence humaine.

## Déroulé (par partie)
1. **Lance un lot** (Orbite) sur la partie, comme d'habitude. Laisse la deuxième passe **en ombre**.
2. **Quand le lot est fini, exporte** : « Exporter tout » (journal, bilan). Avant toute autre manipulation.
3. **Passe en Écho** sur la même partie (« Connecter » puis démarrer la séance).
4. **Reviens sur les cuts que le lot a posés** (les verts) : au moins **40 cuts** par partie, pris dans toute la partie (début, milieu, fin), pas seulement les premiers. Pour chacun :
   - regarde le rail posé ;
   - **s'il est bon, ne touche à rien** et passe au suivant (c'est une réponse, Écho la garde) ;
   - **s'il est faux, corrige-le** comme tu le ferais d'habitude.
5. **Termine la séance Écho**, puis « Exporter tout » une seconde fois.
6. **Exporte après chaque partie**, avant de vider le cache. Envoie tous les zips.

## À noter à la main (une ligne)
- Les cuts où tu as hésité.
- Ce qui te gêne dans Signal pendant la séance (une phrase suffit).

## Règles
- Ne touche pas aux cuts différés pendant cette séance, sauf si tu veux qu'ils soient jugés aussi : dans ce cas, note-le.
- Aucun SKIP, aucune validation « à l'aveugle » : un cut non contrôlé reste non contrôlé.
- Si une pose du lot te paraît fausse de plus de 20 mm, ou sur la mauvaise voie, **dis-le tout de suite** : c'est le seuil d'alerte de la mesure.

## Ce que je fais ensuite
Les scripts de `banane-data/outils/analyse-lots/` jugent chaque pose du lot contre la correction ou l'absence de correction d'Écho et rendent le tableau standard (jugés, plus de 20 mm, plus de 50 mm, mauvaise voie). Cible de lecture : 100 poses jugées avant de tirer une conclusion de précision (D-254 si l'opérateur chiffre une cible).

## Ce qui n'est pas vérifié
- Le nombre de cuts nécessaires (40 par partie, 100 au total) est une estimation ; l'écart observé décidera si cela suffit.
- Une absence de correction vaut « bon » seulement si Écho tournait bien sur le cut : à confirmer par les journaux.
