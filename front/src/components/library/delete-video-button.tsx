'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/api-config';

interface DeleteVideoButtonProps {
  videoId: string;
  videoTitle: string;
}

export function DeleteVideoButton({ videoId, videoTitle }: DeleteVideoButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/video?videoId=${videoId}`, { method: 'DELETE' });
      if (res.ok) {
        setOpen(false);
        router.refresh(); // Re-fetch Server Component data
      }
    } catch (e) {
      console.error('Erreur suppression:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Floating delete button — appears on parent card hover */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="
            absolute top-2 right-2 z-20
            w-8 h-8 rounded-lg
            bg-black/60 backdrop-blur-sm
            border border-white/10
            flex items-center justify-center
            text-white/40 hover:text-red-400
            hover:bg-red-500/15 hover:border-red-500/30
            transition-all duration-200
            opacity-100 scale-100
            lg:opacity-0 lg:group-hover:opacity-100
            lg:scale-90 lg:group-hover:scale-100
          "
          aria-label="Supprimer la vidéo"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>

      <DialogContent className="bg-surface-dim border border-white/[0.06] text-on-surface max-w-sm rounded-2xl shadow-2xl shadow-black/60 p-0 overflow-hidden">
        {/* Top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-red-500/0 via-red-500/60 to-red-500/0" />

        <div className="p-6">
          <DialogHeader className="space-y-3 mb-6">
            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <DialogTitle className="text-base font-bold text-on-surface text-center">
              Supprimer la vidéo ?
            </DialogTitle>
            <DialogDescription className="text-xs text-on-surface/45 text-center leading-relaxed">
              <span className="font-semibold text-on-surface/70 line-clamp-1">&ldquo;{videoTitle}&rdquo;</span>
              <br />
              Cette action supprimera la vidéo, sa transcription, ses notes et tout l'historique de quiz. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 flex-col-reverse sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isDeleting}
              className="flex-1 h-9 rounded-xl text-sm font-medium border border-white/[0.06] text-on-surface/50 hover:text-on-surface hover:bg-white/[0.04]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 h-9 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 hover:text-red-300 gap-2 transition-all"
            >
              {isDeleting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Suppression…</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5" /> Supprimer</>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
