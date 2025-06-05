import { useState } from 'react';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  organization?: string;
  acceptTerms: boolean;
};

export default function Register() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    defaultValues: {
      role: 'user',
      acceptTerms: false
    }
  });

  const password = watch('password');

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    if (typeof window !== 'undefined') {
      router.push('/dashboard');
    }
    return null;
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // In a real app, we would send the registration data to an API
      // await api.post('/register', data);
      
      // Simulate registration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Redirect to success page or login
      router.push('/login?registered=true');
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage(t('register.error', 'There was a problem creating your account. Please try again.'));
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t('register.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {t('register.createAccount')}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {t('register.alreadyHaveAccount')}{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                {t('register.signIn')}
              </Link>
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              {errorMessage && (
                <div className="rounded-md bg-red-50 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{errorMessage}</h3>
                    </div>
                  </div>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t('register.fullName')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="name"
                      type="text"
                      {...register('name', { required: t('register.nameRequired', 'Name is required') })}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.name && (
                      <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {t('register.emailAddress')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      type="email"
                      {...register('email', {
                        required: t('register.emailRequired', 'Email is required'),
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: t('register.invalidEmail', 'Invalid email address')
                        }
                      })}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.email && (
                      <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {t('register.password')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      type="password"
                      {...register('password', {
                        required: t('register.passwordRequired', 'Password is required'),
                        minLength: {
                          value: 8,
                          message: t('register.passwordLength', 'Password must be at least 8 characters')
                        }
                      })}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.password && (
                      <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    {t('register.confirmPassword')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      type="password"
                      {...register('confirmPassword', {
                        required: t('register.confirmPasswordRequired', 'Please confirm your password'),
                        validate: value => 
                          value === password || t('register.passwordsDoNotMatch', 'Passwords do not match')
                      })}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    {t('register.accountType')}
                  </label>
                  <div className="mt-1">
                    <select
                      id="role"
                      {...register('role')}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="user">{t('register.roles.user')}</option>
                      <option value="surveyor">{t('register.roles.surveyor')}</option>
                      <option value="verifier">{t('register.roles.verifier')}</option>
                      <option value="official">{t('register.roles.official')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                    {t('register.organization')} ({t('register.optional')})
                  </label>
                  <div className="mt-1">
                    <input
                      id="organization"
                      type="text"
                      {...register('organization')}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    {...register('acceptTerms', {
                      required: t('register.acceptTermsRequired', 'You must accept the terms and conditions')
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                    {t('register.acceptTerms')}{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                      {t('register.termsAndConditions')}
                    </Link>
                  </label>
                </div>
                {errors.acceptTerms && (
                  <p className="mt-2 text-sm text-red-600">{errors.acceptTerms.message}</p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('register.creating')}
                      </>
                    ) : (
                      t('register.createAccount')
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                      {t('register.or')}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-center text-sm text-gray-600">
                    {t('register.needHelp')}{' '}
                    <Link href="/contact" className="font-medium text-blue-600 hover:text-blue-500">
                      {t('register.contactUs')}
                    </Link>
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