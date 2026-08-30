import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

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

function Navbar({ theme, toggleTheme }) {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">Meettie</Link>
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
          <Link to="/login" className="login-button">Login</Link>
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

function Home() {
  return (
    <div className="home-page">
      <Hero />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('meettie-theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('meettie-theme', newTheme);
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        <Navbar theme={theme} toggleTheme={toggleTheme} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
