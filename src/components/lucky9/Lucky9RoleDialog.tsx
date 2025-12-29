import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface Lucky9RoleDialogProps {
  open: boolean;
  hasBanker: boolean;
  onSelectRole: (role: 'banker' | 'player') => void;
  onCancel: () => void;
}

export function Lucky9RoleDialog({ open, hasBanker, onSelectRole, onCancel }: Lucky9RoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl text-purple-400 flex items-center gap-2">
            <span>🎴</span> Choose Your Role
          </DialogTitle>
          <DialogDescription>
            Select whether you want to be the Banker or a Player
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              disabled={hasBanker}
              onClick={() => onSelectRole('banker')}
              className={`w-full h-40 flex flex-col gap-3 border-2 ${
                hasBanker 
                  ? 'border-slate-600 opacity-50 cursor-not-allowed' 
                  : 'border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10'
              }`}
            >
              <Crown className={`h-12 w-12 ${hasBanker ? 'text-slate-500' : 'text-amber-400'}`} />
              <span className={`text-lg font-bold ${hasBanker ? 'text-slate-500' : 'text-amber-400'}`}>
                Banker
              </span>
              <span className="text-xs text-muted-foreground text-center">
                {hasBanker ? 'Position Taken' : 'Play against all players'}
              </span>
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              onClick={() => onSelectRole('player')}
              className="w-full h-40 flex flex-col gap-3 border-2 border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10"
            >
              <User className="h-12 w-12 text-purple-400" />
              <span className="text-lg font-bold text-purple-400">Player</span>
              <span className="text-xs text-muted-foreground text-center">
                Bet against the banker
              </span>
            </Button>
          </motion.div>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          <p>🏆 Banker wins when players lose their bets</p>
          <p>🎯 Players win by getting a higher Lucky 9 value</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
