import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, Camera } from 'lucide-react';
import { Milestone } from '../types';
import { verifyMilestoneProof } from '../services/geminiService';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: Milestone | null;
  onVerified: (proofImage: string, feedback: string) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  milestone, 
  onVerified 
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !milestone) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerify = async () => {
    if (!image) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await verifyMilestoneProof(milestone.title, milestone.description, image);
      
      if (result.verified) {
        onVerified(image, result.feedback);
        setImage(null); // Reset for next time
      } else {
        setError(result.feedback);
      }
    } catch (e) {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-indigo-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Beweisaufnahme</h2>
            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{milestone.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium text-slate-700">Foto hochladen</p>
                <p className="text-xs text-slate-400 mt-1">Zeig uns, dass du es geschafft hast!</p>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200">
                <img src={image} alt="Proof" className="w-full h-full object-cover" />
                <button 
                  onClick={() => {
                    setImage(null);
                    setError(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-sm text-rose-600">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading}
                className={`
                  w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                  ${loading 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                  }
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    KI prüft Beweis...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Jetzt validieren
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};