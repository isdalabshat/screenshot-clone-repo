import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';

interface Lucky9TableBetChipProps {
  amount: number;
  position: { x: number; y: number };
}

const getChipColors = (amount: number) => {
  if (amount >= 5000) return { base: 'from-purple-600 to-purple-800', accent: 'border-purple-400' };
  if (amount >= 1000) return { base: 'from-black to-gray-800', accent: 'border-gray-400' };
  if (amount >= 500) return { base: 'from-green-500 to-green-700', accent: 'border-green-400' };
  if (amount >= 100) return { base: 'from-blue-500 to-blue-700', accent: 'border-blue-400' };
  return { base: 'from-red-500 to-red-700', accent: 'border-red-400' };
};

export function Lucky9TableBetChip({ amount, position }: Lucky9TableBetChipProps) {
  const colors = getChipColors(amount);
  // Limit chip stack to 2 max for smaller visual
  const chipCount = Math.min(2, Math.max(1, Math.ceil(amount / 1000)));

  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      style={{ left: position.x, top: position.y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ 
        opacity: { duration: 0.3 },
        scale: { duration: 0.3, type: "spring", stiffness: 300 }
      }}
    >
      {/* Chip stack - even smaller */}
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: chipCount }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-4 h-4 rounded-full bg-gradient-to-br ${colors.base} border ${colors.accent} flex items-center justify-center`}
            style={{ 
              top: -i * 2, 
              left: i * 0.2,
              boxShadow: `0 1px 2px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)`,
              zIndex: chipCount - i
            }}
          >
            {i === chipCount - 1 && (
              <>
                <div className="absolute inset-0.5 rounded-full border border-white/20" />
                <Coins className="h-1.5 w-1.5 text-white/70" />
              </>
            )}
          </motion.div>
        ))}
        
        {/* Bet amount label - smaller and more compact */}
        <motion.div 
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm px-1 py-0 rounded text-[6px] font-bold text-amber-400 whitespace-nowrap shadow-sm border border-amber-500/30"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          ₱{amount >= 1000 ? `${(amount / 1000).toFixed(0)}K` : amount}
        </motion.div>
      </div>
    </motion.div>
  );
}
