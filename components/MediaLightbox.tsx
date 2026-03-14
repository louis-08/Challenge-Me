import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../types';

export interface LightboxItem {
  media: MediaItem;
  uploaderName: string;
}

interface MediaLightboxProps {
  items: LightboxItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  items,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const current = items[currentIndex];
  if (!current) return null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < items.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && canGoPrev) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && canGoNext) onNavigate(currentIndex + 1);
    },
    [currentIndex, canGoPrev, canGoNext, onClose, onNavigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleKeyDown]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'lightbox-fade-in 0.2s ease-out',
      }}
      onClick={onClose}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes lightbox-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lightbox-slide-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Uploader name — top left */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          background: 'rgba(0,0,0,0.5)',
          padding: '8px 16px',
          borderRadius: 12,
          zIndex: 10,
          letterSpacing: '0.02em',
          userSelect: 'none',
        }}
      >
        {current.uploaderName}
      </div>

      {/* Counter — top center */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          fontWeight: 600,
          background: 'rgba(0,0,0,0.4)',
          padding: '6px 14px',
          borderRadius: 10,
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        {currentIndex + 1} / {items.length}
      </div>

      {/* Close button — top right */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Schließen"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: '#fff',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: 12,
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Previous button */}
      {canGoPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          aria-label="Vorheriges Medium"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#fff',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 16,
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Media content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'lightbox-slide-in 0.25s ease-out',
        }}
      >
        {current.media.type === 'VIDEO' ? (
          <video
            key={currentIndex}
            src={current.media.url}
            controls
            autoPlay
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 12,
              objectFit: 'contain',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <img
            key={currentIndex}
            src={current.media.url}
            alt={`Beitrag von ${current.uploaderName}`}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 12,
              objectFit: 'contain',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          />
        )}
      </div>

      {/* Next button */}
      {canGoNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          aria-label="Nächstes Medium"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#fff',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 16,
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};
