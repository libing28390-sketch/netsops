import React from 'react';
import { Upload, Download, Plus, Search, Filter } from 'lucide-react';
import type { Device } from '../types';
import { sectionHeaderRowClass, sectionToolbarClass, secondaryActionBtnClass } from '../components/shared';
import Sparkline from '../components/Sparkline';
import Pagination from '../components/Pagination';

interface InventoryDevicesTabProps {
  inventoryRows: Device[];
  inventoryTotal: number;
  inventoryPage: number;
  setInventoryPage: (v: number) => void;
  inventoryPageSize: number;
  setInventoryPageSize: (v: number) => void;
  inventorySearch: string;
  setInventorySearch: (v: string) => void;
  inventoryPlatformFilter: string;
  setInventoryPlatformFilter: (v: string) => void;
  inventoryStatusFilter: string;
  setInventoryStatusFilter: (v: string) => void;
  inventorySortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  inventoryLoading: boolean;
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSort: (key: string) => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
  handleDeleteDevice: (id: string) => void;
  handleDeleteSelected: () => void;
  handleShowDetails: (device: Device) => void;
  setShowAddModal: (v: boolean) => void;
  setShowEditModal: (v: boolean) => void;
  setEditingDevice: (d: Device) => void;
  setEditForm: (d: Device) => void;
  setSelectedDevice: (d: Device) => void;
  setActiveTab: (tab: string) => void;
  language: string;
  t: (key: string) => string;
}

const InventoryDevicesTab: React.FC<InventoryDevicesTabProps> = ({
  inventoryRows, inventoryTotal, inventoryPage, setInventoryPage,
  inventoryPageSize, setInventoryPageSize,
  inventorySearch, setInventorySearch,
  inventoryPlatformFilter, setInventoryPlatformFilter,
  inventoryStatusFilter, setInventoryStatusFilter,
  inventorySortConfig, inventoryLoading,
  selectedDeviceIds, setSelectedDeviceIds,
  handleSort, handleImport, handleExport,
  handleDeleteDevice, handleDeleteSelected, handleShowDetails,
  setShowAddModal, setShowEditModal, setEditingDevice, setEditForm,
  setSelectedDevice, setActiveTab, language, t,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className={sectionHeaderRowClass}>
          <div>
            <h2 className="text-2xl font-medium tracking-tight">{t('deviceInventory')}</h2>
            <p className="text-sm text-black/40">{t('manageMonitor')}</p>
          </div>
          <div className="flex gap-3">
            <label className="px-4 py-2 border border-black/10 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-black/5 transition-all cursor-pointer">
              <Upload size={18} />
              {t('import')}
              <input type="file" className="hidden" onChange={handleImport} accept=".xlsx, .xls, .csv" />
            </label>
            <button onClick={handleExport} className={secondaryActionBtnClass}>
              <Download size={18} />
              {t('export')}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#00bceb] text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#0096bd] transition-all shadow-lg shadow-[#00bceb]/20"
            >
              <Plus size={18} />
              {t('addDevice')}
            </button>
          </div>
        </div>

        <div className={sectionToolbarClass}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-sm focus:border-black/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-black/40" />
            <select value={inventoryPlatformFilter} onChange={(e) => setInventoryPlatformFilter(e.target.value)}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value="all">{t('allPlatforms')}</option>
              <option value="cisco_ios">Cisco IOS</option>
              <option value="cisco_nxos">Cisco NX-OS</option>
              <option value="juniper_junos">Juniper Junos</option>
              <option value="arista_eos">Arista EOS</option>
              <option value="fortinet_fortios">Fortinet FortiOS</option>
              <option value="huawei_vrp">Huawei VRP</option>
              <option value="h3c_comware">H3C Comware</option>
              <option value="ruijie_rgos">Ruijie RGOS</option>
            </select>
            <select value={inventoryStatusFilter} onChange={(e) => setInventoryStatusFilter(e.target.value)}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="pending">Pending</option>
            </select>
            <select value={inventoryPageSize} onChange={(e) => setInventoryPageSize(Number(e.target.value))}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {selectedDeviceIds.length > 0 && (
          <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800">{selectedDeviceIds.length} device(s) selected</span>
            <button onClick={handleDeleteSelected}
              className="text-xs font-bold uppercase text-red-600 hover:text-red-700 bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
              DELETE SELECTED
            </button>
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/[0.02] border-b border-black/5">
              <th className="px-6 py-4 w-10">
                <input
                  type="checkbox"
                  className="rounded border-black/20 text-[#00bceb] focus:ring-[#00bceb]"
                  checked={inventoryRows.length > 0 && inventoryRows.every(d => selectedDeviceIds.includes(d.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const currentPageIds = inventoryRows.map(d => d.id);
                      setSelectedDeviceIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
                    } else {
                      const currentPageIds = new Set(inventoryRows.map(d => d.id));
                      setSelectedDeviceIds(prev => prev.filter(id => !currentPageIds.has(id)));
                    }
                  }}
                />
              </th>
              {[
                { key: 'hostname', label: 'DEVICE INFO' },
                { key: 'model', label: 'HARDWARE / SN' },
                { key: 'platform', label: 'SOFTWARE' },
                { key: 'site', label: 'SITE / ROLE' },
                { key: 'connection_method', label: 'METHOD' },
                { key: 'status', label: 'STATUS' },
              ].map(col => (
                <th key={col.key}
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40 cursor-pointer hover:text-black transition-colors"
                  onClick={() => handleSort(col.key)}>
                  {col.label} {inventorySortConfig?.key === col.key && (inventorySortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">HEALTH / TREND</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {inventoryRows.map(device => (
              <tr key={device.id} className={`border-b border-black/5 hover:bg-black/[0.01] transition-colors ${selectedDeviceIds.includes(device.id) ? 'bg-emerald-50/30' : ''}`}>
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-black/20 text-[#00bceb] focus:ring-[#00bceb]"
                    checked={selectedDeviceIds.includes(device.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeviceIds(prev => [...prev, device.id]);
                      else setSelectedDeviceIds(prev => prev.filter(id => id !== device.id));
                    }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium">{device.hostname || 'Unknown'}</div>
                  <div className="text-[10px] font-mono text-black/40">{device.ip_address || '0.0.0.0'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.model || 'N/A'}</div>
                  <div className="text-[10px] font-mono text-black/40">{device.sn || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.platform || 'unknown'}</div>
                  <div className="text-[10px] text-black/40">Ver: {device.version || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.site || 'N/A'}</div>
                  <div className="text-[10px] font-bold uppercase text-black/30">{device.role || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-black/5 rounded-lg border border-black/5">
                    {device.connection_method || 'ssh'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2 w-32">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-black/40 uppercase">CPU {device.cpu_usage || 0}%</span>
                        <div className="h-1 w-12 bg-black/5 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-[#00bceb]" style={{ width: `${device.cpu_usage || 0}%` }} />
                        </div>
                      </div>
                      <Sparkline data={device.cpu_history || [20, 30, 25, 40, 35, 45, 40]} color="#00bceb" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-black/40 uppercase">MEM {device.memory_usage || 0}%</span>
                        <div className="h-1 w-12 bg-black/5 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-emerald-500" style={{ width: `${device.memory_usage || 0}%` }} />
                        </div>
                      </div>
                      <Sparkline data={device.memory_history || [60, 62, 65, 63, 68, 70, 65]} color="#10b981" />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {device.status === 'online' && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          device.status === 'online' ? 'bg-emerald-500' :
                          device.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`}></span>
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${
                        device.status === 'online' ? 'text-emerald-600' :
                        device.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                      }`}>{device.status}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase w-fit ${
                      device.compliance === 'compliant' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>{device.compliance}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-3">
                    <button onClick={() => { setSelectedDevice(device); setActiveTab('automation'); }}
                      className="text-[10px] font-bold uppercase text-[#00bceb] hover:text-[#0096bd]">CONFIG</button>
                    <button onClick={() => handleShowDetails(device)}
                      className="text-[10px] font-bold uppercase text-black/40 hover:text-black">DETAILS</button>
                    <button onClick={() => { setEditingDevice(device); setEditForm(device); setShowEditModal(true); }}
                      className="text-[10px] font-bold uppercase text-blue-600 hover:text-blue-700">EDIT</button>
                    <button onClick={() => handleDeleteDevice(device.id)}
                      className="text-[10px] font-bold uppercase text-red-600 hover:text-red-700">DELETE</button>
                  </div>
                </td>
              </tr>
            ))}
            {!inventoryLoading && inventoryRows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-sm text-black/40">No devices found for current filters.</td></tr>
            )}
            {inventoryLoading && inventoryRows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-sm text-black/40">Loading devices...</td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={inventoryPage}
          totalItems={inventoryTotal}
          itemsPerPage={inventoryPageSize}
          onItemsPerPageChange={setInventoryPageSize}
          onPageChange={setInventoryPage}
          language={language}
        />
      </div>
    </div>
  );
};

export default InventoryDevicesTab;
