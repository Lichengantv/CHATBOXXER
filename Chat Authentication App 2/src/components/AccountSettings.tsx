import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { ArrowLeft, User, Lock, AlertTriangle, Check, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface AccountSettingsProps {
  accessToken: string;
  userId: string;
  userName: string;
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  onNameUpdate: (newName: string) => void;
}

export function AccountSettings({ 
  accessToken, 
  userId, 
  userName, 
  userEmail,
  onBack, 
  onLogout,
  onNameUpdate 
}: AccountSettingsProps) {
  // Profile state
  const [name, setName] = useState(userName);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name || name.trim().length === 0) {
      toast.error('Name cannot be empty');
      return;
    }

    if (name.trim() === userName) {
      toast.error('Name is unchanged');
      return;
    }

    setUpdatingProfile(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/user/profile`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: name.trim() })
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Profile updated successfully');
        onNameUpdate(data.name);
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('An error occurred while updating profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/user/password`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ currentPassword, newPassword })
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      toast.error('An error occurred while changing password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Password is required to delete account');
      return;
    }

    setDeletingAccount(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b85e5461/user/account`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: deletePassword })
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Account deleted successfully');
        setDeleteDialogOpen(false);
        // Wait a moment then logout
        setTimeout(() => {
          onLogout();
        }, 1000);
      } else {
        toast.error(data.error || 'Failed to delete account');
        setDeletingAccount(false);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('An error occurred while deleting account');
      setDeletingAccount(false);
    }
  };

  const passwordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'text-red-600' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'text-yellow-600' };
    if (strength <= 4) return { strength, label: 'Good', color: 'text-blue-600' };
    return { strength, label: 'Strong', color: 'text-green-600' };
  };

  const newPasswordStrength = passwordStrength(newPassword);

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
        <div>
          <h1 className="text-white">Account Settings</h1>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="account">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Account
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={userEmail}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-gray-500">Email cannot be changed</p>
                  </div>

                  <Button
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile || name.trim() === userName}
                    className="w-full"
                  >
                    {updatingProfile ? 'Updating...' : 'Update Profile'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    {newPassword && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              newPasswordStrength.strength <= 2
                                ? 'bg-red-600'
                                : newPasswordStrength.strength <= 3
                                ? 'bg-yellow-600'
                                : newPasswordStrength.strength <= 4
                                ? 'bg-blue-600'
                                : 'bg-green-600'
                            }`}
                            style={{ width: `${(newPasswordStrength.strength / 5) * 100}%` }}
                          />
                        </div>
                        <span className={`${newPasswordStrength.color}`}>
                          {newPasswordStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    {confirmPassword && (
                      <div className="flex items-center gap-2">
                        {newPassword === confirmPassword ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">Passwords match</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 text-red-600" />
                            <span className="text-red-600">Passwords do not match</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {changingPassword ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account">
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-red-900 mb-1">Delete Account</h3>
                        <p className="text-red-700 mb-3">
                          Once you delete your account, there is no going back. This will permanently delete:
                        </p>
                        <ul className="text-red-700 list-disc list-inside space-y-1 mb-4">
                          <li>Your profile and account data</li>
                          <li>All your messages (DMs and group chats)</li>
                          <li>Your group memberships</li>
                          <li>All conversations</li>
                        </ul>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          Delete My Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="deletePassword">Enter your password to confirm</Label>
            <Input
              id="deletePassword"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deletingAccount}
              onClick={() => {
                setDeletePassword('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount || !deletePassword}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingAccount ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
