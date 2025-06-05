import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const [formState, setFormState] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    organization: user?.organization || '',
    profileUpdated: false,
    loading: false,
    error: ''
  });

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      // In a real app, we would send the form data to an API
      // await api.post('/update-profile', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFormState(prev => ({
        ...prev,
        profileUpdated: true,
        loading: false
      }));
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        loading: false,
        error: 'There was a problem updating your profile. Please try again.'
      }));
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t('profile.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {t('profile.personalInfo')}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t('profile.infoDescription')}
                </p>

                <div className="mt-8">
                  <h4 className="text-md font-medium text-gray-900">{t('profile.accountDetails')}</h4>
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="mb-2">
                      <span className="font-semibold">{t('profile.role')}:</span> {user?.role || 'User'}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">{t('profile.accountCreated')}:</span> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">{t('profile.lastActive')}:</span> {user?.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Today'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-5 md:mt-0 md:col-span-2">
              <form onSubmit={handleSubmit}>
                <div className="shadow overflow-hidden sm:rounded-md">
                  <div className="px-4 py-5 bg-white sm:p-6">
                    {formState.profileUpdated && (
                      <div className="mb-4 rounded-md bg-green-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">
                              {t('profile.updateSuccess')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {formState.error && (
                      <div className="mb-4 rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-red-800">
                              {formState.error}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          {t('profile.fullName')}
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={formState.name}
                          onChange={handleChange}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('profile.emailAddress')}
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={formState.email}
                          onChange={handleChange}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          {t('profile.phoneNumber')}
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          value={formState.phone}
                          onChange={handleChange}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                          {t('profile.organization')}
                        </label>
                        <input
                          type="text"
                          name="organization"
                          id="organization"
                          value={formState.organization}
                          onChange={handleChange}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                    <button
                      type="submit"
                      disabled={formState.loading}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {formState.loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('profile.saving')}
                        </>
                      ) : (
                        t('profile.saveChanges')
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="hidden sm:block" aria-hidden="true">
            <div className="py-5">
              <div className="border-t border-gray-200"></div>
            </div>
          </div>

          <div className="mt-10 sm:mt-0 md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {t('profile.securitySettings')}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t('profile.securityDescription')}
                </p>
              </div>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              <div className="shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 bg-white space-y-6 sm:p-6">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">{t('profile.changePassword')}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {t('profile.passwordSecurityNote')}
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {t('profile.changePasswordButton')}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-md font-medium text-gray-900">{t('profile.twoFactor')}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {t('profile.twoFactorDescription')}
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {t('profile.setupTwoFactor')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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