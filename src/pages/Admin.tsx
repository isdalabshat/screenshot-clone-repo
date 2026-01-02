import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Edit, Coins, Users, Shield, Trash2, DollarSign, Check, X, Image, History, Eye, EyeOff, Mail, Lock, UserX } from 'lucide-react';
import { motion } from 'framer-motion';

interface UserProfile { id: string; oduserId: string; username: string; chips: number; email?: string; }
interface PokerTableData { id: string; name: string; smallBlind: number; bigBlind: number; handsPlayed: number; maxHands: number; isActive: boolean; }
interface CashRequest { id: string; oduserId: string; username: string; requestType: string; amount: number; status: string; createdAt: string; proofImageUrl?: string; gcashNumber?: string; }
interface Lucky9TableData { id: string; name: string; minBet: number; maxBet: number; maxPlayers: number; isActive: boolean; callTimeMinutes: number | null; }


export default function Admin() {
  const navigate = useNavigate();
  const { profile, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [tables, setTables] = useState<PokerTableData[]>([]);
  const [lucky9Tables, setLucky9Tables] = useState<Lucky9TableData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cashRequests, setCashRequests] = useState<CashRequest[]>([]);
  const [totalFees, setTotalFees] = useState(0);
  const [totalLucky9Fees, setTotalLucky9Fees] = useState(0);
  const [newTable, setNewTable] = useState({ name: '', smallBlind: 10, bigBlind: 20, maxHands: 50 });
  const [newLucky9Table, setNewLucky9Table] = useState({ name: '', minBet: 10, maxBet: 1000, callTimeMinutes: null as number | null });
  const [editingTable, setEditingTable] = useState<PokerTableData | null>(null);
  const [chipAdjustment, setChipAdjustment] = useState<{ oduserId: string; amount: number } | null>(null);
  const [visibleEmails, setVisibleEmails] = useState<Set<string>>(new Set());
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!profile || !profile.isAdmin)) navigate('/lobby');
  }, [profile, isLoading, navigate]);

  useEffect(() => {
    if (profile?.isAdmin) { fetchTables(); fetchLucky9Tables(); fetchUsers(); fetchCashRequests(); fetchTotalFees(); fetchLucky9Fees(); }
  }, [profile?.isAdmin]);

  const fetchLucky9Tables = async () => {
    const { data } = await supabase.from('lucky9_tables').select('*').order('created_at', { ascending: false });
    if (data) setLucky9Tables(data.map(t => ({ id: t.id, name: t.name, minBet: t.min_bet, maxBet: t.max_bet, maxPlayers: t.max_players, isActive: t.is_active, callTimeMinutes: t.call_time_minutes })));
  };

  const createLucky9Table = async () => {
    if (!newLucky9Table.name.trim()) { toast({ title: 'Error', description: 'Table name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('lucky9_tables').insert({ 
      name: newLucky9Table.name, 
      min_bet: newLucky9Table.minBet, 
      max_bet: newLucky9Table.maxBet,
      call_time_minutes: newLucky9Table.callTimeMinutes
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Success', description: 'Lucky 9 table created!' }); setNewLucky9Table({ name: '', minBet: 10, maxBet: 1000, callTimeMinutes: null }); fetchLucky9Tables(); }
  };

  const deleteLucky9Table = async (tableId: string) => {
    await supabase.from('lucky9_players').delete().eq('table_id', tableId);
    await supabase.from('lucky9_games').delete().eq('table_id', tableId);
    const { error } = await supabase.from('lucky9_tables').delete().eq('id', tableId);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Success', description: 'Lucky 9 table deleted!' }); fetchLucky9Tables(); }
  };

  const fetchTables = async () => {
    const { data } = await supabase.from('poker_tables').select('*').order('created_at', { ascending: false });
    if (data) setTables(data.map(t => ({ id: t.id, name: t.name, smallBlind: t.small_blind, bigBlind: t.big_blind, handsPlayed: t.hands_played, maxHands: t.max_hands, isActive: t.is_active })));
  };

  const fetchUsers = async () => {
    // Fetch profiles
    const { data: profilesData } = await supabase.from('profiles').select('*').order('username');
    
    if (profilesData) {
      // Fetch emails from auth.users via edge function or direct query (we'll use the user_id to show email)
      const usersWithEmail = await Promise.all(profilesData.map(async (u) => {
        // Get email from auth.users using admin API (via service role in edge function if needed)
        // For now, we'll query the auth.users table directly (works with service role)
        const { data: authUser } = await supabase.auth.admin.getUserById(u.user_id);
        return { 
          id: u.id, 
          oduserId: u.user_id, 
          username: u.username, 
          chips: u.chips,
          email: authUser?.user?.email || 'N/A'
        };
      }));
      setUsers(usersWithEmail);
    }
  };

  const fetchCashRequests = async () => {
    const { data: requests } = await supabase.from('cash_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (requests) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, username');
      const userMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);
      setCashRequests(requests.map(r => ({ id: r.id, oduserId: r.user_id, username: userMap.get(r.user_id) || 'Unknown', requestType: r.request_type, amount: r.amount, status: r.status, createdAt: r.created_at, proofImageUrl: r.proof_image_url, gcashNumber: r.gcash_number })));
    }
  };

  const fetchTotalFees = async () => {
    const { data } = await supabase.from('collected_fees').select('fee_amount');
    if (data) setTotalFees(data.reduce((sum, f) => sum + f.fee_amount, 0));
  };

  const fetchLucky9Fees = async () => {
    const { data } = await supabase.from('lucky9_fees').select('fee_amount');
    if (data) setTotalLucky9Fees(data.reduce((sum, f) => sum + f.fee_amount, 0));
  };

  const resetFees = async () => {
    const { error: pokerError } = await supabase.from('collected_fees').delete().gte('fee_amount', 0);
    const { error: lucky9Error } = await supabase.from('lucky9_fees').delete().gte('fee_amount', 0);
    
    if (pokerError || lucky9Error) {
      console.error('Error deleting fees:', pokerError, lucky9Error);
      toast({ title: 'Error', description: 'Failed to reset some fees', variant: 'destructive' });
    } else {
      setTotalFees(0);
      setTotalLucky9Fees(0);
      toast({ title: 'Success', description: 'All fees have been reset!' });
    }
  };

  const handleCashRequest = async (requestId: string, approve: boolean, oduserId: string, amount: number, type: string) => {
    if (approve) {
      const user = users.find(u => u.oduserId === oduserId);
      if (user) {
        const newChips = type === 'cash_in' ? user.chips + amount : Math.max(0, user.chips - amount);
        await supabase.from('profiles').update({ chips: newChips }).eq('user_id', oduserId);
      }
    }
    await supabase.from('cash_requests').update({ status: approve ? 'approved' : 'rejected', processed_at: new Date().toISOString() }).eq('id', requestId);
    toast({ title: approve ? 'Approved' : 'Rejected', description: `Request has been ${approve ? 'approved' : 'rejected'}` });
    fetchCashRequests(); fetchUsers();
  };

  const createTable = async () => {
    if (!newTable.name.trim()) { toast({ title: 'Error', description: 'Table name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('poker_tables').insert({ name: newTable.name, small_blind: newTable.smallBlind, big_blind: newTable.bigBlind, max_hands: newTable.maxHands });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Success', description: 'Table created!' }); setNewTable({ name: '', smallBlind: 10, bigBlind: 20, maxHands: 50 }); fetchTables(); }
  };

  const updateTable = async () => { if (!editingTable) return; await supabase.from('poker_tables').update({ name: editingTable.name, small_blind: editingTable.smallBlind, big_blind: editingTable.bigBlind, max_hands: editingTable.maxHands, is_active: editingTable.isActive }).eq('id', editingTable.id); toast({ title: 'Success', description: 'Table updated!' }); setEditingTable(null); fetchTables(); };
  
  const deleteTable = async (tableId: string) => {
    try {
      const { data: games } = await supabase.from('games').select('id').eq('table_id', tableId);
      const gameIds = games?.map(g => g.id) || [];
      
      if (gameIds.length > 0) {
        for (const gameId of gameIds) {
          await supabase.from('game_actions').delete().eq('game_id', gameId);
        }
      }
      
      await supabase.from('collected_fees').delete().eq('table_id', tableId);
      await supabase.from('games').delete().eq('table_id', tableId);
      await supabase.from('chat_messages').delete().eq('table_id', tableId);
      await supabase.from('table_players').delete().eq('table_id', tableId);
      
      const { error } = await supabase.from('poker_tables').delete().eq('id', tableId);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Table deleted!' });
      fetchTables();
    } catch (error: any) {
      console.error('Delete table error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete table', variant: 'destructive' });
    }
  };
  
  const resetTableHands = async (tableId: string) => { await supabase.from('poker_tables').update({ hands_played: 0 }).eq('id', tableId); toast({ title: 'Success', description: 'Hands reset!' }); fetchTables(); };
  
  const adjustChips = async (add: boolean) => { 
    if (!chipAdjustment) return; 
    const user = users.find(u => u.oduserId === chipAdjustment.oduserId); 
    if (!user) return; 
    const newChips = add ? user.chips + chipAdjustment.amount : Math.max(0, user.chips - chipAdjustment.amount); 
    await supabase.from('profiles').update({ chips: newChips }).eq('user_id', chipAdjustment.oduserId); 
    toast({ title: 'Success', description: `${add ? 'Added' : 'Deducted'} ${chipAdjustment.amount} chips` }); 
    setChipAdjustment(null); 
    fetchUsers(); 
  };

  const toggleEmailVisibility = (oduserId: string) => {
    setVisibleEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(oduserId)) {
        newSet.delete(oduserId);
      } else {
        newSet.add(oduserId);
      }
      return newSet;
    });
  };

  const deletePlayer = async (oduserId: string) => {
    try {
      // Delete all related data first
      await supabase.from('lucky9_players').delete().eq('user_id', oduserId);
      await supabase.from('table_players').delete().eq('user_id', oduserId);
      await supabase.from('cash_requests').delete().eq('user_id', oduserId);
      await supabase.from('chat_messages').delete().eq('user_id', oduserId);
      await supabase.from('game_actions').delete().eq('user_id', oduserId);
      await supabase.from('user_roles').delete().eq('user_id', oduserId);
      await supabase.from('profiles').delete().eq('user_id', oduserId);
      
      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(oduserId);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Player permanently deleted!' });
      setDeleteConfirmUserId(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Delete player error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete player', variant: 'destructive' });
    }
  };

  if (isLoading || !profile?.isAdmin) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-xl">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-background to-amber-950/20">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="border-b border-amber-700/30 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}><ArrowLeft className="h-5 w-5" /></Button>
          <Shield className="h-6 w-6 text-amber-400" />
          <div><h1 className="text-2xl font-bold text-amber-400">All-in Club Admin</h1><p className="text-sm text-muted-foreground">Welcome, {profile.username}</p></div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5"><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="tables">Poker</TabsTrigger><TabsTrigger value="lucky9">Lucky 9</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="requests">Cash Requests</TabsTrigger></TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-6 md:grid-cols-5">
              <Card className="border-amber-700/30"><CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-400" />Poker Fees</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-green-400">{totalFees.toLocaleString()}</p><p className="text-sm text-muted-foreground">10% rake on pots</p></CardContent></Card>
              <Card className="border-purple-700/30"><CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-purple-400" />Lucky 9 Fees</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-purple-400">{totalLucky9Fees.toLocaleString()}</p><p className="text-sm text-muted-foreground">10% on winnings</p></CardContent></Card>
              <Card className="border-cyan-700/30"><CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-cyan-400" />Total Player Balance</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-cyan-400">₱{users.reduce((sum, u) => sum + u.chips, 0).toLocaleString()}</p><p className="text-sm text-muted-foreground">{users.length} players</p></CardContent></Card>
              <Card className="border-amber-700/30"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Active Tables</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">{tables.filter(t => t.isActive).length + lucky9Tables.filter(t => t.isActive).length}</p></CardContent></Card>
              <Card className="border-amber-700/30"><CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-yellow-400" />Pending Requests</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-yellow-400">{cashRequests.length}</p></CardContent></Card>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="destructive" onClick={resetFees}><Trash2 className="h-4 w-4 mr-2" />Reset All Fees</Button>
              <Button onClick={() => navigate('/admin/transactions')} className="bg-blue-600 hover:bg-blue-700"><History className="h-4 w-4 mr-2" />Transaction History</Button>
            </div>
          </TabsContent>

          <TabsContent value="tables">
            <Card className="border-amber-700/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Table Management</CardTitle><CardDescription>Create and manage poker tables</CardDescription></div>
                <Dialog><DialogTrigger asChild><Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" />New Table</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create New Table</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Name</Label><Input value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div><Label>Small Blind</Label><Input type="number" value={newTable.smallBlind} onChange={(e) => setNewTable({ ...newTable, smallBlind: parseInt(e.target.value) || 0 })} /></div><div><Label>Big Blind</Label><Input type="number" value={newTable.bigBlind} onChange={(e) => setNewTable({ ...newTable, bigBlind: parseInt(e.target.value) || 0 })} /></div></div><div><Label>Max Hands</Label><Input type="number" value={newTable.maxHands} onChange={(e) => setNewTable({ ...newTable, maxHands: parseInt(e.target.value) || 50 })} /></div><Button onClick={createTable} className="w-full bg-amber-600 hover:bg-amber-700">Create</Button></div></DialogContent></Dialog>
              </CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Blinds</TableHead><TableHead>Hands</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{tables.map((table) => (<TableRow key={table.id}><TableCell>{table.name}</TableCell><TableCell>{table.smallBlind}/{table.bigBlind}</TableCell><TableCell>{table.handsPlayed}/{table.maxHands}</TableCell><TableCell><span className={table.isActive ? 'text-green-400' : 'text-red-400'}>{table.isActive ? 'Active' : 'Inactive'}</span></TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => resetTableHands(table.id)}>🔄</Button><Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteTable(table.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>))}</TableBody></Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lucky9">
            <Card className="border-purple-700/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle className="text-purple-400">Lucky 9 Tables</CardTitle><CardDescription>Create and manage Lucky 9 tables</CardDescription></div>
                <Dialog><DialogTrigger asChild><Button className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" />New Lucky 9 Table</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create Lucky 9 Table</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Name</Label><Input value={newLucky9Table.name} onChange={(e) => setNewLucky9Table({ ...newLucky9Table, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div><Label>Min Bet</Label><Input type="number" value={newLucky9Table.minBet} onChange={(e) => setNewLucky9Table({ ...newLucky9Table, minBet: parseInt(e.target.value) || 10 })} /></div><div><Label>Max Bet</Label><Input type="number" value={newLucky9Table.maxBet} onChange={(e) => setNewLucky9Table({ ...newLucky9Table, maxBet: parseInt(e.target.value) || 1000 })} /></div></div><div><Label>Call Time</Label><select className="w-full p-2 rounded bg-background border border-input" value={newLucky9Table.callTimeMinutes ?? ''} onChange={(e) => setNewLucky9Table({ ...newLucky9Table, callTimeMinutes: e.target.value === '' ? null : parseInt(e.target.value) })}><option value="">No Call Time</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></div><Button onClick={createLucky9Table} className="w-full bg-purple-600 hover:bg-purple-700">Create</Button></div></DialogContent></Dialog>
              </CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Bet Range</TableHead><TableHead>Call Time</TableHead><TableHead>Max Players</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{lucky9Tables.map((table) => (<TableRow key={table.id}><TableCell>{table.name}</TableCell><TableCell>₱{table.minBet} - ₱{table.maxBet}</TableCell><TableCell>{table.callTimeMinutes ? `${table.callTimeMinutes} min` : 'None'}</TableCell><TableCell>{table.maxPlayers}</TableCell><TableCell><span className={table.isActive ? 'text-green-400' : 'text-red-400'}>{table.isActive ? 'Active' : 'Inactive'}</span></TableCell><TableCell><Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteLucky9Table(table.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-amber-700/30">
              <CardHeader><CardTitle>User Management</CardTitle><CardDescription>Manage players, view credentials, and adjust chips</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Chips</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {visibleEmails.has(user.oduserId) ? (
                              <span className="font-mono text-sm">{user.email}</span>
                            ) : (
                              <span className="text-muted-foreground">••••••••</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleEmailVisibility(user.oduserId)}
                              className="h-6 w-6 p-0"
                            >
                              {visibleEmails.has(user.oduserId) ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-yellow-400 font-mono">{user.chips.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {/* Chip Adjustment Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setChipAdjustment({ oduserId: user.oduserId, amount: 1000 })}>
                                  <Coins className="h-4 w-4 mr-1" />Adjust
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Adjust Chips for {user.username}</DialogTitle></DialogHeader>
                                {chipAdjustment?.oduserId === user.oduserId && (
                                  <div className="space-y-4">
                                    <div><Label>Amount</Label><Input type="number" value={chipAdjustment.amount} onChange={(e) => setChipAdjustment({ ...chipAdjustment, amount: parseInt(e.target.value) || 0 })} /></div>
                                    <div className="flex gap-2">
                                      <Button onClick={() => adjustChips(true)} className="flex-1 bg-green-600 hover:bg-green-700">+ Add</Button>
                                      <Button onClick={() => adjustChips(false)} variant="destructive" className="flex-1">- Deduct</Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>

                            {/* Delete Player Dialog */}
                            <Dialog open={deleteConfirmUserId === user.oduserId} onOpenChange={(open) => !open && setDeleteConfirmUserId(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => setDeleteConfirmUserId(user.oduserId)}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle className="text-red-500">⚠️ Delete Player Permanently</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-muted-foreground">
                                    Are you sure you want to <strong className="text-red-500">permanently delete</strong> player <strong>{user.username}</strong>?
                                  </p>
                                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm">
                                    <p className="text-red-400 font-medium mb-2">This action will:</p>
                                    <ul className="list-disc list-inside text-red-300 space-y-1">
                                      <li>Delete their account and login credentials</li>
                                      <li>Remove all their game history</li>
                                      <li>Delete their profile and chips balance</li>
                                      <li>Remove them from all tables</li>
                                    </ul>
                                    <p className="text-red-500 font-bold mt-2">This cannot be undone!</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setDeleteConfirmUserId(null)} className="flex-1">Cancel</Button>
                                    <Button variant="destructive" onClick={() => deletePlayer(user.oduserId)} className="flex-1">
                                      <Trash2 className="h-4 w-4 mr-2" />Delete Forever
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="border-amber-700/30">
              <CardHeader><CardTitle>Pending Cash Requests</CardTitle><CardDescription>Approve or reject cash in/out requests</CardDescription></CardHeader>
              <CardContent>
                {cashRequests.length === 0 ? <p className="text-muted-foreground text-center py-8">No pending requests</p> : (
                  <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>GCash/Proof</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{cashRequests.map((req) => (<TableRow key={req.id}><TableCell>{req.username}</TableCell><TableCell><Badge className={req.requestType === 'cash_in' ? 'bg-green-600' : 'bg-orange-600'}>{req.requestType === 'cash_in' ? 'Cash In' : 'Cash Out'}</Badge></TableCell><TableCell className="font-mono">{req.amount.toLocaleString()}</TableCell><TableCell>{req.requestType === 'cash_out' ? (<span className="font-mono text-blue-400 font-bold">{req.gcashNumber || 'N/A'}</span>) : req.proofImageUrl ? (<Dialog><DialogTrigger asChild><Button variant="ghost" size="sm"><Image className="h-4 w-4 mr-1" />View</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Payment Proof - {req.username}</DialogTitle></DialogHeader><img src={req.proofImageUrl} alt="Payment proof" className="max-h-[70vh] w-auto mx-auto rounded-lg" /></DialogContent></Dialog>) : <span className="text-muted-foreground text-xs">N/A</span>}</TableCell><TableCell className="text-sm">{new Date(req.createdAt).toLocaleDateString()}</TableCell><TableCell><div className="flex gap-1"><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleCashRequest(req.id, true, req.oduserId, req.amount, req.requestType)}><Check className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleCashRequest(req.id, false, req.oduserId, req.amount, req.requestType)}><X className="h-4 w-4" /></Button></div></TableCell></TableRow>))}</TableBody></Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
