export const cables = {
  loose: { name:'松套光缆', relation:'外护套包住松套管，管内是光纤；加强件位于中心。', steps:[
    {title:'先看外护套',zone:'jacket',say:'最外面的护套保护内部组件，抵挡使用环境带来的影响。端面露出的细管，属于里面的保护结构。',where:'最外层',ends:[260,260,260]},
    {title:'看保护管与加强件',zone:'tube',say:'揭开一段护套，能看到多根松套管围在中心加强件周围。加强件承担拉力，光纤受到管和护套的保护。',where:'护套里面',ends:[105,260,260]},
    {title:'打开一段松套管',zone:'fiber',say:'管内的光纤比管腔细，留有活动余量。图中把光纤画直以看清位置，实际成缆还有长度余量。',where:'保护管里面',ends:[105,175,260]},
    {title:'分清传光与承力',zone:'strength',say:'蓝色细丝表示光纤，负责传光；中心加强件负责承力。外护套、松套管和加强件一起保护光纤。',where:'沿原位置对照',ends:[105,175,260]}
  ]},
  bow: { name:'蝶形引入光缆',relation:'扁平护套中间放光纤，两侧放加强件。',steps:[
    {title:'先看蝶形护套',zone:'jacket',say:'截面扁平，中部有便于分离的结构。护套把中间的光纤和两侧加强件包在一起。',where:'最外层',ends:[260,0,260]},
    {title:'露出两侧加强件',zone:'strength',say:'揭开一段护套，两根加强件仍在光纤两侧。它们承担外力，保护中间较细的光纤。',where:'光纤两侧',ends:[105,0,260]},
    {title:'找到中间的光纤',zone:'fiber',say:'中间的光纤负责传光，小巧的结构便于引入用户室内。图中不含架空自承吊线，室内型不能直接拿去跨杆悬挂。',where:'两根加强件之间',ends:[105,0,260]}
  ]},
  armored: { name:'带铠装的光缆',relation:'外护套下增加铠装层，里面仍可采用松套结构。',steps:[
    {title:'先看外护套',zone:'jacket',say:'从外面看仍有一层护套。有没有铠装，需要看内部结构和产品说明，不能只凭外观颜色判断。',where:'最外层',ends:[260,260,260]},
    {title:'露出钢带铠装',zone:'armor',say:'护套下面的波纹钢带包在缆芯外，增强抗挤压等机械保护。图中画出波纹起伏，外护套仍负责环境保护。',where:'护套与缆芯之间',ends:[90,260,260]},
    {title:'看铠装里面',zone:'tube',say:'再揭开一段铠装，能看到松套管与中心加强件。铠装是一种附加防护，可以和松套结构组合。',where:'铠装里面',ends:[90,260,150]},
    {title:'打开松套管',zone:'fiber',say:'光纤仍放在保护管内。增加铠装改变的是外部机械防护，不会自动提高每根光纤的传输速率。',where:'保护管里面',ends:[90,205,150]},
    {title:'沿层次重新对照',zone:'strength',say:'从光纤向外依次看松套管、铠装和护套，中心加强件承担拉力。是否适合直埋，还需核对阻水和实际环境。',where:'沿原位置对照',ends:[90,205,150]}
  ]}
};
export function stateOf(type,index){
  if(!cables[type])throw new Error('Unknown cable');
  const cable=cables[type];
  if(!Number.isInteger(index)||index<0||index>=cable.steps.length)throw new Error('Invalid cable step');
  return {...cable.steps[index],name:cable.name,relation:cable.relation,index,count:cable.steps.length};
}
