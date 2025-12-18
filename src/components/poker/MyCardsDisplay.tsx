import { Card } from '@/types/poker';
import PlayingCard from './PlayingCard';
import { evaluateHand } from '@/lib/poker/handEvaluator';
import { motion } from 'framer-motion';

interface MyCardsDisplayProps {
  cards: Card[];
  communityCards: Card[];
  gameStatus?: string;
  isFolded?: boolean;
}

const getVisibleCommunityCards = (status: string | undefined, communityCards: Card[]): Card[] => {
  if (!communityCards) return [];
  switch (status) {
    case 'preflop': return [];
    case 'flop': return communityCards.slice(0, 3);
    case 'turn': return communityCards.slice(0, 4);
    case 'river':
    case 'showdown': return communityCards;
    default: return [];
  }
};

export default function MyCardsDisplay({ cards, communityCards, gameStatus, isFolded }: MyCardsDisplayProps) {
  if (cards.length === 0 || isFolded) return null;

  const visibleCommunity = getVisibleCommunityCards(gameStatus, communityCards);
  const handRank = cards.length > 0 ? evaluateHand(cards, visibleCommunity) : null;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1"
    >
      {/* Cards */}
      <div className="flex gap-1 bg-black/70 backdrop-blur-sm rounded-lg p-2 border border-emerald-500/30 shadow-2xl">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ rotateY: 180, scale: 0.5 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.15 }}
          >
            <PlayingCard card={card} size="sm" />
          </motion.div>
        ))}
      </div>

      {/* Hand Rank */}
      {handRank && handRank.name && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg"
        >
          {handRank.name}
        </motion.div>
      )}
    </motion.div>
  );
}
