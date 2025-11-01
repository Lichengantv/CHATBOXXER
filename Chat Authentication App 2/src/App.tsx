import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { SignUpPage } from './components/SignUpPage';
import { ForgotPassword } from './components/ForgotPassword';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { AdminPanel } from './components/AdminPanel';
import { AccountSettings } from './components/AccountSettings';
import { supabase } from './utils/supabase/client';
import { projectId } from './utils/supabase/info';
import { Toaster } from './components/ui/sonner';

type Screen = 'login' | 'signup' | 'forgotPassword' | 'chatList' | 'chatWindow' | 'admin' | 'settings';
type ChatType = 'dm' | 'group';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  isAdmin: boolean;
}

interface ChatState {
  targetId: string | null;
  targetName: string | null;
  chatType: ChatType | null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    userId: null,
    userName: null,
    userEmail: null,
    isAdmin: false
  });
  const [chat, setChat] = useState<ChatState>({
    targetId: null,
    targetName: null,
    chatType: null
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const isAdmin = await checkIsAdmin(session.access_token);
        setAuth({
          accessToken: session.access_token,
          userId: session.user.id,
          userName: session.user.user_metadata.name || 'User',
          userEmail: session.user.email || '',
          isAdmin
        });
        setScreen('chatList');
      }
    };

    checkSession();
  }, []);

  const checkIsAdmin = async (accessToken: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/check`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.isAdmin || false;
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
    return false;
  };

  const handleLogin = async (accessToken: string, userId: string, userName: string) => {
    const isAdmin = await checkIsAdmin(accessToken);
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || '';
    setAuth({ accessToken, userId, userName, userEmail, isAdmin });
    setScreen('chatList');
  };

  const handleSignUpSuccess = () => {
    setScreen('login');
  };

  const handleSelectChat = (id: string, name: string, type: ChatType) => {
    setChat({ targetId: id, targetName: name, chatType: type });
    setScreen('chatWindow');
  };

  const handleBackToList = () => {
    setScreen('chatList');
    setChat({ targetId: null, targetName: null, chatType: null });
  };

  const handleOpenAdmin = () => {
    setScreen('admin');
  };

  const handleOpenSettings = () => {
    setScreen('settings');
  };

  const handleNameUpdate = (newName: string) => {
    setAuth(prev => ({ ...prev, userName: newName }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuth({ accessToken: null, userId: null, userName: null, userEmail: null, isAdmin: false });
    setScreen('login');
  };

  // Render appropriate screen
  if (screen === 'login') {
    return (
      <LoginPage
        onLogin={handleLogin}
        onSwitchToSignup={() => setScreen('signup')}
        onForgotPassword={() => setScreen('forgotPassword')}
      />
    );
  }

  if (screen === 'signup') {
    return (
      <SignUpPage
        onSignUpSuccess={handleSignUpSuccess}
        onSwitchToLogin={() => setScreen('login')}
      />
    );
  }

  if (screen === 'forgotPassword') {
    return (
      <ForgotPassword
        onBack={() => setScreen('login')}
      />
    );
  }

  if (screen === 'admin' && auth.accessToken && auth.isAdmin) {
    return (
      <AdminPanel
        accessToken={auth.accessToken}
        onBack={handleBackToList}
      />
    );
  }

  if (screen === 'settings' && auth.accessToken && auth.userId && auth.userName && auth.userEmail) {
    return (
      <>
        <AccountSettings
          accessToken={auth.accessToken}
          userId={auth.userId}
          userName={auth.userName}
          userEmail={auth.userEmail}
          onBack={handleBackToList}
          onLogout={handleLogout}
          onNameUpdate={handleNameUpdate}
        />
        <Toaster />
      </>
    );
  }

  if (screen === 'chatList' && auth.accessToken && auth.userId && auth.userName) {
    return (
      <div className="flex h-screen">
        {/* Chat list - always visible on desktop, conditionally on mobile */}
        <div className={`w-full md:w-96 md:border-r ${screen === 'chatWindow' ? 'hidden md:block' : ''}`}>
          <ChatList
            accessToken={auth.accessToken}
            userId={auth.userId}
            userName={auth.userName}
            isAdmin={auth.isAdmin}
            onSelectChat={handleSelectChat}
            onOpenAdmin={handleOpenAdmin}
            onOpenSettings={handleOpenSettings}
            onLogout={handleLogout}
          />
        </div>

        {/* Empty state for desktop when no chat selected */}
        <div className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-20 h-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="mb-2 text-blue-900">ChatBoxxer</h2>
            <p className="text-blue-700">Select a chat or create a group to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'chatWindow' && auth.accessToken && auth.userId && chat.targetId && chat.targetName && chat.chatType) {
    return (
      <div className="flex h-screen">
        {/* Chat list - visible only on desktop */}
        <div className="hidden md:block w-96 border-r">
          <ChatList
            accessToken={auth.accessToken}
            userId={auth.userId}
            userName={auth.userName}
            isAdmin={auth.isAdmin}
            onSelectChat={handleSelectChat}
            onOpenAdmin={handleOpenAdmin}
            onOpenSettings={handleOpenSettings}
            onLogout={handleLogout}
          />
        </div>

        {/* Chat window */}
        <div className="flex-1">
          <ChatWindow
            accessToken={auth.accessToken}
            userId={auth.userId}
            targetId={chat.targetId}
            targetName={chat.targetName}
            chatType={chat.chatType}
            onBack={handleBackToList}
          />
        </div>
      </div>
    );
  }

  return null;
}
