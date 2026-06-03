import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAuth.js';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { state } = useAppContext();

  // If loading, show a simple spinner/loading text
  if (state.loading && !state.authenticatedUser && state.jwtToken) {
    return <div>Loading session...</div>;
  }

  // If not authenticated, redirect to login
  if (!state.jwtToken) {
    return <Navigate to="/login" replace />;
  }

  // If session is still loading, wait
  if (!state.authenticatedUser) {
    return <div>Loading session...</div>;
  }

  // Check roles if allowedRoles is specified
  if (allowedRoles && !allowedRoles.includes(state.authenticatedUser.role)) {
    return (
      <div>
        <h2>Access Denied</h2>
        <p>Your role ({state.authenticatedUser.role}) does not have permission to view this page.</p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

