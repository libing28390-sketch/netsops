import React, { useState, useEffect, useCallback } from 'react';
import { Network, Plus, Trash2, AlertTriangle, RefreshCw, Download, Search, X, ChevronRight } from 'lucide-react';
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

const IPVlanTab: React.FC<IPVlanTabProps> = ({ language, t }) => {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const [addresses, setAddresses] = useState<IPAddress[]>([]);
  const [conflicts, setConflicts] = useState<Conflict>({ ip_conflicts: [], mac_conflicts: [], total_conflicts: 0 });
  const [summary, setSummary] = useState({ total_subnets: 0, total_addresses: 0, total_capacity: 0, total_used: 0, high_utilization_subnets: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  return (
    <div className="space-y-5 overflow-auto h-full">
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
          <button onClick={handleExport} className="p-1.5 rounded-lg border border-black/10 text-black/40 hover:text-[#00bceb] hover:border-[#00bceb]/30 transition-all" title={language === 'zh' ? '导出' : 'Export'}>
            <Download size={14} />
          </button>
          <button onClick={() => setShowAddSubnet(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00bceb] text-white text-sm font-semibold hover:bg-[#00a5d0] transition-all">
            <Plus size={14} />
            {language === 'zh' ? '添加子网' : 'Add Subnet'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: language === 'zh' ? '子网总数' : 'Subnets', value: summary.total_subnets },
          { label: language === 'zh' ? '总容量' : 'Total IPs', value: summary.total_capacity },
          { label: language === 'zh' ? '已使用' : 'Used IPs', value: summary.total_used },
          { label: language === 'zh' ? '利用率' : 'Utilization', value: `${overallUtil}%`, color: utilColor(overallUtil) },
          { label: language === 'zh' ? '冲突' : 'Conflicts', value: conflicts.total_conflicts, color: conflicts.total_conflicts > 0 ? 'text-red-600' : 'text-emerald-600', border: conflicts.total_conflicts > 0 ? 'border-l-[3px] border-l-red-500' : '' },
        ].map((card, i) => (
          <div key={i} className={`bg-white px-5 py-4 rounded-2xl shadow-sm border border-black/5 ${(card as any).border || ''}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-black/30 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold monitoring-data ${(card as any).color || 'text-[#00172D]'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Conflicts Banner */}
      {conflicts.total_conflicts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">{language === 'zh' ? `发现 ${conflicts.total_conflicts} 个地址冲突` : `${conflicts.total_conflicts} Address Conflicts Detected`}</span>
          </div>
          <div className="space-y-1">
            {conflicts.ip_conflicts.map((c, i) => (
              <p key={`ip-${i}`} className="text-xs text-red-600">IP {c.address} — {language === 'zh' ? '在多个子网中重复' : 'duplicated across subnets'}</p>
            ))}
            {conflicts.mac_conflicts.map((c, i) => (
              <p key={`mac-${i}`} className="text-xs text-red-600">MAC {c.mac_address} — {language === 'zh' ? '关联多个IP' : `associated with ${c.addresses}`}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Subnet List */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 bg-black/[0.02]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={language === 'zh' ? '搜索子网/VLAN...' : 'Search subnets...'} className="w-full pl-9 pr-3 py-2 text-sm border border-black/10 rounded-lg outline-none focus:border-[#00bceb]/50" />
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-black/5">
            {subnets.length === 0 && !loading && (
              <div className="py-16 text-center text-sm text-black/30">
                {language === 'zh' ? '暂无子网，点击"添加子网"开始' : 'No subnets. Click "Add Subnet" to start.'}
              </div>
            )}
            {subnets.map(subnet => (
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

        {/* Address Detail */}
        <div className="col-span-12 lg:col-span-7 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          {!selectedSubnet ? (
            <div className="flex flex-col items-center justify-center h-[500px]">
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

              <div className="flex-1 overflow-y-auto max-h-[460px]">
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
      </div>

      {/* Add Subnet Modal */}
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

      {/* Add IP Modal */}
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
