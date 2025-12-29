import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Coins, LogOut, Shield, ArrowLeft } from 'lucide-react';
import { Lucky9Table } from '@/types/lucky9';
import { motion } from 'framer-motion';

export default function Lucky9Lobby() {
  const navigate = useNavigate();
  const { user, profile, signOut, isLoading } = useAuth();
  const [tables, setTables] = useState<Lucky9Table[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [bankerStatus, setBankerStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    fetchTables();

    const channel = supabase
      .channel('lucky9-lobby-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_tables' }, fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_players' }, fetchPlayerCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTables = async () => {
    const { data } = await supabase
      .from('lucky9_tables')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (data) {
      setTables(data.map(t => ({
        id: t.id,
        name: t.name,
        minBet: t.min_bet,
        maxBet: t.max_bet,
        maxPlayers: t.max_players,
        isActive: t.is_active,
        betTimerSeconds: t.bet_timer_seconds
      })));
      fetchPlayerCounts();
    }
  };

  const fetchPlayerCounts = async () => {
    const { data } = await supabase
      .from('lucky9_players')
      .select('table_id, is_banker')
      .eq('is_active', true);

    if (data) {
      const counts: Record<string, number> = {};
      const bankers: Record<string, boolean> = {};
      data.forEach(p => {
        counts[p.table_id] = (counts[p.table_id] || 0) + 1;
        if (p.is_banker) {
          bankers[p.table_id] = true;
        }
      });
      setPlayerCounts(counts);
      setBankerStatus(bankers);
    }
  };

  const handleJoinTable = (tableId: string) => {
    navigate(`/lucky9/${tableId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-background to-purple-950">
      {/* Header */}
      <header className="border-b border-purple-500/30 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-4xl">🎴</span>
            <div>
              <h1 className="text-2xl font-bold text-purple-400">Lucky 9</h1>
              <p className="text-xs text-muted-foreground">Beat the Banker!</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
              <Coins className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">₱{profile.chips.toLocaleString()}</span>
            </div>
            
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
          <h2 className="text-3xl font-bold mb-2">Lucky 9 Tables</h2>
          <p className="text-muted-foreground">Choose a table to join and test your luck!</p>
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
                className="border-purple-500/30 bg-card/80 backdrop-blur hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl text-purple-400">{table.name}</CardTitle>
                      <CardDescription>
                        Bet: ₱{table.minBet} - ₱{table.maxBet}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                        <Users className="h-3 w-3 mr-1" />
                        {playerCounts[table.id] || 0}/{table.maxPlayers}
                      </Badge>
                      {bankerStatus[table.id] ? (
                        <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
                          Has Banker
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
                          Needs Banker
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <p>🎴 40-card deck (No J, Q, K)</p>
                      <p>🎯 Natural 9 pays 2:1</p>
                      <p>⏱️ {table.betTimerSeconds}s betting timer</p>
                    </div>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
            <Card className="col-span-full border-dashed border-purple-500/30 bg-transparent">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <span className="text-6xl mb-4">🎴</span>
                <p className="text-muted-foreground text-lg">No Lucky 9 tables available</p>
                <p className="text-sm text-muted-foreground">Check back later or ask an admin to create one!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
