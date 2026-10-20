(()=>{
  const figure=document.getElementById('cs-figure');if(!figure)return;
  const $=id=>figure.querySelector('#'+id);
  let type='loose',index=0,full=false;
  const small=matchMedia('(max-width:700px)'),motion=matchMedia('(prefers-reduced-motion:reduce)');
  function top(){const a=document.querySelector('.sitebar'),b=document.querySelector('.mobile-nav');return (a?a.offsetHeight:0)+(b&&getComputedStyle(b).display!=='none'?b.offsetHeight:0)+7;}
  function layout(){figure.style.setProperty('--cs-top',top()+'px');$('cs-visual').setAttribute('viewBox',small.matches&&!full&&index>0?'240 50 350 190':!small.matches&&innerHeight<=760?'120 35 470 215':'100 0 500 260');$('cs-view').hidden=!small.matches||index===0;$('cs-view').textContent=full?'看当前层':'看完整剖面';$('cs-view').setAttribute('aria-pressed',String(full));}
  function focus(){layout();const y=figure.querySelector('.figure-head').getBoundingClientRect().bottom+scrollY;scrollTo({top:Math.max(0,y-top()),behavior:'instant'});}
  function render(move=false){
    const state=stateOf(type,index);figure.dataset.csCable=type;figure.dataset.csStep=String(index);figure.dataset.csZone=state.zone;
    $('cs-type').value=type;
    $('cs-step').replaceChildren(...cables[type].steps.map((s,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+' / '+state.count+'　'+s.title;return o;}));$('cs-step').value=String(index);
    figure.querySelectorAll('[data-cs-frame]').forEach(g=>g.toggleAttribute('hidden',g.dataset.csFrame!==type+'-'+index));
    figure.querySelectorAll('[data-cs-zone]').forEach(g=>g.classList.toggle('cs-current',g.dataset.csZone===state.zone));
    $('cs-place').textContent=state.name+' · '+state.where;$('cs-title').textContent=state.title;$('cs-count').textContent=(index+1)+' / '+state.count;
    $('cs-copy').textContent=state.say;$('cs-relation').textContent=state.relation;$('cs-visual').setAttribute('aria-label',state.name+'：'+state.title+'。'+state.relation);
    figure.querySelectorAll('[data-cs-key]').forEach(el=>{el.hidden=el.dataset.csKey==='armor'&&type!=='armored'||el.dataset.csKey==='tube'&&type==='bow';el.setAttribute('aria-current',String(el.dataset.csKey===state.zone));});
    $('cs-prev').disabled=index===0;$('cs-next').disabled=index===state.count-1;layout();if(move)requestAnimationFrame(focus);
  }
  $('cs-type').addEventListener('change',e=>{type=e.target.value;index=0;full=false;render(true);});
  $('cs-step').addEventListener('change',e=>{index=Number(e.target.value);full=false;render(true);});
  $('cs-prev').addEventListener('click',()=>{index=Math.max(0,index-1);full=false;render(true);});
  $('cs-next').addEventListener('click',()=>{index=Math.min(cables[type].steps.length-1,index+1);full=false;render(true);});
  $('cs-reset').addEventListener('click',()=>{index=0;full=false;render(true);});
  $('cs-view').addEventListener('click',()=>{full=!full;layout();requestAnimationFrame(focus);});
  addEventListener('resize',layout,{passive:true});new ResizeObserver(layout).observe(figure.querySelector('.cs-toolbar'));
  figure.dataset.csMotion=motion.matches?'reduced':'normal';motion.addEventListener('change',e=>{figure.dataset.csMotion=e.matches?'reduced':'normal';});
  render();
})();
