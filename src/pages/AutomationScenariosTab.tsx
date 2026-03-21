import React from 'react';
import { Play, Search } from 'lucide-react';

interface PlatformMeta {
  icon?: string;
  vendor?: string;
}

interface ScenarioPhaseCommands {
  pre_check?: string[];
  execute?: string[];
  post_check?: string[];
  rollback?: string[];
}

interface AutomationScenario {
  id: string;
  icon?: string;
  risk: 'low' | 'medium' | 'high';
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  category: string;
  is_custom?: boolean;
  supported_platforms?: string[];
  default_platform?: string;
  platform_phases?: Record<string, ScenarioPhaseCommands>;
}

interface AutomationScenariosTabProps {
  t: (key: string) => string;
  language: string;
  scenarioSearch: string;
  filteredScenarios: AutomationScenario[];
  platforms: Record<string, PlatformMeta>;
  onScenarioSearchChange: (value: string) => void;
  onOpenManualScenarioDraft: () => void;
  onUseScenario: (scenario: AutomationScenario) => void;
}

const AutomationScenariosTab: React.FC<AutomationScenariosTabProps> = ({
  t,
  language,
  scenarioSearch,
  filteredScenarios,
  platforms,
  onScenarioSearchChange,
  onOpenManualScenarioDraft,
  onUseScenario,
}) => {
  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{t('scenarioLibrary')}</h2>
          <p className="text-sm text-black/40">{t('scenarioLibraryDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" size={13} />
            <input
              value={scenarioSearch}
              onChange={(e) => onScenarioSearchChange(e.target.value)}
              placeholder="Search scenario keyword"
              className="pl-8 pr-3 py-2 text-xs border border-black/10 rounded-xl outline-none focus:border-[#00bceb]/40 w-64"
            />
          </div>
          <button
            onClick={onOpenManualScenarioDraft}
            className="px-3 py-2 bg-[#00bceb] text-white rounded-xl text-xs font-semibold hover:bg-[#0096bd] transition-all"
          >
            + Custom Scenario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredScenarios.map((scenario) => {
          const riskColor = scenario.risk === 'high'
            ? 'border-red-200 bg-red-50/30'
            : scenario.risk === 'medium'
              ? 'border-amber-200 bg-amber-50/30'
              : 'border-emerald-200 bg-emerald-50/30';

          const defaultPlatform = scenario.default_platform || scenario.supported_platforms?.[0];
          const platformPhases = defaultPlatform ? scenario.platform_phases?.[defaultPlatform] : undefined;

          return (
            <div key={scenario.id} className={`rounded-2xl border ${riskColor} p-6 hover:shadow-lg transition-all`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{scenario.icon}</span>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  scenario.risk === 'high' ? 'bg-red-100 text-red-600' : scenario.risk === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>{scenario.risk} risk</span>
              </div>
              <h3 className="text-sm font-bold mb-1">{language === 'zh' ? scenario.name_zh : scenario.name}</h3>
              <p className="text-xs text-black/50 mb-3">{language === 'zh' ? scenario.description_zh : scenario.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-black/5 rounded-full text-black/40">{scenario.category}</span>
                {scenario.is_custom && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#00bceb]/10 rounded-full text-[#008bb0]">Custom</span>}
                {(scenario.supported_platforms || []).map((platformKey) => {
                  const platform = platforms[platformKey];
                  return (
                    <span key={platformKey} className="text-[9px] px-2 py-0.5 bg-black/5 rounded-full text-black/30">
                      {platform ? `${platform.icon} ${platform.vendor}` : platformKey}
                    </span>
                  );
                })}
              </div>
              <div className="text-[10px] text-black/30 space-y-0.5 mb-4">
                <p>📋 Pre-Check: {platformPhases?.pre_check?.length || 0} commands</p>
                <p>⚡ Execute: {platformPhases?.execute?.length || 0} commands</p>
                <p>✅ Post-Check: {platformPhases?.post_check?.length || 0} commands</p>
                <p>↩️ Rollback: {platformPhases?.rollback?.length || 0} commands</p>
                <p>🏢 {t('platformsSupported')}: {scenario.supported_platforms?.length || 0}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onUseScenario(scenario)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00bceb] text-white rounded-xl text-xs font-medium hover:bg-[#0096bd] transition-all"
                >
                  <Play size={12} /> {t('useScenario')}
                </button>
                <button
                  onClick={() => onUseScenario(scenario)}
                  className="px-3 py-2 border border-black/10 rounded-xl text-xs font-medium hover:bg-black/5 transition-all"
                >
                  {t('previewCommands')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AutomationScenariosTab;