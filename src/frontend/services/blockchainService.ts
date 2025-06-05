import { api } from '../api/axios';
import { offlineSync } from './offlineSync';

// Types
export interface TransactionRecord {
  id: string;
  parcelId: string;
  transactionType: 'creation' | 'modification' | 'verification' | 'transfer';
  timestamp: number;
  hash: string;
  userId: string;
  details: any;
  blockHeight?: number;
  confirmed: boolean;
  signature?: string;
}

export interface BlockchainVerification {
  isValid: boolean;
  blockHeight?: number;
  timestamp?: number;
  transactionId?: string;
  errorMessage?: string;
}

// Constants
const BLOCKCHAIN_API_URL = process.env.NEXT_PUBLIC_BLOCKCHAIN_API_URL || '/api/blockchain';
const MOCK_MODE = process.env.NEXT_PUBLIC_BLOCKCHAIN_MOCK_MODE === 'true';

/**
 * Service for interacting with blockchain for transaction records
 */
export const blockchainService = {
  /**
   * Create a new transaction record on the blockchain
   */
  async createTransaction(
    parcelId: string,
    transactionType: TransactionRecord['transactionType'],
    details: any,
    userId: string,
    signature?: string
  ): Promise<TransactionRecord> {
    try {
      // Check if offline
      if (!offlineSync.isOnline()) {
        return this.queueOfflineTransaction(
          parcelId,
          transactionType,
          details,
          userId,
          signature
        );
      }

      // In mock mode, use mock implementation
      if (MOCK_MODE) {
        return this.mockCreateTransaction(
          parcelId,
          transactionType,
          details,
          userId,
          signature
        );
      }

      // Create the transaction data
      const transactionData = {
        parcelId,
        transactionType,
        details,
        userId,
        signature,
        timestamp: Date.now()
      };

      // Send to blockchain API
      const response = await api.post(
        `${BLOCKCHAIN_API_URL}/transactions`,
        transactionData
      );

      return response.data;
    } catch (error) {
      console.error('Error creating blockchain transaction:', error);
      
      // If API call fails, fall back to offline mode
      return this.queueOfflineTransaction(
        parcelId,
        transactionType,
        details,
        userId,
        signature
      );
    }
  },

  /**
   * Get all transactions for a specific parcel
   */
  async getParcelTransactions(parcelId: string): Promise<TransactionRecord[]> {
    try {
      // Check if offline
      if (!offlineSync.isOnline()) {
        return this.getOfflineParcelTransactions(parcelId);
      }

      // In mock mode, use mock implementation
      if (MOCK_MODE) {
        return this.mockGetParcelTransactions(parcelId);
      }

      // Fetch from blockchain API
      const response = await api.get(
        `${BLOCKCHAIN_API_URL}/transactions/parcel/${parcelId}`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching parcel transactions:', error);
      
      // If API call fails, fall back to offline mode
      return this.getOfflineParcelTransactions(parcelId);
    }
  },

  /**
   * Verify a transaction on the blockchain
   */
  async verifyTransaction(transactionId: string): Promise<BlockchainVerification> {
    try {
      // Check if offline
      if (!offlineSync.isOnline()) {
        return {
          isValid: false,
          errorMessage: 'Cannot verify transaction while offline'
        };
      }

      // In mock mode, use mock implementation
      if (MOCK_MODE) {
        return this.mockVerifyTransaction(transactionId);
      }

      // Verify with blockchain API
      const response = await api.get(
        `${BLOCKCHAIN_API_URL}/transactions/verify/${transactionId}`
      );

      return response.data;
    } catch (error) {
      console.error('Error verifying transaction:', error);
      
      return {
        isValid: false,
        errorMessage: 'Failed to verify transaction'
      };
    }
  },

  /**
   * Queue a transaction for offline sync
   */
  queueOfflineTransaction(
    parcelId: string,
    transactionType: TransactionRecord['transactionType'],
    details: any,
    userId: string,
    signature?: string
  ): TransactionRecord {
    // Generate a temporary transaction with a fake hash
    const tempTransaction: TransactionRecord = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parcelId,
      transactionType,
      timestamp: Date.now(),
      hash: `temp_hash_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      details,
      confirmed: false,
      signature
    };

    // Store in local storage
    this.storeOfflineTransaction(tempTransaction);

    return tempTransaction;
  },

  /**
   * Store a transaction in local storage for offline use
   */
  storeOfflineTransaction(transaction: TransactionRecord): void {
    try {
      // Get existing transactions
      const existingTransactions = this.getOfflineTransactions();
      
      // Add new transaction
      existingTransactions.push(transaction);
      
      // Save back to localStorage
      localStorage.setItem(
        'blockchain_offline_transactions',
        JSON.stringify(existingTransactions)
      );
    } catch (error) {
      console.error('Error storing offline transaction:', error);
    }
  },

  /**
   * Get all offline transactions
   */
  getOfflineTransactions(): TransactionRecord[] {
    try {
      const transactions = localStorage.getItem('blockchain_offline_transactions');
      return transactions ? JSON.parse(transactions) : [];
    } catch (error) {
      console.error('Error fetching offline transactions:', error);
      return [];
    }
  },

  /**
   * Get all offline transactions for a specific parcel
   */
  getOfflineParcelTransactions(parcelId: string): TransactionRecord[] {
    const allTransactions = this.getOfflineTransactions();
    return allTransactions.filter(tx => tx.parcelId === parcelId);
  },

  /**
   * Sync offline transactions when back online
   */
  async syncOfflineTransactions(): Promise<void> {
    // Check if online
    if (!offlineSync.isOnline()) {
      return;
    }

    try {
      const offlineTransactions = this.getOfflineTransactions();
      
      // Filter for unconfirmed transactions
      const unconfirmedTransactions = offlineTransactions.filter(tx => !tx.confirmed);
      
      // If no unconfirmed transactions, no need to sync
      if (unconfirmedTransactions.length === 0) {
        return;
      }

      // Post all unconfirmed transactions to the API
      const syncPromises = unconfirmedTransactions.map(async (tx) => {
        try {
          // Skip mock mode for syncing
          if (MOCK_MODE) return;
          
          // Create the transaction data
          const transactionData = {
            id: tx.id.startsWith('temp_') ? undefined : tx.id, // Remove temp ID
            parcelId: tx.parcelId,
            transactionType: tx.transactionType,
            details: tx.details,
            userId: tx.userId,
            signature: tx.signature,
            timestamp: tx.timestamp
          };

          // Send to blockchain API
          const response = await api.post(
            `${BLOCKCHAIN_API_URL}/transactions`,
            transactionData
          );

          return response.data;
        } catch (error) {
          console.error(`Error syncing transaction ${tx.id}:`, error);
          return null;
        }
      });

      // Wait for all syncs to complete
      const results = await Promise.all(syncPromises);
      
      // Update offline transactions with confirmed ones
      const newOfflineTransactions = [...offlineTransactions];
      
      results.forEach((result, index) => {
        if (result) {
          // If sync succeeded, update the corresponding transaction
          const txIndex = newOfflineTransactions.findIndex(
            tx => tx.id === unconfirmedTransactions[index].id
          );
          
          if (txIndex !== -1) {
            newOfflineTransactions[txIndex] = {
              ...result,
              confirmed: true
            };
          }
        }
      });
      
      // Save updated transactions back to localStorage
      localStorage.setItem(
        'blockchain_offline_transactions',
        JSON.stringify(newOfflineTransactions)
      );
    } catch (error) {
      console.error('Error syncing offline transactions:', error);
    }
  },

  /**
   * Mock implementations for testing and offline use
   */
  mockCreateTransaction(
    parcelId: string,
    transactionType: TransactionRecord['transactionType'],
    details: any,
    userId: string,
    signature?: string
  ): TransactionRecord {
    // Create a mock transaction
    const mockTransaction: TransactionRecord = {
      id: `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parcelId,
      transactionType,
      timestamp: Date.now(),
      hash: `mock_hash_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      details,
      blockHeight: Math.floor(Math.random() * 1000) + 100000, // Random block height
      confirmed: true,
      signature
    };

    // Store in local storage for persistence
    this.storeOfflineTransaction(mockTransaction);

    return mockTransaction;
  },

  mockGetParcelTransactions(parcelId: string): TransactionRecord[] {
    // Get any existing mock transactions first
    const existingTransactions = this.getOfflineParcelTransactions(parcelId);
    
    // If we already have transactions for this parcel, return them
    if (existingTransactions.length > 0) {
      return existingTransactions;
    }
    
    // Otherwise generate some mock transactions
    const mockTransactions: TransactionRecord[] = [];
    
    // Creation transaction
    mockTransactions.push({
      id: `mock_tx_creation_${parcelId}`,
      parcelId,
      transactionType: 'creation',
      timestamp: Date.now() - 86400000 * 30, // 30 days ago
      hash: `mock_hash_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_1',
      details: { action: 'created' },
      blockHeight: 100000,
      confirmed: true
    });
    
    // Modification transaction
    mockTransactions.push({
      id: `mock_tx_modification_${parcelId}`,
      parcelId,
      transactionType: 'modification',
      timestamp: Date.now() - 86400000 * 15, // 15 days ago
      hash: `mock_hash_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_1',
      details: { action: 'updated boundary' },
      blockHeight: 100100,
      confirmed: true
    });
    
    // Verification transaction
    mockTransactions.push({
      id: `mock_tx_verification_${parcelId}`,
      parcelId,
      transactionType: 'verification',
      timestamp: Date.now() - 86400000 * 5, // 5 days ago
      hash: `mock_hash_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_2',
      details: { action: 'verified', witnesses: ['Person A', 'Person B'] },
      blockHeight: 100200,
      confirmed: true
    });
    
    // Store in local storage for persistence
    mockTransactions.forEach(tx => this.storeOfflineTransaction(tx));
    
    return mockTransactions;
  },

  mockVerifyTransaction(transactionId: string): BlockchainVerification {
    // Get existing transactions
    const allTransactions = this.getOfflineTransactions();
    const transaction = allTransactions.find(tx => tx.id === transactionId);
    
    if (!transaction) {
      return {
        isValid: false,
        errorMessage: 'Transaction not found'
      };
    }
    
    // Mock a successful verification
    return {
      isValid: true,
      blockHeight: transaction.blockHeight || Math.floor(Math.random() * 1000) + 100000,
      timestamp: transaction.timestamp,
      transactionId: transaction.id
    };
  }
};

export default blockchainService;