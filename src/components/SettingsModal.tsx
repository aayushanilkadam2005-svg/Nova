
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Key, ExternalLink, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  initialKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialKey }) => {
  const [key, setKey] = useState(initialKey);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKey(initialKey);
  }, [initialKey]);

  const validateKey = (value: string) => {
    // Basic validation for Gemini API key format (usually starts with AIza)
    if (!value) return null;
    return value.startsWith('AIza') && value.length > 30;
  };

  const handleSave = () => {
    const valid = validateKey(key);
    if (valid || key === '') {
      onSave(key);
      onClose();
    } else {
      setIsValid(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Settings size={20} />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">Nova Settings</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Key size={12} />
                    Gemini API Key
                  </label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    Get Key <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      setIsValid(validateKey(e.target.value));
                    }}
                    placeholder="Enter your AIza... key"
                    className={cn(
                      "w-full bg-white/5 border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all pr-12",
                      isValid === true ? "border-green-500/50 focus:border-green-500" :
                      isValid === false ? "border-red-500/50 focus:border-red-500" :
                      "border-white/10 focus:border-blue-500/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>

                {isValid === false && (
                  <p className="text-[10px] text-red-400 flex items-center gap-1.5 px-1">
                    <AlertCircle size={12} />
                    Invalid key format. Should start with 'AIza' and be at least 30 chars.
                  </p>
                )}
                {isValid === true && (
                  <p className="text-[10px] text-green-400 flex items-center gap-1.5 px-1">
                    <CheckCircle2 size={12} />
                    Key format looks valid.
                  </p>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Instructions</h3>
                <ol className="text-[11px] text-white/60 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>Visit <span className="text-white font-medium">Google AI Studio</span>.</li>
                  <li>Click on <span className="text-white font-medium">"Get API key"</span>.</li>
                  <li>Create a new key or copy an existing one.</li>
                  <li>Paste it here and save to enable Nova's live features.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white/5 border-t border-white/5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-2xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 rounded-2xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
