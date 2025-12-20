import { Card } from '@/types/poker';
import { evaluateHand } from '@/lib/poker/handEvaluator';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HandStrengthIndicatorProps {
  myCards: Card[];
  communityCards: Card[];
  isShowdown: boolean;
  isFolded: boolean;
}

// Hand ranking from lowest to highest
const handRankings: Record<string, { rank: number; color: string; emoji: string }> = {
  'High Card': { rank: 1, color: 'from-slate-500 to-slate-600', emoji: '🃏' },
  'One Pair': { rank: 2, color: 'from-blue-500 to-blue-600', emoji: '✌️' },
  'Two Pair': { rank: 3, color: 'from-cyan-500 to-cyan-600', emoji: '🎴' },
  'Three of a Kind': { rank: 4, color: 'from-green-500 to-green-600', emoji: '🎲' },
  'Straight': { rank: 5, color: 'from-yellow-500 to-yellow-600', emoji: '📈' },
  'Flush': { rank: 6, color: 'from-orange-500 to-orange-600', emoji: '💎' },
  'Full House': { rank: 7, color: 'from-pink-500 to-pink-600', emoji: '🏠' },
  'Four of a Kind': { rank: 8, color: 'from-purple-500 to-purple-600', emoji: '🎰' },
  'Straight Flush': { rank: 9, color: 'from-red-500 to-red-600', emoji: '🔥' },
  'Royal Flush': { rank: 10, color: 'from-amber-400 to-yellow-500', emoji: '👑' },
};

export default function HandStrengthIndicator({
  myCards,
  communityCards,
  isShowdown,
  isFolded
}: HandStrengthIndicatorProps) {
  if (!isShowdown || isFolded || myCards.length === 0) {
    return null;
  }

  const handResult = evaluateHand(myCards, communityCards);
  
  if (!handResult || !handResult.name) {
    return null;
  }

  const handInfo = handRankings[handResult.name] || { rank: 0, color: 'from-slate-500 to-slate-600', emoji: '🃏' };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full"
      >
        <div className={cn(
          'bg-gradient-to-r p-3 rounded-xl border shadow-lg backdrop-blur-sm',
          `${handInfo.color}`,
          'border-white/20'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{handInfo.emoji}</span>
              <div>
                <div className="text-white font-bold text-sm">Your Hand</div>
                <div className="text-white/90 text-xs">{handResult.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Strength bar */}
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'w-1.5 h-4 rounded-full',
                      i < handInfo.rank 
                        ? 'bg-white' 
                        : 'bg-white/20'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}