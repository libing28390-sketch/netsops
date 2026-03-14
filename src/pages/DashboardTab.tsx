import React from 'react';
import { Server, Activity, ShieldCheck, AlertCircle, TrendingUp, PieChart as PieChartIcon, History, Clock, ChevronRight, X, Zap, MonitorSmartphone } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { Device, Job, ScheduledTask, HostResourceSnapshot } from '../types';
import { sectionHeaderRowClass } from '../components/shared';

interface DashboardTabProps {
  devices: Device[];
  jobs: Job[];
  scheduledTasks: ScheduledTask[];
  trendDays: 7 | 30;
  setTrendDays: (d: 7 | 30) => void;
  complianceTrend: { name: string; rate: number }[];
  platformData: { name: string; value: number; color: string }[];
  dashBannerCollapsed: boolean;
  setDashBannerCollapsed: (v: boolean) => void;
  dashLastRefresh: Date;
  hostResources: HostResourceSnapshot | null;
  unreadNotificationCount: number;
  language: string;
  t: (key: string) => string;
  setActiveTab: (tab: string) => void;
  navigate: (path: string) => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  devices, jobs, scheduledTasks, trendDays, setTrendDays,
  complianceTrend, platformData, dashBannerCollapsed, setDashBannerCollapsed,
  dashLastRefresh, hostResources, unreadNotificationCount, language, t, setActiveTab, navigate,
}) => {
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const onlinePct = devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0;
  const compPct = devices.length > 0 ? Math.round((devices.filter(d => d.compliance === 'compliant').length / devices.length) * 100) : 0;
  const now24h = Date.now() - 86400000;
  const failedCount24h = jobs.filter(j => j.status === 'failed' && j.created_at && new Date(j.created_at).getTime() > now24h).length;

  const healthLevel = hostResources?.status === 'critical' || unreadNotificationCount >= 5 || onlinePct < 30 || (devices.length > 0 && compPct === 0)
    ? 'critical'
    : hostResources?.status === 'degraded' || unreadNotificationCount > 0 || onlinePct < 60 || compPct < 50
      ? 'degraded'
      : 'healthy';
  const healthLabel = healthLevel === 'critical' ? t('systemCritical') : healthLevel === 'degraded' ? t('systemDegraded') : t('systemHealthy');
  const healthColor = healthLevel === 'critical' ? 'bg-red-100 text-red-700' : healthLevel === 'degraded' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700';
  const hostStatusText = hostResources?.status === 'critical'
    ? (language === 'zh' ? '宿主机严重' : 'Host Critical')
    : hostResources?.status === 'degraded'
      ? (language === 'zh' ? '宿主机告警' : 'Host Warning')
      : (language === 'zh' ? '宿主机正常' : 'Host Healthy');

  const dashAgoSec = Math.round((Date.now() - dashLastRefresh.getTime()) / 1000);

  // Determine accent border color for each stat card (P2: left color bar for abnormal states)
  const getStatAccent = (stat: { tab: string; color: string }) => {
    if (stat.color.includes('text-red')) return 'border-l-[3px] border-l-red-500';
    if (stat.color.includes('text-orange')) return 'border-l-[3px] border-l-orange-400';
    return '';
  };

  return (
    <div className="space-y-5 overflow-auto h-full">
      <div className={sectionHeaderRowClass}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#00172D]">{t('networkOverview')}</h2>
          <p className="text-sm text-black/40">{t('dashboardSubtitle')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-black/30">{t('lastRefreshed')} {dashAgoSec}{t('secondsAgo')}</span>
          {hostResources && <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider bg-[#00172D]/5 text-[#00172D]">{hostStatusText}</span>}
          <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${healthColor} ${healthLevel === 'critical' ? 'animate-pulse' : ''}`}>{healthLabel}</span>
        </div>
      </div>

      {!dashBannerCollapsed && (
        <div className="rounded-2xl border border-[#00bceb]/20 bg-gradient-to-r from-[#f4fcff] via-white to-[#eef9ff] px-6 py-5 shadow-sm relative">
          <button onClick={() => setDashBannerCollapsed(true)} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 text-black/30 hover:text-black/60 transition-all"><X size={14} /></button>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00a5cd]">NetPilot Command Center</p>
              <h3 className="mt-1 text-xl font-bold text-[#0d2c40]">{t('todaySnapshot')}</h3>
              <p className="mt-1 text-xs text-[#21546d]/80">{t('todaySnapshotDesc')}</p>
              {hostResources && <p className="mt-2 text-[11px] text-[#21546d]/85">{language === 'zh' ? `平台宿主机: CPU ${Math.round(hostResources.cpu_percent || 0)}% / 内存 ${Math.round(hostResources.memory_percent || 0)}% / 磁盘 ${Math.round(hostResources.disk_percent || 0)}%` : `Platform host: CPU ${Math.round(hostResources.cpu_percent || 0)}% / Memory ${Math.round(hostResources.memory_percent || 0)}% / Disk ${Math.round(hostResources.disk_percent || 0)}%`}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate('/monitoring')} className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#00bceb]/30 text-[#008db1] hover:bg-[#00bceb]/8 transition-all">
                {language === 'zh' ? '查看平台资源' : 'View Host Resources'}
              </button>
              <button onClick={() => navigate('/automation/execute')} className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#00bceb] text-white hover:bg-[#009ac2] transition-all">
                {t('openAutomation')}
              </button>
              <button onClick={() => navigate('/automation/history')} className="px-3 py-2 text-xs font-semibold rounded-lg border border-black/10 text-black/70 hover:bg-black/5 transition-all">
                {t('viewExecHistory')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6">
        {[
          { label: t('totalAssets'), value: devices.length, icon: Server, color: 'text-[#005073]', bg: 'bg-[#005073]/5', tab: 'inventory' },
          { label: t('onlineNodes'), value: onlineCount, icon: Activity, color: onlinePct < 30 ? 'text-red-600' : onlinePct < 60 ? 'text-orange-600' : 'text-emerald-600', bg: onlinePct < 30 ? 'bg-red-50' : onlinePct < 60 ? 'bg-orange-50' : 'bg-emerald-50', tab: 'inventory' },
          { label: t('complianceRate'), value: `${compPct}%`, icon: ShieldCheck, color: compPct === 0 ? 'text-red-600' : compPct < 50 ? 'text-orange-600' : 'text-[#00bceb]', bg: compPct === 0 ? 'bg-red-50' : compPct < 50 ? 'bg-orange-50' : 'bg-[#00bceb]/5', tab: 'compliance' },
          { label: t('failedTasks'), value: failedCount24h, icon: AlertCircle, color: failedCount24h > 0 ? 'text-red-600' : 'text-black/40', bg: failedCount24h > 0 ? 'bg-red-50' : 'bg-black/5', tab: 'history' },
          { label: language === 'zh' ? '平台宿主机' : 'Platform Host', value: hostResources ? `${Math.round(Math.max(hostResources.cpu_percent || 0, hostResources.memory_percent || 0, hostResources.disk_percent || 0))}%` : '--', icon: MonitorSmartphone, color: hostResources?.status === 'critical' ? 'text-red-600' : hostResources?.status === 'degraded' ? 'text-orange-600' : 'text-[#005073]', bg: hostResources?.status === 'critical' ? 'bg-red-50' : hostResources?.status === 'degraded' ? 'bg-orange-50' : 'bg-[#005073]/5', tab: 'monitoring' },
        ].map((stat, i) => (
          <div key={i} onClick={() => setActiveTab(stat.tab)} className={`bg-white px-5 py-4 rounded-2xl shadow-sm border border-black/5 flex items-center justify-between group hover:shadow-md hover:border-black/10 transition-all cursor-pointer ${getStatAccent(stat)}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/30 mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold monitoring-data ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3 md:gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-black/5 p-4 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-[#00172D] flex items-center gap-2">
                <TrendingUp size={18} className="text-[#00bceb]" />
                {t('complianceTrend')}
              </h3>
              <p className="text-xs text-black/40 mt-1">{t('complianceTrendSub')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTrendDays(7)} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${trendDays === 7 ? 'bg-black/10 text-black/70' : 'text-black/40 hover:bg-black/5'}`}>{t('days7')}</button>
              <button onClick={() => setTrendDays(30)} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${trendDays === 30 ? 'bg-black/10 text-black/70' : 'text-black/40 hover:bg-black/5'}`}>{t('days30')}</button>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceTrend}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00bceb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00bceb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}}
                  dy={10}
                  interval={trendDays > 7 ? Math.floor(trendDays / 7) - 1 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                />
                <Area type="monotone" dataKey="rate" stroke="#00bceb" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-black/5 p-4 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-[#00172D] mb-8 flex items-center gap-2">
            <PieChartIcon size={18} className="text-emerald-500" />
            {t('platformDistribution')}
          </h3>
          <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformData} innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* P1: Total device count in donut center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[#00172D] monitoring-data">{devices.length}</span>
              <span className="text-[10px] text-black/40 font-medium">{language === 'zh' ? '总设备' : 'Total'}</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {platformData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}} />
                  <span className="text-xs font-semibold text-black/60">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-[#00172D]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 md:gap-6">
        <div className="col-span-12 lg:col-span-7 bg-white rounded-2xl border border-black/5 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-[#00172D] flex items-center gap-2">
                <History size={18} className="text-black/40" />
                {t('recentActivity')}
              </h3>
              <p className="text-xs text-black/40 mt-1">{t('recentActivitySub')}</p>
            </div>
            <button className="text-[10px] font-bold uppercase text-[#00bceb] hover:underline" onClick={() => setActiveTab('history')}>
              {t('viewAuditLog')}
            </button>
          </div>
          <div className="space-y-2">
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} className="flex items-center justify-between p-4 hover:bg-black/[0.02] rounded-xl transition-all border border-transparent hover:border-black/5">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${
                    job.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    job.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-[#00bceb]/10 text-[#00bceb]'
                  }`}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#00172D]">{job.task_name}</p>
                    <p className="text-[10px] text-black/40 font-medium uppercase tracking-wider">{new Date(job.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${
                    job.status === 'success' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {job.status}
                  </span>
                  <ChevronRight size={14} className="text-black/20" />
                </div>
              </div>
            ))}
            {jobs.length === 0 && <p className="text-sm text-black/30 italic p-4">{t('noActivity')}</p>}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl border border-black/5 p-4 md:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-[#00172D] mb-8 flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            {t('upcomingTasks')}
          </h3>
          <div className="space-y-4">
            {scheduledTasks.filter(st => st.status === 'active').slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-[#F0F2F5] rounded-2xl border border-black/5 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#00172D]">{task.task_name}</p>
                    <p className="text-[10px] text-black/40 font-medium">{task.scheduled_time} ({task.timezone})</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-[#005073] bg-[#005073]/10 px-2 py-1 rounded-lg">{task.schedule_type}</p>
                </div>
              </div>
            ))}
            {scheduledTasks.filter(st => st.status === 'active').length === 0 && (
              <div className="text-center py-8">
                <Clock size={32} className="mx-auto text-black/10 mb-2" />
                <p className="text-sm text-black/30">{t('noUpcomingTasks')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
