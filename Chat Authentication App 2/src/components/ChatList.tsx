import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { LogOut, MessageCircle, Users, UserPlus, Shield, Settings } from 'lucide-react';
import { CreateGroupDialog } from './CreateGroupDialog';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string;
  email?: string;
  memberCount?: number;
  latestMessage: string;
  timestamp: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface ChatListProps {
  accessToken: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  onSelectChat: (id: string, name: string, type: 'dm' | 'group') => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function ChatList({ accessToken, userId, userName, isAdmin, onSelectChat, onOpenAdmin, onOpenSettings, onLogout }: ChatListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    loadAllUsers();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      loadConversations();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/conversations`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/users`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-blue-500">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div>{userName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
            onClick={() => setShowNewChat(!showNewChat)}
            title="New Chat"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
            onClick={() => setShowCreateGroup(true)}
            title="Create Group"
          >
            <Users className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-blue-500"
              onClick={onOpenAdmin}
              title="Admin Panel"
            >
              <Shield className="w-5 h-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* New Chat Panel */}
      {showNewChat && (
        <div className="border-b bg-blue-50 p-4">
          <h3 className="mb-3">Start a new chat</h3>
          <ScrollArea className="h-48">
            {allUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No other users available</p>
            ) : (
              <div className="space-y-1">
                {allUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      onSelectChat(user.id, user.name, 'dm');
                      setShowNewChat(false);
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-blue-100 rounded transition-colors"
                  >
                    <Avatar>
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div>{user.name}</div>
                      <div className="text-gray-500">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading chats...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">No conversations yet</p>
            <p className="text-gray-400 text-center">Click the icons above to start chatting</p>
          </div>
        ) : (
          <div>
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv.id, conv.name, conv.type)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 border-b transition-colors"
              >
                <Avatar>
                  <AvatarFallback className={conv.type === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-300'}>
                    {conv.type === 'group' ? <Users className="w-4 h-4" /> : getInitials(conv.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <span>{conv.name}</span>
                      {conv.type === 'group' && (
                        <span className="text-gray-500">({conv.memberCount} members)</span>
                      )}
                    </div>
                    <div className="text-gray-500">{formatTimestamp(conv.timestamp)}</div>
                  </div>
                  <div className="text-gray-500 truncate">
                    {conv.latestMessage || 'No messages yet'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        accessToken={accessToken}
        users={allUsers}
        onGroupCreated={loadConversations}
      />
    </div>
  );
}
