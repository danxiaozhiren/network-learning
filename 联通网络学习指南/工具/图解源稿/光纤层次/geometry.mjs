import * as k from '../光模块收发功能/vendor/anatomy/kit/iso-kit.mjs';
import * as G from '../光模块收发功能/vendor/anatomy/kit/lathe.mjs';
import * as A from '../光模块收发功能/vendor/anatomy/kit/audit.mjs';
import {stateOf} from './model.mjs';

// These are observation specimens, not dimensioned product models.
// Hidden axial spans are omitted; the audit sees the exact visible solids.
function scene(P){
  const R=A.recorder(P);
  function put(name,zone,paths,shape,frame,s0,s1){
    R.put({name,at:G.pointOf(frame,(s0+s1)/2,0,0),svg:`<g class="fl-material-${zone}" data-fl-zone="${zone}" data-fl-part="${name}">${k.solidSvg(paths,{tone:'hi'})}</g>`,shapes:[R.solid(shape)]});
  }
  function rod(name,zone,F,r,s0,s1,ground=false){
    put(name,zone,G.disc(s0,s1,r,F,P,{steps:64}),A.disc(F,s0,s1,r,{name,ground}),F,s0,s1);
  }
  function ring(name,zone,F,ri,ro,s0,s1,ground=false){
    put(name,zone,G.ringBand(s0,s1,ri,ro,F,P,{steps:64}),A.ring(F,s0,s1,ri,ro,{name,ground}),F,s0,s1);
  }
  function finish(audit,label){
    A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);
    if(audit){console.log(label);A.auditOrExit(R,P);}
    return {svg:R.items.map(x=>x.svg).join(''),parts:R.items.map(x=>x.name)};
  }
  return {R,rod,ring,finish};
}

export function cableGeometry(audit=false){
  const F=G.frameAlong([0,0,42],[1,0,0]);
  const P=k.fitProjection(k.boxCorners({x:-5,y:-34,w:310,d:68},7,77),350,270,{pad:23,azimuth:64,elevation:26});
  const s=scene(P);
  s.ring('cable-jacket','jacket',F,27,31,0,90,true);
  s.rod('central-strength','strength',F,9,90,224);
  let selected;
  for(let t=0;t<4;t++){
    const center=G.pointOf(F,0,18,t*Math.PI/2),frame=G.frameAlong(center,F.a);
    s.ring('tube-'+t,'tube',frame,7.2,9,90,155);
    for(let n=0;n<7;n++){
      const a=(n-1)*Math.PI/3-Math.PI/2,du=n?3.6*Math.cos(a):0,dv=(n?3.6*Math.sin(a):0)-1.8;
      const origin=G.add3(center,G.add3(G.mul3(frame.u,du),G.mul3(frame.v,dv)));
      const f=G.frameAlong(origin,F.a),isSelected=t===0&&n===0;
      s.rod('fiber-'+t+'-'+n,isSelected?'selected':'fiber',f,1.8,155,isSelected?290:224);
      if(isSelected)selected=k.iso(G.pointOf(f,278,1.8,Math.PI/2),P);
    }
  }
  const out=s.finish(audit,'cable context');
  out.svg+=`<g class="fl-leader"><path d="M${selected[0].toFixed(2)} ${selected[1].toFixed(2)} V225 H285"/><circle cx="${selected[0]}" cy="${selected[1]}" r="3"/><text x="285" y="247" text-anchor="middle">选中这一根</text></g>`;
  return out;
}

export function fiberGeometry(index,audit=false){
  const state=stateOf(index),F=G.frameAlong([0,0,37],[1,0,0]);
  const P=k.fitProjection(k.boxCorners({x:-5,y:-33,w:265,d:66},4,70),510,250,{pad:25,azimuth:68,elevation:24});
  const s=scene(P),[coat,clad]=state.ends;
  s.ring('coating','coating',F,20,32,0,coat,true);
  s.ring('cladding','cladding',F,7,20,coat,clad);
  s.rod('core','core',F,7,clad,252);
  const result=s.finish(audit,'fiber step '+index);
  // A fixed end-face view keeps all three nested layers visible in every step.
  // It is a separate view of this specimen, not an extra object along its axis.
  const face=`<g class="fl-endface" transform="translate(455 37)"><circle r="34" fill="#e1c984" stroke="#ac9561"/><circle r="21" fill="#d6e5ef" stroke="#8faec4"/><circle r="7" fill="#315e86"/><text y="53" text-anchor="middle">端面放大</text></g>`;
  return {...result,svg:result.svg+face};
}
