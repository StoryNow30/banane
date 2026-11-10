#!/usr/bin/env python3
# Sorties par cut de CH-099 : numéros de partie et de cut, millimètres, comptes et drapeaux seulement.
import json,glob,csv,sys,os
S,OUT=sys.argv[1],sys.argv[2]; os.makedirs(OUT,exist_ok=True)
def chemin(l): return 'L1-e' if l.get('l1') else ('passe' if l.get('passeEcrite') else 'chaine')
def zone(l):
    g=l['gardes']['grappe']; return 'pn' if g.get('zonePn') else ('adv' if g.get('zoneAdv') else 'voie-courante')
L=[json.loads(x) for f in sorted(glob.glob(S+'/out/dec-*.jsonl'))+sorted(glob.glob(S+'/out/garde-*.jsonl')) for x in open(f)]
L.sort(key=lambda l:(l['lot'],l['partie'],l['cut'],1 if l.get('contrefactuel') else 0))
with open(OUT+'/decisions-par-cut.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['lot','partie','cut','ligne','chemin','etage','zone','juge','ecart_mm','classe','ecartee_d285','S0','S60','S90','n_paires','meilleure_a_pose_mm','meilleure_a_verite_mm','paire_la_plus_proche_de_la_verite_mm','garde_apres_differe','grappe','garde_de_voie','source_garde_de_voie','couvre_400','points_bande'])
    for l in L:
        j=l.get('juge') or {}; c=l.get('couverture') or {}; rl=l.get('rl') or {}
        k=lambda v: (rl[v]['etat']+':'+str(rl[v]['motif'])) if v in rl else 'erreur'
        g=l['gardes']; b=lambda x:'' if x is None else int(bool(x))
        w.writerow([l['lot'],l['partie'],l['cut'],'contrefactuel-garde' if l.get('contrefactuel') else 'pose',chemin(l),l.get('etage') or '', zone(l) if 'zonePn' in g['grappe'] else '', j.get('etat',''), '' if j.get('mm') is None else j['mm'], j.get('classe') or '', b(j.get('ecartee')),k('S0'),k('S60'),k('S90'),l.get('nPaires',''),l.get('meilleureAPoseMm',''), '' if l.get('meilleureAVeriteMm') is None else l['meilleureAVeriteMm'], (l.get('paireVerite') or {}).get('ecartMm',''), b(g['r3']['signale']),b(g['grappe']['signale']),b(g['voie']['signale']),g['voie']['source'],b(c.get('couvre400')),(c.get('left',{}).get('nBande',0)+c.get('right',{}).get('nBande',0)) if c else ''])
sc=[json.loads(x) for f in sorted(glob.glob(S+'/out/sc-*.jsonl')) for x in open(f)]
with open(OUT+'/seconde-chance-par-cut.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['lot','partie','cut','role','pose_au_lot_reel','verite','visite_sans_action','temoin_etat','temoin_source','temoin_passe','temoin_erreur_mm','levier_etat','levier_source','levier_passe','levier_motif_passe','levier_erreur_mm'])
    for l in sc:
        t,r=l['temoin'],l['rl']; n=lambda x:'' if x is None else x
        w.writerow([l['lot'],l['partie'],l['cut'],n(l['role']),int(l['reelPose']),n(l['verite']),n(None if l['controle'] is None else int(l['controle'])),t['etat'],n(t['source']),n(t['passe']),n(t['erreurMm']),r['etat'],n(r['source']),n(r['passe']),n(r['motifPasse']),n(r['erreurMm'])])
for f in ['constat-poses-sans-garde.json','synthese.json','seconde-chance.json','concordance-juge.json','rejeu-independant.json','b1-ecart.json']:
    if os.path.exists(S+'/out/'+f): open(OUT+'/'+f,'w').write(open(S+'/out/'+f).read())
print({f:os.path.getsize(OUT+'/'+f) for f in os.listdir(OUT)})
