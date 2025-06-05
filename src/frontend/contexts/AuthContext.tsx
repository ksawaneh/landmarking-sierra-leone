import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { useRouter } from 'next/router';
import jwtDecode from 'jwt-decode';
import { api } from '../api/axios';

// Types
type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if the token exists and is valid on initial load
    checkAuth().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { email, password });
      const { token, refreshToken } = response.data;
      
      // Store tokens
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Decode and set user
      const decodedToken: any = jwtDecode(token);
      setUser({
        id: decodedToken.sub,
        username: decodedToken.username,
        email: decodedToken.email,
        role: decodedToken.role,
        permissions: decodedToken.permissions || [],
      });
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/login');
  };

  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      setUser(null);
      return false;
    }
    
    try {
      // Check if token is expired
      const decodedToken: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decodedToken.exp < currentTime) {
        // Token expired, try refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await api.post('/auth/refresh', { refreshToken });
        const { token: newToken } = response.data;
        
        localStorage.setItem('accessToken', newToken);
        
        const newDecodedToken: any = jwtDecode(newToken);
        setUser({
          id: newDecodedToken.sub,
          username: newDecodedToken.username,
          email: newDecodedToken.email,
          role: newDecodedToken.role,
          permissions: newDecodedToken.permissions || [],
        });
      } else {
        // Token still valid
        setUser({
          id: decodedToken.sub,
          username: decodedToken.username,
          email: decodedToken.email,
          role: decodedToken.role,
          permissions: decodedToken.permissions || [],
        });
      }
      
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      logout();
      return false;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};