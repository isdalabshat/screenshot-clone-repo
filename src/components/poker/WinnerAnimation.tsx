import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

interface WinnerAnimationProps {
  winnerName?: string;
  amount?: number;
  isVisible: boolean;
}

export default function WinnerAnimation({ winnerName, amount, isVisible }: WinnerAnimationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -50 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            className="bg-gradient-to-br from-yellow-500 via-amber-400 to-yellow-600 p-6 rounded-2xl shadow-2xl border-4 border-yellow-300"
            animate={{
              boxShadow: [
                '0 0 20px rgba(234, 179, 8, 0.5)',
                '0 0 60px rgba(234, 179, 8, 0.8)',
                '0 0 20px rgba(234, 179, 8, 0.5)',
              ],
            }}
            transition={{ duration: 1, repeat: 2 }}
          >
            {/* Floating chips animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  initial={{
                    x: Math.random() * 200 - 100,
                    y: 100,
                    opacity: 0,
                    rotate: 0,
                  }}
                  animate={{
                    y: -150,
                    opacity: [0, 1, 1, 0],
                    rotate: 360,
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.1,
                    ease: 'easeOut',
                  }}
                  style={{ left: `${20 + (i * 5)}%` }}
                >
                  💰
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-5xl mb-3"
              >
                🏆
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-slate-900 mb-2"
              >
                {winnerName || 'Winner'} Wins!
              </motion.h2>
              
              {amount !== undefined && amount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="flex items-center justify-center gap-2 bg-slate-900/90 px-4 py-2 rounded-full"
                >
                  <Coins className="h-5 w-5 text-yellow-400" />
                  <span className="text-xl font-bold text-yellow-400">
                    +{amount.toLocaleString()}
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
