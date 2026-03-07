import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: Array<number | string> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);
  if (windowStart > 2) items.push('left-ellipsis');
  for (let page = windowStart; page <= windowEnd; page += 1) items.push(page);
  if (windowEnd < totalPages - 1) items.push('right-ellipsis');
  items.push(totalPages);
  return items;
}

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (size: number) => void;
  language: string;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalItems, onPageChange, itemsPerPage = 10, onItemsPerPageChange, language }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const progressPct = Math.max(0, Math.min(100, Math.round((endItem / totalItems) * 100)));
  const pageItems = buildPaginationItems(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 px-6 py-4 bg-[linear-gradient(180deg,rgba(0,0,0,0.015),rgba(0,0,0,0.025))] border-t border-black/5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <progress
            value={progressPct}
            max={100}
            className="h-1.5 w-24 overflow-hidden rounded-full [appearance:none] [&::-moz-progress-bar]:bg-[#00bceb] [&::-webkit-progress-bar]:bg-black/6 [&::-webkit-progress-value]:bg-[#00bceb]"
          />
          <p className="text-[10px] font-bold uppercase text-black/40 tracking-widest">
            {language === 'zh'
              ? `第 ${startItem}-${endItem} 条 / 共 ${totalItems} 条`
              : `${startItem}-${endItem} / ${totalItems}`}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-black/35">
          {language === 'zh' ? `第 ${currentPage} 页，共 ${totalPages} 页` : `Page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-black/35 tracking-wider">{language === 'zh' ? '每页' : 'Rows'}</span>
            <div className="inline-flex rounded-xl border border-black/8 bg-white p-1 shadow-sm">
              {[10, 20, 50, 100].map(size => {
                const isActive = itemsPerPage === size;
                return (
                  <button
                    key={size}
                    type="button"
                    title={language === 'zh' ? `每页 ${size} 条` : `${size} rows per page`}
                    aria-label={language === 'zh' ? `每页 ${size} 条` : `${size} rows per page`}
                    onClick={() => onItemsPerPageChange(size)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      isActive
                        ? 'bg-[#00172d] text-white shadow-md'
                        : 'text-black/45 hover:bg-black/[0.04] hover:text-black/75'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              title={language === 'zh' ? '上一页' : 'Previous page'}
              aria-label={language === 'zh' ? '上一页' : 'Previous page'}
              onClick={() => onPageChange(currentPage - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-black/8 bg-white px-3 text-[11px] font-semibold text-black/55 shadow-sm transition-all hover:-translate-x-0.5 hover:border-black/15 hover:text-black disabled:opacity-25 disabled:hover:translate-x-0"
            >
              <ChevronLeft size={15} />
              <span>{language === 'zh' ? '上一页' : 'Prev'}</span>
            </button>
            <div className="flex items-center gap-1.5">
              {pageItems.map((item, index) => {
                if (typeof item !== 'number') {
                  return <span key={`${item}-${index}`} className="px-1 text-sm font-semibold text-black/25">···</span>;
                }
                const isActive = currentPage === item;
                return (
                  <button
                    key={item}
                    type="button"
                    title={language === 'zh' ? `第 ${item} 页` : `Page ${item}`}
                    aria-label={language === 'zh' ? `第 ${item} 页` : `Page ${item}`}
                    onClick={() => onPageChange(item)}
                    className={`h-9 min-w-9 rounded-xl px-3 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#00172d] text-white shadow-lg shadow-[#00172d]/18 scale-[1.03]'
                        : 'border border-transparent text-black/45 hover:border-black/8 hover:bg-white hover:text-black'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={currentPage === totalPages}
              title={language === 'zh' ? '下一页' : 'Next page'}
              aria-label={language === 'zh' ? '下一页' : 'Next page'}
              onClick={() => onPageChange(currentPage + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-black/8 bg-white px-3 text-[11px] font-semibold text-black/55 shadow-sm transition-all hover:translate-x-0.5 hover:border-black/15 hover:text-black disabled:opacity-25 disabled:hover:translate-x-0"
            >
              <span>{language === 'zh' ? '下一页' : 'Next'}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pagination;
