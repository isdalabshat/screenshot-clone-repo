import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Lobby from "./pages/Lobby";
import Table from "./pages/Table";
import Admin from "./pages/Admin";
import TransactionHistory from "./pages/TransactionHistory";
import NotFound from "./pages/NotFound";
import Lucky9Lobby from "./pages/Lucky9Lobby";
import Lucky9Table from "./pages/Lucky9Table";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/table/:tableId" element={<Table />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/transactions" element={<TransactionHistory />} />
              <Route path="/lucky9" element={<Lucky9Lobby />} />
              <Route path="/lucky9/:tableId" element={<Lucky9Table />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
