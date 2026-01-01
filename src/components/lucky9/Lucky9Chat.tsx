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

interface Lucky9ChatProps {
  tableId: string;
  userId?: string;
  username?: string;
}

export default function Lucky9Chat({ tableId, userId, username }: Lucky9ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Create channel only once per tableId
    const channelName = `lucky9-global-chat-${tableId}`;
    
    // Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        const newMsg = payload as ChatMessage;
        setMessages(prev => {
          // Avoid duplicate messages
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (!isOpen && newMsg.user_id !== userId) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe((status) => {
        console.log('Lucky9 chat channel status:', status);
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableId]); // Only depend on tableId, not isOpen or userId

  // Update unread count when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !username || !channelRef.current) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${userId}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      username: username,
      message: newMessage.trim(),
      created_at: new Date().toISOString()
    };

    // Add locally first
    setMessages(prev => [...prev, msg]);
    setNewMessage('');

    // Broadcast to all subscribers (including self, but we filter duplicates)
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'fixed bottom-32 right-14 z-40 h-9 w-9 rounded-full shadow-lg',
          'bg-green-600 hover:bg-green-700 border-green-500',
          unreadCount > 0 && 'animate-pulse'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-3.5 w-3.5 text-white" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5 text-white" />
        )}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px]">
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
            className="fixed bottom-44 right-4 z-40 w-60 sm:w-68 h-56 sm:h-64 bg-slate-900/95 backdrop-blur border border-green-700/30 rounded-lg shadow-xl flex flex-col"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-green-700/30 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-green-400">Table Chat</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{messages.length} messages</span>
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
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-white'
                      )}>
                        <div className="text-[9px] sm:text-[10px] font-medium opacity-70">
                          {msg.username}
                        </div>
                        <div className="text-[11px] sm:text-xs break-words">{msg.message}</div>
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">
                        {formatTime(msg.created_at)}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-2 border-t border-green-700/30">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="h-7 sm:h-8 text-[11px] sm:text-xs bg-slate-800 border-slate-700"
                  maxLength={200}
                  disabled={!userId}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 bg-green-600 hover:bg-green-700"
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
