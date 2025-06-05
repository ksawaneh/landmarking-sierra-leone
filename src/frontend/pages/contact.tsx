import { useState } from 'react';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '../components/Layout';

export default function Contact() {
  const { t } = useTranslation('common');
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    submitted: false,
    loading: false,
    error: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      // await api.post('/contact', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFormState(prev => ({
        ...prev,
        submitted: true,
        loading: false
      }));
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        loading: false,
        error: 'There was a problem submitting your message. Please try again.'
      }));
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t('contact.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              {t('contact.heading', 'Contact Us')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              {t('contact.subheading', 'Get in touch with our team')}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {formState.submitted ? (
                  <div className="text-center py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('contact.thankYou', 'Thank you for your message!')}
                    </h3>
                    <p className="mt-2 text-gray-500">
                      {t('contact.responseMessage', 'We have received your inquiry and will respond as soon as possible.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFormState({
                        name: '',
                        email: '',
                        phone: '',
                        message: '',
                        submitted: false,
                        loading: false,
                        error: ''
                      })}
                      className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {t('contact.sendAnother', 'Send Another Message')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          {t('contact.form.name')}
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            value={formState.name}
                            onChange={handleChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          {t('contact.form.phone')}
                        </label>
                        <div className="mt-1">
                          <input
                            type="tel"
                            name="phone"
                            id="phone"
                            value={formState.phone}
                            onChange={handleChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          {t('contact.form.email')}
                        </label>
                        <div className="mt-1">
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formState.email}
                            onChange={handleChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                          {t('contact.form.message')}
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="message"
                            name="message"
                            rows={5}
                            required
                            value={formState.message}
                            onChange={handleChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    {formState.error && (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">{formState.error}</h3>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={formState.loading}
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {formState.loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('contact.form.sending')}
                          </>
                        ) : (
                          t('contact.form.submit')
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-10 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {t('contact.officeDetails')}
                </h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">
                      {t('contact.address')}
                    </h4>
                    <p className="mt-1 text-sm text-gray-900">
                      123 Main Street<br />
                      Freetown<br />
                      Sierra Leone
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">
                      {t('contact.email')}
                    </h4>
                    <p className="mt-1 text-sm text-gray-900">
                      info@landmarking.org
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">
                      {t('contact.phone')}
                    </h4>
                    <p className="mt-1 text-sm text-gray-900">
                      +232 78 123 456
                    </p>
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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  };
};