import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {cables} from './model.mjs';
import {cableGeometry} from './geometry.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),PAGE=resolve(ROOT,'传输网/光纤光缆技术发展及应用.html');
let html=readFileSync(PAGE,'utf8');const originalPath=resolve(HERE,'original-figure.html');
if(!existsSync(originalPath)){const section=html.indexOf('id="cable-structure"'),start=html.indexOf('<figure',section),end=html.indexOf('</figure>',start)+9;writeFileSync(originalPath,html.slice(start,end));}
const original=readFileSync(originalPath,'utf8');const parts={},frames=[];
for(const [type,cable] of Object.entries(cables))for(let i=0;i<cable.steps.length;i++){
 const g=cableGeometry(type,i,process.argv.includes('--audit'));parts[type]=g.parts;
 frames.push(`<g data-cs-frame="${type}-${i}"${type==='loose'&&i===0?'':' hidden'}>${g.svg}</g>`);
}
if(process.exitCode)throw new Error('Geometry audit failed; lesson was not changed.');
const first=cables.loose.steps[0];
const figure=`<figure class="panel" id="cs-figure" aria-label="三种光缆结构逐层观察" data-cs-cable="loose" data-cs-step="0">
<!-- Geometry built with Anatomy, MIT; editable source and dependency hashes in 工具/图解源稿/光缆结构. -->
<div class="figure-head"><b>三种常见外形</b><span>看结构，不靠颜色认型号 · 逐层观察</span></div>
<div class="cs-heading" id="cs-heading"><div><p id="cs-place">松套光缆 · 最外层</p><h3 id="cs-title">${first.title}</h3></div><div class="cs-heading-side"><span id="cs-count">1 / 4</span><button type="button" class="cs-view" id="cs-view" aria-pressed="false" hidden>看完整剖面</button></div></div>
<div class="cs-workspace" id="cs-workspace"><div class="cs-drawing"><svg id="cs-visual" viewBox="100 0 500 260" role="img" aria-label="松套光缆外护套与内部端面">${frames.join('')}</svg></div>
<div class="cs-explanation" aria-live="polite" aria-atomic="true"><p id="cs-copy">${first.say}</p><p id="cs-relation">${cables.loose.relation}</p></div>
<ul class="cs-legend" aria-label="部件颜色"><li data-cs-key="jacket" aria-current="true"><i></i>外护套</li><li data-cs-key="tube"><i></i>松套管</li><li data-cs-key="fiber"><i></i>光纤</li><li data-cs-key="strength"><i></i>加强件</li><li data-cs-key="armor" hidden><i></i>铠装</li></ul></div>
<details class="cs-reference"><summary>对照原来的三种外形图与说明</summary>${original}</details>
<figcaption class="cs-caption">剖面用于观察层次，不作为施工开剥步骤。芯数、颜色和比例为示意；省略绞合、阻水材料及光纤涂覆层细节。<br>结构依据：<a href="https://www.corning.com/catalog/coc/documents/application-engineering-notes/AEN026.pdf" target="_blank" rel="noopener">松套结构</a>、<a href="https://www.fiberhome.com/jrgl2/20221223/42611.html" target="_blank" rel="noopener">蝶形引入光缆</a>。带铠装的例子在松套缆芯外增加钢带防护。</figcaption>
<div class="cs-toolbar" aria-label="光缆结构图操作"><div class="cs-selects"><label><span class="sr-only">光缆种类</span><select id="cs-type" aria-label="选择光缆种类">${Object.entries(cables).map(([key,value])=>`<option value="${key}">${value.name}</option>`).join('')}</select></label><label><span class="sr-only">观察层次</span><select id="cs-step" aria-label="选择观察层次">${cables.loose.steps.map((s,i)=>`<option value="${i}">${i+1} / 4　${s.title}</option>`).join('')}</select></label></div><div class="cs-actions"><button type="button" class="button" id="cs-reset">重看此光缆</button><button type="button" class="button" id="cs-prev" disabled>上一步</button><button type="button" class="button primary" id="cs-next">下一步</button></div></div>
</figure>`;
const block=(key,body)=>`<!-- cs-anatomy:${key}:start -->\n${body}\n<!-- cs-anatomy:${key}:end -->`;
function replace(key,body,old){const re=new RegExp('<!-- cs-anatomy:'+key+':start -->[\\s\\S]*?<!-- cs-anatomy:'+key+':end -->');html=re.test(html)?html.replace(re,()=>block(key,body)):html.replace(old,()=>key==='figure'?block(key,body):block(key,body)+'\n'+old);}
replace('figure',figure,original);replace('style','<style>\n'+readFileSync(resolve(HERE,'figure.css'),'utf8')+'\n</style>','</head>');
const model=readFileSync(resolve(HERE,'model.mjs'),'utf8').replaceAll('export ','');replace('script','<script>\n(()=>{\n'+model+'\n'+readFileSync(resolve(HERE,'runtime.js'),'utf8')+'\n})();\n</script>','</body>');
writeFileSync(PAGE,html);writeFileSync(resolve(HERE,'parts.json'),JSON.stringify(parts,null,2));
const vendor=resolve(HERE,'../光模块收发功能/vendor/anatomy');const files=['LICENSE','SKILL.md','source-manifest.json','kit/iso-kit.mjs','kit/lathe.mjs','kit/audit.mjs'];writeFileSync(resolve(HERE,'依赖校验.json'),JSON.stringify(files.map(p=>({path:'../光模块收发功能/vendor/anatomy/'+p,sha256:createHash('sha256').update(readFileSync(resolve(vendor,p))).digest('hex')})),null,2));
console.log('Updated cable figure: '+Object.values(parts).flat().length+' components, '+frames.length+' manual states.');
