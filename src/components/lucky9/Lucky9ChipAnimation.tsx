import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';

interface ChipAnimationData {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  isWin: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Lucky9ChipAnimationProps {
  animations: ChipAnimationData[];
  onComplete?: () => void;
}

const getChipColor = (amount: number) => {
  if (amount >= 1000) return 'from-purple-500 to-purple-700';
  if (amount >= 500) return 'from-black to-gray-800';
  if (amount >= 100) return 'from-green-500 to-green-700';
  if (amount >= 50) return 'from-blue-500 to-blue-700';
  return 'from-red-500 to-red-700';
};

export function Lucky9ChipAnimation({ animations, onComplete }: Lucky9ChipAnimationProps) {
  const [activeAnimations, setActiveAnimations] = useState<ChipAnimationData[]>([]);

  useEffect(() => {
    if (animations.length > 0) {
      setActiveAnimations(animations);
      
      const timer = setTimeout(() => {
        setActiveAnimations([]);
        onComplete?.();
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [animations, onComplete]);

  return (
    <AnimatePresence>
      {activeAnimations.map((anim, index) => {
        const chipCount = Math.min(5, Math.ceil(anim.amount / 100));
        
        return (
          <div key={anim.id} className="fixed inset-0 pointer-events-none z-50">
            {Array.from({ length: chipCount }).map((_, chipIndex) => (
              <motion.div
                key={`${anim.id}-${chipIndex}`}
                initial={{ 
                  x: anim.startX - 12,
                  y: anim.startY - 12,
                  scale: 0.5,
                  opacity: 0,
                  rotate: 0
                }}
                animate={{ 
                  x: anim.endX - 12,
                  y: anim.endY - 12,
                  scale: 1,
                  opacity: 1,
                  rotate: 360
                }}
                exit={{ 
                  scale: 0.5,
                  opacity: 0
                }}
                transition={{ 
                  delay: (index * 0.15) + (chipIndex * 0.05),
                  duration: 0.6,
                  ease: [0.4, 0, 0.2, 1]
                }}
                className="absolute pointer-events-none"
              >
                <div 
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${getChipColor(anim.amount)} border border-white/30 shadow-lg flex items-center justify-center`}
                  style={{ 
                    boxShadow: anim.isWin 
                      ? '0 0 10px rgba(34, 197, 94, 0.5)' 
                      : '0 0 10px rgba(239, 68, 68, 0.5)' 
                  }}
                >
                  <Coins className="h-3 w-3 text-white/80" />
                </div>
              </motion.div>
            ))}
            
            {/* Amount label */}
            <motion.div
              initial={{ 
                x: anim.startX,
                y: anim.startY - 20,
                opacity: 0,
                scale: 0.5
              }}
              animate={{ 
                x: (anim.startX + anim.endX) / 2,
                y: (anim.startY + anim.endY) / 2 - 30,
                opacity: 1,
                scale: 1
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                delay: index * 0.15,
                duration: 0.4
              }}
              className={`absolute text-xs font-bold px-1.5 py-0.5 rounded ${
                anim.isWin ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {anim.isWin ? '+' : '-'}₱{anim.amount}
            </motion.div>
          </div>
        );
      })}
    </AnimatePresence>
  );
}

// Hook to manage chip animations
export function useLucky9ChipAnimations() {
  const [animations, setAnimations] = useState<ChipAnimationData[]>([]);

  const triggerAnimations = (newAnimations: ChipAnimationData[]) => {
    setAnimations(newAnimations);
  };

  const clearAnimations = () => {
    setAnimations([]);
  };

  return { animations, triggerAnimations, clearAnimations };
}

// Helper to get position from player seat
export function getChipAnimationPosition(playerId: string, isBanker: boolean): { x: number; y: number } | null {
  if (isBanker) {
    const bankerSeat = document.querySelector('[data-banker-seat="true"]');
    if (bankerSeat) {
      const rect = bankerSeat.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  } else {
    const playerSeat = document.querySelector(`[data-player-seat="${playerId}"]`);
    if (playerSeat) {
      const rect = playerSeat.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return null;
}
