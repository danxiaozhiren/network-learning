import * as k from '../光模块收发功能/vendor/anatomy/kit/iso-kit.mjs';
import * as G from '../光模块收发功能/vendor/anatomy/kit/lathe.mjs';
import * as A from '../光模块收发功能/vendor/anatomy/kit/audit.mjs';

// A central longitudinal slice, extruded only to make material boundaries legible.
// This is NOT a full connector product model. All recorded prisms are the visible
// polygons, including the actual sloping/convex profile; no audit proxy boxes.
const F={o:[0,0,0],a:[0,-1,0],u:[1,0,0],v:[0,0,1]};
const radians=8*Math.PI/180;
export function endX(z,apc){return 214-z*Math.tan(apc?radians:0)-3*(z/18)**2;}
function strip(from,lo,hi,apc){
 const front=Array.from({length:33},(_,i)=>{const z=lo+(hi-lo)*i/32;return[endX(z,apc),z];});
 return [[from,lo],...front,[from,hi]];
}
export function connectorGeometry(apc,audit=false){
 const name=apc?'apc':'upc',P=k.fitProjection(k.boxCorners({x:0,y:-9,w:222,d:18},-26,30),400,145,{pad:20,azimuth:72,elevation:23});
 const R=A.recorder(P);
 function prism(id,material,poly,s0=-8,s1=8,ground=false){
  const shape=A.prism(F,poly,s0,s1,{name:name+'-'+id,ground});
  const paths=G.prismOf(F,poly,s0,s1,P);
  R.put({name:shape.name,at:[poly.reduce((n,p)=>n+p[0],0)/poly.length,0,poly.reduce((n,p)=>n+p[1],0)/poly.length],svg:`<g class="ef-material-${material}" data-ef-part="${id}">${k.solidSvg(paths)}</g>`,shapes:[R.solid(shape)]});
 }
 const box=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 // The shell is shown in section too. The ceramic and fibre continue inside it;
 // only exposed spans are drawn, so there are no buried coincident solids.
 prism('shell',name,box(0,78,-25,25),-8,8,true);
 prism('shell-lip',name,box(78,88,-22,22));
 prism('grip-back',name,box(12,24,25,29));
 prism('grip-front',name,box(47,59,25,29));
 prism('ferrule-lower','ceramic',strip(88,-18,-1.8,apc));
 prism('fibre','fibre',strip(88,-1.8,1.8,apc));
 prism('ferrule-upper','ceramic',strip(88,1.8,18,apc));
 A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);
 if(audit){console.log(name+' longitudinal slice');A.auditOrExit(R,P);}
 const point=(x,z)=>k.iso([x,8,z],P);
 const edge=k.pathOf(Array.from({length:49},(_,i)=>{const z=-18+i*.75;return point(endX(z,apc),z);}));
 const contact=point(214,0),shell=point(43,-25),fibre=point(133,0),ceramic=point(161,18);
 const leader=(p,x,y,text)=>`<g class="ef-leader"><path d="M${p[0]} ${p[1]} L${x} ${y-17}"/><circle cx="${p[0]}" cy="${p[1]}" r="2.3"/><text x="${x}" y="${y}" text-anchor="middle">${text}</text></g>`;
 return {parts:R.items.map(x=>x.name),svg:`<g class="ef-assembly">${R.items.map(x=>x.svg).join('')}<path class="ef-face-edge" d="${edge}"/>${leader(shell,65,143,'外壳')}${leader(fibre,218,143,'光纤')}${leader(ceramic,250,20,'插芯')}${leader(contact,350,143,'接触端面')}</g>`};
}

// Orthographic inset: both axes use the SAME scale. At the central contact,
// dx/dz = -tan(angle); the 8 degree label refers to this tangent vs vertical.
// Curvature is exaggerated; the tangent angle is not exaggerated.
export function sideView(apc){
 const cx=205,cy=63,scale=2.25;
 const end=z=>[cx+(endX(z,apc)-214)*scale,cy-z*scale];
 const front=Array.from({length:65},(_,i)=>end(-18+i*36/64));
 const path=k.pathOf([[80,cy+18*scale],...front,[80,cy-18*scale]],true);
 const t=18*scale*Math.tan(radians),normal=apc?`<path class="ef-tangent" d="M${cx-t} 22.5 L${cx+t} 103.5"/><path class="ef-angle" d="M205 30 A33 33 0 0 0 ${205-33*Math.sin(radians)} ${63-33*Math.cos(radians)}"/><path class="ef-leader-line" d="M202 31 L255 15 H280"/><text x="287" y="20" class="ef-angle-text">约 8°</text>`:`<path class="ef-leader-line" d="M205 43 L261 23 H290"/><text x="297" y="28" class="ef-angle-text">接近垂直</text>`;
 return `<g class="ef-inset"><text x="20" y="14" class="ef-inset-label">端面侧视</text><path class="ef-section" d="${path}"/><path class="ef-axis" d="M53 ${cy} H263"/><path class="ef-reference-line" d="M205 8 V115"/>${normal}<path class="ef-profile" d="${k.pathOf(front)}"/><text x="24" y="87" class="ef-axis-label">光纤轴线</text><text x="224" y="113" class="ef-axis-label">垂直基准</text></g>`;
}
