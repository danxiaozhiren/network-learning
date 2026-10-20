export const steps=[
 {short:'找到接触端面',title:'先找端面：它在接头最前面',focus:'upc',zone:'face',say:'外壳决定接入哪种接口；里面的插芯固定光纤，最前面的研磨面才是这里比较的端面。',relation:'LC / SC 看外形，UPC / APC 看端面。'},
 {short:'看 UPC 微曲面',title:'UPC：接触处接近垂直',focus:'upc',zone:'upc',say:'UPC 实际是略微凸起的曲面，接触处接近垂直于光纤轴线，并不是完全平面。',relation:'蓝色是常见辅助标识，具体以产品标注为准。'},
 {short:'看 APC 约 8° 倾角',title:'APC：端面带约 8° 倾角',focus:'apc',zone:'apc',say:'APC 也有微曲率；接触处相对垂直于光纤轴线的基准方向倾斜约 8°，用于减少返回的反射光。',relation:'倾斜的是端面，光纤轴线仍沿插芯延伸。'},
 {short:'核对端面匹配',title:'连接前，核对两端的研磨类型',focus:'apc',zone:'match',say:'APC 两端的斜面需要匹配。UPC 与 APC 端面不要直接对接，不能只凭外壳能插入就判断可用。',relation:'同一种外形也可以有不同端面，例如 LC/UPC 和 LC/APC。'}
];
export const stateOf=i=>({...steps[Math.max(0,Math.min(steps.length-1,Number(i)||0))],count:steps.length});
