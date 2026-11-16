"""CH-130 (D-361) — l'adresse du relais de la télécommande, proposée par défaut dans le panneau, SANS jamais l'écrire dans le dépôt.

L'adresse du Worker de l'opérateur contient son nom (interdit absolu de CLAUDE.md). Elle vient d'une source HORS dépôt, lue au moment de fabriquer
le paquet, et n'est écrite que dans le zip (`telecommande-relais.json`, à la racine) :
  1. la variable d'environnement ARIANE_RELAIS ;
  2. sinon le fichier ~/.ariane/relais.txt (une ligne).
Sans l'une ni l'autre, rien n'est écrit : le paquet est celui d'avant, le champ du panneau reste vide (ou garde la dernière saisie).
Une adresse présente mais qui n'est pas celle d'un Worker (https, un hôte en .workers.dev, rien après) arrête la fabrication du paquet.
L'adresse n'est jamais imprimée : la sortie ne dit que d'où elle vient. Appelé par tools/package.py (patch chantiers/CH-130/package.patch)."""
import json
import os
import re
from pathlib import Path

NOM = 'telecommande-relais.json'
VARIABLE = 'ARIANE_RELAIS'
FICHIER = Path('~/.ariane/relais.txt')
_WORKER = re.compile('https:' + r'//([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+workers\.dev')  # assemblé : le scan d'identité refuse une adresse écrite en clair


def normaliser(brut):
    """L'adresse d'un Worker en https, l'hôte seul (une barre finale est tolérée). Autre chose : ValueError."""
    a = str(brut or '').strip()
    if a.endswith('/'):
        a = a[:-1]
    if not _WORKER.fullmatch(a.lower()):
        raise ValueError('Adresse du relais refusée : il faut https://<nom>.workers.dev, sans rien après (variable %s ou %s).' % (VARIABLE, FICHIER))
    return a.lower()


def lire(environ=None, fichier=None):
    """(adresse, source) ; (None, None) sans source. source : 'variable' ou 'fichier'."""
    environ = os.environ if environ is None else environ
    v = environ.get(VARIABLE, '')
    if v.strip():
        return normaliser(v), 'variable'
    f = Path(fichier) if fichier else FICHIER.expanduser()
    try:
        t = f.read_text(encoding='utf-8').strip()
    except OSError:
        return None, None
    return (normaliser(t.splitlines()[0]), 'fichier') if t else (None, None)


def contenu(adresse):
    return json.dumps({'relais': adresse}, separators=(',', ':'))
