import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptySubtext?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
  selectedKey?: string | null;
  pageSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found',
  emptySubtext = 'Try adjusting your filters or search query',
  emptyIcon,
  onRowClick,
  selectedKey,
  pageSize,
  className = '',
  style,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Sort logic if applicable
  let processedData = [...data];
  if (sortKey) {
    processedData.sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const res = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? res : -res;
    });
  }

  // Pagination logic
  const totalPages = pageSize ? Math.ceil(processedData.length / pageSize) : 1;
  const paginatedData = pageSize
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData;

  return (
    <div
      className={`data-table-container ${className}`}
      style={{
        background: 'var(--bg-surface, #111927)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-md, 8px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table
          className="data-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '13px',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--bg-surface-sub, #162236)',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{
                      padding: '10px 16px',
                      fontWeight: 650,
                      color: 'var(--text-muted, #94a3b8)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && isSorted && (
                        sortDirection === 'asc' ? <ChevronUp size={13} color="#38bdf8" /> : <ChevronDown size={13} color="#38bdf8" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} style={{ borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.04))' }}>
                  {columns.map((col, j) => (
                    <td key={`skel-col-${j}`} style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          height: '14px',
                          background: 'var(--bg-surface-sub, #162236)',
                          borderRadius: '4px',
                          animation: 'pulse 1.5s ease-in-out infinite',
                          width: j === 0 ? '70%' : '50%',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    {emptyIcon || <Inbox size={32} style={{ opacity: 0.4 }} />}
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main, #f1f5f9)' }}>
                      {emptyMessage}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
                      {emptySubtext}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className="table-row-hover"
                    style={{
                      borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                      background: isSelected ? 'var(--bg-surface-hover, #1c2b44)' : 'transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '12px 16px',
                          textAlign: col.align || 'left',
                          color: 'var(--text-main, #f1f5f9)',
                        }}
                      >
                        {col.render ? col.render(item, index) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pageSize && totalPages > 1 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            background: 'var(--bg-surface-sub, #162236)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} entries
          </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>
            <span style={{ fontWeight: 600, color: 'var(--text-main, #f1f5f9)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
