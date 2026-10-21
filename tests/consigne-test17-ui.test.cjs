'use strict';
/* Consigne de la séance « 4.9.5 test 17 (UI) » : installer par-dessus la test 16, empreinte contrôlée avant la pose, version vérifiée ; ce qui change (l'interface seulement,
 * la pose de la test 16) ; passer au nouveau panneau et revenir ; la palette ; la pause de la relecture (éteinte, réglage de F5 « mettre en pause / arrêter ») ; le retour arrière
 * vers la test 16 ; les limites ; aucune empreinte, aucune adresse, aucun nom de modèle d'IA, aucun nom ni code de projet. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const racine=path.resolve(__dirname,'..'),texte=fs.readFileSync(path.join(racine,'consignes/seance-terrain-4.9.5-test-17-ui-2026-10-21.md'),'utf8');
const html=fs.readFileSync(path.join(racine,'panel.html'),'utf8'),rendu=fs.readFileSync(path.join(racine,'src/ui5-rendu.js'),'utf8');
const section=titre=>{const i=texte.indexOf('## '+titre);assert.ok(i>=0,'section absente : '+titre);const j=texte.indexOf('\n## ',i+3);return texte.slice(i,j<0?undefined:j);};
const plat=t=>t.replace(/\s+/g,' ');
test('installation : empreinte avant la pose, par-dessus la test 16 sans désinstaller, version vérifiée',()=>{
 const s=plat(section('1. Installer et vérifier'));
 assert.ok(s.indexOf('Contrôle l\'empreinte')<s.indexOf('Pose la test 17 (UI)'));
 for(const m of ['Get-FileHash','ariane-4.9.5-test.17-ui.zip','-Algorithm SHA256','par-dessus la test 16','Recharger','« 4.9.5 test 17 (UI) »','Essayer le nouveau panneau'])assert.ok(s.includes(m),m);
 assert.ok(html.includes('Essayer le nouveau panneau'));
});
test('ce qui change : l\'interface seulement ; la pose, le lot et la décision de la test 16 ; éteint au départ ; pas de deuxième passe',()=>{
 const d=plat(texte.slice(0,texte.indexOf('## 1.')));
 for(const m of ['seulement l\'interface','La pose, le lot et la décision sont ceux de la test 16','**éteints**','la deuxième passe en fin de lot'])assert.ok(d.includes(m),m);
});
test('le nouveau panneau et la palette : les libellés de la consigne sont ceux de l\'écran',()=>{
 const s=plat(section('2. Le nouveau panneau'));
 for(const m of ['Essayer le nouveau panneau','Réglages et bilans','Ancien panneau','Palette (clavier)','Ctrl K','Vider le cache','Aucun onglet ESV'])assert.ok(s.includes(m),m);
 for(const m of ['Ancien panneau','Palette (clavier)','Nouveau panneau Ariane','Ouvrir l’ancien panneau'])assert.ok(rendu.includes(m),m);
});
test('pause de la relecture : les libellés de la consigne sont ceux du panneau d\'avant ; éteinte ; réglage de F5',()=>{
 const s=plat(section('3. Pause et reprise de la relecture'));
 for(const m of ['Éteinte au départ','Pause et reprise de la relecture (même après un F5)','mettre en pause / arrêter','Reprendre la relecture au cut N','Arrêter la relecture','24 heures'])assert.ok(s.includes(m),m);
 for(const m of ['Pause et reprise de la relecture (même après un F5)','mettre en pause','arrêter','jusqu’à 24 heures'])assert.ok(html.includes(m),m);
});
test('retour arrière vers la test 16 ; limites dites ; aucune empreinte, adresse, nom de modèle d\'IA ni code de projet',()=>{
 const r=plat(section('6. Si quelque chose ne va pas'));
 for(const m of ['Ne désinstalle pas Ariane','**Désactive** la test 17 (UI)','ariane-4.9.5-test.16.zip','Les poses déjà validées dans ESV restent'])assert.ok(r.includes(m),m);
 const l=plat(section('7. Ce qui n\'est pas vérifié'));
 for(const m of ['Une seule connexion à ESV','n\'affiche pas la relecture en cours','délai de réinstallation de l\'observateur','Edge n\'a pas été vu'])assert.ok(l.includes(m),m);
 assert.ok(!/\b[0-9a-f]{40,64}\b/i.test(texte),'aucune empreinte');assert.ok(!/https?:\/\/|@[a-z]+\./i.test(texte),'aucune adresse');
 assert.ok(!/claude|opus|sonnet|haiku|anthropic/i.test(texte),'aucun nom de modèle');assert.ok(!/\b\d+:\d+\b/.test(texte),'aucun code de partie de projet');
});
