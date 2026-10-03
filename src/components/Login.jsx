import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogIn } from 'lucide-react';

export default function Login() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      alert("Failed to sign in. Please check your config.");
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <h2>Welcome to KeepTrack</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>
          Sign in to keep your goals and tasks synced across all your devices.
        </p>
        <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%', padding: '0.75rem' }}>
          <LogIn size={20} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
