import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, PlusCircle, Film, ImageIcon } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  challengeTitle: string;
  onSubmitted: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  groupId,
  challengeTitle,
  onSubmitted,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev: File[]) => [...prev, ...newFiles]);
    // Reset input so the same file can be re-added after removal
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const media = await Promise.all(
        files.map(async (file: File) => ({
          type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE' as 'IMAGE' | 'VIDEO',
          url: await fileToBase64(file),
        }))
      );

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/groups/${groupId}/challenge/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ media, comment }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Upload fehlgeschlagen.');
      }

      setFiles([]);
      setComment('');
      onSubmitted();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-indigo-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Beweis einreichen</h2>
            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{challengeTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* File previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file: File, i: number) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                  {file.type.startsWith('video/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
                      <Film className="w-6 h-6" />
                      <span className="text-xs text-center px-1 truncate w-full text-center">{file.name}</span>
                    </div>
                  ) : (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add files button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 rounded-xl py-5 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-slate-500 hover:text-indigo-600"
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Fotos / Videos hinzufügen</span>
            <span className="text-xs text-slate-400 flex gap-2">
              <ImageIcon className="w-3.5 h-3.5" /> Bilder &nbsp;·&nbsp; <Film className="w-3.5 h-3.5" /> Videos
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Comment */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Kommentar (optional)"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading}
            className={`
              w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2
              ${files.length === 0 || uploading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
              }
            `}
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Hochladen ({files.length} {files.length === 1 ? 'Datei' : 'Dateien'})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
