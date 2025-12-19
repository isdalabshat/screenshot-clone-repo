import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
  user_id: string;
}

interface TableChatProps {
  tableId: string;
  userId?: string;
  username?: string;
}

export default function TableChat({ tableId, userId, username }: TableChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat-${tableId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => [...prev, newMsg]);
        if (!isOpen && newMsg.user_id !== userId) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, isOpen, userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !username) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        table_id: tableId,
        user_id: userId,
        username: username,
        message: newMessage.trim()
      });

    if (!error) {
      setNewMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Chat Toggle Button - positioned above emoji button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg',
          'bg-emerald-600 hover:bg-emerald-700 border-emerald-500',
          unreadCount > 0 && 'animate-pulse'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white" />
        )}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-36 right-4 z-40 w-72 h-80 bg-slate-900/95 backdrop-blur border border-emerald-700/30 rounded-lg shadow-xl flex flex-col"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-emerald-700/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-400">Table Chat</span>
              <span className="text-xs text-muted-foreground">{messages.length} messages</span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2" ref={scrollRef}>
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: msg.user_id === userId ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'flex flex-col',
                        msg.user_id === userId ? 'items-end' : 'items-start'
                      )}
                    >
                      <div className={cn(
                        'max-w-[85%] rounded-lg px-2 py-1',
                        msg.user_id === userId
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-white'
                      )}>
                        <div className="text-[10px] font-medium opacity-70">
                          {msg.username}
                        </div>
                        <div className="text-xs break-words">{msg.message}</div>
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        {formatTime(msg.created_at)}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-2 border-t border-emerald-700/30">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="h-8 text-xs bg-slate-800 border-slate-700"
                  maxLength={200}
                  disabled={!userId}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!newMessage.trim() || !userId}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
