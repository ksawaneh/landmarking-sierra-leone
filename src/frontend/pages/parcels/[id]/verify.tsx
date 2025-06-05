import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../../../components/Layout';
import SignatureCanvas from '../../../components/SignatureCanvas';
import { useAuth } from '../../../contexts/AuthContext';
import { parcelService, Parcel } from '../../../api/parcelService';
import { offlineSync } from '../../../services/offlineSync';
import syncService from '../../../services/syncService';

// Dynamically import the map component with no SSR
const MapComponent = dynamic(
  () => import('../../../components/MapComponent'),
  { ssr: false }
);

export default function ParcelVerification() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [witnessNames, setWitnessNames] = useState(['', '']);
  const [verificationStatus, setVerificationStatus] = useState<'approve' | 'dispute' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  
  // Define the steps in the verification workflow
  const [currentStep, setCurrentStep] = useState<'review' | 'witnesses' | 'confirmation'>('review');

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Check online status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    // Fetch parcel if authenticated and id is available
    if (isAuthenticated && id) {
      fetchParcel();
    }
  }, [isAuthenticated, id]);

  const fetchParcel = async () => {
    try {
      setIsLoadingParcel(true);
      
      if (isOnline) {
        // Online: fetch from API
        const response = await parcelService.getParcel(id as string);
        setParcel(response.parcel);
      } else {
        // Offline: try to get from cache
        const cachedParcel = offlineSync.getCachedParcel(id as string);
        if (cachedParcel) {
          setParcel(cachedParcel);
        } else {
          throw new Error('Parcel not available offline');
        }
      }
      
      setError('');
    } catch (err) {
      console.error('Error fetching parcel:', err);
      setError('Failed to load parcel details. Please try again.');
    } finally {
      setIsLoadingParcel(false);
    }
  };

  const handleWitnessNameChange = (index: number, value: string) => {
    const newWitnessNames = [...witnessNames];
    newWitnessNames[index] = value;
    setWitnessNames(newWitnessNames);
  };

  const handleVerificationSubmit = async () => {
    if (!verificationStatus) {
      setError('Please choose to approve or dispute the parcel');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const verificationData = {
        comments,
        verification_type: 'community' as const,
        status: verificationStatus === 'approve' ? 'verified' : 'disputed',
        metadata: {
          witness_names: witnessNames.filter(name => name.trim()),
          signature: signatureData,
          verified_by: user?.id || 'anonymous',
          verification_date: new Date().toISOString()
        }
      };
      
      // Check if online or offline
      if (isOnline) {
        // Online submission
        await parcelService.verifyParcel(id as string, verificationData);
      } else {
        // Offline handling - queue the verification for later sync
        // First, update the local cached parcel with the new status
        const cachedParcel = offlineSync.getCachedParcel(id as string);
        
        if (cachedParcel) {
          const updatedParcel = {
            ...cachedParcel,
            status: verificationStatus === 'approve' ? 'verified' : 'disputed',
            verification: {
              ...verificationData,
              pending_sync: true,
              created_at: new Date().toISOString()
            }
          };
          
          // Queue the update operation for later sync
          offlineSync.addPendingOperation(
            'UPDATE',
            `/parcels/${id}/verify`, 
            verificationData,
            id as string
          );
          
          // Update the cache
          offlineSync.cacheParcel(updatedParcel);
        }
      }
      
      setSuccessMessage(verificationStatus === 'approve' 
        ? t('parcel.verify.success_approved', 'Parcel has been successfully verified')
        : t('parcel.verify.success_disputed', 'Parcel dispute has been recorded'));
      
      if (!isOnline) {
        setSuccessMessage(prev => prev + ' ' + t('parcel.verify.offline_sync', '(Will be synchronized when online)'));
      }
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push(`/parcels/${id}`);
      }, 2000);
      
    } catch (err) {
      console.error('Error verifying parcel:', err);
      setError('Failed to submit verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading || isLoadingParcel) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error && !successMessage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (successMessage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
                <p className="text-sm text-green-700 mt-1">{t('parcel.verify.redirecting', 'Redirecting...')}</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!parcel) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p>{t('parcel.detail.not_found')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Step indicator for the verification workflow
  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'review' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
            1
          </div>
          <div className="ml-2 text-sm font-medium">
            {t('parcel.verify.step_review', 'Review Parcel')}
          </div>
        </div>
        <div className="w-16 h-1 bg-gray-200 flex-grow mx-4"></div>
        <div className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'witnesses' ? 'bg-blue-600 text-white' : currentStep === 'confirmation' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
            2
          </div>
          <div className="ml-2 text-sm font-medium">
            {t('parcel.verify.step_witnesses', 'Witnesses & Comments')}
          </div>
        </div>
        <div className="w-16 h-1 bg-gray-200 flex-grow mx-4"></div>
        <div className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 'confirmation' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            3
          </div>
          <div className="ml-2 text-sm font-medium">
            {t('parcel.verify.step_confirm', 'Confirmation')}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <Head>
        <title>{t('parcel.verify.title', 'Verify Parcel')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {t('parcel.verify.heading', 'Community Verification')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('parcel.verify.subtitle', 'Verify the accuracy of land parcel')} {parcel.parcel_number}
              </p>
            </div>
          </div>
          
          {/* Offline indicator */}
          {!isOnline && (
            <div className="mb-4 rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    {t('common.offline_mode', 'Offline Mode')}
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      {t('parcel.verify.offline_verification', 'You can verify this parcel while offline. Your verification will be synchronized when you reconnect to the internet.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <StepIndicator />

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg leading-6 font-medium text-gray-900">
                    {t('parcel.verify.review_title', 'Parcel Information')}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    {t('parcel.verify.review_description', 'Review the parcel details to ensure accuracy')}
                  </p>
                </div>
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.parcel_number')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{parcel.parcel_number}</dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.land_use')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {parcel.land_use.charAt(0).toUpperCase() + parcel.land_use.slice(1)}
                      </dd>
                    </div>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.area')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{parcel.area_sqm.toLocaleString()} m²</dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.created')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(parcel.created_at)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg leading-6 font-medium text-gray-900">
                    {t('parcel.verify.map_review', 'Boundary Map Review')}
                  </h2>
                </div>
                <div className="border-t border-gray-200">
                  <div className="h-96 w-full">
                    <MapComponent geometry={parcel.geometry} />
                  </div>
                </div>
              </div>

              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg leading-6 font-medium text-gray-900">
                    {t('parcel.verify.verification_decision', 'Verification Decision')}
                  </h2>
                </div>
                <div className="border-t border-gray-200 px-4 py-5">
                  <p className="text-sm text-gray-500 mb-4">
                    {t('parcel.verify.decision_instructions', 'Please verify if this land parcel information is accurate')}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        id="approve"
                        name="verification"
                        type="radio"
                        checked={verificationStatus === 'approve'}
                        onChange={() => setVerificationStatus('approve')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="approve" className="ml-3">
                        <span className="block text-sm font-medium text-gray-700">
                          {t('parcel.verify.approve', 'Approve - The information is accurate')}
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="dispute"
                        name="verification"
                        type="radio"
                        checked={verificationStatus === 'dispute'}
                        onChange={() => setVerificationStatus('dispute')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <label htmlFor="dispute" className="ml-3">
                        <span className="block text-sm font-medium text-gray-700">
                          {t('parcel.verify.dispute', 'Dispute - There are inaccuracies with this parcel')}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('witnesses')}
                    disabled={!verificationStatus}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {t('parcel.verify.next', 'Next')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'witnesses' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  {t('parcel.verify.witnesses_title', 'Witness Information')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {t('parcel.verify.witnesses_description', 'Add community witnesses and verification comments')}
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="witness1" className="block text-sm font-medium text-gray-700">
                      {t('parcel.verify.witness_1', 'Witness 1')}
                    </label>
                    <input
                      type="text"
                      id="witness1"
                      value={witnessNames[0]}
                      onChange={(e) => handleWitnessNameChange(0, e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={t('parcel.verify.witness_name_placeholder', 'Full name of witness')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="witness2" className="block text-sm font-medium text-gray-700">
                      {t('parcel.verify.witness_2', 'Witness 2')} ({t('parcel.verify.optional', 'optional')})
                    </label>
                    <input
                      type="text"
                      id="witness2"
                      value={witnessNames[1]}
                      onChange={(e) => handleWitnessNameChange(1, e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={t('parcel.verify.witness_name_placeholder', 'Full name of witness')}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="signatureCanvas" className="block text-sm font-medium text-gray-700">
                      {t('parcel.verify.signature', 'Your Signature')}
                    </label>
                    <div className="mt-1">
                      <SignatureCanvas
                        value={signatureData}
                        onChange={setSignatureData}
                        height={150}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="comments" className="block text-sm font-medium text-gray-700">
                      {t('parcel.verify.comments', 'Comments')}
                    </label>
                    <textarea
                      id="comments"
                      rows={3}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={verificationStatus === 'dispute' 
                        ? t('parcel.verify.dispute_comments_placeholder', 'Please describe the inaccuracies or issues with this parcel...') 
                        : t('parcel.verify.comments_placeholder', 'Any additional information or comments...')}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('review')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('parcel.verify.back', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!signatureData) {
                      setError('Please add your signature to continue');
                      return;
                    }
                    if (verificationStatus === 'dispute' && !comments) {
                      setError('Please add comments explaining the dispute');
                      return;
                    }
                    if (!witnessNames[0]) {
                      setError('Please add at least one witness name');
                      return;
                    }
                    setError('');
                    setCurrentStep('confirmation');
                  }}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('parcel.verify.next', 'Next')}
                </button>
              </div>
              
              {error && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'confirmation' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  {t('parcel.verify.confirmation_title', 'Confirmation')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {t('parcel.verify.confirmation_description', 'Please review your verification details before final submission')}
                </p>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">{t('parcel.verify.decision')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        verificationStatus === 'approve' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {verificationStatus === 'approve' 
                          ? t('parcel.verify.approved', 'Approved') 
                          : t('parcel.verify.disputed', 'Disputed')}
                      </span>
                    </dd>
                  </div>
                  
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">{t('parcel.verify.witnesses')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <ul className="list-disc pl-5">
                        {witnessNames[0] && <li>{witnessNames[0]}</li>}
                        {witnessNames[1] && <li>{witnessNames[1]}</li>}
                      </ul>
                    </dd>
                  </div>
                  
                  {comments && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">{t('parcel.verify.comments')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{comments}</dd>
                    </div>
                  )}
                  
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">{t('parcel.verify.signature')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {t('parcel.verify.signature_added', 'Digital signature added')}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('witnesses')}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('parcel.verify.back', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={handleVerificationSubmit}
                  disabled={isSubmitting}
                  className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                    verificationStatus === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('parcel.verify.submitting', 'Submitting...')}
                    </>
                  ) : (
                    verificationStatus === 'approve' 
                      ? t('parcel.verify.submit_approval', 'Submit Approval') 
                      : t('parcel.verify.submit_dispute', 'Submit Dispute')
                  )}
                </button>
              </div>
              
              {error && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}
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