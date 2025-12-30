import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

interface BetChip {
  id: string;
  amount: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface Lucky9BetAnimationProps {
  bets: BetChip[];
  onComplete?: () => void;
}

export function Lucky9BetAnimation({ bets, onComplete }: Lucky9BetAnimationProps) {
  const [animatingBets, setAnimatingBets] = useState<BetChip[]>([]);

  useEffect(() => {
    if (bets.length > 0) {
      setAnimatingBets(bets);
      
      const timer = setTimeout(() => {
        setAnimatingBets([]);
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [bets, onComplete]);

  const getChipColor = (amount: number) => {
    if (amount >= 1000) return 'from-purple-500 to-purple-700';
    if (amount >= 500) return 'from-black to-gray-800';
    if (amount >= 100) return 'from-green-500 to-green-700';
    if (amount >= 50) return 'from-blue-500 to-blue-700';
    return 'from-red-500 to-red-700';
  };

  return (
    <AnimatePresence>
      {animatingBets.map((bet, index) => (
        <motion.div
          key={bet.id}
          initial={{ 
            x: bet.startX, 
            y: bet.startY,
            scale: 0.5,
            opacity: 0,
            rotate: 0
          }}
          animate={{ 
            x: bet.endX, 
            y: bet.endY,
            scale: 1,
            opacity: 1,
            rotate: 360
          }}
          exit={{ 
            scale: 0.8,
            opacity: 0
          }}
          transition={{ 
            delay: index * 0.1,
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="fixed z-30 pointer-events-none"
        >
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getChipColor(bet.amount)} border-2 border-white/30 shadow-lg flex flex-col items-center justify-center`}>
            <Coins className="h-4 w-4 text-white/80" />
            <span className="text-[8px] font-bold text-white">₱{bet.amount}</span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// Standalone chip stack for visual display on table
export function Lucky9ChipStack({ amount, small = false }: { amount: number; small?: boolean }) {
  if (amount <= 0) return null;
  
  const chipCount = Math.min(5, Math.ceil(amount / 100));
  const sizeClass = small ? 'w-6 h-2' : 'w-8 h-3';
  
  const getChipColor = (index: number) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500', 
      'bg-green-500',
      'bg-purple-500',
      'bg-yellow-500'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="relative flex flex-col-reverse items-center">
      {Array.from({ length: chipCount }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className={`${sizeClass} ${getChipColor(i)} rounded-full border border-white/30 shadow-sm`}
          style={{ marginTop: i > 0 ? '-4px' : 0 }}
        />
      ))}
      <motion.span 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute -bottom-4 text-[9px] font-bold text-yellow-400 whitespace-nowrap"
      >
        ₱{amount}
      </motion.span>
    </div>
  );
}
