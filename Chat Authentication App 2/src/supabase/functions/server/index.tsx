import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Admin email list
const ADMIN_EMAILS = ['lichengantv@gmail.com'];

// Helper function to check if user is admin
const isAdmin = (email: string) => {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// Sign up route
app.post('/make-server-b85e5461/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name
    });

    return c.json({ 
      success: true,
      user: {
        id: data.user.id,
        email,
        name
      }
    });
  } catch (error) {
    console.log(`Server error during signup: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Password reset request
app.post('/make-server-b85e5461/reset-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      console.log(`Error sending password reset email: ${error.message}`);
      // Don't reveal if email exists or not for security
      return c.json({ success: true, message: 'If an account exists, a password reset email has been sent' });
    }

    return c.json({ 
      success: true,
      message: 'If an account exists, a password reset email has been sent'
    });
  } catch (error) {
    console.log(`Server error during password reset: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all users (for contacts list)
app.get('/make-server-b85e5461/users', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all users from KV store
    const allUsers = await kv.getByPrefix('user:');
    const users = allUsers
      .filter(u => u.id !== user.id) // Exclude current user
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email
      }));

    return c.json({ users });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create a group
app.post('/make-server-b85e5461/create-group', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, memberIds } = await c.req.json();

    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return c.json({ error: 'Group name and members are required' }, 400);
    }

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Include creator in members
    const allMemberIds = [user.id, ...memberIds.filter(id => id !== user.id)];

    const group = {
      id: groupId,
      name,
      memberIds: allMemberIds,
      createdBy: user.id,
      createdAt: timestamp
    };

    // Store group
    await kv.set(`group:${groupId}`, group);

    // Add group to each member's group list
    for (const memberId of allMemberIds) {
      const memberGroupsKey = `user_groups:${memberId}`;
      const memberGroups = await kv.get(memberGroupsKey) || { groupIds: [] };
      
      if (!memberGroups.groupIds.includes(groupId)) {
        memberGroups.groupIds.push(groupId);
        await kv.set(memberGroupsKey, memberGroups);
      }
    }

    return c.json({ success: true, group });
  } catch (error) {
    console.log(`Error creating group: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Send a message (DM or group)
app.post('/make-server-b85e5461/send-message', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { toUserId, groupId, text } = await c.req.json();

    if ((!toUserId && !groupId) || !text) {
      return c.json({ error: 'Recipient/group and message text are required' }, 400);
    }

    const timestamp = Date.now();
    const messageId = `${user.id}:${groupId || toUserId}:${timestamp}`;
    
    const message = {
      id: messageId,
      fromUserId: user.id,
      toUserId: toUserId || null,
      groupId: groupId || null,
      text,
      timestamp
    };

    // Store message
    await kv.set(`message:${messageId}`, message);

    // Update conversations
    if (groupId) {
      // Group message - no need to update conversations as groups are separate
    } else {
      // Direct message
      const senderConvKey = `conversations:${user.id}`;
      const receiverConvKey = `conversations:${toUserId}`;

      const senderConv = await kv.get(senderConvKey) || { userIds: [] };
      const receiverConv = await kv.get(receiverConvKey) || { userIds: [] };

      if (!senderConv.userIds.includes(toUserId)) {
        senderConv.userIds.push(toUserId);
        await kv.set(senderConvKey, senderConv);
      }

      if (!receiverConv.userIds.includes(user.id)) {
        receiverConv.userIds.push(user.id);
        await kv.set(receiverConvKey, receiverConv);
      }
    }

    return c.json({ success: true, message });
  } catch (error) {
    console.log(`Error sending message: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get messages (DM or group)
app.get('/make-server-b85e5461/messages/:targetId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const targetId = c.req.param('targetId');
    const isGroup = targetId.startsWith('group_');

    // Get all messages
    const allMessages = await kv.getByPrefix('message:');

    let messages;
    if (isGroup) {
      // Filter group messages
      messages = allMessages
        .filter(m => m.groupId === targetId)
        .sort((a, b) => a.timestamp - b.timestamp);
    } else {
      // Filter DMs between the two users
      messages = allMessages
        .filter(m => 
          (m.fromUserId === user.id && m.toUserId === targetId) ||
          (m.fromUserId === targetId && m.toUserId === user.id)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
    }

    return c.json({ messages });
  } catch (error) {
    console.log(`Error fetching messages: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get conversations and groups
app.get('/make-server-b85e5461/conversations', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get DM conversations
    const convData = await kv.get(`conversations:${user.id}`);
    const userIds = convData?.userIds || [];

    const conversations = [];
    
    // Get DM conversations
    for (const userId of userIds) {
      const userData = await kv.get(`user:${userId}`);
      if (userData) {
        const allMessages = await kv.getByPrefix('message:');
        const userMessages = allMessages
          .filter(m => 
            (m.fromUserId === user.id && m.toUserId === userId) ||
            (m.fromUserId === userId && m.toUserId === user.id)
          )
          .sort((a, b) => b.timestamp - a.timestamp);

        const latestMessage = userMessages[0];

        conversations.push({
          id: userId,
          type: 'dm',
          name: userData.name,
          email: userData.email,
          latestMessage: latestMessage?.text || '',
          timestamp: latestMessage?.timestamp || 0
        });
      }
    }

    // Get group conversations
    const userGroupsData = await kv.get(`user_groups:${user.id}`);
    const groupIds = userGroupsData?.groupIds || [];

    for (const groupId of groupIds) {
      const groupData = await kv.get(`group:${groupId}`);
      if (groupData) {
        const allMessages = await kv.getByPrefix('message:');
        const groupMessages = allMessages
          .filter(m => m.groupId === groupId)
          .sort((a, b) => b.timestamp - a.timestamp);

        const latestMessage = groupMessages[0];

        conversations.push({
          id: groupId,
          type: 'group',
          name: groupData.name,
          memberCount: groupData.memberIds.length,
          latestMessage: latestMessage?.text || '',
          timestamp: latestMessage?.timestamp || 0
        });
      }
    }

    // Sort by latest message
    conversations.sort((a, b) => b.timestamp - a.timestamp);

    return c.json({ conversations });
  } catch (error) {
    console.log(`Error fetching conversations: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user info (for displaying message sender names in groups)
app.get('/make-server-b85e5461/user/:userId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    const userData = await kv.get(`user:${userId}`);

    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: userData });
  } catch (error) {
    console.log(`Error fetching user: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ADMIN ROUTES

// Check if current user is admin
app.get('/make-server-b85e5461/admin/check', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json({ isAdmin: isAdmin(user.email || '') });
  } catch (error) {
    console.log(`Error checking admin status: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all users (admin only)
app.get('/make-server-b85e5461/admin/users', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id || !isAdmin(user.email || '')) {
      return c.json({ error: 'Unauthorized - Admin only' }, 403);
    }

    // Get all users from KV store
    const allUsers = await kv.getByPrefix('user:');
    
    // Get all auth users for additional info
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    
    const usersWithDetails = allUsers.map(u => {
      const authUser = authUsers?.users.find(au => au.id === u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: authUser?.created_at,
        lastSignIn: authUser?.last_sign_in_at,
        isAdmin: isAdmin(u.email)
      };
    });

    return c.json({ users: usersWithDetails });
  } catch (error) {
    console.log(`Error fetching admin users: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete user (admin only)
app.delete('/make-server-b85e5461/admin/user/:userId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id || !isAdmin(user.email || '')) {
      return c.json({ error: 'Unauthorized - Admin only' }, 403);
    }

    const userIdToDelete = c.req.param('userId');

    // Prevent admin from deleting themselves
    if (userIdToDelete === user.id) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    // Get user data before deletion
    const userData = await kv.get(`user:${userIdToDelete}`);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Prevent deleting other admins
    if (isAdmin(userData.email)) {
      return c.json({ error: 'Cannot delete another admin account' }, 400);
    }

    // Delete from Supabase Auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userIdToDelete);
    
    if (deleteError) {
      console.log(`Error deleting user from auth: ${deleteError.message}`);
      return c.json({ error: deleteError.message }, 400);
    }

    // Delete user profile from KV
    await kv.del(`user:${userIdToDelete}`);

    // Delete user's conversations
    await kv.del(`conversations:${userIdToDelete}`);

    // Delete user's group memberships
    await kv.del(`user_groups:${userIdToDelete}`);

    // Remove user from all groups they were in
    const allGroups = await kv.getByPrefix('group:');
    for (const group of allGroups) {
      if (group.memberIds.includes(userIdToDelete)) {
        group.memberIds = group.memberIds.filter(id => id !== userIdToDelete);
        await kv.set(`group:${group.id}`, group);
      }
    }

    // Delete all messages from/to this user
    const allMessages = await kv.getByPrefix('message:');
    for (const message of allMessages) {
      if (message.fromUserId === userIdToDelete || message.toUserId === userIdToDelete) {
        await kv.del(`message:${message.id}`);
      }
    }

    return c.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.log(`Error deleting user: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get system statistics (admin only)
app.get('/make-server-b85e5461/admin/stats', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id || !isAdmin(user.email || '')) {
      return c.json({ error: 'Unauthorized - Admin only' }, 403);
    }

    const allUsers = await kv.getByPrefix('user:');
    const allMessages = await kv.getByPrefix('message:');
    const allGroups = await kv.getByPrefix('group:');

    const stats = {
      totalUsers: allUsers.length,
      totalMessages: allMessages.length,
      totalGroups: allGroups.length,
      directMessages: allMessages.filter(m => m.toUserId).length,
      groupMessages: allMessages.filter(m => m.groupId).length
    };

    return c.json({ stats });
  } catch (error) {
    console.log(`Error fetching admin stats: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all groups (admin only)
app.get('/make-server-b85e5461/admin/groups', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id || !isAdmin(user.email || '')) {
      return c.json({ error: 'Unauthorized - Admin only' }, 403);
    }

    const allGroups = await kv.getByPrefix('group:');
    
    const groupsWithDetails = await Promise.all(allGroups.map(async (group) => {
      const creatorData = await kv.get(`user:${group.createdBy}`);
      const allMessages = await kv.getByPrefix('message:');
      const groupMessages = allMessages.filter(m => m.groupId === group.id);
      
      return {
        id: group.id,
        name: group.name,
        memberCount: group.memberIds.length,
        createdBy: creatorData?.name || 'Unknown',
        createdAt: group.createdAt,
        messageCount: groupMessages.length
      };
    }));

    return c.json({ groups: groupsWithDetails });
  } catch (error) {
    console.log(`Error fetching admin groups: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete group (admin only)
app.delete('/make-server-b85e5461/admin/group/:groupId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id || !isAdmin(user.email || '')) {
      return c.json({ error: 'Unauthorized - Admin only' }, 403);
    }

    const groupId = c.req.param('groupId');
    const groupData = await kv.get(`group:${groupId}`);

    if (!groupData) {
      return c.json({ error: 'Group not found' }, 404);
    }

    // Delete group
    await kv.del(`group:${groupId}`);

    // Remove group from all members' group lists
    for (const memberId of groupData.memberIds) {
      const memberGroupsKey = `user_groups:${memberId}`;
      const memberGroups = await kv.get(memberGroupsKey);
      if (memberGroups) {
        memberGroups.groupIds = memberGroups.groupIds.filter(id => id !== groupId);
        await kv.set(memberGroupsKey, memberGroups);
      }
    }

    // Delete all group messages
    const allMessages = await kv.getByPrefix('message:');
    for (const message of allMessages) {
      if (message.groupId === groupId) {
        await kv.del(`message:${message.id}`);
      }
    }

    return c.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.log(`Error deleting group: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// USER SETTINGS ROUTES

// Update user profile (name)
app.put('/make-server-b85e5461/user/profile', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name } = await c.req.json();

    if (!name || name.trim().length === 0) {
      return c.json({ error: 'Name is required' }, 400);
    }

    // Update user metadata in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { user_metadata: { name: name.trim() } }
    );

    if (updateError) {
      console.log(`Error updating user metadata: ${updateError.message}`);
      return c.json({ error: updateError.message }, 400);
    }

    // Update user profile in KV store
    const userData = await kv.get(`user:${user.id}`);
    if (userData) {
      userData.name = name.trim();
      await kv.set(`user:${user.id}`, userData);
    }

    return c.json({ success: true, message: 'Profile updated successfully', name: name.trim() });
  } catch (error) {
    console.log(`Error updating profile: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Change password
app.put('/make-server-b85e5461/user/password', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400);
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (signInError) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.log(`Error updating password: ${updateError.message}`);
      return c.json({ error: updateError.message }, 400);
    }

    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.log(`Error changing password: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete own account
app.delete('/make-server-b85e5461/user/account', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { password } = await c.req.json();

    if (!password) {
      return c.json({ error: 'Password is required to delete account' }, 400);
    }

    // Verify password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    });

    if (signInError) {
      return c.json({ error: 'Password is incorrect' }, 400);
    }

    // Get user data before deletion
    const userData = await kv.get(`user:${user.id}`);

    // Delete from Supabase Auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.log(`Error deleting user from auth: ${deleteError.message}`);
      return c.json({ error: deleteError.message }, 400);
    }

    // Delete user profile from KV
    await kv.del(`user:${user.id}`);

    // Delete user's conversations
    await kv.del(`conversations:${user.id}`);

    // Delete user's group memberships
    await kv.del(`user_groups:${user.id}`);

    // Remove user from all groups they were in
    const allGroups = await kv.getByPrefix('group:');
    for (const group of allGroups) {
      if (group.memberIds.includes(user.id)) {
        group.memberIds = group.memberIds.filter(id => id !== user.id);
        await kv.set(`group:${group.id}`, group);
      }
    }

    // Delete all messages from/to this user
    const allMessages = await kv.getByPrefix('message:');
    for (const message of allMessages) {
      if (message.fromUserId === user.id || message.toUserId === user.id) {
        await kv.del(`message:${message.id}`);
      }
    }

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.log(`Error deleting account: ${error}`);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);
