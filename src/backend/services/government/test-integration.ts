/**
 * Test file demonstrating government data integration
 * Run with: npx ts-node test-integration.ts
 */

import { MLHCPAdapter } from './adapters/mlhcp-adapter';
import { DataReconciler } from './reconciliation/data-reconciler';
import { generateCompleteRecordSet } from './mock-data/sierra-leone-data-generator';

async function demonstrateIntegration() {
  console.log('🚀 Sierra Leone Land Registry - Government Integration Demo\n');
  
  // Initialize MLHCP adapter in mock mode
  const mlhcpAdapter = new MLHCPAdapter({ mockMode: true });
  
  // Test connection
  console.log('Testing MLHCP connection...');
  const isConnected = await mlhcpAdapter.testConnection();
  console.log(`✅ MLHCP Connection: ${isConnected ? 'SUCCESS' : 'FAILED'}\n`);
  
  // Query some records
  console.log('Querying land records in Freetown (Western Area Urban)...');
  const freeTownRecords = await mlhcpAdapter.query({
    district: 'Western Area Urban',
    landType: 'residential'
  }, { limit: 5 });
  
  console.log(`Found ${freeTownRecords.metadata.recordCount} records:`);
  freeTownRecords.data.forEach((record, i) => {
    console.log(`\n${i + 1}. Land ID: ${record.landId}`);
    console.log(`   Owner: ${record.ownerName}`);
    console.log(`   Size: ${record.size.value} ${record.size.unit}`);
    console.log(`   Address: ${record.address || record.district}`);
    console.log(`   Boundaries: ${Object.keys(record.boundaries || {}).filter(k => record.boundaries![k]).length}/4 defined`);
  });
  
  // Show data quality warnings
  if (freeTownRecords.warnings?.length) {
    console.log('\n⚠️  Data Quality Warnings:');
    freeTownRecords.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  // Demonstrate reconciliation
  console.log('\n\n📊 Demonstrating Data Reconciliation...\n');
  
  // Generate test data with conflicts
  const testData = generateCompleteRecordSet({ 
    count: 1, 
    dataQualityIssues: true 
  });
  
  const mlhcpRecord = testData.mlhcp[0];
  const nraRecord = testData.nra[0];
  const oargRecord = testData.oarg[0];
  
  console.log('Source Records:');
  console.log(`- MLHCP: Owner "${mlhcpRecord.ownerName}", Land ID: ${mlhcpRecord.landId}`);
  console.log(`- NRA: Taxpayer "${nraRecord?.taxpayerName}", Tax ID: ${nraRecord?.taxId}`);
  console.log(`- OARG: Grantee "${oargRecord?.grantee.name}", Deed: ${oargRecord?.deedNumber}`);
  
  // Reconcile the records
  const reconciler = new DataReconciler();
  const result = await reconciler.reconcile(mlhcpRecord, nraRecord, oargRecord);
  
  console.log('\n🔄 Reconciliation Result:');
  console.log(`- Unified ID: ${result.unified.unifiedId}`);
  console.log(`- Owner: ${result.unified.ownership.currentOwner.name}`);
  console.log(`- Confidence: ${(result.unified.ownership.currentOwner.confidence * 100).toFixed(1)}%`);
  console.log(`- Overall Quality: ${result.unified.status.dataQuality}`);
  console.log(`- Verification Required: ${result.unified.ownership.verificationRequired ? 'YES' : 'NO'}`);
  
  if (result.conflicts.nameVariations.length > 0) {
    console.log(`\n⚠️  Name Variations Detected:`);
    result.conflicts.nameVariations.forEach(name => console.log(`   - ${name}`));
  }
  
  if (result.suggestions.length > 0) {
    console.log('\n💡 Recommendations:');
    result.suggestions.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
  }
  
  // Demonstrate search with name variations
  console.log('\n\n🔍 Demonstrating Name Search with Variations...\n');
  
  const searchResults = await mlhcpAdapter.query({
    ownerName: 'Mohamed Kamara' // Common name
  }, { limit: 3 });
  
  console.log(`Found ${searchResults.metadata.recordCount} records for "Mohamed Kamara":`);
  searchResults.data.forEach((record, i) => {
    console.log(`${i + 1}. ${record.ownerName} - ${record.landId} (${record.district})`);
  });
  
  // Show adapter metrics
  console.log('\n\n📈 Adapter Metrics:');
  const metrics = mlhcpAdapter.getMetrics();
  console.log(`- Adapter: ${metrics.name}`);
  console.log(`- Status: ${metrics.status}`);
  console.log(`- Mode: ${metrics.mockMode ? 'MOCK' : 'PRODUCTION'}`);
  
  console.log('\n✅ Integration demo completed successfully!');
}

// Run the demonstration
demonstrateIntegration().catch(console.error);