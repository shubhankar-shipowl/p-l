import pool from "./db";

/**
 * Execute a database query with proper error handling
 */
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(query, params);
    return rows as T[];
  } catch (error: any) {
    // Log detailed error for debugging
    console.error("Database query error:", {
      query: query.substring(0, 100),
      error: error.message,
      code: error.code,
    });

    // Re-throw with more context
    throw new Error(
      `Database error: ${error.message}${error.code ? ` (${error.code})` : ""}`
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get a database connection with retry logic
 */
export async function getConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      return connection;
    } catch (error: any) {
      if (i === retries - 1) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("Failed to get database connection after retries");
}

