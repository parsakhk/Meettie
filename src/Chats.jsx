import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { createNotification } from './lib/notifications';
import './Profile.css';

function Chats({ user }) {
  const { roomId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab State: 'chats' or 'appointments'
  const activeTab = searchParams.get('tab') === 'appointments' ? 'appointments' : 'chats';
  const setActiveTab = (tab) => {
    if (tab === 'appointments') {
      setSearchParams({ tab: 'appointments' });
    } else {
      setSearchParams({});
    }
  };

  // Chats state
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Appointments state
  const [appointments, setAppointments] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState('received'); // 'received' | 'sent'
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch initial data & set up real-time listeners
  useEffect(() => {
    if (!user) return;
    fetchChatRooms();
    fetchAppointments();

    const roomsChannel = supabase.channel('chat_rooms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        fetchChatRooms();
      })
      .subscribe();

    const apptsChannel = supabase.channel('appointments_chat_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(apptsChannel);
    };
  }, [user]);

  // Handle active chat room selection
  useEffect(() => {
    if (roomId && activeTab === 'chats') {
      const room = chatRooms.find(r => r.id === roomId);
      if (room) {
        setActiveRoom(room);
        fetchMessages(roomId);
        markMessagesAsRead(roomId);
      }
    } else if (!roomId && activeTab === 'chats') {
      setActiveRoom(null);
      setMessages([]);
    }
  }, [roomId, chatRooms, activeTab]);

  // Handle real-time messages
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // Chat Room Operations
  // ----------------------------------------------------
  const fetchChatRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('id, status, initiator_id, receiver_id, updated_at')
        .or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const otherUserIds = (data || []).map(r => r.initiator_id === user.id ? r.receiver_id : r.initiator_id).filter(Boolean);

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
      profiles?.forEach(p => { profileMap[p.id] = p; });

      const enhancedRooms = data.map(r => {
        const otherUserId = r.initiator_id === user.id ? r.receiver_id : r.initiator_id;
        return {
          ...r,
          otherUser: profileMap[otherUserId]
        };
      });

      setChatRooms(enhancedRooms);
    } catch (err) {
      console.error('Error fetching chat rooms:', err);
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
      console.error('Error sending message:', err);
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
      console.error('Error accepting request', err);
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
      console.error('Error declining request', err);
    }
  };

  // ----------------------------------------------------
  // Appointment Operations
  // ----------------------------------------------------
  const fetchAppointments = async () => {
    try {
      setApptsLoading(true);

      // 1. Fetch calendars owned by user
      const { data: ownedCals } = await supabase
        .from('calendars')
        .select('id, name, slug, user_id')
        .eq('user_id', user.id);

      const ownedCalMap = {};
      const ownedCalIds = [];
      (ownedCals || []).forEach(c => {
        ownedCalMap[c.id] = c;
        ownedCalIds.push(c.id);
      });

      // 2. Fetch appointments where user is requester OR calendar is owned by user
      let apptsQuery = supabase.from('appointments').select('*');
      if (ownedCalIds.length > 0) {
        apptsQuery = apptsQuery.or(`user_id.eq.${user.id},calendar_id.in.(${ownedCalIds.join(',')})`);
      } else {
        apptsQuery = apptsQuery.eq('user_id', user.id);
      }

      const { data: apptRows, error: apptErr } = await apptsQuery.order('created_at', { ascending: false });
      if (apptErr) throw apptErr;

      const allAppts = apptRows || [];

      // 3. For any calendars not in ownedCalMap, fetch them
      const missingCalIds = allAppts
        .map(a => a.calendar_id)
        .filter(id => !ownedCalMap[id]);

      if (missingCalIds.length > 0) {
        const { data: otherCals } = await supabase
          .from('calendars')
          .select('id, name, slug, user_id')
          .in('id', [...new Set(missingCalIds)]);

        otherCals?.forEach(c => { ownedCalMap[c.id] = c; });
      }

      // 4. Fetch profiles for all requesters and owners involved
      const involvedUserIds = new Set();
      allAppts.forEach(a => {
        if (a.user_id) involvedUserIds.add(a.user_id);
        const cal = ownedCalMap[a.calendar_id];
        if (cal?.user_id) involvedUserIds.add(cal.user_id);
      });

      let profileMap = {};
      if (involvedUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .in('id', [...involvedUserIds]);

        profiles?.forEach(p => { profileMap[p.id] = p; });
      }

      // 5. Structure enhanced appointments
      const enhanced = allAppts.map(a => {
        let parsedNotes = { title: 'Appointment', description: '' };
        try {
          parsedNotes = JSON.parse(a.notes);
        } catch (e) {
          parsedNotes = { title: a.notes || 'Appointment', description: '' };
        }

        const cal = ownedCalMap[a.calendar_id] || { name: 'Unknown Calendar', slug: '', user_id: '' };
        const isReceived = cal.user_id === user.id;

        return {
          ...a,
          notesData: parsedNotes,
          calendar: cal,
          isReceived: isReceived,
          requester: profileMap[a.user_id] || null,
          owner: profileMap[cal.user_id] || null
        };
      });

      setAppointments(enhanced);

      // Keep selected appointment in sync
      if (selectedAppt) {
        const updatedSelected = enhanced.find(a => a.id === selectedAppt.id);
        if (updatedSelected) {
          setSelectedAppt(updatedSelected);
        }
      }
    } catch (err) {
      console.error('Error fetching appointments for chats page:', err);
    } finally {
      setApptsLoading(false);
    }
  };

  // Filtered appointments
  const receivedAppointments = appointments.filter(a => a.isReceived);
  const sentAppointments = appointments.filter(a => !a.isReceived);
  const pendingReceivedCount = receivedAppointments.filter(a => a.status === 'pending').length;

  const currentAppointmentList = appointmentFilter === 'received' ? receivedAppointments : sentAppointments;

  // Accept Appointment & Start Chat Flow
  const handleAcceptAppointment = async (appt) => {
    setActionLoading(true);
    try {
      // 1. Update appointment status in Supabase
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ status: 'accepted' })
        .eq('id', appt.id);

      if (apptError) throw apptError;

      // 2. Find or create accepted chat room between owner and client
      const ownerId = appt.calendar.user_id;
      const clientId = appt.user_id;

      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(initiator_id.eq.${ownerId},receiver_id.eq.${clientId}),and(initiator_id.eq.${clientId},receiver_id.eq.${ownerId})`);

      let targetRoomId = null;

      if (existingRooms && existingRooms.length > 0) {
        targetRoomId = existingRooms[0].id;
        if (existingRooms[0].status !== 'accepted') {
          await supabase
            .from('chat_rooms')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', targetRoomId);
        }
      } else {
        const { data: newRoom, error: roomError } = await supabase
          .from('chat_rooms')
          .insert({
            initiator_id: ownerId,
            receiver_id: clientId,
            status: 'accepted'
          })
          .select()
          .single();

        if (roomError) throw roomError;
        targetRoomId = newRoom.id;
      }

      // 3. Post confirmation message to begin the chat
      const timeStr = new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(appt.start_time).toLocaleDateString();

      await supabase.from('messages').insert({
        chat_room_id: targetRoomId,
        sender_id: user.id,
        content: `📅 Appointment Confirmed: "${appt.notesData.title}" on ${dateStr} at ${timeStr}. Chat conversation is open!`
      });

      // 4. Create in-app notification for requester
      await createNotification({
        userId: clientId,
        type: 'appointment_accepted',
        title: 'Appointment Request Accepted!',
        message: `@${user.user_metadata?.username || 'Owner'} accepted your appointment for "${appt.notesData.title}" (${appt.calendar.name}).`,
        link: `/chats/${targetRoomId}`,
        referenceId: appt.id
      });

      // 5. Update local state and seamlessly transition directly into the chat!
      await fetchChatRooms();
      await fetchAppointments();

      setActiveTab('chats');
      navigate(`/chats/${targetRoomId}`);
    } catch (err) {
      alert('Error accepting appointment: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Decline Appointment
  const handleDeclineAppointment = async (appt) => {
    if (!window.confirm(`Are you sure you want to decline the appointment "${appt.notesData.title}"?`)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'declined' })
        .eq('id', appt.id);

      if (error) throw error;

      await createNotification({
        userId: appt.user_id,
        type: 'appointment_declined',
        title: 'Appointment Declined',
        message: `Your appointment request "${appt.notesData.title}" for ${appt.calendar.name} was declined.`,
        link: '/chats?tab=appointments',
        referenceId: appt.id
      });

      await fetchAppointments();
    } catch (err) {
      alert('Error declining appointment: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Direct Open Chat between parties
  const handleOpenChatWithUser = async (otherUserId) => {
    try {
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(initiator_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(initiator_id.eq.${otherUserId},receiver_id.eq.${otherUserId})`);

      if (existingRooms && existingRooms.length > 0) {
        setActiveTab('chats');
        navigate(`/chats/${existingRooms[0].id}`);
      } else {
        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert({
            initiator_id: user.id,
            receiver_id: otherUserId,
            status: 'accepted'
          })
          .select()
          .single();

        if (!error && newRoom) {
          await fetchChatRooms();
          setActiveTab('chats');
          navigate(`/chats/${newRoom.id}`);
        }
      }
    } catch (err) {
      console.error('Error opening chat:', err);
    }
  };

  if (loading && activeTab === 'chats') return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Loading chats...</div>;

  return (
    <div className="profile-page-container" style={{ height: 'calc(100vh - 150px)', overflow: 'hidden', paddingBottom: 0 }}>
      {/* Sidebar: Navigation Tabs & List */}
      <div className="profile-sidebar" style={{ overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        {/* Main Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--bg)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('chats')}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'chats' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'chats' ? 'var(--primary-text)' : 'var(--text)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
          >
            💬 Chats
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'appointments' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'appointments' ? 'var(--primary-text)' : 'var(--text)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s',
              position: 'relative'
            }}
          >
            📅 Appointments
            {pendingReceivedCount > 0 && (
              <span style={{
                background: activeTab === 'appointments' ? '#ef4444' : '#ef4444',
                color: 'white',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                marginLeft: '2px'
              }}>
                {pendingReceivedCount}
              </span>
            )}
          </button>
        </div>

        {/* -------------------- TAB 1: DIRECT CHATS -------------------- */}
        {activeTab === 'chats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Conversations</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chatRooms.length}</span>
            </div>

            {chatRooms.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active chats or requests.</p>
            ) : (
              chatRooms.filter(r => r.status !== 'rejected').map(room => {
                const isPending = room.status === 'pending';
                const isActionRequired = isPending && room.receiver_id === user.id;

                return (
                  <Link
                    key={room.id}
                    to={`/chats/${room.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: activeRoom?.id === room.id ? 'var(--hover-bg)' : 'transparent',
                      textDecoration: 'none',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      transition: 'background 0.15s'
                    }}
                  >
                    {room.otherUser?.avatar_url ? (
                      <img src={room.otherUser.avatar_url} alt={room.otherUser.username} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {room.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        @{room.otherUser?.username || 'Unknown'}
                      </div>
                      {isPending ? (
                        <div style={{ fontSize: '0.75rem', color: isActionRequired ? '#ef4444' : 'var(--text-muted)' }}>
                          {isActionRequired ? '• New Request' : 'Waiting...'}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Chat active
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* -------------------- TAB 2: APPOINTMENTS -------------------- */}
        {activeTab === 'appointments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Filter pills: Received vs Sent */}
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => { setAppointmentFilter('received'); setSelectedAppt(null); }}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: appointmentFilter === 'received' ? 'var(--primary)' : 'var(--bg)',
                  color: appointmentFilter === 'received' ? 'var(--primary-text)' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}
              >
                Received
                {pendingReceivedCount > 0 && (
                  <span style={{
                    background: appointmentFilter === 'received' ? 'white' : '#ef4444',
                    color: appointmentFilter === 'received' ? 'var(--primary)' : 'white',
                    borderRadius: '8px',
                    padding: '1px 5px',
                    fontSize: '0.65rem'
                  }}>
                    {pendingReceivedCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setAppointmentFilter('sent'); setSelectedAppt(null); }}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: appointmentFilter === 'sent' ? 'var(--primary)' : 'var(--bg)',
                  color: appointmentFilter === 'sent' ? 'var(--primary-text)' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                My Bookings ({sentAppointments.length})
              </button>
            </div>

            {apptsLoading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading appointments...</p>}

            {!apptsLoading && currentAppointmentList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {appointmentFilter === 'received'
                  ? 'No incoming appointment requests on your calendars.'
                  : 'You have not booked any appointments yet.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentAppointmentList.map(appt => {
                  const isSelected = selectedAppt?.id === appt.id;
                  const dateStr = new Date(appt.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const timeStr = new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  // Status badge styling
                  let statusBg = 'rgba(245, 158, 11, 0.15)';
                  let statusColor = '#f59e0b';
                  if (appt.status === 'accepted') {
                    statusBg = 'rgba(16, 185, 129, 0.15)';
                    statusColor = '#10b981';
                  } else if (appt.status === 'declined') {
                    statusBg = 'rgba(239, 68, 68, 0.15)';
                    statusColor = '#ef4444';
                  }

                  const counterparty = appt.isReceived ? appt.requester : appt.owner;

                  return (
                    <div
                      key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--hover-bg)' : 'transparent',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                          {appt.notesData.title || 'Meeting'}
                        </strong>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: statusColor,
                          background: statusBg,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {appt.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{dateStr} • {timeStr}</span>
                        <span>{appt.calendar.name}</span>
                      </div>

                      <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        {counterparty?.avatar_url ? (
                          <img src={counterparty.avatar_url} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {counterparty?.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <span style={{ color: 'var(--text)' }}>
                          {appt.isReceived ? `From @${counterparty?.username || 'user'}` : `With @${counterparty?.username || 'owner'}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Area: Chat Window OR Appointment Details */}
      <div className="profile-main-content" style={{ display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', overflow: 'hidden' }}>

        {/* -------------------- VIEW A: APPOINTMENT DETAILS -------------------- */}
        {activeTab === 'appointments' ? (
          !selectedAppt ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>📅</div>
              <h3>Appointment Requests</h3>
              <p style={{ maxWidth: '400px', fontSize: '0.9rem' }}>
                Select an appointment request from the sidebar to review details, accept bookings, or initiate chats with clients.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedAppt.notesData.title}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Calendar: <Link to={`/calendar/${selectedAppt.calendar.slug}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{selectedAppt.calendar.name}</Link>
                  </div>
                </div>

                <div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.35rem 0.8rem',
                    borderRadius: '6px',
                    color: selectedAppt.status === 'accepted' ? '#10b981' : selectedAppt.status === 'declined' ? '#ef4444' : '#f59e0b',
                    background: selectedAppt.status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : selectedAppt.status === 'declined' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${selectedAppt.status === 'accepted' ? '#10b981' : selectedAppt.status === 'declined' ? '#ef4444' : '#f59e0b'}`
                  }}>
                    {selectedAppt.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                {/* Counterparty card */}
                <div style={{ padding: '1rem 1.25rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {selectedAppt.isReceived ? (
                      selectedAppt.requester?.avatar_url ? (
                        <img src={selectedAppt.requester.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
                          {selectedAppt.requester?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )
                    ) : (
                      selectedAppt.owner?.avatar_url ? (
                        <img src={selectedAppt.owner.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
                          {selectedAppt.owner?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )
                    )}

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {selectedAppt.isReceived ? 'Client / Requester' : 'Calendar Owner'}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        @{selectedAppt.isReceived ? (selectedAppt.requester?.username || 'unknown') : (selectedAppt.owner?.username || 'owner')}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/profile/${selectedAppt.isReceived ? selectedAppt.requester?.username : selectedAppt.owner?.username}`}
                    className="login-button"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                  >
                    View Profile
                  </Link>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>DATE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {new Date(selectedAppt.start_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>TIME</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {new Date(selectedAppt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedAppt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>VISIBILITY</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {selectedAppt.is_private ? '🔒 Private Booking' : '🌐 Public Booking'}
                    </div>
                  </div>
                </div>

                {/* Description / Notes */}
                <div style={{ padding: '1.25rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>AGENDA / NOTES</div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {selectedAppt.notesData.description || 'No description provided.'}
                  </p>
                </div>

                {/* Action Section */}
                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                  {selectedAppt.isReceived ? (
                    // OWNER ACTIONS
                    selectedAppt.status === 'pending' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          Accepting this request will confirm the schedule and automatically launch a direct chat with @{selectedAppt.requester?.username}.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            onClick={() => handleAcceptAppointment(selectedAppt)}
                            disabled={actionLoading}
                            className="primary-button"
                            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                          >
                            {actionLoading ? 'Accepting...' : '✓ Accept Appointment & Start Chat'}
                          </button>
                          <button
                            onClick={() => handleDeclineAppointment(selectedAppt)}
                            disabled={actionLoading}
                            className="login-button"
                            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', color: '#ef4444', borderColor: '#ef4444' }}
                          >
                            ✕ Decline
                          </button>
                        </div>
                      </div>
                    ) : selectedAppt.status === 'accepted' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <strong style={{ color: '#10b981', display: 'block' }}>✓ Appointment Accepted</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You and the client are connected for this meeting.</span>
                        </div>
                        <button
                          onClick={() => handleOpenChatWithUser(selectedAppt.user_id)}
                          className="primary-button"
                          style={{ padding: '0.6rem 1.5rem' }}
                        >
                          💬 Open Chat with @{selectedAppt.requester?.username}
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                        This appointment request has been declined.
                      </div>
                    )
                  ) : (
                    // CLIENT ACTIONS
                    selectedAppt.status === 'pending' ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        ⏳ Your request has been sent to the owner of {selectedAppt.calendar.name}. You will be notified once they accept it!
                      </div>
                    ) : selectedAppt.status === 'accepted' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <strong style={{ color: '#10b981', display: 'block' }}>🎉 Appointment Confirmed!</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>The owner accepted your appointment. You can now chat anytime.</span>
                        </div>
                        <button
                          onClick={() => handleOpenChatWithUser(selectedAppt.calendar.user_id)}
                          className="primary-button"
                          style={{ padding: '0.6rem 1.5rem' }}
                        >
                          💬 Open Chat with Owner
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                        Your appointment request was declined by the business owner.
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          /* -------------------- VIEW B: DIRECT CHATS WINDOW -------------------- */
          !activeRoom ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Select a chat or start a new conversation.
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg)', zIndex: 10 }}>
                {activeRoom.otherUser?.avatar_url ? (
                  <img src={activeRoom.otherUser.avatar_url} alt={activeRoom.otherUser.username} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {activeRoom.otherUser?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0 }}>@{activeRoom.otherUser?.username}</h3>
                  {activeRoom.otherUser?.bio && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {activeRoom.otherUser.bio}
                    </div>
                  )}
                </div>
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
                      const isAppointmentNotice = msg.content.startsWith('📅');

                      return (
                        <div key={msg.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                          <div style={{
                            background: isAppointmentNotice ? 'var(--hover-bg)' : isMine ? 'var(--primary)' : 'var(--hover-bg)',
                            color: isAppointmentNotice ? 'var(--text)' : isMine ? 'var(--primary-text)' : 'var(--text)',
                            border: isAppointmentNotice ? '1px solid var(--border)' : 'none',
                            padding: '0.75rem 1rem',
                            borderRadius: '16px',
                            borderBottomRightRadius: isMine ? '4px' : '16px',
                            borderBottomLeftRadius: !isMine ? '4px' : '16px',
                            wordBreak: 'break-word',
                            fontSize: '0.95rem'
                          }}>
                            {msg.content}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
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
                    placeholder="Type a message..."
                    className="auth-input"
                    style={{ margin: 0, flex: 1, borderRadius: '20px' }}
                  />
                  <button type="submit" className="primary-button" style={{ borderRadius: '20px', padding: '0 1.5rem' }} disabled={!newMessage.trim()}>
                    Send
                  </button>
                </form>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

export default Chats;
