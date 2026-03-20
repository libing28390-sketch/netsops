# App.tsx 拆分重构进度

## 背景

`src/App.tsx` 原始文件约 **13,317 行**，包含所有页面组件、模态框、侧边栏、工具函数等，维护困难。  
目标：将其拆分为独立的组件文件，采用 `React.lazy()` + `<Suspense>` 延迟加载，降低耦合度。

## 拆分策略

- **自包含组件模式**（参考 `ConfigDriftTab`）：组件内部管理自己的状态和 API 调用，仅接收 `language`、`showToast` 等最小必要 props
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

- **状态**: 🔧 文件已创建，App.tsx 内联代码尚未替换
- **文件大小**: 522 行
- **Props**: `devices`, `devicesLastUpdatedAt`, `language`, `showToast`, `refreshDevices`
- **内部状态**: `intfSearch`, `intfDevicePage`, `intfExpandedDevice`, `intfPageMap`, `intfFilterMap`, `intfStatusFilter`, `intfSortBy`, `snmpTestingId`, `snmpSyncingId` 等
- App.tsx 中已添加 `lazy()` 导入，但内联 IIFE（约 450 行）尚未替换为 `<InterfaceMonitoringTab />` 组件调用

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

---

## 待完成

### 内联页面组件提取（按预估复杂度排序）

| 组件 | 预估行数 | 状态 |
|------|----------|------|
| InterfaceMonitoringTab（App.tsx 内联替换） | ~450 行 | ⬜ 待替换 |
| ConfigSearchTab | ~215 行 | ⬜ 未开始 |
| ConfigScheduleTab | ~250 行 | ⬜ 未开始 |
| AutomationScenariosTab | ~240 行 | ⬜ 未开始 |
| AutomationHistoryTab | ~270 行 | ⬜ 未开始 |
| ConfigDiffViewTab | ~360 行 | ⬜ 未开始 |
| AutomationPlaybooksTab | ~400 行 | ⬜ 未开始 |
| PlatformSettingsTab | ~620 行 | ⬜ 未开始 |
| ConfigBackupTab | ~690 行 | ⬜ 未开始 |
| AutomationExecuteTab | ~1000 行 | ⬜ 未开始 |

### 模态框提取（约 2700 行）

| 模态框 | 状态 |
|--------|------|
| AddDeviceModal | ⬜ 未开始 |
| EditDeviceModal | ⬜ 未开始 |
| DeviceDetailModal | ⬜ 未开始 |
| 其他模态框 | ⬜ 未开始 |

### 其他组件提取

| 组件 | 预估行数 | 状态 |
|------|----------|------|
| Sidebar | ~600 行 | ⬜ 未开始 |
| CommandPalette | ~80 行 | ⬜ 未开始 |

---

## 预期最终效果

- `App.tsx` 从约 13,000 行缩减至约 3,000 行（保留路由壳、全局状态、WebSocket 连接等）
- 每个页面组件独立文件，按需加载
- 类型检查通过（`npx tsc --noEmit`）
- 构建正常（`npx vite build`）
