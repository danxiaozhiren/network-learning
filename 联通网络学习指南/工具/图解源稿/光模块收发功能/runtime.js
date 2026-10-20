(() => {
  const figure=document.getElementById('ms-figure');
  if(!figure)return;
  const $=id=>figure.querySelector('#'+id);
  let step=0,bits='00011110',connected=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const views=__VIEWS__;
  const zones=figure.querySelectorAll('[data-ms-zone]');
  const wave=(data,weak)=>{
    let d='';
    [...data].forEach((bit,i)=>{const x=12+i*37,y=bit==='1'?(weak?31:15):(weak?43:53);d+=(i?'V'+y:'M'+x+' '+y)+'H'+(x+37);});
    return d;
  };
  function navTop(){
    const bar=document.querySelector('.sitebar'),mobile=document.querySelector('.mobile-nav');
    return (bar?bar.offsetHeight:0)+(mobile&&getComputedStyle(mobile).display!=='none'?mobile.offsetHeight:0)+7;
  }
  function layout(){figure.style.setProperty('--ms-top',navTop()+'px');}
  function focusCurrent(){
    layout();const naturalTop=$('ms-overview').getBoundingClientRect().bottom+scrollY;
    scrollTo({top:Math.max(0,naturalTop-navTop()),behavior:'instant'});
  }
  function render(move=false){
    const state=derive(step,bits,connected);figure.dataset.msStep=String(step);figure.dataset.msConnected=String(connected);figure.dataset.msKind=state.kind;figure.dataset.msBlocked=String(state.blocked);
    zones.forEach(el=>el.classList.toggle('ms-current',el.dataset.msZone===state.zone));
    $('ms-step-select').value=String(step);$('ms-pattern').value=bits;
    $('ms-place').textContent=state.place;$('ms-title').textContent=state.title;$('ms-count').textContent=(step+1)+' / '+steps.length;
    $('ms-part-label').textContent=step<=2?'A 端 · '+state.title:step===3?'A → B · 收发光口':'B 端 · '+state.title;
    $('ms-action').textContent=state.blocked?'光纤已断开':state.action;$('ms-copy').textContent=state.copy;
    $('ms-focus').setAttribute('viewBox',views[state.blocked?3:step]);$('ms-focus').setAttribute('aria-label',state.blocked?'当前局部：A到B的光路，B的Rx口前已断开':'当前局部：'+state.place+'，'+state.title);
    $('ms-wave-title').textContent=state.wave;$('ms-wave-path').setAttribute('d',state.waveBits?wave(state.waveBits,state.weak):'');
    $('ms-wave-empty').toggleAttribute('hidden',!state.blocked);$('ms-wave').toggleAttribute('hidden',state.blocked);$('ms-wave').setAttribute('aria-label',state.blocked?'当前没有收到这段信号':state.wave+'，依次对应数据'+bits+(state.weak?'；幅度仅为示意':''));
    $('ms-input').textContent=bits;$('ms-output').textContent=state.output||(state.blocked?'未收到':'等待交付');$('ms-result').textContent=state.result;$('ms-note').textContent=state.stateNote;
    $('ms-prev').disabled=step===0;$('ms-next').disabled=step===steps.length-1;
    $('ms-connection').textContent=connected?'断开光纤':'接回光纤';$('ms-connection').setAttribute('aria-pressed',String(!connected));
    layout();if(move)requestAnimationFrame(focusCurrent);
  }
  $('ms-step-select').addEventListener('change',e=>{step=Number(e.target.value);render(true);});
  $('ms-prev').addEventListener('click',()=>{step=Math.max(0,step-1);render(true);});
  $('ms-next').addEventListener('click',()=>{step=Math.min(steps.length-1,step+1);render(true);});
  $('ms-reset').addEventListener('click',()=>{step=0;bits='00011110';connected=true;render(true);});
  $('ms-pattern').addEventListener('change',e=>{bits=e.target.value;render(true);});
  $('ms-connection').addEventListener('click',()=>{connected=!connected;render(true);});
  $('ms-show-map').addEventListener('click',e=>{e.preventDefault();$('ms-overview').open=true;requestAnimationFrame(()=>{scrollTo({top:Math.max(0,$('ms-overview').getBoundingClientRect().top+scrollY-navTop()),behavior:'instant'});});});
  // Native select/buttons and disclosure provide keyboard access without global shortcuts.
  if(innerWidth<=600)$('ms-overview').open=false;
  addEventListener('resize',layout,{passive:true});
  new ResizeObserver(layout).observe(figure.querySelector('.ms-toolbar'));
  figure.dataset.msMotion=reduced.matches?'reduced':'normal';
  reduced.addEventListener('change',e=>{figure.dataset.msMotion=e.matches?'reduced':'normal';});
  render();
})();
