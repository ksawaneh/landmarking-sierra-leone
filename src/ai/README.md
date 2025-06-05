# LandMarking AI Services

## Overview

The LandMarking AI Services module provides artificial intelligence and machine learning capabilities to enhance the land registration system. It assists in boundary detection, validation, land use classification, and document processing.

## Key Features

- **Boundary Detection**: Identify land boundaries from satellite imagery
- **Boundary Validation**: Validate user-drawn boundaries against imagery
- **Land Use Classification**: Automatically classify land use from imagery
- **Document OCR**: Extract text from scanned documents
- **Conflict Detection**: Identify potential boundary conflicts
- **Anomaly Detection**: Flag unusual patterns in land registration

## Architecture

The AI services are structured as:

- **API Layer**: RESTful endpoints for service access
- **Model Management**: Loading and versioning of ML models
- **Processing Pipeline**: Data preparation and inference
- **Training Infrastructure**: For model training and refinement
- **Evaluation System**: For measuring model performance

## Directory Structure

```
ai/
├── api/                    # API endpoints for AI services
├── models/                 # ML model definitions and weights
│   ├── boundary_detection/ # Models for boundary detection
│   ├── land_use/           # Models for land use classification
│   ├── ocr/                # Models for document OCR
│   └── validation/         # Models for boundary validation
├── processing/             # Data processing pipelines
│   ├── imagery/            # Satellite image processing
│   ├── vectors/            # Vector data processing
│   └── documents/          # Document processing
├── training/               # Training scripts and notebooks
│   ├── datasets/           # Dataset definitions (not the data itself)
│   ├── experiments/        # Experiment tracking
│   └── scripts/            # Training scripts
├── evaluation/             # Model evaluation tools
├── utils/                  # Utility functions
├── config/                 # Configuration files
└── tests/                  # Automated tests
```

## Technical Stack

- **Language**: Python
- **ML Frameworks**: TensorFlow, PyTorch
- **Computer Vision**: OpenCV, Rasterio
- **Geospatial**: GeoPandas, GDAL
- **OCR**: Tesseract, EasyOCR
- **API**: FastAPI
- **Serving**: TensorFlow Serving, ONNX Runtime
- **Storage**: Cloud object storage, PostgreSQL
- **Containers**: Docker
- **Orchestration**: Kubernetes
- **Model Registry**: MLflow
- **Experiment Tracking**: Weights & Biases
- **Performance Monitoring**: Prometheus, Grafana

## Core Functionality

### Boundary Detection

The boundary detection system identifies land parcel boundaries from satellite or aerial imagery:

1. **Image Acquisition**: Retrieves satellite imagery for the region of interest
2. **Preprocessing**: Enhances the image and normalizes colors
3. **Segmentation**: Uses a U-Net model to segment boundaries
4. **Post-processing**: Converts segmentation masks to vector boundaries
5. **Validation**: Validates the extracted boundaries for geometric validity

**Model Architecture**: U-Net with ResNet backbone

**Input**: Satellite imagery (RGB or multispectral)

**Output**: GeoJSON boundaries

### Boundary Validation

The boundary validation system compares user-drawn boundaries against AI-detected boundaries:

1. **Image and Boundary Ingestion**: Takes satellite imagery and user-drawn boundary
2. **Feature Extraction**: Extracts features from imagery along the boundary
3. **Discrepancy Detection**: Identifies areas where the boundary doesn't match visible features
4. **Suggestion Generation**: Proposes alternative boundary sections
5. **Confidence Scoring**: Provides confidence scores for suggestions

**Model Architecture**: Convolutional neural network with attention mechanism

**Input**: Satellite imagery and user-drawn boundary

**Output**: Validation score, discrepancy regions, suggested corrections

### Land Use Classification

The land use classification system determines the type of land use from imagery:

1. **Image Acquisition**: Retrieves satellite imagery for the parcel
2. **Preprocessing**: Standardizes the imagery
3. **Feature Extraction**: Extracts relevant features using CNN
4. **Classification**: Classifies the land use category
5. **Confidence Scoring**: Provides confidence scores for each category

**Model Architecture**: ResNet/EfficientNet with custom head

**Input**: Satellite imagery of parcel

**Output**: Land use categories with confidence scores

### Document OCR

The document OCR system extracts text from scanned documents:

1. **Document Preprocessing**: Enhances image quality
2. **Layout Analysis**: Identifies text regions and structure
3. **Text Recognition**: Extracts text from regions
4. **Post-processing**: Corrects common OCR errors
5. **Information Extraction**: Identifies relevant information (names, dates, parcel IDs)

**Model Architecture**: LSTM-CNN hybrid for text recognition

**Input**: Document image

**Output**: Extracted text with structure

## Integration Points

The AI Services module integrates with other components of the LandMarking system:

- **Parcel Service**: Receives boundary data and sends validation results
- **Document Service**: Processes uploaded documents for text extraction
- **Verification Service**: Provides AI-assisted validation for verifiers
- **Map Service**: Provides detected boundaries for visualization
- **Mobile App**: Provides real-time boundary validation

## Development Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the development server using uvicorn
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Using Docker

You can also run the AI service using Docker:

```bash
# Build and start with docker-compose
docker-compose up

# Or build and run manually
docker build -t landmarking-ai:latest .
docker run -p 8000:8000 landmarking-ai:latest
```

### Testing the API

Once the service is running, you can test the API endpoints:

```bash
# Health check
curl http://localhost:8000/health

# Detect boundary (example)
curl -X POST http://localhost:8000/detect-boundary \
  -H "Content-Type: application/json" \
  -d '{"latitude": 8.4655, "longitude": -13.2317, "radius": 500}'

# Improve boundary (example)
curl -X POST http://localhost:8000/improve-boundary \
  -H "Content-Type: application/json" \
  -d '{"geometry": {"type": "Polygon", "coordinates": [[[-13.2317, 8.4655], [-13.2317, 8.4755], [-13.2217, 8.4755], [-13.2217, 8.4655], [-13.2317, 8.4655]]]}}'

# Detect land use (example)
curl -X POST http://localhost:8000/detect-land-use \
  -H "Content-Type: application/json" \
  -d '{"geometry": {"type": "Polygon", "coordinates": [[[-13.2317, 8.4655], [-13.2317, 8.4755], [-13.2217, 8.4755], [-13.2217, 8.4655], [-13.2317, 8.4655]]]}}'
```

### Frontend Integration

The AI service is integrated with the frontend using the AIService module in `/src/frontend/services/aiService.ts`. This module handles communication with the AI API and provides fallback mock implementations when the service is unavailable.

To configure the frontend to use the AI service:

1. Ensure the `NEXT_PUBLIC_AI_API_URL` environment variable is set (defaults to `http://localhost:8000`)
2. The frontend will automatically try to connect to the AI service and fall back to mock implementations if unavailable

## Model Management

The system uses a versioned model registry to track model versions and performance:

- Models are versioned using semantic versioning
- Each model has metadata including training dataset, performance metrics, and limitations
- A/B testing framework for evaluating model improvements
- Automated monitoring for model drift

## Training Pipeline

For training new models:

```bash
# Prepare the dataset
python -m training.prepare_dataset --config config/boundary_detection.yaml

# Train the model
python -m training.train --config config/boundary_detection.yaml

# Evaluate the model
python -m evaluation.evaluate --model-path models/boundary_detection/v1.0.0/model.h5 --test-data data/test

# Register the new model
python -m utils.register_model --path models/boundary_detection/v1.0.0/model.h5 --name boundary_detection --version 1.0.0
```

## Inference Pipeline

For running inference with trained models:

```bash
# Single inference
python -m processing.boundary_detection.predict --image path/to/image.tif --output path/to/output.geojson

# Batch inference
python -m processing.boundary_detection.batch_predict --input-dir path/to/images --output-dir path/to/results
```

## Testing

```bash
# Run unit tests
pytest tests/unit

# Run integration tests
pytest tests/integration

# Run model tests
pytest tests/models
```

## Performance and Scalability

- **Batch processing** for large datasets
- **GPU acceleration** for inference
- **Distributed training** for model development
- **Caching** of common inference requests
- **Horizontal scaling** of inference servers

## Data Privacy and Ethics

- No personally identifiable information is stored in models
- Training data is anonymized
- Bias detection and mitigation in training pipelines
- Explainability tools for understanding model decisions
- Regular ethical reviews of AI systems

## Limitations and Constraints

- Boundary detection accuracy depends on image quality and resolution
- Land use classification has limitations in mixed-use parcels
- OCR performance varies with document quality
- Models require periodic retraining as landscape changes

## Deployment

The AI services are deployed as Docker containers on Kubernetes:

```bash
# Build Docker image
docker build -t landmarking-ai:latest .

# Run Docker container
docker run -p 8000:8000 landmarking-ai:latest
```

## Contributing

See the [Contributing Guide](../../CONTRIBUTING.md) for details on contributing to the AI services.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.