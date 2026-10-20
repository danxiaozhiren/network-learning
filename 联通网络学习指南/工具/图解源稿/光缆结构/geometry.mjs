import * as k from '../光模块收发功能/vendor/anatomy/kit/iso-kit.mjs';
import * as G from '../光模块收发功能/vendor/anatomy/kit/lathe.mjs';
import * as A from '../光模块收发功能/vendor/anatomy/kit/audit.mjs';
import { cables } from './model.mjs';
const F=G.frameAlong([0,0,42],[1,0,0]);
const P=k.fitProjection(k.boxCorners({x:-8,y:-37,w:278,d:74},4,80),720,290,{pad:28,azimuth:64,elevation:26});
const at=p=>k.iso(p,P);
const xy=p=>p.map(v=>+v.toFixed(2)).join(' ');
export function cableGeometry(type,index,audit=false){
  const step=cables[type].steps[index],R=A.recorder(P),coords={};
  // Draw only exposed axial spans. Buried material is fully occluded and omitted.
  // Each audited solid is the complete visible part, including the cut face.
  function put(name,zone,paths,shape,frame,s0,s1){
    R.put({name,at:G.pointOf(frame,(s0+s1)/2,0,0),svg:`<g class="cs-material-${zone}" data-cs-zone="${zone}">${k.solidSvg(paths,{tone:'hi'})}</g>`,shapes:[R.solid(shape)]});
  }
  function rod(name,zone,frame,r,end,ground=false,start=0){
    put(name,zone,G.disc(start,end,r,frame,P,{steps:48}),A.disc(frame,start,end,r,{name,ground}),frame,start,end);
  }
  function ring(name,zone,frame,ri,ro,end,ground=false,start=0){
    put(name,zone,G.ringBand(start,end,ri,ro,frame,P,{steps:64}),A.ring(frame,start,end,ri,ro,{name,ground}),frame,start,end);
  }
  const [jacketEnd,tubeEnd,armorEnd]=step.ends;
  if(type==='bow'){
    const poly=[[-31,-11],[-9,-11],[0,-5],[9,-11],[31,-11],[31,11],[9,11],[0,5],[-9,11],[-31,11]];
    const frames=[-20,0,20].map(u=>G.frameAlong(G.add3(F.o,G.mul3(F.u,u)),F.a));
    const radii=[3.5,2,3.5];
    const paths=G.prismOf(F,poly,0,jacketEnd,P);
    // Keep the real concave bow outline, rather than the convex hull fill.
    paths.fill=paths.shades.join('')+paths.top;
    paths.outline=k.pathOf(poly.map(([u,v])=>at(G.add3(G.pointOf(F,jacketEnd,0,0),G.add3(G.mul3(F.u,u),G.mul3(F.v,v))))),true);
    const shape=A.prism(F,poly,0,jacketEnd,{name:'bow-jacket',ground:true,cut:frames.map((f,i)=>A.disc(f,-1,jacketEnd+1,radii[i]))});
    put('bow-jacket','jacket',paths,shape,F,0,jacketEnd);
    frames.forEach((f,i)=>rod(i===1?'central-fiber':'strength-'+i,i===1?'fiber':'strength',f,radii[i],262,false,jacketEnd));
    coords.jacket=G.pointOf(F,jacketEnd-34,8,Math.PI/2);
    coords.strength=G.pointOf(frames[2],230,3.5,Math.PI/2);
    coords.fiber=G.pointOf(frames[1],240,2,Math.PI/2);
  }else{
    ring('outer-jacket','jacket',F,type==='armored'?29:27,type==='armored'?33:31,jacketEnd,true);
    if(type==='armored'){
      // A continuous profiled annulus: corrugations are real section changes.
      const radius=s=>{const t=(s+1)%9;return t<2.5?29:t<4.5?29-(t-2.5)/2:t<6.5?28:28+(t-6.5)/2.5;};
      for(const [s0,s1] of [[jacketEnd,armorEnd+.5]]){
        const profile=[[s0,27],[s0,radius(s0)]];
        for(let s=Math.floor((s0+1)/9)*9-1;s<s1;s+=9)for(const n of [2.5,4.5,6.5,9])if(s+n>s0&&s+n<s1)profile.push([s+n,radius(s+n)]);
        profile.push([s1,radius(s1)],[s1,27],[s0,27]);
        put('corrugated-steel@'+s0,'armor',G.lathe(profile,F,P,{steps:64}),A.body(F,profile,{name:'corrugated-steel@'+s0,owner:'corrugated-steel'}),F,s0,s1);
      }
      coords.armor=G.pointOf(F,Math.max(jacketEnd+16,armorEnd-35),29,Math.PI/2);
    }
    const tubeStart=type==='armored'?armorEnd+.5:jacketEnd;
    rod('central-strength','strength',F,9,262,false,tubeStart);
    for(let t=0;t<4;t++){
      const theta=t*Math.PI/2,center=G.pointOf(F,0,18,theta),f=G.frameAlong(center,F.a);
      ring('loose-tube-'+t,'tube',f,7.2,9,tubeEnd+1,false,tubeStart);
      for(let n=0;n<7;n++){
        const a=(n-1)*Math.PI/3-Math.PI/2,du=n?3.6*Math.cos(a):0,dv=(n?3.6*Math.sin(a):0)-1.8;
        const origin=G.add3(center,G.add3(G.mul3(f.u,du),G.mul3(f.v,dv)));
        rod('fiber-'+t+'-'+n,'fiber',G.frameAlong(origin,F.a),1.8,262,false,tubeEnd+1);
      }
      if(t===1){coords.tube=G.pointOf(f,tubeEnd-30,9,Math.PI/2);coords.fiber=G.pointOf(f,247,3,Math.PI/2);}
    }
    coords.jacket=G.pointOf(F,jacketEnd-40,type==='armored'?33:31,Math.PI/2);
    coords.strength=G.pointOf(F,245,9,0);
  }
  A.settle(R,P);
  R.items.sort((a,b)=>a.key-b.key);
  if(audit){console.log(type+' / '+index);A.auditOrExit(R,P);}
  const target=at(coords[step.zone]),captionY=32,elbowY=50;
  const caption={jacket:'外护套',armor:'钢带铠装',tube:'松套管',fiber:'光纤',strength:type==='bow'?'两侧加强件':'中心加强件'}[step.zone];
  const callout=`<g class="cs-callout"><path d="M${xy(target)} L${target[0]} ${elbowY} H360"/><circle cx="${target[0]}" cy="${target[1]}" r="3"/><text x="360" y="${captionY}" text-anchor="middle">${caption}</text></g>`;
  return {svg:R.items.map(i=>i.svg).join('')+callout,parts:[...new Set(R.items.map(i=>i.name.split('@')[0]))],count:R.solids.length};
}
