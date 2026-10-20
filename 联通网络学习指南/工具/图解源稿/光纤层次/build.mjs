import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {steps,layers} from './model.mjs';
import {cableGeometry,fiberGeometry} from './geometry.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..');
const PAGE=resolve(ROOT,'传输网/光模块及光纤光缆通识.html');
const audit=process.argv.includes('--audit'),original=readFileSync(resolve(HERE,'original-figure.html'),'utf8');
const cable=cableGeometry(audit),frames=[],parts={cable:cable.parts};
for(let i=0;i<steps.length;i++){
 const g=fiberGeometry(i,audit);parts['step-'+i]=g.parts;
 frames.push(`<g data-fl-frame="${i}"${i===0?'':' hidden'}>${g.svg}</g>`);
}
if(process.exitCode)throw new Error('Geometry audit failed; lesson was not changed.');
const first=steps[0];
const figure=`<figure class="panel" id="fl-figure" aria-label="从光缆到光纤内部层次的交互图" data-fl-step="0">
<!-- Anatomy MIT geometry; editable source: 工具/图解源稿/光纤层次; existing toolkit and license retained. -->
<div class="figure-head"><b>从光缆里，找到一根光纤</b><span>剖面示意 · 不按比例</span></div>
<div class="fl-heading" id="fl-heading"><h3 id="fl-title">${first.title}</h3><div class="fl-side"><span id="fl-count">1 / 5</span><button type="button" class="fl-view" id="fl-view" aria-pressed="false" hidden>看完整关系</button></div></div>
<div class="fl-map" aria-label="图中两种观察尺度"><span>光缆中的一根光纤</span><span aria-hidden="true">→</span><b>同一根，放大看内部</b></div>
<div class="fl-drawing"><svg id="fl-visual" viewBox="0 0 900 280" role="img" aria-label="从光缆选出一根光纤，放大后由外到内是涂覆层、包层和纤芯。"><g class="fl-cable-drawing">${cable.svg}</g><g class="fl-zoom-context" aria-hidden="true"><path class="fl-zoom-arrow" d="M330 115 H370 M363 109 L370 115 L363 121"/><text class="fl-zoom-label" x="350" y="140" text-anchor="middle">放大</text></g><g class="fl-fiber-drawing" transform="translate(380 8)">${frames.join('')}</g></svg></div>
<div class="fl-explanation" aria-live="polite" aria-atomic="true"><p id="fl-copy">${first.say}</p><p id="fl-relation">${first.relation}</p></div>
<ul class="fl-legend" aria-label="光纤由外到内的三层">${layers.map(l=>`<li data-fl-key="${l.key}"><i aria-hidden="true"></i>${l.name}</li>`).join('')}</ul>
<details class="fl-reference"><summary>对照原图和三层说明</summary>${original}</details>
<figcaption class="fl-caption">实际光缆可能有套管、加强件等不同结构；这里以松套结构举例。颜色和比例只帮助辨认层次；包层的图示截短用于观察纤芯，不代表实际剥纤过程。<br>结构依据：<a href="https://www.corning.com/worldwide/en/innovation/the-glass-age/science-of-glass/how-it-works-optical-fiber.html" target="_blank" rel="noopener">纤芯与包层</a>、<a href="https://www.corning.com/content/dam/corning/catalog/coc/documents/white-papers/WP3703.pdf" target="_blank" rel="noopener">光纤保护涂覆层</a>。</figcaption>
<div class="fl-toolbar" role="group" aria-label="光纤层次图操作"><label class="fl-select"><span class="sr-only">光纤观察步骤</span><select id="fl-step" aria-label="光纤观察步骤">${steps.map((s,i)=>`<option value="${i}">${i+1} / 5　${s.short}</option>`).join('')}</select></label><div class="fl-actions"><button type="button" class="button" id="fl-reset">从头重看</button><button type="button" class="button" id="fl-prev" disabled>上一步</button><button type="button" class="button primary" id="fl-next">下一步</button></div></div>
</figure>`;
let html=readFileSync(PAGE,'utf8');
const block=(key,body)=>`<!-- fl-anatomy:${key}:start -->\n${body}\n<!-- fl-anatomy:${key}:end -->`;
function replace(key,body,old){
 const re=new RegExp('<!-- fl-anatomy:'+key+':start -->[\\s\\S]*?<!-- fl-anatomy:'+key+':end -->');
 if(re.test(html))html=html.replace(re,()=>block(key,body));
 else {if(!html.includes(old))throw new Error('Missing target '+key);html=html.replace(old,()=>key==='figure'?block(key,body):block(key,body)+'\n'+old);}
}
replace('figure',figure,original);
replace('style','<style>\n'+readFileSync(resolve(HERE,'figure.css'),'utf8')+'\n</style>','</head>');
replace('script','<script>\n(()=>{\n'+readFileSync(resolve(HERE,'model.mjs'),'utf8').replaceAll('export ','')+'\n'+readFileSync(resolve(HERE,'runtime.js'),'utf8')+'\n})();\n</script>','</body>');
writeFileSync(PAGE,html);writeFileSync(resolve(HERE,'parts.json'),JSON.stringify(parts,null,2));
const vendor=resolve(HERE,'../光模块收发功能/vendor/anatomy');
writeFileSync(resolve(HERE,'依赖校验.json'),JSON.stringify(['LICENSE','SKILL.md','source-manifest.json','kit/iso-kit.mjs','kit/lathe.mjs','kit/audit.mjs'].map(p=>({path:'../光模块收发功能/vendor/anatomy/'+p,sha256:createHash('sha256').update(readFileSync(resolve(vendor,p))).digest('hex')})),null,2));
console.log(JSON.stringify({manualStates:steps.length,cableParts:cable.parts.length,fiberLayers:3,auditPassed:audit,bytes:Buffer.byteLength(html)}));
