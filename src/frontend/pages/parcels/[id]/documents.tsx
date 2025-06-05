import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import DocumentUpload from '../../../components/DocumentUpload';
import { useAuth } from '../../../contexts/AuthContext';
import { parcelService, Parcel, Document } from '../../../api/parcelService';

export default function ParcelDocuments() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingParcel, setIsLoadingParcel] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Fetch parcel if authenticated and id is available
    if (isAuthenticated && id) {
      fetchParcel();
      fetchDocuments();
    }
  }, [isAuthenticated, id]);

  const fetchParcel = async () => {
    try {
      setIsLoadingParcel(true);
      const response = await parcelService.getParcel(id as string);
      setParcel(response.parcel);
      setError('');
    } catch (err) {
      console.error('Error fetching parcel:', err);
      setError('Failed to load parcel details. Please try again.');
    } finally {
      setIsLoadingParcel(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await parcelService.getParcelDocuments(id as string);
      setDocuments(response.documents || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load document list. Please try again.');
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleDocumentUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError('');
      setSuccessMessage('');
      
      // Set document metadata
      const metadata = {
        uploaded_by: 'user', // In a real implementation, this would be the user's ID
        category: 'evidence',
        description: '',
      };
      
      await parcelService.uploadDocument(id as string, file, metadata);
      
      // Refresh the document list
      await fetchDocuments();
      
      setSuccessMessage(t('document.upload.success', 'Document uploaded successfully'));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(t('document.upload.error', 'Failed to upload document. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    try {
      const confirmDelete = window.confirm(t('document.delete.confirm', 'Are you sure you want to delete this document?'));
      
      if (!confirmDelete) {
        return;
      }
      
      setError('');
      setSuccessMessage('');
      
      await parcelService.deleteDocument(id as string, documentId);
      
      // Update local state
      setDocuments(prevDocuments => prevDocuments.filter(doc => doc.id !== documentId));
      
      setSuccessMessage(t('document.delete.success', 'Document deleted successfully'));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(t('document.delete.error', 'Failed to delete document. Please try again.'));
    }
  };

  if (isLoading || isLoadingParcel) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error && !successMessage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!parcel) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p>{t('parcel.detail.not_found')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{t('document.title', 'Manage Documents')} | {parcel.parcel_number} | LandMarking</title>
      </Head>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => router.push(`/parcels/${parcel.id}`)}
                  className="mr-4 text-gray-400 hover:text-gray-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    {t('document.manage_title', 'Supporting Documents')}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('document.for_parcel', 'For parcel')} {parcel.parcel_number}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {t('document.upload.title', 'Upload Evidence')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {t('document.upload.helper_text', 'Upload photos, PDFs, or other documents as evidence for this land parcel')}
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <DocumentUpload
                documents={documents.map(doc => ({
                  id: doc.id,
                  name: doc.name,
                  size: doc.size,
                  type: doc.type,
                  url: doc.url,
                  uploadDate: doc.upload_date,
                  status: doc.status,
                }))}
                onUpload={handleDocumentUpload}
                onDelete={handleDocumentDelete}
                isLoading={isUploading}
                maxSize={10}
                maxFiles={10}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => router.push(`/parcels/${parcel.id}`)}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('document.back_to_parcel', 'Back to Parcel')}
            </button>
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