import { Lucky9Card } from './Lucky9Card';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface Lucky9DealerProps {
  cards: string[];
  hiddenCard: string | null;
  showAll: boolean;
}

export function Lucky9Dealer({ cards, hiddenCard, showAll }: Lucky9DealerProps) {
  const allCards = showAll && hiddenCard ? [...cards.slice(0, 1), hiddenCard, ...cards.slice(1)] : cards;
  const handValue = allCards.length > 0 ? calculateLucky9Value(allCards) : null;
  const isNatural = allCards.length === 2 && isNatural9(allCards);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-900/80 border-2 border-slate-600"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">🎰 DEALER</span>
        {isNatural && showAll && (
          <Badge className="bg-amber-500">Natural 9!</Badge>
        )}
      </div>

      <div className="flex gap-2">
        {/* First visible card */}
        {cards.length > 0 && (
          <Lucky9Card card={cards[0]} delay={0} />
        )}
        
        {/* Hidden/revealed card */}
        {hiddenCard && !showAll && (
          <Lucky9Card card="" hidden delay={0.1} />
        )}
        {hiddenCard && showAll && (
          <Lucky9Card card={hiddenCard} delay={0.1} />
        )}
        
        {/* Third card if drawn */}
        {cards.length > 1 && (
          <Lucky9Card card={cards[1]} delay={0.2} />
        )}
      </div>

      {/* Show value when revealed */}
      {showAll && handValue !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <span className={`text-xl font-bold ${handValue === 9 ? 'text-amber-400' : 'text-white'}`}>
            Value: {handValue}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
