#!/usr/bin/env python3
"""Assemble tools/navigateur/reducteur-exports.html : une seule page, sans dépendance, qui s'ouvre depuis le disque.
Usage : construire-reducteur.py [--output F.html]"""
import argparse
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
SOURCES = (('/*CAPTURE*/', 'vendor/capture-core.js'), ('/*CORE*/', 'src/core.js'), ('/*NATIF*/', 'src/native-export.js'), ('/*COEUR*/', 'tools/reducteur-exports-core.js'))

def main():
    p = argparse.ArgumentParser(); p.add_argument('--output', default=str(RACINE / 'tools/navigateur/reducteur-exports.html')); o = p.parse_args()
    html = (RACINE / 'tools/navigateur/reducteur-exports.gabarit.html').read_text(encoding='utf-8')
    for marque, chemin in SOURCES:  # dans l'ordre des dépendances : capture-core, core, native-export
        html = html.replace(f'<script>{marque}</script>', '<script>\n' + (RACINE / chemin).read_text(encoding='utf-8').replace('</script', '<\\/script') + '\n</script>', 1)
    Path(o.output).write_text(html, encoding='utf-8', newline='\n'); print(f'{o.output} : {len(html.encode()) // 1024} Ko')

if __name__ == '__main__': main()
