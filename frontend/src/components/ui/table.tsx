import React, { ReactNode } from 'react';

export interface TableProps {
  children: ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className="overflow-x-auto">
    <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
      {children}
    </table>
  </div>
);

export interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => (
  <thead className={`bg-gray-50 border-b border-gray-200 ${className}`}>
    {children}
  </thead>
);

export interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`}>
    {children}
  </tbody>
);

export interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => (
  <tr 
    className={`${onClick ? 'cursor-pointer hover:bg-blue-50 transition-colors' : 'hover:bg-gray-50 transition-colors'} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

export interface TableCellProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  className = '', 
  align = 'left' 
}) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100 ${alignClasses[align]} ${className}`}>
      {children}
    </td>
  );
};

export interface TableHeaderCellProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  onSort?: () => void;
}

export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({ 
  children, 
  className = '', 
  align = 'left',
  sortable = false,
  onSort
}) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const content = (
    <span className={`${sortable ? 'cursor-pointer hover:text-gray-900' : ''}`}>
      {children}
    </span>
  );

  return (
    <th 
      className={`px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 ${alignClasses[align]} ${className}`}
      onClick={sortable ? onSort : undefined}
    >
      {content}
    </th>
  );
};
