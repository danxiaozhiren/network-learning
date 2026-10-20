import{readFileSync,writeFileSync}from'node:fs';
import{dirname,resolve}from'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{instrument,fibreCase}from'./geometry.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),PAGE=resolve(ROOT,'传输网/传输网络光层测试.html'),audit=process.argv.includes('--audit');
const originals=Object.fromEntries(['loss','otdr'].map(k=>[k,readFileSync(resolve(HERE,'original-'+k+'.html'),'utf8')]));
const source=instrument('source','<div class="lcd">1550<span>nm · 测试波长</span></div>',audit);
const power=instrument('power','<div class="lcd" id="power-display">—<span>等待测量</span></div>',audit);
const otdr=instrument('otdr','<div class="mini-screen" id="otdr-screen">待测试</div>',audit);
const launch=fibreCase('launch',audit),tail=fibreCase('tail',audit);
if(process.exitCode)throw new Error('Geometry audit failed; lesson was not changed.');
const add=(a,b)=>a.map((n,i)=>+(n+b[i]).toFixed(2)),xy=p=>p.join(' ');
const sp=add(source.port,[10,60]),pp=add(power.port,[750,60]);
const defs=id=>`<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#315e86"/></marker></defs>`;
const wire=(d,extra='')=>`<path class="oi-wire" d="${d}" ${extra}/>`;
const node=(x,label,note)=>`<g class="oi-line-node"><rect x="${x-29}" y="78" width="58" height="27" rx="4"/><text x="${x}" y="97" text-anchor="middle">${label}</text><text class="oi-distance" x="${x}" y="124" text-anchor="middle">${note}</text></g>`;
const common=`M${xy(sp)} Q${sp[0]} 40 225 40`;
const ref=`M225 40 H${pp[0]-30} Q${pp[0]} 40 ${xy(pp)}`;
const l1=`M225 40 Q310 40 350 91`,l2='M379 91 H471 M529 91 H621',l3=`M650 91 Q${pp[0]} 40 ${xy(pp)}`;
const lossVisual=`<div class="measurement oi-measurement"><svg class="oi-world" id="oi-loss-visual" viewBox="0 0 1000 340" role="img" aria-label="光源输出口通过参考跳纤连接功率计输入口。">${defs('oi-loss')}
<g class="meter oi-meter oi-source" transform="translate(10 60)">${source.svg}<text class="oi-name" x="120" y="244" text-anchor="middle">稳定光源 · 输出口</text><text class="oi-place" id="source-place" x="120" y="264" text-anchor="middle">参考端</text></g>
<g class="meter oi-meter oi-power" transform="translate(750 60)">${power.svg}<text class="oi-name" x="120" y="244" text-anchor="middle">光功率计 · 输入口</text><text class="oi-place" id="meter-place" x="120" y="264" text-anchor="middle">与光源放在一起</text></g>
${wire(common)}<g class="oi-reference-route">${wire(ref)}<text class="oi-route-title" x="500" y="82" text-anchor="middle">一根参考跳纤</text><text class="oi-route-note" x="500" y="110" text-anchor="middle">先不接 A—B 线路</text><path class="oi-direction" d="M450 40 H520" marker-end="url(#oi-loss-arrow)"/></g>
<g class="oi-installed-route">${wire(l1)}${wire(l2)}${wire(l3)}${node(350,'A 连接','0 km')}${node(500,'C 熔接','8 km')}${node(650,'B 连接','20 km')}<text class="oi-route-note" x="285" y="25" text-anchor="middle">原参考跳纤</text><text class="oi-route-note" x="750" y="25" text-anchor="middle">接收跳纤</text><path class="oi-direction" d="M410 91 H450" marker-end="url(#oi-loss-arrow)"/><path class="oi-direction" d="M550 91 H590" marker-end="url(#oi-loss-arrow)"/><text class="oi-route-title" x="500" y="173" text-anchor="middle">被测线路 · 20 km</text><g class="oi-break-mark"><circle cx="561" cy="91" r="13" fill="#fff"/><path d="M554 83l14 16m0-16l-14 16"/><text x="561" y="65" text-anchor="middle">断纤 · 12 km</text></g></g>
<text class="oi-route-note" id="oi-loss-route-label" x="500" y="220" text-anchor="middle">光源输出口 → 参考跳纤 → 功率计输入口</text></svg></div>
<div class="test-path oi-loss-map"><span class="path-tag" id="loss-path-name">参考跳纤</span><div class="fiber-line off" id="loss-wire" hidden></div><div class="path-points" id="loss-path-points"><span>光源输出口</span><span>功率计输入口</span></div><p id="loss-path-note" class="small">先不接入 A—B 线路</p></div>`;
let loss=originals.loss;const la=loss.indexOf('<div class="measurement">'),lb=loss.indexOf('<div class="reading-grid">',la);loss=loss.slice(0,la)+lossVisual+loss.slice(lb);
const op=add(otdr.port,[0,35]),li=add(launch.left,[280,65]),lo=add(launch.right,[280,65]),ti=add(tail.left,[925,65]),to=add(tail.right,[925,65]);
const otdrVisual=`<div class="oi-otdr-map">OTDR 同口收发 ⇄ 引纤 ⇄ A—C—B ⇄ 尾纤</div><svg class="oi-world" id="oi-otdr-visual" data-ports='${JSON.stringify({op,li,lo,ti,to})}' viewBox="0 0 1120 295" role="img" aria-label="OTDR 接引纤，经过 A、C、B 被测线路后再接尾纤。">${defs('oi-otdr')}
<g class="oi-otdr-device" transform="translate(0 35)">${otdr.svg}<text class="oi-name" x="120" y="244" text-anchor="middle">OTDR · 同一测试口</text></g>
<g class="oi-launch-case" transform="translate(280 65)">${launch.svg}<text class="oi-name" x="85" y="158" text-anchor="middle">引纤 · 0.5 km</text></g>
<g class="oi-tail-case" transform="translate(925 65)">${tail.svg}<text class="oi-name" x="85" y="158" text-anchor="middle">尾纤 · 0.5 km</text></g>
${wire(`M${xy(op)} Q${op[0]} 55 220 90 T${xy(li)}`,'id="oi-otdr-in"')}${wire(`M${xy(lo)} Q470 ${lo[1]} 510 130 H870 Q900 130 ${xy(ti)}`,'id="oi-otdr-link"')}${wire(`M${xy(to)} h17`,'id="oi-otdr-end"')}<circle class="oi-terminal" cx="${to[0]+17}" cy="${to[1]}" r="3"/>
<g class="oi-otdr-nodes" transform="translate(0 39)"><g id="oi-otdr-a">${node(539,'A 端','0 km')}</g><g id="oi-otdr-c">${node(690,'C 熔接','8 km')}</g><g id="oi-otdr-b">${node(841,'B 端','20 km')}</g></g>
<text class="oi-route-title" id="oi-otdr-line-name" x="690" y="207" text-anchor="middle">被测线路</text><g class="oi-send"><path class="oi-direction" d="M${xy(op)} Q${op[0]} 55 220 90 T${xy(li)}" marker-end="url(#oi-otdr-arrow)"/><text class="oi-signal-label" x="240" y="62" text-anchor="middle">发出脉冲 →</text></g><g class="oi-return"><path class="oi-direction" d="M${xy(li)} Q${440-op[0]} 125 220 90 Q${op[0]} 55 ${xy(op)}" marker-end="url(#oi-otdr-arrow)"/><text class="oi-signal-label" x="240" y="62" text-anchor="middle">← 接收返回</text></g>
<g class="oi-break-mark"><circle cx="750" cy="130" r="13" fill="#fff"/><path d="M743 122l14 16m0-16l-14 16"/><text x="750" y="103" text-anchor="middle">12 km</text></g></svg><div class="trace-route oi-trace-caption"><div class="trace-line" hidden><i id="test-pulse" hidden></i></div><p class="pulse-label" id="pulse-caption">引纤 → A → C → B → 尾纤</p></div>`;
let ot=originals.otdr;const oa=ot.indexOf('<div class="trace-equipment">'),ob=ot.indexOf('<p class="position" id="otdr-position">',oa);ot=ot.slice(0,oa)+otdrVisual+ot.slice(ob);
function augment(fig,kind){
 const count=`<span class="count" id="${kind}-count">`;
 fig=fig.replace(count,`<button type="button" class="oi-view" id="oi-${kind}-view" aria-pressed="false" hidden>看完整接线</button>`+count);
 const controls='<div class="controls">';
 return fig.replace(controls,`<p class="oi-caption">仪器与收纤盒为外形示意，连线表示连接关系，不按实际长度比例。<a href="${kind==='loss'?'https://www.flukenetworks.com/edocs/wp-demystifying-fiber-test-methods-back-basics':'https://www.flukenetworks.com/knowledge-base/optifiber-pro/compensate-launch-and-tail-cords'}" target="_blank" rel="noopener">接线依据</a></p>`+controls);
}
let html=readFileSync(PAGE,'utf8');const block=(key,body)=>`<!-- oi-anatomy:${key}:start -->\n${body}\n<!-- oi-anatomy:${key}:end -->`;
function replace(key,body,old){const re=new RegExp('<!-- oi-anatomy:'+key+':start -->[\\s\\S]*?<!-- oi-anatomy:'+key+':end -->');if(re.test(html))html=html.replace(re,()=>block(key,body));else{if(!html.includes(old))throw new Error('Missing target '+key);html=html.replace(old,()=>key==='loss'||key==='otdr'?block(key,body):block(key,body)+'\n'+old);}}
replace('loss',augment(loss,'loss'),originals.loss);replace('otdr',augment(ot,'otdr'),originals.otdr);
replace('style','<style>\n'+readFileSync(resolve(HERE,'figure.css'),'utf8')+'\n</style>','</head>');
replace('script','<script>\n'+readFileSync(resolve(HERE,'runtime.js'),'utf8')+'\n</script>','</body>');
writeFileSync(PAGE,html);writeFileSync(resolve(HERE,'parts.json'),JSON.stringify({source:source.parts,power:power.parts,otdr:otdr.parts,launch:launch.parts,tail:tail.parts},null,2));
writeFileSync(resolve(HERE,'geometry.json'),JSON.stringify({ports:{source:sp,power:pp,otdr:op,launchIn:li,launchOut:lo,tailIn:ti,tailOut:to}},null,2));
const vendor=resolve(HERE,'../光模块收发功能/vendor/anatomy');writeFileSync(resolve(HERE,'依赖校验.json'),JSON.stringify(['LICENSE','SKILL.md','source-manifest.json','kit/iso-kit.mjs','kit/lathe.mjs','kit/audit.mjs','kit/tube.mjs'].map(p=>({path:'../光模块收发功能/vendor/anatomy/'+p,sha256:createHash('sha256').update(readFileSync(resolve(vendor,p))).digest('hex')})),null,2));
console.log(JSON.stringify({auditedAssemblies:5,parts:[source,power,otdr,launch,tail].reduce((n,g)=>n+g.parts.length,0),originalMeasurementScriptRetained:true,bytes:Buffer.byteLength(html)}));
