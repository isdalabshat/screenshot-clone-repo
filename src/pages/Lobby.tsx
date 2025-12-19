import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Coins, LogOut, Shield, ArrowUpCircle, ArrowDownCircle, Upload, Image } from 'lucide-react';
import { PokerTable } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export default function Lobby() {
  const navigate = useNavigate();
  const { user, profile, signOut, isLoading } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<PokerTable[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [cashAmount, setCashAmount] = useState(1000);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingCashOut, setIsSubmittingCashOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    fetchTables();

    const channel = supabase
      .channel('lobby-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_tables' }, fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players' }, fetchPlayerCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTables = async () => {
    const { data } = await supabase
      .from('poker_tables')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (data) {
      setTables(data.map(t => ({
        id: t.id,
        name: t.name,
        smallBlind: t.small_blind,
        bigBlind: t.big_blind,
        maxPlayers: t.max_players,
        handsPlayed: t.hands_played,
        maxHands: t.max_hands,
        isActive: t.is_active
      })));
      fetchPlayerCounts();
    }
  };

  const fetchPlayerCounts = async () => {
    const { data } = await supabase
      .from('table_players')
      .select('table_id')
      .eq('is_active', true);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(p => {
        counts[p.table_id] = (counts[p.table_id] || 0) + 1;
      });
      setPlayerCounts(counts);
    }
  };

  const handleJoinTable = (tableId: string) => {
    navigate(`/table/${tableId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProofImage = async (): Promise<string | null> => {
    if (!proofImage || !user) return null;
    
    const fileExt = proofImage.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('cash-proofs')
      .upload(fileName, proofImage);
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('cash-proofs')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleCashRequest = async (type: 'cash_in' | 'cash_out') => {
    if (!user || cashAmount <= 0) return;
    
    // Prevent double submissions
    if (type === 'cash_in' && isUploading) return;
    if (type === 'cash_out' && isSubmittingCashOut) return;
    
    if (type === 'cash_in') {
      setIsUploading(true);
    } else {
      setIsSubmittingCashOut(true);
    }
    
    let proofUrl: string | null = null;
    if (type === 'cash_in' && proofImage) {
      proofUrl = await uploadProofImage();
      if (!proofUrl) {
        toast({ title: 'Error', description: 'Failed to upload proof image', variant: 'destructive' });
        setIsUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('cash_requests')
      .insert({
        user_id: user.id,
        request_type: type,
        amount: cashAmount,
        proof_image_url: proofUrl
      });

    setIsUploading(false);
    setIsSubmittingCashOut(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Request Submitted', 
        description: `Your ${type === 'cash_in' ? 'cash in' : 'cash out'} request for ${cashAmount} chips has been submitted for admin approval.` 
      });
      setShowCashIn(false);
      setShowCashOut(false);
      setCashAmount(1000);
      setProofImage(null);
      setProofPreview(null);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-background to-slate-950">
      {/* Header */}
      <header className="border-b border-primary/30 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🃏</span>
            <div>
              <h1 className="text-2xl font-bold text-primary">JD Club</h1>
              <p className="text-xs text-muted-foreground">Texas Hold'em</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
              <Coins className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">{profile.chips.toLocaleString()}</span>
            </div>
            
            {/* Cash In/Out Buttons */}
            <Dialog open={showCashIn} onOpenChange={setShowCashIn}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                  <ArrowDownCircle className="h-4 w-4 mr-1" />
                  Cash In
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cash In Request</DialogTitle>
                  <DialogDescription>Request chips to be added to your account. Admin approval required.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* GCash Payment Info */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-400 mb-1">Send payment via GCash:</p>
                    <p className="text-lg font-bold text-blue-300">09152274107</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload your payment screenshot below</p>
                  </div>
                  
                  <div>
                    <Label>Amount (in chips)</Label>
                    <Input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(parseInt(e.target.value) || 0)}
                      min={100}
                    />
                  </div>
                  
                  {/* Proof Image Upload */}
                  <div>
                    <Label>Payment Proof (Screenshot)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-2 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {proofImage ? 'Change Image' : 'Upload Screenshot'}
                    </Button>
                    {proofPreview && (
                      <div className="mt-3 relative">
                        <img src={proofPreview} alt="Proof" className="max-h-40 mx-auto rounded border border-border" />
                        <p className="text-xs text-muted-foreground mt-2 text-center">Payment proof uploaded</p>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => handleCashRequest('cash_in')} 
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    disabled={isUploading || !proofImage}
                  >
                    {isUploading ? 'Uploading...' : 'Submit Request'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showCashOut} onOpenChange={setShowCashOut}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                  <ArrowUpCircle className="h-4 w-4 mr-1" />
                  Cash Out
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cash Out Request</DialogTitle>
                  <DialogDescription>Request to withdraw chips from your account. Admin approval required.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Amount (Max: {profile.chips})</Label>
                    <Input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(Math.min(parseInt(e.target.value) || 0, profile.chips))}
                      min={100}
                      max={profile.chips}
                    />
                  </div>
                  <Button 
                    onClick={() => handleCashRequest('cash_out')} 
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                    disabled={cashAmount > profile.chips || isSubmittingCashOut}
                  >
                    {isSubmittingCashOut ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{profile.username}</span>
            </div>
            {profile.isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin')}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                <Shield className="h-4 w-4 mr-1" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">Game Lobby</h2>
          <p className="text-muted-foreground">Choose a table to join and start playing!</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card 
                className="border-primary/30 bg-card/80 backdrop-blur hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl text-primary">{table.name}</CardTitle>
                      <CardDescription>
                        Blinds: {table.smallBlind}/{table.bigBlind}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      <Users className="h-3 w-3 mr-1" />
                      {playerCounts[table.id] || 0}/{table.maxPlayers}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Hands played:</span>
                      <span>{table.handsPlayed}/{table.maxHands}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(table.handsPlayed / table.maxHands) * 100}%` }}
                      />
                    </div>
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      onClick={() => handleJoinTable(table.id)}
                      disabled={(playerCounts[table.id] || 0) >= table.maxPlayers}
                    >
                      {(playerCounts[table.id] || 0) >= table.maxPlayers ? 'Table Full' : 'Join Table'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {tables.length === 0 && (
            <Card className="col-span-full border-dashed border-primary/30 bg-transparent">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <span className="text-6xl mb-4">🎴</span>
                <p className="text-muted-foreground text-lg">No tables available</p>
                <p className="text-sm text-muted-foreground">Check back later or ask an admin to create one!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}