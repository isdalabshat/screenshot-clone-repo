import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, AlertTriangle } from 'lucide-react';

interface AutoStartCountdownProps {
  countdown: number | null;
  isWaitingForPlayers: boolean;
  playerCount: number;
}

export default function AutoStartCountdown({ 
  countdown, 
  isWaitingForPlayers, 
  playerCount 
}: AutoStartCountdownProps) {
  return (
    <AnimatePresence mode="wait">
      {isWaitingForPlayers ? (
        <motion.div
          key="waiting"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full border border-amber-500/40"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Waiting for players ({playerCount}/2 minimum)
          </span>
        </motion.div>
      ) : countdown !== null && countdown > 0 ? (
        <motion.div
          key="countdown"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-3 bg-primary/20 px-5 py-2.5 rounded-full border border-primary/40"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs">{playerCount} players</span>
          </div>
          <div className="h-4 w-px bg-primary/30" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <motion.span 
              key={countdown}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-primary font-bold text-lg tabular-nums"
            >
              {countdown}
            </motion.span>
          </div>
          <span className="text-sm text-muted-foreground">Next hand starting...</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
