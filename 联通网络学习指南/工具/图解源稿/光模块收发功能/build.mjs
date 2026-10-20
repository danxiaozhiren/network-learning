import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from './vendor/anatomy/kit/iso-kit.mjs';
import * as G from './vendor/anatomy/kit/lathe.mjs';
import * as A from './vendor/anatomy/kit/audit.mjs';
import { steps } from './model.mjs';

// Figure: two transceiver cutaways. Physical proportions are illustrative.
// Blue = optical; teal = electrical. No automatic playback.
// The two opposite cameras show both optical ends facing the central fibre.
// Shapes are teaching schematics, not a specific manufacturer's dimensions.
const HERE = dirname(fileURLToPath(import.meta.url));
const partLists = [];
function transceiver(side, offset, azimuth) {
  const P = k.fitProjection(k.boxCorners({ x: -20, y: 0, w: 252, d: 86 }, 0, 30), 452, 226, { pad: 18, azimuth, elevation: 35 });
  const R = A.recorder(P);
  const at = p => k.iso(p, P).map((v, i) => v + offset[i]);
  const plan = (x, y, w, d, r = .8) => ({ x, y, w, d, r });
  function slab(name, shape, z, h, material = 'metal', zone = '', inner = '') {
    const paths = k.slabOf(shape, z, h, P, 6, Math.min(.6, h / 3));
    const svg = `<g class="ms-material-${material}" ${zone ? `data-ms-zone="${side}-${zone}"` : ''}>${k.solidSvg(paths, { tone: 'mid', inner })}</g>`;
    R.put({ name: side + '.' + name, at: [shape.x + shape.w / 2, shape.y + shape.d / 2, z + h / 2], svg,
      shapes: [R.solid(A.slab(shape, z, h, { name: side + '.' + name, owner: side + '.' + name, ground: name === 'tray' }))] });
  }
  function round(name, F, profile, material, zone) {
    R.put({ name: side + '.' + name, at: G.pointOf(F, (profile[0][0] + profile.at(-1)[0]) / 2, 0, 0),
      svg: `<g class="ms-material-${material}" data-ms-zone="${side}-${zone}">${k.solidSvg(G.solidOf(profile, F, P, { steps: 40 }), { tone: 'hi' })}</g>`,
      shapes: [R.solid(A.solid(F, profile, { name: side + '.' + name, owner: side + '.' + name }))] });
  }
  slab('tray', plan(0, 0, 228, 86, 2), 0, 4);
  slab('far-wall', plan(0, 0, 228, 2), 4, 12);
  slab('near-lip', plan(0, 84, 228, 2), 4, 3);
  slab('board', plan(8, 4, 198, 78), 4, 2, 'board');
  slab('edge-card', plan(-20, 4, 28, 78), 4, 2, 'board', 'interface');
  for (let i = 0; i < 8; i++) slab('gold-contact-' + i, plan(-18, 7 + i * 9.5, 21, 4.6, .2), 6, .25, 'gold', 'interface');
  const trace = (pts, color) => `<path d="${k.onTop(pts, 6.2, P)}" class="ms-copper-trace ${color}"/>`;
  slab('tx-driver', plan(89, 11, 31, 22, 1.2), 6, 7, 'chip', 'driver');
  slab('rx-amplifier', plan(89, 53, 31, 22, 1.2), 6, 7, 'chip', 'amplifier');
  slab('controller', plan(43, 33, 21, 20, 1), 6, 5, 'chip');
  for (const y of [15, 23, 31, 55, 63, 71]) slab('ic-contact-' + y, plan(85, y, 4, 1.1, .1), 6, 1, 'gold');
  for (const [i, x, y] of [[0, 29, 13], [1, 57, 13], [2, 73, 39], [3, 29, 67], [4, 57, 67], [5, 133, 39]]) {
    slab('passive-' + i, plan(x, y, 7, 4, .5), 6, 2, 'passive');
  }
  for (const y of [22, 64]) {
    const zone = y === 22 ? 'tx' : 'rx';
    // A barrel has a real collar at either end and rests on the PCB at z=6.
    round(zone + '-barrel', G.frameAlong([150, y, 14], [1, 0, 0]), [[0, 8], [5, 8], [5, 7], [49, 7], [49, 8], [56, 8]], 'barrel', zone === 'tx' ? 'emitter' : 'detector');
    slab(zone + '-socket', plan(206, y - 11, 22, 22, 1.2), 6, 20, 'socket', zone + '-port');
    round(zone + '-aperture', G.frameAlong([228, y, 16], [1, 0, 0]), [[0, 5], [.35, 5]], 'lens', zone + '-port');
  }
  for (const [i, x, y] of [[0, 14, 9], [1, 195, 9], [2, 14, 77], [3, 195, 77]]) {
    const paths = k.cylinder(x, y, 1.8, 6, .65, P, 24);
    const inner = k.lineSvg(k.lineOnTop([x - 1.3, y], [x + 1.3, y], 6.65, P), { tone: 'mid' });
    R.put({ name: side + '.screw-' + i, at: [x, y, 6.325], svg: k.solidSvg(paths, { inner }), shapes: [R.solid(A.cylinder(x, y, 1.8, 6, .65, { name: side + '.screw-' + i }))] });
  }
  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  if (process.argv.includes('--audit')) {
    console.log(side.toUpperCase() + ' module');
    A.auditOrExit(R, P);
  }
  partLists.push({ side, count: R.solids.length, parts: R.items.map(x => x.name) });
  const traces = [trace([[3, 20], [35, 20], [35, 22], [85, 22]], 'electrical'), trace([[120, 22], [150, 22]], 'electrical'), trace([[3, 65], [77, 65], [77, 64], [85, 64]], 'electrical'), trace([[120, 64], [150, 64]], 'electrical')].join('');
  // Copper traces lie on the PCB and are drawn before the supported parts.
  const boardIndex = R.items.findIndex(x => x.name === side + '.board');
  const sorted = R.items.map((item, i) => item.svg + (i === boardIndex ? traces : '')).join('');
  return { svg: `<g transform="translate(${offset.join(' ')})">${sorted}</g>`, at };
}
const left=transceiver('a',[25,80],76),right=transceiver('b',[643,80],-76);
const txA=left.at([228.5,22,16]),rxA=left.at([228.5,64,16]);
const txB=right.at([228.5,22,16]),rxB=right.at([228.5,64,16]);
const xy=p=>p.map(v=>+v.toFixed(2)).join(' ');
const forward=`M${xy(txA)} C${txA[0]+62} ${txA[1]},${rxB[0]-62} ${rxB[1]},${xy(rxB)}`;
const reverse=`M${xy(txB)} C${txB[0]-70} ${txB[1]+108},${rxA[0]+70} ${rxA[1]+108},${xy(rxA)}`;
function label(text,point,position,anchor='middle'){
  return `<g class="ms-annotation"><path d="M${xy(point)} L${point[0]} ${position[1]+9} L${position[0]} ${position[1]+9}"/><circle cx="${point[0]}" cy="${point[1]}" r="2"/><text x="${position[0]}" y="${position[1]}" text-anchor="${anchor}">${text}</text></g>`;
}
const drawing=`<svg class="ms-symbols" aria-hidden="true" width="0" height="0"><defs>
<marker id="ms-arrow-optical" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#315e86"/></marker>
<g id="ms-world">
${left.svg}${right.svg}
<path class="ms-fiber-jacket ms-return" d="${reverse}"/><path class="ms-fiber-core ms-return" d="${reverse}"/>
<g data-ms-zone="fiber"><path class="ms-fiber-jacket" d="${forward}"/><path class="ms-fiber-core" d="${forward}" marker-end="url(#ms-arrow-optical)"/></g>
<g class="ms-gap"><circle cx="${rxB[0]-15}" cy="${rxB[1]}" r="12" fill="#fff"/><path d="M${rxB[0]-21} ${rxB[1]-7}l12 14m0 -14l-12 14" fill="none" stroke="#b54d48" stroke-width="2.4"/></g>
<text class="ms-module-label" x="240" y="29" text-anchor="middle">A 端发送</text><text class="ms-module-label" x="880" y="29" text-anchor="middle">B 端接收</text>
<text class="ms-port-label" x="${txA[0]+8}" y="${txA[1]-13}">Tx</text><text class="ms-port-label" x="${rxA[0]-12}" y="${rxA[1]+42}" text-anchor="end">Rx</text>
<text class="ms-port-label" x="${rxB[0]-8}" y="${rxB[1]-13}" text-anchor="end">Rx</text><text class="ms-port-label" x="${txB[0]+12}" y="${txB[1]+42}">Tx</text>
${label('数据与驱动',left.at([104,22,13]),[234,63])}
${label('激光器与调制',left.at([175,22,22]),[407,61])}
${label('光电探测',right.at([175,64,22]),[722,61])}
${label('接收处理',right.at([104,64,13]),[916,63])}
${label('电接口',left.at([-8,40,6]),[73,337])}
${label('电接口',right.at([-8,40,6]),[1030,337])}
<g class="ms-annotation"><text x="560" y="347" text-anchor="middle">另一根纤：B → A</text></g>
</g></defs></svg>`;
const crop=(point,w,h)=>[+(point[0]-w/2).toFixed(2),+(point[1]-h/2).toFixed(2),w,h].join(' ');
const views=[
 crop(left.at([82,25,9]),250,170),crop(left.at([177,22,15]),207,143),crop(left.at([217,22,16]),190,140),
 crop([(txA[0]+rxB[0])/2,(txA[1]+rxB[1])/2],Math.abs(rxB[0]-txA[0])+135,170),
 crop(right.at([177,64,15]),207,143),crop(right.at([94,61,10]),235,160),crop(right.at([6,41,6]),185,150)
];
const lesson=join(HERE,'../../../传输网/光模块关键技术及应用.html');
let source=readFileSync(lesson,'utf8');
const start='<!-- ms-anatomy:figure:start -->',end='<!-- ms-anatomy:figure:end -->';
let original;
if(source.includes(start)){
  const saved=readFileSync(join(HERE,'original-figure.html'),'utf8');original=saved;
}else{
  const from=source.indexOf('<figure class="panel">',source.indexOf('id="inside"'));
  const to=source.indexOf('</figure>',from)+9;original=source.slice(from,to);
  if(!original.includes('数据与驱动电路')||!original.includes('光电探测器'))throw new Error('unexpected original figure');
  writeFileSync(join(HERE,'original-figure.html'),original);
  source=source.slice(0,from)+start+end+source.slice(to);
}
const originalFlow=original.slice(original.indexOf('<div class="flow-diagram">'),original.indexOf('<figcaption>'));
// Render both views from the same paths. Inline shapes keep scoped CSS reliable
// in standalone pages and srcdoc frames, without cross-SVG use shadow trees.
const world=drawing.slice(drawing.indexOf('<g id="ms-world">')+17,drawing.lastIndexOf('</g></defs>'));
const definitions=drawing.slice(0,drawing.indexOf('<g id="ms-world">'))+'</defs></svg>';
const html=readFileSync(join(HERE,'figure.template.html'),'utf8').replace('__DRAWING__',definitions).replaceAll('<use href="#ms-world"></use>',world).replace('__INITIAL_VIEW__',views[0]).replace('__ORIGINAL_FLOW__',originalFlow).replace('__OPTIONS__',steps.map((s,i)=>`<option value="${i}">${i+1} / ${steps.length}　${s.title}</option>`).join(''));
const css=readFileSync(join(HERE,'figure.css'),'utf8');
const script=readFileSync(join(HERE,'model.mjs'),'utf8').replace(/^export /gm,'')+'\n'+readFileSync(join(HERE,'runtime.js'),'utf8').replace('__VIEWS__',JSON.stringify(views));
const license=readFileSync(join(HERE,'vendor/anatomy/LICENSE'),'utf8');
source=source.replace(/<!-- ms-anatomy:figure:start -->[\s\S]*?<!-- ms-anatomy:figure:end -->/,start+'\n<!-- Anatomy (MIT): https://github.com/wheresryan22/anatomy\n'+license+'-->\n'+html+'\n'+end);
source=source.replace(/<!-- ms-anatomy:style:start -->[\s\S]*?<!-- ms-anatomy:style:end -->\n?/,'');
source=source.replace('</head>','<!-- ms-anatomy:style:start -->\n<style>\n'+css+'\n</style>\n<!-- ms-anatomy:style:end -->\n</head>');
source=source.replace(/<!-- ms-anatomy:script:start -->[\s\S]*?<!-- ms-anatomy:script:end -->\n?/,'');
source=source.replace('</body>','<!-- ms-anatomy:script:start -->\n<script>\n(()=>{\n'+script+'\n})();\n</script>\n<!-- ms-anatomy:script:end -->\n</body>');
if(process.exitCode)throw new Error('Geometry audit failed; lesson was not written');
writeFileSync(lesson,source);
writeFileSync(join(HERE,'parts.json'),JSON.stringify(partLists,null,2));
writeFileSync(join(HERE,'geometry.json'),JSON.stringify({views,ports:{txA,rxA,txB,rxB},forward,reverse},null,2));
console.log('Updated lesson · '+partLists.reduce((n,p)=>n+p.count,0)+' solids · seven manual steps');
