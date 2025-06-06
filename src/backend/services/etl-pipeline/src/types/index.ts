/**
 * Type definitions for ETL Pipeline
 */

import { GovernmentLandRecord, GovernmentTaxRecord } from '../../government/schemas/government-data.types';

// Pipeline Types
export enum PipelineMode {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  CDC = 'cdc'
}

export enum PipelineStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  FAILED = 'failed',
  COMPLETED = 'completed'
}

export interface PipelineConfig {
  name: string;
  mode: PipelineMode;
  schedule?: string;
  sources: SourceConfig[];
  transformations: TransformationConfig[];
  destinations: DestinationConfig[];
  monitoring: MonitoringConfig;
}

// Source Configuration
export interface SourceConfig {
  name: string;
  type: 'database' | 'api' | 'file';
  connection?: string;
  baseUrl?: string;
  apiKey?: string;
  batchSize: number;
  parallelWorkers?: number;
  cdcEnabled?: boolean;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// Transformation Configuration
export interface TransformationConfig {
  name: string;
  type: string;
  config?: Record<string, any>;
  order: number;
}

// Destination Configuration
export interface DestinationConfig {
  name: string;
  type: 'postgresql' | 'blockchain' | 'cache' | 'search';
  connection?: string;
  config?: Record<string, any>;
}

// Monitoring Configuration
export interface MonitoringConfig {
  metricsPort: number;
  alerts: {
    email?: string[];
    sms?: string[];
    webhook?: string;
  };
  dashboardUrl?: string;
}

// Extraction Types
export interface ExtractResult<T = any> {
  data: T[];
  metadata: ExtractMetadata;
  errors: ExtractError[];
}

export interface ExtractMetadata {
  source: string;
  recordCount: number;
  extractedAt: Date;
  duration: number;
  lastId?: string;
  hasMore: boolean;
}

export interface ExtractError {
  record?: any;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

// Transformation Types
export interface TransformResult<T = any> {
  data: T[];
  metadata: TransformMetadata;
  qualityReport: QualityReport;
  errors: TransformError[];
}

export interface TransformMetadata {
  recordCount: number;
  transformedAt: Date;
  duration: number;
  transformations: string[];
}

export interface QualityReport {
  overallScore: number;
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  issues: QualityIssue[];
}

export interface QualityIssue {
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  examples: any[];
}

export interface TransformError {
  record: any;
  transformation: string;
  error: string;
  timestamp: Date;
}

// Loading Types
export interface LoadResult {
  metadata: LoadMetadata;
  errors: LoadError[];
}

export interface LoadMetadata {
  destination: string;
  recordsLoaded: number;
  recordsUpdated: number;
  recordsSkipped: number;
  loadedAt: Date;
  duration: number;
}

export interface LoadError {
  record: any;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

// Pipeline Execution Types
export interface PipelineRun {
  id: string;
  pipelineName: string;
  mode: PipelineMode;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  metrics: PipelineMetrics;
  errors: PipelineError[];
}

export interface PipelineMetrics {
  totalRecords: number;
  recordsExtracted: number;
  recordsTransformed: number;
  recordsLoaded: number;
  recordsFailed: number;
  duration?: number;
  throughput?: number;
}

export interface PipelineError {
  stage: 'extract' | 'transform' | 'load';
  source?: string;
  error: string;
  timestamp: Date;
  context?: any;
}

// Data Models
export interface LandRecord {
  // Core fields
  id: string;
  parcelNumber: string;
  
  // Location
  district: string;
  chiefdom: string;
  ward?: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  boundaries: Array<{
    latitude: number;
    longitude: number;
  }>;
  
  // Ownership
  owner: {
    name: string;
    nationalId?: string;
    phoneNumber?: string;
    email?: string;
  };
  previousOwners?: Array<{
    name: string;
    from: Date;
    to: Date;
  }>;
  
  // Property details
  landType: 'residential' | 'commercial' | 'agricultural' | 'industrial' | 'mixed';
  area: number; // in square meters
  landUse?: string;
  structures?: Array<{
    type: string;
    yearBuilt?: number;
    condition?: string;
  }>;
  
  // Valuation
  currentValue?: number;
  lastValuationDate?: Date;
  taxAssessment?: number;
  
  // Legal
  titleDeedNumber?: string;
  encumbrances?: string[];
  disputes?: Array<{
    type: string;
    status: string;
    filedDate: Date;
  }>;
  
  // Tax compliance
  taxStatus: 'compliant' | 'arrears' | 'exempt';
  lastPaymentDate?: Date;
  arrearsAmount?: number;
  
  // Verification
  verificationStatus: 'verified' | 'pending' | 'disputed';
  lastVerificationDate?: Date;
  verificationMethod?: string;
  
  // Metadata
  sourceSystem: 'MLHCP' | 'NRA' | 'OARG' | 'UNIFIED';
  qualityScore: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Change Data Capture
export interface CDCEvent {
  id: string;
  source: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  before?: any;
  after?: any;
  metadata?: Record<string, any>;
}

// Job Queue Types
export interface JobData {
  type: 'extract' | 'transform' | 'load';
  source?: string;
  config: any;
  retryCount?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metrics?: any;
}

// Monitoring Types
export interface PipelineStats {
  currentStatus: PipelineStatus;
  lastRun?: PipelineRun;
  nextScheduledRun?: Date;
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  recordsProcessedToday: number;
  dataQualityScore: number;
  systemHealth: SystemHealth;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    cache: ComponentHealth;
    queue: ComponentHealth;
    sources: Record<string, ComponentHealth>;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  errorRate?: number;
  lastCheck: Date;
}

// Alert Types
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}