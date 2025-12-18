import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  timeLeft: number;
  maxTime?: number;
  size?: number;
}

export default function CountdownTimer({ timeLeft, maxTime = 30, size = 56 }: CountdownTimerProps) {
  const [displayTime, setDisplayTime] = useState(timeLeft);
  const progress = Math.max(0, Math.min(1, displayTime / maxTime));
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  useEffect(() => {
    setDisplayTime(timeLeft);
  }, [timeLeft]);

  const getColor = () => {
    if (displayTime <= 5) return '#ef4444'; // red
    if (displayTime <= 10) return '#f59e0b'; // amber
    return '#22c55e'; // green
  };

  const getGlowColor = () => {
    if (displayTime <= 5) return 'rgba(239, 68, 68, 0.6)';
    if (displayTime <= 10) return 'rgba(245, 158, 11, 0.5)';
    return 'rgba(34, 197, 94, 0.4)';
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg
        width={size}
        height={size}
        className="absolute -rotate-90"
        style={{
          filter: `drop-shadow(0 0 8px ${getGlowColor()})`
        }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ 
            strokeDashoffset,
            stroke: getColor()
          }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </svg>
      {/* Time text */}
      <motion.div
        className={cn(
          "absolute text-[10px] font-bold font-mono",
          displayTime <= 5 ? "text-red-400" : displayTime <= 10 ? "text-amber-400" : "text-green-400"
        )}
        animate={{ 
          scale: displayTime <= 5 ? [1, 1.2, 1] : 1,
        }}
        transition={{ 
          repeat: displayTime <= 5 ? Infinity : 0, 
          duration: 0.5 
        }}
        style={{
          top: '-8px',
          right: '-8px'
        }}
      >
        {displayTime}s
      </motion.div>
    </div>
  );
}
