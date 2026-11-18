#!/usr/bin/env python3
"""CH-131 — comparer un paquet au livré, fichier par fichier (CRC-32 et taille).

Référence : `chantiers/CH-131/crc-vision20.txt`, une ligne par fichier du paquet
livré de la Vision 20 (build a19c5ed5), au format :

    <crc-32 hexadécimal 8>  <taille>  <chemin>

`BUILD` et `telecommande-relais.json` sont exclus de la comparaison : le premier
porte le commit d'où le paquet a été tiré (il change donc avec l'arbre), le
second porte l'adresse du relais de l'opérateur, qui ne doit jamais entrer dans
le dépôt et peut manquer sur une machine qui ne l'a pas.

    python3 chantiers/CH-131/comparer-crc.py vision20-vps.zip
    python3 chantiers/CH-131/comparer-crc.py vision20-vps.zip --reference autre.txt

Retour : 0 paquet identique, 1 écart, 2 erreur d'outil.
N'affiche jamais autre chose que des chemins, des CRC et des tailles.
"""
import argparse
import sys
import zipfile
from pathlib import Path

EXCLUS = {'BUILD', 'telecommande-relais.json'}
RACINE = Path(__file__).resolve().parent.parent.parent
REFERENCE = Path(__file__).resolve().parent / 'crc-vision20.txt'


def lire_reference(chemin):
    """{chemin: (crc, taille)} ; les commentaires commencent par #."""
    entrees = {}
    for numero, ligne in enumerate(Path(chemin).read_text(encoding='utf-8').splitlines(), 1):
        ligne = ligne.strip()
        if not ligne or ligne.startswith('#'):
            continue
        morceaux = ligne.split(None, 2)
        if len(morceaux) != 3:
            raise ValueError(f'{chemin}:{numero} : ligne illisible')
        crc, taille, nom = morceaux
        entrees[nom] = (crc.lower(), int(taille))
    return entrees


def lire_paquet(chemin):
    """{chemin: (crc, taille)} depuis le zip, exclusions retirées."""
    entrees = {}
    with zipfile.ZipFile(chemin) as archive:
        for info in archive.infolist():
            if info.is_dir() or info.filename in EXCLUS:
                continue
            entrees[info.filename] = (f'{info.CRC:08x}', info.file_size)
    return entrees


def comparer(reference, paquet):
    manquants = sorted(set(reference) - set(paquet))
    surnumeraires = sorted(set(paquet) - set(reference))
    crc_differents, taille_differente = [], []
    for nom in sorted(set(reference) & set(paquet)):
        (crc_attendu, taille_attendue), (crc_obtenu, taille_obtenue) = reference[nom], paquet[nom]
        if taille_attendue != taille_obtenue:
            taille_differente.append((nom, taille_attendue, taille_obtenue))
        if crc_attendu != crc_obtenu:
            crc_differents.append((nom, crc_attendu, crc_obtenu))
    return manquants, surnumeraires, crc_differents, taille_differente


def main():
    analyseur = argparse.ArgumentParser(description='Comparer un paquet au livré de la Vision 20 (CRC-32 et taille).')
    analyseur.add_argument('paquet')
    analyseur.add_argument('--reference', default=str(REFERENCE))
    options = analyseur.parse_args()

    try:
        reference = lire_reference(options.reference)
        paquet = lire_paquet(options.paquet)
    except (OSError, ValueError, zipfile.BadZipFile) as erreur:
        print(f'Erreur : {erreur}', file=sys.stderr)
        return 2

    manquants, surnumeraires, crc_differents, taille_differente = comparer(reference, paquet)

    octets_paquet = Path(options.paquet).stat().st_size
    octets_reference = sum(taille for _, taille in reference.values())

    print(f'Référence : {options.reference} ({len(reference)} fichiers, {octets_reference} octets décompressés)')
    print(f'Paquet    : {options.paquet} ({len(paquet)} fichiers, {octets_paquet} octets sur disque)')
    print()

    if not (manquants or surnumeraires or crc_differents or taille_differente):
        print('IDENTIQUE : aucun écart de fichier, de CRC-32 ni de taille hors BUILD et telecommande-relais.json.')
        return 0

    if manquants:
        print(f'MANQUANTS dans le paquet ({len(manquants)}) :')
        for nom in manquants:
            print(f'  - {nom}')
    if surnumeraires:
        print(f'EN PLUS dans le paquet ({len(surnumeraires)}) :')
        for nom in surnumeraires:
            print(f'  + {nom}')
    if taille_differente:
        print(f'TAILLE DIFFÉRENTE ({len(taille_differente)}) :')
        for nom, attendu, obtenu in taille_differente:
            print(f'  ~ {nom} : attendu {attendu}, obtenu {obtenu}')
    if crc_differents:
        print(f'CRC-32 DIFFÉRENT ({len(crc_differents)}) :')
        for nom, attendu, obtenu in crc_differents:
            print(f'  ! {nom} : attendu {attendu}, obtenu {obtenu}')

    print()
    print(f'ÉCART : {len(manquants)} manquant(s), {len(surnumeraires)} en plus, '
          f'{len(taille_differente)} taille(s), {len(crc_differents)} CRC.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
