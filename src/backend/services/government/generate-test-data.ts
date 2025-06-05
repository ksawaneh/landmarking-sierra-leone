import { generateCompleteRecordSet } from './mock-data/sierra-leone-data-generator';
import * as fs from 'fs';
import * as path from 'path';

const testData = generateCompleteRecordSet({
  count: 1000,
  includeDisputes: true,
  dataQualityIssues: true
});

const outputDir = path.join(__dirname, '../../../../test-data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'mlhcp-records.json'),
  JSON.stringify(testData.mlhcp, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'nra-records.json'),
  JSON.stringify(testData.nra, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'oarg-records.json'),
  JSON.stringify(testData.oarg, null, 2)
);

console.log(`✓ Generated ${testData.mlhcp.length} MLHCP records`);
console.log(`✓ Generated ${testData.nra.length} NRA records`);
console.log(`✓ Generated ${testData.oarg.length} OARG records`);
console.log(`✓ Test data saved to ${outputDir}`);
