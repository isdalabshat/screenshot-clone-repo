import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface DealingCard {
  id: string;
  targetX: number;
  targetY: number;
  delay: number;
}

interface Lucky9CardDealAnimationProps {
  isDealing: boolean;
  playerPositions: { x: number; y: number }[];
  bankerPosition: { x: number; y: number };
  onComplete?: () => void;
}

export function Lucky9CardDealAnimation({ 
  isDealing, 
  playerPositions, 
  bankerPosition,
  onComplete 
}: Lucky9CardDealAnimationProps) {
  const [cards, setCards] = useState<DealingCard[]>([]);

  useEffect(() => {
    if (isDealing) {
      const allPositions = [...playerPositions, bankerPosition];
      const dealingCards: DealingCard[] = [];
      
      // Deal 2 cards to each position
      let cardIndex = 0;
      for (let round = 0; round < 2; round++) {
        allPositions.forEach((pos, posIndex) => {
          dealingCards.push({
            id: `card-${cardIndex}`,
            targetX: pos.x,
            targetY: pos.y,
            delay: cardIndex * 0.15
          });
          cardIndex++;
        });
      }
      
      setCards(dealingCards);

      // Complete after all cards dealt
      const totalDuration = dealingCards.length * 0.15 + 0.5;
      const timer = setTimeout(() => {
        setCards([]);
        onComplete?.();
      }, totalDuration * 1000);

      return () => clearTimeout(timer);
    }
  }, [isDealing, playerPositions, bankerPosition, onComplete]);

  return (
    <AnimatePresence>
      {cards.map((card) => (
        <motion.div
          key={card.id}
          initial={{ 
            x: '50vw', 
            y: '-10vh', 
            rotate: 0,
            scale: 0.5,
            opacity: 0
          }}
          animate={{ 
            x: `${card.targetX}vw`, 
            y: `${card.targetY}vh`,
            rotate: -5 + Math.random() * 10,
            scale: 1,
            opacity: 1
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ 
            delay: card.delay,
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="fixed z-40 pointer-events-none"
        >
          <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center">
            <span className="text-blue-300 text-xl">🎴</span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
