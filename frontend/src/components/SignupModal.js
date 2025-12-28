import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';

export default function SignupModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    organization: '',
    role: 'admin'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVerificationPending(false);
      setSuccess(false);
      setError('');
      setResendMessage('');
      setCanResend(true);
      setResendCountdown(0);
      setLoading(false);
      setResendLoading(false);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        organization: formData.organization,
        role: formData.role
      });

      if (response.data && response.data.success) {
        // Signup successful - show verification pending state
        setSuccess(true);
        setVerificationPending(true);
        setError('');
        // Don't auto-close - keep popup open for verification
      } else {
        // Signup failed
        setError(response.data?.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      // Handle different types of errors
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response && err.response.status === 400) {
        setError('Invalid request. Please check your input and try again.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!canResend || !formData.email) return;
    
    setResendLoading(true);
    setResendMessage('');
    setCanResend(false);
    setResendCountdown(60); // 60 second cooldown
    
    try {
      const response = await authAPI.resendVerificationUnauth(formData.email);
      
      if (response.data && response.data.success) {
        setResendMessage('Verification email sent successfully!');
      } else {
        setResendMessage(response.data?.message || 'Failed to resend verification email.');
        setCanResend(true); // Re-enable on error
        setResendCountdown(0);
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      setResendMessage('Failed to resend verification email. Please try again.');
      setCanResend(true); // Re-enable on error
      setResendCountdown(0);
    } finally {
      setResendLoading(false);
    }
  };

  const handleCloseModal = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phone: '',
      organization: '',
      role: 'admin'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)'
      }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            👤 Admin Signup
          </h2>
          <p style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}>
            Create an admin account to access the authority dashboard
          </p>
        </div>

        {verificationPending ? (
          <div>
            <div style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--info-bg)',
              color: 'var(--info-text)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              marginBottom: 'var(--space-4)'
            }}>
              <h3 style={{ margin: '0 0 var(--space-2) 0' }}>📧 Verification Email Sent!</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                We've sent a verification link to <strong>{formData.email}</strong>. 
                Please check your email and click the verification link to complete your registration.
              </p>
            </div>

            {/* Resend Verification Section */}
            <div style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)'
            }}>
              <h4 style={{ 
                margin: '0 0 var(--space-3) 0',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--text-primary)'
              }}>
                Didn't receive the email?
              </h4>
              
              <button
                onClick={handleResendVerification}
                disabled={!canResend || resendLoading}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--primary-blue)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: canResend && !resendLoading ? 'var(--primary-blue)' : 'var(--gray-300)',
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: canResend && !resendLoading ? 'pointer' : 'not-allowed',
                  transition: 'all var(--transition-fast)',
                  marginBottom: 'var(--space-3)'
                }}
              >
                {resendLoading ? 'Sending...' : canResend ? 'Resend Verification Email' : `Resend in ${resendCountdown}s`}
              </button>

              {resendMessage && (
                <div style={{
                  padding: 'var(--space-2)',
                  backgroundColor: resendMessage.includes('success') ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: resendMessage.includes('success') ? 'var(--success-text)' : 'var(--warning-text)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  textAlign: 'center'
                }}>
                  {resendMessage}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)'
            }}>
              <h4 style={{ 
                margin: '0 0 var(--space-2) 0',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--text-secondary)'
              }}>
                Instructions:
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                lineHeight: 1.4
              }}>
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>The link expires after 24 hours</li>
                <li>After verification, you can log in to your account</li>
              </ul>
            </div>

            {/* Manual Close Option */}
            <div style={{ 
              display: 'flex', 
              gap: 'var(--space-3)',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleCloseModal}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Close Modal
              </button>
            </div>
          </div>
        ) : success ? (
          <div style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-text)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 var(--space-2) 0' }}>✅ Signup Successful!</h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              Account created successfully.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--text-primary)'
              }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  Password *
                </label>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      paddingRight: 'var(--space-10)',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 'var(--space-3)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color var(--transition-fast)'
                    }}
                    onMouseOver={(e) => e.target.style.color = 'var(--text-primary)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  Confirm Password *
                </label>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      paddingRight: 'var(--space-10)',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 'var(--space-3)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color var(--transition-fast)'
                    }}
                    onMouseOver={(e) => e.target.style.color = 'var(--text-primary)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  Organization
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder="Enter organization"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--text-primary)'
              }}>
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="authority">Authority</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && (
              <div style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--error-bg)',
                color: 'var(--error-text)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  border: '1px solid var(--primary-blue)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: loading ? 'var(--gray-300)' : 'var(--primary-blue)',
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
