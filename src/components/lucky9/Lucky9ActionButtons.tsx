import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Hand, Square, Timer } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useLucky9Sounds } from '@/hooks/useLucky9Sounds';

interface Lucky9ActionButtonsProps {
  onDraw: () => void;
  onStand: () => void;
  canDraw: boolean;
  disabled: boolean;
  onTimeout?: () => void;
}

export function Lucky9ActionButtons({ onDraw, onStand, canDraw, disabled, onTimeout }: Lucky9ActionButtonsProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOut = useRef(false);
  const lastSecond = useRef<number | null>(null);
  const { playSound } = useLucky9Sounds();

  useEffect(() => {
    // Reset timer when component mounts (new turn)
    setTimeLeft(30);
    hasTimedOut.current = false;
    lastSecond.current = null;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Play clock tick sound every second
        if (lastSecond.current !== newTime && newTime > 0) {
          playSound('clockTick');
        }
        lastSecond.current = newTime;
        
        if (newTime <= 0) {
          // Time's up - auto-stand
          if (!hasTimedOut.current && !disabled) {
            hasTimedOut.current = true;
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            // Call timeout handler or stand
            if (onTimeout) {
              onTimeout();
            } else {
              onStand();
            }
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [disabled, onStand, onTimeout, playSound]);

  // Calculate progress percentage
  const progressPercent = (timeLeft / 30) * 100;
  const isUrgent = timeLeft <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 z-30 safe-area-bottom"
    >
      {/* Timer bar */}
      <div className="h-1 bg-slate-800 w-full">
        <motion.div 
          className={`h-full transition-colors ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${progressPercent}%` }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="px-2 py-1.5">
        {/* Timer display */}
        <div className="flex items-center justify-center gap-1 mb-1">
          <Timer className={`h-3 w-3 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
          <span className={`text-xs font-bold ${isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
            {timeLeft}s
          </span>
        </div>

        <div className="flex gap-2 max-w-xs mx-auto">
          <Button
            onClick={onDraw}
            disabled={disabled || !canDraw}
            className="flex-1 h-10 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg disabled:opacity-50"
          >
            <Hand className="h-4 w-4 mr-1" />
            Hirit
          </Button>
          
          <Button
            onClick={onStand}
            disabled={disabled}
            className="flex-1 h-10 text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-lg"
          >
            <Square className="h-4 w-4 mr-1" />
            Good
          </Button>
        </div>
        
        {!canDraw && (
          <p className="text-center text-[10px] text-slate-400 mt-1">Maximum 3 cards</p>
        )}
      </div>
    </motion.div>
  );
}
