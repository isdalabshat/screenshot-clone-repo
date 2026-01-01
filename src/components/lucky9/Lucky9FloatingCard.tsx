import { motion, AnimatePresence } from 'framer-motion';

interface Lucky9FloatingCardProps {
  isAnimating: boolean;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  onComplete?: () => void;
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
          <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-600 shadow-2xl overflow-hidden">
            <div className="w-full h-full p-1">
              <div className="w-full h-full border border-red-500/30 rounded-sm bg-red-800 flex items-center justify-center">
                <div className="text-red-400/40 text-xl font-serif">L9</div>
              </div>
            </div>
          </div>
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
  const cards: DealSequenceCard[] = [];
  
  if (isDealing) {
    // Deal 2 cards per target
    targets.forEach((target, targetIdx) => {
      for (let round = 0; round < 2; round++) {
        cards.push({
          id: `deal-${targetIdx}-${round}`,
          targetX: target.x,
          targetY: target.y,
          delay: (targetIdx * 2 + round) * 0.12
        });
      }
    });
  }

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {cards.map((card) => (
        <motion.div
          key={card.id}
          className="fixed z-50 pointer-events-none"
          initial={{ 
            left: deckPosition.x,
            top: deckPosition.y,
            scale: 1,
            rotate: 0,
            opacity: 1
          }}
          animate={{ 
            left: card.targetX,
            top: card.targetY,
            scale: 0.7,
            rotate: -5 + Math.random() * 10,
            opacity: 1
          }}
          exit={{ opacity: 0 }}
          transition={{ 
            delay: card.delay,
            duration: 0.35, 
            ease: "easeOut" 
          }}
        >
          <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-600 shadow-2xl overflow-hidden">
            <div className="w-full h-full p-1">
              <div className="w-full h-full border border-red-500/30 rounded-sm bg-red-800 flex items-center justify-center">
                <div className="text-red-400/40 text-xl font-serif">L9</div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

interface Lucky9HiritCardProps {
  isAnimating: boolean;
  deckPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  onComplete?: () => void;
}

export function Lucky9HiritCard({ 
  isAnimating, 
  deckPosition, 
  targetPosition, 
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
            <div className="w-full h-full p-1">
              <div className="w-full h-full border border-amber-500/50 rounded-sm bg-red-800 flex items-center justify-center">
                <div className="text-amber-400/60 text-xl font-serif">L9</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
