/**
 * Alert manager for sending notifications
 */

import nodemailer from 'nodemailer';
import axios from 'axios';
import { Alert } from '../types';
import { logger } from '../utils/logger';

interface AlertConfig {
  email?: string[];
  sms?: string[];
  webhook?: string;
}

export class AlertManager {
  private config: AlertConfig;
  private emailTransporter?: nodemailer.Transporter;

  constructor(config: AlertConfig) {
    this.config = config;
    
    // Setup email transporter if configured
    if (config.email && config.email.length > 0) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Send an alert through all configured channels
   */
  async sendAlert(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send email alerts
    if (this.config.email && this.emailTransporter) {
      promises.push(this.sendEmailAlert(alert));
    }

    // Send SMS alerts
    if (this.config.sms && this.config.sms.length > 0) {
      promises.push(this.sendSMSAlert(alert));
    }

    // Send webhook alerts
    if (this.config.webhook) {
      promises.push(this.sendWebhookAlert(alert));
    }

    // Wait for all alerts to be sent
    const results = await Promise.allSettled(promises);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Failed to send alert', {
          channel: ['email', 'sms', 'webhook'][index],
          error: result.reason
        });
      }
    });
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.emailTransporter || !this.config.email) {
      return;
    }

    const subject = `[ETL Pipeline ${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = this.formatEmailBody(alert);

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'etl-alerts@landmarking.gov.sl',
        to: this.config.email.join(', '),
        subject,
        html
      });

      logger.info('Email alert sent', {
        alertId: alert.id,
        recipients: this.config.email.length
      });
    } catch (error) {
      logger.error('Failed to send email alert', error);
      throw error;
    }
  }

  /**
   * Send SMS alert (via SMS gateway service)
   */
  private async sendSMSAlert(alert: Alert): Promise<void> {
    if (!this.config.sms || this.config.sms.length === 0) {
      return;
    }

    const message = `ETL Alert: ${alert.title}. ${alert.message}. Severity: ${alert.severity}`;
    
    try {
      // Send to SMS gateway service
      const smsGatewayUrl = process.env.SMS_GATEWAY_URL || 'http://localhost:3001/api/admin/test/sms';
      
      for (const phoneNumber of this.config.sms) {
        await axios.post(
          smsGatewayUrl,
          {
            to: phoneNumber,
            message: message.substring(0, 160) // Limit to SMS length
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.SMS_GATEWAY_API_KEY}`
            }
          }
        );
      }

      logger.info('SMS alerts sent', {
        alertId: alert.id,
        recipients: this.config.sms.length
      });
    } catch (error) {
      logger.error('Failed to send SMS alert', error);
      throw error;
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.webhook) {
      return;
    }

    try {
      await axios.post(this.config.webhook, {
        alert,
        timestamp: new Date().toISOString(),
        service: 'etl-pipeline'
      });

      logger.info('Webhook alert sent', {
        alertId: alert.id,
        webhook: this.config.webhook
      });
    } catch (error) {
      logger.error('Failed to send webhook alert', error);
      throw error;
    }
  }

  /**
   * Format email body
   */
  private formatEmailBody(alert: Alert): string {
    const severityColors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${severityColors[alert.severity]}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f4f4f4; padding: 20px; border-radius: 0 0 5px 5px; }
          .metadata { background-color: #e9ecef; padding: 10px; margin-top: 15px; border-radius: 3px; }
          .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
          pre { background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${alert.title}</h2>
            <p><strong>Type:</strong> ${alert.type} | <strong>Severity:</strong> ${alert.severity}</p>
          </div>
          <div class="content">
            <p><strong>Message:</strong></p>
            <p>${alert.message}</p>
            
            <p><strong>Source:</strong> ${alert.source}</p>
            <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
            <p><strong>Status:</strong> ${alert.resolved ? 'Resolved' : 'Active'}</p>
            
            ${alert.metadata ? `
              <div class="metadata">
                <strong>Additional Details:</strong>
                <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>This is an automated alert from the LandMarking ETL Pipeline</p>
            <p>Alert ID: ${alert.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test alert configuration
   */
  async testAlerts(): Promise<void> {
    const testAlert: Alert = {
      id: 'test-' + Date.now(),
      type: 'info',
      severity: 'low',
      title: 'Test Alert',
      message: 'This is a test alert to verify configuration',
      source: 'AlertManager',
      timestamp: new Date(),
      resolved: false
    };

    await this.sendAlert(testAlert);
  }
}