// Connection types
export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls: boolean;
  token?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  connectionId?: string;
  error?: string;
}

// Database types
export interface DatabaseInfo {
  name: string;
}

// Collection types
export interface CollectionInfo {
  name: string;
  rowCount: number;
  indexCount: number;
  shardCount: number;
  state: string;
  description?: string;
}

export interface FieldSchema {
  name: string;
  dataType: string;
  dimension?: number;
  maxLength?: number;
  isPrimaryKey: boolean;
  description?: string;
}

export interface IndexConfig {
  fieldName: string;
  indexType: string;
  metricType: string;
  params?: Record<string, unknown>;
}

export interface CreateCollectionRequest {
  collectionName: string;
  fields: FieldSchema[];
  indexParams: IndexConfig[];
  shardsNum?: number;
  consistencyLevel?: string;
  description?: string;
}

// Data types
export interface QueryRequest {
  filter?: string;
  limit?: number;
  offset?: number;
  outputFields?: string[];
}

export interface QueryResult {
  data: Record<string, unknown>[];
  total: number;
}

export interface SearchRequest {
  vector: number[];
  vectorField: string;
  topK: number;
  metricType?: string;
  filter?: string;
  outputFields?: string[];
}

export interface SearchResult {
  id: string | number;
  score: number;
  data: Record<string, unknown>;
}

// Embedding types
export interface EmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

export interface EmbedRequest {
  text: string;
  config?: EmbeddingConfig;
}

export interface EmbedResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
