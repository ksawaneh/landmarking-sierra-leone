import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';

// Load OfflineIndicator with no SSR
const OfflineIndicator = dynamic(() => import('./OfflineIndicator'), { ssr: false });

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      {children}
      <Footer />
      <OfflineIndicator />
    </div>
  );
}