import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Profile.css';

function Profile({ user }) {
  const { username } = useParams();
  const isOwner = user?.user_metadata?.username === username;
  
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(null);
  const [profileData, setProfileData] = useState({
    profilePicture: '',
    fullName: '',
    bio: '',
    currentlyWorkingIn: '',
    accountCreationDate: '',
    tags: []
  });

  const [businesses, setBusinesses] = useState([]);

  // Profile Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({ ...profileData });

  // Create/Edit Calendar Modal
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isEditingCalendar, setIsEditingCalendar] = useState(false);
  const [calendarForm, setCalendarForm] = useState({
    id: null,
    name: '',
    calendarId: '', // the slug
    description: '',
    tags: '',
    isPrivate: false,
    allowedUsernames: ''
  });

  useEffect(() => {
    if (username) {
      fetchProfileAndCalendars();
    }
  }, [username, user]);

  const fetchProfileAndCalendars = async () => {
    try {
      setLoading(true);
      // Fetch Profile by username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profileError || !profile) {
        setLoading(false);
        return;
      }

      setProfileId(profile.id);

      const creationDate = profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : '';
      
      let fullName = '';
      if (isOwner && user) {
        fullName = user.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : '';
      }

      setProfileData({
        profilePicture: profile.avatar_url || '',
        fullName: fullName,
        bio: profile.bio || '',
        currentlyWorkingIn: profile.currently_working_in || '',
        accountCreationDate: creationDate,
        tags: profile.tags || []
      });

      // Fetch Calendars and their likes
      const { data: cals } = await supabase
        .from('calendars')
        .select('*, calendar_likes(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (cals) {
        // Map the likes array to just useful properties for the frontend
        const enrichedCals = cals.map(cal => ({
          ...cal,
          likesCount: cal.calendar_likes ? cal.calendar_likes.length : 0,
          hasLiked: user ? (cal.calendar_likes || []).some(like => like.user_id === user.id) : false,
          ownerAvatar: profile.avatar_url || '' // For the avatar stack
        }));
        setBusinesses(enrichedCals);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Profile Actions
  const handleEditClick = () => {
    if (!isOwner) return;
    setEditData({ ...profileData });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username,
          bio: editData.bio,
          currently_working_in: editData.currentlyWorkingIn,
          tags: editData.tags
        });

      if (error) throw error;
      setProfileData(editData);
      setIsModalOpen(false);
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e) => {
    const value = e.target.value;
    const cleanedTags = value.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean);
    setEditData((prev) => ({ ...prev, tags: cleanedTags }));
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicURL = data.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username,
          avatar_url: publicURL
        });
        
      if (updateError) throw updateError;

      setProfileData(prev => ({ ...prev, profilePicture: publicURL }));

    } catch (err) {
      alert('Error uploading image: ' + err.message);
    }
  };

  // Calendar Actions
  const openCreateCalendar = () => {
    setIsEditingCalendar(false);
    setCalendarForm({ id: null, name: '', calendarId: '', description: '', tags: '', isPrivate: false, allowedUsernames: '' });
    setIsCalendarModalOpen(true);
  };

  const openEditCalendar = async (cal) => {
    // Fetch current access if private
    let accessString = '';
    if (cal.is_private) {
      const { data: accessData } = await supabase
        .from('calendar_access')
        .select('username')
        .eq('calendar_id', cal.id);
      if (accessData) {
        accessString = accessData.map(a => a.username).join(', ');
      }
    }

    setCalendarForm({
      id: cal.id,
      name: cal.name,
      calendarId: cal.slug,
      description: cal.description,
      tags: cal.tags ? cal.tags.join(', ') : '',
      isPrivate: cal.is_private,
      allowedUsernames: accessString
    });
    setIsEditingCalendar(true);
    setIsCalendarModalOpen(true);
  };

  const deleteCalendar = async (calId) => {
    if (!window.confirm("Are you sure you want to delete this calendar?")) return;
    try {
      const { error } = await supabase.from('calendars').delete().eq('id', calId);
      if (error) throw error;
      setBusinesses(prev => prev.filter(c => c.id !== calId));
    } catch (err) {
      alert("Error deleting calendar: " + err.message);
    }
  };

  const toggleStar = async (cal) => {
    if (!user) {
      alert("You must be logged in to like a calendar.");
      return;
    }
    if (isOwner) return; // Owner can't like their own

    try {
      if (cal.hasLiked) {
        // Unlike
        await supabase.from('calendar_likes').delete().eq('user_id', user.id).eq('calendar_id', cal.id);
        setBusinesses(prev => prev.map(c => c.id === cal.id ? { ...c, hasLiked: false, likesCount: c.likesCount - 1 } : c));
      } else {
        // Like
        await supabase.from('calendar_likes').insert({ user_id: user.id, calendar_id: cal.id });
        setBusinesses(prev => prev.map(c => c.id === cal.id ? { ...c, hasLiked: true, likesCount: c.likesCount + 1 } : c));
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handleCalendarSave = async (e) => {
    e.preventDefault();

    let allowedUsers = [];
    if (calendarForm.isPrivate && calendarForm.allowedUsernames) {
      const users = calendarForm.allowedUsernames.split(',').map(u => u.trim()).filter(Boolean);
      const invalidUsers = users.filter(u => !u.startsWith('@'));
      if (invalidUsers.length > 0) {
        alert("All allowed usernames must start with '@' (e.g., @johndoe).");
        return;
      }
      allowedUsers = users;
    }

    const cleanedTags = calendarForm.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    const slug = calendarForm.calendarId.toLowerCase().replace(/\s+/g, '-');

    try {
      let savedCalId = null;

      if (isEditingCalendar) {
        // Update
        const { data, error } = await supabase
          .from('calendars')
          .update({
            name: calendarForm.name,
            description: calendarForm.description,
            slug: slug,
            tags: cleanedTags,
            is_private: calendarForm.isPrivate
          })
          .eq('id', calendarForm.id)
          .select()
          .single();
        
        if (error) throw error;
        savedCalId = data.id;

        // Re-sync access: delete old, insert new
        await supabase.from('calendar_access').delete().eq('calendar_id', savedCalId);

        setBusinesses(prev => prev.map(c => c.id === savedCalId ? { 
          ...c, 
          name: data.name, 
          description: data.description, 
          slug: data.slug, 
          tags: data.tags, 
          is_private: data.is_private 
        } : c));

      } else {
        // Insert
        const { data, error } = await supabase
          .from('calendars')
          .insert([{
            user_id: user.id,
            name: calendarForm.name,
            description: calendarForm.description,
            slug: slug,
            tags: cleanedTags,
            is_private: calendarForm.isPrivate
          }])
          .select()
          .single();

        if (error) throw error;
        savedCalId = data.id;

        const newBiz = {
          ...data,
          likesCount: 0,
          hasLiked: false,
          ownerAvatar: profileData.profilePicture
        };
        setBusinesses([newBiz, ...businesses]);
      }

      // Handle Private Users (both for create and update)
      if (calendarForm.isPrivate && allowedUsers.length > 0) {
        const accessRows = allowedUsers.map(un => ({
          calendar_id: savedCalId,
          username: un
        }));
        await supabase.from('calendar_access').insert(accessRows);
      }

      setIsCalendarModalOpen(false);
    } catch (err) {
      alert('Error saving calendar: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Loading profile...</div>;
  if (!profileId) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Profile not found.</div>;

  return (
    <div className="profile-page-container">
      {/* Left Narrow Card */}
      <div className="profile-sidebar">
        {/* Profile Picture */}
        <div className="profile-picture-container">
          <div className="profile-picture">
            {profileData.profilePicture ? (
              <img src={profileData.profilePicture} alt="Profile" />
            ) : (
              <div className="profile-picture-placeholder">
                {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button 
                className="upload-picture-btn" 
                aria-label="Upload picture"
                onClick={() => document.getElementById('profile-pic-upload').click()}
              >
                +
              </button>
              <input 
                type="file" 
                id="profile-pic-upload" 
                style={{ display: 'none' }} 
                accept="image/*" 
                onChange={handleProfilePicUpload} 
              />
            </>
          )}
        </div>
        
        <div className="profile-username" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', marginTop: '-1rem', fontWeight: 500 }}>
          @{username}
        </div>

        {/* User Info Fields */}
        <div className="profile-info">
          <div className="profile-field">
            <h2 className="profile-name">
              {profileData.fullName || <span className="placeholder-text">Name not set</span>}
            </h2>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>
          
          <div className="profile-field">
            <p className="profile-bio">
              {profileData.bio || <span className="placeholder-text">No bio provided.</span>}
            </p>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>

          <div className="profile-field">
            <p className="profile-work">
              <strong>Currently working in:</strong><br/>
              {profileData.currentlyWorkingIn || <span className="placeholder-text">Not specified</span>}
            </p>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>

          {profileData.accountCreationDate && (
            <div className="profile-field-static">
              <p className="profile-date"><strong>Joined:</strong> {profileData.accountCreationDate}</p>
            </div>
          )}

          <div className="profile-field">
            <div className="profile-tags">
              {profileData.tags && profileData.tags.length > 0 ? profileData.tags.map((tag, idx) => (
                <span key={idx} className="profile-tag">#{tag}</span>
              )) : <span className="placeholder-text">No tags</span>}
            </div>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Big Option Area */}
      <div className="profile-main-content">
        <div className="businesses-header">
          <h2>Businesses & Calendars</h2>
          {isOwner && (
            <button 
              className="primary-button create-calendar-btn"
              onClick={openCreateCalendar}
            >
              + Create Calendar
            </button>
          )}
        </div>
        
        <div className="businesses-grid">
          {businesses.map((business) => (
            <div key={business.id} className="business-card">
              <div className="business-card-info" style={{ marginBottom: '1rem' }}>
                <h3 style={{ paddingRight: 0 }}>
                  {business.name}
                  {business.is_private && <span className="private-badge">Private</span>}
                </h3>
                
                {business.tags && business.tags.length > 0 && (
                  <div className="calendar-tags">
                    {business.tags.map((tag, idx) => (
                      <span key={idx} className="calendar-tag">#{tag}</span>
                    ))}
                  </div>
                )}
                
                <p>{business.description}</p>
              </div>

              <div className="calendar-buttons-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                <Link to={`/calendar/${business.slug}`} className="primary-button visit-business-btn" style={{ marginTop: 0 }}>
                  Go to Page
                </Link>
                
                {isOwner && (
                  <>
                    <button className="login-button visit-business-btn" style={{ marginTop: 0 }} onClick={() => openEditCalendar(business)}>
                      Edit Calendar
                    </button>
                    <button className="login-button visit-business-btn" style={{ marginTop: 0, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => deleteCalendar(business.id)}>
                      Delete Calendar
                    </button>
                  </>
                )}
              </div>

              <div className="calendar-footer" style={{ marginTop: 'auto' }}>
                <div className="avatar-stack">
                  {business.ownerAvatar ? (
                    <img src={business.ownerAvatar} alt="Owner" className="avatar-mini" />
                  ) : (
                    <div className="avatar-mini">{username.charAt(0).toUpperCase()}</div>
                  )}
                  {/* Future: map over other allowed users here */}
                </div>

                <div className="calendar-stars">
                  {!isOwner && (
                    <button 
                      className={`star-btn ${business.hasLiked ? 'liked' : ''}`} 
                      onClick={() => toggleStar(business)}
                      title={business.hasLiked ? 'Unlike' : 'Like'}
                    >
                      {business.hasLiked ? '★' : '☆'}
                    </button>
                  )}
                  {isOwner && <span style={{fontSize: '1.2rem', color: '#f59e0b'}}>★</span>}
                  <span>{business.likesCount}</span>
                </div>
              </div>
            </div>
          ))}
          {businesses.length === 0 && (
            <div className="empty-businesses">
              <p>No calendars available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isModalOpen && isOwner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Profile</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Full Name (Change in settings)</label>
                <input 
                  type="text" 
                  value={editData.fullName} 
                  disabled
                  className="auth-input" 
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea 
                  name="bio" 
                  value={editData.bio} 
                  onChange={handleChange} 
                  className="auth-input"
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Currently working in</label>
                <input 
                  type="text" 
                  name="currentlyWorkingIn" 
                  value={editData.currentlyWorkingIn} 
                  onChange={handleChange} 
                  className="auth-input" 
                />
              </div>
              <div className="form-group">
                <label>Tags (comma separated, no # needed)</label>
                <input 
                  type="text" 
                  name="tags" 
                  value={editData.tags.join(', ')} 
                  onChange={handleTagsChange} 
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

      {/* Create/Edit Calendar Modal */}
      {isCalendarModalOpen && isOwner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{isEditingCalendar ? 'Edit Calendar' : 'Create New Calendar'}</h3>
            <form onSubmit={handleCalendarSave}>
              <div className="form-group">
                <label>Calendar Name (Business Name)</label>
                <input 
                  type="text" 
                  value={calendarForm.name} 
                  onChange={(e) => setCalendarForm({...calendarForm, name: e.target.value})} 
                  className="auth-input" 
                  required
                />
              </div>
              <div className="form-group">
                <label>Calendar ID (Used for links, e.g. /calendar/my-id)</label>
                <input 
                  type="text" 
                  value={calendarForm.calendarId} 
                  onChange={(e) => setCalendarForm({...calendarForm, calendarId: e.target.value})} 
                  className="auth-input" 
                  placeholder="my-business-calendar"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={calendarForm.description} 
                  onChange={(e) => setCalendarForm({...calendarForm, description: e.target.value})} 
                  className="auth-input"
                  rows="3"
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Tags (comma separated, no # needed)</label>
                <input 
                  type="text" 
                  value={calendarForm.tags} 
                  onChange={(e) => setCalendarForm({...calendarForm, tags: e.target.value})} 
                  className="auth-input" 
                  placeholder="e.g. Consultation, Remote"
                />
              </div>
              
              <div className="form-group checkbox-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="isPrivate"
                  checked={calendarForm.isPrivate} 
                  onChange={(e) => setCalendarForm({...calendarForm, isPrivate: e.target.checked})} 
                />
                <label htmlFor="isPrivate" style={{ margin: 0, cursor: 'pointer' }}>Make this calendar private</label>
              </div>
              
              {calendarForm.isPrivate && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Allowed Usernames (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. @johndoe, @janedoe"
                    value={calendarForm.allowedUsernames} 
                    onChange={(e) => setCalendarForm({...calendarForm, allowedUsernames: e.target.value})} 
                    className="auth-input" 
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Only these users will be able to access this calendar. Must start with '@'.</small>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="login-button" onClick={() => setIsCalendarModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button">{isEditingCalendar ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
