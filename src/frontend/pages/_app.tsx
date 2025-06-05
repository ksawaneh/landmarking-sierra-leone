import { AppProps } from 'next/app';
import Head from 'next/head';
import { appWithTranslation } from 'next-i18next';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { useState, useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  }));

  // Register service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  // Add network toggle script for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const script = document.createElement('script');
      script.src = '/network-toggle.js';
      script.async = true;
      document.body.appendChild(script);
      
      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="description" content="Land Documentation and Registry System for Sierra Leone" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <title>LandMarking</title>
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default appWithTranslation(MyApp);