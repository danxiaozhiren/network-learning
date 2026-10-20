(()=>{
 const small=matchMedia('(max-width:760px)'),loss=document.getElementById('loss-demo'),otdr=document.getElementById('otdr-demo');
 if(!loss||!otdr)return;
 const $=(root,id)=>root.querySelector('#'+id),full={loss:false,otdr:false};
 function navHeight(){return [...document.querySelectorAll('.sitebar,.mobile-nav')].filter(e=>getComputedStyle(e).display!=='none').reduce((n,e)=>n+e.getBoundingClientRect().height,0);}
 function focusVisual(root,kind){
  requestAnimationFrame(()=>{const target=$(root,'oi-'+kind+'-visual'),head=root.querySelector('.focus-head');scrollTo({top:Math.max(0,scrollY+target.getBoundingClientRect().top-navHeight()-head.getBoundingClientRect().height-8),behavior:'instant'});});
 }
 const desktopLayout=new Map();
 function otdrLayout(compact){
  const svg=$(otdr,'oi-otdr-visual'),ports=JSON.parse(svg.dataset.ports);
  function set(sel,attrs){const e=svg.querySelector(sel);for(const[key,value]of Object.entries(attrs)){const cache=sel+':'+key;if(!desktopLayout.has(cache))desktopLayout.set(cache,e.getAttribute(key));const next=compact?value:desktopLayout.get(cache);if(next===null)e.removeAttribute(key);else e.setAttribute(key,next);}}
  const shifted=(p,x,y)=>[+(p[0]+x).toFixed(2),+(p[1]+y).toFixed(2)],xy=p=>p.join(' '),op=shifted(ports.op,0,-20),li=shifted(ports.li,-10,-55),lo=shifted(ports.lo,-10,-55),ti=shifted(ports.ti,-655,315),to=shifted(ports.to,-655,315);
  set('.oi-otdr-device',{transform:'translate(0 15)'});set('.oi-launch-case',{transform:'translate(270 10)'});set('.oi-tail-case',{transform:'translate(270 380)'});
  set('#oi-otdr-in',{d:`M${xy(op)} Q${op[0]} 0 220 35 T${xy(li)}`});
  set('#oi-otdr-link',{d:`M${xy(lo)} Q465 ${lo[1]} 465 190 Q465 220 355 220 V340 Q355 390 ${ti[0]-20} ${ti[1]} L${xy(ti)}`});
  set('#oi-otdr-end',{d:`M${xy(to)} h17`});set('.oi-terminal',{cx:to[0]+17,cy:to[1]});
  set('.oi-otdr-nodes',{transform:'translate(0 0)'});
  set('#oi-otdr-a',{transform:'translate(-184 129)'});set('#oi-otdr-c',{transform:'translate(-335 189)'});set('#oi-otdr-b',{transform:'translate(-486 249)'});
  for(const [id,x] of [['a',539],['c',690],['b',841]]){set('#oi-otdr-'+id+' .oi-distance',{x:x+85,y:97});set('#oi-otdr-'+id+' rect',{x:x-38,width:76});}
  set('#oi-otdr-line-name',{x:235,y:300});
 }
 function render(kind,move=false){
  const root=kind==='loss'?loss:otdr,step=Number($(root,kind+'-step').value),condition=$(root,kind+'-condition').value;
  root.dataset.oiStep=String(step);root.dataset.oiCondition=condition;root.dataset.oiFull=String(full[kind]);
  const visual=$(root,'oi-'+kind+'-visual'),toggle=$(root,'oi-'+kind+'-view');toggle.hidden=!small.matches;toggle.setAttribute('aria-pressed',String(full[kind]));toggle.textContent=full[kind]?'看当前部件':'看完整接线';
  if(kind==='loss'){
   const link=step>=2,broken=condition==='break'&&step>=2&&step<5;root.dataset.oiLink=String(link);root.dataset.oiBroken=String(broken);
   const view=step===0?'0 40 285 300':step===2?'255 0 490 210':'715 40 285 300';
   visual.setAttribute('viewBox',small.matches&&!full.loss?view:'0 0 1000 340');
   $(root,'oi-loss-route-label').textContent=link?'保留原参考跳纤 → A → C → B → 接收跳纤':'光源输出口 → 参考跳纤 → 功率计输入口';
   visual.setAttribute('aria-label',link?'光源输出口经原参考跳纤接 A，沿 C 到 B，再经接收跳纤接功率计输入口。'+(broken?'线路在距 A 12 km 处断开。':''):'光源与功率计用一根参考跳纤连接，先建立参考。');
  }else{
   const focus=step===0?'210 15 900 250':'0 20 470 275';
   const compact=small.matches&&!full.otdr&&step===0;root.dataset.oiCompact=String(compact);otdrLayout(compact);
   visual.setAttribute('viewBox',compact?'0 0 480 560':small.matches&&!full.otdr?focus:'0 0 1120 295');
   root.dataset.oiBroken=String(condition==='break'&&step>=3);
   visual.setAttribute('aria-label','OTDR 同一个测试口经引纤接 A，沿 C 到 B，B 后面接尾纤。'+$(root,'otdr-screen').textContent);
  }
  if(move&&((kind==='loss'&&step<4)||(kind==='otdr'&&step<3)))focusVisual(root,kind);
 }
 for(const[kind,root]of[['loss',loss],['otdr',otdr]]){
  // Original target handlers run first. This listener only maps their settled
  // DOM state into the drawing; no duplicated power or distance calculation.
  root.addEventListener('change',e=>{if(e.target.matches('#'+kind+'-step,#'+kind+'-condition')){full[kind]=false;render(kind,true);}});
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&[kind+'-next',kind+'-prev',kind+'-reset'].includes(b.id)){full[kind]=false;render(kind,true);}});
  $(root,'oi-'+kind+'-view').addEventListener('click',()=>{full[kind]=!full[kind];render(kind);focusVisual(root,kind);});
 }
 addEventListener('resize',()=>{render('loss');render('otdr');},{passive:true});render('loss');render('otdr');
})();
