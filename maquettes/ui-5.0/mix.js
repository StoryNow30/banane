/* Maquettes du mélange Raycast + Figma et Arc : une seule source de données inventées, trois mises en page (I, II, III). */
(function(){
const $=id=>document.getElementById(id);
const K=(...k)=>k.map(x=>`<kbd>${x}</kbd>`).join(' ');
/* --- données inventées --- */
function cellules(sc){
 const n=120,c=Array(n).fill('r');
 const faits=sc==='repos'?0:sc==='echo'?0:(sc==='lot'||sc==='incident'||sc==='menu'||sc==='palette')?31:120;
 for(let i=0;i<faits;i++)c[i]='p';
 [6,14,22].forEach(i=>{if(i<faits)c[i]='q'});[4,9,17,25].forEach(i=>{if(i<faits)c[i]='d'});
 if(sc==='lot'||sc==='palette'||sc==='menu')c[31]='now';
 if(sc==='incident')c[31]='bad';
 return c;
}
const ETAT={
 repos:{t:'',etat:'Prêt',gros:'4790',pt:'cut',phr:'ESV est sur ce cut rouge. Le lot ira jusqu’à la fin de la partie.',bar:0,p:['▶','Démarrer le lot','Orbite · jusqu’à la fin de la partie','v',1],cmds:[['◌','Passer en Écho','tu corriges toi-même','b'],['⚙','Après le lot','relire et corriger','n']]},
 lot:{etat:'En cours · pose des rails',ton:'v',gros:'4812',pt:'cut',phr:'31 / 120 invalides · 27 posés · 4 différés',bar:26,p:['❚❚','Pause','le lot s’arrête au prochain cut sûr','a',1],cmds:[['■','Arrêter le lot','ne se défait pas','r'],['◔','Cuts à contrôler','9','p'],['⧉','Tout télécharger pour l’analyse','','n']]},
 palette:{etat:'En cours · pose des rails',ton:'v',gros:'4812',pt:'cut',phr:'31 / 120 invalides · 27 posés · 4 différés',bar:26,p:['❚❚','Pause','','a',1],cmds:[['■','Arrêter le lot','','r'],['◔','Cuts à contrôler','9','p'],['⚙','Après le lot','relire et corriger','n']],q:'rel'},
 incident:{etat:'À toi · lot en pause',ton:'r',gros:'4812',pt:'cut',phr:'ESV ne répond plus. Rien n’a été posé sur ce cut. Recharge la page (F5), puis reprends.',bar:26,p:['↻','Reprendre','après le F5','v',1],cmds:[['✋','Je le fais moi-même','reprise manuelle','b'],['⤼','Passer ce cut en SKIP','avec confirmation','a'],['■','Arrêter le lot','','r']]},
 menu:{etat:'En cours · pose des rails',ton:'v',gros:'4812',pt:'cut',phr:'31 / 120 invalides · 27 posés · 4 différés',bar:26,p:['❚❚','Pause','','a',1],cmds:[['■','Arrêter le lot','','r']]},
 relecture:{etat:'Relecture après le lot',ton:'v',gros:'12 / 85',pt:'relus',phr:'3 corrigés. Ne touche à rien dans ESV.',bar:14,p:['■','Arrêter la relecture','','a',1],cmds:[['◔','Cuts à contrôler','9','p']]},
 fin:{etat:'Terminé',ton:'',gros:'✓',pt:'partie 13',phr:'27 posés · 4 différés · 9 à contrôler. Relecture : 85 relus, 41 corrigés.',bar:100,p:['⧉','Tout télécharger pour l’analyse','3 volumes, empreintes calculées','v',1],cmds:[['▶','Nouveau lot','','v'],['◔','Cuts à contrôler','9','p'],['📁','Ouvrir le dossier des fichiers','','b']]},
 echo:{etat:'Écho · observation',ton:'v',gros:'148',pt:'cuts vus',phr:'61 corrigés. Travaille normalement dans ESV.',bar:null,p:['■','Terminer et télécharger','clôt la séance et écrit les volumes','v',1],cmds:[['❚❚','Pause','','a'],['▷','Passer en Orbite','','b']]},
};
const MODEL=ETAT;
const ruban=(sc,sel)=>{const c=cellules(sc);let h='<div class="zones"><span style="left:'+(5/40*100)+'%;width:'+(8/40*100)+'%">PN</span><span style="left:'+(22/40*100)+'%;width:'+(12/40*100)+'%">ADV</span></div>';
 for(let r=0;r<3;r++){h+=`<div class="rub"><div class="l">${4790+r*40} → ${4829+r*40}</div><div class="cells">`;
  for(let k=0;k<40;k++){const i=r*40+k;let cl=c[i];if(sc==='relecture'&&i<12)cl+=' vu';if(sc==='fin'&&[8,31,55,70,77,90,101,110,116].includes(i))cl+=' ctl';if(sel===i)cl+=' sel';h+=`<div class="cell ${cl}"></div>`;}
  h+='</div></div>';}
 return h;};
const mini=sc=>'<div class="mini">'+cellules(sc).map(s=>`<i style="background:${{p:'#27a96f',q:'#7bd9ad',d:'var(--ambre)',now:'#fff',bad:'var(--rouge)',r:'rgba(255,255,255,.12)'}[s]}"></i>`).join('')+'</div>';
const legende='<div class="legende"><span><i style="background:#27a96f"></i>posé</span><span><i style="background:#7bd9ad"></i>posé par la voie</span><span><i style="background:var(--ambre)"></i>différé</span><span><i style="background:#fff"></i>en cours</span><span><i style="background:rgba(255,255,255,.12)"></i>à poser</span></div>';
const ligne=(c,s)=>`<div class="o${s?' s':''}"><span class="tuile t-${c[3]}">${c[0]}</span><span class="nm">${c[1]}</span>${c[2]?`<span class="sb">${c[2]}</span>`:''}</div>`;
const lignesCmd=(m,q)=>{const L=[m.p,...m.cmds].filter(x=>!q||(x[1]+x[2]).toLowerCase().includes(q));return L.map((c,i)=>ligne(c,i===0)).join('');};
const gcv='<div class="gcv">GCV2 · cuts appris <b>2 684</b> <span class="p">+ 61</span> <small>(chiffre du 19/10)</small></div>';
const espaces=(sc)=>`<div class="rail"><div class="logo">ARIANE</div><h4>Espaces</h4><div class="esp${sc!=='echo'?' a':''}"><i style="background:var(--vert)"></i>Orbite · P13<small>31/120</small></div><div class="esp${sc==='echo'?' a':''}"><i style="background:var(--bleu)"></i>Écho · P14<small>148</small></div><div class="esp"><i style="background:var(--tx3)"></i>Partie 12<small>✓</small></div><h4>Vues</h4><div class="esp">◔ À contrôler<small>9</small></div><div class="esp">⚙ Réglages</div><div class="bas">${gcv}</div></div>`;
const inspecteur=(sc,m,cut)=>`<h3>${cut?'Cut '+cut:m.gros}</h3><p class="sub">${cut?'Posé par le moteur':m.etat}</p>${m.bar!==null?`<div class="gros" style="font-size:38px">${m.bar} %<small></small></div><div class="bm"><i style="width:${m.bar}%"></i></div>`:''}${sc==='echo'?'<div class="kv"><span>Corrigés</span><span>61</span></div><div class="kv"><span>Visites</span><span>148</span></div><div class="kv"><span>Rythme</span><span>11 s par cut</span></div>':'<div class="kv"><span>Posés</span><span>27</span></div><div class="kv"><span>Différés</span><span style="color:var(--ambre)">4</span></div><div class="kv"><span>À contrôler</span><span>9</span></div>'}${cut?'<div class="kv"><span>Écart à la voie</span><span class="mono">2 mm</span></div>':''}<div style="margin-top:12px"><button class="btn p" style="width:100%;justify-content:center">${m.p[1]}</button></div>`;
const reg=()=>`<div class="reg"><h3 style="margin:14px 0 0">Réglages</h3>${[['Après le lot','Choix gardé pour le prochain lot',['Relire et corriger','Relire sans rien modifier','Rien']],['Clic du mode rapide','',['Comme avant','Rail gauche recentré','Tout recentré']],['Série de différés','',['Non','Oui']],['Raison de la correction (Écho)','',['Non','Oui · chiffres du haut','Oui · Alt + chiffre']],['Bandeau dans ESV','',['Oui','Non']],['Interface','',['Mélange I','Mélange II','Mélange III','Ancien panneau']]].map(r=>`<div class="lr"><div>${r[0]}${r[1]?`<small>${r[1]}</small>`:''}</div><select>${r[2].map(o=>`<option>${o}</option>`).join('')}</select></div>`).join('')}</div>`;
/* --- I : la capsule --- */
const A=(sc)=>{
 if(sc==='reglages')return `<div class="A"><div>${espaces('lot')}</div><div class="cv" style="grid-column:2 / 4;overflow:auto">${reg()}</div></div>`;
 const m=MODEL[sc]||MODEL.lot,ouvert=sc==='palette';
 return `<div class="A">${espaces(sc)}<div class="cv"><div class="etat ${m.ton||''}" style="margin-bottom:6px">${m.etat}</div><div class="phr" style="margin:0 0 14px;max-width:70ch"><b>${m.phr}</b></div>${sc==='echo'?`<div class="gros" style="margin-bottom:14px">${m.gros}<small>${m.pt}</small></div>`:legende+ruban(sc,sc==='menu'?9:-1)+mini(sc)}</div>
 <div class="insp verre">${inspecteur(sc,m,sc==='menu'?'4799':null)}</div>
 <div class="caps verre">${ouvert?`<div class="lst">${lignesCmd(m,'')}</div>`:''}<div class="q"><span class="tuile t-${m.p[3]}" style="width:24px;height:24px">${m.p[0]}</span><span class="ph">${ouvert?'rel':'Que veux-tu faire ?'}</span>${ouvert?'':`<span class="ch">${m.p[1]}</span>`}<span>${ouvert?K('↵'):K('Ctrl','K')}</span></div></div></div></div>`;};
/* --- II : le panneau unique --- */
const B=(sc)=>{
 const m=MODEL[sc==='reglages'?'lot':sc]||MODEL.lot,echo=sc==='echo';
 const pa=`<div class="pa"><span class="${echo?'':'a'}"><i style="background:var(--vert)"></i>Orbite · P13</span><span class="${echo?'a':''}"><i style="background:var(--bleu)"></i>Écho · P14</span><span><i style="background:var(--tx3)"></i>Partie 12</span></div>`;
 const droite=sc==='reglages'?reg():`<div class="etat ${m.ton||''}">${m.etat}</div><div class="gros" style="margin:8px 0 2px">${m.gros}<small>${m.pt}</small></div>${m.bar!==null?`<div class="bm"><i style="width:${m.bar}%"></i></div>`:''}<div class="phr" style="margin-bottom:12px">${m.phr}</div>${echo?'':legende+ruban(sc==='palette'?'lot':sc,-1)}`;
 return `<div class="B"><div class="ray verre"><div class="srch"><span class="tuile t-v" style="width:22px;height:22px;font-size:11px">A</span>${pa}<span class="ph">${sc==='palette'?'rel':'Que veux-tu faire ?'}</span><span class="gcv" style="white-space:nowrap">${gcv.replace('<div class="gcv">','').replace('</div>','')}</span></div>
 <div class="corps"><div class="l"><div class="g">${sc==='palette'?'Résultats':'Suggestions'}</div>${lignesCmd(m,sc==='palette'?'rel':'')||''}${sc==='palette'?ligne(['⚙','Après le lot','relire et corriger','n'],0)+ligne(['◔','Relecture : dernier bilan','85 relus, 41 corrigés','p'],0):''}<div class="g">Vues</div>${ligne(['⚙','Réglages','','n'],0)}</div><div class="droite">${droite}</div></div>
 <div class="pied"><span class="lg"></span><span class="sp"></span><span>${m.p[1]} ${K('↵')}</span><span style="opacity:.4">|</span><span>Actions ${K('Ctrl','K')}</span></div></div></div>`;};
/* --- III : le canevas et son menu --- */
const C=(sc)=>{
 if(sc==='reglages')return `<div class="C"><div class="onglets"><div class="on"><i style="background:var(--vert)"></i>Orbite · P13</div><div class="on a">⚙ Réglages</div></div><div class="toile" style="overflow:auto">${reg()}</div></div>`;
 const m=MODEL[sc==='menu'||sc==='palette'?'lot':sc]||MODEL.lot,echo=sc==='echo';
 const ban=`<div class="ban verre"><span class="etat ${m.ton||''}" style="flex:none">${m.etat}</span><span class="tx phr"><b>${m.phr}</b></span><button class="btn ${sc==='incident'?'p':''}">${m.p[1]}</button></div>`;
 const menu=sc==='menu'?`<div class="menu verre" style="left:520px;top:228px"><div class="tt">Cut 4799 · différé</div>${[['▶','Aller à ce cut dans ESV','','v'],['↻','Reprendre les différés','','b'],['⧉','Copier le numéro du cut','','n'],['☰','Voir pourquoi','refus : écartement bas','p']].map((c,i)=>ligne(c,i===0)).join('')}</div>`:'';
 const cmd=sc==='palette'?`<div class="cmd verre"><div class="q"><span style="color:var(--tx)">rel</span></div><div class="lst">${ligne(['↻','Relire et corriger','après le lot','v'],1)}${ligne(['◎','Relire sans rien modifier','ombre','b'],0)}${ligne(['◔','Relecture : dernier bilan','85 relus, 41 corrigés','p'],0)}</div></div>`:'';
 return `<div class="C"><div class="onglets"><div class="on${echo?'':' a'}"><i style="background:var(--vert)"></i>Orbite · P13</div><div class="on${echo?' a':''}"><i style="background:var(--bleu)"></i>Écho · P14</div><div class="on"><i style="background:var(--tx3)"></i>Partie 12</div><span class="sp"></span><button class="btn">Commandes ${K('Ctrl','K')}</button><button class="btn">⚙</button></div>
 <div class="toile">${ban}${echo?`<div class="gros" style="margin:14px 0">${m.gros}<small>${m.pt}</small></div>`:legende+ruban(sc==='menu'?'lot':sc,sc==='menu'?9:-1)}${menu}${cmd}</div>
 <div class="barre-bas"><span>${gcv.replace('<div class="gcv">','').replace('</div>','')}</span><span class="sp"></span>${m.bar!==null?`<span>${m.bar} %</span><div class="bm" style="width:160px;margin:0"><i style="width:${m.bar}%"></i></div>`:''}</div></div>`;};
const LAY={A,B,C};
window.mixInit=function(lay,noms){const hote=$('win'),barre=$('sc');
 const aller=k=>{hote.innerHTML=LAY[lay](k);[...barre.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.k===k)));history.replaceState(null,'','#'+k);};
 Object.entries(noms).forEach(([k,n])=>{const b=document.createElement('button');b.textContent=n;b.dataset.k=k;b.onclick=()=>aller(k);barre.append(b);});
 aller(noms[location.hash.slice(1)]?location.hash.slice(1):Object.keys(noms)[0]);};
})();
