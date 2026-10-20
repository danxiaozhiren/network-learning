// One state drives the highlighted part, signal, explanation and delivery result.
export const steps = [
  { title:'数据与驱动电路', place:'A 端发送 · 电接口之后', zone:'a-driver', kind:'electrical', copy:'把电信号整理为适合驱动光器件的信号', action:'电信号进入驱动电路', wave:'驱动电信号', note:'数据以电信号进入模块，先由驱动电路整理。' },
  { title:'激光器与调制', place:'A 端发送 · 发射组件', zone:'a-emitter', kind:'optical', copy:'产生光，并让光的强弱随数据变化', action:'电 → 光', wave:'光强随时间变化', note:'本图用较强、较弱的光表示 1、0；仍是同一组数据。' },
  { title:'发送光口', place:'A 端发送 · Tx 接口', zone:'a-tx-port', kind:'optical', copy:'把携带数据的光送进光纤', action:'光从 Tx 进入光纤', wave:'发送光口的光信号', note:'光口把发射组件与外部光纤接起来，这里不再次转换信号形式。' },
  { title:'经过光纤，到达 B 端', place:'光纤 · A 的 Tx → B 的 Rx', zone:'fiber', kind:'optical', copy:'这一方向从 A 的发送口 Tx，连接到 B 的接收口 Rx。', action:'光沿这根纤传送', wave:'到达 B 的光信号', note:'另一根光纤供反方向使用；本次沿 A → B 追踪。' },
  { title:'光电探测器', place:'B 端接收 · Rx 接口之后', zone:'b-detector', kind:'electrical', copy:'把收到的光转换为微弱电流', action:'光 → 微弱电流', wave:'探测后的微弱电流', note:'这里先得到随光强变化的电流，还没有完成后面的数据判读。' },
  { title:'接收处理电路', place:'B 端接收 · 探测器之后', zone:'b-amplifier', kind:'electrical', copy:'放大、处理波形，再判断数据', action:'处理电信号并判读', wave:'判读后的电信号', note:'在信号满足接收条件时，接收电路按相同规则恢复数据。' },
  { title:'交回设备', place:'B 端接收 · 电接口', zone:'b-interface', kind:'electrical', copy:'输出恢复后的电信号', action:'把数据交回 B 设备', wave:'输出电信号', note:'对照两端数据：承载形式经历电 → 光 → 电，数据内容保持对应。' }
];

export function derive(step, bits, connected) {
  if(!Number.isInteger(step)||step<0||step>=steps.length) throw new RangeError('step');
  if(!/^[01]{8}$/.test(bits)) throw new TypeError('eight binary bits required');
  const blocked=!connected&&step>=3;
  return { ...steps[step],step,bits,connected,blocked,
    waveBits:blocked?null:bits,
    output:step===6&&connected?bits:null,
    result:blocked?'B 未收到这段光，不能读回数据':step===6?'B 已读回 '+bits:'B 尚未交付这组数据',
    stateNote:blocked?'A 仍可发光；光纤在 B 的 Rx 前断开，后续探测、判读和交付均不能完成。接回后再对照。':steps[step].note,
    weak:step===4&&!blocked
  };
}
