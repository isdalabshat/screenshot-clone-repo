import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface Lucky9FloatingCardProps {
  isAnimating: boolean;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  onComplete?: () => void;
}

// Unified card back component - same as in Lucky9RevealableCard
function CardBack({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-12 h-[68px]',
    lg: 'w-14 h-[76px]'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-500 shadow-xl overflow-hidden`}>
      <div className="w-full h-full p-0.5 relative">
        <div className="absolute inset-0.5 border border-red-400/30 rounded-sm" />
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-red-400/50 text-sm font-bold">L9</div>
        </div>
      </div>
    </div>
  );
}

export function Lucky9FloatingCard({ 
  isAnimating, 
  fromPosition, 
  toPosition, 
  onComplete 
}: Lucky9FloatingCardProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isAnimating && (
        <motion.div
          className="fixed z-50 pointer-events-none"
          initial={{ 
            left: fromPosition.x,
            top: fromPosition.y,
            scale: 1,
            rotate: 0
          }}
          animate={{ 
            left: toPosition.x,
            top: toPosition.y,
            scale: 0.8,
            rotate: 15
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <CardBack />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DealSequenceCard {
  id: string;
  targetX: number;
  targetY: number;
  delay: number;
  rotation: number;
}

interface Lucky9DealSequenceProps {
  isDealing: boolean;
  deckPosition: { x: number; y: number };
  targets: { x: number; y: number }[];
  onComplete?: () => void;
}

export function Lucky9DealSequence({ 
  isDealing, 
  deckPosition, 
  targets, 
  onComplete 
}: Lucky9DealSequenceProps) {
  const [cards, setCards] = useState<DealSequenceCard[]>([]);
  const hasDealt = useRef(false);

  useEffect(() => {
    // Only trigger once per deal
    if (isDealing && targets.length > 0 && !hasDealt.current) {
      hasDealt.current = true;
      
      const newCards: DealSequenceCard[] = [];
      
      // Deal 2 cards per target with staggered delays
      targets.forEach((target, targetIdx) => {
        for (let round = 0; round < 2; round++) {
          newCards.push({
            id: `deal-${targetIdx}-${round}-${Date.now()}`,
            targetX: target.x + (round * 15),
            targetY: target.y,
            delay: (targetIdx * 2 + round) * 0.1,
            rotation: -10 + Math.random() * 20
          });
        }
      });
      
      setCards(newCards);

      // Clear cards after animation completes
      const totalDuration = (targets.length * 2) * 0.1 + 0.6;
      const timer = setTimeout(() => {
        setCards([]);
        hasDealt.current = false;
        onComplete?.();
      }, totalDuration * 1000);

      return () => clearTimeout(timer);
    } else if (!isDealing) {
      hasDealt.current = false;
      setCards([]);
    }
  }, [isDealing, targets.length, onComplete]);

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            className="absolute"
            style={{ left: deckPosition.x, top: deckPosition.y }}
            initial={{ 
              scale: 1,
              rotate: 0,
              opacity: 1,
              x: 0,
              y: 0
            }}
            animate={{ 
              x: card.targetX - deckPosition.x,
              y: card.targetY - deckPosition.y,
              scale: 0.7,
              rotate: card.rotation,
              opacity: 1
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              delay: card.delay,
              duration: 0.4, 
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            <CardBack size="md" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface Lucky9HiritCardProps {
  isAnimating: boolean;
  deckPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  targetPlayerId?: string;
  onComplete?: () => void;
}

export function Lucky9HiritCard({ 
  isAnimating, 
  deckPosition, 
  targetPosition, 
  targetPlayerId,
  onComplete 
}: Lucky9HiritCardProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isAnimating && (
        <motion.div
          className="fixed z-50 pointer-events-none"
          initial={{ 
            left: deckPosition.x,
            top: deckPosition.y,
            scale: 1.2,
            rotate: 0,
            opacity: 1
          }}
          animate={{ 
            left: targetPosition.x,
            top: targetPosition.y,
            scale: 0.8,
            rotate: 10,
            opacity: 1
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="w-14 h-[76px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/30 overflow-hidden">
            <div className="w-full h-full p-1 relative">
              <div className="absolute inset-0.5 border border-amber-500/50 rounded-sm" />
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-amber-400/60 text-xl font-bold">L9</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper function to get seat position by player ID
export function getPlayerSeatPosition(playerId: string, isBanker: boolean = false): { x: number; y: number } | null {
  if (isBanker) {
    const bankerSeat = document.querySelector('[data-banker-seat="true"]');
    if (bankerSeat) {
      const rect = bankerSeat.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - 25, y: rect.top + rect.height / 2 - 35 };
    }
  } else {
    const playerSeat = document.querySelector(`[data-player-seat="${playerId}"]`);
    if (playerSeat) {
      const rect = playerSeat.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - 25, y: rect.top + rect.height / 2 - 35 };
    }
  }
  return null;
}
