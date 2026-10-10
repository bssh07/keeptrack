import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { 
  Target, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X
} from 'lucide-react';
import './Login.css';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      if (error?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in cancelled. Please click below to try again.');
      } else if (error?.code === 'auth/popup-blocked') {
        setErrorMsg('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setErrorMsg('Unable to sign in. Please verify your internet connection or Firebase setup.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-glow" />

      {/* Top Navigation */}
      <header className="login-navbar">
        <div className="login-brand">
          <div className="brand-icon-box">
            <Target size={22} strokeWidth={2.5} />
          </div>
          <span className="brand-name">
            KeepTrack
            <span className="brand-tag">Focus</span>
          </span>
        </div>

        <div className="nav-status-pill">
          <span className="status-dot"></span>
          <span>Cloud Sync Active</span>
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="login-main">
        {/* Left Column: Product Value & Preview */}
        <section className="hero-content">
          <div className="hero-pill">
            <Sparkles size={14} className="hero-pill-icon" />
            <span>Smart Goal & Task Management</span>
          </div>

          <h1 className="hero-title">
            Turn ambitious visions into{' '}
            <span className="hero-title-highlight">daily momentum.</span>
          </h1>

          <p className="hero-subtitle">
            KeepTrack provides a calm, distraction-free workspace designed to break down high-level
            aspirations into structured subgoals, prioritize daily actions, and keep you effortlessly focused.
          </p>

          {/* Key Feature Highlights */}
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon-wrapper blue">
                <Layers size={18} />
              </div>
              <div className="feature-details">
                <h4>Hierarchical Goals & Subgoals</h4>
                <p>Deconstruct massive milestones into bite-sized subgoals with clear deadlines and breadcrumbs.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper purple">
                <Zap size={18} />
              </div>
              <div className="feature-details">
                <h4>Priority-Driven Execution</h4>
                <p>Filter your day by High, Medium, or Low priority tags, due dates, and in-progress focus tracking.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper emerald">
                <ShieldCheck size={18} />
              </div>
              <div className="feature-details">
                <h4>Always in Sync & Private</h4>
                <p>Secure real-time cloud sync powered by Google Firebase keeps your data updated everywhere.</p>
              </div>
            </div>
          </div>

          {/* Micro Preview Card */}
          <div className="preview-card">
            <div className="preview-header">
              <div className="preview-goal-title">
                <Target size={16} color="#3b82f6" />
                <span>Launch New Product Milestone</span>
              </div>
              <span className="preview-progress-pill">75% Complete</span>
            </div>
            <div className="preview-progress-bar-bg">
              <div className="preview-progress-bar-fill"></div>
            </div>
            <div className="preview-task-item">
              <div className="preview-task-left">
                <CheckCircle size={15} color="#10b981" />
                <span>Finalize aesthetic onboarding flow</span>
              </div>
              <span className="preview-badge-high">High Priority</span>
            </div>
          </div>
        </section>

        {/* Right Column: Refined Authentication Card */}
        <section className="login-card-container">
          <div className="login-auth-card">
            <div className="auth-card-badge">
              <Clock size={13} />
              <span>Get started in seconds</span>
            </div>

            <h2 className="auth-card-title">Welcome to KeepTrack</h2>
            <p className="auth-card-desc">
              Sign in with your Google account to access your personal dashboard, synced milestones, and task boards.
            </p>

            {errorMsg && (
              <div className="auth-error-banner" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg('')} title="Dismiss">
                  <X size={14} />
                </button>
              </div>
            )}

            <button 
              className="btn-google" 
              onClick={handleLogin} 
              disabled={isLoading}
              aria-label="Sign in with Google"
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="auth-divider">
              <span>Why KeepTrack?</span>
            </div>

            <div className="auth-perks">
              <div className="auth-perk-item">
                <CheckCircle size={15} className="auth-perk-icon" />
                <span>Instant Google SSO — no extra password needed</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle size={15} className="auth-perk-icon" />
                <span>End-to-end user isolation with Firebase rules</span>
              </div>
              <div className="auth-perk-item">
                <CheckCircle size={15} className="auth-perk-icon" />
                <span>Real-time cross-device sync & offline tolerance</span>
              </div>
            </div>

            <div className="auth-quote">
              “Focus on being productive instead of busy. Break down your milestones and conquer them step by step.”
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <div className="footer-left">
          <span>&copy; {new Date().getFullYear()} KeepTrack. All rights reserved.</span>
          <span className="footer-tagline">Engineered for focus and clarity.</span>
        </div>
        <div>
          <span>Secure Google Cloud Infrastructure</span>
        </div>
      </footer>
    </div>
  );
}
