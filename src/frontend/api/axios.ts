import axios from 'axios';

// Create axios instance with base URL from environment variables
export const api = axios.create({
  baseURL: process.env.API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get the token from localStorage
    const token = localStorage.getItem('accessToken');
    
    // If token exists, add it to the request headers
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is due to token expiration (401) and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get the refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          throw new Error('No refresh token found');
        }
        
        // Request a new access token
        const response = await axios.post(
          `${process.env.API_URL || '/api'}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        const { token } = response.data;
        
        // Store the new token
        localStorage.setItem('accessToken', token);
        
        // Update the original request with the new token
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        
        // Retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout the user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        // Redirect to login page if we're in a browser environment
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;