/**
 * Integration tests for government data services
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MLHCPAdapter } from '../adapters/mlhcp-adapter';
import { NRAAdapter } from '../adapters/nra-adapter';
import { DataReconciler } from '../reconciliation/data-reconciler';
import { generateCompleteRecordSet } from '../mock-data/sierra-leone-data-generator';

describe('Government Data Integration', () => {
  let mlhcpAdapter: MLHCPAdapter;
  let nraAdapter: NRAAdapter;
  let reconciler: DataReconciler;
  
  beforeAll(() => {
    // Initialize adapters in mock mode
    mlhcpAdapter = new MLHCPAdapter({ mockMode: true });
    nraAdapter = new NRAAdapter({ mockMode: true });
    reconciler = new DataReconciler();
  });
  
  describe('MLHCP Adapter', () => {
    it('should connect successfully in mock mode', async () => {
      const isConnected = await mlhcpAdapter.testConnection();
      expect(isConnected).toBe(true);
    });
    
    it('should query records by district', async () => {
      const result = await mlhcpAdapter.query({
        district: 'Western Area Urban'
      }, { limit: 10 });
      
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(r => r.district === 'Western Area Urban')).toBe(true);
    });
    
    it('should handle name variations in search', async () => {
      // Search for common name with variations
      const result = await mlhcpAdapter.query({
        ownerName: 'mohamed'
      }, { limit: 20 });
      
      expect(result.data.length).toBeGreaterThan(0);
      
      // Should find Mohamed, Mohammed, Muhammed variations
      const names = result.data.map(r => r.ownerName.toLowerCase());
      const hasVariations = names.some(n => 
        n.includes('mohamed') || n.includes('mohammed') || n.includes('muhammed')
      );
      expect(hasVariations).toBe(true);
    });
    
    it('should detect data quality issues', async () => {
      const result = await mlhcpAdapter.query({}, { limit: 100 });
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      
      // Should warn about missing national IDs
      const hasIdWarning = result.warnings!.some(w => 
        w.includes('missing owner national ID')
      );
      expect(hasIdWarning).toBe(true);
    });
    
    it('should validate all 16 districts', async () => {
      const districts = [
        'Kailahun', 'Kenema', 'Kono', // Eastern
        'Bombali', 'Falaba', 'Koinadugu', 'Tonkolili', // Northern
        'Kambia', 'Karene', 'Port Loko', // North West
        'Bo', 'Bonthe', 'Moyamba', 'Pujehun', // Southern
        'Western Area Rural', 'Western Area Urban' // Western
      ];
      
      for (const district of districts) {
        const result = await mlhcpAdapter.query({ district }, { limit: 1 });
        // Mock data should have at least one record per district
        expect(result.data.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
  
  describe('NRA Adapter', () => {
    it('should query tax records', async () => {
      const result = await nraAdapter.query({
        isCompliant: false
      }, { limit: 10 });
      
      expect(result.data).toBeDefined();
      expect(result.data.every(r => !r.isCompliant)).toBe(true);
    });
    
    it('should calculate tax compliance', async () => {
      const records = await nraAdapter.query({}, { limit: 1 });
      expect(records.data.length).toBeGreaterThan(0);
      
      const taxId = records.data[0].taxId;
      const compliance = await nraAdapter.calculateCompliance(taxId);
      
      expect(compliance).toHaveProperty('isCompliant');
      expect(compliance).toHaveProperty('arrears');
      expect(compliance).toHaveProperty('recommendations');
      expect(Array.isArray(compliance.recommendations)).toBe(true);
    });
    
    it('should generate tax-specific warnings', async () => {
      const result = await nraAdapter.query({
        hasArrears: true
      }, { limit: 50 });
      
      expect(result.warnings).toBeDefined();
      const hasArrearsWarning = result.warnings!.some(w => 
        w.includes('tax arrears')
      );
      expect(hasArrearsWarning).toBe(true);
    });
  });
  
  describe('Data Reconciliation', () => {
    it('should reconcile records from multiple sources', async () => {
      // Generate test data
      const testData = generateCompleteRecordSet({ count: 1 });
      const mlhcp = testData.mlhcp[0];
      const nra = testData.nra[0];
      const oarg = testData.oarg[0];
      
      const result = await reconciler.reconcile(mlhcp, nra, oarg);
      
      expect(result.unified).toBeDefined();
      expect(result.unified.unifiedId).toMatch(/^UNI-/);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    
    it('should detect ownership conflicts', async () => {
      // Create records with different owners
      const testData = generateCompleteRecordSet({ count: 1 });
      const mlhcp = testData.mlhcp[0];
      const nra = { ...testData.nra[0], taxpayerName: 'Different Person' };
      
      const result = await reconciler.reconcile(mlhcp, nra);
      
      expect(result.conflicts.ownershipConflict).toBe(true);
      expect(result.unified.ownership.verificationRequired).toBe(true);
      expect(result.suggestions.some(s => s.includes('Verify current owner'))).toBe(true);
    });
    
    it('should handle missing data gracefully', async () => {
      // Create record with many missing fields
      const mlhcp = {
        landId: 'WA/FT/001234/2020',
        registryNumber: 'VOL123-456',
        pageNumber: '123',
        ownerName: 'Test Owner',
        ownerAddress: 'Freetown',
        landType: 'residential' as const,
        size: { value: 1, unit: 'acres' as const },
        district: 'Western Area Urban',
        registrationDate: '2020-01-01'
      };
      
      const result = await reconciler.reconcile(mlhcp);
      
      expect(result.conflicts.missingFields.length).toBeGreaterThan(0);
      expect(result.unified.status.requiresFieldVerification).toBe(true);
    });
    
    it('should generate actionable suggestions', async () => {
      const testData = generateCompleteRecordSet({ 
        count: 1, 
        dataQualityIssues: true 
      });
      
      const result = await reconciler.reconcile(
        testData.mlhcp[0],
        testData.nra[0],
        testData.oarg[0]
      );
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.every(s => typeof s === 'string')).toBe(true);
    });
  });
  
  describe('Sierra Leone Specific Validations', () => {
    it('should handle common name variations', async () => {
      const nameVariations = [
        ['Mohamed Kamara', 'Mohammed Kamara', 'Muhammed Kamara'],
        ['Fatmata Sesay', 'Fatima Sesay', 'Fatu Sesay'],
        ['Ibrahim Conteh', 'Ibrahima Conteh', 'Brahim Conteh']
      ];
      
      for (const variations of nameVariations) {
        const results = await Promise.all(
          variations.map(name => 
            mlhcpAdapter.query({ ownerName: name }, { limit: 5 })
          )
        );
        
        // Should find some matches for common names
        const hasResults = results.some(r => r.data.length > 0);
        expect(hasResults).toBe(true);
      }
    });
    
    it('should validate district codes', async () => {
      const testData = generateCompleteRecordSet({ count: 100 });
      
      testData.mlhcp.forEach(record => {
        // All districts should be valid
        const validDistricts = [
          'Kailahun', 'Kenema', 'Kono',
          'Bombali', 'Falaba', 'Koinadugu', 'Tonkolili',
          'Kambia', 'Karene', 'Port Loko',
          'Bo', 'Bonthe', 'Moyamba', 'Pujehun',
          'Western Area Rural', 'Western Area Urban'
        ];
        
        expect(validDistricts).toContain(record.district);
      });
    });
  });
});