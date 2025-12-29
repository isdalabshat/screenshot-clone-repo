import { Button } from '@/components/ui/button';
import { Lucky9Player } from '@/types/lucky9';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Lucky9BankerBetControlsProps {
  player: Lucky9Player;
  onAccept: (playerId: string) => void;
  onReject: (playerId: string) => void;
  disabled: boolean;
}

export function Lucky9BankerBetControls({ player, onAccept, onReject, disabled }: Lucky9BankerBetControlsProps) {
  // Don't show controls if no bet or already decided
  if (player.currentBet <= 0 || player.betAccepted !== null) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex gap-1 mt-1"
    >
      <Button
        size="sm"
        onClick={() => onAccept(player.id)}
        disabled={disabled}
        className="h-7 px-2 bg-green-600 hover:bg-green-500 text-white text-xs"
      >
        <Check className="h-3 w-3 mr-1" />
        Accept
      </Button>
      <Button
        size="sm"
        onClick={() => onReject(player.id)}
        disabled={disabled}
        className="h-7 px-2 bg-red-600 hover:bg-red-500 text-white text-xs"
      >
        <X className="h-3 w-3 mr-1" />
        Reject
      </Button>
    </motion.div>
  );
}
