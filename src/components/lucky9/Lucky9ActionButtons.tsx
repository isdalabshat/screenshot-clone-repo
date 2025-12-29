import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

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
      className="flex gap-4 justify-center"
    >
      <Button
        onClick={onDraw}
        disabled={disabled || !canDraw}
        className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
      >
        🎴 Draw Card
      </Button>
      <Button
        onClick={onStand}
        disabled={disabled}
        className="bg-orange-600 hover:bg-orange-700 px-8 py-6 text-lg"
      >
        ✋ Stand
      </Button>
    </motion.div>
  );
}
