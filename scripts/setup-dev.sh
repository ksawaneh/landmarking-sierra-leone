#!/bin/bash

# Development Environment Setup Script for LandMarking Sierra Leone
# This script sets up the complete development environment

set -e  # Exit on any error

echo "🚀 Setting up LandMarking Development Environment..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo -e "\n📋 Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 20.x or higher"
    exit 1
else
    NODE_VERSION=$(node -v)
    print_status "Node.js $NODE_VERSION found"
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
else
    NPM_VERSION=$(npm -v)
    print_status "npm $NPM_VERSION found"
fi

if ! command_exists python3; then
    print_error "Python 3 is not installed. Please install Python 3.11 or higher"
    exit 1
else
    PYTHON_VERSION=$(python3 --version)
    print_status "$PYTHON_VERSION found"
fi

if ! command_exists docker; then
    print_warning "Docker is not installed. Some features may not work"
else
    DOCKER_VERSION=$(docker --version)
    print_status "$DOCKER_VERSION found"
fi

# Install global dependencies
echo -e "\n📦 Installing global dependencies..."

if ! command_exists yarn; then
    print_status "Installing Yarn..."
    npm install -g yarn
fi

# Frontend setup
echo -e "\n🎨 Setting up Frontend (Next.js)..."
cd src/frontend

if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    yarn install
else
    print_status "Frontend dependencies already installed"
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating frontend .env.local file..."
    cat > .env.local << EOL
# Frontend Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
NEXT_PUBLIC_ENABLE_OFFLINE=true
NEXT_PUBLIC_ENABLE_BLOCKCHAIN=false
EOL
    print_warning "Please update NEXT_PUBLIC_MAPBOX_TOKEN in src/frontend/.env.local"
fi

cd ../..

# Backend setup
echo -e "\n⚙️ Setting up Backend (Cloudflare Workers)..."
cd src/backend/workers

if [ ! -d "node_modules" ]; then
    print_status "Installing backend dependencies..."
    npm install
else
    print_status "Backend dependencies already installed"
fi

# Create .dev.vars if it doesn't exist
if [ ! -f ".dev.vars" ]; then
    print_status "Creating backend .dev.vars file..."
    cat > .dev.vars << EOL
# Backend Environment Variables
JWT_SECRET=dev_jwt_secret_change_in_production
ENVIRONMENT=development

# Government Integration (Mock Mode)
MLHCP_BASE_URL=mock
MLHCP_API_KEY=mock
NRA_BASE_URL=mock
NRA_API_KEY=mock
OARG_BASE_URL=mock
OARG_API_KEY=mock

# Database URLs (for future use)
DATABASE_URL=postgresql://user:password@localhost:5432/landmarking
MONGODB_URL=mongodb://localhost:27017/landmarking
EOL
    print_warning "Please update secrets in src/backend/workers/.dev.vars for production"
fi

cd ../../..

# AI Service setup
echo -e "\n🤖 Setting up AI Service (FastAPI)..."
cd src/ai

# Create Python virtual environment
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
print_status "Installing AI service dependencies..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    source venv/Scripts/activate
else
    # macOS/Linux
    source venv/bin/activate
fi

pip install --upgrade pip
pip install -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating AI service .env file..."
    cat > .env << EOL
# AI Service Environment Variables
ENVIRONMENT=development
PORT=8000
HOST=0.0.0.0

# AI Configuration
ENABLE_MOCK_MODE=true
SATELLITE_API_KEY=your_satellite_api_key_here
ML_MODEL_PATH=./models
EOL
fi

deactivate
cd ../..

# Create data directories
echo -e "\n📁 Creating data directories..."
mkdir -p data/{uploads,temp,cache,exports}
mkdir -p logs
mkdir -p test-data

# Initialize test data
echo -e "\n🗃️ Initializing test data..."
cd src/backend/services/government

if ! command_exists ts-node; then
    print_status "Installing ts-node..."
    npm install -g ts-node typescript
fi

print_status "Generating test data..."
cat > generate-test-data.ts << 'EOL'
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
EOL

ts-node generate-test-data.ts
rm generate-test-data.ts

cd ../../../..

# Docker setup (if Docker is available)
if command_exists docker; then
    echo -e "\n🐳 Setting up Docker environment..."
    
    # Create docker-compose.yml for local services
    if [ ! -f "docker-compose.yml" ]; then
        print_status "Creating docker-compose.yml..."
        cat > docker-compose.yml << 'EOL'
version: '3.8'

services:
  # PostgreSQL with PostGIS for spatial data
  postgres:
    image: postgis/postgis:15-3.3
    container_name: landmarking-postgres
    environment:
      POSTGRES_DB: landmarking
      POSTGRES_USER: landmarking
      POSTGRES_PASSWORD: landmarking_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # MongoDB for document storage
  mongodb:
    image: mongo:6
    container_name: landmarking-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: landmarking
      MONGO_INITDB_ROOT_PASSWORD: landmarking_dev
      MONGO_INITDB_DATABASE: landmarking
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  # Redis for caching and sessions
  redis:
    image: redis:7-alpine
    container_name: landmarking-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # MinIO for S3-compatible object storage (development)
  minio:
    image: minio/minio
    container_name: landmarking-minio
    environment:
      MINIO_ROOT_USER: landmarking
      MINIO_ROOT_PASSWORD: landmarking_dev
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  mongodb_data:
  redis_data:
  minio_data:
EOL
    fi
    
    print_status "Docker Compose file created. Run 'docker-compose up -d' to start services"
fi

# Create helpful scripts
echo -e "\n📝 Creating helper scripts..."

# Create start-all script
cat > scripts/start-all.sh << 'EOL'
#!/bin/bash
# Start all development services

echo "Starting all LandMarking services..."

# Start Docker services if available
if command -v docker >/dev/null 2>&1; then
    echo "Starting Docker services..."
    docker-compose up -d
fi

# Start Frontend
echo "Starting Frontend..."
cd src/frontend && yarn dev &
FRONTEND_PID=$!

# Start Backend
echo "Starting Backend..."
cd src/backend/workers && npm run dev &
BACKEND_PID=$!

# Start AI Service
echo "Starting AI Service..."
cd src/ai && source venv/bin/activate && python -m uvicorn api.main:app --reload &
AI_PID=$!

echo "All services started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8787"
echo "AI Service: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $FRONTEND_PID $BACKEND_PID $AI_PID; exit" INT
wait
EOL

chmod +x scripts/start-all.sh

# Create test script
cat > scripts/run-tests.sh << 'EOL'
#!/bin/bash
# Run all tests

echo "Running all tests..."

# Frontend tests
echo -e "\n🎨 Running Frontend tests..."
cd src/frontend && yarn test

# Backend tests
echo -e "\n⚙️ Running Backend tests..."
cd ../backend/workers && npm test

# AI Service tests
echo -e "\n🤖 Running AI Service tests..."
cd ../../ai && source venv/bin/activate && pytest

echo -e "\n✅ All tests completed!"
EOL

chmod +x scripts/run-tests.sh

# Create seed data script
cat > scripts/seed-test-data.sh << 'EOL'
#!/bin/bash
# Seed test data into databases

echo "Seeding test data..."

# This script will be implemented when we have database connections
echo "Database seeding not yet implemented"
echo "Test data is available in test-data/ directory"
EOL

chmod +x scripts/seed-test-data.sh

# Final summary
echo -e "\n\n✅ Development environment setup complete!"
echo "=================================================="
echo ""
echo "📁 Project Structure:"
echo "  - Frontend: src/frontend/ (Next.js)"
echo "  - Backend: src/backend/workers/ (Cloudflare Workers)"
echo "  - AI Service: src/ai/ (FastAPI)"
echo "  - Test Data: test-data/"
echo ""
echo "🚀 Quick Start Commands:"
echo "  - Start all services: ./scripts/start-all.sh"
echo "  - Run all tests: ./scripts/run-tests.sh"
echo "  - Start Docker services: docker-compose up -d"
echo ""
echo "📝 Next Steps:"
echo "  1. Update environment variables in .env files"
echo "  2. Get a Mapbox token from https://mapbox.com"
echo "  3. Run './scripts/start-all.sh' to start development"
echo ""
print_warning "Remember to update CLAUDE.md if you add new setup requirements!"
EOL