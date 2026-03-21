# App.tsx 拆分重构进度

## 背景

`src/App.tsx` 原始文件约 **13,317 行**，当前工作区实测为 **5,817 行**，但仍包含少量重交互组件，维护成本依然偏高。  
目标：将其拆分为独立的组件文件，采用 `React.lazy()` + `<Suspense>` 延迟加载，降低耦合度。

## 当前说明

- 下列已完成项现已真正接入 `App.tsx`：`InterfaceMonitoringTab`、`ConfigSearchTab`、`ConfigScheduleTab`、`ConfigDiffViewTab`、`ConfigBackupTab`、`AutomationScenariosTab`、`AutomationHistoryTab`、`AutomationPlaybooksTab`、`AutomationExecuteTab`、`PlatformSettingsTab`
- 设备新增/编辑弹窗已合并抽离为 `DeviceFormModal`，`App.tsx` 不再保留两份重复表单 JSX
- 设备详情弹窗已抽离为 `DeviceDetailModal`，健康趋势、开放告警、运行数据视图和接口监控表格已从 `App.tsx` 移出
- 自定义命令弹窗已抽离为 `CustomCommandModal`，命令编辑、变量替换、收藏与执行目标视图已从 `App.tsx` 移出
- 结果态弹窗已进一步拆分为 `ResultStatusModal`、`TestConnectionResultModal` 与 `SnmpTestResultModal`，连接测试与 SNMP 测试结果不再内联在 `App.tsx`
- 自定义场景创建弹窗已抽离为 `AddScenarioModal`，草稿来源提示、场景表单、变量摘要卡片与创建动作不再内联在 `App.tsx`
- 命令面板已抽离为 `CommandPalette`，页面跳转搜索与固定入口不再内联在 `App.tsx`，并修复了结果列表中的嵌套 button 结构
- 侧边栏已抽离为 `Sidebar`，固定/最近访问、分组导航、资源与告警徽标、移动端遮罩与折叠行为不再内联在 `App.tsx`
- 顶部栏已抽离为 `TopHeader`，页面标题、通知面板、用户菜单、主题切换与语言切换入口不再内联在 `App.tsx`
- 个人资料弹窗已抽离为 `ProfileModal`，头像预览、密码修改、通知渠道配置与测试入口不再内联在 `App.tsx`
- 命令预览弹窗已抽离为 `CommandPreviewModal`，阶段命令分组渲染与“复制全部”入口不再内联在 `App.tsx`
- 导入弹窗已抽离为 `ImportInventoryModal`，导入提示、模板下载卡片与导入确认动作不再内联在 `App.tsx`
- 历史配置弹窗已抽离为 `HistoricalConfigModal`，配置元信息、内容预览与回滚入口不再内联在 `App.tsx`
- 任务调度弹窗已抽离为 `ScheduleTaskModal`，调度类型、周期、时间与时区表单不再内联在 `App.tsx`
- 自动修复确认弹窗已抽离为 `RemediationModal`，修复说明、建议动作与执行确认入口不再内联在 `App.tsx`
- 删除确认弹窗已抽离为 `DeleteConfirmModal`，单设备/批量删除提示与确认动作不再内联在 `App.tsx`
- 审计事件详情弹窗已抽离为 `AuditEventDetailModal`，事件摘要、主体/目标信息与详情 JSON 视图不再内联在 `App.tsx`
- 合规问题详情弹窗已抽离为 `ComplianceFindingDetailModal`，问题详情、处置字段编辑与保存入口不再内联在 `App.tsx`
- Job 输出弹窗已抽离为 `JobOutputModal`，输出查看与复制入口不再内联在 `App.tsx`
- 配置差异确认弹窗已抽离为 `ConfigDiffModal`，当前配置、拟议变更与提交入口不再内联在 `App.tsx`
- 全局 Toast 视图已抽离为 `ToastNotification`，提示样式与图标渲染不再内联在 `App.tsx`
- 未认证登录页壳层已抽离为 `LoginScreen`，背景装饰、品牌头图、登录表单与底部状态栏不再内联在 `App.tsx`
- 拓扑页右侧检查面板已抽离为 `TopologyInspectorPanel`，选中节点摘要、链路详情、优先关注与孤立节点列表不再内联在 `App.tsx`
- 拓扑主页面已抽离为 `TopologyPage`，拓扑头部工具栏、指标卡、筛选条、画布容器与底部链路摘要不再内联在 `App.tsx`
- 已完成接线的 automation/config 页面，其旧内联 JSX 已从 `App.tsx` 删除，当前不再保留对应的 `false && ...` 过渡分支
- 本轮已验证编辑器诊断与 `npm run build` 通过；仍有 3 条既存 CSS 优化 warning，与本次 JSX 抽离无关

## 拆分策略

- **自包含组件模式**（参考 `ConfigDriftTab`）：组件内部管理自己的筛选/分页状态，仅接收 `language`、数据源与必要行为回调等最小 props
- 工具函数提取到 `src/utils/` 目录
- 页面组件提取到 `src/pages/` 目录

---

## 已完成

### 1. 工具函数提取 — `src/utils/connectionHelpers.ts`

- **状态**: ✅ 已完成
- **内容**: 从 App.tsx 提取 SSH 连接测试相关工具函数（约 85 行）
- **导出**:
  - `LEGACY_SSH_ERROR_CODE` 常量
  - `buildConnectionTestMessage()`
  - `buildConnectionTestHint()`
  - `buildConnectionCheckStatus()`
  - `connectionCheckBadgeMeta()`
  - `formatConnectionCheckTime()`
- App.tsx 中已添加 import 并删除了内联定义

### 2. InterfaceMonitoringTab 组件文件 — `src/pages/InterfaceMonitoringTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **文件大小**: 522 行
- **Props**: `devices`, `devicesLastUpdatedAt`, `language`, `snmpTestingId`, `snmpSyncingId`, `onSnmpTest`, `onSnmpSyncNow`
- **内部状态**: `intfSearch`, `intfDevicePage`, `intfExpandedDevice`, `intfPageMap`, `intfFilterMap`, `intfStatusFilter`, `intfSortBy` 等
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<InterfaceMonitoringTab />`
- 已删除 App.tsx 中 inventory/interfaces 分支对应的内联 IIFE 和仅供该页面使用的旧状态，本轮实测主文件总行数已从 **6,920** 进一步降至 **6,017**

### 3. ConfigSearchTab 组件文件 — `src/pages/ConfigSearchTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **文件大小**: 171 行
- **Props**: `t`
- **内部状态**: `query`, `results`, `loading`
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<ConfigSearchTab />`
- 已删除 App.tsx 中对应的内联搜索页面和仅供该页面使用的旧状态，主文件进一步减少约 **120 行**

### 4. TopologyPage 组件文件 — `src/pages/TopologyPage.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接拓扑页头部操作区、指标概览、站点/角色/状态筛选、拓扑画布容器、空状态与底部链路摘要
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<TopologyPage />`
- 拓扑发现、导出图片、节点/链路选中与右侧检查面板交互仍保留在 App.tsx 的现有状态与 handler 上，提取后主文件总行数已从 **6,017** 进一步降至 **5,817**

### 5. ConfigScheduleTab 组件文件 — `src/pages/ConfigScheduleTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接定时备份配置、保留周期与每设备快照统计展示
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<ConfigScheduleTab />`

### 6. AutomationScenariosTab 组件文件 — `src/pages/AutomationScenariosTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接场景库检索、风险标签、平台支持信息与“Use Scenario”入口
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<AutomationScenariosTab />`

### 7. AutomationHistoryTab 组件文件 — `src/pages/AutomationHistoryTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接执行历史列表、实时日志流、设备执行结果与详情抽屉
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<AutomationHistoryTab />`

### 8. ConfigDiffViewTab 组件文件 — `src/pages/ConfigDiffViewTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接快照筛选、双快照选择、变更定位、差异块导航与全文对比展示
- Diff 计算逻辑仍保留在 App.tsx，页面组件只负责视图渲染与交互转发

### 9. ConfigBackupTab 组件文件 — `src/pages/ConfigBackupTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接备份历史、设备筛选、快照查看、复制、删除与跳转 diff
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<ConfigBackupTab />`

### 10. AutomationPlaybooksTab 组件文件 — `src/pages/AutomationPlaybooksTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接 Playbook 场景选择、变量输入、目标设备选择与命令预览
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<AutomationPlaybooksTab />`

### 11. AutomationExecuteTab 组件文件 — `src/pages/AutomationExecuteTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接直连执行工作台、目标设备选择、场景参数配置、Quick Query、执行结果展示
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<AutomationExecuteTab />`
- 设备切换、Quick Query 重置、执行状态清理等桥接逻辑保留在 App.tsx，以减少提取过程中的行为回归风险

### 12. PlatformSettingsTab 组件文件 — `src/pages/PlatformSettingsTab.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接模板资产库、全局变量面板、模板编辑器、渲染预览、发布前检查与发布范围工作台
- App.tsx 中已改为通过 `lazy()` + `<Suspense>` 渲染 `<PlatformSettingsTab />`
- 配置模板保存、变量导入/增删、发布前检查与跳转 Automation 的桥接逻辑保留在 App.tsx，以降低提取阶段的行为回归风险

### 12. DeviceFormModal 组件文件 — `src/components/DeviceFormModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 合并承接新增设备与编辑设备弹窗，统一平台/角色/连接方式/凭据等表单项渲染
- App.tsx 中已改为通过 `<DeviceFormModal />` 渲染新增与编辑设备窗口
- 新增与编辑仍复用 App.tsx 内的表单状态和提交 handler，先消除重复 JSX，再继续向更细粒度状态下沉

### 13. DeviceDetailModal 组件文件 — `src/components/DeviceDetailModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接设备详情弹窗中的健康概览、开放告警、健康趋势、运行数据采集视图、接口监控与设备侧动作按钮
- App.tsx 中已改为通过 `<DeviceDetailModal />` 渲染设备详情窗口
- 设备趋势洞察、连接摘要展示和运行数据分类标签映射已随组件一起下沉，进一步减少 App.tsx 视图层体积

### 14. CustomCommandModal 组件文件 — `src/components/CustomCommandModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接自定义命令弹窗中的模式切换、命令编辑、变量替换、收藏区、执行目标说明与提交动作
- App.tsx 中已改为通过 `<CustomCommandModal />` 渲染自定义命令窗口
- 执行逻辑、变量替换与快捷查询保存仍留在 App.tsx，以保证行为不变并控制拆分风险

### 15. ResultStatusModal 组件文件 — `src/components/ResultStatusModal.tsx`

- **状态**: ✅ 已完成接线与复用
- **职责**: 作为结果类弹窗的统一外壳，收敛标题区、图标区、遮罩交互与基础动效

### 16. TestConnectionResultModal 组件文件 — `src/components/TestConnectionResultModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接连接测试结果弹窗中的进度态、阶段结果、认证异常提示、原始日志与重试动作
- App.tsx 中已改为通过 `<TestConnectionResultModal />` 渲染连接测试结果窗口

### 17. SnmpTestResultModal 组件文件 — `src/components/SnmpTestResultModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接 SNMP 测试结果弹窗中的连通状态、响应时间、sysName / sysDescr 与错误信息
- App.tsx 中已改为通过 `<SnmpTestResultModal />` 渲染 SNMP 测试结果窗口

### 18. AddScenarioModal 组件文件 — `src/components/AddScenarioModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接自定义场景创建弹窗中的模板导入提示、场景基础信息、分阶段命令输入、变量摘要与创建动作
- App.tsx 中已改为通过 `<AddScenarioModal />` 渲染自定义场景创建窗口
- 场景保存逻辑、草稿重置与创建成功后的跳转仍保留在 App.tsx，以保持行为稳定并降低抽离风险

### 19. CommandPalette 组件文件 — `src/components/CommandPalette.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接全局命令面板中的页面检索、结果列表、固定入口动作与快捷键提示
- App.tsx 中已改为通过 `<CommandPalette />` 渲染命令面板
- 结果列表已改为合法的并列按钮结构，避免原先的 button 嵌套 button DOM 语义问题

### 20. Sidebar 组件文件 — `src/components/Sidebar.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接应用侧边栏中的固定入口、最近访问、导航分组、资源状态徽标、告警徽标、移动端遮罩与折叠交互
- App.tsx 中已改为通过 `<Sidebar />` 渲染整块侧边栏
- 现阶段导航状态、分组展开状态和跳转逻辑仍保留在 App.tsx，以优先完成视图层剥离并降低行为回归风险

### 21. TopHeader 组件文件 — `src/components/TopHeader.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接页面顶部栏中的标题区、通知面板、用户菜单、主题切换、语言切换与登出入口
- App.tsx 中已改为通过 `<TopHeader />` 渲染顶部栏
- 语言偏好保存逻辑已收口为 App.tsx 内的独立 handler，再通过回调传入组件，避免把接口细节留在视图层

### 22. ProfileModal 组件文件 — `src/components/ProfileModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接个人资料弹窗中的头像管理、用户名与密码表单、通知渠道开关、Webhook 配置与测试发送入口
- App.tsx 中已改为通过 `<ProfileModal />` 渲染个人资料窗口
- 资料保存、头像文件读取与通知测试请求仍保留在 App.tsx，以确保现有行为不变并控制提取风险

### 23. CommandPreviewModal 组件文件 — `src/components/CommandPreviewModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接命令预览弹窗中的场景标题、平台标识、分阶段命令渲染与“复制全部”入口
- App.tsx 中已改为通过 `<CommandPreviewModal />` 渲染命令预览窗口
- 复制内容的拼接、剪贴板降级写入与 Toast 反馈仍保留在 App.tsx，以保持现有行为与提示文案一致

### 24. ImportInventoryModal 组件文件 — `src/components/ImportInventoryModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接导入弹窗中的上传占位区、模板下载卡片、取消与开始导入动作
- App.tsx 中已改为通过 `<ImportInventoryModal />` 渲染导入窗口
- 现阶段导入动作仍沿用 App.tsx 中的模拟处理逻辑，后续若接入真实导入流程可继续在不回填视图 JSX 的前提下扩展

### 25. HistoricalConfigModal 组件文件 — `src/components/HistoricalConfigModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接历史配置弹窗中的快照元信息、配置内容预览与回滚入口
- App.tsx 中已改为通过 `<HistoricalConfigModal />` 渲染历史配置窗口
- 回滚调用仍保留在 App.tsx，并通过回调传入组件，以保持现有副作用路径与收尾状态一致

### 26. ScheduleTaskModal 组件文件 — `src/components/ScheduleTaskModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接任务调度弹窗中的调度类型切换、周期选择、执行时间与时区表单
- App.tsx 中已改为通过 `<ScheduleTaskModal />` 渲染调度窗口
- 调度提交逻辑与调度表单状态仍保留在 App.tsx，组件只负责表单视图和交互转发

### 27. RemediationModal 组件文件 — `src/components/RemediationModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接自动修复确认弹窗中的设备信息、修复说明、建议动作与执行确认入口
- App.tsx 中已改为通过 `<RemediationModal />` 渲染修复确认窗口
- 实际修复动作和状态变更仍保留在 App.tsx，以避免本轮抽离扩大到业务逻辑层

### 28. DeleteConfirmModal 组件文件 — `src/components/DeleteConfirmModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接删除确认弹窗中的单设备/批量删除提示、关闭动作与确认入口
- App.tsx 中已改为通过 `<DeleteConfirmModal />` 渲染删除确认窗口
- 删除确认后的状态清理与实际删除请求仍保留在 App.tsx，组件仅负责承载确认视图

### 29. AuditEventDetailModal 组件文件 — `src/components/AuditEventDetailModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接审计事件详情弹窗中的事件摘要、状态徽标、行为主体/目标信息与详情 JSON 展示
- App.tsx 中已改为通过 `<AuditEventDetailModal />` 渲染审计事件详情窗口
- 详情数据加载与关闭状态仍保留在 App.tsx，组件仅负责展示现有事件快照

### 30. ComplianceFindingDetailModal 组件文件 — `src/components/ComplianceFindingDetailModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接合规问题详情弹窗中的问题描述、观察值/证据、状态/负责人/备注编辑与保存入口
- App.tsx 中已改为通过 `<ComplianceFindingDetailModal />` 渲染合规问题详情窗口
- 问题状态更新、负责人修改、备注编辑和保存请求仍保留在 App.tsx，以确保接口调用路径不变

### 31. JobOutputModal 组件文件 — `src/components/JobOutputModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接 Job 输出弹窗中的状态标记、终端风格输出区与复制入口
- App.tsx 中已改为通过 `<JobOutputModal />` 渲染执行输出窗口
- 复制逻辑继续复用 App.tsx 里的剪贴板降级辅助函数与 Toast 反馈，组件不直接持有副作用

### 32. ConfigDiffModal 组件文件 — `src/components/ConfigDiffModal.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接配置差异确认弹窗中的当前配置、拟议变更与提交入口
- App.tsx 中已改为通过 `<ConfigDiffModal />` 渲染配置差异窗口
- 差异数据状态与提交动作仍保留在 App.tsx，组件只承载确认视图

### 33. ToastNotification 组件文件 — `src/components/ToastNotification.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接全局 Toast 的图标、配色、动效与消息渲染
- App.tsx 中已改为通过 `<ToastNotification />` 渲染全局提示
- Toast 的触发与清理时机仍保留在 App.tsx，组件只负责展示当前提示状态

### 34. LoginScreen 组件文件 — `src/components/LoginScreen.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接未认证态登录页中的背景装饰、品牌头图、用户名/密码输入、记住我与底部系统状态栏
- App.tsx 中已改为在 `!isAuthenticated` 分支通过 `<LoginScreen />` 渲染登录页
- 登录提交、表单状态更新、错误清理与密码显隐切换仍通过 props 回传到 App.tsx，避免在本轮把认证副作用一并迁移

### 35. TopologyInspectorPanel 组件文件 — `src/components/TopologyInspectorPanel.tsx`

- **状态**: ✅ 已完成接线与替换
- **职责**: 承接拓扑页右侧详情面板中的选中节点摘要、接口链路明细、选中链路遥测、直接邻居、优先关注与孤立节点列表
- App.tsx 中已改为通过 `<TopologyInspectorPanel />` 渲染拓扑检查面板
- 拓扑导航、选中态切换、设备详情打开与格式化辅助函数仍保留在 App.tsx，组件只负责展示与交互转发

---

## 已有独立文件（本次重构前已存在）

| 组件 | 文件 |
|------|------|
| DashboardTab | `src/pages/DashboardTab.tsx` |
| ComplianceTab | `src/pages/ComplianceTab.tsx` |
| HistoryTab | `src/pages/HistoryTab.tsx` |
| UsersTab | `src/pages/UsersTab.tsx` |
| InventoryDevicesTab | `src/pages/InventoryDevicesTab.tsx` |
| AlertDeskTab | `src/pages/AlertDeskTab.tsx` |
| AlertRulesTab | `src/pages/AlertRulesTab.tsx` |
| AlertMaintenanceTab | `src/pages/AlertMaintenanceTab.tsx` |
| ReportsTab | `src/pages/ReportsTab.tsx` |
| ConfigDriftTab | `src/pages/ConfigDriftTab.tsx` |
| CapacityPlanningTab | `src/pages/CapacityPlanningTab.tsx` |
| IPVlanTab | `src/pages/IPVlanTab.tsx` |
| DeviceHealthTab | `src/pages/DeviceHealthTab.tsx` |
| ConfigScheduleTab | `src/pages/ConfigScheduleTab.tsx` |
| AutomationScenariosTab | `src/pages/AutomationScenariosTab.tsx` |
| AutomationHistoryTab | `src/pages/AutomationHistoryTab.tsx` |
| AutomationExecuteTab | `src/pages/AutomationExecuteTab.tsx` |
| ConfigDiffViewTab | `src/pages/ConfigDiffViewTab.tsx` |
| ConfigBackupTab | `src/pages/ConfigBackupTab.tsx` |
| AutomationPlaybooksTab | `src/pages/AutomationPlaybooksTab.tsx` |
| PlatformSettingsTab | `src/pages/PlatformSettingsTab.tsx` |
| DeviceFormModal | `src/components/DeviceFormModal.tsx` |
| DeviceDetailModal | `src/components/DeviceDetailModal.tsx` |
| CustomCommandModal | `src/components/CustomCommandModal.tsx` |
| ResultStatusModal | `src/components/ResultStatusModal.tsx` |
| TestConnectionResultModal | `src/components/TestConnectionResultModal.tsx` |
| SnmpTestResultModal | `src/components/SnmpTestResultModal.tsx` |
| AddScenarioModal | `src/components/AddScenarioModal.tsx` |
| CommandPalette | `src/components/CommandPalette.tsx` |
| Sidebar | `src/components/Sidebar.tsx` |
| TopHeader | `src/components/TopHeader.tsx` |
| ProfileModal | `src/components/ProfileModal.tsx` |
| CommandPreviewModal | `src/components/CommandPreviewModal.tsx` |
| ImportInventoryModal | `src/components/ImportInventoryModal.tsx` |
| HistoricalConfigModal | `src/components/HistoricalConfigModal.tsx` |
| ScheduleTaskModal | `src/components/ScheduleTaskModal.tsx` |
| RemediationModal | `src/components/RemediationModal.tsx` |
| DeleteConfirmModal | `src/components/DeleteConfirmModal.tsx` |
| AuditEventDetailModal | `src/components/AuditEventDetailModal.tsx` |
| ComplianceFindingDetailModal | `src/components/ComplianceFindingDetailModal.tsx` |
| JobOutputModal | `src/components/JobOutputModal.tsx` |
| ConfigDiffModal | `src/components/ConfigDiffModal.tsx` |
| ToastNotification | `src/components/ToastNotification.tsx` |
| LoginScreen | `src/components/LoginScreen.tsx` |
| TopologyInspectorPanel | `src/components/TopologyInspectorPanel.tsx` |

---

## 待完成

### 内联页面组件提取（按预估复杂度排序）

| 组件 | 预估行数 | 状态 |
|------|----------|------|
| ConfigScheduleTab | ~250 行 | ✅ 已完成 |
| AutomationScenariosTab | ~240 行 | ✅ 已完成 |
| AutomationHistoryTab | ~270 行 | ✅ 已完成 |
| ConfigDiffViewTab | ~360 行 | ✅ 已完成 |
| AutomationPlaybooksTab | ~400 行 | ✅ 已完成 |
| PlatformSettingsTab | ~620 行 | ✅ 已完成 |
| ConfigBackupTab | ~690 行 | ✅ 已完成 |
| AutomationExecuteTab | ~1000 行 | ✅ 已完成 |

### 模态框提取（约 2700 行）

| 模态框 | 状态 |
|--------|------|
| AddDeviceModal | ✅ 已并入 `DeviceFormModal` |
| EditDeviceModal | ✅ 已并入 `DeviceFormModal` |
| DeviceDetailModal | ✅ 已完成 |
| CustomCommandModal | ✅ 已完成 |
| TestConnectionResultModal | ✅ 已完成 |
| SnmpTestResultModal | ✅ 已完成 |
| AddScenarioModal | ✅ 已完成 |
| CommandPreviewModal | ✅ 已完成 |
| ImportInventoryModal | ✅ 已完成 |
| HistoricalConfigModal | ✅ 已完成 |
| ScheduleTaskModal | ✅ 已完成 |
| RemediationModal | ✅ 已完成 |
| DeleteConfirmModal | ✅ 已完成 |
| AuditEventDetailModal | ✅ 已完成 |
| ComplianceFindingDetailModal | ✅ 已完成 |
| JobOutputModal | ✅ 已完成 |
| ConfigDiffModal | ✅ 已完成 |
| 其他模态框 | ⬜ 未开始 |

### 其他组件提取

| 组件 | 预估行数 | 状态 |
|------|----------|------|
| Sidebar | ~600 行 | ✅ 已完成 |
| CommandPalette | ~80 行 | ✅ 已完成 |
| TopHeader | ~220 行 | ✅ 已完成 |
| ProfileModal | ~300 行 | ✅ 已完成 |
| ToastNotification | ~30 行 | ✅ 已完成 |
| LoginScreen | ~200 行 | ✅ 已完成 |
| TopologyInspectorPanel | ~280 行 | ✅ 已完成 |

---

## 预期最终效果

- `App.tsx` 从约 13,000 行缩减至约 3,000 行（保留路由壳、全局状态、WebSocket 连接等）
- 每个页面组件独立文件，按需加载
- 类型检查通过（`npx tsc --noEmit`）
- 构建正常（`npx vite build`）
