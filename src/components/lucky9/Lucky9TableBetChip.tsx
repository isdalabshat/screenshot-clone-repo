import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';

interface Lucky9TableBetChipProps {
  amount: number;
  position: { x: number; y: number };
  isAnimatingWin?: boolean;
  isAnimatingLoss?: boolean;
  showAmount?: boolean;
}

const getChipColors = (amount: number) => {
  if (amount >= 5000) return { base: 'from-purple-600 to-purple-800', accent: 'border-purple-400', glow: 'rgba(147, 51, 234, 0.4)' };
  if (amount >= 1000) return { base: 'from-black to-gray-800', accent: 'border-gray-400', glow: 'rgba(75, 85, 99, 0.4)' };
  if (amount >= 500) return { base: 'from-green-500 to-green-700', accent: 'border-green-400', glow: 'rgba(34, 197, 94, 0.4)' };
  if (amount >= 100) return { base: 'from-blue-500 to-blue-700', accent: 'border-blue-400', glow: 'rgba(59, 130, 246, 0.4)' };
  return { base: 'from-red-500 to-red-700', accent: 'border-red-400', glow: 'rgba(239, 68, 68, 0.4)' };
};

export function Lucky9TableBetChip({ 
  amount, 
  position, 
  isAnimatingWin = false,
  isAnimatingLoss = false,
  showAmount = true 
}: Lucky9TableBetChipProps) {
  const colors = getChipColors(amount);
  const chipCount = Math.min(3, Math.max(1, Math.ceil(amount / 500)));

  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      style={{ left: position.x, top: position.y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: isAnimatingLoss ? 0 : 1, 
        scale: isAnimatingLoss ? 0.3 : 1,
        y: isAnimatingWin ? [0, -2, 0] : [0, -1, 0],
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ 
        y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        opacity: { duration: 0.4 },
        scale: { duration: 0.4, type: "spring", stiffness: 300 }
      }}
    >
      {/* Chip stack - smaller */}
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: chipCount }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-5 h-5 rounded-full bg-gradient-to-br ${colors.base} border ${colors.accent} flex items-center justify-center`}
            style={{ 
              top: -i * 2, 
              left: i * 0.3,
              boxShadow: `0 1px 3px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)`,
              zIndex: chipCount - i
            }}
            animate={isAnimatingWin ? { 
              boxShadow: [`0 1px 3px ${colors.glow}`, `0 2px 8px ${colors.glow}`, `0 1px 3px ${colors.glow}`]
            } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {i === chipCount - 1 && (
              <>
                <div className="absolute inset-0.5 rounded-full border border-white/20" />
                <Coins className="h-2 w-2 text-white/70" />
              </>
            )}
          </motion.div>
        ))}
        
        {/* Bet amount label - above the chip, smaller */}
        <motion.div 
          className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[7px] font-bold text-amber-400 whitespace-nowrap shadow-md border border-amber-500/30"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          ₱{amount >= 1000 ? `${(amount / 1000).toFixed(1)}K` : amount.toLocaleString()}
        </motion.div>
      </div>
    </motion.div>
  );
}
