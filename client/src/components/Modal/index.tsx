import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
  className,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              >
                <div
                  className={cn(
                    'w-full bg-white dark:bg-surface-900 shadow-modal border border-surface-100 dark:border-surface-800 overflow-hidden',
                    'rounded-t-3xl sm:rounded-2xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col',
                    SIZE_MAP[size],
                    className
                  )}
                >
                {!title && <Dialog.Title className="sr-only">Dialog</Dialog.Title>}
                {!description && <Dialog.Description className="sr-only">Dialog content</Dialog.Description>}
                {(title || showClose) && (
                  <div className="flex items-start justify-between p-6 border-b border-surface-100 dark:border-surface-800 flex-shrink-0">
                    <div>
                      {title && (
                        <Dialog.Title className="font-display font-semibold text-lg text-surface-900 dark:text-white">
                          {title}
                        </Dialog.Title>
                      )}
                      {description && (
                        <Dialog.Description className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    {showClose && (
                      <Dialog.Close asChild>
                        <button className="btn-ghost w-8 h-8 rounded-xl ml-4 flex-shrink-0 -mt-1 -mr-1 flex items-center justify-center">
                          <X size={16} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className="overflow-y-auto flex-1">
                  {children}
                </div>
              </div>
            </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

export default Modal;
