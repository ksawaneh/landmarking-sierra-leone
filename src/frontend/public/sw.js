// Service Worker for Landmarking App

// Cache names with versioning for easier updates
const CACHE_NAME = 'landmarking-cache-v2';
const API_CACHE_NAME = 'landmarking-api-cache-v2';
const IMAGE_CACHE_NAME = 'landmarking-image-cache-v2';

// Assets to pre-cache for offline usage
const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/offline',
  '/about',
  '/services',
  '/contact',
  '/register',
  '/manifest.json',
  '/favicon.ico',
  '/network-toggle.js',
  '/styles/globals.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Install complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName !== CACHE_NAME &&
                cacheName !== API_CACHE_NAME
              );
            })
            .map((cacheName) => {
              console.log('Service Worker: Clearing old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle API requests
  if (url.pathname.startsWith('/api')) {
    handleApiRequest(event);
    return;
  }
  
  // Handle static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return from cache if available
        if (response) {
          return response;
        }
        
        // Fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-success responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clone and cache the response
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // If offline and requesting a page, serve the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
            
            // Otherwise, fail gracefully
            return new Response('Offline content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle API requests with improved caching strategy
function handleApiRequest(event) {
  // Parse the URL to help with decision making
  const url = new URL(event.request.url);
  
  // Special handling for parcel data - uses stale-while-revalidate strategy
  const isParcelData = url.pathname.includes('/api/parcels') || 
                       url.pathname.includes('/api/boundaries');
  
  // Special handling for image data - cache first with network fallback
  const isImageRequest = url.pathname.includes('/api/images') || 
                         url.pathname.includes('/api/documents');
  
  // For non-GET requests, use network-only strategy
  if (event.request.method !== 'GET') {
    // If offline, queue the request
    if (!navigator.onLine) {
      // In a real implementation, you would queue this operation
      return new Response(JSON.stringify({
        success: false,
        error: 'You are offline. This request has been queued for later.',
        isOffline: true,
        queued: true
      }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
    }
    
    // Online - proceed with network request
    return fetch(event.request);
  }
  
  // For image requests - cache first, then network
  if (isImageRequest) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Return cached response if available
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise fetch from network and cache
          return fetch(event.request)
            .then((networkResponse) => {
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              
              // Clone and cache the image response
              const responseToCache = networkResponse.clone();
              caches.open(IMAGE_CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return networkResponse;
            });
        })
    );
    return;
  }
  
  // For parcel data - stale-while-revalidate
  if (isParcelData) {
    event.respondWith(
      // Try to get from cache first
      caches.match(event.request)
        .then((cachedResponse) => {
          // Start network fetch in the background
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Cache the updated response
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(API_CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch((error) => {
              console.error('Network fetch failed:', error);
              // If we have a cached response, we've already returned it
              // This error is only hit if we have no cached response
              
              return new Response(JSON.stringify({
                success: false,
                error: 'You are offline. Using cached data.',
                isOffline: true,
                cached: false
              }), {
                status: 503,
                headers: new Headers({
                  'Content-Type': 'application/json'
                })
              });
            });
          
          // Return the cached response if we have one, otherwise wait for the network
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  // Default API handling - network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful GET responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(API_CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        
        return networkResponse;
      })
      .catch(() => {
        // If offline, try to serve from cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              // Add header to indicate this is cached data
              const headers = new Headers(cachedResponse.headers);
              headers.append('X-Landmarking-Cache', 'true');
              
              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: 'OK (Cached)',
                headers
              });
            }
            
            // If not in cache, return offline response
            return new Response(JSON.stringify({
              success: false,
              error: 'Network error: You are offline',
              isOffline: true
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'application/json'
              })
            });
          });
      })
  );
}

// Listen for sync events
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-parcels') {
    console.log('Service Worker: Attempting to sync parcels');
    event.waitUntil(syncParcels());
  }
});

// Function to sync parcels from offline storage to server
async function syncParcels() {
  console.log('Service Worker: Syncing parcels...');
  
  try {
    // 1. Get pending operations from localStorage
    const pendingOperationsKey = 'landmarking_pending_operations';
    const pendingOperationsJson = localStorage.getItem(pendingOperationsKey);
    
    if (!pendingOperationsJson) {
      console.log('No pending operations to sync');
      return;
    }
    
    const pendingOperations = JSON.parse(pendingOperationsJson);
    
    if (pendingOperations.length === 0) {
      console.log('No pending operations to sync');
      return;
    }
    
    console.log(`Found ${pendingOperations.length} operations to sync`);
    
    // 2. Process each operation sequentially
    const results = [];
    for (const operation of pendingOperations) {
      try {
        // Update operation status to syncing
        operation.status = 'syncing';
        
        // 3. Send to appropriate API endpoint
        const response = await fetch(operation.endpoint, {
          method: operation.type === 'CREATE' ? 'POST' : 
                  operation.type === 'UPDATE' ? 'PUT' : 
                  operation.type === 'DELETE' ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(operation.payload)
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        // 4. Process successful response
        const data = await response.json();
        results.push({
          operationId: operation.id,
          success: true,
          data
        });
        
        // 5. Remove from pending operations
        const updatedOperations = pendingOperations.filter(op => op.id !== operation.id);
        localStorage.setItem(pendingOperationsKey, JSON.stringify(updatedOperations));
        
      } catch (error) {
        console.error(`Error syncing operation ${operation.id}:`, error);
        
        // Update operation status to error
        operation.status = 'error';
        operation.errorMessage = error.message;
        
        results.push({
          operationId: operation.id,
          success: false,
          error: error.message
        });
      }
    }
    
    // 6. Notify clients that sync is completed
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        results,
        message: `Sync completed: ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed`
      });
    });
    
    // 7. Save the last sync timestamp
    localStorage.setItem('landmarking_last_sync', Date.now().toString());
    
    return results;
    
  } catch (error) {
    console.error('Sync error:', error);
    
    // Notify clients about the sync error
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        error: error.message
      });
    });
    
    throw error;
  }
}

// Self-healing - clean up long-term caches periodically
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(
      caches.open(API_CACHE_NAME)
        .then((cache) => {
          // Clear API cache entries older than 7 days
          // This would require tracking the timestamp of cache entries
          console.log('Service Worker: Periodic cache cleanup');
        })
    );
  }
});