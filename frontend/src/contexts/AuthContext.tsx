import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'viewer' | 'engineer' | 'admin';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token and get user info
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      // For demo purposes, we'll get the stored user data
      // In production, this would be an API call to verify the token
      const storedUserData = localStorage.getItem('userData');
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        setUser(userData);
      } else {
        // Fallback to engineer if no stored data
        const mockUser: User = {
          id: '1',
          name: 'John Engineer',
          email: 'john.engineer@company.com',
          role: 'engineer'
        };
        setUser(mockUser);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // For demo purposes, we'll simulate a login
      // In production, this would be an API call to authenticate
      if (email === 'admin@company.com' && password === 'admin') {
        const mockUser: User = {
          id: '1',
          name: 'Admin User',
          email: 'admin@company.com',
          role: 'admin'
        };
        
        const mockToken = 'mock-jwt-token';
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userData', JSON.stringify(mockUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        setUser(mockUser);
      } else if (email === 'engineer@company.com' && password === 'engineer') {
        const mockUser: User = {
          id: '2',
          name: 'John Engineer',
          email: 'engineer@company.com',
          role: 'engineer'
        };
        
        const mockToken = 'mock-jwt-token';
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userData', JSON.stringify(mockUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        setUser(mockUser);
      } else if (email === 'viewer@company.com' && password === 'viewer') {
        const mockUser: User = {
          id: '3',
          name: 'Viewer User',
          email: 'viewer@company.com',
          role: 'viewer'
        };
        
        const mockToken = 'mock-jwt-token';
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userData', JSON.stringify(mockUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        setUser(mockUser);
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
