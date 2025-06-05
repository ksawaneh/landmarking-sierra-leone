/**
 * Configuration loader for ETL pipeline
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import Joi from 'joi';
import { PipelineConfig, PipelineMode } from '../types';
import { logger } from '../utils/logger';

// Configuration schema
const configSchema = Joi.object({
  pipeline: Joi.object({
    name: Joi.string().required(),
    mode: Joi.string().valid('full', 'incremental', 'cdc').default('incremental'),
    schedule: Joi.string().optional()
  }).required(),
  
  sources: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('database', 'api', 'file').required(),
      connection: Joi.string().optional(),
      baseUrl: Joi.string().optional(),
      apiKey: Joi.string().optional(),
      batchSize: Joi.number().min(1).default(1000),
      parallelWorkers: Joi.number().min(1).default(1),
      cdcEnabled: Joi.boolean().default(false),
      mockMode: Joi.boolean().optional()
    })
  ).min(1).required(),
  
  transformations: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      config: Joi.object().optional(),
      order: Joi.number().required()
    })
  ).default([]),
  
  destinations: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('postgresql', 'blockchain', 'cache', 'search').required(),
      connection: Joi.string().optional(),
      config: Joi.object().optional()
    })
  ).min(1).required(),
  
  monitoring: Joi.object({
    metricsPort: Joi.number().default(9090),
    alerts: Joi.object({
      email: Joi.array().items(Joi.string().email()).optional(),
      sms: Joi.array().items(Joi.string()).optional(),
      webhook: Joi.string().uri().optional()
    }).default({})
  }).default({})
});

/**
 * Load pipeline configuration
 */
export function loadConfig(configPath?: string): PipelineConfig {
  // Determine config file path
  const defaultPath = path.join(process.cwd(), 'config', 'pipeline.yaml');
  const envPath = process.env.ETL_CONFIG_PATH;
  const finalPath = configPath || envPath || defaultPath;

  logger.info('Loading configuration', { path: finalPath });

  try {
    // Check if config file exists
    if (!fs.existsSync(finalPath)) {
      logger.warn('Configuration file not found, using defaults', { path: finalPath });
      return getDefaultConfig();
    }

    // Read and parse YAML
    const configContent = fs.readFileSync(finalPath, 'utf-8');
    const rawConfig = yaml.parse(configContent);

    // Replace environment variables
    const config = replaceEnvVars(rawConfig);

    // Validate configuration
    const { error, value } = configSchema.validate(config, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new Error(`Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }

    // Transform to PipelineConfig type
    const pipelineConfig: PipelineConfig = {
      name: value.pipeline.name,
      mode: value.pipeline.mode as PipelineMode,
      schedule: value.pipeline.schedule,
      sources: value.sources,
      transformations: value.transformations.sort((a: any, b: any) => a.order - b.order),
      destinations: value.destinations,
      monitoring: value.monitoring
    };

    logger.info('Configuration loaded successfully', {
      pipeline: pipelineConfig.name,
      sources: pipelineConfig.sources.length,
      destinations: pipelineConfig.destinations.length
    });

    return pipelineConfig;
  } catch (error) {
    logger.error('Failed to load configuration', error);
    throw error;
  }
}

/**
 * Get default configuration
 */
function getDefaultConfig(): PipelineConfig {
  return {
    name: 'government-etl',
    mode: PipelineMode.INCREMENTAL,
    schedule: '0 2 * * *', // Daily at 2 AM
    
    sources: [
      {
        name: 'mlhcp',
        type: 'database',
        connection: process.env.MLHCP_CONNECTION_STRING || '',
        batchSize: 1000,
        parallelWorkers: 2,
        mockMode: true // Use mock mode by default
      },
      {
        name: 'nra',
        type: 'api',
        baseUrl: process.env.NRA_API_URL || '',
        apiKey: process.env.NRA_API_KEY || '',
        batchSize: 500,
        mockMode: true
      }
    ],
    
    transformations: [
      {
        name: 'normalize',
        type: 'DataNormalizer',
        order: 1
      },
      {
        name: 'merge',
        type: 'DataMerger',
        order: 2
      }
    ],
    
    destinations: [
      {
        name: 'postgresql',
        type: 'postgresql',
        connection: process.env.DATABASE_URL || 'postgresql://localhost/landmarking'
      }
    ],
    
    monitoring: {
      metricsPort: 9090,
      alerts: {
        email: process.env.ALERT_EMAIL?.split(',') || [],
        sms: process.env.ALERT_SMS?.split(',') || []
      }
    }
  };
}

/**
 * Replace environment variables in configuration
 */
function replaceEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // Replace ${VAR_NAME} with environment variable value
    return obj.replace(/\${([^}]+)}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvVars(item));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: PipelineConfig, outputPath: string): void {
  try {
    const yamlContent = yaml.stringify(config);
    fs.writeFileSync(outputPath, yamlContent, 'utf-8');
    logger.info('Configuration saved', { path: outputPath });
  } catch (error) {
    logger.error('Failed to save configuration', error);
    throw error;
  }
}