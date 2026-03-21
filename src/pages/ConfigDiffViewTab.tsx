import React from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { DiffLine } from '../types';

interface DiffSnapshot {
  id: string;
  hostname: string;
  ip_address?: string;
  timestamp: string;
  trigger?: string;
  content?: string;
}

interface DiffRenderEntry {
  line: DiffLine;
  originalIndex: number;
}

interface FullSideBySideRow {
  originalIndex: number;
  rowType: 'context' | 'add' | 'remove';
  leftLine: number | null;
  rightLine: number | null;
  leftContent: string;
  rightContent: string;
}

interface DiffChangeBlock {
  startChangeIdx: number;
  endChangeIdx: number;
  label: string;
}

interface ConfigDiffViewTabProps {
  t: (key: string) => string;
  language: string;
  configSnapshotKeyword: string;
  configSnapshotsLoading: boolean;
  configSnapshots: DiffSnapshot[];
  configDiffLeft: DiffSnapshot | null;
  configDiffRight: DiffSnapshot | null;
  sameTargetSnapshots: DiffSnapshot[];
  activeDiffLines: DiffLine[];
  activeChangeLineIndexes: number[];
  diffFocusChangeIdx: number;
  diffOnlyChanges: boolean;
  diffShowFullBoth: boolean;
  renderedDiffLines: DiffRenderEntry[];
  fullSideBySideRows: FullSideBySideRow[];
  diffChangeBlocks: DiffChangeBlock[];
  filteredDiffChangeBlocks: DiffChangeBlock[];
  diffBlockQuery: string;
  diffLineRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onReset: () => void;
  onConfigSnapshotKeywordChange: (value: string) => void;
  onSearchSnapshots: () => Promise<void> | void;
  onClearSearch: () => Promise<void> | void;
  onSelectSnapshot: (side: 'left' | 'right', snapshotId: string) => Promise<void> | void;
  onJumpToDiff: (direction: 'prev' | 'next') => void;
  onToggleOnlyChanges: () => void;
  onToggleFullBoth: () => void;
  onDiffBlockQueryChange: (value: string) => void;
  onToggleQuickKeyword: (keyword: string) => void;
  onFocusDiffChangeAt: (changeIdx: number) => void;
}

const ConfigDiffViewTab: React.FC<ConfigDiffViewTabProps> = ({
  t,
  language,
  configSnapshotKeyword,
  configSnapshotsLoading,
  configSnapshots,
  configDiffLeft,
  configDiffRight,
  sameTargetSnapshots,
  activeDiffLines,
  activeChangeLineIndexes,
  diffFocusChangeIdx,
  diffOnlyChanges,
  diffShowFullBoth,
  renderedDiffLines,
  fullSideBySideRows,
  diffChangeBlocks,
  filteredDiffChangeBlocks,
  diffBlockQuery,
  diffLineRefs,
  onReset,
  onConfigSnapshotKeywordChange,
  onSearchSnapshots,
  onClearSearch,
  onSelectSnapshot,
  onJumpToDiff,
  onToggleOnlyChanges,
  onToggleFullBoth,
  onDiffBlockQueryChange,
  onToggleQuickKeyword,
  onFocusDiffChangeAt,
}) => {
  const safeFocusIdx = activeChangeLineIndexes.length === 0 ? 0 : Math.min(diffFocusChangeIdx, activeChangeLineIndexes.length - 1);
  const focusedLineIndex = activeChangeLineIndexes[safeFocusIdx];
  const added = activeDiffLines.filter((line) => line.type === 'add').length;
  const removed = activeDiffLines.filter((line) => line.type === 'remove').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-end mb-5 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{t('diffCompare')}</h2>
          <p className="text-sm text-black/40">{t('diffCompareTitle')}</p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-black/30 hover:text-black transition-all px-3 py-1.5 border border-black/10 rounded-lg"
        >
          {t('cancel')}
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-black/5 bg-black/[0.01]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={configSnapshotKeyword}
              onChange={(event) => onConfigSnapshotKeywordChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void onSearchSnapshots();
                }
              }}
              placeholder={language === 'zh' ? '模糊搜索: 交换机名称或IP' : 'Fuzzy search: switch name or IP'}
              className="w-64 px-2 py-1.5 text-xs border border-black/10 rounded-lg outline-none bg-white"
            />
            <button onClick={() => void onSearchSnapshots()} className="px-2.5 py-1.5 text-[10px] border border-black/10 rounded-lg hover:bg-black/5">
              {language === 'zh' ? '查找快照' : 'Search snapshots'}
            </button>
            <button onClick={() => void onClearSearch()} className="px-2.5 py-1.5 text-[10px] border border-black/10 rounded-lg hover:bg-black/5">
              {language === 'zh' ? '清空' : 'Clear'}
            </button>
            <button
              onClick={() => void onSearchSnapshots()}
              className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-all"
              title={language === 'zh' ? '刷新快照列表' : 'Refresh snapshots'}
            >
              <RotateCcw size={13} className={configSnapshotsLoading ? 'animate-spin' : ''} />
            </button>
            {!configSnapshotKeyword.trim() && !configDiffLeft && (
              <span className="text-[11px] text-black/40">
                {language === 'zh' ? '请先按设备名或IP过滤，再选择快照对比' : 'Filter by hostname/IP first, then pick snapshots for diff'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['left', 'right'] as const).map((side) => {
              const current = side === 'left' ? configDiffLeft : configDiffRight;
              const snapshotList = side === 'right' && configDiffLeft ? sameTargetSnapshots : configSnapshots;
              return (
                <div key={side}>
                  <label className="text-[10px] font-bold uppercase text-black/30 mb-1.5 block">
                    {side === 'left' ? t('beforeLabel') : t('afterLabel')}
                    {current && <span className="ml-2 font-mono text-[#00bceb] normal-case">{current.hostname}{current.ip_address ? ` (${current.ip_address})` : ''} · {new Date(current.timestamp).toLocaleString()}</span>}
                  </label>
                  <select
                    value={current?.id || ''}
                    disabled={side === 'right' && !configDiffLeft}
                    title={side === 'left' ? (language === 'zh' ? '选择变更前快照' : 'Select before snapshot') : (language === 'zh' ? '选择变更后快照' : 'Select after snapshot')}
                    onChange={(event) => void onSelectSnapshot(side, event.target.value)}
                    className="w-full px-3 py-2 border border-black/10 rounded-xl text-xs outline-none bg-white"
                  >
                    <option value="">
                      {side === 'right' && !configDiffLeft ? (language === 'zh' ? '请先选择左侧快照' : 'Select left snapshot first') : t('chooseSnapshot')}
                    </option>
                    {snapshotList.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {snapshot.hostname}{snapshot.ip_address ? ` (${snapshot.ip_address})` : ''} · {new Date(snapshot.timestamp).toLocaleString()} ({snapshot.trigger})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {configDiffLeft && (
            <p className="mt-3 text-[11px] text-black/45">
              {language === 'zh'
                ? `右侧仅展示与左侧同IP的快照${configDiffLeft.ip_address ? `（${configDiffLeft.ip_address}）` : ''}`
                : `Right side only shows snapshots from the same IP${configDiffLeft.ip_address ? ` (${configDiffLeft.ip_address})` : ''}`}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto font-mono text-xs leading-6">
          {configDiffLeft && configDiffRight ? (
            <div className="h-full bg-[#1E1E1E] flex flex-col">
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/5 text-xs">
                <span className="font-mono text-white/40">{configDiffLeft.hostname}</span>
                <span className="text-white/20">→</span>
                <span className="font-mono text-white/40">{configDiffRight.hostname}</span>
                <span className="ml-auto text-emerald-400">+{added} {t('linesAdded')}</span>
                <span className="text-red-400">−{removed} {t('linesRemoved')}</span>
                {added === 0 && removed === 0 && <span className="text-white/40">{t('noDiff')}</span>}
                {activeChangeLineIndexes.length > 0 && <span className="text-white/45 font-mono">{safeFocusIdx + 1}/{activeChangeLineIndexes.length}</span>}
                <button
                  onClick={() => onJumpToDiff('prev')}
                  disabled={activeChangeLineIndexes.length === 0}
                  className="p-1 rounded border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={language === 'zh' ? '上一处差异 (P)' : 'Previous change (P)'}
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => onJumpToDiff('next')}
                  disabled={activeChangeLineIndexes.length === 0}
                  className="p-1 rounded border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={language === 'zh' ? '下一处差异 (N)' : 'Next change (N)'}
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={onToggleOnlyChanges}
                  className={`px-2 py-1 rounded border transition-colors ${diffOnlyChanges ? 'border-[#00bceb]/60 text-[#00d3ff] bg-[#00bceb]/10' : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
                  title={language === 'zh' ? '仅显示变更行 (F)' : 'Show changed lines only (F)'}
                >
                  {language === 'zh' ? '仅变更' : 'Changes only'}
                </button>
                <button
                  onClick={onToggleFullBoth}
                  className={`px-2 py-1 rounded border transition-colors ${diffShowFullBoth ? 'border-[#00bceb]/60 text-[#00d3ff] bg-[#00bceb]/10' : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
                  title={language === 'zh' ? '显示两侧完整配置' : 'Show full configs on both sides'}
                >
                  {language === 'zh' ? '两侧全部' : 'Both full'}
                </button>
              </div>
              <div className="px-5 py-1.5 border-b border-white/5 text-[11px] text-white/35">
                {language === 'zh' ? '可使用右上角按钮快速定位与筛选差异块' : 'Use toolbar buttons above to jump and filter change blocks quickly'}
              </div>
              <div className="flex-1 min-h-0 flex overflow-hidden">
                <div className="flex-1 overflow-auto">
                  {diffShowFullBoth ? (
                    <div className="min-w-[960px]">
                      <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-white/10 bg-[#181818] text-[10px] uppercase tracking-wider text-white/45">
                        <div className="px-4 py-1.5 border-r border-white/10">{language === 'zh' ? '左侧配置 (A)' : 'Left Config (A)'}</div>
                        <div className="px-4 py-1.5">{language === 'zh' ? '右侧配置 (B)' : 'Right Config (B)'}</div>
                      </div>
                      {fullSideBySideRows.map((row) => {
                        const isFocused = focusedLineIndex !== undefined && row.originalIndex === focusedLineIndex;
                        return (
                          <div key={row.originalIndex} ref={(element) => { diffLineRefs.current[row.originalIndex] = element; }} className={`grid grid-cols-2 ${isFocused ? 'ring-1 ring-[#00d3ff]/80 bg-[#00bceb]/10' : ''}`}>
                            <div className={`flex items-start px-4 py-0.5 border-r border-white/10 ${row.rowType === 'remove' ? 'bg-red-500/15' : ''}`}>
                              <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{row.leftLine || ''}</span>
                              <span className="w-4 select-none flex-shrink-0 text-red-400">{row.rowType === 'remove' ? '−' : ' '}</span>
                              <span className={`${row.rowType === 'remove' ? 'text-red-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{row.leftContent}</span>
                            </div>
                            <div className={`flex items-start px-4 py-0.5 ${row.rowType === 'add' ? 'bg-emerald-500/15' : ''}`}>
                              <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{row.rightLine || ''}</span>
                              <span className="w-4 select-none flex-shrink-0 text-emerald-400">{row.rowType === 'add' ? '+' : ' '}</span>
                              <span className={`${row.rowType === 'add' ? 'text-emerald-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{row.rightContent}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderedDiffLines.map(({ line, originalIndex }) => {
                      const isFocused = focusedLineIndex !== undefined && originalIndex === focusedLineIndex;
                      return (
                        <div
                          key={originalIndex}
                          ref={(element) => { diffLineRefs.current[originalIndex] = element; }}
                          className={`flex items-start px-4 py-0.5 ${line.type === 'add' ? 'bg-emerald-500/15' : line.type === 'remove' ? 'bg-red-500/15' : ''} ${isFocused ? 'ring-1 ring-[#00d3ff]/80 bg-[#00bceb]/10' : ''}`}
                        >
                          <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{line.lineA || ''}</span>
                          <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{line.lineB || ''}</span>
                          <span className={`w-4 select-none flex-shrink-0 ${line.type === 'add' ? 'text-emerald-400' : line.type === 'remove' ? 'text-red-400' : 'text-white/20'}`}>
                            {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                          </span>
                          <span className={`${line.type === 'add' ? 'text-emerald-300' : line.type === 'remove' ? 'text-red-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{line.content}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                {diffChangeBlocks.length > 0 && (
                  <aside className="hidden xl:block w-64 border-l border-white/10 bg-[#181818] overflow-auto">
                    <div className="px-3 py-2 border-b border-white/10">
                      <div className="text-[10px] uppercase tracking-wider text-white/45 font-bold">{language === 'zh' ? '变更目录' : 'Change Map'}</div>
                      <input
                        value={diffBlockQuery}
                        onChange={(event) => onDiffBlockQueryChange(event.target.value)}
                        placeholder={language === 'zh' ? '过滤: interface / route / acl' : 'Filter: interface / route / acl'}
                        className="mt-2 w-full px-2 py-1.5 rounded-md border border-white/15 bg-black/25 text-[10px] text-white/80 placeholder:text-white/30 outline-none focus:border-[#00bceb]/50"
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {['interface', 'route', 'acl', 'bgp', 'ospf', 'vlan'].map((keyword) => (
                          <button
                            key={keyword}
                            onClick={() => onToggleQuickKeyword(keyword)}
                            className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${diffBlockQuery.toLowerCase() === keyword ? 'border-[#00bceb]/60 text-[#7ee8ff] bg-[#00bceb]/10' : 'border-white/15 text-white/55 hover:text-white hover:border-white/30'}`}
                          >
                            {keyword}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {filteredDiffChangeBlocks.map((block, blockIdx) => {
                        const isActive = diffFocusChangeIdx >= block.startChangeIdx && diffFocusChangeIdx <= block.endChangeIdx;
                        return (
                          <button
                            key={`${block.startChangeIdx}-${block.endChangeIdx}`}
                            onClick={() => onFocusDiffChangeAt(block.startChangeIdx)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${isActive ? 'border-[#00bceb]/60 bg-[#00bceb]/15 text-[#7ee8ff]' : 'border-white/10 text-white/60 hover:text-white hover:border-white/25 hover:bg-white/5'}`}
                            title={block.label}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold">#{blockIdx + 1}</span>
                              <span className="text-[10px] font-mono text-white/45">{block.startChangeIdx + 1}-{block.endChangeIdx + 1}</span>
                            </div>
                            <div className="mt-1 text-[10px] leading-4 truncate">{block.label}</div>
                          </button>
                        );
                      })}
                      {filteredDiffChangeBlocks.length === 0 && (
                        <p className="px-2 py-2 text-[10px] text-white/35">{language === 'zh' ? '没有匹配的变更块' : 'No matching change block'}</p>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full bg-[#1E1E1E] flex flex-col items-center justify-center text-white/20 text-center p-8">
              <span className="text-5xl mb-4">⟷</span>
              <p className="text-sm">{t('diffHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigDiffViewTab;