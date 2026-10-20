# 第 2 A 课：VLAN 与 Trunk——从隔离到跨交换机互通

## 课程信息
- **课程系列**：HCNA 网络基础系列（加速版）
- **课程说明**：本课合并原第 2 课（VLAN——分割广播域）和第 3 课（Trunk 与 Hybrid），覆盖单交换机 VLAN 隔离与跨交换机 VLAN 互通
- **授课对象**：运营商网络建设、维护、优化一线人员
- **授课时长**：约 90 分钟（紧凑型，含实验演示）
- **前置知识**：已完成“第 1 课：从集线器到交换机——构建二层网络”，理解交换机 MAC 地址表与转发原理
- **实验环境**：华为 eNSP 模拟器（需两台 S 5700 交换机，三台 PC）

## 教学目标
1. 理解 VLAN 的核心作用：隔离广播域、提升安全性，掌握 Access 端口打标/去标动作
2. 理解 Trunk 端口的作用：一根链路承载多个 VLAN，实现跨交换机 VLAN 互通
3. 掌握 802.1 Q 标签、PVID 在不同端口类型中的行为差异
4. 能够独立完成单交换机 VLAN 隔离 + 跨交换机 Trunk 互通的完整配置
5. 了解 Hybrid 端口的灵活性与现网 VLAN 典型应用

---

## 1. 开场：从一台交换机到多台交换机（5 分钟）

**回顾第 1 课**：
我们的一台交换机连接了两台 PC，同网段互通完美。但所有 PC 都在同一个广播域，一个广播所有端口都泛洪，毫无隐私和隔离。

**引入问题**：
- 财务部和工程部接在同一台交换机，如何让他们不能互相访问？
- 两个部门各在两层楼，有两台交换机，同部门的人如何跨交换机互通？
- 运营商一根光纤如何同时承载宽带、语音、IPTV 多种业务，互不干扰？

**答案：先用 VLAN 隔开，再用 Trunk 打通。**

---

## 2. VLAN：虚拟局域网（20 分钟）

### 2.1 VLAN 是什么？
- 把一台物理交换机**逻辑上**分成多个互相隔离的虚拟交换机。
- 同一 VLAN 内二层互通，不同 VLAN 之间二层**完全隔离**，必须经过三层路由才能通信。

### 2.2 为什么需要 VLAN？
1. **隔离广播域**：广播被限制在本 VLAN 内，不会全网泛滥。
2. **增强安全**：不同部门/业务天然隔离，无法直接监听。
3. **灵活组网**：同一交换机可同时存在多个 VLAN，PC 换端口改 VLAN 即可换网络。

### 2.3 802.1 Q 标签
在以太网帧源 MAC 和类型字段之间插入 4 字节标签，包含**12 位 VLAN ID**（1~4094）。
- 原始帧：`目的MAC | 源MAC | 类型 | 数据 | FCS`
- 带标签帧：`目的MAC | 源MAC | 0x8100 | VLAN ID | 类型 | 数据 | FCS`

### 2.4 Access 端口——连接终端

| 动作 | 行为 |
|------|------|
| **入方向（收帧）** | 收到普通帧 → 打上 PVID 对应的 VLAN 标签 |
| **出方向（发帧）** | 剥掉 VLAN 标签，变成普通帧发出去 |

**口诀**：Access 进打标签，出去剥。只属于一个 VLAN。

**现网场景**：楼道 ONU 一个口接宽带（VLAN 10），一个口接电话（VLAN 20），互不干扰。

### 2.5 实验一：单交换机 VLAN 隔离
**拓扑**：PC 1---(E 0/0/1)---[SW 1]---(E 0/0/2)---PC 2，同网段 192.168.1.0/24。

**配置**：
```system-view
[SW1] vlan batch 10 20
[SW1] interface Ethernet0/0/1
[SW1-Ethernet0/0/1] port link-type access
[SW1-Ethernet0/0/1] port default vlan 10
[SW1] interface Ethernet0/0/2
[SW1-Ethernet0/0/2] port link-type access
[SW1-Ethernet0/0/2] port default vlan 20
```
**验证**：PC 1（VLAN 10）Ping PC 2（VLAN 20）不通。同网段但不同 VLAN = 二层隔离。交换机上 `display port vlan` 确认端口 VLAN 归属。

---

## 3. Trunk：打通跨交换机的 VLAN（25 分钟）

### 3.1 Access 口互联的困境
两台交换机各下挂 VLAN 10 和 VLAN 20 的 PC。如果用 Access 口互联，一根线只能承载一个 VLAN。VLAN 越多，需要 N 根线，浪费端口。

**Trunk 解决**：一根物理链路承载多个 VLAN 的流量，帧带着标签走。

### 3.2 Trunk 端口的标签动作

| 端口类型 | 入方向 | 出方向 |
|----------|--------|--------|
| **Access** | 打上 PVID 标签 | 剥掉标签 |
| **Trunk** | 有标签保留，无标签打 PVID | VLAN=PVID 且去标签→剥掉；其余**保留标签** |

**PVID 在 Trunk 中的作用**：处理无标签帧。两端 Trunk 口 PVID 需一致，否则无标签帧会走错 VLAN。最佳实践：PVID 设为单独的管理 VLAN。

### 3.3 Trunk 允许列表
华为 Trunk 口默认只允许 VLAN 1 通过，其他 VLAN 需手动加入。
```system-view
[SW1-Ethernet0/0/3] port trunk allow-pass vlan 10 20
```
**常见故障**：忘记加 VLAN 到允许列表→该 VLAN 被静默阻断。

### 3.4 实验二：Trunk 打通跨交换机 VLAN

**拓扑**：
```
[PC1]--(E0/0/1,VLAN10)--[SW1]--(E0/0/3,Trunk)--[SW2]--(E0/0/1,VLAN10)--[PC3]
[PC2]--(E0/0/2,VLAN20)--[SW1]                   [SW2]--(E0/0/2,VLAN20)--[PC4]
```
PC 1/PC 3：VLAN 10, 192.168.1.1/3；PC 2/PC 4：VLAN 20, 192.168.1.2/4。

**SW 1 配置**：
```system-view
[SW1] vlan batch 10 20
[SW1] interface Ethernet0/0/1
[SW1-Ethernet0/0/1] port link-type access
[SW1-Ethernet0/0/1] port default vlan 10
[SW1] interface Ethernet0/0/2
[SW1-Ethernet0/0/2] port link-type access
[SW1-Ethernet0/0/2] port default vlan 20
[SW1] interface Ethernet0/0/3
[SW1-Ethernet0/0/3] port link-type trunk
[SW1-Ethernet0/0/3] port trunk allow-pass vlan 10 20
```
SW 2 同理。

**验证**：
- PC 1 Ping PC 3（跨交换机同 VLAN 10）→ **通**
- PC 2 Ping PC 4（跨交换机同 VLAN 20）→ **通**
- PC 1 Ping PC 2（同交换机不同 VLAN）→ **不通**
- 在 E 0/0/3 上抓包，能看到带 802.1 Q 标签的帧。

**排错演练**：`undo port trunk allow-pass vlan 20` → PC 2 无法 Ping 通 PC 4。恢复后验证。

---

## 4. Hybrid 端口简介（10 分钟）

### 4.1 为什么还需要 Hybrid？
Trunk 已经很强，但有时需要更精细控制：
- 某端口对 VLAN 10 去标签（连 PC），对 VLAN 20 带标签（连交换机）。
- Hybrid 是华为特色，可精确指定每个 VLAN 是带标签（tag）还是去标签（untag）。

### 4.2 配置示例
```system-view
[SW1] interface Ethernet0/0/4
[SW1-Ethernet0/0/4] port link-type hybrid
[SW1-Ethernet0/0/4] port hybrid untagged vlan 10
[SW1-Ethernet0/0/4] port hybrid tagged vlan 20
```
VLAN 10 的帧出端口→剥标签；VLAN 20→保留标签。

### 4.3 现网应用
- **灵活 QinQ**：外层 VLAN 打标签，内层 VLAN 可选择剥离。
- **基于 MAC 的 VLAN**：同一端口下不同 MAC 的设备划入不同 VLAN。

**本课重点仍是 Access+Trunk，Hybrid 先建立概念。**

---

## 5. 现网深度关联：运营商 VLAN/Trunk 实践（5 分钟）

### 5.1 OLT 上行 Trunk
一台 OLT 上行到 BRAS 的端口配置为 Trunk，承载：
- VLAN 101-200：宽带用户
- VLAN 201-300：VoIP 语音
- VLAN 301-400：IPTV
- VLAN 999：设备管理

### 5.2 基站回传
一个基站同时有 4 G/5 G/网管/同步等业务，回传时映射到不同 VLAN：
- VLAN 100：S 1-U 用户面
- VLAN 200：S 1-C 控制面
- VLAN 300：网管通道
- VLAN 400：时钟同步

### 5.3 维护要点
- **Access 端口 PVID 配错** → PC 获取错误网段地址
- **VLAN 未全局创建** → Access 口指定不存在的 VLAN，端口 Down
- **Trunk 口 PVID 不一致** → 无标签管理流量走错 VLAN
- **Trunk 口允许列表遗漏** → 对应 VLAN 被静默阻断

---

## 6. 课堂小结与课后任务（5 分钟）

**核心回顾**：
- **VLAN**：物理交换机逻辑分多台，Access 端口“进打标、出去剥”，二层隔离广播域。
- **Trunk**：一根链路承载多 VLAN，帧带标签穿越，打通跨交换机同 VLAN 通信。
- **Hybrid**：更精细的标签控制，现网 QinQ 场景常用。

**课后任务（eNSP）**：
1. 完成单交换机 VLAN 隔离 + 跨交换机 Trunk 互通全套实验，验证同 VLAN 通、不同 VLAN 不通。
2. 在 Trunk 链路抓包，截图保存带 802.1 Q 标签的帧。
3. 实验：添加 VLAN 30，在两台交换机上各接一台 PC 入 VLAN 30，Trunk 口放行，验证互通。
4. 思考：如果三台交换机组成链（SW 1—SW 2—SW 3），中间 Trunk 口需要放行哪些 VLAN？SW 1 和 SW 3 上同 VLAN 的 PC 能通吗？（能，只要沿途所有 Trunk 都放行该 VLAN。）

---

> **VLAN 隔离广播域，Trunk 打通跨交换机。这两个技术配合，构建了运营商现网“一条光纤、多种业务”的基石。下一课，我们将面对多 Trunk 互连带来的环路风险，学习生成树协议（STP）的原理与配置！**

