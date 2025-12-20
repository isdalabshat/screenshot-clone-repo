import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';
import PlayingCard from './PlayingCard';
import { Card, CardSuit, CardRank } from '@/types/poker';

interface WinnerAnimationProps {
  winnerName?: string;
  amount?: number;
  isVisible: boolean;
  handName?: string;
  winningCards?: string[];
  isShowdown?: boolean;
}

// Parse card string (e.g., "Ah" -> { suit: 'hearts', rank: 'A' })
function parseCardString(cardStr: string): Card | null {
  if (!cardStr || cardStr.length < 2) return null;
  
  const suitMap: Record<string, CardSuit> = {
    'h': 'hearts',
    'd': 'diamonds',
    'c': 'clubs',
    's': 'spades'
  };
  
  const suit = suitMap[cardStr.slice(-1).toLowerCase()];
  const rank = cardStr.slice(0, -1) as CardRank;
  
  if (!suit) return null;
  return { suit, rank };
}

export default function WinnerAnimation({ 
  winnerName, 
  amount, 
  isVisible,
  handName,
  winningCards,
  isShowdown = false
}: WinnerAnimationProps) {
  // Parse winning card strings to Card objects
  const parsedCards = winningCards?.map(parseCardString).filter((c): c is Card => c !== null) || [];
  
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
              
              {/* Show hand name only during showdown (not fold wins) */}
              {isShowdown && handName && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-slate-900/80 px-4 py-2 rounded-full mb-3"
                >
                  <span className="text-lg font-bold text-amber-300">
                    {handName}
                  </span>
                </motion.div>
              )}
              
              {/* Show winning cards only during showdown */}
              {isShowdown && parsedCards.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex justify-center gap-1 mb-3"
                >
                  {parsedCards.map((card, idx) => (
                    <motion.div
                      key={`${card.rank}${card.suit}`}
                      initial={{ opacity: 0, rotateY: 180 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: 0.6 + idx * 0.1, duration: 0.3 }}
                    >
                      <PlayingCard card={card} size="sm" />
                    </motion.div>
                  ))}
                </motion.div>
              )}
              
              {amount !== undefined && amount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: isShowdown ? 0.8 : 0.5, type: 'spring' }}
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