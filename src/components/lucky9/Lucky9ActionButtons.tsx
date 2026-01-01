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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 px-2 py-1.5 z-30 safe-area-bottom"
    >
      <div className="flex gap-2 max-w-xs mx-auto">
        <Button
          onClick={onDraw}
          disabled={disabled || !canDraw}
          className="flex-1 h-10 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg disabled:opacity-50"
        >
          <Hand className="h-4 w-4 mr-1" />
          Hirit
        </Button>
        
        <Button
          onClick={onStand}
          disabled={disabled}
          className="flex-1 h-10 text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-lg"
        >
          <Square className="h-4 w-4 mr-1" />
          Good
        </Button>
      </div>
      
      {!canDraw && (
        <p className="text-center text-[10px] text-slate-400 mt-1">Maximum 3 cards</p>
      )}
    </motion.div>
  );
}
