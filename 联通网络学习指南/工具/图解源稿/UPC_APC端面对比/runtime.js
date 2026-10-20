(()=>{
 const root=document.getElementById('ef-figure');if(!root)return;
 const $=id=>root.querySelector('#'+id),small=matchMedia('(max-width:700px)');let index=0,full=false;
 function navHeight(){return [...document.querySelectorAll('.sitebar,.mobile-nav')].filter(el=>getComputedStyle(el).display!=='none').reduce((sum,el)=>sum+el.getBoundingClientRect().height,0);}
 function layout(){
  const state=stateOf(index);root.dataset.efFull=String(full);root.dataset.efFocus=state.focus;
  $('ef-visual').setAttribute('viewBox',small.matches&&!full?(state.focus==='upc'?'0 0 430 330':'450 0 430 330'):'0 0 880 330');
  $('ef-view').hidden=!small.matches;$('ef-view').textContent=full?'看当前端面':'看双图对比';$('ef-view').setAttribute('aria-pressed',String(full));
 }
 function focus(){scrollTo({top:Math.max(0,$('ef-heading').getBoundingClientRect().top+scrollY-navHeight()-8),behavior:'instant'});}
 function render(move=false){
  const s=stateOf(index);root.dataset.efStep=String(index);root.dataset.efZone=s.zone;
  $('ef-title').textContent=s.title;$('ef-count').textContent=(index+1)+' / '+s.count;
  $('ef-copy').textContent=s.say;$('ef-relation').textContent=s.relation;$('ef-step').value=String(index);
  $('ef-visual').setAttribute('aria-label',s.title+'。'+s.say+'两图均为沿光纤轴线的纵剖面，曲率和厚度夸张，不按比例。');
  $('ef-prev').disabled=index===0;$('ef-next').disabled=index===steps.length-1;
  layout();if(move)requestAnimationFrame(focus);
 }
 function go(i){index=Math.max(0,Math.min(steps.length-1,i));full=false;render(true);}
 $('ef-step').addEventListener('change',e=>go(Number(e.target.value)));
 $('ef-prev').addEventListener('click',()=>go(index-1));$('ef-next').addEventListener('click',()=>go(index+1));$('ef-reset').addEventListener('click',()=>go(0));
 $('ef-view').addEventListener('click',()=>{full=!full;layout();requestAnimationFrame(focus);});
 addEventListener('resize',layout,{passive:true});render();
})();
