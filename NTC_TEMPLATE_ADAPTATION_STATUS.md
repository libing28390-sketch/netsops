# NTC Templates 适配全量清单

更新时间：2026-03-11

## 1. 当前生效路径

- 默认模板路径：`.venv/Lib/site-packages/ntc_templates/templates`
- 当前项目已将你仓库同步下来的模板内容合并到默认安装路径中
- 当前运行逻辑不再使用 `third_party`
- 后端模板定位入口：`backend/core/textfsm.py`
- 业务命令目录来源：`backend/services/operational_data_service.py`

## 2. 当前业务范围

当前业务围绕以下 7 类数据进行结构化采集：

1. interfaces
2. neighbors
3. arp
4. mac_table
5. routing_table
6. bgp
7. ospf

当前已补充第 8 类协议数据：

8. bfd

## 3. 平台映射

| 内部平台 | NTC 平台 | 说明 |
| --- | --- | --- |
| cisco_ios | cisco_ios | 原生适配 |
| cisco_nxos | cisco_nxos | 原生适配 |
| juniper_junos | juniper_junos | 原生适配 |
| arista_eos | arista_eos | 原生适配 |
| huawei_vrp | huawei_vrp | 原生适配 |
| h3c_comware | hp_comware | 共用 Comware 模板族 |
| ruijie_rgos | cisco_ios | 当前按 Cisco IOS 语法族回退复用，属于兼容方案，不是原生模板族 |

## 4. 覆盖结论

按当前项目实际命令目录统计：

- 原生平台加 Comware 映射验证：44 条命令组合，已覆盖 39 条，未覆盖 5 条
- 加上内部 `ruijie_rgos` 的 Cisco IOS 回退后，项目内部全量命令组合为 52 条
- 其中 `ruijie_rgos` 这 8 条命令是通过 `cisco_ios` 模板族兼容复用，不是锐捷原生模板

## 5. 全量适配矩阵

### 5.1 Cisco IOS

| 类别 | 当前命令 | 状态 | 模板 |
| --- | --- | --- | --- |
| interfaces | show ip interface brief | 已覆盖 | cisco_ios_show_ip_interface_brief.textfsm |
| neighbors | show lldp neighbors detail | 已覆盖 | cisco_ios_show_lldp_neighbors_detail.textfsm |
| neighbors | show cdp neighbors detail | 已覆盖 | cisco_ios_show_cdp_neighbors_detail.textfsm |
| arp | show arp | 已覆盖 | cisco_ios_show_arp.textfsm |
| mac_table | show mac address-table | 已覆盖 | cisco_ios_show_mac-address-table.textfsm |
| routing_table | show ip route | 已覆盖 | cisco_ios_show_ip_route.textfsm |
| bgp | show ip bgp summary | 已覆盖 | cisco_ios_show_ip_bgp_summary.textfsm |
| ospf | show ip ospf neighbor | 已覆盖 | cisco_ios_show_ip_ospf_neighbor.textfsm |
| bfd | show bfd neighbors details | 已覆盖 | cisco_ios_show_bfd_neighbors_details.textfsm |

### 5.2 Cisco NX-OS

| 类别 | 当前命令 | 状态 | 模板/建议 |
| --- | --- | --- | --- |
| interfaces | show ip interface brief | 已覆盖 | cisco_nxos_show_ip_interface_brief.textfsm |
| neighbors | show lldp neighbors detail | 已覆盖 | cisco_nxos_show_lldp_neighbors_detail.textfsm |
| neighbors | show cdp neighbors detail | 已覆盖 | cisco_nxos_show_cdp_neighbors_detail.textfsm |
| arp | show ip arp | 已覆盖 | cisco_nxos_show_ip_arp.textfsm |
| mac_table | show mac address-table | 已覆盖 | cisco_nxos_show_mac_address-table.textfsm |
| routing_table | show ip route | 已覆盖 | cisco_nxos_show_ip_route.textfsm |
| bgp | show bgp ipv4 unicast summary | 未覆盖 | 建议改为 `show ip bgp summary`，已有 `cisco_nxos_show_ip_bgp_summary.textfsm` |
| ospf | show ip ospf neighbors | 已覆盖 | cisco_nxos_show_ip_ospf_neighbor.textfsm |
| bfd | show bfd neighbors | 已覆盖 | cisco_nxos_show_bfd_neighbors.textfsm |

### 5.3 Juniper Junos

| 类别 | 当前命令 | 状态 | 模板/建议 |
| --- | --- | --- | --- |
| interfaces | show interfaces terse | 已覆盖 | juniper_junos_show_interfaces.textfsm |
| neighbors | show lldp neighbors | 已覆盖 | juniper_junos_show_lldp_neighbors.textfsm |
| arp | show arp no-resolve | 已覆盖 | juniper_junos_show_arp_no-resolve.textfsm |
| mac_table | show ethernet-switching table | 已覆盖 | juniper_junos_show_ethernet-switching_table.textfsm |
| routing_table | show route | 未覆盖 | 建议改为 `show route summary`，已有 `juniper_junos_show_route_summary.textfsm` |
| bgp | show bgp summary | 已覆盖 | juniper_junos_show_bgp_summary.textfsm |
| ospf | show ospf neighbor | 已覆盖 | juniper_junos_show_ospf_neighbor.textfsm |

### 5.4 Arista EOS

| 类别 | 当前命令 | 状态 | 模板/建议 |
| --- | --- | --- | --- |
| interfaces | show ip interface brief | 已覆盖 | arista_eos_show_ip_interface_brief.textfsm |
| neighbors | show lldp neighbors detail | 已覆盖 | arista_eos_show_lldp_neighbors_detail.textfsm |
| arp | show arp | 未覆盖 | 建议改为 `show ip arp`，已有 `arista_eos_show_ip_arp.textfsm` |
| mac_table | show mac address-table | 已覆盖 | arista_eos_show_mac_address-table.textfsm |
| routing_table | show ip route | 已覆盖 | arista_eos_show_ip_route.textfsm |
| bgp | show ip bgp summary | 已覆盖 | arista_eos_show_ip_bgp_summary.textfsm |
| ospf | show ip ospf neighbor | 已覆盖 | arista_eos_show_ip_ospf_neighbor.textfsm |

### 5.5 Huawei VRP

| 类别 | 当前命令 | 状态 | 模板 |
| --- | --- | --- | --- |
| interfaces | display interface brief | 已覆盖 | huawei_vrp_display_interface_brief.textfsm |
| neighbors | display lldp neighbor verbose | 已覆盖 | huawei_vrp_display_lldp_neighbor.textfsm |
| arp | display arp all | 已覆盖 | huawei_vrp_display_arp_all.textfsm |
| mac_table | display mac-address | 已覆盖 | huawei_vrp_display_mac-address.textfsm |
| routing_table | display ip routing-table | 已覆盖 | 运行验证已通过 |
| bgp | display bgp peer | 已覆盖 | huawei_vrp_display_bgp_peer.textfsm |
| ospf | display ospf peer | 已覆盖 | 运行验证已通过 |

说明：`display ip routing-table` 与 `display ospf peer` 在 `parse_output()` 空数据验证下可以正常命中模板。

### 5.6 H3C Comware

| 类别 | 当前命令 | 状态 | 模板/建议 |
| --- | --- | --- | --- |
| interfaces | display interface brief | 已覆盖 | hp_comware_display_interface_brief.textfsm |
| neighbors | display lldp neighbor-information list | 已覆盖 | hp_comware_display_lldp_neighbor-information_list.textfsm |
| arp | display arp | 已覆盖 | hp_comware_display_arp.textfsm |
| mac_table | display mac-address | 已覆盖 | hp_comware_display_mac-address.textfsm |
| routing_table | display ip routing-table | 已覆盖 | hp_comware_display_ip_routing-table.textfsm |
| bgp | display bgp peer | 未覆盖 | 建议改为 `display bgp peer ipv4`，已有 `hp_comware_display_bgp_peer_ipv4.textfsm` |
| ospf | display ospf peer | 未覆盖 | 当前默认模板库无直接模板，建议保留原始回显或补自定义模板 |

### 5.7 Ruijie RGOS

| 类别 | 当前命令 | 状态 | 模板 |
| --- | --- | --- | --- |
| interfaces | show ip interface brief | 已覆盖 | cisco_ios_show_ip_interface_brief.textfsm |
| neighbors | show lldp neighbors detail | 已覆盖 | cisco_ios_show_lldp_neighbors_detail.textfsm |
| neighbors | show cdp neighbors detail | 已覆盖 | cisco_ios_show_cdp_neighbors_detail.textfsm |
| arp | show arp | 已覆盖 | cisco_ios_show_arp.textfsm |
| mac_table | show mac address-table | 已覆盖 | cisco_ios_show_mac-address-table.textfsm |
| routing_table | show ip route | 已覆盖 | cisco_ios_show_ip_route.textfsm |
| bgp | show ip bgp summary | 已覆盖 | cisco_ios_show_ip_bgp_summary.textfsm |
| ospf | show ip ospf neighbor | 已覆盖 | cisco_ios_show_ip_ospf_neighbor.textfsm |
| bfd | show bfd neighbors details | 兼容覆盖 | cisco_ios_show_bfd_neighbors_details.textfsm |

说明：以上覆盖来自 `ruijie_rgos -> cisco_ios` 的兼容回退，不代表当前模板库已有锐捷原生平台索引。

## 6. 当前未覆盖项

当前命令目录里明确未覆盖的 5 条组合如下：

| 平台 | 类别 | 当前命令 | 建议 |
| --- | --- | --- | --- |
| cisco_nxos | bgp | show bgp ipv4 unicast summary | 改为 `show ip bgp summary` |
| juniper_junos | routing_table | show route | 改为 `show route summary` |
| arista_eos | arp | show arp | 改为 `show ip arp` |
| h3c_comware | bgp | display bgp peer | 改为 `display bgp peer ipv4` |
| h3c_comware | ospf | display ospf peer | 保留原始回显，或单独补模板 |

## 7. 结论

- 当前项目已经切回标准默认路径，后续维护只需要关注 `.venv/Lib/site-packages/ntc_templates/templates`
- 当前主流平台里，Cisco IOS、Cisco NX-OS、Huawei VRP、Ruijie 兼容路径已经比较完整，BFD 已优先接入 ntc-templates 官方模板
- 需要进一步优化的重点是 NX-OS BGP、Junos 路由摘要、Arista ARP、H3C 的 BGP/OSPF
- 如果希望把结构化命中率继续提高，最直接的方式不是继续扩展前端，而是把 `backend/services/operational_data_service.py` 中这 5 条命令改成模板已覆盖的等价命令