import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';
import AiBoundaryDetection from '../../components/AiBoundaryDetection';
import { useAuth } from '../../contexts/AuthContext';
import { parcelService, CreateParcelPayload } from '../../api/parcelService';

// Dynamically import the map component with no SSR
const MapComponent = dynamic(
  () => import('../../components/MapComponent'),
  { ssr: false }
);

// Land use options
const landUseOptions = [
  { value: 'residential', label: 'Residential' },
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'communal', label: 'Communal' },
  { value: 'recreational', label: 'Recreational' },
  { value: 'conservation', label: 'Conservation' },
  { value: 'forestry', label: 'Forestry' },
  { value: 'other', label: 'Other' },
];

// Empty MultiPolygon geometry
const emptyGeometry = {
  type: 'MultiPolygon',
  coordinates: [[[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]]]
};

export default function NewParcel() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [landUse, setLandUse] = useState('residential');
  const [geometry, setGeometry] = useState(emptyGeometry);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [currentStep, setCurrentStep] = useState<'info' | 'map' | 'confirm'>('info');
  
  // GPS tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [trackingTime, setTrackingTime] = useState(0);
  
  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Simulates GPS tracking timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking) {
      interval = setInterval(() => {
        setTrackingTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);
  
  // Handle geometry change from map component
  const handleGeometryChange = (newGeometry: any) => {
    setGeometry(newGeometry);
  };
  
  // Simulate starting GPS tracking
  const startTracking = () => {
    setIsTracking(true);
    // In a real implementation, this would use the Geolocation API
    // and continuously update the geometry
  };
  
  // Simulate stopping GPS tracking
  const stopTracking = () => {
    setIsTracking(false);
    // In a real implementation, this would finalize the geometry
    // and calculate accuracy based on GPS data
    setAccuracy(5.2); // Mock accuracy in meters
  };
  
  // Format tracking time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError('');
      
      // Prepare the request payload
      const payload: CreateParcelPayload = {
        land_use: landUse,
        geometry,
        metadata: {
          notes,
          accuracy_meters: accuracy,
          source: 'mobile_mapping',
        },
        ...(communityId ? { community_id: communityId } : {})
      };
      
      // Submit to API
      const response = await parcelService.createParcel(payload);
      
      // Redirect to the new parcel page on success
      router.push(`/parcels/${response.parcel.id}`);
    } catch (err) {
      console.error('Error creating parcel:', err);
      setSubmitError('Failed to create parcel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <Head>
        <title>{t('parcel.new.title')} | LandMarking</title>
      </Head>
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {t('parcel.new.heading', 'Register New Land Parcel')}
              </h1>
            </div>
          </div>
          
          {/* Progress steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'info' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                  1
                </div>
                <div className="ml-2 text-sm font-medium">
                  {t('parcel.new.step_info', 'Parcel Information')}
                </div>
              </div>
              <div className="w-16 h-1 bg-gray-200 flex-grow mx-4"></div>
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'map' ? 'bg-blue-600 text-white' : currentStep === 'confirm' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                  2
                </div>
                <div className="ml-2 text-sm font-medium">
                  {t('parcel.new.step_map', 'Map Boundary')}
                </div>
              </div>
              <div className="w-16 h-1 bg-gray-200 flex-grow mx-4"></div>
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  3
                </div>
                <div className="ml-2 text-sm font-medium">
                  {t('parcel.new.step_confirm', 'Confirm & Submit')}
                </div>
              </div>
            </div>
          </div>
          
          {/* Form Steps */}
          {currentStep === 'info' && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg leading-6 font-medium text-gray-900">
                    {t('parcel.new.info_title', 'Parcel Information')}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    {t('parcel.new.info_description', 'Enter basic information about the land parcel')}
                  </p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="land-use" className="block text-sm font-medium text-gray-700">
                        {t('parcel.new.land_use', 'Land Use')} *
                      </label>
                      <select
                        id="land-use"
                        value={landUse}
                        onChange={(e) => setLandUse(e.target.value)}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        {landUseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="community" className="block text-sm font-medium text-gray-700">
                        {t('parcel.new.community', 'Community')}
                      </label>
                      <select
                        id="community"
                        value={communityId}
                        onChange={(e) => setCommunityId(e.target.value)}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">{t('parcel.new.select_community', 'Select a community')}</option>
                        <option value="c1">Freetown Central</option>
                        <option value="c2">Western Rural</option>
                        <option value="c3">Bo District</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                        {t('parcel.new.notes', 'Notes')}
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder={t('parcel.new.notes_placeholder', 'Additional information about this parcel...')}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('map')}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('parcel.new.next', 'Next')}
                  </button>
                </div>
              </div>
              
              {/* Import the AiBoundaryDetection component */}
              <AiBoundaryDetection 
                onBoundaryDetected={(detectedGeometry, detectedLandUse) => {
                  setGeometry(detectedGeometry);
                  if (detectedLandUse) {
                    setLandUse(detectedLandUse);
                  }
                  setCurrentStep('map');
                }} 
              />
            </div>
          )}
          
          {currentStep === 'map' && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg leading-6 font-medium text-gray-900">
                    {t('parcel.new.map_title', 'Map Boundary')}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    {t('parcel.new.map_description', 'Draw the boundary of your land parcel or use GPS tracking')}
                  </p>
                </div>
                <div className="border-t border-gray-200">
                  <div className="h-[500px] w-full relative">
                    <MapComponent
                      geometry={geometry}
                      editable={true}
                      onGeometryChange={handleGeometryChange}
                    />
                    
                    {/* GPS tracking overlay */}
                    {isTracking && (
                      <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white py-2 px-4 flex justify-between items-center">
                        <div>
                          <span className="font-medium">{t('parcel.new.tracking', 'GPS Tracking')}</span>
                          <span className="ml-2 text-sm">{formatTime(trackingTime)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={stopTracking}
                          className="px-3 py-1 bg-white text-blue-600 rounded-md text-sm font-medium"
                        >
                          {t('parcel.new.stop_tracking', 'Stop')}
                        </button>
                      </div>
                    )}
                    
                    {/* GPS controls */}
                    {!isTracking && (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <button
                          type="button"
                          onClick={startTracking}
                          className="px-4 py-2 bg-green-600 text-white rounded-md shadow-md flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {t('parcel.new.start_tracking', 'Start GPS Tracking')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {accuracy && (
                  <div className="px-4 py-3 bg-green-50 border-t border-green-100">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-green-700">
                        {t('parcel.new.gps_accuracy', 'GPS Accuracy')}: ±{accuracy} {t('parcel.new.meters', 'meters')}
                      </span>
                    </div>
                  </div>
                )}
                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('info')}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('parcel.new.back', 'Back')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('confirm')}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('parcel.new.next', 'Next')}
                  </button>
                </div>
              </div>
              
              {/* Add AI boundary improvement in map step */}
              <AiBoundaryDetection 
                initialGeometry={geometry}
                onBoundaryDetected={(improvedGeometry) => {
                  setGeometry(improvedGeometry);
                  // No need to change step, we're already in the map step
                }} 
              />
            </div>
          )}
          
          {currentStep === 'confirm' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  {t('parcel.new.confirm_title', 'Confirm & Submit')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {t('parcel.new.confirm_description', 'Review your land parcel information before submitting')}
                </p>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">{t('parcel.new.land_use', 'Land Use')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {landUseOptions.find(opt => opt.value === landUse)?.label}
                    </dd>
                  </div>
                  {communityId && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.new.community', 'Community')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {communityId === 'c1' ? 'Freetown Central' : 
                         communityId === 'c2' ? 'Western Rural' : 'Bo District'}
                      </dd>
                    </div>
                  )}
                  {notes && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.new.notes', 'Notes')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{notes}</dd>
                    </div>
                  )}
                  {accuracy && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.new.gps_accuracy', 'GPS Accuracy')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">±{accuracy} {t('parcel.new.meters', 'meters')}</dd>
                    </div>
                  )}
                </dl>
                
                <div className="border-t border-gray-200 px-4 py-5">
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    {t('parcel.new.boundary_preview', 'Boundary Preview')}
                  </h3>
                  <div className="h-[200px] w-full">
                    <MapComponent geometry={geometry} />
                  </div>
                </div>
              </div>
              
              {submitError && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700">{submitError}</span>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('map')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('parcel.new.back', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('parcel.new.submitting', 'Submitting...')}
                    </>
                  ) : (
                    t('parcel.new.submit', 'Submit')
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  };
};