#!/usr/bin/env python3
"""Construit le kit d'analyse locale : les outils d'analyse d'Ariane et leurs seules dépendances,
plus le mode d'emploi. Reproductible (ordre et dates fixes). Usage : kit-analyse-locale.py [--output F.zip]"""
import argparse, re, sys, zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
POINTS_ENTREE = ['tools/analyse-locale.cjs', 'tools/acceptance-report.cjs', 'tools/perf-lot.cjs']
REQUIRE = re.compile(r"""require\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)""")
DATE = (2026, 9, 29, 0, 0, 0)

LISEZMOI = """ARIANE — ANALYSE LOCALE DES EXPORTS
====================================

But : analyser tes exports (lots Orbite et relectures Écho) SUR TON ORDINATEUR et n'envoyer
que les résultats, quelques centaines de Ko, au lieu de plusieurs Go. Les exports restent chez
toi ; garde-les au moins jusqu'à la fin de la version 4.8.5.

1) Installer Node.js (une seule fois, 2 minutes)
   Va sur https://nodejs.org, télécharge la version « LTS », installe-la en laissant les
   options par défaut. Redémarre l'invite de commandes après l'installation.

2) Ranger tes exports (10 minutes)
   Crée un dossier, par exemple  D:\\ariane\\exports , avec UN sous-dossier PAR LOT et UN PAR
   RELECTURE. Le numéro de la partie est le premier nombre du nom du dossier ; un nom qui
   contient « echo » ou « relecture » désigne une relecture.

     D:\\ariane\\exports\\lot 20        ← les fichiers .json du lot de la partie 20
     D:\\ariane\\exports\\echo 20       ← les fichiers .json de la relecture de la partie 20
     D:\\ariane\\exports\\lot 33        ← un lot sans relecture, c'est permis
     ...

   - Un lot = tous les fichiers de « Tout télécharger pour l'analyse » (journal, diagnostic,
     corpus, bilan ; tous les segments seg01, seg02…). Ne mélange pas deux lots.
   - Si tu as des archives (.zip, .7z), décompresse-les d'abord.
   - Une relecture = tous les fichiers « ariane-native-v4-… » de la partie. Si tu as relu la
     même partie en deux fois, mets tous les fichiers dans le même dossier.

3) Lancer l'analyse
   Décompresse ce kit (par exemple dans D:\\ariane\\kit). Ouvre une invite de commandes
   (touche Windows, tape « cmd », Entrée), puis :

     cd /d D:\\ariane\\kit
     node tools\\analyse-locale.cjs "D:\\ariane\\exports"

   Compte quelques minutes par Go. La fenêtre affiche une ligne par lot, puis un tableau.
   Si Node manque de mémoire, ajoute  --memoire 6000  (en Mo) à la fin de la commande.

4) Envoyer le résultat
   Un seul fichier :  D:\\ariane\\exports\\resultats\\resultats-ariane-AAAA-MM-JJ.json.gz
   Dépose-le dans la conversation. Ajoute la ligne « RESUME.md » du même dossier si tu veux
   la relire toi-même.

Ce que le fichier contient : les rapports d'acceptation (une ligne par cut : posé ou différé,
écartement, erreur mesurée à la relecture), les temps mesurés, et des extraits du journal (fin
de lot, pauses, erreurs, relevé passif d'ESV). Il ne contient aucun nuage de points ni image.

En cas de problème : recopie le message d'erreur affiché, et la liste de tes sous-dossiers.
Option : ajoute  --avec-journal  pour joindre aussi le journal et le diagnostic de chaque lot
(compressés, environ 10 % du poids du journal) si je te le demande.
"""

def fermeture():
    vus, pile = set(), list(POINTS_ENTREE)
    while pile:
        rel = pile.pop()
        if rel in vus: continue
        f = RACINE / rel
        if not f.is_file(): sys.exit(f'dépendance introuvable : {rel}')
        vus.add(rel)
        if f.suffix in ('.cjs', '.js'):
            for m in REQUIRE.finditer(f.read_text(encoding='utf-8')):
                cible = (f.parent / m.group(1)).resolve()
                for cand in (cible, cible.with_suffix('.js'), cible.with_suffix('.cjs'), cible.with_suffix('.json')):
                    if cand.is_file(): pile.append(str(cand.relative_to(RACINE))); break
                else: sys.exit(f'require introuvable : {m.group(1)} dans {rel}')
    return sorted(vus)

def main():
    p = argparse.ArgumentParser(); p.add_argument('--output', default=str(RACINE.parent / 'ariane-analyse-locale.zip'))
    o = p.parse_args(); fichiers = fermeture()
    with zipfile.ZipFile(o.output, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in fichiers + ['LISEZMOI.txt']:
            data = LISEZMOI.replace('\n', '\r\n').encode('utf-8') if rel == 'LISEZMOI.txt' else (RACINE / rel).read_bytes()
            zi = zipfile.ZipInfo(rel, DATE); zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
            z.writestr(zi, data)
    print(f'{o.output} : {len(fichiers) + 1} fichiers'); print('\n'.join(fichiers))

if __name__ == '__main__': main()
