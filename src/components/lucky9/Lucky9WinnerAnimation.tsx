import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Trophy, Coins, Sparkles } from 'lucide-react';

interface Lucky9WinnerAnimationProps {
  winners: { username: string; winnings: number }[];
  show: boolean;
  onComplete?: () => void;
}

export function Lucky9WinnerAnimation({ winners, show, onComplete }: Lucky9WinnerAnimationProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number }[]>([]);

  useEffect(() => {
    if (show && winners.length > 0) {
      // Generate confetti particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, winners, onComplete]);

  return (
    <AnimatePresence>
      {show && winners.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          {/* Confetti particles - smaller area */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -10, x: `${p.x}%`, opacity: 1, rotate: 0 }}
              animate={{ 
                y: '100%', 
                opacity: 0,
                rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
              }}
              transition={{ 
                duration: 2, 
                delay: p.delay,
                ease: 'linear' 
              }}
              className="absolute top-0"
            >
              <div 
                className="w-2 h-2 rounded-sm"
                style={{ 
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][p.id % 6] 
                }}
              />
            </motion.div>
          ))}

          {/* Winner card - smaller and centered in table */}
          <motion.div
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 20 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative"
          >
            {/* Glow effect - smaller */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 blur-xl rounded-full" />
            
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-3 border border-yellow-500/50 shadow-lg max-w-[180px]">
              {/* Trophy icon - smaller */}
              <motion.div 
                className="flex justify-center mb-2"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotateY: [0, 360]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              >
                <div className="relative">
                  <Trophy className="h-8 w-8 text-yellow-400" />
                  <Sparkles className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
                </div>
              </motion.div>

              {/* Winner text - smaller */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <h2 className="text-sm font-bold text-yellow-400 mb-2">
                  {winners.length === 1 ? 'Winner!' : 'Winners!'}
                </h2>
                
                <div className="space-y-1.5">
                  {winners.slice(0, 3).map((winner, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.15 }}
                      className="flex items-center justify-center gap-1.5 bg-yellow-500/10 rounded px-2 py-1"
                    >
                      <span className="text-xs font-semibold text-white truncate max-w-[60px]">{winner.username}</span>
                      <div className="flex items-center gap-0.5 text-yellow-400">
                        <Coins className="h-3 w-3" />
                        <span className="font-bold text-[10px]">+₱{winner.winnings.toLocaleString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
