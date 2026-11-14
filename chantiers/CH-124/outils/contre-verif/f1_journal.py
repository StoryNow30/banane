# -*- coding: utf-8 -*-
"""F1 : heures du lot dans le journal (début, première/dernière décision, première/dernière validation acceptée) contre l'heure `at` de l'instantané de liste.
Aucun identifiant n'est écrit en sortie (seulement des heures et des comptes)."""
import json, sys, gc, collections, datetime
sys.path.insert(0, '/root/contre-verif')
from commun import cles, meta

def ms(v):
    if isinstance(v, (int, float)): return float(v)
    if isinstance(v, str):
        try: return datetime.datetime.fromisoformat(v.replace('Z', '+00:00')).timestamp() * 1000
        except Exception: return None
    return None

par_journal = collections.defaultdict(list)
for k in cles():
    par_journal[meta(k)['journal']].append(k)
out = {}
for jf, ks in par_journal.items():
    J = json.load(open(jf))
    ev = J.get('events') or []
    ids = {meta(k)['lotId']: k for k in ks}
    acc = {k: dict(debut=None, dec=[], val=[], fin=None, types=collections.Counter()) for k in ks}
    for e in ev:
        if not isinstance(e, dict): continue
        t = ms(e.get('timestamp'))
        if t is None: continue
        b = e.get('batchId') or ((e.get('batch') or {}).get('id') if isinstance(e.get('batch'), dict) else None)
        if b not in ids: continue
        a = acc[ids[b]]; ty = e.get('type'); a['types'][ty] += 1
        idt = e.get('identity') or {}
        if ty == 'batch-started': a['debut'] = t
        elif ty == 'gcv1-shadow-observed' and e.get('lotObservation') is not None: a['dec'].append((t, idt.get('cut')))
        elif ty == 'validation-accepted': a['val'].append((t, idt.get('cut')))
        if ty and ('batch' in ty) and ty != 'batch-started': a['fin'] = max(a['fin'] or 0, t)
    for k in ks:
        a = acc[k]
        out[k] = dict(debut=a['debut'], dec_min=min((x[0] for x in a['dec']), default=None), dec_max=max((x[0] for x in a['dec']), default=None), n_dec=len(a['dec']),
                      val_min=min((x[0] for x in a['val']), default=None), val_max=max((x[0] for x in a['val']), default=None), n_val=len(a['val']),
                      val=sorted(a['val']), autres_batch=a['fin'], types=dict(a['types'].most_common(12)))
    del J, ev; gc.collect()
    print('journal lu :', len(ks), 'lots-parties', flush=True)
json.dump(out, open('/root/contre-verif/f1_journal.json', 'w'))
