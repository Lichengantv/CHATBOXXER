import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ArrowLeft, Send, MoreVertical, Users } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string | null;
  groupId: string | null;
  text: string;
  timestamp: number;
}

interface UserCache {
  [userId: string]: {
    name: string;
    initials: string;
  };
}

interface ChatWindowProps {
  accessToken: string;
  userId: string;
  targetId: string;
  targetName: string;
  chatType: 'dm' | 'group';
  onBack: () => void;
}

export function ChatWindow({ accessToken, userId, targetId, targetName, chatType, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userCache, setUserCache] = useState<UserCache>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Poll for new messages every 2 seconds
    const interval = setInterval(() => {
      loadMessages();
    }, 2000);

    return () => clearInterval(interval);
  }, [targetId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/messages/${targetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const msgs = data.messages || [];
        setMessages(msgs);

        // Load user info for group messages
        if (chatType === 'group') {
          const uniqueUserIds = [...new Set(msgs.map((m: Message) => m.fromUserId))];
          for (const uid of uniqueUserIds) {
            if (!userCache[uid]) {
              loadUserInfo(uid);
            }
          }
        }
      } else {
        console.error('Error loading messages:', await response.text());
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const loadUserInfo = async (uid: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/user/${uid}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserCache(prev => ({
          ...prev,
          [uid]: {
            name: data.user.name,
            initials: getInitials(data.user.name)
          }
        }));
      }
    } catch (err) {
      console.error('Error loading user info:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    try {
      const body = chatType === 'group'
        ? { groupId: targetId, text: messageText }
        : { toUserId: targetId, text: messageText };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(body)
        }
      );

      if (response.ok) {
        // Reload messages to get the new message
        await loadMessages();
      } else {
        const error = await response.json();
        console.error('Error sending message:', error);
        setNewMessage(messageText); // Restore message on error
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSenderName = (fromUserId: string) => {
    if (fromUserId === userId) return 'You';
    return userCache[fromUserId]?.name || 'Loading...';
  };

  const getSenderInitials = (fromUserId: string) => {
    if (fromUserId === userId) return getInitials('You');
    return userCache[fromUserId]?.initials || '?';
  };

  return (
    <div className="h-screen flex flex-col bg-blue-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-blue-500 md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarFallback className={chatType === 'group' ? 'bg-blue-500' : 'bg-blue-400'}>
            {chatType === 'group' ? <Users className="w-5 h-5" /> : getInitials(targetName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div>{targetName}</div>
          {chatType === 'group' && (
            <div className="text-blue-100">Group chat</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-blue-500"
        >
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No messages yet. Say hi! 👋
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.fromUserId === userId;
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && chatType === 'group' && (
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarFallback className="text-xs">
                        {getSenderInitials(message.fromUserId)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white rounded-bl-none'
                    }`}
                  >
                    {!isMe && chatType === 'group' && (
                      <div className={`mb-1 ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                        {getSenderName(message.fromUserId)}
                      </div>
                    )}
                    <div className="break-words">{message.text}</div>
                    <div className={`text-right mt-1 ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="bg-white p-3 border-t">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message"
            className="flex-1"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={sending || !newMessage.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
