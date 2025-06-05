import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function Home() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuth();

  return (
    <Layout>
      <Head>
        <title>{t('home.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              {t('home.heading')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('home.subheading')}
            </p>
            <div className="mt-10 flex justify-center space-x-4">
              {isAuthenticated ? (
                <Link href="/dashboard" className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  {t('home.dashboard')}
                </Link>
              ) : (
                <>
                  <Link href="/login" className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    {t('home.login')}
                  </Link>
                  <Link href="/register" className="inline-flex items-center px-5 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    {t('home.register')}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-20">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {t('home.features.title')}
            </h2>
            <div className="mt-12 grid gap-8 grid-cols-1 md:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('home.features.mapping.title')}
                  </h3>
                  <p className="mt-2 text-base text-gray-500">
                    {t('home.features.mapping.description')}
                  </p>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('home.features.verification.title')}
                  </h3>
                  <p className="mt-2 text-base text-gray-500">
                    {t('home.features.verification.description')}
                  </p>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('home.features.registry.title')}
                  </h3>
                  <p className="mt-2 text-base text-gray-500">
                    {t('home.features.registry.description')}
                  </p>
                </div>
              </div>
            </div>
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