import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAuth.js';
import { authAPI } from '../services/api.js';
import { ACTIONS } from '../reducer/appReducer.js';

const Login = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (state.jwtToken && state.authenticatedUser) {
      navigate('/dashboard');
    }
  }, [state.jwtToken, state.authenticatedUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });

    try {
      // API call to backend public token endpoint
      // We pass the email (which can be either email or studentId E0223017) and password
      const res = await authAPI.login({ email, password });
      
      if (res.data.success) {
        const token = res.data.token;
        const user = res.data.data;
        dispatch({
          type: ACTIONS.LOGIN_SUCCESS,
          payload: { token, user }
        });
        navigate('/dashboard');
      } else {
        setLocalError(res.data.message || 'Login failed.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLocalError(error.response?.data?.message || 'Invalid credentials or server connection failed.');
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  return (
    <div>
      <div>
        <h2>Issue Tracker Login</h2>
        
        {localError && (
          <div style={{ color: 'red' }}>
            {localError}
          </div>
        )}

        <form data-testid="login-form" onSubmit={handleSubmit}>
          <div>
            <label>Email or Student ID</label>
            <input
              type="text"
              data-testid="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul.kumar@test.com or E0223012"
              required
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              data-testid="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            data-testid="login-btn"
            disabled={state.loading}
          >
            {state.loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div>
          Tip: You can use your assessment credentials or sync first to log in.
        </div>
      </div>
    </div>
  );
};

export default Login;
