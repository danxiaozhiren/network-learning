import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {steps} from './model.mjs';
import {connectorGeometry,sideView} from './geometry.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..');
const PAGE=resolve(ROOT,'传输网/光模块及光纤光缆通识.html');
const audit=process.argv.includes('--audit'),original=readFileSync(resolve(HERE,'original-figure.html'),'utf8');
const upc=connectorGeometry(false,audit),apc=connectorGeometry(true,audit);
if(process.exitCode)throw new Error('Geometry audit failed; lesson was not changed.');
function panel(apcMode,g){
 const name=apcMode?'APC':'UPC',key=name.toLowerCase();
 return `<g class="ef-panel-${key}" transform="translate(${apcMode?450:0} 0)"><rect class="ef-panel-bg" x="8" y="5" width="414" height="318" rx="6"/><text class="ef-panel-title" x="25" y="31">${name}</text><text class="ef-panel-subtitle" x="82" y="30">常见${apcMode?'绿':'蓝'}色标识</text><g transform="translate(15 42)">${g.svg}</g><path class="ef-separator" d="M25 197 H405"/><g transform="translate(15 202)">${sideView(apcMode)}</g></g>`;
}
const first=steps[0];
const figure=`<figure class="panel" id="ef-figure" aria-label="UPC 与 APC 接触端面对比交互图" data-ef-step="0">
<!-- Anatomy MIT geometry; editable source: 工具/图解源稿/UPC_APC端面对比; existing toolkit and license retained. -->
<div class="figure-head"><b>LC / SC 看外壳，UPC / APC 看端面</b><span>纵剖面与侧视示意 · 不按比例</span></div>
<div class="ef-heading" id="ef-heading"><h3 id="ef-title">${first.title}</h3><div class="ef-side"><span id="ef-count">1 / 4</span><button type="button" class="ef-view" id="ef-view" aria-pressed="false" hidden>看双图对比</button></div></div>
<div class="ef-drawing"><svg id="ef-visual" viewBox="0 0 880 330" role="img" aria-label="UPC 与 APC 的接头纵剖面对比。两图的光纤轴线相同，UPC 微凸且接近垂直，APC 微凸且端面倾斜约 8 度。">${panel(false,upc)}${panel(true,apc)}</svg></div>
<div class="ef-explanation" aria-live="polite" aria-atomic="true"><p id="ef-copy">${first.say}</p><p id="ef-relation">${first.relation}</p></div>
<p class="ef-note">沿光纤轴线取纵剖面观察；外壳仅作位置示意。曲率、光纤粗细和剖片厚度已夸张。</p>
<details class="ef-reference"><summary>对照原端面图与说明</summary>${original}</details>
<figcaption class="ef-caption">外壳颜色不能代替规格核对；图中蓝色细带均表示光纤。几何依据：<a href="https://www.corning.com/content/dam/corning/catalog/coc/documents/brochures/EVO-787-EN.pdf#page=42" target="_blank" rel="noopener">Corning 端面说明（第 41 页）</a>；<a href="https://www.advantech.com/en-eu/support/details/faq?id=1-HIIV-786" target="_blank" rel="noopener">端面匹配说明</a>。</figcaption>
<div class="ef-toolbar" role="group" aria-label="端面对比图操作"><label class="ef-select"><span class="sr-only">端面观察步骤</span><select id="ef-step" aria-label="端面观察步骤">${steps.map((s,i)=>`<option value="${i}">${i+1} / 4　${s.short}</option>`).join('')}</select></label><div class="ef-actions"><button type="button" class="button" id="ef-reset">从头重看</button><button type="button" class="button" id="ef-prev" disabled>上一步</button><button type="button" class="button primary" id="ef-next">下一步</button></div></div>
</figure>`;
let html=readFileSync(PAGE,'utf8');
const block=(key,body)=>`<!-- ef-anatomy:${key}:start -->\n${body}\n<!-- ef-anatomy:${key}:end -->`;
function replace(key,body,old){
 const re=new RegExp('<!-- ef-anatomy:'+key+':start -->[\\s\\S]*?<!-- ef-anatomy:'+key+':end -->');
 if(re.test(html))html=html.replace(re,()=>block(key,body));
 else{if(!html.includes(old))throw new Error('Missing target '+key);html=html.replace(old,()=>key==='figure'?block(key,body):block(key,body)+'\n'+old);}
}
replace('figure',figure,original);
replace('style','<style>\n'+readFileSync(resolve(HERE,'figure.css'),'utf8')+'\n</style>','</head>');
replace('script','<script>\n(()=>{\n'+readFileSync(resolve(HERE,'model.mjs'),'utf8').replaceAll('export ','')+'\n'+readFileSync(resolve(HERE,'runtime.js'),'utf8')+'\n})();\n</script>','</body>');
writeFileSync(PAGE,html);writeFileSync(resolve(HERE,'parts.json'),JSON.stringify({upc:upc.parts,apc:apc.parts},null,2));
const vendor=resolve(HERE,'../光模块收发功能/vendor/anatomy');
writeFileSync(resolve(HERE,'依赖校验.json'),JSON.stringify(['LICENSE','SKILL.md','source-manifest.json','kit/iso-kit.mjs','kit/lathe.mjs','kit/audit.mjs','kit/tube.mjs'].map(p=>({path:'../光模块收发功能/vendor/anatomy/'+p,sha256:createHash('sha256').update(readFileSync(resolve(vendor,p))).digest('hex')})),null,2));
console.log(JSON.stringify({manualStates:steps.length,auditedAssemblies:2,partsPerAssembly:upc.parts.length,auditPassed:audit,bytes:Buffer.byteLength(html)}));
