import { motion, AnimatePresence } from 'framer-motion';

export interface SidePot {
  amount: number;
  eligibleCount: number;
  label: string;
}

interface SidePotDisplayProps {
  sidePots: SidePot[];
}

export default function SidePotDisplay({ sidePots }: SidePotDisplayProps) {
  if (sidePots.length <= 1) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-wrap gap-2 justify-center mt-2"
      >
        {sidePots.map((pot, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-black/60 px-3 py-1 rounded-full border border-yellow-500/30 backdrop-blur-sm"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-yellow-500/70 uppercase font-medium">{pot.label}</span>
              <span className="text-yellow-400 font-bold text-sm">
                ₱{pot.amount.toLocaleString()}
              </span>
              <span className="text-[9px] text-muted-foreground">
                ({pot.eligibleCount} players)
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
