import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Hand, Square } from 'lucide-react';

interface Lucky9ActionButtonsProps {
  onDraw: () => void;
  onStand: () => void;
  canDraw: boolean;
  disabled: boolean;
}

export function Lucky9ActionButtons({ onDraw, onStand, canDraw, disabled }: Lucky9ActionButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/98 to-transparent backdrop-blur-xl p-4 z-30"
    >
      <div className="flex gap-3 max-w-md mx-auto">
        <Button
          onClick={onDraw}
          disabled={disabled || !canDraw}
          className="flex-1 h-16 text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          <Hand className="h-6 w-6 mr-2" />
          Hirit
        </Button>
        
        <Button
          onClick={onStand}
          disabled={disabled}
          className="flex-1 h-16 text-lg font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/30"
        >
          <Square className="h-6 w-6 mr-2" />
          Good
        </Button>
      </div>
      
      {!canDraw && (
        <p className="text-center text-xs text-slate-400 mt-2">Maximum 3 cards reached</p>
      )}
    </motion.div>
  );
}
