import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const API_BASE = 'http://localhost:3001';

axios.defaults.baseURL = API_BASE;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
      setLoading(false);
    }
  };

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        // Set token first
        setToken(storedToken);
        // Set axios header immediately
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        // Then fetch user
        try {
          const response = await axios.get('/api/auth/me');
          setUser(response.data.user);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching user on init:', error);
          // Token invalid, clear it
          localStorage.removeItem('token');
          setToken(null);
          delete axios.defaults.headers.common['Authorization'];
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Run only once on mount

  // Update token and localStorage when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      console.log('Login response:', response.data);
      const { token: newToken, user: userData } = response.data;
      
      if (!newToken || !userData) {
        console.error('Invalid response format:', response.data);
        return { success: false, error: 'Invalid response from server' };
      }
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post('/api/auth/register', { username, email, password });
      console.log('Register response:', response.data);
      const { token: newToken, user: userData } = response.data;
      
      if (!newToken || !userData) {
        console.error('Invalid response format:', response.data);
        return { success: false, error: 'Invalid response from server' };
      }
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Update failed' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put('/api/auth/password', { current_password: currentPassword, new_password: newPassword });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Password change failed' };
    }
  };

  const isAuthenticated = !!user;
  
  // Debug log
  useEffect(() => {
    console.log('Auth state changed:', { user, isAuthenticated, loading });
  }, [user, isAuthenticated, loading]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};

