import * as k from '../光模块收发功能/vendor/anatomy/kit/iso-kit.mjs';
import * as G from '../光模块收发功能/vendor/anatomy/kit/lathe.mjs';
import * as A from '../光模块收发功能/vendor/anatomy/kit/audit.mjs';

function scene(P,name){
 const R=A.recorder(P);
 function put(id,paths,shape,at,material='case',inner=''){
  shape.name=name+'.'+id;R.put({name:shape.name,at,svg:`<g class="oi-material-${material}">${k.solidSvg(paths,{inner})}</g>`,shapes:[R.solid(shape)]});
 }
 function slab(id,x,y,w,d,z,h,material='case',ground=false,inner=''){
  const p={x,y,w,d,r:Math.min(2,w/5,d/5)};
  put(id,k.slabOf(p,z,h,P,8),A.slab(p,z,h,{ground}),[x+w/2,y+d/2,z+h/2],material,inner);
 }
 function disc(id,F,s0,s1,r,material='metal',ground=false,inner=''){
  put(id,G.disc(s0,s1,r,F,P,{steps:48}),A.disc(F,s0,s1,r,{ground}),G.pointOf(F,(s0+s1)/2,0,0),material,inner);
 }
 function finish(audit){A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);if(audit){console.log(name);A.auditOrExit(R,P);}return{svg:R.items.map(x=>x.svg).join(''),parts:R.items.map(x=>x.name)};}
 return{slab,disc,finish};
}
export function instrument(kind,screenHTML,audit=false){
 const wide=kind==='otdr',W=wide?154:96,H=wide?105:142,D=23;
 const P=k.fitProjection(k.boxCorners({x:-2,y:-2,w:W+4,d:D+5},-2,H+32),240,230,{pad:12,azimuth:76,elevation:16});
 const s=scene(P,kind),F=(x,y,z,a)=>G.frameAlong([x,y,z],a);
 s.slab('rear-shell',0,0,W,D,0,H,'case',true);
 s.slab('front-panel',4,D,W-8,2,5,H-10,'front');
 const sx=wide?13:13,sw=wide?104:70,sz=wide?32:59,sh=wide?59:65;
 s.slab('display-bezel',sx-3,D+2,sw+6,1.5,sz-3,sh+6,'bezel');
 // The HTML display uses the same actual face projection, remains selectable,
 // and keeps the pre-existing readout id updated by the original lesson model.
 const display=`<g transform="${k.sideMatrix([sx,D+3.8],sz+sh,P,'left')}"><foreignObject width="${sw}" height="${sh}"><div xmlns="http://www.w3.org/1999/xhtml" class="oi-lcd-host">${screenHTML}</div></foreignObject></g>`;
 s.slab('display-glass',sx,D+3.5,sw,.3,sz,sh,'display',false,display);
 const keys=wide?[[134,28],[134,48],[134,68]]:[[24,27],[48,27],[72,27],[24,43],[48,43],[72,43]];
 keys.forEach(([x,z],i)=>s.disc('key-'+i,F(x,D+2,z,[0,1,0]),0,2,5.1,i===0?'teal':'button'));
 for(const [i,x,z]of[[0,9,11],[1,W-9,11],[2,9,H-11],[3,W-9,H-11]])s.disc('screw-'+i,F(x,D+2,z,[0,1,0]),0,.7,1.6,'metal');
 const portX=wide?36:W/2,portF=F(portX,D/2,H,[0,0,1]);
 s.disc('port-collar',portF,0,5,7.5);s.disc('optical-adapter',portF,5,12,5.3);
 s.disc('jumper-plug',portF,12,22,5.6,'plug');s.disc('strain-relief',portF,22,30,3.4,'fibre');
 const out=s.finish(audit);out.port=k.iso([portX,D/2,H+30],P);out.screen={x:sx,y:D+3.8,z:sz+sh,w:sw,h:sh};return out;
}
export function fibreCase(name,audit=false){
 const P=k.fitProjection(k.boxCorners({x:-16,y:0,w:132,d:100},0,17),170,135,{pad:10,azimuth:75,elevation:48}),s=scene(P,name);
 const Z=G.frameAlong([50,50,0],[0,0,1]);
 s.disc('base',Z,0,4,45,'case',true);s.disc('housing',Z,4,12,46,'front');s.disc('lid',Z,12,14,44,'case');s.disc('label-inlay',Z,14,14.3,29,'display');
 const l=G.frameAlong([4,50,8],[-1,0,0]),r=G.frameAlong([96,50,8],[1,0,0]);
 for(const [side,F]of[['left',l],['right',r]]){s.disc(side+'-port',F,0,7,3.3,'metal');s.disc(side+'-boot',F,7,15,2.5,'fibre');}
 const out=s.finish(audit);out.left=k.iso([-11,50,8],P);out.right=k.iso([111,50,8],P);return out;
}
