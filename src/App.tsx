
import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Power, Globe, Volume2, VolumeX, Info, Send, MessageSquare, X } from 'lucide-react';
import { AudioStreamer } from './lib/audio-streamer';
import { LiveSession } from './lib/live-session';
import { RobotFace, NovaMood } from './components/RobotFace';
import { cn } from './lib/utils';

type AppStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [mood, setMood] = useState<NovaMood>('neutral');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [messages, setMessages] = useState<{text: string, role: 'user' | 'model'}[]>([]);
  const [textInput, setTextInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (showChat) {
      scrollToBottom();
    }
  }, [messages, showChat]);

  const handleToolCall = useCallback((name: string, args: any) => {
    if (name === 'openWebsite') {
      let url = args.url;
      if (!url.startsWith('http')) url = `https://${url}`;
      window.open(url, '_blank');
    }
  }, []);

  const startSession = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      setError("API Key is missing. Please configure it in settings.");
      setStatus('error');
      return;
    }

    try {
      setError(null);
      setStatus('connecting');
      
      audioStreamerRef.current = new AudioStreamer((base64Data) => {
        liveSessionRef.current?.sendAudio(base64Data);
      }, (level) => {
        setMicLevel(level);
      });

      liveSessionRef.current = new LiveSession(apiKey);
      
      await liveSessionRef.current.connect({
        onAudioData: (base64Data) => {
          setStatus('speaking');
          audioStreamerRef.current?.handleAudioChunk(base64Data);
          
          // Reset speaking status after a short delay if no more chunks arrive
          if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = setTimeout(() => {
            setStatus('listening');
          }, 1000);
        },
        onTextData: (text, role) => {
          if (text === 'start_session') return; // Hide trigger from UI
          setMessages(prev => {
            // Avoid adding the exact same text if it was just added by handleSendMessage
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.text === text && lastMsg.role === role) {
              return prev;
            }
            return [...prev, { text, role }];
          });
        },
        onInterrupted: () => {
          audioStreamerRef.current?.clearQueue();
          setStatus('listening');
        },
        onMoodChange: (newMood) => {
          setMood(newMood);
        },
        onStateChange: async (state, reason) => {
          if (state === 'connected') {
            setStatus('listening');
            // Trigger initial greeting
            liveSessionRef.current?.sendText("start_session");
            
            try {
              await audioStreamerRef.current?.startRecording();
            } catch (err: any) {
              console.error("Mic access failed:", err);
              if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError("Microphone access denied. You can still use the chat box below!");
              } else {
                setError("Failed to access microphone: " + (err.message || "Unknown error"));
              }
              setStatus('error');
              // Keep session alive for chat
            }
          } else if (state === 'disconnected') {
            setStatus('idle');
            audioStreamerRef.current?.stopRecording();
            
            if (reason === 'session_expired') {
              setError("Session duration limit reached (30 mins). Nova needs a quick break! Tap to reconnect.");
              setStatus('error');
            } else if (reason === 'connection_failed' || (reason && reason.includes('Network error'))) {
              setError("Network error: The model is temporarily unavailable. Please try again in a moment.");
              setStatus('error');
            } else if (reason) {
              setError(`Connection closed: ${reason}`);
              setStatus('error');
            }
          }
        },
        onToolCall: handleToolCall,
      });

    } catch (err: any) {
      console.error("Session failed:", err);
      if (err.message?.includes("permission")) {
        setError("API Key Permission Error. Please ensure your Gemini API Key has 'Gemini 2.0 Flash' or 'Gemini 3.1 Flash' enabled in Google AI Studio.");
      } else {
        setError("Failed to connect to Nova. Try again?");
      }
      setStatus('error');
    }
  };

  const handleSendMessage = (e?: FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim()) return;

    if (status === 'idle') {
      startSession();
      return;
    }

    if (!liveSessionRef.current) return;

    const text = textInput.trim();
    setMessages(prev => [...prev, { text, role: 'user' }]);
    liveSessionRef.current.sendText(text);
    setTextInput('');
  };

  const stopSession = () => {
    liveSessionRef.current?.disconnect();
    audioStreamerRef.current?.stopRecording();
    setStatus('idle');
  };

  const toggleSession = () => {
    if (status === 'idle' || status === 'error') {
      startSession();
    } else {
      stopSession();
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col items-center justify-center">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          status === 'idle' ? "opacity-40" : "opacity-100"
        )}>
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-400/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-400/20 rounded-full blur-[120px] animate-pulse delay-700" />
          <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-pink-400/15 rounded-full blur-[100px] animate-pulse delay-1000" />
        </div>
        
        {/* Holographic Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/20">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-pink-200">Nova Live</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Personal AI Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowChat(!showChat)}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <MessageSquare size={20} className={cn(showChat ? "text-orange-400" : "text-white")} />
          </button>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            {isMuted ? <VolumeX size={20} className="text-red-400" /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className="relative z-20 flex flex-col items-center gap-12">
        {/* Central Orb */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative"
            >
              {/* Status Rings */}
              {status !== 'idle' && (
                <>
                  <motion.div 
                    className={cn(
                      "absolute inset-[-40px] rounded-full border border-white/5",
                      status === 'speaking' && "border-orange-500/20"
                    )}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div 
                    className={cn(
                      "absolute inset-[-80px] rounded-full border border-dashed border-white/5",
                      status === 'listening' && "border-blue-500/20"
                    )}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  />
                </>
              )}

              <div className="flex flex-col items-center gap-8 relative z-10">
                {/* Robot Face Container */}
                <div className={cn(
                  "w-64 h-64 rounded-full flex items-center justify-center transition-all duration-700 relative overflow-hidden",
                  status === 'idle' ? "bg-white/5 border border-white/10" : 
                  status === 'connecting' ? "bg-white/10 border border-white/20" :
                  status === 'listening' ? "bg-blue-500/10 border border-blue-500/30 shadow-[0_0_60px_rgba(59,130,246,0.2)]" :
                  status === 'speaking' ? "bg-pink-500/20 border border-pink-400/40 shadow-[0_0_80px_rgba(244,114,182,0.3)]" :
                  "bg-red-500/10 border border-red-500/30"
                )}>
                  {/* Animated Robot Face */}
                  <div className="absolute inset-0 z-0">
                    <RobotFace status={status} micLevel={micLevel} mood={mood} />
                  </div>

                  {/* Animated Background for Active States */}
                  {status !== 'idle' && (
                    <motion.div 
                      className={cn(
                        "absolute inset-0 opacity-40",
                        status === 'listening' ? "bg-blue-300" : "bg-pink-300"
                      )}
                      animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.2, 0.5, 0.2],
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Controls & Status - Fully Separated Below */}
                <div className="flex flex-col items-center gap-4 min-h-[100px]">
                  {status === 'idle' ? (
                    <button
                      onClick={toggleSession}
                      className="group flex flex-col items-center gap-3"
                    >
                      <div className="p-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xl group-hover:bg-white/20 transition-all duration-500">
                        <Power size={32} className="text-white transform group-hover:rotate-12 transition-transform duration-500" />
                      </div>
                      <span className="text-[10px] font-bold tracking-[0.4em] text-white/60 group-hover:text-white transition-colors drop-shadow-lg">WAKE NOVA</span>
                    </button>
                  ) : status === 'connecting' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full animate-spin shadow-lg" />
                      <span className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Connecting...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={toggleSession}
                        className={cn(
                          "p-4 rounded-full backdrop-blur-xl border transition-all duration-500 shadow-lg",
                          status === 'listening' 
                            ? "bg-blue-500/20 border-blue-400/30 shadow-blue-500/20" 
                            : "bg-pink-500/20 border-pink-400/30 shadow-pink-500/20"
                        )}
                      >
                        <Mic size={24} className={cn(
                          "transition-colors",
                          status === 'listening' ? "text-blue-100" : "text-pink-100"
                        )} />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          "text-[10px] font-black tracking-[0.3em] drop-shadow-md",
                          status === 'listening' ? "text-blue-200" : "text-pink-200"
                        )}>
                          {status.toUpperCase()}
                        </span>
                        <button 
                          onClick={toggleSession}
                          className="text-[8px] font-bold tracking-widest text-white/30 hover:text-white/60 transition-colors mt-1 uppercase"
                        >
                          Tap to stop
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Waveform Visualization (Simplified) */}
              {status === 'speaking' && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 h-8">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-pink-300/60 rounded-full"
                      animate={{ height: [8, 24, 8] }}
                      transition={{ 
                        duration: 0.5, 
                        repeat: Infinity, 
                        delay: i * 0.05,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Status Message */}
        <div className="text-center space-y-2 max-w-xs">
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {status === 'idle' ? (
                <p className="text-white/40 text-sm font-light">
                  Tap to wake Nova up. She's waiting for you.
                </p>
              ) : status === 'connecting' ? (
                <p className="text-white/60 text-sm animate-pulse">
                  Establishing secure link...
                </p>
              ) : status === 'listening' ? (
                <p className="text-blue-200 text-sm font-medium tracking-wide drop-shadow-sm">
                  I'm listening, Aayush! ✨
                </p>
              ) : status === 'speaking' ? (
                <p className="text-pink-200 text-sm font-medium tracking-wide drop-shadow-sm">
                  Nova is talking... 💖
                </p>
              ) : status === 'error' ? (
                <div className="space-y-3">
                  <p className="text-red-400 text-sm font-medium">
                    {error || "Something went wrong."}
                  </p>
                  {error?.includes("Microphone") && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-[11px] text-red-300/80 leading-relaxed text-left">
                      <p className="font-bold mb-1 uppercase tracking-wider text-red-400">How to fix:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Click the <span className="text-white font-bold">Lock/Settings</span> icon in your browser address bar.</li>
                        <li>Ensure <span className="text-white font-bold">Microphone</span> is set to "Allow".</li>
                        <li>Refresh the page and try again.</li>
                      </ul>
                    </div>
                  )}
                  {error?.includes("API Key Permission") && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-[11px] text-red-300/80 leading-relaxed text-left">
                      <p className="font-bold mb-1 uppercase tracking-wider text-red-400">How to fix:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 underline">Google AI Studio</a>.</li>
                        <li>Check if your API Key is restricted to specific models.</li>
                        <li>Ensure the key has access to <span className="text-white font-bold">Gemini 2.0 Flash</span> or <span className="text-white font-bold">Gemini 3.1 Flash</span>.</li>
                      </ul>
                    </div>
                  )}
                  <button 
                    onClick={startSession}
                    className="px-6 py-2 bg-pink-400 text-white text-[10px] font-bold tracking-[0.2em] uppercase rounded-full hover:bg-pink-300 transition-colors shadow-lg shadow-pink-500/20"
                  >
                    Try Again
                  </button>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 px-8">
        <div className="flex items-center gap-6 text-white/20">
          <div className="flex items-center gap-2">
            <Globe size={14} />
            <span className="text-[10px] font-bold tracking-widest">LIVE API v3.1</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} />
            <span className="text-[10px] font-bold tracking-widest">VOICE-TO-VOICE</span>
          </div>
        </div>
        
        <p className="text-[9px] uppercase tracking-[0.3em] text-white/10 text-center max-w-md leading-relaxed">
          Nova is a sassy AI persona. Conversations are real-time and multimodal.
        </p>
      </footer>

      {/* Chat Box Overlay */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-4 bottom-24 md:inset-x-auto md:right-8 md:bottom-24 md:w-96 h-[500px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-bold tracking-widest uppercase opacity-60">Nova Chat</span>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {status === 'idle' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-blue-400/10 flex items-center justify-center mb-4">
                    <Power size={32} className="text-blue-400" />
                  </div>
                  <p className="text-sm font-medium mb-2">Nova is Offline</p>
                  <p className="text-xs text-white/40 mb-6">Connect to start chatting with Nova.</p>
                  <button 
                    onClick={startSession}
                    className="px-6 py-2 bg-blue-400 text-white text-xs font-bold tracking-widest uppercase rounded-full hover:bg-blue-300 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    Connect Nova
                  </button>
                </div>
              )}
              
              {status !== 'idle' && messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                  <MessageSquare size={48} className="mb-4" />
                  <p className="text-sm font-light">No messages yet. Say hi to Nova!</p>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                  <div className={cn(
                    "px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-blue-400/80 text-white font-medium rounded-tr-none backdrop-blur-sm" 
                      : "bg-pink-400/80 text-white rounded-tl-none border border-white/10 backdrop-blur-sm"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] uppercase tracking-widest opacity-30 mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'Nova'}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white/5 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={status === 'connecting' ? "Connecting..." : "Type a message..."}
                disabled={status === 'connecting'}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400/50 transition-colors disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={!textInput.trim() || status === 'idle'}
                className="p-2 bg-blue-400 text-white rounded-xl hover:bg-blue-300 disabled:opacity-50 disabled:hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
