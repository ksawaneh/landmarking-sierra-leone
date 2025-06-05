import { z } from 'zod';
import { Env } from '../index';

// Schemas for validation
const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  fullName: z.string().min(2).max(100).optional(),
  phoneNumber: z.string().optional(),
  // Email is not updatable
  // Password is updated through a different flow
});

// Helper function to check if a user has permission
const hasPermission = (user: any, permission: string) => {
  if (user.role === 'admin') return true;
  return user.permissions && user.permissions.includes(permission);
};

// Users handler
export const usersHandler = {
  // List users (admin only)
  async listUsers(request: Request, env: Env) {
    try {
      const { user } = request;
      
      // Check if the user has admin role
      if (user.role !== 'admin') {
        const error = new Error('Not authorized to list users');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // In a real implementation, we would paginate and filter
      // For this example, we'll just get a list of users
      // This would typically be a database query
      
      // Since we're using KV which doesn't support listing by prefix easily,
      // we'll return a mock list for this example
      
      return Response.json({
        success: true,
        users: [
          {
            id: user.sub,
            username: user.username,
            email: user.email,
            role: user.role,
          },
          {
            id: 'mock-user-1',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
          {
            id: 'mock-user-2',
            username: 'anotheruser',
            email: 'another@example.com',
            role: 'user',
          },
        ],
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Get a user by ID
  async getUser(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user is requesting their own profile or has admin role
      if (user.sub !== id && user.role !== 'admin') {
        const error = new Error('Not authorized to view this user');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // Get the user from KV
      const userJson = await env.USERS_KV.get(`userId:${id}`);
      
      if (!userJson) {
        const error = new Error('User not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      const userData = JSON.parse(userJson);
      
      // Remove sensitive data
      const { passwordHash, ...publicUserData } = userData;
      
      return Response.json({
        success: true,
        user: publicUserData,
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Get the current user (from the token)
  async getCurrentUser(request: Request) {
    try {
      const { user } = request;
      
      return Response.json({
        success: true,
        user: {
          id: user.sub,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
        },
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Update a user
  async updateUser(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user is updating their own profile or has admin role
      if (user.sub !== id && user.role !== 'admin') {
        const error = new Error('Not authorized to update this user');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      const body = await request.json();
      
      // Validate the request body
      const result = updateUserSchema.safeParse(body);
      if (!result.success) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        // @ts-ignore
        error.details = result.error.errors;
        throw error;
      }
      
      // Get the user from KV
      const userJson = await env.USERS_KV.get(`userId:${id}`);
      
      if (!userJson) {
        const error = new Error('User not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      const userData = JSON.parse(userJson);
      
      // Update the user
      const updatedUser = {
        ...userData,
        ...result.data,
        updatedAt: new Date().toISOString(),
      };
      
      // Store the updated user
      await env.USERS_KV.put(`user:${userData.email}`, JSON.stringify(updatedUser));
      await env.USERS_KV.put(`userId:${id}`, JSON.stringify(updatedUser));
      
      // Remove sensitive data
      const { passwordHash, ...publicUserData } = updatedUser;
      
      return Response.json({
        success: true,
        user: publicUserData,
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
  
  // Delete a user (admin only)
  async deleteUser(request: Request, env: Env, params: { id: string }) {
    try {
      const { user } = request;
      const { id } = params;
      
      // Check if the user has admin role
      if (user.role !== 'admin') {
        const error = new Error('Not authorized to delete users');
        error.name = 'ForbiddenError';
        throw error;
      }
      
      // Get the user from KV
      const userJson = await env.USERS_KV.get(`userId:${id}`);
      
      if (!userJson) {
        const error = new Error('User not found');
        error.name = 'NotFoundError';
        throw error;
      }
      
      const userData = JSON.parse(userJson);
      
      // Delete the user
      await env.USERS_KV.delete(`user:${userData.email}`);
      await env.USERS_KV.delete(`userId:${id}`);
      
      return Response.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      // Pass to error handler
      throw error;
    }
  },
};