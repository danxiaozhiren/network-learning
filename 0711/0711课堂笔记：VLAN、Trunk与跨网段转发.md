# 0711 课堂笔记：VLAN、Trunk 与跨网段转发

> 精炼复习版。核心主线：`VLAN 做二层隔离，Trunk 承载跨交换机 VLAN，三层网关负责跨 VLAN/跨网段转发。`

## 1. 全课框架

```text
同一 VLAN、同一网段
  -> ARP 获取目标主机 MAC
  -> 交换机按 VLAN + 目的 MAC 转发

同一 VLAN、不同网段
  -> 必须经过三层网关

不同 VLAN
  -> 二层隔离
  -> 要互通必须经过路由器子接口或三层交换机 VLANIF

跨交换机延伸同一 VLAN
  -> 交换机之间使用 Trunk，携带 802.1Q 标签
```

一句话记忆：

```text
同网段找目标 MAC，跨网段找网关 MAC；
IP 指向最终目标，MAC 指向当前下一跳。
```

## 2. VLAN：隔离广播域

VLAN（Virtual LAN）把一台物理交换机逻辑划分为多个独立的二层广播域。

- 同一 VLAN：可以进行二层转发。
- 不同 VLAN：二层报文不能直接互通，即使主机 IP 属于同一网段也不行。
- 广播只在所属 VLAN 内泛洪。
- 仅划分不同 IP 网段不等于完成隔离，因为终端可以自行修改 IP；VLAN 才是交换机转发层面的隔离。

实际规划通常保持：

```text
一个 VLAN <-> 一个 IP 子网 <-> 一个三层网关

VLAN 10 <-> 10.1.10.0/24 <-> 10.1.10.254
VLAN 20 <-> 10.1.20.0/24 <-> 10.1.20.254
```

### 交换机的转发依据

MAC 地址表不只是记录 MAC 和端口，还与 VLAN 关联：

```text
VLAN ID + MAC 地址 -> 出接口
```

同一个 VLAN 内，交换机仍按目的 MAC 转发；VLAN 决定帧属于哪个二层转发域。

## 3. 802.1Q 标签

802.1Q 在源 MAC 与原 EtherType 之间插入 4 字节标签：

```text
无标签帧：目的 MAC | 源 MAC | EtherType | 数据 | FCS
有标签帧：目的 MAC | 源 MAC | 802.1Q Tag | EtherType | 数据 | FCS
```

关键字段：

| 字段 | 长度 | 作用 |
| --- | ---: | --- |
| TPID | 16 bit | 常见值 `0x8100`，表示 802.1Q |
| PCP | 3 bit | 二层优先级，可用于 QoS |
| DEI | 1 bit | 拥塞时的丢弃指示 |
| VID | 12 bit | VLAN ID；常用范围 `1-4094` |

课堂抓包结论：

- 在普通 PC 接入口抓包通常看不到 VLAN Tag，因为发给终端前标签已被剥除。
- 在交换机间 Trunk 链路抓包，才能直接观察到携带 VID 的 802.1Q 帧。

## 4. Access、Trunk、Hybrid

| 端口类型 | 典型对端 | 承载 VLAN | 核心行为 |
| --- | --- | --- | --- |
| Access | PC、普通终端 | 1 个 | 入方向将无标签帧归入 PVID；出方向通常去标签 |
| Trunk | 交换机、路由器子接口、OLT 等 | 多个 | 跨链路保留不同 VLAN 的身份，只放行允许列表中的 VLAN |
| Hybrid | 混合场景 | 多个 | 可分别指定各 VLAN 出方向 tagged/untagged |

### PVID 的作用

PVID 用于给端口收到的无标签帧确定 VLAN 身份。

- Access 口：终端发来的无标签帧归入 Access VLAN。
- Trunk 口：无标签帧归入 Trunk PVID；有标签帧按 VID 处理。
- Trunk 两端 PVID 不一致时，无标签流量可能进入错误 VLAN。

本课重点是 `Access + Trunk`。Hybrid 只需掌握：它比 Trunk 更灵活，可逐 VLAN 控制出端口时是否保留标签，常见于 QinQ、基于 MAC 的 VLAN 等场景。

## 5. 跨交换机同 VLAN 转发

```text
PC1 --Access VLAN 10-- SW1 --Trunk-- SW2 --Access VLAN 10-- PC2
```

完整过程：

1. PC1 发出无标签以太网帧。
2. SW1 的 Access 口根据 PVID 将帧归入 VLAN 10。
3. SW1 查找 VLAN 10 对应的 MAC 地址表项。
4. 帧从 Trunk 口发出，链路上携带 VLAN 10 标签。
5. SW2 收到后按 VID 10 进入 VLAN 10 的转发域。
6. SW2 从 Access 口发给 PC2，出端口时去掉标签。

跨交换机同 VLAN 互通的必要条件：

- 两台交换机都已创建该 VLAN。
- 终端接口划入正确的 Access VLAN。
- 两端互联接口均为 Trunk。
- 沿途每一段 Trunk 都允许该 VLAN 通过。
- IP 地址、掩码与主机自身的网段判断正确。

## 6. 华为 VRP 基础配置

### 创建 VLAN 与配置 Access

```text
system-view
vlan batch 10 20

interface GigabitEthernet 0/0/1
 port link-type access
 port default vlan 10
 quit

interface GigabitEthernet 0/0/2
 port link-type access
 port default vlan 20
 quit
```

### 配置交换机间 Trunk

```text
interface GigabitEthernet 0/0/5
 port link-type trunk
 port trunk allow-pass vlan 10 20
 quit
```

两端交换机都要配置。华为交换机的 Trunk 通常不会自动放行所有业务 VLAN，必须检查 `allow-pass` 列表。

### 常用检查命令

```text
display vlan
display port vlan
display mac-address
display current-configuration interface GigabitEthernet 0/0/5
```

课堂中的典型配置错误：

- Access 口 VLAN 号配错，导致同 VLAN 主机不通。
- VLAN 尚未创建，就给 Access 口指定该 VLAN。
- Trunk 只放行 VLAN 10，遗漏 VLAN 20。
- 只配置一端 Trunk，另一端端口类型或允许列表不一致。
- 网络配置已正确，但 PC 地址仍是上一次实验的旧地址。

## 7. ARP 与同网段通信

主机发送 IP 包前，先查本机路由表，确定出接口和下一跳；简单单网卡场景可用掩码理解：

```text
本机 IP AND 掩码 == 目标 IP AND 掩码
```

若结果相同，目标在本地网段：

1. 查 ARP 表。
2. 没有表项时，广播 ARP Request：目标 MAC 为 `FF:FF:FF:FF:FF:FF`。
3. 拥有目标 IP 的主机单播回复自己的 MAC。
4. 发起方缓存 IP/MAC 映射，再发送 ICMP 等实际报文。

若目标 IP 不存在，ARP 多次请求仍无人回复，主机无法获得目标 MAC，通信失败。

第一次 Ping 可能延迟较高或丢第一个包，常见原因是设备正在完成 ARP 解析，不能直接据此判断链路持续故障。

## 8. 默认网关与跨网段转发

目标不在本地网段时，主机不会 ARP 查询远端主机，而是查路由表并解析下一跳的 MAC；最常见的下一跳就是默认网关。

```text
PC1                 R1                    PC2
10.1.1.1/24         10.1.1.254/24         100.1.1.5/24
GW 10.1.1.254       100.1.1.254/24        GW 100.1.1.254
```

PC1 访问 PC2：

1. PC1 判断 `100.1.1.5` 不在本地网段。
2. 默认路由指向 `10.1.1.254`。
3. PC1 ARP 查询的是网关 `10.1.1.254`，不是 PC2。
4. 第一段链路封装如下：

```text
源 IP：PC1             目标 IP：PC2
源 MAC：PC1            目标 MAC：R1 入接口
```

5. R1 接收帧，拆除当前二层头，按目标 IP 查路由表，TTL 减 1。
6. R1 在出接口网段 ARP 查询 PC2，再封装新的二层头：

```text
源 IP：PC1             目标 IP：PC2
源 MAC：R1 出接口       目标 MAC：PC2
```

关键规律：

- 不考虑 NAT 时，源/目标 IP 端到端基本不变。
- 每经过一段二层链路，源/目标 MAC 都会重新封装。
- 路由器需要先接收发给自己的二层帧，但其选路依据是目标 IP 和路由表。
- 默认网关必须是当前出口二层可达的下一跳；普通以太网中通常与主机处于同一子网。
- 回程同样需要正确的网关和路由，只保证去程可达不够。

## 9. VLAN 间路由

不同 VLAN 要互通，必须引入三层转发。常见方式：

### 单臂路由（Router-on-a-Stick）

```text
VLAN 10 ─┐
         ├─ SW Trunk ─ R1 物理接口
VLAN 20 ─┘              ├─ 子接口 .10：终结 VLAN 10，作为 VLAN 10 网关
                        └─ 子接口 .20：终结 VLAN 20，作为 VLAN 20 网关
```

路由器子接口通过 802.1Q VID 区分流量，终结标签后按 IP 路由，再为目标 VLAN 重新封装。华为设备上的相关命令常见为 `dot1q termination vid`，部分型号/版本还需在子接口启用 `arp broadcast enable`，应以实际设备命令帮助为准。

### 三层交换机 VLANIF

为每个 VLAN 创建 VLANIF 并配置网关 IP，由三层交换机直接完成 VLAN 间路由。相比单臂路由，不需要把两个 VLAN 的流量送到外部路由器再返回。

## 10. 二层环路与广播风暴

二层广播会在 VLAN 内泛洪。如果交换机之间形成环路，广播帧可能被反复复制并循环转发，快速耗尽链路和设备资源，表现为：

- 交换机端口灯持续快速闪烁。
- MAC 地址表频繁漂移。
- 链路利用率异常升高。
- 正常业务严重丢包或完全中断。

STP（Spanning Tree Protocol）通过阻塞冗余路径，将有环拓扑计算成无环转发树，避免二层环路。此处先掌握问题与作用，具体机制后续学习。

## 11. 现网对应

- OLT 上行：一条 Trunk 同时承载宽带、VoIP、IPTV、网管等不同 VLAN。
- 基站回传：一条物理链路用不同 VLAN 区分用户面、控制面、网管、时钟等业务。
- 路由器对接多 VLAN：使用物理接口下的多个子接口分别终结不同 VID，再进入不同三层转发域或 VPN。

本质都是：

```text
一条物理链路承载多类业务，靠 VLAN 标签保持逻辑隔离。
```

## 12. 排错顺序

遇到 Ping 不通，按层次检查，避免直接怀疑路由或设备故障：

1. **终端**：IP、掩码、默认网关是否正确，是否仍残留旧实验配置。
2. **Access**：端口所属 VLAN 是否正确，对应 VLAN 是否已创建。
3. **Trunk**：两端类型是否一致，沿途是否全部允许目标 VLAN。
4. **MAC/ARP**：交换机是否学到正确的 `VLAN + MAC + 端口`，主机/网关是否学到 ARP。
5. **三层**：网关接口是否正常，去程与回程路由是否都存在。
6. **策略**：最后检查 ACL、防火墙等是否拦截。

抓包判断重点：

- 同网段时，ARP 查询的是目标主机。
- 跨网段时，主机 ARP 查询的是默认网关。
- Access 链路通常无 Tag，Trunk 链路应能看到正确 VID。
- 路由器两侧 IP 地址基本不变，MAC 地址发生变化，TTL 减 1。

## 13. 最终速记

```text
VLAN：划分广播域，完成二层隔离。
Access：连接普通终端，一个端口通常归属一个 VLAN。
Trunk：一条链路承载多个 VLAN，靠 802.1Q VID 区分。
Hybrid：逐 VLAN 控制 tagged/untagged，灵活但不是本课重点。
ARP：把本地下一跳 IPv4 地址解析为 MAC 地址。
默认网关：主机访问其他网段时使用的下一跳。
路由器：终结当前二层头，按目标 IP 选路，再封装下一跳二层头。
STP：避免二层环路引发广播风暴。
```
