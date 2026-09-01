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

  // Create Calendar Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCalendar, setNewCalendar] = useState({
    name: '',
    description: '',
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
        console.error("Profile fetch error:", profileError);
        setLoading(false);
        return; // Handle not found gracefully in render
      }

      setProfileId(profile.id);

      // We rely on the profiles table. If we want creation date for viewers, we should add it to profiles DB.
      // For now, if it's the owner, we have it in the session user object.
      let creationDate = '';
      if (isOwner && user?.created_at) {
        creationDate = new Date(user.created_at).toLocaleDateString();
      }

      // We rely on profiles table, but fallback to logged in user if it's the owner
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

      // Fetch Calendars
      const { data: cals } = await supabase
        .from('calendars')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (cals) {
        setBusinesses(cals);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    // Strip # if they typed it, to keep it clean in DB
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

  const handleCreateCalendarSave = async (e) => {
    e.preventDefault();

    let allowedUsers = [];
    if (newCalendar.isPrivate && newCalendar.allowedUsernames) {
      const users = newCalendar.allowedUsernames.split(',').map(u => u.trim()).filter(Boolean);
      // Validate they start with @
      const invalidUsers = users.filter(u => !u.startsWith('@'));
      if (invalidUsers.length > 0) {
        alert("All allowed usernames must start with '@' (e.g., @johndoe).");
        return;
      }
      // Remove @ for db storage if you want, or keep it. We'll keep it as typed.
      allowedUsers = users;
    }

    try {
      const slug = newCalendar.name.toLowerCase().replace(/\s+/g, '-');
      
      const { data: newCal, error } = await supabase
        .from('calendars')
        .insert([{
          user_id: user.id,
          name: newCalendar.name,
          description: newCalendar.description,
          slug: slug,
          is_private: newCalendar.isPrivate
        }])
        .select()
        .single();

      if (error) throw error;

      if (newCalendar.isPrivate && allowedUsers.length > 0) {
        const accessRows = allowedUsers.map(un => ({
          calendar_id: newCal.id,
          username: un // stores with @
        }));
        await supabase.from('calendar_access').insert(accessRows);
      }

      setBusinesses([newCal, ...businesses]);
      setIsCreateModalOpen(false);
      setNewCalendar({ name: '', description: '', isPrivate: false, allowedUsernames: '' });

    } catch (err) {
      alert('Error creating calendar: ' + err.message);
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
        
        {/* Username behind/below pfp */}
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
              onClick={() => setIsCreateModalOpen(true)}
            >
              + Create Calendar
            </button>
          )}
        </div>
        
        <div className="businesses-grid">
          {businesses.map((business) => (
            <div key={business.id} className="business-card">
              <div className="business-card-info">
                <h3>
                  {business.name}
                  {business.is_private && <span className="private-badge">Private</span>}
                </h3>
                <p>{business.description}</p>
              </div>
              <Link to={`/calendar/${business.slug}`} className="login-button visit-business-btn">
                Go to Page
              </Link>
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

      {/* Create Calendar Modal */}
      {isCreateModalOpen && isOwner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Calendar</h3>
            <form onSubmit={handleCreateCalendarSave}>
              <div className="form-group">
                <label>Calendar Name (Business Name)</label>
                <input 
                  type="text" 
                  value={newCalendar.name} 
                  onChange={(e) => setNewCalendar({...newCalendar, name: e.target.value})} 
                  className="auth-input" 
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newCalendar.description} 
                  onChange={(e) => setNewCalendar({...newCalendar, description: e.target.value})} 
                  className="auth-input"
                  rows="3"
                  required
                ></textarea>
              </div>
              <div className="form-group checkbox-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="isPrivate"
                  checked={newCalendar.isPrivate} 
                  onChange={(e) => setNewCalendar({...newCalendar, isPrivate: e.target.checked})} 
                />
                <label htmlFor="isPrivate" style={{ margin: 0, cursor: 'pointer' }}>Make this calendar private</label>
              </div>
              
              {newCalendar.isPrivate && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Allowed Usernames (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. @johndoe, @janedoe"
                    value={newCalendar.allowedUsernames} 
                    onChange={(e) => setNewCalendar({...newCalendar, allowedUsernames: e.target.value})} 
                    className="auth-input" 
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Only these users will be able to access this calendar. Must start with '@'.</small>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="login-button" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
