# 0725 课堂笔记：VLANIF、路由表与静态路由

> 核心：`同网段找目标 MAC，跨网段找网关 MAC；IP 看最终目的，MAC 看当前下一跳。`

## 1. 报文转发主线

```text
主机发送 IP 报文
  -> 查本机路由表，确定出接口和下一跳
  -> ARP 获取下一跳 MAC
     -> 同网段：下一跳是目标主机
     -> 跨网段：下一跳是网关
  -> 封装以太网帧并发送

交换机收到帧
  -> 在同一 VLAN 内按 VLAN + 目的 MAC 转发

三层设备收到帧
  -> 拆除当前二层头
  -> 按目的 IP 查路由表
  -> TTL 减 1
  -> 重新封装下一段链路的二层头
```

在普通以太网转发中：

- 不经过 NAT 时，源 IP 和目的 IP 端到端基本不变。
- 每经过一个三层跳点，源 MAC 和目的 MAC 都会改变。
- 交换机负责 VLAN 内的二层转发；路由器或 VLANIF 负责跨网段转发。

## 2. 主机路由表与 ARP

主机发送报文前也要查路由表。常见条目：

| 路由 | 作用 |
| --- | --- |
| `10.1.1.0/24` | 本地直连网段 |
| `10.1.1.100/32` | 本机接口地址，报文交给本机协议栈 |
| `0.0.0.0/0` | 缺省路由，没有更精确路由时交给网关 |
| `127.0.0.0/8` | IPv4 环回地址，不离开本机 |

`/24` 子网共有 256 个地址，传统场景通常有 254 个可用主机地址。

### 同网段通信

`10.1.1.1/24` 访问 `10.1.1.2/24`：

1. 匹配直连路由 `10.1.1.0/24`。
2. ARP 查询 `10.1.1.2` 的 MAC。
3. 目的 IP 写 `10.1.1.2`，目的 MAC 写目标主机 MAC。

### 跨网段通信

`10.1.1.1/24` 访问 `20.1.1.3/24`：

1. 目标不属于本地网段，匹配缺省路由或其他更精确路由。
2. ARP 查询网关 MAC，不查询远端主机 MAC。
3. 第一跳封装：

```text
源 IP：10.1.1.1          目的 IP：20.1.1.3
源 MAC：PC MAC           目的 MAC：网关 MAC
```

默认网关必须是当前二层可达的下一跳。通信必须同时具备去程和回程路由。

## 3. VLAN 间路由

不同 VLAN 是不同的二层广播域。常规规划是：

```text
一个 VLAN <-> 一个 IP 子网 <-> 一个三层网关
```

### 单臂路由

路由器使用一条 Trunk 和多个子接口分别终结 VLAN：

```text
VLAN 10 ─┐
         ├─ SW Trunk ─ R1 G0/0/0
VLAN 20 ─┘              ├─ G0/0/0.10：VLAN 10 网关
                        └─ G0/0/0.20：VLAN 20 网关
```

华为终结子接口示例：

```text
interface GigabitEthernet 0/0/0.10
 dot1q termination vid 10
 ip address 10.1.1.100 24
 arp broadcast enable
 quit
```

VLAN 20 子接口配置方式相同。交换机 Trunk 必须允许 VLAN 10、20。

### 三层交换机 VLANIF

VLANIF 是 VLAN 对应的逻辑三层接口，其 IP 作为该 VLAN 的网关。

```text
system-view
vlan batch 10 20

interface Ethernet 0/0/1
 port link-type access
 port default vlan 10
 quit

interface Ethernet 0/0/2
 port link-type access
 port default vlan 20
 quit

interface Vlanif 10
 ip address 10.1.1.100 24
 quit

interface Vlanif 20
 ip address 20.1.1.100 24
 quit
```

主机网关：

```text
VLAN 10 -> 10.1.1.100
VLAN 20 -> 20.1.1.100
```

VLANIF 状态判断：

- 对应 VLAN 必须存在。
- VLAN 内至少有一个成员端口处于 `Up` 状态；Trunk 还必须允许该 VLAN。
- VLANIF 不能处于 `shutdown` 状态。
- 配置 IP 后，协议状态才能达到 `Up`。
- VLANIF 配置 IP 且协议状态为 `Up` 后，对应网段才形成有效直连路由。

## 4. 二层环路与 STP/RSTP

二层环路会造成广播风暴、MAC 地址漂移和重复帧。以太网广播帧没有 TTL，不能依靠 TTL 自动终止环路。

- STP：选举根桥，阻塞冗余端口，形成无环转发树。
- RSTP：改进端口角色和状态转换，收敛速度快于传统 STP。

必记：`物理链路可以冗余，二层实际转发路径不能成环。`

## 5. 路由表与选路

路由条目通常包含目的网段、下一跳、出接口、来源、优先级和度量值。

| 来源 | 形成方式 |
| --- | --- |
| 直连路由 | 接口配置 IP，且协议状态可用 |
| 静态路由 | 管理员手工指定 |
| 动态路由 | OSPF、IS-IS、BGP 等协议学习 |

### 两个阶段

1. **路由优选**：相同目的前缀存在多条路由时，根据协议优先级、协议自身度量等选出有效路由。
2. **报文查表**：在有效路由中执行最长前缀匹配。

最长前缀匹配：

```text
10.1.1.100/32  优先于  10.1.1.0/24  优先于  0.0.0.0/0
```

华为 VRP 中，`preference` 数值越小，路由优先级越高。静态路由默认值通常为 60。

## 6. 静态路由

### 普通静态路由

```text
[R1] ip route-static 192.168.20.0 24 10.0.0.2
```

含义：去往 `192.168.20.0/24` 的报文交给下一跳 `10.0.0.2`。

### 缺省路由

```text
[R1] ip route-static 0.0.0.0 0 10.0.0.2
```

`0.0.0.0/0` 最不精确，只在没有更精确路由时使用，常用于出口或末梢网络。

### 浮动静态路由

```text
[R1] ip route-static 192.168.20.0 24 10.0.0.2 preference 60
[R1] ip route-static 192.168.20.0 24 10.0.0.6 preference 80
```

- `10.0.0.2` 是主下一跳。
- `10.0.0.6` 必须位于实际存在的第二条互联链路上，例如 `10.0.0.4/30`。
- 主路由失效后，`preference 80` 的备用路由才接管。
- 远端链路故障但下一跳仍可达时，需要 NQA、BFD 等机制检测并联动静态路由。

### 常见风险

| 问题 | 结果 |
| --- | --- |
| 缺少回程路由 | 请求能到达，响应回不来 |
| 下一跳错误 | 流量进入路由黑洞 |
| 多台设备互相指向 | 形成三层环路，直至 TTL 归零 |
| 网络变化但静态配置不变 | 路由可能继续指向无效路径 |

静态路由适合缺省出口、末梢网络、管理网络和明确的备份路径；规模大、变化频繁的网络通常使用动态路由协议。

## 7. eNSP 综合实验

### 拓扑与地址

```text
PC1(VLAN 10) ─┐
              ├─ SW ─ Access VLAN 100 ─ R1 ─ 10.0.0.0/30 ─ R2 ─ PC2
PC3(VLAN 30) ─┘
```

| 设备/接口 | 地址 | 网关 |
| --- | --- | --- |
| PC1 | `192.168.10.10/24` | `192.168.10.1` |
| PC3 | `192.168.30.10/24` | `192.168.30.1` |
| SW Vlanif 10 | `192.168.10.1/24` | — |
| SW Vlanif 30 | `192.168.30.1/24` | — |
| SW Vlanif 100 | `192.168.100.1/24` | — |
| R1 G0/0/0 | `192.168.100.2/24` | — |
| R1 G0/0/1 | `10.0.0.1/30` | — |
| R2 G0/0/0 | `10.0.0.2/30` | — |
| R2 G0/0/1 | `192.168.20.1/24` | — |
| PC2 | `192.168.20.10/24` | `192.168.20.1` |

这里选择 `SW Access VLAN 100 + R1 物理接口 IP`。如果改用 Trunk，R1 必须使用子接口并配置 `dot1q termination vid 100` 和 `arp broadcast enable`，不能直接照用物理接口配置。

### SW

```text
system-view
vlan batch 10 30 100

interface Ethernet 0/0/1
 port link-type access
 port default vlan 10
 quit

interface Ethernet 0/0/2
 port link-type access
 port default vlan 30
 quit

interface Ethernet 0/0/3
 port link-type access
 port default vlan 100
 quit

interface Vlanif 10
 ip address 192.168.10.1 24
 quit

interface Vlanif 30
 ip address 192.168.30.1 24
 quit

interface Vlanif 100
 ip address 192.168.100.1 24
 quit

ip route-static 0.0.0.0 0 192.168.100.2
```

### R1

```text
system-view
interface GigabitEthernet 0/0/0
 ip address 192.168.100.2 24
 quit

interface GigabitEthernet 0/0/1
 ip address 10.0.0.1 30
 quit

ip route-static 192.168.10.0 24 192.168.100.1
ip route-static 192.168.30.0 24 192.168.100.1
ip route-static 192.168.20.0 24 10.0.0.2
```

### R2

```text
system-view
interface GigabitEthernet 0/0/0
 ip address 10.0.0.2 30
 quit

interface GigabitEthernet 0/0/1
 ip address 192.168.20.1 24
 quit

ip route-static 192.168.10.0 24 10.0.0.1
ip route-static 192.168.30.0 24 10.0.0.1
ip route-static 192.168.100.0 24 10.0.0.1
```

### 路径检查

```text
PC1 -> PC3：PC1 -> SW -> PC3
PC1 -> PC2：PC1 -> SW -> R1 -> R2 -> PC2
PC2 -> PC1：PC2 -> R2 -> R1 -> SW -> PC1
```

必须验证：

```text
PC1 ping PC3
PC1 ping PC2
PC3 ping PC2
PC1 tracert 192.168.20.10
```

## 8. 排错顺序

| 顺序 | 检查项 | 常用命令 |
| ---: | --- | --- |
| 1 | PC 的 IP、掩码、默认网关 | PC 配置界面、`ipconfig` |
| 2 | Access VLAN、Trunk 允许列表 | `display vlan`、`display port vlan` |
| 3 | 接口及 VLANIF 的 Physical/Protocol 状态 | `display ip interface brief` |
| 4 | MAC 地址学习 | `display mac-address` |
| 5 | ARP 是否解析到下一跳 | `display arp` |
| 6 | 去程路由与最长匹配结果 | `display ip routing-table 目标IP` |
| 7 | 回程路由 | 在对端设备反向查路由表 |
| 8 | ACL、防火墙等策略 | 最后检查 |

典型现象：

- 能 Ping 同 VLAN，不能 Ping 网关：先查 VLANIF 状态和网关地址。
- 能 Ping 网关，不能跨 VLAN：查目标主机网关和回程路径。
- 跨设备不通：逐台查目的路由和下一跳可达性。
- 请求到达但无响应：优先检查对端默认网关或回程路由。

## 9. 考前速记

```text
1. 主机发送报文前也查路由表。
2. 同网段 ARP 查目标主机；跨网段 ARP 查网关。
3. IP 指向最终目标，MAC 指向当前下一跳。
4. VLAN 内靠二层交换，VLAN 间靠三层路由。
5. VLANIF 是三层交换机上的 VLAN 网关接口。
6. VLANIF 配置 IP 且协议 Up 后，才产生有效直连路由。
7. 报文查表使用最长前缀匹配：/32 > /24 > /0。
8. 华为 preference 数值越小，路由优先级越高。
9. 静态路由必须同时保证去程和回程。
10. 浮动静态路由只能在备用链路真实存在且故障可检测时生效。
```
