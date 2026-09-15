"""Reconstruct the real before clouds in profile coordinates. No manual truth assumed."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / 'tests/incidents/banane-dataset-v3-1788955914519.json').read_text())
proposals = {e['proposal']['identity']['cut']: e['proposal']['rails']
             for e in data['events'] if e['type'] == 'proposed'}

def local(rail, points):
    matrix = np.array(rail['sceneRelativeToProfileLocal']).reshape(4, 4, order='F')
    return (np.c_[points, np.ones(len(points))] @ matrix.T)[:, :3]

fig, axes = plt.subplots(5, 2, figsize=(12, 18), constrained_layout=True)
for i, cloud in enumerate(sorted(data['clouds'], key=lambda c: c['cut'])):
    for j, side in enumerate(['left', 'right']):
        ax = axes[i, j]
        rail = cloud['rails'][side]
        points = local(rail, cloud['pointsSceneRelative'])
        shape = local(rail, max(rail['profileContours'], key=lambda c: len(c['verticesSceneRelative']))['verticesSceneRelative'])
        sign = np.sign(np.median(shape[:, 1]))
        shape[:, 1] *= sign
        points[:, 1] *= sign
        visible = np.array([v is True for v in cloud['visibleByClipBoxes']])
        roi = (np.abs(points[:, 0]) <= .5) & (np.abs(points[:, 1]) < .18) & (np.abs(points[:, 2]) < .1)
        pts = points[visible & roi]
        ax.scatter(pts[:, 1]*1000, pts[:, 2]*1000, s=3, c='#154a60', alpha=.45, label='LiDAR dans la découpe')
        shape = shape[shape[:, 2] > -.055]
        ax.plot(shape[:, 1]*1000, shape[:, 2]*1000, '--', color='#b2b2b2', linewidth=1, label='Profil avant')
        fit = proposals[cloud['cut']][side]
        u, z = sign*fit['delta'][1], fit['delta'][2]
        ax.plot((shape[:, 1]+u)*1000, (shape[:, 2]+z)*1000, color='#d86a12', linewidth=1, label='Profil proposé V3.0.1')
        ax.scatter([u*1000], [z*1000], s=70, marker='x', c='#c22a21', linewidths=2, label='Point proposé')
        ax.set(title=f"Cut {cloud['cut']} · {'gauche' if side=='left' else 'droit'} · score {fit['confidence']}/100",
               xlabel='Vers l’extérieur du champignon (mm)', ylabel='Z du profil avant (mm)',
               xlim=(-100, 135), ylim=(-65, 55), aspect='equal')
        ax.grid(alpha=.15)
axes[0, 0].legend(fontsize=7, loc='upper right')
fig.suptitle('Part 7 — points exportés et propositions automatiques\nLes positions manuelles attendues ne sont pas disponibles', fontsize=14)
path = ROOT / 'audit/part7-profils-v301.png'
fig.savefig(path, dpi=130)
print(path)
