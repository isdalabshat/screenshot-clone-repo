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
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2"
    >
      {/* Your Cards Label */}
      <div className="bg-black/70 px-3 py-1 rounded-full text-xs text-emerald-400 font-semibold">
        Your Cards
      </div>

      {/* Cards */}
      <div className="flex gap-2 bg-black/50 backdrop-blur-sm rounded-xl p-3 border border-emerald-500/30 shadow-2xl">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ rotateY: 180, scale: 0.5 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.15 }}
          >
            <PlayingCard card={card} size="md" />
          </motion.div>
        ))}
      </div>

      {/* Hand Rank */}
      {handRank && handRank.name && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg"
        >
          {handRank.name}
        </motion.div>
      )}
    </motion.div>
  );
}
