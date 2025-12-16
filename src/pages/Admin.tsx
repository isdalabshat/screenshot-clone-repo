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
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Edit, Coins, Users } from 'lucide-react';

interface UserProfile {
  id: string;
  userId: string;
  username: string;
  chips: number;
}

interface PokerTableData {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  handsPlayed: number;
  maxHands: number;
  isActive: boolean;
}

export default function Admin() {
  const navigate = useNavigate();
  const { profile, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [tables, setTables] = useState<PokerTableData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newTable, setNewTable] = useState({ name: '', smallBlind: 10, bigBlind: 20 });
  const [editingTable, setEditingTable] = useState<PokerTableData | null>(null);
  const [chipAdjustment, setChipAdjustment] = useState<{ userId: string; amount: number } | null>(null);

  useEffect(() => {
    if (!isLoading && (!profile || !profile.isAdmin)) {
      navigate('/lobby');
    }
  }, [profile, isLoading, navigate]);

  useEffect(() => {
    fetchTables();
    fetchUsers();
  }, []);

  const fetchTables = async () => {
    const { data } = await supabase
      .from('poker_tables')
      .select('*')
      .order('created_at');

    if (data) {
      setTables(data.map(t => ({
        id: t.id,
        name: t.name,
        smallBlind: t.small_blind,
        bigBlind: t.big_blind,
        handsPlayed: t.hands_played,
        maxHands: t.max_hands,
        isActive: t.is_active
      })));
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('username');

    if (data) {
      setUsers(data.map(u => ({
        id: u.id,
        userId: u.user_id,
        username: u.username,
        chips: u.chips
      })));
    }
  };

  const createTable = async () => {
    const { error } = await supabase
      .from('poker_tables')
      .insert({
        name: newTable.name,
        small_blind: newTable.smallBlind,
        big_blind: newTable.bigBlind
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Table created!' });
      setNewTable({ name: '', smallBlind: 10, bigBlind: 20 });
      fetchTables();
    }
  };

  const updateTable = async () => {
    if (!editingTable) return;

    const { error } = await supabase
      .from('poker_tables')
      .update({
        name: editingTable.name,
        small_blind: editingTable.smallBlind,
        big_blind: editingTable.bigBlind,
        is_active: editingTable.isActive
      })
      .eq('id', editingTable.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Table updated!' });
      setEditingTable(null);
      fetchTables();
    }
  };

  const adjustChips = async (add: boolean) => {
    if (!chipAdjustment) return;

    const user = users.find(u => u.userId === chipAdjustment.userId);
    if (!user) return;

    const newChips = add 
      ? user.chips + chipAdjustment.amount 
      : Math.max(0, user.chips - chipAdjustment.amount);

    const { error } = await supabase
      .from('profiles')
      .update({ chips: newChips })
      .eq('user_id', chipAdjustment.userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Success', 
        description: `${add ? 'Added' : 'Deducted'} ${chipAdjustment.amount} chips` 
      });
      setChipAdjustment(null);
      fetchUsers();
    }
  };

  if (isLoading || !profile?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-background to-amber-950/20">
      <header className="border-b border-amber-700/30 bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-amber-400">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage tables and users</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Table Management */}
        <Card className="border-amber-700/30">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Table Management
                </CardTitle>
                <CardDescription>Create and edit poker tables</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-amber-600 hover:bg-amber-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Table
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Table</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Table Name</Label>
                      <Input
                        value={newTable.name}
                        onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                        placeholder="High Stakes Table"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Small Blind</Label>
                        <Input
                          type="number"
                          value={newTable.smallBlind}
                          onChange={(e) => setNewTable({ ...newTable, smallBlind: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Big Blind</Label>
                        <Input
                          type="number"
                          value={newTable.bigBlind}
                          onChange={(e) => setNewTable({ ...newTable, bigBlind: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <Button onClick={createTable} className="w-full">Create Table</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Blinds</TableHead>
                  <TableHead>Hands</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell>{table.smallBlind}/{table.bigBlind}</TableCell>
                    <TableCell>{table.handsPlayed}/{table.maxHands}</TableCell>
                    <TableCell>
                      <span className={table.isActive ? 'text-green-400' : 'text-red-400'}>
                        {table.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setEditingTable(table)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Table</DialogTitle>
                          </DialogHeader>
                          {editingTable && (
                            <div className="space-y-4">
                              <div>
                                <Label>Table Name</Label>
                                <Input
                                  value={editingTable.name}
                                  onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Small Blind</Label>
                                  <Input
                                    type="number"
                                    value={editingTable.smallBlind}
                                    onChange={(e) => setEditingTable({ ...editingTable, smallBlind: parseInt(e.target.value) || 0 })}
                                  />
                                </div>
                                <div>
                                  <Label>Big Blind</Label>
                                  <Input
                                    type="number"
                                    value={editingTable.bigBlind}
                                    onChange={(e) => setEditingTable({ ...editingTable, bigBlind: parseInt(e.target.value) || 0 })}
                                  />
                                </div>
                              </div>
                              <Button onClick={updateTable} className="w-full">Save Changes</Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="border-amber-700/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              User Chip Management
            </CardTitle>
            <CardDescription>Add or deduct chips from user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Current Chips</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-yellow-400">{user.chips.toLocaleString()}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setChipAdjustment({ userId: user.userId, amount: 1000 })}
                          >
                            <Coins className="h-4 w-4 mr-2" />
                            Adjust
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adjust Chips for {user.username}</DialogTitle>
                          </DialogHeader>
                          {chipAdjustment?.userId === user.userId && (
                            <div className="space-y-4">
                              <div>
                                <Label>Amount</Label>
                                <Input
                                  type="number"
                                  value={chipAdjustment.amount}
                                  onChange={(e) => setChipAdjustment({ 
                                    ...chipAdjustment, 
                                    amount: parseInt(e.target.value) || 0 
                                  })}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => adjustChips(true)} 
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  Add Chips
                                </Button>
                                <Button 
                                  onClick={() => adjustChips(false)} 
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  Deduct Chips
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
