// Generate test data using CommonJS
const path = require('path');
const fs = require('fs');

// Simple mock data generator for testing
const districts = [
  'Kailahun', 'Kenema', 'Kono',
  'Bombali', 'Falaba', 'Koinadugu', 'Tonkolili',
  'Kambia', 'Karene', 'Port Loko',
  'Bo', 'Bonthe', 'Moyamba', 'Pujehun',
  'Western Area Rural', 'Western Area Urban'
];

const firstNames = ['Mohamed', 'Fatmata', 'Ibrahim', 'Aminata', 'Abu', 'Isata'];
const surnames = ['Kamara', 'Sesay', 'Koroma', 'Bangura', 'Conteh', 'Jalloh'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMLHCPRecord(index) {
  const district = randomElement(districts);
  const firstName = randomElement(firstNames);
  const surname = randomElement(surnames);
  
  return {
    landId: `${district.substring(0, 2).toUpperCase()}/LS/${String(index).padStart(6, '0')}/2024`,
    registryNumber: `VOL${Math.floor(Math.random() * 500)}-${index}`,
    pageNumber: String(Math.floor(Math.random() * 300)),
    ownerName: `${firstName} ${surname}`,
    ownerAddress: `${Math.floor(Math.random() * 200)} Main Road, ${district}`,
    landType: randomElement(['residential', 'commercial', 'agricultural']),
    size: {
      value: (Math.random() * 5 + 0.1).toFixed(2),
      unit: 'acres'
    },
    district: district,
    registrationDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0]
  };
}

// Create test data directory
const testDataDir = path.join(__dirname, '..', 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Generate 100 sample records
const mlhcpRecords = [];
for (let i = 1; i <= 100; i++) {
  mlhcpRecords.push(generateMLHCPRecord(i));
}

// Save to file
fs.writeFileSync(
  path.join(testDataDir, 'sample-mlhcp-records.json'),
  JSON.stringify(mlhcpRecords, null, 2)
);

console.log(`✓ Generated ${mlhcpRecords.length} sample MLHCP records`);
console.log(`✓ Test data saved to ${testDataDir}`);