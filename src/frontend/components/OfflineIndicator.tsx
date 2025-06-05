import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { offlineSync } from '../services/offlineSync';
import syncService from '../services/syncService';

/**
 * Offline Indicator Component
 * 
 * Displays the current network status and pending sync operations.
 * Also provides manual sync functionality when back online.
 */
const OfflineIndicator: React.FC = () => {
  const { t } = useTranslation('common');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: number;
    entitiesTracked?: number;
  }>({ lastSync: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Update the status when the component mounts and when network status changes
  useEffect(() => {
    // Initialize with current status
    updateStatus();
    
    // Set up event listeners for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };
    
    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up regular status updates
    const intervalId = setInterval(updateStatus, 10000);
    
    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);
  
  // Update the status info
  const updateStatus = () => {
    setIsOnline(offlineSync.isOnline());
    setPendingOperations(offlineSync.getPendingOperationsCount());
    setSyncStatus(syncService.getSyncStatus());
  };
  
  // Manually trigger sync
  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await syncService.startSync();
      console.log('Sync result:', result);
      updateStatus();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Format the last sync time
  const formatLastSync = (timestamp: number) => {
    if (!timestamp) return t('offline.never_synced', 'Never');
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Don't show if there are no pending operations and we're online
  if (isOnline && pendingOperations === 0 && !isExpanded) {
    return null;
  }
  
  return (
    <div className={`fixed bottom-4 right-4 rounded-lg shadow-lg ${isOnline ? 'bg-white' : 'bg-yellow-50'} z-50`}>
      {/* Collapsed view - just show an icon with a badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="p-4 flex items-center space-x-2 rounded-lg"
        >
          <div className="relative">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-6 w-6 ${isOnline ? 'text-green-500' : 'text-yellow-500'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              {isOnline ? (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" 
                />
              ) : (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
                />
              )}
            </svg>
            
            {/* Badge showing pending operations */}
            {pendingOperations > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingOperations}
              </span>
            )}
          </div>
        </button>
      )}
      
      {/* Expanded view with details */}
      {isExpanded && (
        <div className="p-4 w-80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">
              {t('offline.sync_status', 'Sync Status')}
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2 mb-4">
            {/* Connection status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span>
                {isOnline 
                  ? t('offline.online', 'Connected') 
                  : t('offline.offline', 'Offline Mode')}
              </span>
            </div>
            
            {/* Pending operations */}
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>
                {pendingOperations === 0 
                  ? t('offline.no_pending', 'No pending changes') 
                  : t('offline.pending_count', '{{count}} pending changes', { count: pendingOperations })}
              </span>
            </div>
            
            {/* Last sync time */}
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">
                {t('offline.last_sync', 'Last sync')}: {formatLastSync(syncStatus.lastSync)}
              </span>
            </div>
            
            {/* Tracked entities */}
            {syncStatus.entitiesTracked !== undefined && (
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-sm">
                  {t('offline.entities_tracked', 'Entities tracked')}: {syncStatus.entitiesTracked}
                </span>
              </div>
            )}
          </div>
          
          {/* Sync button */}
          {pendingOperations > 0 && isOnline && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('offline.syncing', 'Syncing...')}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('offline.sync_now', 'Sync Now')}
                </>
              )}
            </button>
          )}
          
          {/* Offline help text */}
          {!isOnline && (
            <div className="mt-2 text-xs text-yellow-700">
              <p>{t('offline.help_text', 'Your changes will be saved locally and synchronized when you reconnect to the internet.')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;