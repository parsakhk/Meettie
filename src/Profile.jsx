import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Profile.css';

function Profile({ user, isOwner = true }) {
  const [profileData, setProfileData] = useState({
    profilePicture: '',
    fullName: user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : 'Jane Doe',
    bio: 'Software Engineer passionate about React and design.',
    currentlyWorkingIn: 'Tech Corp',
    accountCreationDate: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Sep 1, 2026',
    tags: ['React', 'Design', 'Development']
  });

  const [businesses, setBusinesses] = useState([
    {
      id: 1,
      name: 'Tech Corp Consultation',
      description: 'Book a 1-on-1 consultation for software architecture and React development.',
      slug: 'tech-corp-consultation'
    },
    {
      id: 2,
      name: 'Design Reviews',
      description: 'UI/UX design review sessions. Get feedback on your web and mobile apps.',
      slug: 'design-reviews'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState({ ...profileData });

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
    setEditData((prev) => ({ ...prev, tags: value.split(',').map(tag => tag.trim()) }));
  };

  // If this is the logged-in user's profile and they are not logged in, prompt them.
  // Note: For public viewer profiles in the future, this check will change.
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
                {profileData.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwner && (
              <button className="upload-picture-btn" aria-label="Upload picture">
                +
              </button>
            )}
          </div>
        </div>

        {/* User Info Fields */}
        <div className="profile-info">
          <div className="profile-field">
            <h2 className="profile-name">{profileData.fullName}</h2>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>
          
          <div className="profile-field">
            <p className="profile-bio">{profileData.bio}</p>
            {isOwner && (
              <button className="edit-icon-btn" onClick={handleEditClick} aria-label="Edit details">
                ✎
              </button>
            )}
          </div>

          <div className="profile-field">
            <p className="profile-work"><strong>Currently working in:</strong> {profileData.currentlyWorkingIn}</p>
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
              {profileData.tags.map((tag, idx) => (
                <span key={idx} className="profile-tag">{tag}</span>
              ))}
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
            <button className="primary-button create-calendar-btn">
              + Create Calendar
            </button>
          )}
        </div>
        
        <div className="businesses-grid">
          {businesses.map((business) => (
            <div key={business.id} className="business-card">
              <div className="business-card-info">
                <h3>{business.name}</h3>
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

      {/* Edit Modal */}
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
    </div>
  );
}

export default Profile;
