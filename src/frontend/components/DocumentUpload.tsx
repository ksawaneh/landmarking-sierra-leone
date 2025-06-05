import { useState, useRef } from 'react';
import { useTranslation } from 'next-i18next';

export type DocumentType = 
  | 'deed' 
  | 'survey' 
  | 'certificate' 
  | 'photo'
  | 'id'
  | 'agreement'
  | 'other';

export type Document = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadDate: string;
  status: 'pending' | 'verified' | 'rejected';
  documentType?: DocumentType;
  description?: string;
  issueDate?: string;
  issuingAuthority?: string;
  expiryDate?: string;
  metadata?: Record<string, any>;
  thumbnailUrl?: string;
  hash?: string; // For verification of document integrity
  modifiedDate?: string;
  offline?: boolean; // Flag for documents stored offline
};

interface DocumentUploadProps {
  documents: Document[];
  onUpload: (file: File, metadata: Partial<Document>) => Promise<void>;
  onDelete?: (documentId: string) => Promise<void>;
  onMetadataChange?: (documentId: string, metadata: Partial<Document>) => Promise<void>;
  isLoading?: boolean;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  maxFiles?: number;
  documentTypes?: DocumentType[];
  required?: boolean;
  offlineEnabled?: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documents = [],
  onUpload,
  onDelete,
  onMetadataChange,
  isLoading = false,
  maxSize = 10, // 10MB default
  allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFiles = 5,
  documentTypes = ['deed', 'survey', 'certificate', 'photo', 'id', 'agreement', 'other'],
  required = false,
  offlineEnabled = false
}) => {
  const { t } = useTranslation('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('other');
  const [documentDescription, setDocumentDescription] = useState<string>('');
  const [documentIssueDate, setDocumentIssueDate] = useState<string>('');
  const [documentIssuingAuthority, setDocumentIssuingAuthority] = useState<string>('');
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setShowMetadataForm(true);
      await handleFiles(e.target.files);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setShowMetadataForm(true);
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    setError('');
    
    // Check if adding these files would exceed the maximum
    if (documents.length + files.length > maxFiles) {
      setError(t('document.error.too_many_files', `You can upload a maximum of ${maxFiles} files.`));
      return;
    }
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        setError(t('document.error.invalid_type', 'Invalid file type. Please upload supported document types.'));
        return;
      }
      
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        setError(t('document.error.file_too_large', `File too large. Maximum size is ${maxSize}MB.`));
        return;
      }
      
      try {
        // Gather metadata
        const metadata: Partial<Document> = {
          documentType: selectedDocumentType,
          description: documentDescription,
          issueDate: documentIssueDate,
          issuingAuthority: documentIssuingAuthority,
          offline: !navigator.onLine && offlineEnabled,
          modifiedDate: new Date().toISOString()
        };
        
        await onUpload(file, metadata);
        
        // Reset form after successful upload
        resetMetadataForm();
      } catch (err) {
        console.error('Error uploading file:', err);
        setError(t('document.error.upload_failed', 'Upload failed. Please try again.'));
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const resetMetadataForm = () => {
    setSelectedDocumentType('other');
    setDocumentDescription('');
    setDocumentIssueDate('');
    setDocumentIssuingAuthority('');
    setShowMetadataForm(false);
    setEditingDocumentId(null);
  };
  
  const handleEditMetadata = (document: Document) => {
    setEditingDocumentId(document.id);
    setSelectedDocumentType(document.documentType || 'other');
    setDocumentDescription(document.description || '');
    setDocumentIssueDate(document.issueDate || '');
    setDocumentIssuingAuthority(document.issuingAuthority || '');
    setShowMetadataForm(true);
  };
  
  const handleSaveMetadata = async () => {
    if (!editingDocumentId || !onMetadataChange) return;
    
    try {
      const metadata: Partial<Document> = {
        documentType: selectedDocumentType,
        description: documentDescription,
        issueDate: documentIssueDate,
        issuingAuthority: documentIssuingAuthority,
        modifiedDate: new Date().toISOString()
      };
      
      await onMetadataChange(editingDocumentId, metadata);
      resetMetadataForm();
    } catch (err) {
      console.error('Error updating document metadata:', err);
      setError(t('document.error.update_failed', 'Update failed. Please try again.'));
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };
  
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    } else if (fileType === 'application/pdf') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2h1v-2h-1zm-2-6H7v1h6V7zm0 2H7v1h6V9zm-2 6H7v1h2v-1z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  // Get localized document type labels
  const getDocumentTypeLabel = (type: DocumentType): string => {
    const labelKeys: Record<DocumentType, string> = {
      deed: 'document.type.deed',
      survey: 'document.type.survey',
      certificate: 'document.type.certificate',
      photo: 'document.type.photo',
      id: 'document.type.id',
      agreement: 'document.type.agreement',
      other: 'document.type.other'
    };
    
    return t(labelKeys[type], type.charAt(0).toUpperCase() + type.slice(1));
  };
  
  // Get background color for offline badge
  const getOfflineBadgeColor = () => {
    return 'bg-amber-100 text-amber-800';
  };
  
  // Render metadata form
  const renderMetadataForm = () => {
    return (
      <div className="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {editingDocumentId 
            ? t('document.metadata.edit_title', 'Edit Document Details') 
            : t('document.metadata.title', 'Document Details')}
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="document-type" className="block text-sm font-medium text-gray-700">
              {t('document.metadata.type', 'Document Type')} {required && <span className="text-red-500">*</span>}
            </label>
            <select
              id="document-type"
              value={selectedDocumentType}
              onChange={(e) => setSelectedDocumentType(e.target.value as DocumentType)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required={required}
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {getDocumentTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="document-description" className="block text-sm font-medium text-gray-700">
              {t('document.metadata.description', 'Description')}
            </label>
            <textarea
              id="document-description"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              rows={2}
              placeholder={t('document.metadata.description_placeholder', 'Brief description of document...')}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="document-issue-date" className="block text-sm font-medium text-gray-700">
                {t('document.metadata.issue_date', 'Issue Date')}
              </label>
              <input
                type="date"
                id="document-issue-date"
                value={documentIssueDate}
                onChange={(e) => setDocumentIssueDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="document-issuing-authority" className="block text-sm font-medium text-gray-700">
                {t('document.metadata.issuing_authority', 'Issuing Authority')}
              </label>
              <input
                type="text"
                id="document-issuing-authority"
                value={documentIssuingAuthority}
                onChange={(e) => setDocumentIssuingAuthority(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder={t('document.metadata.authority_placeholder', 'Organization that issued document...')}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={resetMetadataForm}
              className="py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('document.metadata.cancel', 'Cancel')}
            </button>
            {editingDocumentId ? (
              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={isLoading}
                className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? t('document.metadata.saving', 'Saving...') : t('document.metadata.save', 'Save Changes')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? t('document.upload.uploading', 'Uploading...') : t('document.metadata.continue', 'Continue to Upload')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {!showMetadataForm && (
        <div 
          className={`border-2 border-dashed rounded-md ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'} p-6 flex flex-col items-center justify-center`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="mb-2 text-sm text-gray-500">
            {t('document.upload.drag_drop', 'Drag and drop files here, or')}
          </p>
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
            accept={allowedTypes.join(',')}
          />
          <button
            type="button"
            onClick={() => setShowMetadataForm(true)}
            disabled={isLoading || documents.length >= maxFiles}
            className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {t('document.upload.browse_files', 'Browse Files')}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            {t('document.upload.file_restrictions', `Supported formats: Images, PDF, Office documents. Max size: ${maxSize}MB.`)}
          </p>
          {required && (
            <p className="mt-1 text-xs text-red-500">
              {t('document.upload.required', 'Document upload is required')}
            </p>
          )}
          {documents.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {t('document.upload.file_count', '{{current}} of {{max}} files uploaded', { current: documents.length, max: maxFiles })}
            </p>
          )}
          {!navigator.onLine && offlineEnabled && (
            <div className="mt-2 text-xs bg-yellow-50 text-yellow-700 p-2 rounded-md">
              {t('document.upload.offline_mode', 'Offline mode: Documents will be stored locally and synchronized when back online.')}
            </div>
          )}
        </div>
      )}

      {showMetadataForm && renderMetadataForm()}

      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('document.upload.uploaded_documents', 'Uploaded Documents')}
          </h3>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
            {documents.map((doc) => (
              <li key={doc.id} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center flex-1 min-w-0">
                  {getFileIcon(doc.type)}
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <div className="flex flex-wrap items-center mt-1 gap-1">
                      <p className="text-xs text-gray-500 mr-1">{formatFileSize(doc.size)}</p>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(doc.status)}`}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </span>
                      {doc.documentType && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {getDocumentTypeLabel(doc.documentType)}
                        </span>
                      )}
                      {doc.offline && (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getOfflineBadgeColor()}`}>
                          {t('document.upload.offline', 'Offline')}
                        </span>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{doc.description}</p>
                    )}
                    {(doc.issueDate || doc.issuingAuthority) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {doc.issuingAuthority && <span>{doc.issuingAuthority}</span>}
                        {doc.issueDate && doc.issuingAuthority && <span> • </span>}
                        {doc.issueDate && <span>{new Date(doc.issueDate).toLocaleDateString()}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                  {onMetadataChange && (
                    <button
                      type="button"
                      onClick={() => handleEditMetadata(doc)}
                      className="text-gray-600 hover:text-gray-500"
                      title={t('document.upload.edit_metadata', 'Edit document details')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  )}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500"
                    title={t('document.upload.view', 'View document')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </a>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(doc.id)}
                      className="text-red-600 hover:text-red-500"
                      title={t('document.upload.delete', 'Delete document')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;