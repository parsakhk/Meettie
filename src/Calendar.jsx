import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Profile.css';

function Calendar({ user }) {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [owner, setOwner] = useState(null);
  const [admins, setAdmins] = useState([]);
  
  // Edit Calendar Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '', tags: '' });
  
  useEffect(() => {
    if (slug) {
      fetchCalendarDetails();
    }
  }, [slug]);

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

  const isOwner = user && calendarData && user.id === calendarData.user_id;

  const handleEditClick = () => {
    if (!isOwner) return;
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
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

  if (loading) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Loading calendar...</div>;
  if (!calendarData) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Calendar not found.</div>;

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
        <div className="businesses-header">
          <h2>Calendar Events</h2>
          {isOwner && (
            <button className="primary-button create-calendar-btn">
              + New Event
            </button>
          )}
        </div>
        
        <div className="businesses-grid">
          <div className="empty-businesses">
            <p>No events scheduled yet.</p>
          </div>
        </div>
      </div>

      {/* Edit Calendar Modal */}
      {isModalOpen && isOwner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Calendar Info</h3>
            <form onSubmit={handleSave}>
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
