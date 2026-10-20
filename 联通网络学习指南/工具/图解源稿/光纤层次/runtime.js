(() => {
  const root=document.getElementById('fl-figure');if(!root)return;
  const $=id=>root.querySelector('#'+id);
  const small=matchMedia('(max-width:700px)');let index=0,full=false;
  function navHeight(){return [...document.querySelectorAll('.sitebar,.mobile-nav')].filter(el=>getComputedStyle(el).display!=='none').reduce((sum,el)=>sum+el.getBoundingClientRect().height,0);}
  function layout(){
    const state=stateOf(index);
    $('fl-visual').setAttribute('viewBox',small.matches&&!full?(state.view==='cable'?'15 68 320 190':'380 5 510 255'):'0 0 900 280');
    root.dataset.flFocus=state.view;root.dataset.flFull=String(full);
    $('fl-view').hidden=!small.matches;
    $('fl-view').textContent=full?'看当前部件':'看完整关系';
    $('fl-view').setAttribute('aria-pressed',String(full));
    root.style.setProperty('--fl-nav',navHeight()+'px');
  }
  function focus(){
    const top=$('fl-heading').getBoundingClientRect().top+scrollY;
    scrollTo({top:Math.max(0,top-navHeight()-8),behavior:'instant'});
  }
  function render(move=false){
    const state=stateOf(index);root.dataset.flStep=String(index);root.dataset.flZone=state.zone;
    $('fl-title').textContent=state.title;$('fl-count').textContent=(index+1)+' / '+state.count;
    $('fl-copy').textContent=state.say;$('fl-relation').textContent=state.relation;
    $('fl-step').value=String(index);
    $('fl-visual').setAttribute('aria-label',state.title+'。'+state.relation+'。颜色和比例为教学示意。');
    root.querySelectorAll('[data-fl-frame]').forEach(el=>el.toggleAttribute('hidden',Number(el.dataset.flFrame)!==index));
    root.querySelectorAll('[data-fl-zone]').forEach(el=>el.classList.toggle('fl-current',el.dataset.flZone===state.zone||state.zone==='all'&&layers.some(l=>l.key===el.dataset.flZone)));
    root.querySelectorAll('[data-fl-key]').forEach(el=>el.setAttribute('aria-current',String(el.dataset.flKey===state.zone)));
    $('fl-prev').disabled=index===0;$('fl-next').disabled=index===steps.length-1;
    layout();if(move)requestAnimationFrame(focus);
  }
  function go(i){index=Math.max(0,Math.min(steps.length-1,i));full=false;render(true);}
  $('fl-step').addEventListener('change',e=>go(Number(e.target.value)));
  $('fl-prev').addEventListener('click',()=>go(index-1));
  $('fl-next').addEventListener('click',()=>go(index+1));
  $('fl-reset').addEventListener('click',()=>go(0));
  $('fl-view').addEventListener('click',()=>{full=!full;layout();requestAnimationFrame(focus);});
  addEventListener('resize',layout,{passive:true});render();
})();
