import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';

export default function Offline() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      <Head>
        <title>Offline | LandMarking</title>
      </Head>

      <main className="flex-grow flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg text-center">
          <div className="mb-6">
            <svg className="h-16 w-16 mx-auto text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're offline</h1>
          <p className="text-gray-600 mb-6">
            It looks like you lost your connection. Some features may be unavailable until you're back online.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              You can still:
            </p>
            <ul className="text-left text-sm text-gray-600 pl-6 list-disc space-y-1">
              <li>View cached land parcels</li>
              <li>Create new land parcels (they'll sync when you're back online)</li>
              <li>Edit existing cached parcels</li>
            </ul>
          </div>
          <div className="mt-8 space-y-3">
            <Link 
              href="/dashboard" 
              className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Dashboard
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="block w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  };
};