import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import aiService from '../services/aiService';

interface AiBoundaryDetectionProps {
  onBoundaryDetected: (geometry: any, landUse?: string) => void;
  initialGeometry?: any;
}

const AiBoundaryDetection: React.FC<AiBoundaryDetectionProps> = ({
  onBoundaryDetected,
  initialGeometry,
}) => {
  const { t } = useTranslation('common');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('500');
  const [detectionStep, setDetectionStep] = useState<'input' | 'processing' | 'success'>('input');
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [progressStage, setProgressStage] = useState(0);
  const [aiResult, setAiResult] = useState<{
    confidence: number;
    processingTime: number;
    landUse?: string;
    landUseConfidence?: number;
  } | null>(null);

  // Check if the AI service is available when the component mounts
  useEffect(() => {
    const checkServiceAvailability = async () => {
      try {
        const isAvailable = await aiService.isServiceAvailable();
        setServiceAvailable(isAvailable);
      } catch (err) {
        console.warn('Could not check AI service availability:', err);
        setServiceAvailable(false);
      }
    };
    
    checkServiceAvailability();
  }, []);

  // Function to detect boundaries from coordinates
  const handleDetectBoundaries = async () => {
    if (!latitude || !longitude) {
      setError(t('ai.error.missing_coordinates', 'Please enter both latitude and longitude.'));
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radius) || 500;

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError(t('ai.error.invalid_coordinates', 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setDetectionStep('processing');
      setProgressStage(1);

      // Call the AI service to detect boundaries
      const boundaryResult = await aiService.detectBoundaries(lat, lng, rad);
      setProgressStage(2);
      
      // Optionally detect land use based on the detected boundary
      const landUseResult = await aiService.detectLandUse(boundaryResult.geometry);
      setProgressStage(3);
      
      setAiResult({
        confidence: boundaryResult.confidence,
        processingTime: boundaryResult.processingTimeMs,
        landUse: landUseResult.landUse,
        landUseConfidence: landUseResult.confidence
      });
      
      // Notify parent component with the detected geometry and land use
      onBoundaryDetected(boundaryResult.geometry, landUseResult.landUse);
      
      setDetectionStep('success');
    } catch (err) {
      console.error('AI boundary detection error:', err);
      setError(t('ai.error.detection_failed', 'Failed to detect boundaries. Please try again.'));
      setDetectionStep('input');
    } finally {
      setIsLoading(false);
      setProgressStage(0);
    }
  };

  // Function to improve an existing boundary
  const handleImproveBoundary = async () => {
    if (!initialGeometry) {
      setError(t('ai.error.no_boundary', 'No boundary available to improve.'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setDetectionStep('processing');
      setProgressStage(1);

      // Call the AI service to improve the boundary
      const improvedResult = await aiService.improveBoundary(initialGeometry);
      setProgressStage(3);
      
      setAiResult({
        confidence: improvedResult.confidence,
        processingTime: improvedResult.processingTimeMs
      });
      
      // Notify parent component with the improved geometry
      onBoundaryDetected(improvedResult.geometry);
      
      setDetectionStep('success');
    } catch (err) {
      console.error('AI boundary improvement error:', err);
      setError(t('ai.error.improvement_failed', 'Failed to improve boundary. Please try again.'));
      setDetectionStep('input');
    } finally {
      setIsLoading(false);
      setProgressStage(0);
    }
  };

  // Function to get user's current position
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(t('ai.error.geolocation_not_supported', 'Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setError('');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(t('ai.error.geolocation_failed', 'Failed to get your current location. Please enter coordinates manually.'));
      },
      { enableHighAccuracy: true }
    );
  };

  // Show progress indicators for the AI processing
  const getProgressText = () => {
    switch (progressStage) {
      case 1:
        return t('ai.progress.fetching_imagery', 'Fetching satellite imagery...');
      case 2:
        return t('ai.progress.analyzing_boundaries', 'Analyzing parcel boundaries...');
      case 3:
        return t('ai.progress.finalizing', 'Finalizing results...');
      default:
        return t('ai.processing', 'Processing satellite imagery...');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
          </svg>
          {t('ai.title', 'AI-Assisted Boundary Detection')}
        </h3>
        
        <p className="mt-1 text-sm text-gray-500">
          {t('ai.description', 'Use AI to automatically detect land boundaries from satellite imagery')}
        </p>
        
        {/* Service availability indicator */}
        {serviceAvailable !== null && (
          <div className={`mt-2 text-xs flex items-center ${serviceAvailable ? 'text-green-600' : 'text-amber-600'}`}>
            <div className={`w-2 h-2 rounded-full mr-1.5 ${serviceAvailable ? 'bg-green-500' : 'bg-amber-500'}`}></div>
            {serviceAvailable 
              ? t('ai.service_available', 'AI service is available') 
              : t('ai.service_unavailable', 'AI service is currently unavailable - using fallback mode')}
          </div>
        )}
        
        {error && (
          <div className="mt-3 text-sm text-red-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        
        {detectionStep === 'input' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                  {t('ai.latitude', 'Latitude')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g. 8.4655"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                  {t('ai.longitude', 'Longitude')}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g. -13.2317"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="radius" className="block text-sm font-medium text-gray-700">
                {t('ai.radius', 'Search Radius (meters)')}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="radius"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="500"
                  min="100"
                  max="1000"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t('ai.radius_description', 'Area around the center point to analyze (100-1000m)')}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('ai.use_current_location', 'Use My Location')}
              </button>
              
              {initialGeometry && (
                <button
                  type="button"
                  onClick={handleImproveBoundary}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('ai.improve_existing', 'Improve Existing Boundary')}
                </button>
              )}
            </div>
            
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDetectBoundaries}
                disabled={!latitude || !longitude}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {t('ai.detect_boundary', 'Detect Boundary with AI')}
              </button>
            </div>
          </div>
        )}
        
        {detectionStep === 'processing' && (
          <div className="mt-4 flex flex-col items-center justify-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-700 text-sm">
              {getProgressText()}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full animate-pulse transition-all duration-300"
                style={{ width: `${(progressStage / 3) * 100}%` }}
              ></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {serviceAvailable === false && t('ai.fallback_mode', 'Using demo mode - for demonstration purposes only')}
            </p>
          </div>
        )}
        
        {detectionStep === 'success' && aiResult && (
          <div className="mt-4">
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    {t('ai.success_title', 'Boundary Detection Complete')}
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      {t('ai.confidence', 'Confidence Score')}: {(aiResult.confidence * 100).toFixed(1)}%
                    </p>
                    <p>
                      {t('ai.processing_time', 'Processing Time')}: {aiResult.processingTime}ms
                    </p>
                    {aiResult.landUse && (
                      <p>
                        {t('ai.detected_land_use', 'Detected Land Use')}: {aiResult.landUse.charAt(0).toUpperCase() + aiResult.landUse.slice(1)} 
                        {aiResult.landUseConfidence && ` (${(aiResult.landUseConfidence * 100).toFixed(1)}%)`}
                      </p>
                    )}
                    {serviceAvailable === false && (
                      <p className="italic text-xs mt-1 text-amber-600">
                        {t('ai.demo_results', 'Note: These results are simulated for demonstration purposes.')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetectionStep('input')}
                className="inline-flex justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('ai.try_again', 'Try Different Location')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiBoundaryDetection;