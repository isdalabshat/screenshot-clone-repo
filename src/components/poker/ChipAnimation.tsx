import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ChipAnimationProps {
  fromPosition: number;
  amount: number;
  id: string;
  onComplete?: () => void;
}

// Starting positions for chips based on player seat
const startPositions: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 80 },      // Bottom center
  1: { x: -120, y: 60 },   // Bottom left
  2: { x: -150, y: 0 },    // Left
  3: { x: -120, y: -80 },  // Top left
  4: { x: -50, y: -100 },  // Top left center
  5: { x: 50, y: -100 },   // Top right center
  6: { x: 120, y: -80 },   // Top right
  7: { x: 150, y: 0 },     // Right
  8: { x: 120, y: 60 },    // Bottom right
};

export default function ChipAnimation({ fromPosition, amount, id, onComplete }: ChipAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const start = startPositions[fromPosition] || { x: 0, y: 0 };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Calculate number of chips to show (max 5)
  const chipCount = Math.min(Math.ceil(amount / 100), 5);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="absolute z-50 pointer-events-none"
          style={{ left: '50%', top: '50%' }}
        >
          {Array.from({ length: chipCount }).map((_, i) => (
            <motion.div
              key={`${id}-chip-${i}`}
              initial={{ 
                x: start.x + (Math.random() - 0.5) * 20, 
                y: start.y + (Math.random() - 0.5) * 20,
                scale: 1,
                opacity: 1,
                rotate: Math.random() * 360
              }}
              animate={{ 
                x: 0, 
                y: 0,
                scale: 0.8,
                opacity: 0,
                rotate: 720
              }}
              transition={{ 
                duration: 0.5,
                delay: i * 0.05,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
                <span className="text-[10px]">🪙</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Chip animation manager hook
export function useChipAnimations() {
  const [animations, setAnimations] = useState<Array<{ id: string; position: number; amount: number }>>([]);

  const addAnimation = (position: number, amount: number) => {
    const id = `chip-${Date.now()}-${Math.random()}`;
    setAnimations(prev => [...prev, { id, position, amount }]);
  };

  const removeAnimation = (id: string) => {
    setAnimations(prev => prev.filter(a => a.id !== id));
  };

  return { animations, addAnimation, removeAnimation };
}
