import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useLucky9Sounds } from '@/hooks/useLucky9Sounds';

interface Lucky9BettingTimerProps {
  bettingEndsAt: string;
  onTimeUp?: () => void;
}

export function Lucky9BettingTimer({ bettingEndsAt, onTimeUp }: Lucky9BettingTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const { playSound } = useLucky9Sounds();
  const lastSecond = useRef<number | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const endTime = new Date(bettingEndsAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      
      // Play clock tick sound when seconds change
      if (lastSecond.current !== remaining && remaining > 0 && remaining <= 15) {
        playSound('clockTick');
      }
      lastSecond.current = remaining;
      
      setSecondsLeft(remaining);

      if (remaining === 0 && onTimeUp) {
        onTimeUp();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bettingEndsAt, onTimeUp, playSound]);

  const isUrgent = secondsLeft <= 10;
  const progress = Math.min(100, (secondsLeft / 30) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
        isUrgent 
          ? 'bg-red-500/20 border-red-500/50' 
          : 'bg-amber-500/20 border-amber-500/50'
      }`}
    >
      <Clock className={`h-5 w-5 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">Place your bets!</div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${isUrgent ? 'bg-red-500' : 'bg-amber-500'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <motion.span
        key={secondsLeft}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className={`text-2xl font-bold tabular-nums ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}
      >
        {secondsLeft}s
      </motion.span>
    </motion.div>
  );
}
