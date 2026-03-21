import React from 'react';
import { AlertCircle, Eye, Monitor } from 'lucide-react';
import type { Device } from '../types';

interface TopologyOperationalTone {
  badge: string;
  panel: string;
}

interface TopologyDecoratedLinkLike {
  id?: string;
  link_key?: string;
  source_device_id?: string;
  target_device_id?: string;
  source_hostname?: string;
  source_hostname_resolved?: string;
  target_hostname?: string;
  target_hostname_resolved?: string;
  source_port?: string;
  target_port?: string;
  source_interface_snapshot?: unknown;
  target_interface_snapshot?: unknown;
  operational_state?: string;
  operational_summary?: string;
  last_seen?: string;
  evidence_sources: string[];
  evidence_count?: number;
  reverse_confirmed?: boolean;
}

interface TopologyInspectorPanelProps {
  language: string;
  selectedTopologyDevice: Device | null;
  selectedTopologyLink: TopologyDecoratedLinkLike | null;
  topologyNeighborDevices: Device[];
  topologyDeviceLinks: TopologyDecoratedLinkLike[];
  topologyPriorityDevices: Device[];
  topologyOrphanDevices: Device[];
  selectedTopologyLinkKey: string | null;
  secondaryActionBtnClass: string;
  onSelectDevice: (deviceId: string) => void;
  onSelectLink: (linkKey: string | null) => void;
  onOpenDeviceDetail: (device: Device) => void;
  onOpenMonitoring: () => void;
  formatTopologyPort: (value?: string) => string;
  formatTopologyInterfaceTelemetry: (snapshot: unknown) => string;
  formatTopologyLastSeen: (value?: string) => string;
  formatTopologyOperationalState: (value?: string) => string;
  formatTopologyEvidenceLabel: (value?: string) => string;
  getTopologyOperationalTone: (value?: string) => TopologyOperationalTone;
}

const statusBadgeClass = (status?: string) => {
  if (status === 'online') return 'bg-emerald-100 text-emerald-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

const TopologyInspectorPanel: React.FC<TopologyInspectorPanelProps> = ({
  language,
  selectedTopologyDevice,
  selectedTopologyLink,
  topologyNeighborDevices,
  topologyDeviceLinks,
  topologyPriorityDevices,
  topologyOrphanDevices,
  selectedTopologyLinkKey,
  secondaryActionBtnClass,
  onSelectDevice,
  onSelectLink,
  onOpenDeviceDetail,
  onOpenMonitoring,
  formatTopologyPort,
  formatTopologyInterfaceTelemetry,
  formatTopologyLastSeen,
  formatTopologyOperationalState,
  formatTopologyEvidenceLabel,
  getTopologyOperationalTone,
}) => {
  return (
    <div className="flex min-h-[620px] flex-col gap-4">
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">
              {language === 'zh' ? '当前节点' : 'Selected Node'}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
              {selectedTopologyDevice?.hostname || (language === 'zh' ? '未选择设备' : 'No device selected')}
            </h3>
            <p className="mt-1 text-sm text-black/45">
              {selectedTopologyDevice
                ? `${selectedTopologyDevice.ip_address} · ${selectedTopologyDevice.site || '-'} · ${selectedTopologyDevice.role || '-'}`
                : (language === 'zh' ? '点击左侧节点查看邻接关系与健康态势。' : 'Select a node on the left to inspect adjacency and operational context.')}
            </p>
          </div>
          {selectedTopologyDevice && (
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
              selectedTopologyDevice.status === 'online'
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : selectedTopologyDevice.status === 'pending'
                  ? 'border-amber-200 bg-amber-100 text-amber-700'
                  : 'border-rose-200 bg-rose-100 text-rose-700'
            }`}>
              {selectedTopologyDevice.status}
            </span>
          )}
        </div>

        {selectedTopologyDevice ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-black/5 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '邻接节点' : 'Neighbors'}</p>
                <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{topologyNeighborDevices.length}</p>
              </div>
              <div className="rounded-xl border border-black/5 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '接口链路' : 'Interface Links'}</p>
                <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{topologyDeviceLinks.length}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => onOpenDeviceDetail(selectedTopologyDevice)} className={secondaryActionBtnClass}>
                <Eye size={16} />
                {language === 'zh' ? '查看设备详情' : 'Open Device Detail'}
              </button>
              <button onClick={onOpenMonitoring} className={secondaryActionBtnClass}>
                <Monitor size={16} />
                {language === 'zh' ? '进入监控中心' : 'Open Monitoring'}
              </button>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0f172a]">{language === 'zh' ? '接口链路详情' : 'Interface Adjacencies'}</p>
                <span className="text-xs text-black/35">{topologyDeviceLinks.length}</span>
              </div>
              <div className="space-y-2">
                {topologyDeviceLinks.length > 0 ? topologyDeviceLinks.slice(0, 8).map((link) => {
                  const isSource = link.source_device_id === selectedTopologyDevice.id;
                  const peerName = isSource
                    ? (link.target_hostname || link.target_hostname_resolved || '')
                    : (link.source_hostname || link.source_hostname_resolved || '');
                  const localPort = formatTopologyPort(isSource ? link.source_port : link.target_port);
                  const remotePort = formatTopologyPort(isSource ? link.target_port : link.source_port);
                  const localTelemetry = formatTopologyInterfaceTelemetry(isSource ? link.source_interface_snapshot : link.target_interface_snapshot);
                  const remoteTelemetry = formatTopologyInterfaceTelemetry(isSource ? link.target_interface_snapshot : link.source_interface_snapshot);
                  const peerId = isSource ? link.target_device_id : link.source_device_id;
                  const linkKey = link.link_key || link.id || null;
                  const operationalTone = getTopologyOperationalTone(link.operational_state);

                  return (
                    <div
                      key={linkKey || `${link.source_device_id}-${link.target_device_id}-${localPort}`}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                        selectedTopologyLinkKey && linkKey === selectedTopologyLinkKey
                          ? 'border-[#00bceb]/40 bg-[#00bceb]/6'
                          : 'border-black/5 bg-slate-50 hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={() => onSelectLink(linkKey)} className="flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#0f172a]">{peerName || (language === 'zh' ? '对端设备' : 'Peer Device')}</p>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${operationalTone.badge}`}>
                              {formatTopologyOperationalState(link.operational_state)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-black/45">{language === 'zh' ? '本端接口' : 'Local'}: {localPort} · {localTelemetry}</p>
                          <p className="text-xs text-black/45">{language === 'zh' ? '对端接口' : 'Remote'}: {remotePort} · {remoteTelemetry}</p>
                          <p className="text-xs text-black/35">{language === 'zh' ? '最近发现' : 'Last seen'}: {formatTopologyLastSeen(link.last_seen)}</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            {link.evidence_sources.slice(0, 2).map((source) => (
                              <span key={`${linkKey}-${source}`} className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
                                {formatTopologyEvidenceLabel(source)}
                              </span>
                            ))}
                            {link.reverse_confirmed && (
                              <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">
                                {language === 'zh' ? '双端确认' : 'Bidirectional'}
                              </span>
                            )}
                          </div>
                          {peerId && (
                            <button type="button" onClick={() => { onSelectDevice(peerId); onSelectLink(linkKey); }} className="text-[11px] font-semibold text-[#0284c7] hover:text-[#0369a1]">
                              {language === 'zh' ? '切到对端' : 'Open Peer'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                    {language === 'zh' ? '当前节点暂无可展示的接口链路。' : 'No interface adjacency data is available for the selected node.'}
                  </div>
                )}
              </div>
            </div>

            {selectedTopologyLink && (
              <div className={`mt-5 rounded-xl border p-3 ${getTopologyOperationalTone(selectedTopologyLink.operational_state).panel}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{language === 'zh' ? '当前选中链路' : 'Selected Link'}</p>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getTopologyOperationalTone(selectedTopologyLink.operational_state).badge}`}>
                    {formatTopologyOperationalState(selectedTopologyLink.operational_state)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p><span className="font-semibold">{selectedTopologyLink.source_hostname || selectedTopologyLink.source_hostname_resolved || selectedTopologyLink.source_device_id}</span> · {formatTopologyPort(selectedTopologyLink.source_port)}</p>
                  <p><span className="font-semibold">{selectedTopologyLink.target_hostname || selectedTopologyLink.target_hostname_resolved || selectedTopologyLink.target_device_id}</span> · {formatTopologyPort(selectedTopologyLink.target_port)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">{language === 'zh' ? '最近发现' : 'Last seen'}: {formatTopologyLastSeen(selectedTopologyLink.last_seen)}</p>
                <p className="mt-2 text-xs text-slate-600">{selectedTopologyLink.operational_summary}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '源接口遥测' : 'Source Telemetry'}</p>
                    <p className="mt-1 text-xs text-slate-700">{formatTopologyInterfaceTelemetry(selectedTopologyLink.source_interface_snapshot)}</p>
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '对端接口遥测' : 'Target Telemetry'}</p>
                    <p className="mt-1 text-xs text-slate-700">{formatTopologyInterfaceTelemetry(selectedTopologyLink.target_interface_snapshot)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(selectedTopologyLink.evidence_sources.length > 0 ? selectedTopologyLink.evidence_sources : ['lldp']).map((source) => (
                    <span key={`selected-link-${source}`} className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 ring-1 ring-black/5">
                      {formatTopologyEvidenceLabel(source)}
                    </span>
                  ))}
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 ring-1 ring-black/5">
                    {language === 'zh' ? `证据 ${Number(selectedTopologyLink.evidence_count || 0)}` : `Evidence ${Number(selectedTopologyLink.evidence_count || 0)}`}
                  </span>
                  {selectedTopologyLink.reverse_confirmed && (
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 ring-1 ring-sky-200">
                      {language === 'zh' ? '双向确认' : 'Reverse Confirmed'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0f172a]">{language === 'zh' ? '直接邻居' : 'Direct Neighbors'}</p>
                <span className="text-xs text-black/35">{topologyNeighborDevices.length}</span>
              </div>
              <div className="space-y-2">
                {topologyNeighborDevices.length > 0 ? topologyNeighborDevices.slice(0, 6).map((device) => (
                  <button key={device.id} onClick={() => onSelectDevice(device.id)} className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5">
                    <div>
                      <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                      <p className="text-xs text-black/40">{device.ip_address} · {device.role || '-'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusBadgeClass(device.status)}`}>
                      {device.status}
                    </span>
                  </button>
                )) : (
                  <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                    {language === 'zh' ? '当前节点没有发现邻接关系，可能是边缘孤立设备或邻居发现尚未完成。' : 'No adjacent nodes were found for the current device. It may be isolated or discovery has not completed yet.'}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-[#0f172a]">{language === 'zh' ? '优先关注' : 'Priority Watchlist'}</h3>
          <AlertCircle size={16} className="text-amber-500" />
        </div>
        <div className="mt-4 space-y-2">
          {topologyPriorityDevices.length > 0 ? topologyPriorityDevices.map((device) => (
            <button key={device.id} onClick={() => onSelectDevice(device.id)} className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                <p className="text-xs text-black/40">{device.site || '-'} · {device.role || '-'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-rose-600">{device.open_alert_count || 0} {language === 'zh' ? '告警' : 'alerts'}</p>
                <p className="text-[11px] text-black/35">{device.status}</p>
              </div>
            </button>
          )) : (
            <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
              {language === 'zh' ? '当前过滤范围内没有需要优先处置的节点。' : 'No high-priority devices in the current topology scope.'}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-[#0f172a]">{language === 'zh' ? '孤立节点' : 'Orphan Devices'}</h3>
          <span className="text-xs text-black/35">{topologyOrphanDevices.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {topologyOrphanDevices.length > 0 ? topologyOrphanDevices.slice(0, 6).map((device) => (
            <button key={device.id} onClick={() => onSelectDevice(device.id)} className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                <p className="text-xs text-black/40">{device.ip_address}</p>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
                {device.site || (language === 'zh' ? '未分站点' : 'Unassigned')}
              </span>
            </button>
          )) : (
            <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
              {language === 'zh' ? '当前视图下未发现孤立节点。' : 'No orphan devices in the current view.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopologyInspectorPanel;