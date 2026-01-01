import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface Transaction {
  id: string;
  userId: string;
  username: string;
  requestType: 'cash_in' | 'cash_out';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt: string | null;
  gcashNumber?: string;
  proofImageUrl?: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const { profile, isLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'cash_in' | 'cash_out'>('all');

  useEffect(() => {
    if (!isLoading && (!profile || !profile.isAdmin)) navigate('/lobby');
  }, [profile, isLoading, navigate]);

  useEffect(() => {
    if (profile?.isAdmin) fetchTransactions();
  }, [profile?.isAdmin]);

  const fetchTransactions = async () => {
    const { data: requests } = await supabase
      .from('cash_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (requests) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, username');
      const userMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);
      
      setTransactions(requests.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: userMap.get(r.user_id) || 'Unknown',
        requestType: r.request_type as 'cash_in' | 'cash_out',
        amount: r.amount,
        status: r.status as 'pending' | 'approved' | 'rejected',
        createdAt: r.created_at,
        processedAt: r.processed_at,
        gcashNumber: r.gcash_number || undefined,
        proofImageUrl: r.proof_image_url || undefined
      })));
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.gcashNumber?.includes(searchTerm);
    const matchesFilter = filter === 'all' || t.requestType === filter;
    return matchesSearch && matchesFilter;
  });

  const totalCashIn = transactions
    .filter(t => t.requestType === 'cash_in' && t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCashOut = transactions
    .filter(t => t.requestType === 'cash_out' && t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  if (isLoading || !profile?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-600">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-background to-amber-950/20">
      <motion.header 
        initial={{ y: -20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="border-b border-amber-700/30 bg-card/50 backdrop-blur sticky top-0 z-10"
      >
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-amber-400">Transaction History</h1>
            <p className="text-sm text-muted-foreground">All cash in and cash out records</p>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ArrowDownCircle className="h-4 w-4 text-green-400" />
                Total Cash In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">₱{totalCashIn.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="border-orange-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ArrowUpCircle className="h-4 w-4 text-orange-400" />
                Total Cash Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-400">₱{totalCashOut.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Net Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totalCashIn - totalCashOut >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₱{(totalCashIn - totalCashOut).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-700/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or GCash number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="cash_in">Cash In</TabsTrigger>
              <TabsTrigger value="cash_out">Cash Out</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Transactions Table */}
        <Card className="border-amber-700/30">
          <CardHeader>
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            <CardDescription>Complete history of all cash requests</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>GCash #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {new Date(tx.createdAt).toLocaleDateString()}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{tx.username}</TableCell>
                        <TableCell>
                          <Badge className={tx.requestType === 'cash_in' ? 'bg-green-600' : 'bg-orange-600'}>
                            {tx.requestType === 'cash_in' ? (
                              <><ArrowDownCircle className="h-3 w-3 mr-1" /> In</>
                            ) : (
                              <><ArrowUpCircle className="h-3 w-3 mr-1" /> Out</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold">
                          ₱{tx.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {tx.gcashNumber ? (
                            <span className="font-mono text-blue-400">{tx.gcashNumber}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.processedAt 
                            ? new Date(tx.processedAt).toLocaleDateString()
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
