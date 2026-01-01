import { motion, AnimatePresence } from 'framer-motion';

interface Lucky9CardDeckProps {
  isDealing?: boolean;
  dealingTo?: { x: number; y: number } | null;
  onDealComplete?: () => void;
}

export function Lucky9CardDeck({ isDealing }: Lucky9CardDeckProps) {
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
          {/* Unified card back design - same as all other cards */}
          <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-red-700 via-red-800 to-red-900 border-2 border-red-500 shadow-lg overflow-hidden">
            <div className="w-full h-full p-0.5 relative">
              <div className="absolute inset-0.5 border border-red-400/30 rounded-sm" />
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-red-400/50 text-lg font-bold">L9</div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

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
