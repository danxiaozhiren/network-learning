export const layers = [
  {name:'涂覆层',key:'coating',role:'包在玻璃外面，保护光纤。'},
  {name:'包层',key:'cladding',role:'围住纤芯，帮助把光限制在导光结构中。'},
  {name:'纤芯',key:'core',role:'位于光纤中心，是导光结构的核心。'}
];
export const steps = [
  {short:'找到一根光纤',title:'从光缆里找到一根光纤',zone:'selected',ends:[250,251],
   say:'外护套里面有保护结构和多根光纤。这里从一根松套管中选出蓝色细丝，再放大观察这同一根光纤。',
   relation:'光缆 → 松套管 → 其中一根光纤',view:'cable'},
  {short:'放大整根光纤',title:'一根光纤，也有内外层次',zone:'all',ends:[250,251],
   say:'放大末端：最外侧是涂覆层，里面是包层，正中心是纤芯。三层围绕同一条中心轴；光纤不是一根空心管。',
   relation:'由外到内：涂覆层 → 包层 → 纤芯',view:'fiber'},
  {short:'看外部涂覆层',title:'涂覆层在玻璃外，负责保护',zone:'coating',ends:[120,251],
   say:'把涂覆层画短一段，露出里面的玻璃。涂覆层包在玻璃外面，保护光纤；光缆的外护套则保护整组内部组件。',
   relation:'涂覆层保护一根光纤，外护套保护整根光缆',view:'fiber'},
  {short:'看玻璃包层',title:'包层围住纤芯，共同形成导光结构',zone:'cladding',ends:[95,180],
   say:'再用剖视露出中心：浅蓝色的包层围住纤芯，帮助把光限制在导光结构中。纤芯与包层都是玻璃，这里的分段只为看清位置。',
   relation:'包层属于玻璃导光结构，不是外面的保护涂层',view:'fiber'},
  {short:'看中心纤芯',title:'看纤芯，对照三层职责',zone:'core',ends:[95,180],
   say:'深蓝色的纤芯位于光纤中心，是导光结构的核心。它与周围的包层配合传光；最外面的涂覆层保护这根玻璃光纤。',
   relation:'中心纤芯 + 周围包层：导光；外部涂覆层：保护',view:'fiber'}
];
export function stateOf(index){
  if(!Number.isInteger(index)||index<0||index>=steps.length)throw new RangeError('Invalid fiber-layer step');
  return {...steps[index],index,count:steps.length};
}
