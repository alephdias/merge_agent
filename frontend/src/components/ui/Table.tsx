import type { ReactNode } from 'react';

interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, keyExtractor, emptyMessage = 'Nenhum registro.' }: TableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <thead style={{ background: '#e3f2fd' }}>
          <tr>
            {columns.map((col) => (
              <th key={col.header} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '20px 14px', textAlign: 'center', color: '#888', fontSize: 14 }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={keyExtractor(row)} style={{ borderBottom: '1px solid #eee' }}>
                {columns.map((col) => (
                  <td key={col.header} style={{ padding: '10px 14px', fontSize: 14 }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
