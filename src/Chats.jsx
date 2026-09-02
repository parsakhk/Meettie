import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Profile.css';

function Chats({ user }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatRooms();
    
    // Subscribe to chat rooms changes
    const roomsChannel = supabase.channel('chat_rooms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        fetchChatRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, [user]);

  useEffect(() => {
    if (roomId) {
      const room = chatRooms.find(r => r.id === roomId);
      if (room) {
        setActiveRoom(room);
        fetchMessages(roomId);
        
        // Mark unread messages as read
        markMessagesAsRead(roomId);
      }
    } else {
      setActiveRoom(null);
      setMessages([]);
    }
  }, [roomId, chatRooms]);

  useEffect(() => {
    if (activeRoom) {
      const msgsChannel = supabase.channel(`messages_${activeRoom.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${activeRoom.id}` }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          if (payload.new.sender_id !== user.id) {
            markMessagesAsRead(activeRoom.id);
          }
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(msgsChannel);
      };
    }
  }, [activeRoom, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChatRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          id, status, initiator_id, receiver_id, updated_at
        `)
        .or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // We need to fetch the profiles for the other user manually because Supabase auth.users can't be directly joined easily unless we use profiles.
      // Assuming 'initiator_id' and 'receiver_id' match 'id' in 'profiles'
      const otherUserIds = data.map(r => r.initiator_id === user.id ? r.receiver_id : r.initiator_id);
      
      if (otherUserIds.length === 0) {
        setChatRooms([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherUserIds);

      const profileMap = {};
      profiles?.forEach(p => profileMap[p.id] = p);

      const enhancedRooms = data.map(r => {
        const otherUserId = r.initiator_id === user.id ? r.receiver_id : r.initiator_id;
        return {
          ...r,
          otherUser: profileMap[otherUserId]
        };
      });

      setChatRooms(enhancedRooms);
    } catch (err) {
      console.error("Error fetching chat rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (currentRoomId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_room_id', currentRoomId)
      .order('created_at', { ascending: true });
      
    if (!error) {
      setMessages(data || []);
    }
  };

  const markMessagesAsRead = async (currentRoomId) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('chat_room_id', currentRoomId)
      .eq('is_read', false)
      .neq('sender_id', user.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || activeRoom.status !== 'accepted') return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      await supabase
        .from('messages')
        .insert({
          chat_room_id: activeRoom.id,
          sender_id: user.id,
          content: content
        });
        
      await supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeRoom.id);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      await supabase
        .from('chat_rooms')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', activeRoom.id);
      
      setActiveRoom(prev => ({ ...prev, status: 'accepted' }));
    } catch (err) {
      console.error("Error accepting request", err);
    }
  };

  const handleDeclineRequest = async () => {
    try {
      await supabase
        .from('chat_rooms')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', activeRoom.id);
        
      navigate('/chats');
    } catch (err) {
      console.error("Error declining request", err);
    }
  };

  if (loading) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Loading chats...</div>;

  return (
    <div className="profile-page-container" style={{ height: 'calc(100vh - 150px)', overflow: 'hidden', paddingBottom: 0 }}>
      {/* Sidebar: Chat List */}
      <div className="profile-sidebar" style={{ overflowY: 'auto', padding: '1rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Chats</h2>
        {chatRooms.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No active chats or requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {chatRooms.filter(r => r.status !== 'rejected').map(room => {
              const isPending = room.status === 'pending';
              const isActionRequired = isPending && room.receiver_id === user.id;
              
              return (
                <Link 
                  key={room.id}
                  to={`/chats/${room.id}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    background: activeRoom?.id === room.id ? 'var(--hover-bg)' : 'transparent',
                    textDecoration: 'none',
                    color: 'var(--text)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {room.otherUser?.avatar_url ? (
                    <img src={room.otherUser.avatar_url} alt={room.otherUser.username} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {room.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      @{room.otherUser?.username || 'Unknown'}
                    </div>
                    {isPending ? (
                      <div style={{ fontSize: '0.75rem', color: isActionRequired ? '#ef4444' : 'var(--text-muted)' }}>
                        {isActionRequired ? 'New Request' : 'Pending...'}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Accepted
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Area: Chat Window */}
      <div className="profile-main-content" style={{ display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', overflow: 'hidden' }}>
        {!activeRoom ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Select a chat or start a new conversation.
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg)', zIndex: 10 }}>
              {activeRoom.otherUser?.avatar_url ? (
                <img src={activeRoom.otherUser.avatar_url} alt={activeRoom.otherUser.username} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {activeRoom.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <h3 style={{ margin: 0 }}>@{activeRoom.otherUser?.username}</h3>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeRoom.status === 'pending' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-muted)' }}>
                  {activeRoom.receiver_id === user.id ? (
                    <>
                      <p>@{activeRoom.otherUser?.username} wants to send you a message.</p>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handleDeclineRequest} className="login-button" style={{ color: '#ef4444', borderColor: '#ef4444' }}>Decline</button>
                        <button onClick={handleAcceptRequest} className="primary-button">Accept Request</button>
                      </div>
                    </>
                  ) : (
                    <p>Waiting for @{activeRoom.otherUser?.username} to accept your request...</p>
                  )}
                </div>
              ) : (
                <>
                  {messages.map(msg => {
                    const isMine = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ 
                          background: isMine ? 'var(--primary)' : 'var(--hover-bg)', 
                          color: isMine ? 'var(--primary-text)' : 'var(--text)', 
                          padding: '0.75rem 1rem', 
                          borderRadius: '16px',
                          borderBottomRightRadius: isMine ? '4px' : '16px',
                          borderBottomLeftRadius: !isMine ? '4px' : '16px',
                          wordBreak: 'break-word'
                        }}>
                          {msg.content}
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            {activeRoom.status === 'accepted' && (
              <form onSubmit={handleSendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', background: 'var(--bg)' }}>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message... (emojis allowed 😊)"
                  className="auth-input"
                  style={{ margin: 0, flex: 1, borderRadius: '20px' }}
                />
                <button type="submit" className="primary-button" style={{ borderRadius: '20px', padding: '0 1.5rem' }} disabled={!newMessage.trim()}>
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Chats;
