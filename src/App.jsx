import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import './App.css';
import { supabase } from './lib/supabase.js';
import Profile from './Profile';
import Search from './Search';
import Calendar from './Calendar';

// Import feature images
import imgBusinessCalendar from './assets/features/business_calendar.jpg';
import imgBookingTime from './assets/features/booking_time.jpg';
import imgChatOwner from './assets/features/chat_owner.jpg';
import imgManageCalendar from './assets/features/manage_calendar.jpg';
import imgVideoMeet from './assets/features/video_meet.jpg';

function CalendarGraphic() {
  return (
    <div className="calendar-graphic">
      <svg width="320" height="320" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="50" y="60" width="300" height="280" rx="24" fill="var(--bg)" stroke="var(--border)" strokeWidth="8"/>
        <path d="M50 140H350" stroke="var(--border)" strokeWidth="8"/>
        <rect x="90" y="30" width="40" height="60" rx="20" fill="var(--primary)"/>
        <rect x="270" y="30" width="40" height="60" rx="20" fill="var(--primary)"/>
        
        {/* Days Header */}
        <rect x="80" y="170" width="30" height="10" rx="5" fill="var(--text-muted)" opacity="0.3"/>
        <rect x="135" y="170" width="30" height="10" rx="5" fill="var(--text-muted)" opacity="0.3"/>
        <rect x="190" y="170" width="30" height="10" rx="5" fill="var(--text-muted)" opacity="0.3"/>
        <rect x="245" y="170" width="30" height="10" rx="5" fill="var(--text-muted)" opacity="0.3"/>
        <rect x="300" y="170" width="30" height="10" rx="5" fill="var(--text-muted)" opacity="0.3"/>
        
        {/* Dates */}
        <circle cx="95" cy="220" r="15" fill="var(--border)"/>
        <circle cx="150" cy="220" r="15" fill="var(--border)"/>
        <circle cx="205" cy="220" r="15" fill="var(--border)"/>
        <circle cx="260" cy="220" r="15" fill="var(--primary)"/>
        <circle cx="315" cy="220" r="15" fill="var(--border)"/>
        
        <circle cx="95" cy="270" r="15" fill="var(--border)"/>
        <circle cx="150" cy="270" r="15" fill="var(--border)"/>
        <circle cx="205" cy="270" r="15" fill="var(--border)"/>
        <circle cx="260" cy="270" r="15" fill="var(--border)"/>
        <circle cx="315" cy="270" r="15" fill="var(--border)"/>
      </svg>
    </div>
  );
}

function Navbar({ theme, toggleTheme, user, onLogout }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-container" style={{ position: 'relative' }}>
        <Link to="/" className="nav-logo">
          <svg className="nav-logo-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <rect x="8" y="14" width="2" height="2"></rect>
          </svg>
          Meettie
        </Link>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <form onSubmit={handleSearch} className="nav-search-form" style={{ display: 'flex', alignItems: 'center', gap: 0, margin: 0 }}>
            <input 
              type="text" 
              placeholder="Search @user, #id or calendar..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="auth-input"
              style={{ padding: '0.4rem 1rem', borderRadius: '20px 0 0 20px', borderRight: 'none', height: '36px', width: '250px', margin: 0 }}
            />
            <button type="submit" className="primary-button" style={{ height: '36px', padding: '0 1rem', borderRadius: '0 20px 20px 0', margin: 0 }}>
              Search
            </button>
          </form>
        </div>
        <div className="nav-actions">
          <button className="theme-switcher" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
          {user ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link to={`/profile/${user.user_metadata?.username}`} className="login-button">Profile</Link>
              <button onClick={onLogout} className="login-button" style={{ border: 'none' }}>Logout</button>
            </div>
          ) : (
            <Link to="/login" className="login-button">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">Welcome to Meettie</h1>
        <p className="hero-subtitle">
          The premium scheduling experience. Minimal, intuitive, and designed to make booking meetings a breeze.
        </p>
        <div className="hero-actions">
          <button className="primary-button">Get Started</button>
        </div>
      </div>
      <div className="hero-visual">
        <CalendarGraphic />
      </div>
    </section>
  );
}

function Features() {
  const featuresList = [
    {
      title: "Create Calendars for Your Business",
      description: "Easily set up and manage custom calendars tailored to your business needs, giving your clients a seamless booking experience.",
      image: imgBusinessCalendar,
      reverse: false
    },
    {
      title: "Set the Time for Booking",
      description: "You have complete control over your availability. Set custom time slots so you only get booked when you want to.",
      image: imgBookingTime,
      reverse: true
    },
    {
      title: "Chat with the Owner",
      description: "Keep communication fluid. Clients can easily chat with the owner of the calendar before or after booking.",
      image: imgChatOwner,
      reverse: false
    },
    {
      title: "Manage Google Calendar",
      description: "This site is able to manage and sync automatically with your Google Calendar, preventing double bookings effortlessly.",
      image: imgManageCalendar,
      reverse: true
    },
    {
      title: "Connect Using Google Meet",
      description: "Automatically generate meeting links. Connect with each other using Google Meet seamlessly when an event is scheduled.",
      image: imgVideoMeet,
      reverse: false
    }
  ];

  return (
    <section className="features-section">
      <div className="features-container">
        {featuresList.map((feature, index) => (
          <div className={`feature-row ${feature.reverse ? 'reverse' : ''}`} key={index}>
            <div className="feature-text">
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </div>
            <div className="feature-image">
              <img src={feature.image} alt={feature.title} className="ai-image" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-logo">
          <svg className="footer-logo-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <rect x="8" y="14" width="2" height="2"></rect>
          </svg>
          Meettie
        </div>
        <div className="footer-socials">
          <a href="#" aria-label="Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
          </a>
          <a href="#" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          </a>
          <a href="#" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Meettie. All rights reserved.</p>
      </div>
    </footer>
  );
}

function LoginGraphic() {
  return (
    <div className="auth-graphic">
      <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 200H220" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round"/>
        <rect x="60" y="40" width="120" height="160" rx="8" stroke="var(--text)" strokeWidth="6"/>
        <path d="M60 40 L140 20 V180 L60 200 Z" fill="var(--bg)" stroke="var(--text)" strokeWidth="6" strokeLinejoin="round"/>
        <circle cx="125" cy="110" r="4" fill="var(--text)"/>
        <path d="M150 120 H210 M170 100 L150 120 L170 140" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function RegisterGraphic() {
  return (
    <div className="auth-graphic">
      <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="80" r="40" stroke="var(--text)" strokeWidth="6"/>
        <path d="M50 200 C50 150, 80 140, 120 140 C160 140, 190 150, 190 200" stroke="var(--text)" strokeWidth="6" strokeLinecap="round"/>
        <circle cx="180" cy="140" r="24" fill="var(--bg)" stroke="var(--primary)" strokeWidth="6"/>
        <path d="M180 125 V155 M165 140 H195" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
      } else {
        const username = data.user?.user_metadata?.username;
        if (username) {
          navigate(`/profile/${username}`);
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-section">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Log in to manage your schedule and meetings.</p>
          
          {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
          
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="auth-label" htmlFor="email">Email</label>
              <input type="email" id="email" className="auth-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="auth-label" htmlFor="password">Password</label>
              <input type="password" id="password" className="auth-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="primary-button auth-submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          <div className="auth-link">
            Don't have an account? <Link to="/register">Register here</Link>
          </div>
        </div>
        <div className="auth-visual-section">
          <LoginGraphic />
          <p className="auth-visual-text">Access your dashboard and start organizing your business today.</p>
        </div>
      </div>
    </div>
  );
}

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    repeatPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.repeatPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            username: formData.username,
          }
        }
      });
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Account created! Please check your email to verify your account.');
        setFormData({ firstName: '', lastName: '', username: '', email: '', password: '', repeatPassword: '' });
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-section">
          <h1 className="auth-title">Create an account</h1>
          <p className="auth-subtitle">Join Meettie to simplify your bookings.</p>
          
          {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}
          
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-row">
              <div className="form-group">
                <label className="auth-label" htmlFor="firstName">Name</label>
                <input type="text" id="firstName" className="auth-input" placeholder="Jane" value={formData.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="auth-label" htmlFor="lastName">Last Name</label>
                <input type="text" id="lastName" className="auth-input" placeholder="Doe" value={formData.lastName} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="auth-label" htmlFor="username">Username</label>
              <input type="text" id="username" className="auth-input" placeholder="janedoe123" value={formData.username} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="auth-label" htmlFor="email">Email</label>
              <input type="email" id="email" className="auth-input" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="auth-label" htmlFor="password">Password</label>
              <input type="password" id="password" className="auth-input" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="auth-label" htmlFor="repeatPassword">Repeat Password</label>
              <input type="password" id="repeatPassword" className="auth-input" placeholder="••••••••" value={formData.repeatPassword} onChange={handleChange} required />
            </div>
            <button type="submit" className="primary-button auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <div className="auth-link">
            Already have an account? <Link to="/login">Log in here</Link>
          </div>
        </div>
        <div className="auth-visual-section">
          <RegisterGraphic />
          <p className="auth-visual-text">Connect with your clients effortlessly. Let them book your time without the hassle.</p>
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="home-page">
      <Hero />
      <hr className="divider" />
      <Features />
    </div>
  );
}


function Verify() {
  // With Supabase, email verification is typically handled by clicking a link which redirects to the app.
  // The session is established automatically if configured correctly.
  return (
    <div style={{ padding: '6rem 2rem', textAlign: 'center', minHeight: 'calc(100vh - 160px)' }}>
      <h1 className="hero-title">Email Verification</h1>
      <p className="hero-subtitle">If you clicked a verification link, you should be logged in automatically.</p>
      <Link to="/login" className="primary-button" style={{ display: 'inline-block', marginTop: '1rem' }}>Go to Login</Link>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('meettie-theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Check active session and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('meettie-theme', newTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        <Navbar theme={theme} toggleTheme={toggleTheme} user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/profile/:username" element={<Profile user={user} />} />
            <Route path="/search" element={<Search />} />
            <Route path="/calendar/:slug" element={<Calendar user={user} />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
