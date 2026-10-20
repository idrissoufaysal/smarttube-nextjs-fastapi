'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { AddVideoModal } from './add-video-modal';

interface AddVideoButtonProps {
  variant: 'header' | 'empty-state';
}

export function AddVideoButton({ variant }: AddVideoButtonProps) {
  const t = useTranslations('modals.addButton');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold bg-foreground/[0.02] border border-foreground/[0.06] text-on-surface hover:bg-foreground/[0.06] hover:border-foreground/[0.1] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          title={t('title')}
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          {t('label')}
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold gradient-primary text-[#2b140f] shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('first')}
        </button>
      )}

      <AddVideoModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
