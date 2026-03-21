import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Download,
  FileText,
  FolderOpen,
  GitCompareArrows,
  Globe,
  History,
  LayoutDashboard,
  Monitor,
  Network,
  PanelLeftClose,
  Pin,
  Search,
  Server,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { HostResourceSnapshot } from '../types';

interface RecentSidebarItem {
  path: string;
  label: string;
}

interface SidebarProps {
  isMobile: boolean;
  sidebarCollapsed: boolean;
  language: string;
  currentPath: string;
  activeTab: string;
  pinnedPaths: string[];
  recentSidebarItems: RecentSidebarItem[];
  hostResourceTone: string;
  hostResourceSummary: string;
  hostResources: HostResourceSnapshot | null;
  alertNavTone: string;
  unreadNotificationCount: number;
  realtimeSectionOpen: boolean;
  alertsSectionOpen: boolean;
  assetsSectionOpen: boolean;
  automationSectionOpen: boolean;
  capacitySectionOpen: boolean;
  managementSectionOpen: boolean;
  monitoringGroupOpen: boolean;
  alertGroupOpen: boolean;
  inventoryGroupOpen: boolean;
  automationGroupOpen: boolean;
  configGroupOpen: boolean;
  managementGroupOpen: boolean;
  t: (key: string) => string;
  getSidebarRecentLabel: (path: string) => string;
  navTo: (path: string) => void;
  setActiveTab: (tab: string) => void;
  togglePin: (path: string) => void;
  formatCompactResourcePercent: (value: number | null | undefined) => string;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setRealtimeSectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAlertsSectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAssetsSectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAutomationSectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCapacitySectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setManagementSectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMonitoringGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAlertGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInventoryGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAutomationGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfigGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setManagementGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({
  isMobile,
  sidebarCollapsed,
  language,
  currentPath,
  activeTab,
  pinnedPaths,
  recentSidebarItems,
  hostResourceTone,
  hostResourceSummary,
  hostResources,
  alertNavTone,
  unreadNotificationCount,
  realtimeSectionOpen,
  alertsSectionOpen,
  assetsSectionOpen,
  automationSectionOpen,
  capacitySectionOpen,
  managementSectionOpen,
  monitoringGroupOpen,
  alertGroupOpen,
  inventoryGroupOpen,
  automationGroupOpen,
  configGroupOpen,
  managementGroupOpen,
  t,
  getSidebarRecentLabel,
  navTo,
  setActiveTab,
  togglePin,
  formatCompactResourcePercent,
  setSidebarCollapsed,
  setRealtimeSectionOpen,
  setAlertsSectionOpen,
  setAssetsSectionOpen,
  setAutomationSectionOpen,
  setCapacitySectionOpen,
  setManagementSectionOpen,
  setMonitoringGroupOpen,
  setAlertGroupOpen,
  setInventoryGroupOpen,
  setAutomationGroupOpen,
  setConfigGroupOpen,
  setManagementGroupOpen,
}) => {
  return (
    <>
      {isMobile && !sidebarCollapsed && (
        <div className="fixed inset-0 z-[25] bg-black/50 md:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}

      <aside className={`theme-sidebar flex flex-col flex-shrink-0 shadow-2xl transition-all duration-300 ease-in-out ${
        isMobile
          ? `fixed inset-y-0 left-0 w-72 z-30 ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}`
          : `z-20 ${sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden opacity-0' : 'w-72 min-w-72'}`
      }`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00bceb] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#00bceb]/20">
              <Activity size={18} />
            </div>
            <h1 className="font-bold tracking-tight text-white whitespace-nowrap">NetPilot</h1>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            title={language === 'zh' ? '收起侧栏' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <nav className="sidebar-nav-scroll flex flex-col flex-1 px-3 py-4 space-y-1 mt-2 overflow-y-auto">
          {pinnedPaths.length > 0 && (
            <div className="px-3 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Pin size={9} className="opacity-60" />
                {language === 'zh' ? '固定' : 'PINNED'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pinnedPaths.map((path) => {
                  const label = getSidebarRecentLabel(path);
                  const active = currentPath === path;
                  return (
                    <div key={path} className="relative group/pin">
                      <button
                        onClick={() => navTo(path)}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-colors border pr-5 ${active ? 'border-[#00bceb]/45 text-[#63dbf6] bg-[#00bceb]/12' : 'border-white/10 text-white/55 hover:text-white hover:bg-white/5'}`}
                        title={label}
                      >
                        <span className="block truncate max-w-[100px]">{label}</span>
                      </button>
                      <button
                        onClick={(event) => { event.stopPropagation(); togglePin(path); }}
                        title={language === 'zh' ? '取消固定' : 'Unpin'}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/pin:opacity-100 text-white/40 hover:text-white transition-opacity p-0.5 rounded"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentSidebarItems.length > 0 && (
            <div className="px-3 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '最近访问' : 'RECENT'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recentSidebarItems.map((item) => {
                  const isPinned = pinnedPaths.includes(item.path);
                  const active = currentPath === item.path;
                  return (
                    <div key={item.path} className="relative group/recent">
                      <button
                        onClick={() => navTo(item.path)}
                        className={`max-w-full px-2.5 py-1 rounded-md text-[11px] transition-colors border pr-5 ${active ? 'border-[#00bceb]/45 text-[#63dbf6] bg-[#00bceb]/12' : 'border-white/10 text-white/55 hover:text-white hover:bg-white/5'}`}
                        title={item.label}
                      >
                        <span className="block truncate max-w-[100px]">{item.label}</span>
                      </button>
                      <button
                        onClick={(event) => { event.stopPropagation(); togglePin(item.path); }}
                        title={isPinned ? (language === 'zh' ? '取消固定' : 'Unpin') : (language === 'zh' ? '固定' : 'Pin')}
                        className={`absolute right-0.5 top-1/2 -translate-y-1/2 transition-opacity p-0.5 rounded ${isPinned ? 'opacity-70 text-[#00bceb]' : 'opacity-0 group-hover/recent:opacity-100 text-white/40 hover:text-white'}`}
                      >
                        <Pin size={9} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setRealtimeSectionOpen((value) => !value)}
            className="w-full px-3 pt-2 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${realtimeSectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '实时监控' : 'REAL-TIME'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${realtimeSectionOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <LayoutDashboard size={17} className={`shrink-0 ${activeTab === 'dashboard' ? 'text-[#00bceb]' : ''}`} />
              <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{t('dashboard')}</span>
            </button>

            <div>
              <button
                onClick={() => {
                  const next = !monitoringGroupOpen;
                  setMonitoringGroupOpen(next);
                  if (next && activeTab !== 'monitoring' && currentPath !== '/inventory/interfaces') {
                    setActiveTab('monitoring');
                  }
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  activeTab === 'monitoring' || currentPath === '/inventory/interfaces'
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <TrendingUp size={17} className={activeTab === 'monitoring' || currentPath === '/inventory/interfaces' ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '监控中心' : 'Monitoring'}</span>
                <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] mr-1 ${hostResourceTone}`} title={hostResourceSummary}>
                  {hostResources
                    ? `${formatCompactResourcePercent(hostResources.cpu_percent)}/${formatCompactResourcePercent(hostResources.memory_percent)}`
                    : '--/--'}
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                  monitoringGroupOpen
                    ? 'border-[#00bceb]/35 bg-[#00bceb]/12 text-[#7ddfff]'
                    : 'border-white/10 bg-white/[0.04] text-white/45 group-hover:border-white/20 group-hover:text-white/70'
                }`}>
                  <ChevronRight size={14} className={`transition-transform duration-200 ${monitoringGroupOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${monitoringGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-5 border-l border-slate-600/80 pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                  {([
                    { id: 'monitoring', path: null, icon: Monitor, label: language === 'zh' ? '平台资源' : 'Host Resources' },
                    { id: 'inventory-interfaces', path: '/inventory/interfaces', icon: Activity, label: t('interfaceMonitoring') },
                  ] as const).map((item) => {
                    const isActive = item.path ? currentPath === item.path : activeTab === 'monitoring';
                    return (
                      <button
                        key={item.id}
                        onClick={() => item.path ? navTo(item.path) : setActiveTab('monitoring')}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {[
              { id: 'topology', icon: Globe, label: language === 'zh' ? '网络拓扑' : 'Topology' },
              { id: 'health', icon: Activity, label: language === 'zh' ? '健康检测' : 'Health Detection' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <item.icon size={17} className={`shrink-0 ${activeTab === item.id ? 'text-[#00bceb]' : ''}`} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setAlertsSectionOpen((value) => !value)}
            className="w-full px-3 pt-5 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${alertsSectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '告警处置' : 'ALERTS'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${alertsSectionOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div>
              <button
                onClick={() => {
                  const next = !alertGroupOpen;
                  setAlertGroupOpen(next);
                  if (next && !['alerts', 'alert-rules', 'maintenance'].includes(activeTab)) {
                    setActiveTab('alerts');
                  }
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  ['alerts', 'alert-rules', 'maintenance'].includes(activeTab)
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <AlertTriangle size={17} className={['alerts', 'alert-rules', 'maintenance'].includes(activeTab) ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '告警中心' : 'Alert Center'}</span>
                <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] mr-1 ${alertNavTone}`} title={language === 'zh' ? '未读通知' : 'Unread notifications'}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
                <ChevronRight size={14} className={`text-white/30 transition-transform duration-200 ${alertGroupOpen ? 'rotate-90 text-white/55' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${alertGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5 border-l border-slate-700">
                  {([
                    { id: 'alerts', icon: AlertTriangle, label: language === 'zh' ? '告警信息' : 'Alert Desk' },
                    { id: 'alert-rules', icon: Settings, label: language === 'zh' ? '告警规则' : 'Alert Rules' },
                    { id: 'maintenance', icon: Wrench, label: language === 'zh' ? '维护期' : 'Maintenance' },
                  ] as const).map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setAssetsSectionOpen((value) => !value)}
            className="w-full px-3 pt-5 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${assetsSectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '资产与配置' : 'ASSETS & CONFIG'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${assetsSectionOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div>
              <button
                onClick={() => {
                  const next = !inventoryGroupOpen;
                  setInventoryGroupOpen(next);
                  if (next && !(currentPath.startsWith('/inventory') || activeTab === 'ipam')) navTo('/inventory/devices');
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  activeTab === 'inventory' || activeTab === 'ipam'
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Database size={17} className={activeTab === 'inventory' || activeTab === 'ipam' ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{t('inventory')}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                  inventoryGroupOpen
                    ? 'border-[#00bceb]/35 bg-[#00bceb]/12 text-[#7ddfff]'
                    : 'border-white/10 bg-white/[0.04] text-white/45 group-hover:border-white/20 group-hover:text-white/70'
                }`}>
                  <ChevronRight size={14} className={`transition-transform duration-200 ${inventoryGroupOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${inventoryGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-5 border-l border-slate-600/80 pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                  {([
                    { path: 'inventory/devices', icon: Server, label: t('deviceList') },
                    { path: 'ipam', icon: Network, label: language === 'zh' ? 'IP/VLAN管理' : 'IP/VLAN Mgmt' },
                  ] as const).map((item) => {
                    const isActive = item.path === 'ipam' ? activeTab === 'ipam' : currentPath === `/${item.path}`;
                    return (
                      <button
                        key={item.path}
                        onClick={() => item.path === 'ipam' ? setActiveTab('ipam') : navTo(`/${item.path}`)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setAutomationSectionOpen((value) => !value)}
            className="w-full px-3 pt-5 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${automationSectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '自动化与合规' : 'AUTOMATION'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${automationSectionOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div>
              <button
                onClick={() => {
                  const next = !automationGroupOpen;
                  setAutomationGroupOpen(next);
                  if (next && !currentPath.startsWith('/automation')) navTo('/automation/execute');
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  activeTab === 'automation'
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Zap size={17} className={activeTab === 'automation' ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{t('automation')}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                  automationGroupOpen
                    ? 'border-[#00bceb]/35 bg-[#00bceb]/12 text-[#7ddfff]'
                    : 'border-white/10 bg-white/[0.04] text-white/45 group-hover:border-white/20 group-hover:text-white/70'
                }`}>
                  <ChevronRight size={14} className={`transition-transform duration-200 ${automationGroupOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${automationGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-5 border-l border-slate-600/80 pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                  {([
                    { path: 'automation/execute', icon: Zap, label: t('directExecution') },
                    { path: 'automation/scenarios', icon: FolderOpen, label: t('scenarioLibrary') },
                    { path: 'automation/history', icon: History, label: t('executionHistory') },
                  ] as const).map((item) => {
                    const isActive = currentPath === `/${item.path}`;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navTo(`/${item.path}`)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => {
                  const next = !configGroupOpen;
                  setConfigGroupOpen(next);
                  if (next && !currentPath.startsWith('/config')) navTo('/config/backup');
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  activeTab === 'config' || activeTab === 'compliance'
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <FolderOpen size={17} className={activeTab === 'config' || activeTab === 'compliance' ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '配置与合规' : 'Config & Compliance'}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                  configGroupOpen
                    ? 'border-[#00bceb]/35 bg-[#00bceb]/12 text-[#7ddfff]'
                    : 'border-white/10 bg-white/[0.04] text-white/45 group-hover:border-white/20 group-hover:text-white/70'
                }`}>
                  <ChevronRight size={14} className={`transition-transform duration-200 ${configGroupOpen ? 'rotate-90' : ''}`} />
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${configGroupOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="ml-5 border-l border-slate-600/80 pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                  {([
                    { path: 'config/backup', icon: Download, label: t('backupHistory') },
                    { path: 'config/diff', icon: FileText, label: t('diffCompare') },
                    { path: 'config/search', icon: Search, label: t('configSearchTab') },
                    { path: 'config/schedule', icon: Clock, label: t('scheduledBackup') },
                    { path: 'config/drift', icon: GitCompareArrows, label: language === 'zh' ? '配置漂移' : 'Config Drift' },
                    { path: 'compliance', icon: ShieldCheck, label: t('compliance') },
                  ] as const).map((item) => {
                    const isActive = item.path === 'compliance' ? activeTab === 'compliance' : currentPath === `/${item.path}`;
                    return (
                      <button
                        key={item.path}
                        onClick={() => item.path === 'compliance' ? setActiveTab('compliance') : navTo(`/${item.path}`)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setCapacitySectionOpen((value) => !value)}
            className="w-full px-3 pt-5 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${capacitySectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '容量与报表' : 'CAPACITY'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${capacitySectionOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <button
              onClick={() => setActiveTab('capacity')}
              className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'capacity'
                  ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <Cpu size={17} className={`shrink-0 ${activeTab === 'capacity' ? 'text-[#00bceb]' : ''}`} />
              <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '容量规划' : 'Capacity'}</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reports'
                  ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <BarChart3 size={17} className={`shrink-0 ${activeTab === 'reports' ? 'text-[#00bceb]' : ''}`} />
              <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '报表中心' : 'Reports'}</span>
            </button>
          </div>

          <button
            onClick={() => setManagementSectionOpen((value) => !value)}
            className="w-full px-3 pt-5 pb-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          >
            <ChevronRight size={10} className={`text-white/30 transition-transform duration-150 shrink-0 ${managementSectionOpen ? 'rotate-90' : ''}`} />
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{language === 'zh' ? '平台管理' : 'MANAGEMENT'}</p>
          </button>
          <div className="mx-3 mb-1.5 h-px bg-white/10" />
          <div className={`space-y-1 overflow-hidden transition-all duration-200 ease-in-out ${managementSectionOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div>
              <button
                onClick={() => {
                  const next = !managementGroupOpen;
                  setManagementGroupOpen(next);
                  if (next && !['history', 'configuration', 'users'].includes(activeTab)) {
                    setActiveTab('history');
                  }
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  ['history', 'configuration', 'users'].includes(activeTab)
                    ? 'bg-slate-800/95 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Settings size={17} className={['history', 'configuration', 'users'].includes(activeTab) ? 'text-[#00bceb]' : ''} />
                <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '平台管理' : 'Management'}</span>
                <ChevronRight size={14} className={`text-white/30 transition-transform duration-200 ${managementGroupOpen ? 'rotate-90 text-white/55' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${managementGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5 border-l border-slate-700">
                  {([
                    { id: 'history', icon: History, label: t('auditLogs') },
                    { id: 'configuration', icon: Settings, label: t('configuration') },
                    { id: 'users', icon: User, label: t('userManagement') },
                  ] as const).map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700/60 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 font-medium'
                        }`}
                      >
                        {isActive ? <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" /> : <span className="w-1 h-1 flex-shrink-0" />}
                        <item.icon size={14} />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;