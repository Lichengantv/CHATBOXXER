import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { ArrowLeft, Users, MessageSquare, Shield, Trash2, UserX, UsersRound, BarChart3 } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSignIn: string;
  isAdmin: boolean;
}

interface Group {
  id: string;
  name: string;
  memberCount: number;
  createdBy: string;
  createdAt: number;
  messageCount: number;
}

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalGroups: number;
  directMessages: number;
  groupMessages: number;
}

interface AdminPanelProps {
  accessToken: string;
  onBack: () => void;
}

export function AdminPanel({ accessToken, onBack }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'user' | 'group' } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadGroups(), loadStats()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/users`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/groups`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/stats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/user/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        await loadAdminData();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('An error occurred while deleting user');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/admin/group/${groupId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.ok) {
        await loadAdminData();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete group');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
      alert('An error occurred while deleting group');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (id: string, name: string, type: 'user' | 'group') => {
    setDeleteTarget({ id, name, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'user') {
      handleDeleteUser(deleteTarget.id);
    } else {
      handleDeleteGroup(deleteTarget.id);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-blue-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-blue-500"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="text-white">Admin Panel</h1>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="groups">
              <UsersRound className="w-4 h-4 mr-2" />
              Groups
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Total Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-blue-600">{stats?.totalUsers || 0}</div>
                  <p className="text-gray-500">Registered accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Total Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-blue-600">{stats?.totalMessages || 0}</div>
                  <p className="text-gray-500">
                    {stats?.directMessages || 0} DMs, {stats?.groupMessages || 0} in groups
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Total Groups</CardTitle>
                  <UsersRound className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-blue-600">{stats?.totalGroups || 0}</div>
                  <p className="text-gray-500">Active group chats</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => loadAdminData()}
                >
                  Refresh Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage all registered users ({users.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {users.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar>
                            <AvatarFallback className={user.isAdmin ? 'bg-blue-600 text-white' : ''}>
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{user.name}</span>
                              {user.isAdmin && (
                                <Badge variant="default" className="bg-blue-600">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <div className="text-gray-500 truncate">{user.email}</div>
                            <div className="text-gray-400">
                              Joined: {formatDate(user.createdAt)}
                            </div>
                            {user.lastSignIn && (
                              <div className="text-gray-400">
                                Last active: {formatDate(user.lastSignIn)}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={user.isAdmin}
                          onClick={() => openDeleteDialog(user.id, user.name, 'user')}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle>Group Management</CardTitle>
                <CardDescription>
                  Manage all group chats ({groups.length} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {groups.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No groups created yet</p>
                    ) : (
                      groups.map(group => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar>
                              <AvatarFallback className="bg-blue-500 text-white">
                                <UsersRound className="w-5 h-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div>{group.name}</div>
                              <div className="text-gray-500">
                                {group.memberCount} members · {group.messageCount} messages
                              </div>
                              <div className="text-gray-400">
                                Created by {group.createdBy} on {formatDate(new Date(group.createdAt).toISOString())}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(group.id, group.name, 'group')}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.type === 'user' ? 'the user' : 'the group'} "{deleteTarget?.name}" 
              {deleteTarget?.type === 'user' 
                ? ' and all their messages, group memberships, and conversations. This action cannot be undone.'
                : ' and all its messages. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
