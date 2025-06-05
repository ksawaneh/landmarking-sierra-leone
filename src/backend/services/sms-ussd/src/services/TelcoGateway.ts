/**
 * Telco gateway for integrating with mobile network operators
 */

import axios, { AxiosInstance } from 'axios';
import { TelcoProvider, TelcoConfig, SMSMessage, SMSResponse, MessageStatus, SMSError } from '../types';
import { logger } from '../utils/logger';
import { RateLimiterMemory } from 'rate-limiter-flexible';

interface TelcoAPIResponse {
  messageId: string;
  status: string;
  error?: string;
}

interface DeliveryReport {
  messageId: string;
  status: MessageStatus;
  deliveredAt?: Date;
  error?: string;
}

export class TelcoGateway {
  private providers: Map<TelcoProvider, TelcoConfig>;
  private clients: Map<TelcoProvider, AxiosInstance>;
  private rateLimiters: Map<TelcoProvider, RateLimiterMemory>;
  private deliveryCallbacks: Map<string, (report: DeliveryReport) => void>;

  constructor(configs: TelcoConfig[]) {
    this.providers = new Map();
    this.clients = new Map();
    this.rateLimiters = new Map();
    this.deliveryCallbacks = new Map();

    // Initialize each provider
    configs.forEach(config => {
      this.initializeProvider(config);
    });
  }

  /**
   * Initialize a telco provider
   */
  private initializeProvider(config: TelcoConfig): void {
    this.providers.set(config.provider, config);

    // Create HTTP client
    const client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-API-Secret': config.apiSecret
      }
    });

    // Add request/response interceptors
    client.interceptors.request.use(
      request => {
        logger.debug('Telco API request', {
          provider: config.provider,
          method: request.method,
          url: request.url
        });
        return request;
      },
      error => {
        logger.error('Telco API request error', error);
        return Promise.reject(error);
      }
    );

    client.interceptors.response.use(
      response => {
        logger.debug('Telco API response', {
          provider: config.provider,
          status: response.status
        });
        return response;
      },
      error => {
        logger.error('Telco API response error', {
          provider: config.provider,
          error: error.message,
          response: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    this.clients.set(config.provider, client);

    // Create rate limiter (100 messages per minute per provider)
    const rateLimiter = new RateLimiterMemory({
      points: 100,
      duration: 60
    });
    this.rateLimiters.set(config.provider, rateLimiter);
  }

  /**
   * Send SMS through telco provider
   */
  async sendSMS(message: SMSResponse & { provider: TelcoProvider }): Promise<string> {
    const provider = message.provider;
    const config = this.providers.get(provider);
    const client = this.clients.get(provider);
    const rateLimiter = this.rateLimiters.get(provider);

    if (!config || !client || !rateLimiter) {
      throw new SMSError('Provider not configured', 'PROVIDER_NOT_CONFIGURED');
    }

    try {
      // Check rate limit
      await rateLimiter.consume(message.to);

      // Format request based on provider
      const request = this.formatSMSRequest(provider, message, config);

      // Send SMS
      const response = await client.post('/sms/send', request);
      const data = response.data as TelcoAPIResponse;

      if (data.error) {
        throw new SMSError(data.error, 'TELCO_API_ERROR');
      }

      logger.info('SMS sent successfully', {
        messageId: data.messageId,
        to: message.to,
        provider
      });

      return data.messageId;
    } catch (error) {
      if (error instanceof SMSError) {
        throw error;
      }

      // Handle rate limit error
      if (error?.constructor?.name === 'RateLimiterError') {
        throw new SMSError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
      }

      // Handle network errors
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        throw new SMSError(message, 'NETWORK_ERROR', status);
      }

      throw new SMSError('Failed to send SMS', 'SEND_FAILED');
    }
  }

  /**
   * Format SMS request based on provider API
   */
  private formatSMSRequest(
    provider: TelcoProvider,
    message: SMSResponse,
    config: TelcoConfig
  ): any {
    switch (provider) {
      case TelcoProvider.ORANGE:
        return {
          sender: config.senderId,
          recipient: this.formatPhoneNumber(message.to),
          message: message.message,
          priority: message.priority === 'high' ? 1 : 0,
          callback_url: `${process.env.CALLBACK_BASE_URL}/delivery-report`
        };

      case TelcoProvider.AFRICELL:
        return {
          from: config.senderId,
          to: this.formatPhoneNumber(message.to),
          text: message.message,
          type: 'text',
          delivery_report: true
        };

      case TelcoProvider.QCELL:
        return {
          source: config.senderId,
          destination: this.formatPhoneNumber(message.to),
          content: message.message,
          contentType: 'text',
          requestDeliveryReport: true
        };

      default:
        throw new SMSError('Unknown provider', 'UNKNOWN_PROVIDER');
    }
  }

  /**
   * Handle delivery report webhook
   */
  async handleDeliveryReport(provider: TelcoProvider, data: any): Promise<void> {
    try {
      const report = this.parseDeliveryReport(provider, data);
      
      logger.info('Delivery report received', {
        messageId: report.messageId,
        status: report.status,
        provider
      });

      // Execute callback if registered
      const callback = this.deliveryCallbacks.get(report.messageId);
      if (callback) {
        callback(report);
        this.deliveryCallbacks.delete(report.messageId);
      }
    } catch (error) {
      logger.error('Error processing delivery report', error);
    }
  }

  /**
   * Parse delivery report based on provider format
   */
  private parseDeliveryReport(provider: TelcoProvider, data: any): DeliveryReport {
    switch (provider) {
      case TelcoProvider.ORANGE:
        return {
          messageId: data.message_id,
          status: this.mapDeliveryStatus(data.status),
          deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
          error: data.error_message
        };

      case TelcoProvider.AFRICELL:
        return {
          messageId: data.messageId,
          status: this.mapDeliveryStatus(data.deliveryStatus),
          deliveredAt: data.deliveryTime ? new Date(data.deliveryTime) : undefined,
          error: data.errorDescription
        };

      case TelcoProvider.QCELL:
        return {
          messageId: data.msgId,
          status: this.mapDeliveryStatus(data.dlrStatus),
          deliveredAt: data.dlrTime ? new Date(data.dlrTime) : undefined,
          error: data.dlrError
        };

      default:
        throw new Error('Unknown provider');
    }
  }

  /**
   * Map provider delivery status to internal status
   */
  private mapDeliveryStatus(providerStatus: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      // Orange statuses
      'delivered': MessageStatus.DELIVERED,
      'failed': MessageStatus.FAILED,
      'pending': MessageStatus.SENT,
      
      // Africell statuses
      'DELIVERED': MessageStatus.DELIVERED,
      'FAILED': MessageStatus.FAILED,
      'SENT': MessageStatus.SENT,
      
      // Qcell statuses
      'DELIVRD': MessageStatus.DELIVERED,
      'UNDELIV': MessageStatus.FAILED,
      'ACCEPTD': MessageStatus.SENT
    };

    return statusMap[providerStatus] || MessageStatus.FAILED;
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('232')) {
      cleaned = '232' + cleaned;
    }
    
    return '+' + cleaned;
  }

  /**
   * Register delivery callback
   */
  onDeliveryReport(messageId: string, callback: (report: DeliveryReport) => void): void {
    this.deliveryCallbacks.set(messageId, callback);
  }

  /**
   * Get provider health status
   */
  async checkHealth(provider: TelcoProvider): Promise<boolean> {
    const client = this.clients.get(provider);
    if (!client) {
      return false;
    }

    try {
      const response = await client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('Provider health check failed', { provider, error });
      return false;
    }
  }

  /**
   * Get best available provider based on health and load
   */
  async getBestProvider(phoneNumber: string): Promise<TelcoProvider> {
    // Determine provider by phone number prefix
    const cleaned = phoneNumber.replace(/\D/g, '');
    const prefix = cleaned.substring(cleaned.length - 8, cleaned.length - 6);
    
    // Sierra Leone mobile prefixes
    const providerPrefixes: Record<string, TelcoProvider> = {
      '76': TelcoProvider.ORANGE,
      '77': TelcoProvider.ORANGE,
      '78': TelcoProvider.AFRICELL,
      '88': TelcoProvider.AFRICELL,
      '99': TelcoProvider.AFRICELL,
      '30': TelcoProvider.QCELL,
      '31': TelcoProvider.QCELL,
      '32': TelcoProvider.QCELL,
      '33': TelcoProvider.QCELL,
      '34': TelcoProvider.QCELL
    };

    const provider = providerPrefixes[prefix];
    if (!provider) {
      throw new SMSError('Unknown phone number prefix', 'UNKNOWN_PREFIX');
    }

    // Check if provider is healthy
    const isHealthy = await this.checkHealth(provider);
    if (!isHealthy) {
      // Try to find alternative healthy provider
      for (const [_, altProvider] of this.providers) {
        if (altProvider.provider !== provider) {
          const altHealthy = await this.checkHealth(altProvider.provider);
          if (altHealthy) {
            logger.warn('Using alternative provider due to health check failure', {
              original: provider,
              alternative: altProvider.provider
            });
            return altProvider.provider;
          }
        }
      }
      
      // If no healthy provider, still use the original
      logger.error('No healthy providers available, using original');
    }

    return provider;
  }
}