from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import logging
from typing import List, Optional, Dict
import json
import os
import sys
import time

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our boundary detection module
from processing.imagery.boundary_detection import detect_boundaries_from_coords, improve_existing_boundary
from processing.imagery.land_use import detect_land_use

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LandMarking AI API",
    description="API for AI-assisted land boundary detection and analysis",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- Pydantic Models -----

class Coordinate(BaseModel):
    lng: float = Field(..., description="Longitude coordinate")
    lat: float = Field(..., description="Latitude coordinate")

class Polygon(BaseModel):
    type: str = Field("Polygon", description="GeoJSON geometry type")
    coordinates: List[List[List[float]]] = Field(..., description="Array of linear rings (exterior followed by optional interior rings)")

class Geometry(BaseModel):
    type: str = Field(..., description="GeoJSON geometry type")
    coordinates: List = Field(..., description="Coordinates in GeoJSON format")

class BoundaryDetectionRequest(BaseModel):
    latitude: float = Field(..., description="Latitude of the center point")
    longitude: float = Field(..., description="Longitude of the center point")
    radius: int = Field(500, description="Radius in meters to search around the center point")

class BoundaryImprovementRequest(BaseModel):
    geometry: Geometry = Field(..., description="GeoJSON geometry to improve")

class LandUseRequest(BaseModel):
    geometry: Geometry = Field(..., description="GeoJSON geometry for land use detection")

class LandUseResponse(BaseModel):
    landUse: str = Field(..., description="Primary detected land use category")
    confidence: float = Field(..., description="Confidence score for the primary land use (0-1)")
    alternatives: List[Dict[str, float]] = Field(..., description="Alternative land use categories with confidence scores")
    processingTimeMs: int = Field(..., description="Processing time in milliseconds")

class BoundaryResponse(BaseModel):
    geometry: Geometry = Field(..., description="Detected or improved boundary geometry")
    confidence: float = Field(..., description="Confidence score (0-1)")
    processingTimeMs: int = Field(..., description="Processing time in milliseconds")

# ----- API Routes -----

@app.get("/")
async def root():
    return {"message": "LandMarking AI API is running"}

@app.post("/detect-boundary", response_model=BoundaryResponse)
async def detect_boundary(request: BoundaryDetectionRequest):
    """
    Detect land parcel boundaries from satellite imagery using AI.
    
    Uses the coordinates provided as the center point and searches for
    parcel boundaries within the specified radius.
    """
    try:
        logger.info(f"Detecting boundaries at ({request.latitude}, {request.longitude}) with radius {request.radius}m")
        
        # Start timer
        start_time = time.time()
        
        # Call the boundary detection module
        geometry, confidence = detect_boundaries_from_coords(
            request.latitude, 
            request.longitude, 
            request.radius
        )
        
        # Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "geometry": geometry,
            "confidence": confidence,
            "processingTimeMs": processing_time
        }
    except Exception as e:
        logger.error(f"Error in boundary detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Boundary detection failed: {str(e)}")

@app.post("/improve-boundary", response_model=BoundaryResponse)
async def improve_boundary(request: BoundaryImprovementRequest):
    """
    Improve an existing boundary using AI.
    
    Analyzes the provided boundary against satellite imagery and
    suggests improvements to better match visible features.
    """
    try:
        logger.info(f"Improving boundary of type {request.geometry.type}")
        
        # Start timer
        start_time = time.time()
        
        # Call the boundary improvement module
        improved_geometry, confidence = improve_existing_boundary(request.geometry)
        
        # Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "geometry": improved_geometry,
            "confidence": confidence,
            "processingTimeMs": processing_time
        }
    except Exception as e:
        logger.error(f"Error in boundary improvement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Boundary improvement failed: {str(e)}")

@app.post("/detect-land-use", response_model=LandUseResponse)
async def analyze_land_use(request: LandUseRequest):
    """
    Analyze land use type based on provided geometry.
    
    Examines satellite imagery within the provided geometry to
    determine the most likely land use category (agricultural,
    residential, etc.).
    """
    try:
        logger.info(f"Detecting land use for geometry of type {request.geometry.type}")
        
        # Start timer
        start_time = time.time()
        
        # Call the land use detection module
        land_use, confidence, alternatives = detect_land_use(request.geometry)
        
        # Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "landUse": land_use,
            "confidence": confidence,
            "alternatives": alternatives,
            "processingTimeMs": processing_time
        }
    except Exception as e:
        logger.error(f"Error in land use detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Land use detection failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint for the AI service."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "services": {
            "boundary_detection": "available",
            "boundary_improvement": "available",
            "land_use_detection": "available"
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)