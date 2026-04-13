
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export type NovaMood = 'neutral' | 'happy' | 'angry' | 'emotional' | 'friend';

interface RobotFaceProps {
  status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
  micLevel?: number;
  mood?: NovaMood;
}

export const RobotFace: React.FC<RobotFaceProps> = ({ status, micLevel = 0, mood = 'neutral' }) => {
  const isSpeaking = status === 'speaking';
  const isListening = status === 'listening';
  const isIdle = status === 'idle';

  // Mood-based colors
  const moodColors = {
    neutral: { bg: "bg-white/5", border: "border-white/10", glow: "bg-white", eye: "bg-white/40" },
    happy: { bg: "bg-green-500/10", border: "border-green-400/30", glow: "bg-green-400", eye: "bg-green-200" },
    angry: { bg: "bg-red-500/10", border: "border-red-400/30", glow: "bg-red-400", eye: "bg-red-200" },
    emotional: { bg: "bg-blue-500/10", border: "border-blue-400/30", glow: "bg-blue-400", eye: "bg-blue-200" },
    friend: { bg: "bg-pink-500/10", border: "border-pink-400/30", glow: "bg-pink-400", eye: "bg-pink-200" }
  };

  const currentColors = moodColors[mood] || moodColors.neutral;

  // Eye animation
  const eyeVariants = {
    idle: { scaleY: 1, rotate: 0 },
    blink: { scaleY: [1, 0.1, 1], transition: { duration: 0.2, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 3 } },
    listening: { scaleY: 1.2, transition: { duration: 0.3 } },
    speaking: { scaleY: [1, 1.2, 1], transition: { duration: 0.5, repeat: Infinity } },
    angry: { rotate: [0, 15, 0], scaleY: 0.8 },
    happy: { scaleY: 0.7, borderRadius: "50% 50% 0 0" },
    emotional: { scaleY: 1.1, y: [0, 2, 0] }
  };

  // Mouth animation
  const mouthVariants = {
    idle: { scaleX: 0.8, scaleY: 0.2, borderRadius: "20%", rotate: 0 },
    listening: { scaleX: 1, scaleY: 0.3, borderRadius: "50%" },
    speaking: { 
      scaleY: [0.3, 1.2, 0.5, 1, 0.3], 
      scaleX: [1, 0.8, 1.1, 0.9, 1],
      transition: { duration: 0.4, repeat: Infinity } 
    },
    happy: { scaleX: 1.2, scaleY: 0.6, borderRadius: "0 0 50% 50%" },
    angry: { scaleX: 0.8, scaleY: 0.4, borderRadius: "50% 50% 0 0", y: 2 },
    emotional: { scaleX: 0.6, scaleY: 0.3, borderRadius: "50%" }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center p-8">
      {/* Robot Head Shape */}
      <motion.div 
        className={cn(
          "relative w-48 h-48 rounded-[60px] border-4 transition-colors duration-500 flex flex-col items-center justify-center overflow-hidden shadow-2xl backdrop-blur-sm",
          isIdle ? currentColors.bg + " " + currentColors.border : 
          isListening ? "bg-blue-500/10 border-blue-400/30" :
          isSpeaking ? "bg-pink-500/10 border-pink-400/30" :
          "bg-white/10 border-white/20"
        )}
        animate={{
          y: isIdle ? 0 : [0, -5, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Face Glow */}
        <div className={cn(
          "absolute inset-0 opacity-20 blur-2xl transition-colors duration-700",
          isListening ? "bg-blue-400" : isSpeaking ? "bg-pink-400" : currentColors.glow
        )} />

        {/* Eyes Container */}
        <div className="flex gap-12 mb-8 relative z-10">
          {/* Left Eye */}
          <motion.div 
            className={cn(
              "w-8 h-10 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]",
              isListening ? "bg-blue-200" : isSpeaking ? "bg-pink-200" : currentColors.eye
            )}
            variants={eyeVariants}
            animate={mood !== 'neutral' ? mood : (isIdle ? "blink" : status)}
          />
          {/* Right Eye */}
          <motion.div 
            className={cn(
              "w-8 h-10 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]",
              isListening ? "bg-blue-200" : isSpeaking ? "bg-pink-200" : currentColors.eye
            )}
            variants={eyeVariants}
            animate={mood !== 'neutral' ? mood : (isIdle ? "blink" : status)}
          />
        </div>

        {/* Mouth */}
        <motion.div 
          className={cn(
            "w-16 h-4 rounded-full relative z-10",
            isListening ? "bg-blue-300/60" : isSpeaking ? "bg-pink-300/80" : "bg-white/20"
          )}
          variants={mouthVariants}
          animate={mood !== 'neutral' && !isSpeaking ? mood : status}
        />

        {/* Blush Dots */}
        <div className="absolute w-full flex justify-between px-6 top-1/2">
          <div className={cn(
            "w-4 h-2 rounded-full blur-sm",
            mood === 'happy' || mood === 'friend' ? "bg-pink-400/40" : "bg-pink-400/10"
          )} />
          <div className={cn(
            "w-4 h-2 rounded-full blur-sm",
            mood === 'happy' || mood === 'friend' ? "bg-pink-400/40" : "bg-pink-400/10"
          )} />
        </div>
      </motion.div>

      {/* Antenna */}
      <motion.div 
        className="absolute top-4 w-1 h-8 bg-white/20 rounded-full origin-bottom"
        animate={{ rotate: isIdle ? 0 : [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <motion.div 
          className={cn(
            "absolute -top-2 -left-1.5 w-4 h-4 rounded-full",
            isListening ? "bg-blue-400 shadow-[0_0_10px_#60a5fa]" : 
            isSpeaking ? "bg-pink-400 shadow-[0_0_10px_#f472b6]" : 
            "bg-white/20"
          )}
          animate={isSpeaking ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
};
