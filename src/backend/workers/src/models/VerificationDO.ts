/**
 * Durable Object for storing verification records persistently
 * This ensures data survives worker restarts and provides consistency
 */

import { DurableObject } from 'cloudflare:workers';
import { VerificationRecord, VerificationParty, PartySignature } from '../../../services/verification/types';

export class VerificationDO extends DurableObject {
  /**
   * Get a verification record
   */
  async getVerification(verificationId: string): Promise<VerificationRecord | null> {
    const stored = await this.ctx.storage.get<VerificationRecord>(`verification:${verificationId}`);
    return stored || null;
  }

  /**
   * Store a verification record
   */
  async storeVerification(record: VerificationRecord): Promise<void> {
    await this.ctx.storage.put(`verification:${record.id}`, record);
    
    // Also store in index for listing
    const index = await this.ctx.storage.get<string[]>('verification:index') || [];
    if (!index.includes(record.id)) {
      index.push(record.id);
      await this.ctx.storage.put('verification:index', index);
    }
  }

  /**
   * Update verification record
   */
  async updateVerification(verificationId: string, updates: Partial<VerificationRecord>): Promise<void> {
    const existing = await this.getVerification(verificationId);
    if (!existing) {
      throw new Error('Verification not found');
    }

    const updated = { ...existing, ...updates };
    await this.storeVerification(updated);
  }

  /**
   * List verifications with pagination
   */
  async listVerifications(options: {
    status?: string;
    parcelId?: string;
    limit: number;
    offset: number;
  }): Promise<{
    verifications: VerificationRecord[];
    total: number;
  }> {
    const index = await this.ctx.storage.get<string[]>('verification:index') || [];
    const allVerifications: VerificationRecord[] = [];

    // Load all verifications (in production, use cursor-based pagination)
    for (const id of index) {
      const record = await this.getVerification(id);
      if (record) {
        allVerifications.push(record);
      }
    }

    // Apply filters
    let filtered = allVerifications;
    if (options.status) {
      filtered = filtered.filter(v => v.status === options.status);
    }
    if (options.parcelId) {
      filtered = filtered.filter(v => v.parcelId === options.parcelId);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());

    // Paginate
    const total = filtered.length;
    const paginated = filtered.slice(options.offset, options.offset + options.limit);

    return { verifications: paginated, total };
  }

  /**
   * Add a party to verification
   */
  async addParty(verificationId: string, party: VerificationParty): Promise<void> {
    const record = await this.getVerification(verificationId);
    if (!record) {
      throw new Error('Verification not found');
    }

    record.parties.push(party);
    record.history.push({
      action: `Added party: ${party.name} (${party.role})`,
      performedBy: 'system',
      timestamp: new Date()
    });

    await this.storeVerification(record);
  }

  /**
   * Add a signature to verification
   */
  async addSignature(verificationId: string, signature: PartySignature): Promise<void> {
    const record = await this.getVerification(verificationId);
    if (!record) {
      throw new Error('Verification not found');
    }

    record.signatures.push(signature);
    record.currentSignatures++;
    record.history.push({
      action: `Collected signature from party ${signature.partyId}`,
      performedBy: 'system',
      timestamp: new Date()
    });

    await this.storeVerification(record);
  }

  /**
   * Clean up expired verifications (called periodically)
   */
  async cleanupExpired(): Promise<number> {
    const index = await this.ctx.storage.get<string[]>('verification:index') || [];
    const now = new Date();
    let cleaned = 0;

    for (const id of index) {
      const record = await this.getVerification(id);
      if (record && new Date(record.expiresAt) < now && record.status === 'pending') {
        record.status = 'expired';
        await this.storeVerification(record);
        cleaned++;
      }
    }

    return cleaned;
  }
}