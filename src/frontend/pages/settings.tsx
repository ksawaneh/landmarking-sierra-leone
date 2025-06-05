import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { t, i18n } = useTranslation('common');
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState({
    language: i18n.language || 'en',
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    mapSettings: {
      defaultView: 'standard',
      showLabels: true,
      preferSatellite: false
    },
    offlineMode: {
      enableAutoSync: true,
      maxOfflineStorage: 50 // MB
    },
    settingsUpdated: false,
    loading: false
  });

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setSettings(prev => ({ ...prev, language: lang }));
    i18n.changeLanguage(lang);
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: checked
      }
    }));
  };

  const handleMapSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setSettings(prev => ({
      ...prev,
      mapSettings: {
        ...prev.mapSettings,
        [name]: newValue
      }
    }));
  };

  const handleOfflineModeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setSettings(prev => ({
      ...prev,
      offlineMode: {
        ...prev.offlineMode,
        [name]: type === 'number' ? Number(newValue) : newValue
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(prev => ({ ...prev, loading: true }));

    try {
      // In a real app, we would send the settings to an API
      // await api.post('/update-settings', settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Save settings to localStorage for demonstration
      localStorage.setItem('app_settings', JSON.stringify({
        language: settings.language,
        notifications: settings.notifications,
        mapSettings: settings.mapSettings,
        offlineMode: settings.offlineMode
      }));
      
      setSettings(prev => ({
        ...prev,
        settingsUpdated: true,
        loading: false
      }));
      
      // Reset the updated flag after 3 seconds
      setTimeout(() => {
        setSettings(prev => ({ ...prev, settingsUpdated: false }));
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettings(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <Layout>
      <Head>
        <title>{t('settings.title')} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('settings.title')}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {t('settings.description')}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {settings.settingsUpdated && (
              <div className="mb-6 rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      {t('settings.updateSuccess')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {t('settings.general')}
                </h3>
                
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                      {t('settings.language')}
                    </label>
                    <select
                      id="language"
                      name="language"
                      value={settings.language}
                      onChange={handleLanguageChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="kr">Krio</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {t('settings.notifications')}
                </h3>
                
                <div className="mt-6 space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="email"
                        name="email"
                        type="checkbox"
                        checked={settings.notifications.email}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="email" className="font-medium text-gray-700">
                        {t('settings.emailNotifications')}
                      </label>
                      <p className="text-gray-500">
                        {t('settings.emailNotificationsDesc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="sms"
                        name="sms"
                        type="checkbox"
                        checked={settings.notifications.sms}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="sms" className="font-medium text-gray-700">
                        {t('settings.smsNotifications')}
                      </label>
                      <p className="text-gray-500">
                        {t('settings.smsNotificationsDesc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="push"
                        name="push"
                        type="checkbox"
                        checked={settings.notifications.push}
                        onChange={handleNotificationChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="push" className="font-medium text-gray-700">
                        {t('settings.pushNotifications')}
                      </label>
                      <p className="text-gray-500">
                        {t('settings.pushNotificationsDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {t('settings.mapSettings')}
                </h3>
                
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="defaultView" className="block text-sm font-medium text-gray-700">
                      {t('settings.defaultMapView')}
                    </label>
                    <select
                      id="defaultView"
                      name="defaultView"
                      value={settings.mapSettings.defaultView}
                      onChange={handleMapSettingsChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="standard">Standard</option>
                      <option value="satellite">Satellite</option>
                      <option value="terrain">Terrain</option>
                    </select>
                  </div>
                  
                  <div className="sm:col-span-6">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="showLabels"
                          name="showLabels"
                          type="checkbox"
                          checked={settings.mapSettings.showLabels}
                          onChange={handleMapSettingsChange}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="showLabels" className="font-medium text-gray-700">
                          {t('settings.showMapLabels')}
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-6">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="preferSatellite"
                          name="preferSatellite"
                          type="checkbox"
                          checked={settings.mapSettings.preferSatellite}
                          onChange={handleMapSettingsChange}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="preferSatellite" className="font-medium text-gray-700">
                          {t('settings.preferSatellite')}
                        </label>
                        <p className="text-gray-500">
                          {t('settings.preferSatelliteDesc')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {t('settings.offlineMode')}
                </h3>
                
                <div className="mt-6 space-y-6">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="enableAutoSync"
                        name="enableAutoSync"
                        type="checkbox"
                        checked={settings.offlineMode.enableAutoSync}
                        onChange={handleOfflineModeChange}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="enableAutoSync" className="font-medium text-gray-700">
                        {t('settings.enableAutoSync')}
                      </label>
                      <p className="text-gray-500">
                        {t('settings.enableAutoSyncDesc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label htmlFor="maxOfflineStorage" className="block text-sm font-medium text-gray-700">
                      {t('settings.maxOfflineStorage')}
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input
                        type="number"
                        name="maxOfflineStorage"
                        id="maxOfflineStorage"
                        min="1"
                        max="500"
                        value={settings.offlineMode.maxOfflineStorage}
                        onChange={handleOfflineModeChange}
                        className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                      />
                      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                        MB
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {t('settings.storageWarning')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  disabled={settings.loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {settings.loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('settings.saving')}
                    </>
                  ) : (
                    t('settings.saveSettings')
                  )}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900 text-red-600">
                {t('settings.dangerZone')}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.dangerZoneDesc')}
              </p>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              <h4 className="text-md font-medium text-gray-900">{t('settings.clearData')}</h4>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.clearDataDesc')}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {t('settings.clearLocalData')}
                </button>
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