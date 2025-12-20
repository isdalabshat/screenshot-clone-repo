import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface PotCollectionAnimationProps {
  isCollecting: boolean;
  playerPositions: number[];
  onComplete?: () => void;
}

// Starting positions for chips based on player seat (same as bet positions)
const startPositions: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 100 },      // Bottom center
  1: { x: -120, y: 60 },    // Bottom left
  2: { x: -150, y: 0 },     // Left
  3: { x: -120, y: -80 },   // Top left
  4: { x: -50, y: -100 },   // Top left center
  5: { x: 50, y: -100 },    // Top right center
  6: { x: 120, y: -80 },    // Top right
  7: { x: 150, y: 0 },      // Right
  8: { x: 120, y: 60 },     // Bottom right
};

export default function PotCollectionAnimation({ 
  isCollecting, 
  playerPositions, 
  onComplete 
}: PotCollectionAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const { playSound } = useSoundEffects();

  useEffect(() => {
    if (isCollecting && playerPositions.length > 0) {
      setShowAnimation(true);
      // Play pot collection sound
      playSound('potCollect');
      const timer = setTimeout(() => {
        setShowAnimation(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isCollecting, playerPositions, onComplete, playSound]);

  return (
    <AnimatePresence>
      {showAnimation && (
        <motion.div
          className="absolute z-50 pointer-events-none"
          style={{ left: '50%', top: '50%' }}
        >
          {playerPositions.map((position, idx) => {
            const start = startPositions[position] || { x: 0, y: 0 };
            return (
              <motion.div
                key={`collect-${position}-${idx}`}
                initial={{ 
                  x: start.x, 
                  y: start.y,
                  scale: 1,
                  opacity: 1
                }}
                animate={{ 
                  x: 0, 
                  y: 0,
                  scale: 0.5,
                  opacity: 0
                }}
                transition={{ 
                  duration: 0.6,
                  delay: idx * 0.08,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className="absolute"
              >
                {/* Multiple chips stacked */}
                {[0, 1, 2].map((chipIdx) => (
                  <motion.div
                    key={chipIdx}
                    initial={{ rotate: chipIdx * 30 }}
                    animate={{ rotate: 720 + chipIdx * 30 }}
                    transition={{ duration: 0.6 }}
                    className="absolute"
                    style={{ 
                      transform: `translateX(${chipIdx * 3}px) translateY(${chipIdx * -2}px)` 
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
                      <span className="text-[10px]">🪙</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
