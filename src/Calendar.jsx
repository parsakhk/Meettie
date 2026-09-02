import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Profile.css';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function AvailabilityModal({ isOpen, onClose, initialAvailability, onSave }) {
  const [offDays, setOffDays] = useState(initialAvailability?.offDays || []);
  const [hours, setHours] = useState(initialAvailability?.hours || []);

  if (!isOpen) return null;

  const toggleOffDay = (dayIndex) => {
    if (offDays.includes(dayIndex)) {
      setOffDays(offDays.filter(d => d !== dayIndex));
    } else {
      setOffDays([...offDays, dayIndex]);
    }
  };

  const addHourRule = (type) => {
    setHours([...hours, { type, start: '09:00', end: '17:00', reason: '' }]);
  };

  const updateHourRule = (index, field, value) => {
    const newHours = [...hours];
    newHours[index][field] = value;
    setHours(newHours);
  };

  const removeHourRule = (index) => {
    setHours(hours.filter((_, i) => i !== index));
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ offDays, hours });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>Set Calendar Availability</h3>
        <form onSubmit={handleSave}>
          
          <div className="form-group">
            <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>Off Days (Entire day unselectable)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {DAYS_OF_WEEK.map((day, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={offDays.includes(idx)} 
                    onChange={() => toggleOffDay(idx)} 
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Specific Hours</label>
              <div>
                <button type="button" onClick={() => addHourRule('best')} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} className="login-button">
                  + Add Best Hours
                </button>
                <button type="button" onClick={() => addHourRule('off')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} className="login-button">
                  + Add Off Hours
                </button>
              </div>
            </div>
            
            {hours.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No specific hour rules set.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {hours.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.75rem', background: 'var(--bg)', borderRadius: '4px', border: `1px solid ${rule.type === 'best' ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.75rem', color: rule.type === 'best' ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                          {rule.type}
                        </span>
                        <input type="time" value={rule.start} onChange={(e) => updateHourRule(idx, 'start', e.target.value)} className="auth-input" style={{ padding: '0.25rem', width: 'auto' }} required />
                        <span>to</span>
                        <input type="time" value={rule.end} onChange={(e) => updateHourRule(idx, 'end', e.target.value)} className="auth-input" style={{ padding: '0.25rem', width: 'auto' }} required />
                      </div>
                      <input 
                        type="text" 
                        placeholder={rule.type === 'best' ? "Reason (e.g., Deep Work Focus)" : "Reason (e.g., Lunch Break)"} 
                        value={rule.reason} 
                        onChange={(e) => updateHourRule(idx, 'reason', e.target.value)} 
                        className="auth-input"
                        style={{ padding: '0.25rem 0.5rem' }}
                      />
                    </div>
                    <button type="button" onClick={() => removeHourRule(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} aria-label="Remove Rule">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: '2rem' }}>
            <button type="button" className="login-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Publish</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Calendar({ user }) {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [owner, setOwner] = useState(null);
  const [admins, setAdmins] = useState([]);
  
  // Edit Calendar Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '', tags: '' });
  
  // Availability Modal
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);

  // Appoint Modal
  const [isAppointOpen, setIsAppointOpen] = useState(false);
  const [appointForm, setAppointForm] = useState({ title: '', description: '', isPrivate: false, time: '10:00' });
  const [isAppointing, setIsAppointing] = useState(false);

  // Calendar Grid State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  
  useEffect(() => {
    if (slug) {
      fetchCalendarDetails();
    }
  }, [slug]);

  useEffect(() => {
    if (calendarData) {
      fetchAppointments(selectedDate, calendarData, admins);
    }
  }, [selectedDate, calendarData, admins, user]);

  const fetchCalendarDetails = async () => {
    try {
      setLoading(true);
      // Fetch calendar by slug
      const { data: calData, error: calError } = await supabase
        .from('calendars')
        .select('*')
        .eq('slug', slug)
        .single();
        
      if (calError || !calData) {
        setLoading(false);
        return;
      }
      
      // Ensure availability has a default shape
      if (!calData.availability) {
        calData.availability = { offDays: [], hours: [] };
      }

      setCalendarData(calData);
      setEditData({
        name: calData.name,
        description: calData.description || '',
        tags: calData.tags ? calData.tags.join(', ') : ''
      });

      // Fetch owner profile
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', calData.user_id)
        .single();
        
      if (ownerProfile) {
        setOwner(ownerProfile);
      }

      // Fetch admins
      const { data: accessList } = await supabase
        .from('calendar_access')
        .select('username')
        .eq('calendar_id', calData.id);
        
      if (accessList && accessList.length > 0) {
        const usernames = accessList.map(a => a.username.replace('@', ''));
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('username', usernames);
          
        if (adminProfiles) {
          setAdmins(adminProfiles);
        }
      }
    } catch (error) {
      console.error('Error fetching calendar details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async (date, calData, currentAdmins) => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23,59,59,999);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('calendar_id', calData.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });
        
      if (error) {
        // If table doesn't exist yet, just return empty array
        setAppointments([]);
        return;
      }

      const isCurrentOwner = user && user.id === calData.user_id;
      const isCurrentAdmin = user && currentAdmins.some(a => a.username === user.user_metadata?.username); // admins state holds profiles which have .username

      const visibleAppts = (data || []).filter(appt => {
        if (!appt.is_private) return true;
        if (isCurrentOwner || isCurrentAdmin) return true;
        if (user && appt.user_id === user.id) return true;
        return false;
      });

      setAppointments(visibleAppts);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    }
  };

  const isOwner = user && calendarData && user.id === calendarData.user_id;

  const handleEditClick = () => {
    if (!isOwner) return;
    setIsModalOpen(true);
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    
    try {
      const cleanedTags = editData.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      
      const { error } = await supabase
        .from('calendars')
        .update({
          name: editData.name,
          description: editData.description,
          tags: cleanedTags
        })
        .eq('id', calendarData.id);
        
      if (error) throw error;
      
      setCalendarData(prev => ({
        ...prev,
        name: editData.name,
        description: editData.description,
        tags: cleanedTags
      }));
      setIsModalOpen(false);
    } catch (err) {
      alert('Error updating calendar: ' + err.message);
    }
  };

  const handleSaveAvailability = async (newAvailability) => {
    try {
      const { error } = await supabase
        .from('calendars')
        .update({ availability: newAvailability })
        .eq('id', calendarData.id);
        
      if (error) throw error;
      
      setCalendarData(prev => ({ ...prev, availability: newAvailability }));
      setIsAvailabilityOpen(false);
    } catch (err) {
      alert('Error saving availability: ' + err.message);
    }
  };

  const handleCalendarPicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${calendarData.id}-${Math.random()}.${fileExt}`;
      const filePath = `calendars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicURL = data.publicUrl;

      const { error: updateError } = await supabase
        .from('calendars')
        .update({ avatar_url: publicURL })
        .eq('id', calendarData.id);
        
      if (updateError) throw updateError;

      setCalendarData(prev => ({ ...prev, avatar_url: publicURL }));

    } catch (err) {
      alert('Error uploading image: ' + err.message);
    }
  };

  const handleRemoveAdmin = async (adminUsername) => {
    if (!isOwner) return;
    if (!window.confirm(`Are you sure you want to remove @${adminUsername} as admin?`)) return;
    
    try {
      const { error } = await supabase
        .from('calendar_access')
        .delete()
        .eq('calendar_id', calendarData.id)
        .eq('username', '@' + adminUsername);
        
      if (error) throw error;
      
      setAdmins(prev => prev.filter(a => a.username !== adminUsername));
    } catch (err) {
      alert('Error removing admin: ' + err.message);
    }
  };

  const handleAppointSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to make an appointment.");
      return;
    }

    setIsAppointing(true);
    try {
      // Build proper start and end time from the selected date and chosen time
      const [hours, minutes] = appointForm.time.split(':');
      const startTime = new Date(selectedDate);
      startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      
      // Default duration is 1 hour
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);

      const { error } = await supabase
        .from('appointments')
        .insert({
          calendar_id: calendarData.id,
          user_id: user.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'pending',
          notes: JSON.stringify({
            title: appointForm.title,
            description: appointForm.description,
          }),
          is_private: appointForm.isPrivate
        });
        
      if (error) throw error;

      alert('Appointment request submitted successfully!');
      setIsAppointOpen(false);
      setAppointForm({ title: '', description: '', isPrivate: false, time: '10:00' });
      fetchAppointments(selectedDate, calendarData, admins);
    } catch (err) {
      alert('Error creating appointment (Make sure appointments table exists!): ' + err.message);
    } finally {
      setIsAppointing(false);
    }
  };

  // Calendar Grid Logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const renderCalendarGrid = () => {
    if (!calendarData) return null;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const offDays = calendarData.availability?.offDays || [];
    
    const days = [];
    // Empty slots before 1st of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }
    
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayOfWeek = date.getDay();
      const isOffDay = offDays.includes(dayOfWeek);
      const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isPast = date < new Date(new Date().setHours(0,0,0,0));

      let className = "cal-day";
      if (isSelected) className += " selected";
      if (isOffDay || isPast) className += " disabled";

      days.push(
        <div 
          key={i} 
          className={className}
          onClick={() => {
            if (!isOffDay && !isPast) {
              setSelectedDate(date);
            }
          }}
        >
          {i}
        </div>
      );
    }

    return days;
  };

  if (loading) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Loading calendar...</div>;
  if (!calendarData) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Calendar not found.</div>;

  const isCurrentAdmin = user && admins.some(a => a.username === user.user_metadata?.username);

  return (
    <div className="profile-page-container">
      {/* Left Narrow Card */}
      <div className="profile-sidebar">
        {/* Calendar Picture */}
        <div className="profile-picture-container">
          <div className="profile-picture">
            {calendarData.avatar_url ? (
              <img src={calendarData.avatar_url} alt="Calendar" />
            ) : (
              <div className="profile-picture-placeholder">
                {calendarData.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button 
                className="upload-picture-btn" 
                aria-label="Upload picture"
                onClick={() => document.getElementById('calendar-pic-upload').click()}
              >
                +
              </button>
              <input 
                type="file" 
                id="calendar-pic-upload" 
                style={{ display: 'none' }} 
                accept="image/*" 
                onChange={handleCalendarPicUpload} 
              />
            </>
          )}
        </div>
        
        <div className="profile-info">
          <div className="profile-field">
            <h2 className="profile-name" style={{ textAlign: 'center', width: '100%', marginBottom: '1rem' }}>
              {calendarData.name}
            </h2>
            {isOwner && (
              <button className="edit-icon-btn" style={{ position: 'absolute', right: 0, top: 0 }} onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>

          {calendarData.description && (
            <div className="profile-field-static" style={{ marginBottom: '1rem' }}>
              <p>{calendarData.description}</p>
            </div>
          )}

          {calendarData.tags && calendarData.tags.length > 0 && (
            <div className="profile-field-static">
              <div className="profile-tags" style={{ justifyContent: 'center' }}>
                {calendarData.tags.map((tag, idx) => (
                  <span key={idx} className="profile-tag">#{tag}</span>
                ))}
              </div>
            </div>
          )}
          
          {/* Team Section */}
          <div className="profile-field-static" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Team</h3>
            
            {/* Owner */}
            {owner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Link to={`/profile/${owner.username}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                  {owner.avatar_url ? (
                    <img src={owner.avatar_url} alt={owner.username} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 'bold' }}>
                      {owner.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>@{owner.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Owner</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Admins */}
            {admins.map(admin => (
              <div key={admin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <Link to={`/profile/${admin.username}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                  {admin.avatar_url ? (
                    <img src={admin.avatar_url} alt={admin.username} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 'bold' }}>
                      {admin.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>@{admin.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admin</div>
                  </div>
                </Link>
                {isOwner && (
                  <button 
                    onClick={() => handleRemoveAdmin(admin.username)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem' }}
                    title="Remove Admin"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Big Option Area */}
      <div className="profile-main-content">
        <div className="businesses-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2>Book an Appointment</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Select a date and time to meet with {calendarData.name}</p>
          </div>
          {isOwner && (
            <button className="primary-button create-calendar-btn" onClick={() => setIsAvailabilityOpen(true)}>
              Set Availability
            </button>
          )}
        </div>
        
        {/* Interactive Calendar Grid */}
        <div className="calendar-grid-container" style={{ marginTop: '2rem', background: 'var(--bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div className="cal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={prevMonth} className="login-button" style={{ padding: '0.5rem 1rem' }}>&larr; Prev</button>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} className="login-button" style={{ padding: '0.5rem 1rem' }}>Next &rarr;</button>
          </div>
          
          <div className="cal-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>
          
          <div className="cal-days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {renderCalendarGrid()}
          </div>
          
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
             <button 
                className="primary-button" 
                style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '1.1rem' }}
                onClick={() => {
                   if (!user) { alert("You must be logged in to make an appointment."); return; }
                   setIsAppointOpen(true);
                }}
             >
               Appoint
             </button>
          </div>
        </div>

        {/* Appointments Section */}
        <div className="appointments-section" style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            Appointments on {selectedDate.toLocaleDateString()}
          </h3>
          
          {appointments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appointments.map((appt, idx) => {
                let parsedNotes = { title: 'Appointment', description: '' };
                try {
                  parsedNotes = JSON.parse(appt.notes);
                } catch(e) {}
                const timeStr = new Date(appt.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                return (
                  <div key={idx} style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{parsedNotes.title}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{timeStr} • {parsedNotes.description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {appt.is_private && (
                        <span style={{ fontSize: '0.75rem', background: 'var(--hover-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>Private</span>
                      )}
                      {(isOwner || isCurrentAdmin) && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: appt.status === 'pending' ? '#f59e0b' : '#3b82f6', textTransform: 'uppercase' }}>
                          {appt.status}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No appointments scheduled for this day.</p>
          )}
        </div>
      </div>

      {/* Appoint Modal */}
      {isAppointOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Make an Appointment</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              For {selectedDate.toLocaleDateString()}
            </p>
            <form onSubmit={handleAppointSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  value={appointForm.title} 
                  onChange={e => setAppointForm({...appointForm, title: e.target.value})}
                  className="auth-input" 
                  placeholder="e.g. Initial Consultation"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={appointForm.description} 
                  onChange={e => setAppointForm({...appointForm, description: e.target.value})}
                  className="auth-input"
                  rows="3"
                  placeholder="Briefly describe what you'd like to discuss."
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Time</label>
                <input 
                  type="time" 
                  value={appointForm.time} 
                  onChange={e => setAppointForm({...appointForm, time: e.target.value})}
                  className="auth-input" 
                  required
                />
              </div>
              <div className="form-group checkbox-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="isPrivateAppointment"
                  checked={appointForm.isPrivate} 
                  onChange={(e) => setAppointForm({...appointForm, isPrivate: e.target.checked})} 
                />
                <label htmlFor="isPrivateAppointment" style={{ margin: 0, cursor: 'pointer' }}>Make this appointment private</label>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Private appointments will not be visible to other users viewing this calendar.
              </p>
              
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="login-button" onClick={() => setIsAppointOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={isAppointing}>
                  {isAppointing ? 'Sending...' : 'Request Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      <AvailabilityModal 
        isOpen={isAvailabilityOpen} 
        onClose={() => setIsAvailabilityOpen(false)} 
        initialAvailability={calendarData.availability}
        onSave={handleSaveAvailability}
      />

      {/* Edit Calendar Modal */}
      {isModalOpen && isOwner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Calendar Info</h3>
            <form onSubmit={handleSaveInfo}>
              <div className="form-group">
                <label>Calendar Name</label>
                <input 
                  type="text" 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="auth-input" 
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={editData.description} 
                  onChange={e => setEditData({...editData, description: e.target.value})}
                  className="auth-input"
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={editData.tags} 
                  onChange={e => setEditData({...editData, tags: e.target.value})}
                  className="auth-input" 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="login-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
