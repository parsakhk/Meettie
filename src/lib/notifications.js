import { supabase } from './supabase';

/**
 * Creates a notification in the notifications table if it exists.
 * Gracefully ignores table missing errors.
 */
export async function createNotification({ userId, type, title, message, link, referenceId }) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link,
      reference_id: referenceId
    });
    if (error && error.code !== 'PGRST205') {
      console.warn('Failed to insert notification:', error.message);
    }
  } catch (err) {
    // Ignore schema cache / table missing errors gracefully
    console.warn('Notification insert error:', err);
  }
}

/**
 * Fetches the total count of unread items:
 * - Pending appointment requests on user's calendars (as owner)
 * - Pending direct chat requests (as receiver)
 * - Unread direct chat messages
 */
export async function getUnreadCounts(userId) {
  if (!userId) return { total: 0, appointments: 0, chats: 0 };

  try {
    // 1. Get calendars owned by this user
    const { data: ownedCals } = await supabase
      .from('calendars')
      .select('id')
      .eq('user_id', userId);

    const ownedCalIds = (ownedCals || []).map(c => c.id);

    // 2. Count pending appointments on owned calendars
    let pendingApptsCount = 0;
    if (ownedCalIds.length > 0) {
      const { data: pendingAppts, error: apptErr } = await supabase
        .from('appointments')
        .select('id')
        .in('calendar_id', ownedCalIds)
        .eq('status', 'pending');

      if (!apptErr && pendingAppts) {
        pendingApptsCount = pendingAppts.length;
      }
    }

    // 3. Count chat requests and unread messages
    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('id, status, receiver_id')
      .or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`);

    let pendingChatCount = 0;
    let unreadMsgCount = 0;

    if (rooms && rooms.length > 0) {
      pendingChatCount = rooms.filter(r => r.status === 'pending' && r.receiver_id === userId).length;

      const roomIds = rooms.map(r => r.id);
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .in('chat_room_id', roomIds)
        .eq('is_read', false)
        .neq('sender_id', userId);

      if (msgs) {
        unreadMsgCount = msgs.length;
      }
    }

    const chatsTotal = pendingChatCount + unreadMsgCount;
    const total = pendingApptsCount + chatsTotal;

    return {
      total,
      appointments: pendingApptsCount,
      chats: chatsTotal,
      unreadMessages: unreadMsgCount,
      pendingChats: pendingChatCount
    };
  } catch (err) {
    console.error('Error calculating unread counts:', err);
    return { total: 0, appointments: 0, chats: 0 };
  }
}
