import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { parcelService, Parcel } from '../../api/parcelService';

// Dynamically import the map component with no SSR
const MapComponent = dynamic(
  () => import('../../components/MapComponent'),
  { ssr: false }
);


export default function ParcelDetail() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Fetch parcel if authenticated and id is available
    if (isAuthenticated && id) {
      fetchParcel();
    }
  }, [isAuthenticated, id]);

  const fetchParcel = async () => {
    try {
      setIsLoadingParcel(true);
      const response = await parcelService.getParcel(id as string);
      setParcel(response.parcel);
      setError('');
    } catch (err) {
      console.error('Error fetching parcel:', err);
      setError('Failed to load parcel details. Please try again.');
    } finally {
      setIsLoadingParcel(false);
    }
  };

  // Map status to badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'disputed':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
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

  if (error) {
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

  return (
    <Layout>
      <Head>
        <title>{parcel.parcel_number} | {t('parcel.detail.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate mr-2">
                  {parcel.parcel_number}
                </h1>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(parcel.status)}`}>
                  {t(`dashboard.verification.${parcel.status}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {parcel.land_use.charAt(0).toUpperCase() + parcel.land_use.slice(1)} • {parcel.area_sqm.toLocaleString()} m²
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
              <button
                type="button"
                onClick={() => router.push(`/parcels/${parcel.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('parcel.detail.edit')}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/parcels/${parcel.id}/verify`)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('parcel.detail.verify')}
              </button>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {t('parcel.detail.information')}
              </h2>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.parcel_number')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{parcel.parcel_number}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.status')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(parcel.status)}`}>
                      {t(`dashboard.verification.${parcel.status}`)}
                    </span>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.land_use')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {parcel.land_use.charAt(0).toUpperCase() + parcel.land_use.slice(1)}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.area')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{parcel.area_sqm.toLocaleString()} m²</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.created')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(parcel.created_at)}</dd>
                </div>
                {parcel.metadata?.accuracy_meters && (
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">{t('parcel.detail.gps_accuracy')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">±{parcel.metadata.accuracy_meters} meters</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {t('parcel.detail.map')}
              </h2>
            </div>
            <div className="border-t border-gray-200">
              <div className="h-96 w-full">
                <MapComponent geometry={parcel.geometry} />
              </div>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  {t('parcel.detail.documents', 'Supporting Documents')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {t('parcel.detail.documents_description', 'Photos, PDFs, or other evidence related to this land parcel')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/parcels/${parcel.id}/documents`)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('parcel.detail.manage_documents', 'Manage Documents')}
              </button>
            </div>
            <div className="border-t border-gray-200 p-4">
              {parcel.documents && parcel.documents.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {parcel.documents.slice(0, 3).map((doc) => (
                    <li key={doc.id} className="py-3 flex justify-between">
                      <div className="flex items-center">
                        {doc.type.startsWith('image/') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(doc.upload_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 flex-shrink-0 text-blue-600 hover:text-blue-500"
                      >
                        {t('parcel.detail.view_document', 'View')}
                      </a>
                    </li>
                  ))}
                  
                  {parcel.documents.length > 3 && (
                    <li className="py-3 text-center">
                      <button
                        type="button"
                        onClick={() => router.push(`/parcels/${parcel.id}/documents`)}
                        className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                      >
                        {t('parcel.detail.view_all_documents', 'View all {{count}} documents', { count: parcel.documents.length })}
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <div className="text-center py-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('parcel.detail.no_documents', 'No documents have been uploaded for this parcel')}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/parcels/${parcel.id}/documents`)}
                    className="mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {t('parcel.detail.add_documents', 'Add Documents')}
                  </button>
                </div>
              )}
            </div>
          </div>
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