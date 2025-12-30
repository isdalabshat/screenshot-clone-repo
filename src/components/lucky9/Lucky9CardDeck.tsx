import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface Lucky9CardDeckProps {
  isDealing?: boolean;
  dealingTo?: { x: number; y: number } | null;
  onDealComplete?: () => void;
}

export function Lucky9CardDeck({ isDealing, dealingTo, onDealComplete }: Lucky9CardDeckProps) {
  const [flyingCard, setFlyingCard] = useState<{ id: number; targetX: number; targetY: number } | null>(null);
  
  useEffect(() => {
    if (isDealing && dealingTo) {
      const id = Date.now();
      setFlyingCard({ id, targetX: dealingTo.x, targetY: dealingTo.y });
      
      // Clear flying card after animation
      const timer = setTimeout(() => {
        setFlyingCard(null);
        onDealComplete?.();
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [isDealing, dealingTo, onDealComplete]);

  // Stack of cards visual (5 cards stacked)
  const cardStack = Array.from({ length: 5 }, (_, i) => i);

  return (
    <div className="relative w-14 h-20">
      {/* Card stack */}
      {cardStack.map((index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            top: index * -1.5,
            left: index * 0.5,
            zIndex: 5 - index
          }}
          animate={isDealing && index === 0 ? { y: -5, rotateZ: -5 } : {}}
          transition={{ duration: 0.1 }}
        >
          <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-600 shadow-lg overflow-hidden">
            {/* Card back pattern */}
            <div className="w-full h-full p-1">
              <div className="w-full h-full border border-red-500/30 rounded-sm bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-700 via-red-800 to-red-900 flex items-center justify-center">
                <div className="text-red-400/40 text-2xl font-serif">L9</div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Flying card animation */}
      <AnimatePresence>
        {flyingCard && (
          <motion.div
            key={flyingCard.id}
            className="absolute z-50"
            initial={{ x: 0, y: 0, rotateY: 0, rotateZ: 0, scale: 1 }}
            animate={{
              x: flyingCard.targetX,
              y: flyingCard.targetY,
              rotateY: 180,
              rotateZ: 10,
              scale: 0.7
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-600 shadow-xl overflow-hidden">
              <div className="w-full h-full p-1">
                <div className="w-full h-full border border-red-500/30 rounded-sm bg-red-800 flex items-center justify-center">
                  <div className="text-red-400/40 text-2xl font-serif">L9</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow effect when dealing */}
      <AnimatePresence>
        {isDealing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-amber-400/20 rounded-lg blur-xl -z-10"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
