import { Card } from '@/types/poker';
import PlayingCard from './PlayingCard';
import { evaluateHand } from '@/lib/poker/handEvaluator';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

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
  // Use stable card key to prevent animation restart when props re-render
  const [stableCards, setStableCards] = useState<Card[]>([]);
  const [animationKey, setAnimationKey] = useState(0);
  const prevCardsRef = useRef<string>('');
  const isInitialMount = useRef(true);
  
  // Only update cards when they actually change (compare by value, not reference)
  useEffect(() => {
    const cardsKey = cards.map(c => `${c.rank}${c.suit}`).join(',');
    
    if (cardsKey !== prevCardsRef.current && cards.length > 0) {
      prevCardsRef.current = cardsKey;
      setStableCards(cards);
      
      // Only trigger new animation if not initial mount
      if (!isInitialMount.current) {
        setAnimationKey(prev => prev + 1);
      }
      isInitialMount.current = false;
    } else if (cards.length === 0 && stableCards.length > 0) {
      // Reset when cards are cleared
      prevCardsRef.current = '';
      setStableCards([]);
      isInitialMount.current = true;
    }
  }, [cards, stableCards.length]);

  if (stableCards.length === 0 || isFolded) return null;

  const visibleCommunity = getVisibleCommunityCards(gameStatus, communityCards);
  const handRank = stableCards.length > 0 ? evaluateHand(stableCards, visibleCommunity) : null;

  return (
    <motion.div
      key={`cards-container-${animationKey}`}
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1"
    >
      {/* Cards */}
      <div className="flex gap-1 bg-black/70 backdrop-blur-sm rounded-lg p-2 border border-emerald-500/30 shadow-2xl">
        {stableCards.map((card, i) => (
          <motion.div
            key={`${card.rank}${card.suit}-${animationKey}`}
            initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.35, 
              delay: i * 0.12,
              ease: 'easeOut'
            }}
          >
            <PlayingCard card={card} size="sm" />
          </motion.div>
        ))}
      </div>

      {/* Hand Rank */}
      <AnimatePresence mode="wait">
        {handRank && handRank.name && (
          <motion.div
            key={handRank.name}
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -5 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg"
          >
            {handRank.name}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
