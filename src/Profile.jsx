import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Profile.css';

function Profile({ user, isOwner = true }) {
  const [profileData, setProfileData] = useState({
    profilePicture: '',
    fullName: user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : '',
    bio: '',
    currentlyWorkingIn: '',
    accountCreationDate: user?.created_at ? new Date(user.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
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

  const handleEditClick = () => {
    if (!isOwner) return;
    setEditData({ ...profileData });
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setProfileData(editData);
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e) => {
    const value = e.target.value;
    setEditData((prev) => ({ ...prev, tags: value.split(',').map(tag => tag.trim()).filter(Boolean) }));
  };

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileData(prev => ({ ...prev, profilePicture: imageUrl }));
    }
  };

  const handleCreateCalendarSave = (e) => {
    e.preventDefault();
    const newBiz = {
      id: Date.now(),
      name: newCalendar.name,
      description: newCalendar.description,
      slug: newCalendar.name.toLowerCase().replace(/\s+/g, '-'),
      isPrivate: newCalendar.isPrivate,
      allowedUsernames: newCalendar.isPrivate ? newCalendar.allowedUsernames.split(',').map(u => u.trim()).filter(Boolean) : []
    };
    setBusinesses([...businesses, newBiz]);
    setIsCreateModalOpen(false);
    setNewCalendar({ name: '', description: '', isPrivate: false, allowedUsernames: '' });
  };

  if (!user && isOwner) return <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>Please log in to view this page.</div>;

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
                {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : 'U'}
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

          <div className="profile-field-static">
            <p className="profile-date"><strong>Joined:</strong> {profileData.accountCreationDate}</p>
          </div>

          <div className="profile-field">
            <div className="profile-tags">
              {profileData.tags.length > 0 ? profileData.tags.map((tag, idx) => (
                <span key={idx} className="profile-tag">{tag}</span>
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
                  {business.isPrivate && <span className="private-badge">Private</span>}
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
                <label>Full Name</label>
                <input 
                  type="text" 
                  name="fullName" 
                  value={editData.fullName} 
                  onChange={handleChange} 
                  className="auth-input" 
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
                <label>Tags (comma separated)</label>
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
                    placeholder="e.g. johndoe, janedoe"
                    value={newCalendar.allowedUsernames} 
                    onChange={(e) => setNewCalendar({...newCalendar, allowedUsernames: e.target.value})} 
                    className="auth-input" 
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Only these users will be able to access this calendar.</small>
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
