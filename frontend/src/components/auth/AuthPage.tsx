import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import { UserProfile } from '../../types';
import './AuthPage.css';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  currentUser?: UserProfile | null;
  onAuthSuccess: (user: UserProfile) => void;
  onNavigateHome: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  currentUser,
  onAuthSuccess,
  onNavigateHome,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginEmailFocused, setLoginEmailFocused] = useState<boolean>(false);
  const [loginPwdFocused, setLoginPwdFocused] = useState<boolean>(false);

  // Sign Up Form States
  const [fullName, setFullName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showSignupPassword, setShowSignupPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { showToast } = useToast();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.login(loginEmail, loginPassword);
      showToast(`Welcome back, ${data.user.display_name}!`, 'success');
      onAuthSuccess(data.user);
    } catch (err: any) {
      showToast(`Sign in error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sign Up Submit
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !signupEmail || !signupPassword) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }
    if (signupPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (confirmPassword && signupPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const orgName = `${fullName.trim()}'s Workspace`;
      const data = await apiService.register(signupEmail, signupPassword, fullName, orgName);
      showToast(`Account created! Welcome, ${data.user.display_name}.`, 'success');
      onAuthSuccess(data.user);
    } catch (err: any) {
      showToast(`Sign up error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      // Direct user to Google's official OAuth consent screen configured in Google Cloud Console
      const data = await apiService.getGoogleAuthorizeUrl();
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        window.location.href = '/api/v1/auth/google/login';
      }
    } catch (err: any) {
      showToast(`Google authentication error: ${err.message}`, 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className={`auth-page-root ${mode === 'login' ? 'login-mode' : 'signup-mode'}`}>
      {/* Top Floating Navigation */}
      <nav className="auth-floating-nav">
        <button
          type="button"
          className="auth-nav-pill-btn"
          onClick={onNavigateHome}
          title="Back to Home"
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </button>
      </nav>

      {/* =========================================================================
          VIEW 1: LOGIN PAGE
          ========================================================================= */}
      {mode === 'login' && (
        <main className="login-split-layout">
          {/* Left Column: Royal Blue Hero Banner */}
          <section className="login-hero-pane">
            {/* Geometric Vector Arcs & Line Art */}
            <svg
              className="login-hero-svg-bg"
              viewBox="0 0 700 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <ellipse cx="650" cy="450" rx="420" ry="380" stroke="white" strokeWidth="1.5" strokeOpacity="0.35" />
              <ellipse cx="680" cy="420" rx="480" ry="430" stroke="white" strokeWidth="1.2" strokeOpacity="0.25" />
              <ellipse cx="710" cy="390" rx="540" ry="480" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
              <path d="M120 180 L520 80 L620 580 L220 680 Z" stroke="white" strokeWidth="1.2" strokeOpacity="0.2" />
              <path d="M180 120 L580 40 L680 540 L280 620 Z" stroke="white" strokeWidth="0.8" strokeOpacity="0.15" />
            </svg>

            {/* Edge Glow Bleed */}
            <div className="login-hero-edge-glow" />

            {/* 8-Point Star / Asterisk Icon */}
            <div className="login-hero-star-icon">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="42" y="5" width="16" height="90" rx="8" fill="white" />
                <rect x="5" y="42" width="90" height="16" rx="8" fill="white" />
                <rect x="42" y="5" width="16" height="90" rx="8" fill="white" transform="rotate(45 50 50)" />
                <rect x="42" y="5" width="16" height="90" rx="8" fill="white" transform="rotate(-45 50 50)" />
              </svg>
            </div>

            {/* Hero Main Copy */}
            <div className="login-hero-content">
              <h1 className="login-hero-title">
                Hello<br />
                CompanyBrain!<span className="wave-hand">👋</span>
              </h1>
              <p className="login-hero-desc">
                Autonomous knowledge operating system. Connect your tools, resolve contradictions, and empower teams with continuous intelligence.
              </p>
            </div>

            {/* Hero Footer */}
            <div className="login-hero-footer">
              © 2026 CompanyBrain. All rights reserved.
            </div>
          </section>

          {/* Right Column: Clean White Form Pane */}
          <section className="login-form-pane">
            <div className="login-form-container">
              {/* Brand Header */}
              <div className="login-brand-header">
                <span className="login-brand-logo-text">
                  CompanyBrain
                </span>
              </div>

              {/* Headline & Toggle Link */}
              <h2 className="login-form-headline">Welcome Back!</h2>
              <p className="login-form-subtext">
                Don't have an account?{' '}
                <button type="button" onClick={() => setMode('register')}>
                  Create a new account now
                </button>
                , it's FREE! Takes less than a minute.
              </p>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit}>
                {/* Email Input */}
                <div className="login-field-group">
                  <div className={`login-input-underline-wrap ${loginEmailFocused ? 'focused' : ''}`}>
                    <input
                      type="email"
                      className="login-input-underline"
                      placeholder="name@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      onFocus={() => setLoginEmailFocused(true)}
                      onBlur={() => setLoginEmailFocused(false)}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="login-field-group">
                  <div className={`login-input-underline-wrap ${loginPwdFocused ? 'focused' : ''}`}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      className="login-input-underline"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onFocus={() => setLoginPwdFocused(true)}
                      onBlur={() => setLoginPwdFocused(false)}
                      required
                    />
                    <button
                      type="button"
                      className="login-pwd-toggle-btn"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Primary CTA: Login Now */}
                <button
                  type="submit"
                  className="login-primary-btn"
                  disabled={isLoading}
                >
                  {isLoading ? <RefreshCw size={18} className="auth-spinner" /> : null}
                  <span>Login Now</span>
                </button>

                {/* Google OAuth Button */}
                <button
                  type="button"
                  className="login-google-btn"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
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
                  <span>Login with Google</span>
                </button>

                {/* Forget Password */}
                <div className="login-forgot-pwd">
                  Forget password
                  <button
                    type="button"
                    onClick={() => showToast('Password reset instructions sent to your email.', 'info')}
                  >
                    Click here
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
      )}

      {/* =========================================================================
          VIEW 2: SIGN UP PAGE (Image 2 - 3D Glassmorphic Card on Lavender Space)
          ========================================================================= */}
      {mode === 'register' && (
        <>
          {/* Floating 3D Geometric Scene */}
          <div className="signup-3d-scene">
            {/* 3D Blue Beveled Cube (Top Right) */}
            <div className="shape-3d-cube">
              <svg viewBox="0 0 160 160" className="cube-svg">
                <defs>
                  <linearGradient id="cubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f75fe" />
                    <stop offset="100%" stopColor="#355dfd" />
                  </linearGradient>
                  <linearGradient id="cubeLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2c52fb" />
                    <stop offset="100%" stopColor="#1e3fcb" />
                  </linearGradient>
                  <linearGradient id="cubeRight" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2546e8" />
                    <stop offset="100%" stopColor="#142c9e" />
                  </linearGradient>
                </defs>
                {/* Top face */}
                <path d="M80 15 L145 52 L80 90 L15 52 Z" fill="url(#cubeTop)" />
                {/* Left face */}
                <path d="M15 52 L80 90 L80 155 L15 117 Z" fill="url(#cubeLeft)" />
                {/* Right face */}
                <path d="M80 90 L145 52 L145 117 L80 155 Z" fill="url(#cubeRight)" />
              </svg>
            </div>

            {/* 3D Blue Torus (Bottom Left) */}
            <div className="shape-3d-torus">
              <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <radialGradient id="torusGrad" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#557cff" />
                    <stop offset="50%" stopColor="#254cf8" />
                    <stop offset="100%" stopColor="#1129aa" />
                  </radialGradient>
                </defs>
                <ellipse cx="80" cy="80" rx="70" ry="42" fill="url(#torusGrad)" />
                <ellipse cx="80" cy="80" rx="34" ry="18" fill="#8ca2f4" />
              </svg>
            </div>

            {/* Soft Blurred Depth Cylinder (Bottom Right) */}
            <div className="shape-3d-cylinder" />

            {/* 3D Jack / Astroid Shape (Top Right Background) */}
            <div className="shape-3d-jack">
              <svg viewBox="0 0 100 100" fill="#879bf0">
                <circle cx="50" cy="50" r="16" />
                <circle cx="20" cy="30" r="12" />
                <circle cx="80" cy="30" r="12" />
                <circle cx="50" cy="85" r="12" />
                <rect x="44" y="20" width="12" height="65" rx="6" />
                <rect x="20" y="38" width="60" height="12" rx="6" transform="rotate(-30 50 50)" />
                <rect x="20" y="38" width="60" height="12" rx="6" transform="rotate(30 50 50)" />
              </svg>
            </div>
          </div>

          {/* Main Frosted Glassmorphic Sign Up Card */}
          <section className="signup-glass-card">
            {/* Left Column: Input Fields */}
            <div className="signup-left-col">
              <h2 className="signup-card-title">Sign Up</h2>

              <form id="signup-form" onSubmit={handleSignUpSubmit} className="signup-input-list">
                {/* Full Name */}
                <div className="signup-pill-input-wrap">
                  <input
                    type="text"
                    className="signup-pill-input"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                {/* Email Address */}
                <div className="signup-pill-input-wrap">
                  <input
                    type="email"
                    className="signup-pill-input"
                    placeholder="Email Address"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Password */}
                <div className="signup-pill-input-wrap">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    className="signup-pill-input"
                    placeholder="Password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="signup-pill-toggle"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    tabIndex={-1}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="signup-pill-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="signup-pill-input"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="signup-pill-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Sign Up Button & Social Sign In */}
            <div className="signup-right-col">
              {/* Primary Black Pill Sign Up Button */}
              <button
                type="submit"
                form="signup-form"
                className="signup-primary-pill-btn"
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw size={18} className="auth-spinner" /> : null}
                <span>Sign Up</span>
              </button>

              {/* Already have an account prompt */}
              <div className="signup-login-prompt">
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  Log in
                </button>
              </div>

              {/* Or Divider */}
              <div className="signup-or-divider">
                <span>Or</span>
              </div>

              {/* Social Buttons */}
              <div className="signup-social-btn-list">
                {/* Google Sign Up */}
                <button
                  type="button"
                  className="signup-social-pill-btn"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
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
                  <span>Sign up with Google</span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
