import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { parcelService, Parcel } from '../api/parcelService';


export default function Dashboard() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoadingParcels, setIsLoadingParcels] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Fetch parcels if authenticated
    if (isAuthenticated) {
      fetchParcels();
    }
  }, [isAuthenticated]);

  const fetchParcels = async () => {
    try {
      setIsLoadingParcels(true);
      const response = await parcelService.getParcels();
      setParcels(response.parcels || []);
      setError('');
    } catch (err) {
      console.error('Error fetching parcels:', err);
      setError('Failed to load parcels. Please try again.');
    } finally {
      setIsLoadingParcels(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
        <title>{t('dashboard.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {t('dashboard.welcome')}
              </h1>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                type="button"
                onClick={() => router.push('/parcels/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('dashboard.parcels.add_new')}
              </button>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {t('dashboard.parcels.title')}
              </h2>
            </div>
            {isLoadingParcels ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="px-4 py-5 sm:p-6 text-center text-red-600">{error}</div>
            ) : parcels.length === 0 ? (
              <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                {t('dashboard.parcels.no_parcels')}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {parcels.map((parcel) => (
                  <li key={parcel.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/parcels/${parcel.id}`)}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-blue-600 truncate">
                          {parcel.parcel_number}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(parcel.status)}`}>
                            {t(`dashboard.verification.${parcel.status}`)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {parcel.land_use.charAt(0).toUpperCase() + parcel.land_use.slice(1)}
                          </p>
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            {parcel.area_sqm.toLocaleString()} m²
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            {formatDate(parcel.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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