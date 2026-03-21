  /* NOC auto-refresh (30s) */
  useEffect(() => {
    fetchHostResourceHistory(hostResourceRange);
  }, [fetchHostResourceHistory, hostResourceRange]);

  useEffect(() => {
    if (!monitorPageVisible || !autoRefresh) {
      if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
      return;
    }
    autoRefreshRef.current = setInterval(() => {
      fetchMonitoringOverview();
      fetchMonitoringAlerts();
      fetchHostResources();
      fetchHostResourceHistory(hostResourceRange);
      if (monitorSelectedDevice?.id) {
        fetchMonitoringRealtime(monitorSelectedDevice.id).then(setMonitorRealtime).catch(() => undefined);
      }
    }, 30000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, monitorPageVisible, hostResourceRange, fetchMonitoringOverview, fetchMonitoringAlerts, fetchHostResources, fetchHostResourceHistory, monitorSelectedDevice, fetchMonitoringRealtime, setMonitorRealtime]);

  useEffect(() => {
    const timer = setInterval(() => setNocClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const doRefreshAll = useCallback(() => {
    setRefreshing(true);
    fetchMonitoringOverview();
    fetchMonitoringAlerts();
    fetchHostResources();
    fetchHostResourceHistory(hostResourceRange);
    if (monitorSelectedDevice?.id) {
      fetchMonitoringRealtime(monitorSelectedDevice.id).then(setMonitorRealtime).catch(() => undefined);
    }
    setTimeout(() => setRefreshing(false), 1200);
  }, [fetchMonitoringOverview, fetchMonitoringAlerts, fetchHostResources, fetchHostResourceHistory, hostResourceRange, monitorSelectedDevice, fetchMonitoringRealtime, setMonitorRealtime]);

  /* derived data for dashboard */
  const totalDevices = (monitorOverview?.online_devices ?? 0) + (monitorOverview?.offline_devices ?? 0);
  const onlineDevices = monitorOverview?.online_devices ?? 0;
  const offlineDevices = monitorOverview?.offline_devices ?? totalDevices - onlineDevices;
  const openAlerts = monitorOverview?.open_alerts ?? 0;
  const healthyCount = deviceHealthSummary?.healthy ?? 0;
  const warningCount = deviceHealthSummary?.warning ?? 0;
  const criticalCount = deviceHealthSummary?.critical ?? 0;
  const unknownCount = deviceHealthSummary?.unknown ?? 0;
  const healthTotal = healthyCount + warningCount + criticalCount + unknownCount;
  const healthPct = healthTotal > 0 ? Math.round((healthyCount / healthTotal) * 100) : 0;
  const healthBarWidth = (count: number) => healthTotal > 0 ? `${(count / healthTotal) * 100}%` : '0%';

  const filteredOpenAlerts = (Array.isArray(monitorOverview?.recent_open_alerts) ? monitorOverview.recent_open_alerts : []).filter((item: any) => {
    const siteMatch = monitorDashboardSiteFilter === 'all' || String(item.site || '').trim() === monitorDashboardSiteFilter;
    const severityMatch = monitorDashboardAlertFilter === 'all' || String(item.severity || '').toLowerCase() === monitorDashboardAlertFilter;
    return siteMatch && severityMatch;
  });

  const hostTrendData = (hostResourceHistory?.series || []).map((point) => ({
    ts: point.ts,
    time: formatTs(point.ts, hostResourceRange === 1),
    cpu_percent: point.cpu_percent,
    memory_percent: point.memory_percent,
    disk_percent: point.disk_percent,
  }));

  const dashboardSiteOptions = Array.from(new Set([
    ...(Array.isArray(monitorOverview?.top_hot_interfaces) ? monitorOverview.top_hot_interfaces : []).map((item: any) => String(item.site || '').trim()).filter(Boolean),
    ...filteredOpenAlerts.map((item: any) => String(item.site || '').trim()).filter(Boolean),
  ])).sort((a: string, b: string) => a.localeCompare(b));

  const nocTimeStr = nocClock.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="monitoring-center space-y-5">

      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
              <Radio size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--app-text)]">{language === 'zh' ? '\u8fd0\u7ef4\u6307\u6325\u4e2d\u5fc3' : 'NOC Command Center'}</h2>
              <p className="text-[11px] text-[var(--muted-text)]">
                {language === 'zh' ? '\u5b9e\u65f6\u76d1\u63a7 \u00b7 \u5168\u7f51\u6001\u52bf \u00b7 \u5feb\u901f\u5904\u7f6e' : 'Real-time monitoring \u00b7 Network posture \u00b7 Quick response'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { fetchMonitoringOverview(); fetchHostResources(); showToast(language === 'zh' ? '\u5df2\u4e0b\u53d1\u5168\u7f51\u8bbe\u5907\u68c0\u67e5' : 'Device check initiated', 'info'); }} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition-all hover:bg-sky-100 hover:shadow-sm">
            <Zap size={13} />{language === 'zh' ? '\u4e00\u952e\u68c0\u67e5' : 'Check All'}
          </button>
          <button type="button" onClick={() => navigate('/alerts')} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-all hover:bg-red-100 hover:shadow-sm">
            <Bell size={13} />{language === 'zh' ? '\u544a\u8b66\u4e2d\u5fc3' : 'Alert Center'}
          </button>
          <button type="button" onClick={() => navigate('/automation')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-sm">
            <Play size={13} />{language === 'zh' ? '\u81ea\u52a8\u5316\u4efb\u52a1' : 'Automation'}
          </button>
          <div className="h-6 w-px bg-black/10" />
          <button type="button" onClick={() => setAutoRefresh(!autoRefresh)} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${autoRefresh ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-black/20'}`} />
            {autoRefresh ? '30s' : 'OFF'}
          </button>
          <button type="button" disabled={refreshing} onClick={doRefreshAll} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${refreshing ? 'border-sky-300 bg-sky-50 text-sky-700 cursor-not-allowed' : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)] hover:border-black/20'}`}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? (language === 'zh' ? '\u5237\u65b0\u4e2d' : 'Sync') : (language === 'zh' ? '\u7acb\u5373\u5237\u65b0' : 'Refresh')}
          </button>
          <span className="tabular-nums text-[11px] font-mono text-[var(--muted-text)]">{nocTimeStr}</span>
        </div>
      </div>

      {/* SECTION 1: CORE STATUS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatusCard
          label={language === 'zh' ? '\u603b\u8bbe\u5907\u6570' : 'Total Devices'}
          value={totalDevices || '-'}
          sub={language === 'zh' ? '\u7eb3\u7ba1\u8bbe\u5907' : 'Managed'}
          icon={<Server size={14} />}
        />
        <StatusCard
          label={language === 'zh' ? '\u5728\u7ebf\u8bbe\u5907' : 'Online'}
          value={onlineDevices || '-'}
          sub={`${healthPct}% ${language === 'zh' ? '\u5065\u5eb7\u7387' : 'healthy'}`}
          tone="green"
          icon={<CheckCircle2 size={14} />}
        />
        <StatusCard
          label={language === 'zh' ? '\u79bb\u7ebf\u8bbe\u5907' : 'Offline'}
          value={offlineDevices}
          tone={offlineDevices > 0 ? 'red' : 'default'}
          pulse={offlineDevices > 0}
          sub={language === 'zh' ? '\u70b9\u51fb\u67e5\u770b\u8be6\u60c5' : 'Click for details'}
          onClick={() => navigate('/inventory?status=offline')}
          icon={<XCircle size={14} />}
        />
        <StatusCard
          label={language === 'zh' ? '\u6d3b\u8dc3\u544a\u8b66' : 'Active Alerts'}
          value={openAlerts}
          tone={openAlerts > 0 ? 'red' : 'green'}
          pulse={openAlerts > 0}
          sub={`24h: ${monitorOverview?.alerts_24h ?? 0}`}
          onClick={() => navigate('/alerts')}
          icon={<AlertTriangle size={14} />}
        />
        <StatusCard
          label={language === 'zh' ? '\u5065\u5eb7\u8bc4\u5206' : 'Health Score'}
          value={deviceHealthSummary?.average_score ?? '-'}
          sub={`${healthyCount} ${language === 'zh' ? '\u5065\u5eb7' : 'ok'} / ${warningCount} ${language === 'zh' ? '\u544a\u8b66' : 'warn'} / ${criticalCount} ${language === 'zh' ? '\u4e25\u91cd' : 'crit'}`}
          tone={criticalCount > 0 ? 'red' : warningCount > 0 ? 'amber' : 'green'}
          icon={<Shield size={14} />}
        />
      </div>

      {/* SECTION 2: MIDDLE - HEALTH + RISK */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">

        {/* LEFT: Fleet Health Distribution */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">{language === 'zh' ? '\u5168\u7f51\u5065\u5eb7' : 'Fleet Health'}</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--app-text)]">{language === 'zh' ? '\u5065\u5eb7\u5206\u5e03\u603b\u89c8' : 'Health Distribution'}</h3>
              <p className="text-xs text-[var(--muted-text)]">{language === 'zh' ? '\u57fa\u4e8e\u8bbe\u5907\u72b6\u6001\u3001\u544a\u8b66\u548c\u5065\u5eb7\u8bc4\u5206\u7efc\u5408\u8ba1\u7b97\u3002' : 'Computed from device status, alerts, and health scores.'}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {language === 'zh' ? `\u5171 ${healthTotal} \u53f0` : `${healthTotal} total`}
            </span>
          </div>

          {healthTotal > 0 && (
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-black/[0.04]">
              {healthyCount > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white transition-all duration-700" style={{ width: healthBarWidth(healthyCount), backgroundColor: '#10b981' }}>{healthyCount}</div>}
              {warningCount > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white transition-all duration-700" style={{ width: healthBarWidth(warningCount), backgroundColor: '#f59e0b' }}>{warningCount}</div>}
              {criticalCount > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white transition-all duration-700" style={{ width: healthBarWidth(criticalCount), backgroundColor: '#ef4444' }}>{criticalCount}</div>}
              {unknownCount > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white transition-all duration-700" style={{ width: healthBarWidth(unknownCount), backgroundColor: '#94a3b8' }}>{unknownCount}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <HealthSegment label={language === 'zh' ? '\u5065\u5eb7' : 'Healthy'} count={healthyCount} total={healthTotal} color="#10b981" onClick={() => navigate('/health?filter=healthy')} />
            <HealthSegment label={language === 'zh' ? '\u544a\u8b66' : 'Warning'} count={warningCount} total={healthTotal} color="#f59e0b" onClick={() => navigate('/health?filter=warning')} />
            <HealthSegment label={language === 'zh' ? '\u4e25\u91cd' : 'Critical'} count={criticalCount} total={healthTotal} color="#ef4444" onClick={() => navigate('/health?filter=critical')} />
            <HealthSegment label={language === 'zh' ? '\u672a\u77e5' : 'Unknown'} count={unknownCount} total={healthTotal} color="#94a3b8" />
          </div>

          {hostResources && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-black/[0.015] px-5 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-text)]">{language === 'zh' ? '\u5e73\u53f0\u5bbf\u4e3b\u673a' : 'Platform Host'}</p>
                <p className="text-xs text-[var(--muted-text)]">{hostResources.hostname || '--'} {hostResources.status === 'critical' ? '\ud83d\udd34' : hostResources.status === 'degraded' ? '\ud83d\udfe1' : '\ud83d\udfe2'} {hostResources.status}</p>
              </div>
              <div className="flex items-center gap-5">
                <MiniGauge value={hostResources.cpu_percent} label="CPU" />
                <MiniGauge value={hostResources.memory_percent} label={language === 'zh' ? '\u5185\u5b58' : 'MEM'} />
                <MiniGauge value={hostResources.disk_percent} label={language === 'zh' ? '\u78c1\u76d8' : 'DISK'} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: HIGH RISK DEVICES TOP N */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">{language === 'zh' ? '\u9ad8\u98ce\u9669\u8bbe\u5907' : 'High Risk Devices'}</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--app-text)]">{language === 'zh' ? '\u98ce\u9669\u8bbe\u5907 Top N' : 'Top Risky Devices'}</h3>
              <p className="text-xs text-[var(--muted-text)]">{language === 'zh' ? '\u79bb\u7ebf\u8bbe\u5907\u4f18\u5148\u6392\u5217\uff0c\u5176\u6b21\u6309\u5065\u5eb7\u5206\u5347\u5e8f\u3002' : 'Offline first, then by health score ascending.'}</p>
            </div>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase text-red-700">
              {riskyDevices.length} {language === 'zh' ? '\u53f0' : 'devices'}
            </span>
          </div>
          <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
            {riskyDevices.length > 0
              ? riskyDevices.map((device: any, idx: number) => (
                <RiskDeviceRow key={device.id} device={device} language={language} index={idx} onClick={() => openMonitorDevice(device)} />
              ))
              : <div className="rounded-xl border border-dashed border-[var(--card-border)] p-8 text-center text-sm text-[var(--muted-text)]">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                  {language === 'zh' ? '\u5f53\u524d\u6ca1\u6709\u98ce\u9669\u8bbe\u5907\uff0c\u5168\u7f51\u5065\u5eb7\uff01' : 'No risky devices \u2014 fleet is healthy!'}
                </div>
            }
          </div>
        </div>
      </div>

      {/* SECTION 3: BOTTOM - TRENDS + EVENTS */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">

        {/* LEFT: Performance Trends */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">{language === 'zh' ? '\u6027\u80fd\u8d8b\u52bf' : 'Performance Trends'}</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--app-text)]">{language === 'zh' ? 'CPU / \u5185\u5b58 / \u78c1\u76d8' : 'CPU / Memory / Disk'}</h3>
            </div>
            <div className="flex items-center gap-1">
              {([1, 24, 168] as const).map((h) => (
                <button key={h} type="button" onClick={() => setHostResourceRange(h)} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${hostResourceRange === h ? 'bg-[var(--app-text)] text-[var(--card-bg)] shadow-sm' : 'text-[var(--muted-text)] hover:bg-black/[0.04]'}`}>
                  {h === 1 ? '1h' : h === 24 ? '24h' : '7d'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[220px] rounded-xl border border-[var(--card-border)] bg-black/[0.01] p-2">
            {hostTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hostTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" />
                  <XAxis dataKey="ts" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#60748a' }} tickFormatter={(value) => formatTs(String(value), hostResourceRange === 1)} minTickGap={28} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#60748a' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={38} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#d9e3ef', boxShadow: '0 12px 28px rgba(15,23,42,0.10)', padding: '10px 14px', background: 'rgba(255,255,255,0.96)' }} formatter={(value: any, name: any) => [`${Math.round(Number(value || 0))}%`, String(name)]} />
                  <Area type="monotone" dataKey="cpu_percent" name="CPU" stroke="#2563eb" fill="#2563eb1a" strokeWidth={2} isAnimationActive={false} connectNulls />
                  <Area type="monotone" dataKey="memory_percent" name={language === 'zh' ? '\u5185\u5b58' : 'Memory'} stroke="#ea580c" fill="#ea580c14" strokeWidth={2} isAnimationActive={false} connectNulls />
                  <Area type="monotone" dataKey="disk_percent" name={language === 'zh' ? '\u78c1\u76d8' : 'Disk'} stroke="#16a34a" fill="#16a34a14" strokeWidth={2} isAnimationActive={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted-text)]">
                {hostResourceHistoryLoading ? (language === 'zh' ? '\u52a0\u8f7d\u4e2d...' : 'Loading...') : (language === 'zh' ? '\u6682\u65e0\u8d8b\u52bf\u6570\u636e' : 'No trend data yet')}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {[
              { key: 'cpu', label: 'CPU', color: '#2563eb', value: hostResources?.cpu_percent },
              { key: 'mem', label: language === 'zh' ? '\u5185\u5b58' : 'MEM', color: '#ea580c', value: hostResources?.memory_percent },
              { key: 'disk', label: language === 'zh' ? '\u78c1\u76d8' : 'DISK', color: '#16a34a', value: hostResources?.disk_percent },
            ].map((m) => (
              <span key={m.key} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="font-semibold text-[var(--muted-text)]">{m.label}</span>
                <span className="font-bold text-[var(--app-text)]">{m.value != null ? `${Math.round(m.value)}%` : '--'}</span>
              </span>
            ))}
            <span className="text-[10px] text-[var(--muted-text)]">
              {hostResourceHistoryLoading ? '...' : `${hostResourceHistory?.sample_count || hostTrendData.length} pts \u00b7 ${hostResourceHistory?.resolution_hint || '1m'}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold ${hostResources?.database_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hostResources?.database_ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
              DB {hostResources?.database_ok ? 'OK' : 'ERR'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-[var(--muted-text)]">
              Load {hostResources?.load_1m?.toFixed(2) ?? '--'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-[var(--muted-text)]">
              Up {hostResources?.uptime_hours != null ? `${hostResources.uptime_hours.toFixed(0)}h` : '--'}
            </span>
          </div>
        </div>

        {/* RIGHT: Real-time Event Stream */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">{language === 'zh' ? '\u4e8b\u4ef6\u6d41' : 'Event Feed'}</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--app-text)]">{language === 'zh' ? '\u6700\u8fd1\u544a\u8b66 / \u4e8b\u4ef6' : 'Recent Alerts & Events'}</h3>
            </div>
            <div className="flex items-center gap-2">
              <select value={monitorDashboardSiteFilter} onChange={(e) => setMonitorDashboardSiteFilter(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] outline-none text-[var(--app-text)]" title={language === 'zh' ? '\u6309\u7ad9\u70b9' : 'By site'}>
                <option value="all">{language === 'zh' ? '\u5168\u90e8\u7ad9\u70b9' : 'All Sites'}</option>
                {dashboardSiteOptions.map((site: string) => <option key={site} value={site}>{site}</option>)}
              </select>
              <select value={monitorDashboardAlertFilter} onChange={(e) => setMonitorDashboardAlertFilter(e.target.value as any)} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] outline-none text-[var(--app-text)]" title={language === 'zh' ? '\u6309\u7ea7\u522b' : 'By severity'}>
                <option value="all">{language === 'zh' ? '\u5168\u90e8' : 'All'}</option>
                <option value="critical">{language === 'zh' ? '\u4e25\u91cd' : 'Critical'}</option>
                <option value="major">{language === 'zh' ? '\u4e3b\u8981' : 'Major'}</option>
                <option value="warning">{language === 'zh' ? '\u6b21\u8981' : 'Minor'}</option>
              </select>
            </div>
          </div>

          <div className="space-y-0.5 max-h-[280px] overflow-auto rounded-xl border border-[var(--card-border)] bg-black/[0.01] p-1">
            {filteredOpenAlerts.length > 0
              ? filteredOpenAlerts.slice(0, 30).map((alert: any) => (
                <EventStreamItem key={alert.id} alert={alert} language={language} onClick={() => openMonitorDevice(alert)} formatTs={formatTs} />
              ))
              : <div className="flex h-32 items-center justify-center text-sm text-[var(--muted-text)]">
                  <CheckCircle2 size={18} className="mr-2 text-emerald-500" />
                  {language === 'zh' ? '\u5f53\u524d\u65e0\u6d3b\u8dc3\u544a\u8b66\uff0c\u4e00\u5207\u6b63\u5e38\u3002' : 'No active alerts \u2014 all clear.'}
                </div>
            }
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">{language === 'zh' ? '\u4e25\u91cd' : 'CRIT'} {filteredOpenAlerts.filter((a: any) => String(a.severity || '').toLowerCase() === 'critical').length}</span>
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">{language === 'zh' ? '\u4e3b\u8981' : 'MAJOR'} {filteredOpenAlerts.filter((a: any) => String(a.severity || '').toLowerCase() === 'major').length}</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{language === 'zh' ? '\u6b21\u8981' : 'WARN'} {filteredOpenAlerts.filter((a: any) => String(a.severity || '').toLowerCase() === 'warning').length}</span>
          </div>
          <button type="button" onClick={() => navigate('/alerts')} className="w-full rounded-xl border border-[var(--card-border)] bg-black/[0.015] px-4 py-2 text-xs font-semibold text-[var(--muted-text)] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700">
            {language === 'zh' ? '\u6253\u5f00\u544a\u8b66\u4e2d\u5fc3\u67e5\u770b\u5168\u90e8 \u2192' : 'Open Alert Center for full view \u2192'}
          </button>
        </div>
      </div>

      {/* SECTION 4: Advanced / Collapsible */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between px-5 py-3 transition-all hover:bg-black/[0.02]">
          <div className="flex items-center gap-3">
            <Activity size={16} className="text-sky-600" />
            <div className="text-left">
              <p className="text-sm font-semibold text-[var(--app-text)]">{language === 'zh' ? '\u9ad8\u7ea7\u76d1\u63a7\uff1a\u8bbe\u5907\u641c\u7d22 + \u6d41\u91cf\u8d8b\u52bf + \u544a\u8b66\u65f6\u95f4\u7ebf' : 'Advanced: Device Search + Traffic Trends + Alert Timeline'}</p>
              <p className="text-[11px] text-[var(--muted-text)]">{language === 'zh' ? '\u641c\u7d22\u5728\u7ebf\u8bbe\u5907\u3001\u67e5\u770b\u63a5\u53e3\u6d41\u91cf\u8d8b\u52bf\u3001\u6d4f\u89c8\u544a\u8b66\u5386\u53f2\u8bb0\u5f55\u3002' : 'Search online devices, view interface traffic trends, browse alert history.'}</p>
            </div>
          </div>
          {showAdvanced ? <ChevronUp size={16} className="text-[var(--muted-text)]" /> : <ChevronDown size={16} className="text-[var(--muted-text)]" />}
        </button>

        {showAdvanced && (
          <div className="border-t border-[var(--card-border)] p-5 space-y-5">

            {/* Device Search */}
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-text)]" size={16} />
                  <input type="text" value={monitorSearch} onChange={(e) => setMonitorSearch(e.target.value)} placeholder={language === 'zh' ? '\u641c\u7d22\u5728\u7ebf\u8bbe\u5907\uff08\u4e3b\u673a\u540d/IP\uff0c\u652f\u6301\u6a21\u7cca\u5339\u914d\uff09' : 'Search online devices (hostname/IP, fuzzy match)'} className="w-full pl-9 pr-3 py-2 bg-black/[0.02] border border-[var(--card-border)] rounded-xl text-sm focus:border-sky-400 outline-none text-[var(--app-text)]" />
                </div>
                <div className="text-xs text-[var(--muted-text)]">{monitorSearching ? (language === 'zh' ? '\u641c\u7d22\u4e2d...' : 'Searching...') : `${monitorSearchResults.length} ${language === 'zh' ? '\u4e2a\u7ed3\u679c' : 'results'}`}</div>
              </div>

              {(monitorSearchResults.length > 0 || monitorSelectedDevice) && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-1 rounded-xl border border-[var(--card-border)] p-2 max-h-[320px] overflow-auto space-y-1">
                    {displaySearchResults.map((d: any) => (
                      <button key={d.id} onClick={() => setMonitorSelectedDevice(d)} className={`w-full text-left p-3 rounded-lg border transition-all ${monitorSelectedDevice?.id === d.id ? 'bg-[var(--app-text)] text-[var(--card-bg)] border-[var(--app-text)]' : 'border-transparent hover:border-[var(--card-border)] hover:bg-black/[0.02]'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{d.hostname}</p>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className={`text-[11px] mt-1 font-mono ${monitorSelectedDevice?.id === d.id ? 'opacity-70' : 'text-[var(--muted-text)]'}`}>{d.ip_address}</p>
                        <p className={`text-[10px] mt-0.5 ${monitorSelectedDevice?.id === d.id ? 'opacity-60' : 'text-[var(--muted-text)]'}`}>{d.platform}</p>
                      </button>
                    ))}
                    {!monitorSearching && displaySearchResults.length === 0 && <p className="p-4 text-xs text-[var(--muted-text)] text-center">{language === 'zh' ? '\u672a\u627e\u5230\u5728\u7ebf\u8bbe\u5907' : 'No online device matched'}</p>}
                  </div>
                  <div className="xl:col-span-2 rounded-xl border border-[var(--card-border)] overflow-hidden">
                    {!monitorSelectedDevice ? (
                      <div className="p-8 text-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u4ece\u5de6\u4fa7\u9009\u62e9\u8bbe\u5907\u540e\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e\u3002' : 'Select a device from the left to load real-time data.'}</div>
                    ) : monitorLoading && !monitorRealtime ? (
                      <div className="p-8 text-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e\u4e2d...' : 'Loading realtime data...'}</div>
                    ) : (
                      <>
                        <div className="px-4 py-3 bg-black/[0.02] border-b border-[var(--card-border)] flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--app-text)]">{monitorSelectedDevice.hostname}</p>
                            <p className="text-[11px] text-[var(--muted-text)] font-mono">{monitorSelectedDevice.ip_address}</p>
                            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[var(--muted-text)] font-mono">
                              <span>IN {fmtRate(Number(monitorRealtime?.summary?.in_bps || 0))}</span>
                              <span>OUT {fmtRate(Number(monitorRealtime?.summary?.out_bps || 0))}</span>
                              <span>ERR {Number(monitorRealtime?.summary?.errors || 0).toLocaleString()}</span>
                              <span>DROP {Number(monitorRealtime?.summary?.drops || 0).toLocaleString()}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">ONLINE</span>
                        </div>
                        <div className="max-h-[260px] overflow-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-black/[0.02] sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">Interface</th>
                                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">Status</th>
                                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-[var(--muted-text)]">IN</th>
                                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-[var(--muted-text)]">OUT</th>
                                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-[var(--muted-text)]">BW%</th>
                                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-[var(--muted-text)]">Err</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {(monitorRealtime?.latest_interfaces || []).slice(0, 50).map((it: any, idx: number) => {
                                const bw = Math.max(Number(it.bw_in_pct || 0), Number(it.bw_out_pct || 0));
                                return (
                                  <tr key={`${it.interface_name}-${idx}`} className="hover:bg-black/[0.01]">
                                    <td className="px-3 py-2 font-mono text-[var(--app-text)]">{it.interface_name}</td>
                                    <td className="px-3 py-2"><span className={`text-[10px] font-bold uppercase ${String(it.status).toLowerCase() === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>{it.status}</span></td>
                                    <td className="px-3 py-2 text-right font-mono text-blue-600">{fmtRate(it.in_bps)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-orange-600">{fmtRate(it.out_bps)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[var(--app-text)]">{bw.toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right font-mono text-[var(--app-text)]">{Number(it.in_errors || 0) + Number(it.out_errors || 0)}</td>
                                  </tr>
                                );
                              })}
                              {(!monitorRealtime?.latest_interfaces || monitorRealtime.latest_interfaces.length === 0) && (
                                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u6682\u65e0\u5b9e\u65f6\u63a5\u53e3\u6837\u672c' : 'No realtime interface samples yet'}</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Trend Analysis */}
            <div className="space-y-3">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--app-text)]">{language === 'zh' ? '\u8d8b\u52bf\u5206\u6790' : 'Trend Analysis'}</h3>
                  <p className="text-xs text-[var(--muted-text)]">{language === 'zh' ? '\u652f\u6301\u62d6\u62fd\u7f29\u653e\u4e0e\u65f6\u95f4\u7a97\u56de\u653e\u3002' : 'Drag to zoom, supports time window replay.'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-[var(--card-border)] overflow-hidden">
                    <button type="button" onClick={() => setMonitorTrendUiMode('pro')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${monitorTrendUiMode === 'pro' ? 'bg-[var(--app-text)] text-[var(--card-bg)]' : 'text-[var(--muted-text)]'}`}>{language === 'zh' ? '\u4e13\u4e1a' : 'Pro'}</button>
                    <button type="button" onClick={() => setMonitorTrendUiMode('compact')} className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${monitorTrendUiMode === 'compact' ? 'bg-[var(--app-text)] text-[var(--card-bg)]' : 'text-[var(--muted-text)]'}`}>{language === 'zh' ? '\u7d27\u51d1' : 'Compact'}</button>
                  </div>
                  {[{ h: 0.25, l: '15m' }, { h: 1, l: '1h' }, { h: 6, l: '6h' }, { h: 24, l: '24h' }].map((p) => (
                    <button key={p.l} type="button" onClick={() => applyQuickRange(p.h)} className="rounded-lg border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted-text)] hover:bg-black/[0.03]">{p.l}</button>
                  ))}
                  <select value={monitorTrendInterface} onChange={(e) => setMonitorTrendInterface(e.target.value)} disabled={!monitorSelectedDevice} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-xs outline-none disabled:opacity-50 text-[var(--app-text)]" title={language === 'zh' ? '\u63a5\u53e3' : 'Interface'}>
                    <option value="">{language === 'zh' ? '\u6574\u673a' : 'Device'}</option>
                    {interfaceOptions.map((name: string) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <select value={monitorTrendResolution} onChange={(e) => setMonitorTrendResolution(e.target.value as '1m' | '5m')} disabled={!monitorSelectedDevice} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-xs outline-none disabled:opacity-50 text-[var(--app-text)]"><option value="1m">1m</option><option value="5m">5m</option></select>
                  <button type="button" onClick={() => { setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); }} disabled={!zoomActive || chartData.length === 0} className="rounded-lg border border-[var(--card-border)] px-2 py-1 text-[10px] font-bold text-[var(--muted-text)] hover:bg-black/[0.03] disabled:opacity-30">{language === 'zh' ? '\u91cd\u7f6e' : 'Reset'}</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input type="datetime-local" value={monitorTrendStartInput} onChange={(e) => setMonitorTrendStartInput(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-xs outline-none text-[var(--app-text)]" />
                <span className="text-xs text-[var(--muted-text)]">\u2192</span>
                <input type="datetime-local" value={monitorTrendEndInput} onChange={(e) => setMonitorTrendEndInput(e.target.value)} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-xs outline-none text-[var(--app-text)]" />
                <button type="button" onClick={() => { if (!monitorTrendStartInput || !monitorTrendEndInput) { showToast(language === 'zh' ? '\u8bf7\u5148\u9009\u62e9\u65f6\u95f4' : 'Choose time range', 'error'); return; } const s = toUtcIso(monitorTrendStartInput), e = toUtcIso(monitorTrendEndInput); if (!s || !e || new Date(s).getTime() >= new Date(e).getTime()) { showToast(language === 'zh' ? '\u65f6\u95f4\u8303\u56f4\u65e0\u6548' : 'Invalid range', 'error'); return; } setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); setMonitorTrendRange({ start_time: s, end_time: e }); }} className="rounded-lg bg-sky-600 px-3 py-1 text-[10px] font-bold uppercase text-white hover:bg-sky-700">{language === 'zh' ? '\u67e5\u8be2' : 'Apply'}</button>
                <button type="button" onClick={() => { setMonitorTrendStartInput(''); setMonitorTrendEndInput(''); setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); setMonitorTrendRange({}); }} className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-[10px] font-bold text-[var(--muted-text)] hover:bg-black/[0.03]">{language === 'zh' ? '\u6700\u8fd124h' : 'Last 24h'}</button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {trendMetricDefs.map((m) => {
                  const active = monitorTrendMetrics.includes(m.key);
                  return (
                    <button key={m.key} type="button" onClick={() => toggleTrendMetric(m.key)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${active ? 'border-black/20 bg-black/[0.04] text-[var(--app-text)]' : 'border-transparent text-[var(--muted-text)] hover:bg-black/[0.02]'}`}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? m.color : '#d1d5db' }} />
                      {m.short}
                    </button>
                  );
                })}
                <button type="button" onClick={selectAllTrendMetrics} className="text-[10px] font-bold text-[var(--muted-text)] hover:text-[var(--app-text)]">{language === 'zh' ? '\u5168\u9009' : 'All'}</button>
                <button type="button" onClick={clearAllTrendMetrics} className="text-[10px] font-bold text-[var(--muted-text)] hover:text-[var(--app-text)]">{language === 'zh' ? '\u6e05\u9664' : 'Clear'}</button>
              </div>

              {latestPoint && selectedMetricDefs.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {selectedMetricDefs.map((m) => (
                    <span key={`l-${m.key}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-[10px] font-semibold uppercase text-[var(--muted-text)]">{m.short}</span>
                      <span className="font-bold text-[var(--app-text)] tabular-nums">{fmtMetricValue(m, (latestPoint as any)[m.key])}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className={`${isCompactTrend ? 'h-[250px]' : 'h-[300px]'} rounded-xl border border-[var(--card-border)] bg-black/[0.01] p-2`}>
                {showChart ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedChartData} margin={{ top: 12, right: 16, left: 8, bottom: !zoomActive && chartData.length > 12 ? 18 : 0 }}
                      onMouseDown={(state: any) => { const li = Number(state?.activeTooltipIndex); if (!Number.isInteger(li)) return; setMonitorTrendDragStart(dragBaseIndex + li); setMonitorTrendDragEnd(dragBaseIndex + li); }}
                      onMouseMove={(state: any) => { if (monitorTrendDragStart == null) return; const li = Number(state?.activeTooltipIndex); if (!Number.isInteger(li)) return; setMonitorTrendDragEnd(dragBaseIndex + li); }}
                      onMouseUp={() => { if (monitorTrendDragStart == null || monitorTrendDragEnd == null) return; const si = Math.max(0, Math.min(monitorTrendDragStart, monitorTrendDragEnd)); const ei = Math.min(fullEndIndex, Math.max(monitorTrendDragStart, monitorTrendDragEnd)); if (ei - si >= 2) setMonitorTrendZoom({ startIndex: si, endIndex: ei }); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); }}
                      onMouseLeave={() => { if (monitorTrendDragStart != null) { setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); } }}
                    >
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" />
                      <XAxis dataKey="ts" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#60748a' }} minTickGap={isCompactTrend ? 44 : 30} tickCount={axisTickCount} interval="preserveStartEnd" tickFormatter={(v) => formatPromAxisTimestamp(String(v), displayedRangeMs)} />
                      {hasThroughputMetric && <YAxis yAxisId="throughput" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#60748a' }} tickFormatter={(v) => fmtThroughputAxis(Number(v))} />}
                      {hasCountMetric && <YAxis yAxisId="count" width={68} orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#60748a' }} tickFormatter={(v) => Number(v || 0).toLocaleString()} />}
                      <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#d9e3ef', boxShadow: '0 12px 28px rgba(15,23,42,0.10)', padding: '10px 14px', background: 'rgba(255,255,255,0.96)' }} labelFormatter={(_, payload: any) => { const row = payload?.[0]?.payload; return row?.ts ? formatPromTimestamp(row.ts) : _; }} formatter={(v: any, _n: any, entry: any) => { const mk = String(entry?.dataKey || ''); const def = trendMetricMap[mk as keyof typeof trendMetricMap]; if (v == null || !Number.isFinite(Number(v))) return [language === 'zh' ? '\u65e0\u6837\u672c' : 'No sample', def?.short || mk]; if (def?.unit === 'throughput') return [fmtThroughputProm(Number(v)), def.short]; return [Number(v).toLocaleString(), def?.short || mk]; }} />
                      {selectedMetricDefs.map((m) => <Area key={m.key} type="monotone" dataKey={m.key} yAxisId={m.unit === 'throughput' ? 'throughput' : 'count'} stroke={m.color} fill={`${m.color}1f`} strokeWidth={2} name={m.short} isAnimationActive={false} connectNulls={false} />)}
                      {!zoomActive && chartData.length > 12 && <Brush dataKey="ts" height={24} travellerWidth={10} startIndex={0} endIndex={fullEndIndex} stroke="#94a3b8" fill="#eef2f6" tickFormatter={(v: any) => formatPromAxisTimestamp(String(v), displayedRangeMs)} onChange={(next: any) => { const si = Number(next?.startIndex), ei = Number(next?.endIndex); if (!Number.isInteger(si) || !Number.isInteger(ei)) return; if (si <= 0 && ei >= fullEndIndex) { setMonitorTrendZoom(null); return; } setMonitorTrendZoom({ startIndex: si, endIndex: ei }); }} />}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : monitorSelectedDevice && selectedMetricDefs.length === 0 ? (
                  <div className="h-full" />
                ) : monitorSelectedDevice && hasTrendResponse && chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u8be5\u65f6\u95f4\u8303\u56f4\u6682\u65e0\u8d8b\u52bf\u6570\u636e\u3002' : 'No trend data in the selected time range.'}</div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u9009\u62e9\u8bbe\u5907\u540e\u67e5\u770b\u8d8b\u52bf\u3002' : 'Select a device to view trend.'}</div>
                )}
              </div>
            </div>

            {/* Alert Timeline */}
            <div className="rounded-xl border border-[var(--card-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--card-border)] flex items-center justify-between gap-4 bg-black/[0.01]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--app-text)]">{language === 'zh' ? '\u544a\u8b66\u65f6\u95f4\u7ebf' : 'Alert Timeline'}</h3>
                  <p className="text-[11px] text-[var(--muted-text)]">{language === 'zh' ? '\u5305\u542b\u89e6\u53d1\u4e0e\u6062\u590d\uff0c\u652f\u6301\u5206\u9875\u3002' : 'Trigger and recover lifecycle with pagination.'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select title={language === 'zh' ? '\u7ea7\u522b' : 'Severity'} value={monitorAlertsSeverity} onChange={(e) => setMonitorAlertsSeverity(e.target.value)} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-2 py-1 text-xs outline-none text-[var(--app-text)]">
                    <option value="all">{language === 'zh' ? '\u5168\u90e8' : 'All'}</option>
                    <option value="critical">{language === 'zh' ? '\u4e25\u91cd' : 'Critical'}</option>
                    <option value="major">{language === 'zh' ? '\u4e3b\u8981' : 'Major'}</option>
                    <option value="warning">{language === 'zh' ? '\u6b21\u8981' : 'Minor'}</option>
                  </select>
                  <select title={language === 'zh' ? '\u9636\u6bb5' : 'Phase'} value={monitorAlertsPhase} onChange={(e) => setMonitorAlertsPhase(e.target.value)} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-2 py-1 text-xs outline-none text-[var(--app-text)]">
                    <option value="all">{language === 'zh' ? '\u5168\u90e8' : 'All'}</option>
                    <option value="active">{language === 'zh' ? '\u544a\u8b66\u4e2d' : 'Active'}</option>
                    <option value="recovered">{language === 'zh' ? '\u5df2\u6062\u590d' : 'Recovered'}</option>
                  </select>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-black/[0.02]">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u65f6\u95f4' : 'Time'}</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u7ea7\u522b' : 'Severity'}</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u9636\u6bb5' : 'Phase'}</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u6807\u9898' : 'Title'}</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u5185\u5bb9' : 'Message'}</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--muted-text)]">{language === 'zh' ? '\u6062\u590d' : 'Recovered'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {monitorAlerts.map((a: any) => (
                      <tr key={a.id} className="hover:bg-black/[0.01]">
                        <td className="px-4 py-2 text-[var(--muted-text)]">{a.created_at ? formatTs(a.created_at, true) : '-'}</td>
                        <td className="px-4 py-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${String(a.severity).toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : String(a.severity).toLowerCase() === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-black/5 text-[var(--muted-text)]'}`}>{severityLabel(a.severity)}</span></td>
                        <td className="px-4 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${a.resolved_at ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{phaseLabel(a.resolved_at)}</span></td>
                        <td className="px-4 py-2 font-semibold text-[var(--app-text)]">{a.title}</td>
                        <td className="px-4 py-2 text-[var(--muted-text)]">{a.message}</td>
                        <td className="px-4 py-2 text-[var(--muted-text)]">{a.resolved_at ? formatTs(a.resolved_at, true) : '-'}</td>
                      </tr>
                    ))}
                    {monitorAlerts.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted-text)]">{language === 'zh' ? '\u5f53\u524d\u65e0\u544a\u8b66\u8bb0\u5f55\u3002' : 'No alert records found.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <MonitoringPagination language={language} currentPage={monitorAlertsPage} totalItems={monitorAlertTotal} itemsPerPage={monitorAlertsPageSize} onPageChange={setMonitorAlertsPage} />
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringCenter;
