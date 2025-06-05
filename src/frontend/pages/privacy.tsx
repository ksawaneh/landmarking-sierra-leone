import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '../components/Layout';

export default function Privacy() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      <Head>
        <title>{t('privacy.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight">
              {t('privacy.heading', 'Privacy Policy')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('privacy.lastUpdated', 'Last updated: March 1, 2025')}
            </p>
          </div>

          <div className="prose prose-lg prose-blue mx-auto">
            <h2>Introduction</h2>
            <p>
              LandMarking ("we," "our," or "us") respects your privacy and is committed to protecting your personal data. 
              This privacy policy explains how we collect, use, and safeguard your information when you use our 
              land documentation platform.
            </p>
            
            <h2>Information We Collect</h2>
            <p>We collect several types of information, including:</p>
            <ul>
              <li><strong>Personal Information:</strong> Name, email address, phone number, and other contact details.</li>
              <li><strong>Authentication Information:</strong> Account credentials and identity verification data.</li>
              <li><strong>Land Information:</strong> Location coordinates, boundary data, ownership details, and related documents.</li>
              <li><strong>Usage Information:</strong> Device information, IP address, and interaction with our platform.</li>
            </ul>
            
            <h2>How We Use Your Information</h2>
            <p>We use the collected information for:</p>
            <ul>
              <li>Providing and maintaining the land documentation service</li>
              <li>Processing and recording land-related transactions</li>
              <li>Verifying identity and preventing fraud</li>
              <li>Improving our platform and user experience</li>
              <li>Communicating important updates and information</li>
            </ul>
            
            <h2>Data Storage and Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information from unauthorized access, 
              alteration, disclosure, or destruction. This includes encryption, access controls, and regular security audits.
            </p>
            <p>
              For blockchain-based records, transaction data is stored in a distributed manner with robust cryptographic protection.
            </p>
            
            <h2>Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul>
              <li>Government authorities when required for legitimate land documentation purposes</li>
              <li>Third-party service providers who assist in our operations</li>
              <li>Other parties with your explicit consent</li>
            </ul>
            
            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data (where applicable)</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Lodge a complaint with a supervisory authority</li>
            </ul>
            
            <h2>Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes by posting 
              the new policy on this page and updating the "Last updated" date.
            </p>
            
            <h2>Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our data practices, please contact us at:
              <br />
              privacy@landmarking.org
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