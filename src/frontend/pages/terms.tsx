import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '../components/Layout';

export default function Terms() {
  const { t } = useTranslation('common');

  return (
    <Layout>
      <Head>
        <title>{t('terms.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight">
              {t('terms.heading', 'Terms of Service')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('terms.lastUpdated', 'Last updated: March 1, 2025')}
            </p>
          </div>

          <div className="prose prose-lg prose-blue mx-auto">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the LandMarking platform ("Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our Service.
            </p>
            
            <h2>2. Service Description</h2>
            <p>
              LandMarking provides digital land documentation services including boundary mapping, document management, 
              and verification processes. Our platform is intended to support land ownership documentation in Sierra Leone.
            </p>
            
            <h2>3. User Accounts</h2>
            <p>
              To use certain features of the Service, you must create an account. You are responsible for maintaining 
              the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
            <p>
              You agree to provide accurate and complete information when creating your account and to update your information to keep it accurate and current.
            </p>
            
            <h2>4. User Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Submit false or misleading information</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to interfere with the proper operation of the Service</li>
              <li>Impersonate any person or entity</li>
              <li>Circumvent any access control measures</li>
            </ul>
            
            <h2>5. Data Accuracy</h2>
            <p>
              While we strive to ensure the accuracy of all data on our platform, we cannot guarantee 
              the completeness or accuracy of all information. Users are responsible for validating land details 
              and ownership information through official channels.
            </p>
            
            <h2>6. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by LandMarking and are 
              protected by international copyright, trademark, and other intellectual property laws.
            </p>
            
            <h2>7. Third-Party Links</h2>
            <p>
              Our Service may contain links to third-party websites or services that are not owned or controlled by LandMarking. 
              We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party sites or services.
            </p>
            
            <h2>8. Limitation of Liability</h2>
            <p>
              In no event shall LandMarking, its directors, employees, partners, agents, suppliers, or affiliates be liable 
              for any indirect, incidental, special, consequential, or punitive damages, including without limitation, 
              loss of profits, data, use, goodwill, or other intangible losses.
            </p>
            
            <h2>9. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide 
              at least 30 days' notice prior to any new terms taking effect.
            </p>
            
            <h2>10. Governing Law</h2>
            <p>
              These Terms shall be governed by the laws of Sierra Leone without regard to its conflict of law provisions.
            </p>
            
            <h2>11. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
              <br />
              legal@landmarking.org
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