import { sign, verify } from '@tsndr/cloudflare-worker-jwt';
import { z } from 'zod';
import { Env } from '../index';

// Schemas for validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2).max(100),
  phoneNumber: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Helper functions
const hashPassword = async (password: string): Promise<string> => {
  // In a real implementation, we would use a proper bcrypt
  // or similar library with Workers crypto
  // For this example, we'll use a simple hash
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
};

const generateTokens = async (user: any, env: Env) => {
  const now = Math.floor(Date.now() / 1000);
  
  // Access token expires in 15 minutes
  const accessToken = await sign({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    permissions: user.permissions || [],
    exp: now + 15 * 60, // 15 minutes
    iat: now,
  }, env.JWT_SECRET);
  
  // Refresh token expires in 7 days
  const refreshToken = await sign({
    sub: user.id,
    type: 'refresh',
    exp: now + 7 * 24 * 60 * 60, // 7 days
    iat: now,
  }, env.JWT_SECRET);
  
  return { token: accessToken, refreshToken };
};

// Auth handler
export const authHandler = {
  // Login handler
  async login(request: Request, env: Env) {
    try {
      const body = await request.json();
      
      // Validate the request body
      const result = loginSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { email, password } = result.data;
      
      // Get the user from KV store
      const userJson = await env.USERS_KV.get(`user:${email}`);
      if (!userJson) {
        const error = new Error('Invalid email or password');
        error.name = 'UnauthorizedError';
        throw error;
      }
      
      const user = JSON.parse(userJson);
      
      // Compare passwords
      const passwordMatch = await comparePasswords(password, user.passwordHash);
      if (!passwordMatch) {
        const error = new Error('Invalid email or password');
        error.name = 'UnauthorizedError';
        throw error;
      }
      
      // Generate tokens
      const tokens = await generateTokens(user, env);
      
      return Response.json({
        success: true,
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Register handler
  async register(request: Request, env: Env) {
    try {
      const body = await request.json();
      
      // Validate the request body
      const result = registerSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { username, email, password, fullName, phoneNumber } = result.data;
      
      // Check if the user already exists
      const existingUser = await env.USERS_KV.get(`user:${email}`);
      if (existingUser) {
        const error = new Error('User with this email already exists');
        error.name = 'ConflictError';
        throw error;
      }
      
      // Hash the password
      const passwordHash = await hashPassword(password);
      
      // Create the user object
      const userId = crypto.randomUUID();
      const user = {
        id: userId,
        username,
        email,
        passwordHash,
        fullName,
        phoneNumber,
        role: 'user',
        permissions: ['parcels.view', 'parcels.create'],
        createdAt: new Date().toISOString(),
      };
      
      // Store the user in KV
      await env.USERS_KV.put(`user:${email}`, JSON.stringify(user));
      await env.USERS_KV.put(`userId:${userId}`, JSON.stringify(user));
      
      // Generate tokens
      const tokens = await generateTokens(user, env);
      
      // Return the user and tokens
      return Response.json({
        success: true,
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Refresh token handler
  async refresh(request: Request, env: Env) {
    try {
      const body = await request.json();
      
      // Validate the request body
      const result = refreshSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { refreshToken } = result.data;
      
      // Verify the refresh token
      try {
        const isValid = await verify(refreshToken, env.JWT_SECRET);
        if (!isValid) {
          const error = new Error('Invalid refresh token');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Decode the token payload
        const decoded = JSON.parse(atob(refreshToken.split('.')[1]));
        
        // Check if it's a refresh token
        if (decoded.type !== 'refresh') {
          const error = new Error('Invalid token type');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Check for token expiration
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
          const error = new Error('Refresh token expired');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Get the user from KV
        const userId = decoded.sub;
        const userJson = await env.USERS_KV.get(`userId:${userId}`);
        
        if (!userJson) {
          const error = new Error('User not found');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        const user = JSON.parse(userJson);
        
        // Generate new tokens
        const tokens = await generateTokens(user, env);
        
        return Response.json({
          success: true,
          ...tokens,
        });
      } catch (error) {
        const err = new Error('Invalid refresh token');
        err.name = 'UnauthorizedError';
        throw err;
      }
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Forgot password handler
  async forgotPassword(request: Request, env: Env) {
    try {
      const body = await request.json();
      
      // Validate the request body
      const result = forgotPasswordSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { email } = result.data;
      
      // Check if the user exists
      const userJson = await env.USERS_KV.get(`user:${email}`);
      if (!userJson) {
        // Don't reveal that the user doesn't exist
        return Response.json({
          success: true,
          message: 'If your email is registered, you will receive a password reset link',
        });
      }
      
      const user = JSON.parse(userJson);
      
      // Generate a password reset token
      const now = Math.floor(Date.now() / 1000);
      const resetToken = await sign({
        sub: user.id,
        email: user.email,
        type: 'password-reset',
        exp: now + 60 * 60, // 1 hour
        iat: now,
      }, env.JWT_SECRET);
      
      // In a real implementation, we would send an email with the reset link
      // For this example, we'll just return the token
      
      return Response.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
        // In a real app, we wouldn't return this directly, but send it via email
        debug: {
          resetToken,
          resetLink: `https://landmarking.vercel.app/reset-password?token=${resetToken}`,
        },
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Reset password handler
  async resetPassword(request: Request, env: Env) {
    try {
      const body = await request.json();
      
      // Validate the request body
      const result = resetPasswordSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      const { token, password } = result.data;
      
      // Verify the token
      try {
        const isValid = await verify(token, env.JWT_SECRET);
        if (!isValid) {
          const error = new Error('Invalid token');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Decode the token payload
        const decoded = JSON.parse(atob(token.split('.')[1]));
        
        // Check if it's a password reset token
        if (decoded.type !== 'password-reset') {
          const error = new Error('Invalid token type');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Check for token expiration
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
          const error = new Error('Token expired');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        // Get the user from KV
        const userId = decoded.sub;
        const userJson = await env.USERS_KV.get(`userId:${userId}`);
        
        if (!userJson) {
          const error = new Error('User not found');
          error.name = 'UnauthorizedError';
          throw error;
        }
        
        const user = JSON.parse(userJson);
        
        // Update the password
        const passwordHash = await hashPassword(password);
        user.passwordHash = passwordHash;
        
        // Store the updated user
        await env.USERS_KV.put(`user:${user.email}`, JSON.stringify(user));
        await env.USERS_KV.put(`userId:${userId}`, JSON.stringify(user));
        
        return Response.json({
          success: true,
          message: 'Password reset successfully',
        });
      } catch (error) {
        const err = new Error('Invalid or expired token');
        err.name = 'UnauthorizedError';
        throw err;
      }
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
};