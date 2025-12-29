import { motion } from 'framer-motion';
import { parseCard, getSuitColor } from '@/lib/lucky9/deck';

interface Lucky9CardProps {
  card: string;
  hidden?: boolean;
  delay?: number;
  small?: boolean;
}

export function Lucky9Card({ card, hidden = false, delay = 0, small = false }: Lucky9CardProps) {
  const { rank, suit } = parseCard(card);
  const suitColor = getSuitColor(suit);
  
  const sizeClasses = small 
    ? 'w-10 h-14 text-sm' 
    : 'w-14 h-20 sm:w-16 sm:h-24 text-lg sm:text-xl';

  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: 0, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ delay, duration: 0.3 }}
        className={`${sizeClasses} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center`}
      >
        <div className="w-8 h-10 rounded border border-blue-400/30 bg-blue-700/50 flex items-center justify-center">
          <span className="text-blue-300 text-2xl">🎴</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      className={`${sizeClasses} rounded-lg bg-white border-2 border-slate-200 shadow-lg flex flex-col items-center justify-center font-bold`}
    >
      <span className={suitColor}>{rank}</span>
      <span className={`${suitColor} ${small ? 'text-lg' : 'text-2xl'}`}>{suit}</span>
    </motion.div>
  );
}
