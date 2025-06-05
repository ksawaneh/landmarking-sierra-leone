import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '../components/Layout';

export default function About() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      <Head>
        <title>{t('about.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              {t('about.heading', 'About LandMarking')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('about.subheading', 'Securing land rights for communities in Sierra Leone')}
            </p>
          </div>

          <div className="prose prose-lg prose-blue mx-auto">
            <p>
              LandMarking is a land documentation system designed specifically for Sierra Leone. Our mission is to empower communities by providing accessible tools for mapping, documenting, and verifying land ownership.
            </p>
            
            <h2>Our Mission</h2>
            <p>
              We aim to reduce land-related conflicts, increase tenure security, and promote sustainable development through transparent and accessible land documentation.
            </p>
            
            <h2>Key Features</h2>
            <ul>
              <li>Precise boundary mapping with GPS and satellite imagery</li>
              <li>Offline functionality for rural areas with limited connectivity</li>
              <li>Community-based verification system</li>
              <li>Secure document storage and management</li>
              <li>Blockchain-backed transaction records for transparency</li>
            </ul>
            
            <h2>Partners</h2>
            <p>
              LandMarking works in partnership with local authorities, community organizations, and international development agencies to ensure our approach respects local customs while promoting inclusive land governance.
            </p>
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