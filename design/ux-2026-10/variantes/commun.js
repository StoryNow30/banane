/* Données fictives communes aux maquettes et dessins partagés (la ligne,
 * l'écart à la voie). Aucune donnée réelle, aucun identifiant de projet. */
(()=>{
 const q=new URLSearchParams(location.search);
 document.documentElement.dataset.theme=q.get('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'sombre':'clair');
 // Le lot : 8410 → 8640, cut affiché 8455 (capture faite, pose en cours).
 const cuts=[];for(let c=8412;c<=8455;c++)cuts.push(c);
 const voie=new Set([8415,8422,8423,8429,8433,8441,8446,8447,8453]);
 const differe=new Set([8420,8438,8451]);
 // Écart à la voie (mm), pseudo-aléatoire mais stable.
 const ecart=c=>differe.has(c)||c===8455?null:+(2+((c*37)%97)/97*(voie.has(c)?10:6)).toFixed(1);
 const classe=c=>c===8455?'actuel':differe.has(c)?'differe':voie.has(c)?'voie':'moteur';
 const D={
  partie:34,cut:8455,debut:8410,fin:8640,pct:20,
  etat:'En cours',etape:'pose',
  commande:{nom:'Valider et passer au suivant',cut:8454},
  poses:42,parVoie:9,differes:3,skip:0,main:0,traites:45,couverture:93,
  cuts,classe,ecart,
  activite:[
   {h:'14:32:08',c:8454,q:'posé · moteur',k:'',v:'2,6 mm'},
   {h:'14:31:51',c:8453,q:'posé · par la voie',k:'voie',v:'5,9 mm'},
   {h:'14:31:30',c:8451,q:'différé · deux rails',k:'differe',v:'—'}],
  lot:{ignores:0},
  partieRes:{lots:4,traitees:214,posees:208,differes:4,main:2,skip:0,liste:[8102,8420,8438,8451]},
  politique:[['Rail non résolu','continuer et différer'],['Faible confiance','mettre le lot en pause'],['Décision sur le lot','appliquée']],
  exports:[['Journal','texte'],['Bilan et LiDAR','zip'],['Diagnostic GCV1','json'],['Corpus GCV1 + LiDAR','zip']],
  departs:[['34','13/10 12:58','1 284','37'],['33','12/10 16:04','2 015','12']]
 };
 D.mediane=(()=>{const v=cuts.map(ecart).filter(x=>x!==null).sort((a,b)=>a-b);return v[v.length>>1];})();
 const fr=x=>String(x).replace('.',',');
 /* La ligne : une case par cut ; le cut affiché plus haut ; 6 cases à venir. */
 D.ligne=(o={})=>{const W=o.w||432,n=cuts.length+6,g=o.gap??2,pas=W/n,L=pas-g,H=o.h||22,r=o.r??0;
  let s=`<svg viewBox="0 0 ${W} ${H+18}" width="100%" class="ligne-svg">`;
  cuts.forEach((c,i)=>{const k=classe(c),haut=k==='actuel';s+=`<rect class="t ${k}" x="${(i*pas).toFixed(1)}" y="${haut?0:H*.3}" width="${L.toFixed(1)}" height="${haut?H:H*.7}" rx="${r}"/>`;});
  for(let i=0;i<6;i++)s+=`<rect class="t avenir" x="${((cuts.length+i)*pas).toFixed(1)}" y="${H*.3}" width="${L.toFixed(1)}" height="${H*.7}" rx="${r}"/>`;
  const ia=cuts.length-1;
  s+=`<text class="axt" x="0" y="${H+14}">${cuts[0]}</text><text class="axt fort" x="${(ia*pas+L/2).toFixed(1)}" y="${H+14}" text-anchor="middle">${cuts[ia]}</text><text class="axt" x="${W}" y="${H+14}" text-anchor="end">${D.fin}</text>`;
  return s+'</svg>';};
 /* L'écart à la voie : courbe, aire, garde à 30 mm, différés en tirets. */
 D.profil=(o={})=>{const W=o.w||432,H=o.h||90,top=8,bot=H-18,n=cuts.length+6,pas=W/n,Y=mm=>(bot-Math.min(mm,40)/40*(bot-top)).toFixed(1),X=i=>(i*pas+pas/2).toFixed(1);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" class="profil-svg"><line class="ax" x1="0" y1="${bot}" x2="${W}" y2="${bot}"/><line class="garde" x1="0" y1="${Y(30)}" x2="${W}" y2="${Y(30)}"/><text class="axt rouge" x="0" y="${Y(30)-4}">garde 30 mm</text>`;
  let seg=[];const segs=[];cuts.forEach((c,i)=>{const e=ecart(c);if(e===null){if(seg.length)segs.push(seg);seg=[];}else seg.push([i,e]);});if(seg.length)segs.push(seg);
  for(const g of segs){if(g.length<2)continue;const xy=g.map(([i,e])=>`${X(i)},${Y(e)}`);s+=`<polygon class="aire" points="${X(g[0][0])},${bot} ${xy.join(' ')} ${X(g.at(-1)[0])},${bot}"/><polyline class="courbe" points="${xy.join(' ')}"/>`;}
  cuts.forEach((c,i)=>{const e=ecart(c),k=classe(c);if(e===null){if(k==='differe')s+=`<rect class="d" x="${(+X(i)-1.5).toFixed(1)}" y="${bot-7}" width="3" height="7"/>`;}else if(k==='voie')s+=`<circle class="p voie" cx="${X(i)}" cy="${Y(e)}" r="2"/>`;});
  s+=`<text class="axt" x="0" y="${H-3}">${cuts[0]}</text><text class="axt fort" x="${X(cuts.length-1)}" y="${H-3}" text-anchor="middle">${cuts.at(-1)}</text>`;
  return s+'</svg>';};
 D.fr=fr;
 /* Icônes au trait (dessinées ici, aucune reprise). <i data-ic="nom"></i> */
 const P={pause:'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" stroke="none"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',retour:'<path d="M15 5l-7 7 7 7"/>',bas:'<path d="M7 10l5 5 5-5"/>',
  dl:'<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',doc:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>',
  nuage:'<circle cx="6" cy="16" r="1.2"/><circle cx="10" cy="12" r="1.2"/><circle cx="14" cy="15" r="1.2"/><circle cx="18" cy="9" r="1.2"/><circle cx="8" cy="8" r="1.2"/>',
  courbe:'<path d="M4 18l5-6 4 3 7-9"/>',couches:'<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/>',
  poubelle:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',prise:'<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>',
  recharge:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',soleil:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  bandeau:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/>',reglages:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  horloge:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',liste:'<path d="M4 6h16M4 12h16M4 18h10"/>',rail:'<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>',
  drapeau:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',eclair:'<path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="currentColor" stroke="none"/>',ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  partie:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'};
 addEventListener('DOMContentLoaded',()=>document.querySelectorAll('i[data-ic]').forEach(el=>{const s=+(el.dataset.s||20);
  el.outerHTML=`<svg class="${el.className}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[el.dataset.ic]||''}</svg>`;}));
 globalThis.D=D;
 // Remplit les éléments marqués data-svg="ligne|profil".
 addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-svg]').forEach(el=>{const o=JSON.parse(el.dataset.o||'{}');el.innerHTML=D[el.dataset.svg](o);});
  const ong=q.get('onglet')||(document.querySelector('[data-pane]')?.dataset.pane);if(ong){document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==ong);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===ong));}});
})();
