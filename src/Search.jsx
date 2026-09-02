import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import './Profile.css'; // Reuse business-card styles

function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [users, setUsers] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;

    const performSearch = async () => {
      setLoading(true);
      setUsers([]);
      setCalendars([]);

      let q = query.trim();

      try {
        if (q.startsWith('@')) {
          // Search users
          const usernameQuery = q.substring(1);
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('username', `%${usernameQuery}%`);
          if (data) setUsers(data);
        } else if (q.startsWith('#') || q.endsWith('#')) {
          // Search calendar by slug/id
          let slugQuery = q.startsWith('#') ? q.substring(1) : q.slice(0, -1);
          const { data } = await supabase
            .from('calendars')
            .select('*')
            .ilike('slug', `%${slugQuery}%`)
            .eq('is_private', false);
          if (data) setCalendars(data);
        } else {
          // Search calendar by name
          const { data } = await supabase
            .from('calendars')
            .select('*')
            .ilike('name', `%${q}%`)
            .eq('is_private', false);
          if (data) setCalendars(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query]);

  return (
    <div style={{ padding: '6rem 2rem', minHeight: 'calc(100vh - 160px)', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Search Results for "{query}"</h1>
      {loading && <p>Loading...</p>}
      
      {!loading && users.length === 0 && calendars.length === 0 && query && (
        <p>No results found.</p>
      )}

      {!loading && users.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Users</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map(user => (
              <Link to={`/profile/${user.username}`} key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', textDecoration: 'none', color: 'var(--text)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', overflow: 'hidden' }}>
                  {user.avatar_url ? <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>@{user.username}</h3>
                  {user.currently_working_in && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user.currently_working_in}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && calendars.length > 0 && (
        <div>
          <h2>Calendars</h2>
          <div className="businesses-grid">
            {calendars.map(cal => (
              <div key={cal.id} className="business-card">
                <div className="business-card-info" style={{ marginBottom: '1rem' }}>
                  <h3>{cal.name}</h3>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    ID: {cal.slug}
                  </div>
                  {cal.tags && cal.tags.length > 0 && (
                    <div className="calendar-tags">
                      {cal.tags.map((tag, idx) => (
                        <span key={idx} className="calendar-tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <p>{cal.description}</p>
                </div>
                <div style={{ marginTop: 'auto' }}>
                  <Link to={`/calendar/${cal.slug}`} className="primary-button visit-business-btn" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', display: 'block' }}>
                    Go to Page
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Search;
