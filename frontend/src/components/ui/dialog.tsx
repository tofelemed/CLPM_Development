import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  if (!open) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative bg-white rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth]}
            transform transition-all
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 pb-4">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="p-1 h-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className={title || showCloseButton ? 'px-6 pb-6' : 'p-6'}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export interface DialogHeaderProps {
  children: ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => (
  <div className="mb-4">
    {children}
  </div>
);

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className = '' }) => (
  <div className={`flex gap-2 justify-end pt-4 ${className}`}>
    {children}
  </div>
);
