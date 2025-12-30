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
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        onComplete?.();
      }, 4000);

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          {/* Confetti particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
              animate={{ 
                y: '110vh', 
                opacity: 0,
                rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
              }}
              transition={{ 
                duration: 3, 
                delay: p.delay,
                ease: 'linear' 
              }}
              className="absolute top-0"
            >
              <div 
                className="w-3 h-3 rounded-sm"
                style={{ 
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][p.id % 6] 
                }}
              />
            </motion.div>
          ))}

          {/* Winner cards */}
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/30 via-amber-500/30 to-yellow-500/30 blur-3xl rounded-full" />
            
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 border-2 border-yellow-500/50 shadow-2xl">
              {/* Trophy icon */}
              <motion.div 
                className="flex justify-center mb-4"
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotateY: [0, 360]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              >
                <div className="relative">
                  <Trophy className="h-16 w-16 text-yellow-400" />
                  <Sparkles className="h-6 w-6 text-yellow-300 absolute -top-2 -right-2 animate-pulse" />
                </div>
              </motion.div>

              {/* Winner text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <h2 className="text-2xl font-bold text-yellow-400 mb-4">
                  {winners.length === 1 ? 'Winner!' : 'Winners!'}
                </h2>
                
                <div className="space-y-3">
                  {winners.map((winner, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.2 }}
                      className="flex items-center justify-center gap-3 bg-yellow-500/10 rounded-lg px-4 py-2"
                    >
                      <span className="text-lg font-semibold text-white">{winner.username}</span>
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Coins className="h-4 w-4" />
                        <span className="font-bold">+₱{winner.winnings.toLocaleString()}</span>
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
