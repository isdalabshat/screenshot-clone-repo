import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface CardDealAnimationProps {
  isDealing: boolean;
  playerPositions: number[]; // Display positions of players receiving cards
  onComplete?: () => void;
}

// Target positions for each player seat (relative to center of table)
const seatPositions: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 140 },      // Bottom center - current user
  1: { x: -130, y: 100 },   // Bottom left
  2: { x: -160, y: 20 },    // Left
  3: { x: -130, y: -60 },   // Top left
  4: { x: -50, y: -90 },    // Top left center
  5: { x: 50, y: -90 },     // Top right center
  6: { x: 130, y: -60 },    // Top right
  7: { x: 160, y: 20 },     // Right
  8: { x: 130, y: 100 },    // Bottom right
};

export default function CardDealAnimation({ 
  isDealing, 
  playerPositions, 
  onComplete 
}: CardDealAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [cards, setCards] = useState<Array<{ id: string; position: number; cardNum: number }>>([]);
  const { playSound } = useSoundEffects();

  useEffect(() => {
    if (isDealing && playerPositions.length > 0) {
      // Create cards for each player (2 cards each, dealt one at a time round-robin style)
      const dealCards: Array<{ id: string; position: number; cardNum: number }> = [];
      
      // First card to each player, then second card to each player
      for (let cardNum = 0; cardNum < 2; cardNum++) {
        playerPositions.forEach((position, playerIdx) => {
          dealCards.push({
            id: `deal-${position}-${cardNum}`,
            position,
            cardNum
          });
        });
      }
      
      setCards(dealCards);
      setShowAnimation(true);
      playSound('deal');
      
      // Complete animation after all cards dealt
      const totalDuration = dealCards.length * 100 + 500;
      const timer = setTimeout(() => {
        setShowAnimation(false);
        setCards([]);
        onComplete?.();
      }, totalDuration);
      
      return () => clearTimeout(timer);
    }
  }, [isDealing, playerPositions, onComplete, playSound]);

  return (
    <AnimatePresence>
      {showAnimation && (
        <motion.div
          className="absolute z-40 pointer-events-none"
          style={{ left: '50%', top: '45%' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {cards.map((card, idx) => {
            const target = seatPositions[card.position] || { x: 0, y: 0 };
            // Add slight offset for second card
            const offsetX = card.cardNum * 8;
            const offsetY = card.cardNum * -2;
            
            return (
              <motion.div
                key={card.id}
                className="absolute"
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 0.6, 
                  opacity: 0,
                  rotate: 0
                }}
                animate={{ 
                  x: target.x + offsetX, 
                  y: target.y + offsetY, 
                  scale: 0.8, 
                  opacity: [0, 1, 1, 0.8],
                  rotate: card.cardNum * 10 - 5
                }}
                transition={{ 
                  duration: 0.35,
                  delay: idx * 0.1,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
              >
                {/* Card back design */}
                <div className="w-8 h-11 rounded-md bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center">
                  <div className="w-5 h-7 rounded-sm bg-blue-700 border border-blue-500 flex items-center justify-center">
                    <span className="text-blue-300 text-[8px] font-bold">♠♥</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
