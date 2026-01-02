import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';

export interface PayoutAnimationData {
  id: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  amount: number;
  isWin: boolean; // true = banker paying player, false = player paying banker
  feeDeducted?: number;
}

interface Lucky9PayoutAnimationProps {
  payouts: PayoutAnimationData[];
  onComplete?: () => void;
}

const getChipColor = (amount: number) => {
  if (amount >= 1000) return 'from-amber-400 via-yellow-400 to-amber-500';
  if (amount >= 500) return 'from-green-400 to-green-600';
  if (amount >= 100) return 'from-blue-400 to-blue-600';
  return 'from-red-400 to-red-600';
};

export function Lucky9PayoutAnimation({ payouts, onComplete }: Lucky9PayoutAnimationProps) {
  const [activePayouts, setActivePayouts] = useState<PayoutAnimationData[]>([]);
  const [showingNet, setShowingNet] = useState<boolean>(false);
  const [bankerNetAmount, setBankerNetAmount] = useState<number>(0);
  const [bankerPosition, setBankerPosition] = useState<{ x: number; y: number } | null>(null);
  const processedPayoutIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (payouts.length > 0) {
      // Check if we already processed this exact payout set (prevent loops)
      const payoutKey = payouts.map(p => p.id).join(',');
      if (processedPayoutIds.current.has(payoutKey)) {
        return;
      }
      processedPayoutIds.current.add(payoutKey);
      
      setActivePayouts(payouts);
      setShowingNet(false);
      
      // Calculate banker's net amount (sum of all payouts going to banker minus payouts going out)
      let bankerNet = 0;
      let bankerPos: { x: number; y: number } | null = null;
      
      payouts.forEach(p => {
        if (p.isWin) {
          // Player wins - banker pays out
          bankerNet -= p.amount;
          bankerPos = p.fromPosition; // Banker is the source
        } else {
          // Player loses - banker receives
          bankerNet += p.amount;
          bankerPos = p.toPosition; // Banker is the destination
        }
      });
      
      setBankerNetAmount(bankerNet);
      setBankerPosition(bankerPos);
      
      // Show combined net amount after chips arrive
      const netTimer = setTimeout(() => {
        setShowingNet(true);
      }, 800);

      const clearTimer = setTimeout(() => {
        setActivePayouts([]);
        setShowingNet(false);
        setBankerNetAmount(0);
        setBankerPosition(null);
        onComplete?.();
      }, 2500);

      return () => {
        clearTimeout(netTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [payouts, onComplete]);
  
  // Clear processed IDs when payouts are cleared
  useEffect(() => {
    if (payouts.length === 0) {
      processedPayoutIds.current.clear();
    }
  }, [payouts]);

  return (
    <AnimatePresence>
      {activePayouts.map((payout, index) => {
        const chipCount = Math.min(4, Math.max(2, Math.ceil(payout.amount / 200)));
        // Only show individual net for player wins (chips going TO player)
        const showPlayerNet = payout.isWin;
        const playerNetAmount = payout.amount - (payout.feeDeducted || 0);
        
        return (
          <div key={payout.id} className="fixed inset-0 pointer-events-none z-50">
            {/* Flying chips - smaller */}
            {Array.from({ length: chipCount }).map((_, chipIndex) => {
              const progress = chipIndex / chipCount;
              const arcHeight = -30 - (progress * 15);
              
              return (
                <motion.div
                  key={`${payout.id}-chip-${chipIndex}`}
                  className="absolute"
                  initial={{ 
                    x: payout.fromPosition.x - 10,
                    y: payout.fromPosition.y - 10,
                    scale: 0.4,
                    opacity: 0,
                    rotate: 0
                  }}
                  animate={{ 
                    x: [
                      payout.fromPosition.x - 10,
                      (payout.fromPosition.x + payout.toPosition.x) / 2 - 10 + (chipIndex * 2),
                      payout.toPosition.x - 10
                    ],
                    y: [
                      payout.fromPosition.y - 10,
                      (payout.fromPosition.y + payout.toPosition.y) / 2 + arcHeight,
                      payout.toPosition.y - 10
                    ],
                    scale: [0.4, 1, 0.9],
                    opacity: [0, 1, 1],
                    rotate: [0, 180 + chipIndex * 45, 360]
                  }}
                  transition={{ 
                    delay: (index * 0.08) + (chipIndex * 0.03),
                    duration: 0.6,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    times: [0, 0.5, 1]
                  }}
                >
                  <motion.div 
                    className={`w-5 h-5 rounded-full bg-gradient-to-br ${getChipColor(payout.amount)} border border-white/40 shadow-lg flex items-center justify-center`}
                    style={{ 
                      boxShadow: payout.isWin 
                        ? '0 0 10px rgba(34, 197, 94, 0.5), 0 2px 4px rgba(0,0,0,0.3)' 
                        : '0 0 10px rgba(239, 68, 68, 0.5), 0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    <div className="absolute inset-0.5 rounded-full border border-white/20" />
                    <Coins className="h-2 w-2 text-white/90" />
                  </motion.div>
                </motion.div>
              );
            })}
            
            {/* Player net amount - only for player wins */}
            <AnimatePresence>
              {showingNet && showPlayerNet && (
                <motion.div
                  initial={{ 
                    x: payout.toPosition.x,
                    y: payout.toPosition.y - 30,
                    opacity: 0,
                    scale: 0.5
                  }}
                  animate={{ 
                    y: payout.toPosition.y - 45,
                    opacity: 1,
                    scale: 1
                  }}
                  exit={{ 
                    y: payout.toPosition.y - 55,
                    opacity: 0
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute -translate-x-1/2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: 2, duration: 0.3 }}
                    className="px-1.5 py-0.5 rounded-md font-bold text-xs whitespace-nowrap shadow-lg bg-gradient-to-r from-green-600 to-emerald-500 text-white"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    +₱{playerNetAmount.toLocaleString()}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      
      {/* Combined Banker Net Amount - single floating window */}
      <AnimatePresence>
        {showingNet && bankerPosition && bankerNetAmount !== 0 && (
          <motion.div
            initial={{ 
              x: bankerPosition.x,
              y: bankerPosition.y - 30,
              opacity: 0,
              scale: 0.5
            }}
            animate={{ 
              y: bankerPosition.y - 50,
              opacity: 1,
              scale: 1
            }}
            exit={{ 
              y: bankerPosition.y - 65,
              opacity: 0
            }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="fixed -translate-x-1/2 z-50 pointer-events-none"
            style={{ left: 0, top: 0 }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: 2, duration: 0.3 }}
              className={`px-2 py-1 rounded-lg font-black text-sm whitespace-nowrap shadow-xl ${
                bankerNetAmount > 0 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white' 
                  : 'bg-gradient-to-r from-red-600 to-rose-500 text-white'
              }`}
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
            >
              {bankerNetAmount > 0 ? '+' : ''}₱{Math.abs(bankerNetAmount).toLocaleString()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

// Hook to manage payout animations
export function useLucky9PayoutAnimations() {
  const [payouts, setPayouts] = useState<PayoutAnimationData[]>([]);

  const triggerPayouts = (newPayouts: PayoutAnimationData[]) => {
    setPayouts(newPayouts);
  };

  const clearPayouts = () => {
    setPayouts([]);
  };

  return { payouts, triggerPayouts, clearPayouts };
}
