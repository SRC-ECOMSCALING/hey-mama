import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon with proper WebSocket constructor
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper error handling and timeouts
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration
  max: 10,                    // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,   // How long a client is allowed to remain idle
  connectionTimeoutMillis: 10000, // How long to wait for a connection
  maxUses: 7500,             // Maximum number of times a connection can be used
  allowExitOnIdle: true      // Allow the pool to close idle connections
});

// Add error handling to the pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit the process, just log the error
});

// Create database client with schema
export const db = drizzle({ client: pool, schema });

// Database connection health check function
export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Graceful shutdown function
export async function closeDbPool(): Promise<void> {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// Retry utility for database operations
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Database operation attempt ${attempt} failed:`, error);
      
      // Don't retry on certain types of errors (like validation errors)
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as any;
        // Don't retry on validation errors, constraint violations, etc.
        if (dbError.code && ['23505', '23502', '23503', '23514'].includes(dbError.code)) {
          throw error;
        }
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}
