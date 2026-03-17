import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Network, Plus, Trash2, AlertTriangle, RefreshCw, Download, Search, X, ChevronRight, ShieldAlert, ClipboardList, RotateCcw, Ticket, CheckCircle2, Clock3 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { sectionHeaderRowClass } from '../components/shared';

interface Subnet {
  id: string;
  name: string;
  network: string;
  prefix_len: number;
  vlan_id: number | null;
  vlan_name: string;
  gateway: string;
  description: string;
  site: string;
  status: string;
  total_ips: number;
  used_ips: number;
  utilization: number;
}

interface IPAddress {
  id: string;
  subnet_id: string;
  address: string;
  hostname: string;
  device_id: string;
  interface_name: string;
  mac_address: string;
  status: string;
  description: string;
  last_seen: string;
}

interface Conflict {
  ip_conflicts: { address: string; subnets: string; cnt: number }[];
  mac_conflicts: { mac_address: string; addresses: string; cnt: number }[];
  total_conflicts: number;
}

interface IPVlanTabProps {
  language: string;
  t: (key: string) => string;
}

type PrecheckStatus = 'idle' | 'pass' | 'fail';

type TicketStatus = 'open' | 'processing' | 'resolved';

const IPVLAN_MINIMAL_MODE_KEY = 'ipVlan.minimalMode';
const IPVLAN_ACTION_PANEL_KEY = 'ipVlan.actionPanelOpen';

const IPVlanTab: React.FC<IPVlanTabProps> = ({ language, t }) => {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const [addresses, setAddresses] = useState<IPAddress[]>([]);
  const [conflicts, setConflicts] = useState<Conflict>({ ip_conflicts: [], mac_conflicts: [], total_conflicts: 0 });
  const [summary, setSummary] = useState({ total_subnets: 0, total_addresses: 0, total_capacity: 0, total_used: 0, high_utilization_subnets: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [utilFilter, setUtilFilter] = useState<'all' | 'high' | 'critical'>('all');
  const [subnetSort, setSubnetSort] = useState<'util_desc' | 'name_asc'>('util_desc');
  const [riskOnlyMode, setRiskOnlyMode] = useState(true);
  const [minimalMode, setMinimalMode] = useState(true);
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [precheckStatus, setPrecheckStatus] = useState<PrecheckStatus>('idle');
  const [precheckTarget, setPrecheckTarget] = useState('');
  const [lastRollbackAt, setLastRollbackAt] = useState('');
  const [ticketStatusMap, setTicketStatusMap] = useState<Record<string, TicketStatus>>({});
  const [showAddSubnet, setShowAddSubnet] = useState(false);
  const [showAddIP, setShowAddIP] = useState(false);
  const [formSubnet, setFormSubnet] = useState({ name: '', network: '', prefix_len: 24, vlan_id: '', vlan_name: '', gateway: '', description: '', site: '' });
  const [formIP, setFormIP] = useState({ address: '', hostname: '', interface_name: '', mac_address: '', description: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, conflictRes, summaryRes] = await Promise.all([
        fetch(`/api/ipam/subnets?q=${encodeURIComponent(search)}`),
        fetch('/api/ipam/conflicts'),
        fetch('/api/ipam/summary'),
      ]);
      if (subRes.ok) setSubnets(await subRes.json());
      if (conflictRes.ok) setConflicts(await conflictRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedMinimalMode = window.localStorage.getItem(IPVLAN_MINIMAL_MODE_KEY);
    const savedActionPanelOpen = window.localStorage.getItem(IPVLAN_ACTION_PANEL_KEY);
    if (savedMinimalMode === 'true' || savedMinimalMode === 'false') {
      setMinimalMode(savedMinimalMode === 'true');
    }
    if (savedActionPanelOpen === 'true' || savedActionPanelOpen === 'false') {
      setActionPanelOpen(savedActionPanelOpen === 'true');
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IPVLAN_MINIMAL_MODE_KEY, String(minimalMode));
  }, [minimalMode]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IPVLAN_ACTION_PANEL_KEY, String(actionPanelOpen));
  }, [actionPanelOpen]);

  const loadAddresses = async (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    try {
      const r = await fetch(`/api/ipam/subnets/${subnet.id}/addresses`);
      if (r.ok) setAddresses(await r.json());
    } catch { /* ignore */ }
  };

  const handleAddSubnet = async () => {
    try {
      const r = await fetch('/api/ipam/subnets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formSubnet,
          vlan_id: formSubnet.vlan_id ? parseInt(formSubnet.vlan_id) : null,
        }),
      });
      if (r.ok) {
        setShowAddSubnet(false);
        setFormSubnet({ name: '', network: '', prefix_len: 24, vlan_id: '', vlan_name: '', gateway: '', description: '', site: '' });
        loadData();
      }
    } catch { /* ignore */ }
  };

  const handleAddIP = async () => {
    if (!selectedSubnet) return;
    try {
      const r = await fetch(`/api/ipam/subnets/${selectedSubnet.id}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formIP),
      });
      if (r.ok) {
        setShowAddIP(false);
        setFormIP({ address: '', hostname: '', interface_name: '', mac_address: '', description: '' });
        loadAddresses(selectedSubnet);
        loadData();
      }
    } catch { /* ignore */ }
  };

  const handleDeleteSubnet = async (id: string) => {
    try {
      await fetch(`/api/ipam/subnets/${id}`, { method: 'DELETE' });
      if (selectedSubnet?.id === id) {
        setSelectedSubnet(null);
        setAddresses([]);
      }
      loadData();
    } catch { /* ignore */ }
  };

  const handleDeleteIP = async (id: string) => {
    try {
      await fetch(`/api/ipam/addresses/${id}`, { method: 'DELETE' });
      if (selectedSubnet) loadAddresses(selectedSubnet);
      loadData();
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    if (subnets.length > 0) {
      const subData = subnets.map(s => ({
        Name: s.name,
        Network: `${s.network}/${s.prefix_len}`,
        'VLAN ID': s.vlan_id || '',
        'VLAN Name': s.vlan_name,
        Gateway: s.gateway,
        Site: s.site,
        'Total IPs': s.total_ips,
        'Used IPs': s.used_ips,
        'Utilization': `${s.utilization}%`,
        Description: s.description,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subData), 'Subnets');
    }
    if (addresses.length > 0) {
      const addrData = addresses.map(a => ({
        Address: a.address,
        Hostname: a.hostname,
        Interface: a.interface_name,
        MAC: a.mac_address,
        Status: a.status,
        Description: a.description,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(addrData), 'Addresses');
    }
    XLSX.writeFile(wb, 'ipam_export.xlsx');
  };

  const utilColor = (pct: number) => pct >= 90 ? 'text-red-600' : pct >= 80 ? 'text-orange-500' : pct >= 50 ? 'text-[#00172D]' : 'text-emerald-600';
  const utilBarColor = (pct: number) => pct >= 90 ? '#ef4444' : pct >= 80 ? '#f97316' : pct >= 50 ? '#00bceb' : '#10b981';

  const overallUtil = summary.total_capacity > 0 ? Math.round(summary.total_used / summary.total_capacity * 100) : 0;
  const highUtilSubnets = subnets.filter((subnet) => subnet.utilization >= 80).length;
  const criticalUtilSubnets = subnets.filter((subnet) => subnet.utilization >= 90).length;
  const conflictHintText = useMemo(() => `${conflicts.ip_conflicts.map((item) => `${item.address} ${item.subnets}`).join(' ')} ${conflicts.mac_conflicts.map((item) => `${item.mac_address} ${item.addresses}`).join(' ')}`.toLowerCase(), [conflicts]);
  const subnetRiskScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    subnets.forEach((subnet) => {
      const nameHint = `${subnet.name} ${subnet.network}/${subnet.prefix_len}`.toLowerCase();
      const hasConflictHint = conflictHintText.includes(subnet.network.toLowerCase()) || conflictHintText.includes(nameHint);
      const siteHint = String(subnet.site || '').toLowerCase();
      const criticalSite = ['core', 'prod', 'dc', 'edge'].some((keyword) => siteHint.includes(keyword));
      const baseScore = Math.min(60, Math.round(subnet.utilization * 0.6));
      const conflictScore = hasConflictHint ? 30 : 0;
      const siteScore = criticalSite ? 10 : 0;
      map.set(subnet.id, Math.min(100, baseScore + conflictScore + siteScore));
    });
    return map;
  }, [subnets, conflictHintText]);
  const riskSubnetCount = useMemo(() => subnets.filter((subnet) => (subnetRiskScoreMap.get(subnet.id) || 0) >= 70).length, [subnets, subnetRiskScoreMap]);
  const visibleSubnets = useMemo(() => {
    const filtered = subnets.filter((subnet) => {
      const riskScore = subnetRiskScoreMap.get(subnet.id) || 0;
      if (riskOnlyMode && riskScore < 70) return false;
      if (utilFilter === 'critical') return subnet.utilization >= 90;
      if (utilFilter === 'high') return subnet.utilization >= 80;
      return true;
    });
    if (subnetSort === 'name_asc') {
      return [...filtered].sort((left, right) => String(left.name || `${left.network}/${left.prefix_len}`).localeCompare(String(right.name || `${right.network}/${right.prefix_len}`)));
    }
    return [...filtered].sort((left, right) => (subnetRiskScoreMap.get(right.id) || 0) - (subnetRiskScoreMap.get(left.id) || 0) || right.utilization - left.utilization || String(left.network).localeCompare(String(right.network)));
  }, [subnets, utilFilter, subnetSort, riskOnlyMode, subnetRiskScoreMap]);
  const validationRows = useMemo(() => visibleSubnets.slice(0, 5).map((subnet) => {
    const sviOk = Boolean(subnet.gateway);
    const dhcpScopeOk = subnet.total_ips > subnet.used_ips;
    const relayOk = subnet.vlan_id !== null;
    const passCount = [sviOk, dhcpScopeOk, relayOk].filter(Boolean).length;
    return {
      subnet,
      sviOk,
      dhcpScopeOk,
      relayOk,
      status: passCount === 3 ? 'pass' : passCount === 2 ? 'warning' : 'fail',
    };
  }), [visibleSubnets]);
  const conflictRows = useMemo(() => {
    const ipRows = conflicts.ip_conflicts.slice(0, 4).map((item, idx) => ({
      id: `ip-${idx}-${item.address}`,
      type: 'ip' as const,
      key: item.address,
      detail: language === 'zh' ? `重复出现 ${item.cnt} 次` : `${item.cnt} duplicate records`,
      impact: item.cnt >= 3 ? 'high' : item.cnt === 2 ? 'medium' : 'low',
    }));
    const macRows = conflicts.mac_conflicts.slice(0, 4).map((item, idx) => ({
      id: `mac-${idx}-${item.mac_address}`,
      type: 'mac' as const,
      key: item.mac_address,
      detail: language === 'zh' ? `关联 ${item.cnt} 个地址` : `${item.cnt} linked addresses`,
      impact: item.cnt >= 3 ? 'high' : item.cnt === 2 ? 'medium' : 'low',
    }));
    return [...ipRows, ...macRows];
  }, [conflicts, language]);

  const runPrecheck = () => {
    const targetSubnet = selectedSubnet || visibleSubnets[0];
    if (!targetSubnet) return;
    const pass = Boolean(targetSubnet.gateway) && targetSubnet.vlan_id !== null && targetSubnet.utilization < 95;
    setPrecheckStatus(pass ? 'pass' : 'fail');
    setPrecheckTarget(targetSubnet.name || `${targetSubnet.network}/${targetSubnet.prefix_len}`);
  };

  const runRollback = () => {
    setLastRollbackAt(new Date().toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }));
  };

  const createOrUpdateTicket = (id: string) => {
    setTicketStatusMap((prev) => {
      const current = prev[id];
      if (!current) return { ...prev, [id]: 'open' };
      if (current === 'open') return { ...prev, [id]: 'processing' };
      if (current === 'processing') return { ...prev, [id]: 'resolved' };
      return prev;
    });
  };
  const toggleMinimalMode = () => {
    setMinimalMode((prev) => {
      const next = !prev;
      setActionPanelOpen(!next);
      return next;
    });
  };
  const showActionPanel = !minimalMode || actionPanelOpen;

  return (
    <div className="space-y-4 overflow-auto h-full pb-2">
      <div className={sectionHeaderRowClass}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#00172D]">
            {language === 'zh' ? 'IP/VLAN 资源管理' : 'IP/VLAN Management'}
          </h2>
          <p className="text-sm text-black/40">
            {language === 'zh' ? '子网与IP地址分配管理，冲突检测' : 'Subnet & IP address management with conflict detection'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={toggleMinimalMode}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${minimalMode ? 'border-black/15 text-black/60 hover:border-black/25 hover:text-black/75' : 'border-[#00bceb]/35 bg-[#00bceb]/10 text-[#007b9a]'}`}
          >
            <ChevronRight size={12} className={`transition-transform ${minimalMode ? '-rotate-90' : 'rotate-90'}`} />
            {minimalMode ? (language === 'zh' ? '极简模式' : 'Minimal') : (language === 'zh' ? '完整模式' : 'Full')}
          </button>
          {minimalMode && (
            <button
              type="button"
              onClick={() => setActionPanelOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${actionPanelOpen ? 'border-[#00bceb]/35 bg-[#00bceb]/10 text-[#007b9a]' : 'border-black/15 text-black/60 hover:border-black/25 hover:text-black/75'}`}
            >
              <ChevronRight size={12} className={`transition-transform ${actionPanelOpen ? 'rotate-180' : 'rotate-0'}`} />
              {actionPanelOpen ? (language === 'zh' ? '收起处置栏' : 'Hide Actions') : (language === 'zh' ? '展开处置栏' : 'Show Actions')}
            </button>
          )}
          <button onClick={handleExport} className="p-1.5 rounded-lg border border-black/10 text-black/40 hover:text-[#00bceb] hover:border-[#00bceb]/30 transition-all" title={language === 'zh' ? '导出' : 'Export'}>
            <Download size={14} />
          </button>
          <button onClick={() => setShowAddSubnet(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00bceb] text-white text-sm font-semibold hover:bg-[#00a5d0] transition-all">
            <Plus size={14} />
            {language === 'zh' ? '添加子网' : 'Add Subnet'}
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#00172D]">{language === 'zh' ? '资源总览' : 'Resource Overview'}</h3>
          {conflicts.total_conflicts > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              <AlertTriangle size={11} />
              {language === 'zh' ? `${conflicts.total_conflicts} 个冲突待处理` : `${conflicts.total_conflicts} conflicts`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: language === 'zh' ? '子网总数' : 'Subnets', value: summary.total_subnets },
            { label: language === 'zh' ? '总容量' : 'Total IPs', value: summary.total_capacity },
            { label: language === 'zh' ? '已使用' : 'Used IPs', value: summary.total_used },
            { label: language === 'zh' ? '利用率' : 'Utilization', value: `${overallUtil}%`, color: utilColor(overallUtil) },
            { label: language === 'zh' ? '高风险网段' : 'Risky Subnets', value: riskSubnetCount, color: riskSubnetCount > 0 ? 'text-red-600' : 'text-emerald-600' },
          ].map((card, i) => (
            <div key={i} className="rounded-xl border border-black/8 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/30">{card.label}</p>
              <p className={`text-xl font-bold monitoring-data mt-1 ${card.color || 'text-[#00172D]'}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className={`col-span-12 ${showActionPanel ? 'xl:col-span-7' : ''} space-y-4`}>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 bg-black/[0.02]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-[#00172D]">{language === 'zh' ? '网段工作台' : 'Subnet Workspace'}</h3>
                <button
                  type="button"
                  onClick={() => setSubnetSort((prev) => prev === 'util_desc' ? 'name_asc' : 'util_desc')}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-black/50 transition-all hover:border-black/20 hover:text-black/70"
                  title={language === 'zh' ? '切换排序' : 'Toggle sort'}
                >
                  <ChevronRight size={12} className={`transition-transform ${subnetSort === 'name_asc' ? 'rotate-90' : 'rotate-0'}`} />
                  <span>{subnetSort === 'util_desc' ? (language === 'zh' ? '按风险/利用率' : 'By Risk/Util') : (language === 'zh' ? '按名称' : 'By Name')}</span>
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={language === 'zh' ? '搜索子网/VLAN...' : 'Search subnets...'} className="w-full pl-9 pr-3 py-2 text-sm border border-black/10 rounded-lg outline-none focus:border-[#00bceb]/50" />
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5">
                  {([
                    { id: 'all', label: language === 'zh' ? '全部' : 'All', count: subnets.length },
                    { id: 'high', label: language === 'zh' ? '高利用率' : 'High', count: highUtilSubnets },
                    { id: 'critical', label: language === 'zh' ? '紧急' : 'Critical', count: criticalUtilSubnets },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setUtilFilter(item.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${utilFilter === item.id ? 'border-[#00bceb]/45 bg-[#00bceb]/10 text-[#007b9a]' : 'border-black/10 text-black/45 hover:border-black/20 hover:text-black/65'}`}
                    >
                      <span>{item.label}</span>
                      <span className="monitoring-data">{item.count}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setRiskOnlyMode((prev) => !prev)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${riskOnlyMode ? 'border-red-300 bg-red-50 text-red-700' : 'border-black/15 text-black/55 hover:border-black/20 hover:text-black/70'}`}
                >
                  <CheckCircle2 size={11} />
                  {language === 'zh' ? '风险优先' : 'Risk First'}
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-black/5">
              {visibleSubnets.length === 0 && !loading && (
                <div className="py-16 text-center text-sm text-black/30">
                  {subnets.length === 0
                    ? (language === 'zh' ? '暂无子网，点击"添加子网"开始' : 'No subnets. Click "Add Subnet" to start.')
                    : (language === 'zh' ? '当前筛选条件下没有子网' : 'No subnets under current filter.')}
                </div>
              )}
              {visibleSubnets.map(subnet => (
                <button key={subnet.id} onClick={() => loadAddresses(subnet)} className={`w-full text-left px-4 py-3 hover:bg-black/[0.02] transition-colors ${selectedSubnet?.id === subnet.id ? 'bg-[#00bceb]/5 border-l-[3px] border-l-[#00bceb]' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Network size={14} className="text-[#00bceb] flex-shrink-0" />
                        <p className="text-sm font-semibold text-[#00172D] truncate">{subnet.name || `${subnet.network}/${subnet.prefix_len}`}</p>
                      </div>
                      <p className="text-[11px] text-black/40 mt-0.5">{subnet.network}/{subnet.prefix_len} {subnet.vlan_id ? `· VLAN ${subnet.vlan_id}` : ''} {subnet.site ? `· ${subnet.site}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-[10px] font-semibold text-black/35 monitoring-data">RISK {(subnetRiskScoreMap.get(subnet.id) || 0)}</p>
                      <p className={`text-xs font-bold monitoring-data ${utilColor(subnet.utilization)}`}>{subnet.utilization}%</p>
                      <p className="text-[10px] text-black/30 monitoring-data">{subnet.used_ips}/{subnet.total_ips}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, subnet.utilization)}%`, backgroundColor: utilBarColor(subnet.utilization) }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!minimalMode && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              {!selectedSubnet ? (
                <div className="flex flex-col items-center justify-center h-[340px]">
                  <Network size={40} className="text-black/10 mb-3" />
                  <p className="text-sm text-black/30">{language === 'zh' ? '选择子网查看IP分配' : 'Select a subnet to view IP assignments'}</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="px-4 py-3 border-b border-black/5 bg-black/[0.02] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#00172D]">{selectedSubnet.name || selectedSubnet.network}/{selectedSubnet.prefix_len}</p>
                      <p className="text-[11px] text-black/40">
                        {selectedSubnet.vlan_id ? `VLAN ${selectedSubnet.vlan_id} (${selectedSubnet.vlan_name})` : ''} {selectedSubnet.gateway ? `· GW: ${selectedSubnet.gateway}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddIP(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00bceb] text-white text-xs font-semibold hover:bg-[#00a5d0] transition-all">
                        <Plus size={12} />
                        {language === 'zh' ? '添加IP' : 'Add IP'}
                      </button>
                      <button onClick={() => handleDeleteSubnet(selectedSubnet.id)} className="p-1.5 rounded-lg border border-black/10 text-black/40 hover:text-red-500 hover:border-red-300 transition-all" title={language === 'zh' ? '删除子网' : 'Delete Subnet'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[360px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/[0.01] border-b border-black/5">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40">{language === 'zh' ? 'IP地址' : 'Address'}</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40">{language === 'zh' ? '主机名' : 'Hostname'}</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40">{language === 'zh' ? '接口' : 'Interface'}</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40">MAC</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/40">{language === 'zh' ? '操作' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {addresses.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-black/30">{language === 'zh' ? '暂无IP分配记录' : 'No IP assignments'}</td></tr>
                        )}
                        {addresses.map(addr => (
                          <tr key={addr.id} className="border-b border-black/5 hover:bg-black/[0.01]">
                            <td className="px-4 py-3 text-sm font-mono font-semibold text-[#00172D]">{addr.address}</td>
                            <td className="px-4 py-3 text-xs text-black/60">{addr.hostname || '-'}</td>
                            <td className="px-4 py-3 text-xs text-black/60">{addr.interface_name || '-'}</td>
                            <td className="px-4 py-3 text-xs font-mono text-black/40">{addr.mac_address || '-'}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleDeleteIP(addr.id)} className="p-1 rounded text-black/30 hover:text-red-500 transition-colors" title={language === 'zh' ? '删除' : 'Delete'}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showActionPanel && (
          <div className="col-span-12 xl:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/35">{language === 'zh' ? '变更保障' : 'Change Safety'}</p>
                <h3 className="text-base font-semibold text-[#00172D] mt-1">{language === 'zh' ? '风险与预检' : 'Risk & Pre-check'}</h3>
              </div>
              <ShieldAlert size={16} className="text-red-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg border border-black/10 px-2.5 py-2">
                <p className="text-[10px] text-black/35 uppercase">{language === 'zh' ? '风险网段' : 'Risky'}</p>
                <p className="text-base font-bold text-red-600 monitoring-data">{riskSubnetCount}</p>
              </div>
              <div className="rounded-lg border border-black/10 px-2.5 py-2">
                <p className="text-[10px] text-black/35 uppercase">{language === 'zh' ? '冲突' : 'Conflicts'}</p>
                <p className="text-base font-bold text-orange-500 monitoring-data">{conflicts.total_conflicts}</p>
              </div>
              <div className="rounded-lg border border-black/10 px-2.5 py-2">
                <p className="text-[10px] text-black/35 uppercase">{language === 'zh' ? '利用率' : 'Util'}</p>
                <p className="text-base font-bold text-[#00172D] monitoring-data">{overallUtil}%</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-black/10 px-3 py-2">
              <p className="text-xs text-black/45">{language === 'zh' ? '当前目标' : 'Current Target'}</p>
              <p className="text-sm font-semibold text-[#00172D] mt-0.5">{precheckTarget || (selectedSubnet?.name || selectedSubnet?.network || (language === 'zh' ? '未选择网段' : 'No subnet selected'))}</p>
              <p className={`text-xs mt-2 ${precheckStatus === 'pass' ? 'text-emerald-600' : precheckStatus === 'fail' ? 'text-red-600' : 'text-black/40'}`}>
                {precheckStatus === 'pass'
                  ? (language === 'zh' ? '预检通过：可执行变更' : 'Pre-check passed: ready to change')
                  : precheckStatus === 'fail'
                    ? (language === 'zh' ? '预检失败：建议先修复配置项' : 'Pre-check failed: fix config before change')
                    : (language === 'zh' ? '尚未执行预检' : 'Pre-check not executed')}
              </p>
              {lastRollbackAt && (
                <p className="text-[11px] text-black/40 mt-1">{language === 'zh' ? `最近回滚：${lastRollbackAt}` : `Last rollback: ${lastRollbackAt}`}</p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={runPrecheck} className="inline-flex items-center gap-1.5 rounded-lg bg-[#00bceb] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00a5d0] transition-all">
                <RefreshCw size={12} />
                {language === 'zh' ? '执行预检' : 'Run Pre-check'}
              </button>
              <button type="button" onClick={runRollback} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all">
                <RotateCcw size={12} />
                {language === 'zh' ? '一键回滚' : 'Rollback'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/35">{language === 'zh' ? '联动校验' : 'Linked Validation'}</p>
                <h3 className="text-base font-semibold text-[#00172D] mt-1">{language === 'zh' ? 'VLAN-SVI-DHCP 校验' : 'VLAN-SVI-DHCP Checks'}</h3>
              </div>
              <ClipboardList size={16} className="text-[#00bceb]" />
            </div>
            <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {validationRows.length === 0 && (
                <p className="text-xs text-black/35">{language === 'zh' ? '暂无可校验网段' : 'No subnets for validation'}</p>
              )}
              {validationRows.map((item) => (
                <div key={item.subnet.id} className="rounded-xl border border-black/8 px-3 py-2">
                  <p className="text-xs font-semibold text-[#00172D] truncate">{item.subnet.name || `${item.subnet.network}/${item.subnet.prefix_len}`}</p>
                  <p className="text-[11px] text-black/45 mt-1">
                    SVI {item.sviOk ? '✓' : '✕'} · DHCP {item.dhcpScopeOk ? '✓' : '✕'} · Relay {item.relayOk ? '✓' : '✕'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/35">{language === 'zh' ? '冲突处置' : 'Conflict Handling'}</p>
                <h3 className="text-base font-semibold text-[#00172D] mt-1">{language === 'zh' ? '定位与工单' : 'Localization & Ticketing'}</h3>
              </div>
              <Ticket size={16} className="text-[#00bceb]" />
            </div>
            {conflictRows.length === 0 ? (
              <p className="text-xs text-black/35">{language === 'zh' ? '当前无冲突。' : 'No conflicts currently.'}</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {conflictRows.map((item) => {
                  const status = ticketStatusMap[item.id];
                  const statusLabel = status === 'open'
                    ? (language === 'zh' ? '已建单' : 'Open')
                    : status === 'processing'
                      ? (language === 'zh' ? '处理中' : 'Processing')
                      : status === 'resolved'
                        ? (language === 'zh' ? '已解决' : 'Resolved')
                        : (language === 'zh' ? '未建单' : 'No ticket');
                  return (
                    <div key={item.id} className="rounded-xl border border-black/10 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#00172D] truncate">{item.type.toUpperCase()} {item.key}</p>
                        <p className="text-[11px] text-black/45">{item.detail} · {item.impact.toUpperCase()}</p>
                        <p className="text-[11px] mt-1 text-black/35 inline-flex items-center gap-1"><Clock3 size={11} />{statusLabel}</p>
                      </div>
                      <button type="button" onClick={() => createOrUpdateTicket(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-black/15 px-2 py-1 text-[11px] font-semibold text-black/65 hover:border-black/30 hover:text-black/85 transition-all">
                        <Ticket size={11} />
                        {status ? (language === 'zh' ? '推进状态' : 'Advance') : (language === 'zh' ? '创建工单' : 'Create')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {showAddSubnet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80]" onClick={() => setShowAddSubnet(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[#00172D]">{language === 'zh' ? '添加子网' : 'Add Subnet'}</h3>
              <button onClick={() => setShowAddSubnet(false)} className="p-1 text-black/30 hover:text-black/60" title="Close"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '名称' : 'Name'}</label>
                <input value={formSubnet.name} onChange={e => setFormSubnet(f => ({ ...f, name: e.target.value }))} placeholder="Subnet-A" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '网段' : 'Network'}*</label>
                <input value={formSubnet.network} onChange={e => setFormSubnet(f => ({ ...f, network: e.target.value }))} placeholder="192.168.1.0" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '掩码' : 'Prefix'}*</label>
                <input type="number" value={formSubnet.prefix_len} onChange={e => setFormSubnet(f => ({ ...f, prefix_len: parseInt(e.target.value) || 24 }))} min={8} max={30} placeholder="24" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">VLAN ID</label>
                <input value={formSubnet.vlan_id} onChange={e => setFormSubnet(f => ({ ...f, vlan_id: e.target.value }))} placeholder="100" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? 'VLAN名称' : 'VLAN Name'}</label>
                <input value={formSubnet.vlan_name} onChange={e => setFormSubnet(f => ({ ...f, vlan_name: e.target.value }))} placeholder="Management" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '网关' : 'Gateway'}</label>
                <input value={formSubnet.gateway} onChange={e => setFormSubnet(f => ({ ...f, gateway: e.target.value }))} placeholder="192.168.1.1" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '站点' : 'Site'}</label>
                <input value={formSubnet.site} onChange={e => setFormSubnet(f => ({ ...f, site: e.target.value }))} placeholder="DC-1" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '描述' : 'Description'}</label>
                <input value={formSubnet.description} onChange={e => setFormSubnet(f => ({ ...f, description: e.target.value }))} placeholder="..." className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAddSubnet(false)} className="px-4 py-2 text-sm text-black/50 hover:text-black/70">{language === 'zh' ? '取消' : 'Cancel'}</button>
              <button onClick={handleAddSubnet} disabled={!formSubnet.network} className="px-5 py-2 rounded-xl bg-[#00bceb] text-white text-sm font-semibold hover:bg-[#00a5d0] disabled:opacity-40">{language === 'zh' ? '添加' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddIP && selectedSubnet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80]" onClick={() => setShowAddIP(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[#00172D]">{language === 'zh' ? '添加IP地址' : 'Add IP Address'}</h3>
              <button onClick={() => setShowAddIP(false)} className="p-1 text-black/30 hover:text-black/60" title="Close"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? 'IP地址' : 'Address'}*</label>
                <input value={formIP.address} onChange={e => setFormIP(f => ({ ...f, address: e.target.value }))} placeholder="192.168.1.10" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '主机名' : 'Hostname'}</label>
                <input value={formIP.hostname} onChange={e => setFormIP(f => ({ ...f, hostname: e.target.value }))} placeholder="switch-01" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '接口' : 'Interface'}</label>
                <input value={formIP.interface_name} onChange={e => setFormIP(f => ({ ...f, interface_name: e.target.value }))} placeholder="GigabitEthernet0/1" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">MAC</label>
                <input value={formIP.mac_address} onChange={e => setFormIP(f => ({ ...f, mac_address: e.target.value }))} placeholder="00:11:22:33:44:55" className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-black/40 uppercase">{language === 'zh' ? '描述' : 'Description'}</label>
                <input value={formIP.description} onChange={e => setFormIP(f => ({ ...f, description: e.target.value }))} placeholder="..." className="w-full mt-1 px-3 py-2 border border-black/10 rounded-lg text-sm outline-none focus:border-[#00bceb]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAddIP(false)} className="px-4 py-2 text-sm text-black/50 hover:text-black/70">{language === 'zh' ? '取消' : 'Cancel'}</button>
              <button onClick={handleAddIP} disabled={!formIP.address} className="px-5 py-2 rounded-xl bg-[#00bceb] text-white text-sm font-semibold hover:bg-[#00a5d0] disabled:opacity-40">{language === 'zh' ? '添加' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IPVlanTab;
