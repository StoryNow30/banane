/* Ariane 5 — écran de lancement du panneau (voir panel-lancement.css) : la mise en scène est toute en CSS ; ce script ne fait que le retirer (clic, touche,
 * fin de l'animation, ou filet de sécurité). Pure présentation : aucun message au service worker, aucune lecture de l'état, rien n'attend cet écran. */
(function(){
 const el=document.getElementById('lancement');if(!el)return;
 let ferme=false,timer=0;
 const fermer=()=>{if(ferme)return;ferme=true;clearTimeout(timer);el.classList.add('fini');el.hidden=true;document.removeEventListener('keydown',fermer,true);};
 el.addEventListener('click',fermer);document.addEventListener('keydown',fermer,true);
 el.addEventListener('animationend',e=>{if(e.animationName==='lanc-sortie')fermer();});
 /* Un navigateur piloté par un robot (essais, `navigator.webdriver`) ne voit pas l'écran : il masquerait le panneau aux essais qui cliquent. Les essais du lancement le forcent. */
 if(navigator.webdriver&&!window.__lancementForce)return fermer();
 const calme=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 timer=setTimeout(fermer,calme?1600:4600);   /* filet : animations suspendues ou coupées, l'écran part quand même */
})();
