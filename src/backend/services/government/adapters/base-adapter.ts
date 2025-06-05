/**
 * Base adapter for government data sources
 * Provides common functionality for all government system integrations
 */

import { z } from 'zod';

export interface AdapterConfig {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  mockMode?: boolean;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface AdapterResponse<T> {
  data: T;
  metadata: {
    source: string;
    timestamp: Date;
    queryTime: number;
    recordCount: number;
    hasMore?: boolean;
  };
  warnings?: string[];
  errors?: string[];
}

export abstract class BaseGovernmentAdapter<TRecord, TQuery = any> {
  protected config: AdapterConfig;
  protected connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  protected lastHealthCheck?: Date;
  
  constructor(config: AdapterConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      retryAttempts: 3,
      mockMode: false,
      ...config
    };
  }
  
  /**
   * Tests connection to the government system
   */
  abstract testConnection(): Promise<boolean>;
  
  /**
   * Queries records from the government system
   */
  abstract query(params: TQuery, options?: QueryOptions): Promise<AdapterResponse<TRecord[]>>;
  
  /**
   * Gets a specific record by ID
   */
  abstract getById(id: string): Promise<AdapterResponse<TRecord | null>>;
  
  /**
   * Validates the structure of a record
   */
  abstract validateRecord(record: unknown): TRecord;
  
  /**
   * Transforms raw government data to our schema
   */
  abstract transformRecord(rawRecord: any): TRecord;
  
  /**
   * Common health check implementation
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    message?: string;
  }> {
    try {
      const isConnected = await this.testConnection();
      this.lastHealthCheck = new Date();
      
      if (isConnected) {
        this.connectionStatus = 'connected';
        return {
          status: 'healthy',
          lastCheck: this.lastHealthCheck
        };
      } else {
        this.connectionStatus = 'disconnected';
        return {
          status: 'unhealthy',
          lastCheck: this.lastHealthCheck,
          message: 'Failed to connect to government system'
        };
      }
    } catch (error) {
      this.connectionStatus = 'error';
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Retry logic for failed requests
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.config.retryAttempts || 3
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on validation errors
        if (error instanceof z.ZodError) {
          throw error;
        }
        
        // Exponential backoff
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }
  
  /**
   * Logs adapter operations for audit trail
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      adapter: this.config.name,
      level,
      message,
      data
    };
    
    // In production, this would send to a logging service
    console.log(JSON.stringify(logEntry));
  }
  
  /**
   * Measures operation performance
   */
  protected async measurePerformance<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.log('info', `${operationName} completed`, { duration });
      
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', `${operationName} failed`, { duration, error });
      throw error;
    }
  }
  
  /**
   * Sanitizes sensitive data before logging
   */
  protected sanitizeForLogging(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['nationalId', 'ownerNationalId', 'taxpayerTin', 'phone', 'ownerPhone'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.maskSensitiveData(sanitized[field]);
      }
    }
    
    return sanitized;
  }
  
  /**
   * Masks sensitive data
   */
  private maskSensitiveData(value: string): string {
    if (value.length <= 4) return '****';
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }
  
  /**
   * Gets adapter metrics
   */
  getMetrics(): {
    name: string;
    status: string;
    lastHealthCheck?: Date;
    mockMode: boolean;
  } {
    return {
      name: this.config.name,
      status: this.connectionStatus,
      lastHealthCheck: this.lastHealthCheck,
      mockMode: this.config.mockMode || false
    };
  }
}