import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { parcelService, Parcel } from '../../api/parcelService';
import { offlineSync } from '../../services/offlineSync';

export default function VerificationList() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuth();
  
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoadingParcels, setIsLoadingParcels] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    // Update online status
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  useEffect(() => {
    if (isAuthenticated) {
      loadParcels();
    }
  }, [isAuthenticated, filterStatus]);
  
  const loadParcels = async () => {
    try {
      setIsLoadingParcels(true);
      
      if (isOnline) {
        // Online: fetch from API
        const params: { status?: string } = {};
        if (filterStatus) {
          params.status = filterStatus;
        }
        
        const response = await parcelService.getParcels(params);
        setParcels(response.parcels);
      } else {
        // Offline: use cached parcels
        const cachedParcels = offlineSync.getCachedParcels();
        
        // Filter by status if needed
        const filteredParcels = filterStatus
          ? cachedParcels.filter(p => p.status === filterStatus)
          : cachedParcels;
          
        setParcels(filteredParcels);
      }
      
      setError('');
    } catch (err) {
      console.error('Error loading parcels for verification:', err);
      setError(t('verification.error_loading', 'Failed to load parcels. Please try again.'));
    } finally {
      setIsLoadingParcels(false);
    }
  };
  
  // Filter parcels by search query
  const filteredParcels = searchQuery
    ? parcels.filter(parcel => 
        parcel.parcel_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (parcel.metadata?.owner_name && 
         parcel.metadata.owner_name.toLowerCase().includes(searchQuery.toLowerCase())))
    : parcels;
  
  // Get parcels that need verification (pending status)
  const pendingVerificationParcels = filteredParcels.filter(p => p.status === 'pending');
  
  // Get parcels with disputes
  const disputedParcels = filteredParcels.filter(p => p.status === 'disputed');
  
  // Get verified parcels
  const verifiedParcels = filteredParcels.filter(p => p.status === 'verified');
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  if (isLoading || isLoadingParcels) {
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
        <title>{t('verification.title', 'Verification List')} | LandMarking</title>
      </Head>
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {t('verification.heading', 'Community Verification')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('verification.description', 'Review and verify land parcels in your community')}
              </p>
            </div>
          </div>
          
          {/* Connection status badge */}
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
                      {t('verification.offline_note', 'You are viewing cached data while offline. Some features may be limited.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
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
          )}
          
          {/* Filters and search */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="sm:flex sm:justify-between sm:items-center">
              <div className="mb-4 sm:mb-0">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('verification.filter_by_status', 'Filter by status')}
                </label>
                <select
                  id="status"
                  value={filterStatus || ''}
                  onChange={(e) => setFilterStatus(e.target.value || null)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">{t('verification.all_parcels', 'All parcels')}</option>
                  <option value="pending">{t('verification.pending', 'Pending verification')}</option>
                  <option value="verified">{t('verification.verified', 'Verified')}</option>
                  <option value="disputed">{t('verification.disputed', 'Disputed')}</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('verification.search', 'Search parcels')}
                </label>
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('verification.search_placeholder', 'Search by parcel number or owner')}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-10 sm:text-sm border-gray-300 rounded-md"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pending Verification List */}
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="px-4 py-5 sm:px-6 bg-yellow-50">
              <h2 className="text-lg leading-6 font-medium text-yellow-800">
                {t('verification.pending_heading', 'Parcels Awaiting Verification')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-yellow-600">
                {t('verification.pending_description', 'These parcels need community verification')}
              </p>
            </div>
            
            {pendingVerificationParcels.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {pendingVerificationParcels.map((parcel) => (
                  <li key={parcel.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <h3 className="text-sm font-medium text-gray-900">{parcel.parcel_number}</h3>
                              <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                {t('verification.pending', 'Pending')}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              <span className="mr-2">{formatDate(parcel.created_at)}</span>
                              <span className="mr-2">•</span>
                              <span className="capitalize">{parcel.land_use}</span>
                              <span className="mr-2">•</span>
                              <span>{parcel.area_sqm.toLocaleString()} m²</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Link href={`/parcels/${parcel.id}/verify`} className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            {t('verification.verify_now', 'Verify Now')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-5 sm:px-6 text-center text-gray-500 italic">
                {t('verification.no_pending', 'No parcels currently awaiting verification')}
              </div>
            )}
          </div>
          
          {/* Disputed Parcels List */}
          {(filterStatus === null || filterStatus === 'disputed') && (
            <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
              <div className="px-4 py-5 sm:px-6 bg-red-50">
                <h2 className="text-lg leading-6 font-medium text-red-800">
                  {t('verification.disputed_heading', 'Disputed Parcels')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-red-600">
                  {t('verification.disputed_description', 'These parcels have been disputed and need resolution')}
                </p>
              </div>
              
              {disputedParcels.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {disputedParcels.map((parcel) => (
                    <li key={parcel.id}>
                      <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <h3 className="text-sm font-medium text-gray-900">{parcel.parcel_number}</h3>
                                <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  {t('verification.disputed', 'Disputed')}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                <span className="mr-2">{formatDate(parcel.created_at)}</span>
                                <span className="mr-2">•</span>
                                <span className="capitalize">{parcel.land_use}</span>
                                <span className="mr-2">•</span>
                                <span>{parcel.area_sqm.toLocaleString()} m²</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <Link href={`/parcels/${parcel.id}`} className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                              {t('verification.view_details', 'View Details')}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-5 sm:px-6 text-center text-gray-500 italic">
                  {t('verification.no_disputed', 'No disputed parcels found')}
                </div>
              )}
            </div>
          )}
          
          {/* Verified Parcels List */}
          {(filterStatus === null || filterStatus === 'verified') && verifiedParcels.length > 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-green-50">
                <h2 className="text-lg leading-6 font-medium text-green-800">
                  {t('verification.verified_heading', 'Recently Verified Parcels')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-green-600">
                  {t('verification.verified_description', 'These parcels have been successfully verified')}
                </p>
              </div>
              
              <ul className="divide-y divide-gray-200">
                {verifiedParcels.slice(0, 5).map((parcel) => (
                  <li key={parcel.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <h3 className="text-sm font-medium text-gray-900">{parcel.parcel_number}</h3>
                              <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {t('verification.verified', 'Verified')}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              <span className="mr-2">{formatDate(parcel.created_at)}</span>
                              <span className="mr-2">•</span>
                              <span className="capitalize">{parcel.land_use}</span>
                              <span className="mr-2">•</span>
                              <span>{parcel.area_sqm.toLocaleString()} m²</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Link href={`/parcels/${parcel.id}`} className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            {t('verification.view_details', 'View Details')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              
              {verifiedParcels.length > 5 && (
                <div className="bg-gray-50 px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('verified')}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    {t('verification.view_all_verified', 'View all verified parcels')}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Empty state */}
          {filteredParcels.length === 0 && (
            <div className="text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">{t('verification.no_parcels_found', 'No parcels found')}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t('verification.try_adjusting_filters', 'Try adjusting your search or filters.')}
              </p>
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