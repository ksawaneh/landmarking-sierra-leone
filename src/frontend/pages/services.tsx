import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '../components/Layout';

export default function Services() {
  const { t } = useTranslation('common');

  const services = [
    {
      name: 'Boundary Mapping',
      description: 'Precise mapping of land boundaries using GPS, satellite imagery, and AI-assisted technology.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      name: 'Document Management',
      description: 'Secure digital storage of land documents with offline capabilities for areas with limited connectivity.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: 'Community Verification',
      description: 'Transparent verification process involving community members, elders, and local authorities.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      name: 'Blockchain Security',
      description: 'Immutable record of land transactions and ownership changes stored securely on blockchain.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      name: 'Offline Functionality',
      description: 'Continue working without internet connection. Changes sync automatically when connectivity returns.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      name: 'Data Analytics',
      description: 'Insights and reporting on land usage, ownership patterns, and community distribution.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <Layout>
      <Head>
        <title>{t('services.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              {t('services.heading', 'Our Services')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('services.subheading', 'Comprehensive land documentation solutions for Sierra Leone')}
            </p>
          </div>

          <div className="mt-16 grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.name} className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-center h-20 w-20 rounded-md bg-blue-100 mx-auto mb-4">
                    {service.icon}
                  </div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 text-center">
                    {service.name}
                  </h3>
                  <p className="mt-3 text-base text-gray-500 text-center">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-extrabold text-gray-900">
              {t('services.customSolutions', 'Custom Solutions for Communities')}
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              {t('services.contactUs', 'Need a customized solution for your community? Contact us to discuss how we can help with your specific land documentation needs.')}
            </p>
            <div className="mt-8">
              <a 
                href="/contact"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                {t('services.contactButton', 'Contact Us')}
              </a>
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