/* Bascule de scènes des maquettes : un bouton par scène, aucun appel réseau. */
(function(){
 const scenes=[...document.querySelectorAll('[data-scene]')],barre=document.getElementById('scenes');
 function aller(nom){
  scenes.forEach(s=>s.classList.toggle('visible',s.dataset.scene===nom));
  [...barre.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nom===nom)));
  const ou=document.getElementById('ou');
  if(ou){ou.textContent=/echo/.test(nom)?'Écho · Partie 13':nom==='reglages'?'Réglages':'Orbite · Partie 13';}
  try{history.replaceState(null,'','#'+nom);}catch(e){}
 }
 scenes.forEach(s=>{const b=document.createElement('button');b.type='button';b.textContent=s.dataset.titre;b.dataset.nom=s.dataset.scene;b.onclick=()=>aller(s.dataset.scene);barre.append(b);});
 document.addEventListener('click',e=>{const t=e.target.closest('[data-va]');if(t)aller(t.dataset.va);});
 aller((location.hash||'').slice(1)&&scenes.some(s=>s.dataset.scene===location.hash.slice(1))?location.hash.slice(1):scenes[0].dataset.scene);
})();
