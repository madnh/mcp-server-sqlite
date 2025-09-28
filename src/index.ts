#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs";

/**
 * MCP Server for SQLite Database Operations
 * Provides comprehensive SQLite database interaction capabilities
 */

// Configuration
const DEFAULT_DB_PATH = process.env.SQLITE_DB_PATH || "./database.db";

// Database connection
let db: Database.Database | null = null;

// Initialize database connection
function initializeDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  try {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const database = new Database(dbPath, { verbose: console.log });

    // Enable WAL mode for better performance
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
    database.pragma('cache_size = 1000000');
    database.pragma('temp_store = memory');

    console.error(`Connected to SQLite database: ${dbPath}`);
    return database;
  } catch (error) {
    console.error(`Failed to initialize database: ${error}`);
    throw error;
  }
}

// Get database instance
function getDatabase(): Database.Database {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

// Create MCP Server
const server = new McpServer({
  name: "sqlite-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
});

// Utility functions
function formatTableInfo(columns: any[]): string {
  return columns.map(col =>
    `${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`
  ).join('\n');
}

function validateSqlQuery(sql: string): { isValid: boolean; isReadOnly: boolean; error?: string } {
  const trimmedSql = sql.trim().toLowerCase();

  // Check for dangerous operations
  const dangerousPatterns = [
    /pragma\s+(?!table_info|schema_version|user_version)/,
    /attach\s+database/,
    /detach\s+database/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedSql)) {
      return { isValid: false, isReadOnly: false, error: "Dangerous SQL operation detected" };
    }
  }

  // Check if query is read-only
  const readOnlyPatterns = [
    /^select\s/,
    /^with\s.*select\s/,
    /^pragma\s+table_info/,
    /^pragma\s+schema_version/,
    /^pragma\s+user_version/,
  ];

  const isReadOnly = readOnlyPatterns.some(pattern => pattern.test(trimmedSql));

  return { isValid: true, isReadOnly };
}

// Error handler
function handleDatabaseError(error: any): { content: Array<{ type: "text"; text: string }>, isError: boolean } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Database error:", errorMessage);

  return {
    content: [{
      type: "text",
      text: `Database error: ${errorMessage}`
    }],
    isError: true
  };
}

export async function main() {
  // Resources

  // Database schema resource
  server.registerResource(
    "schema",
    "schema://database",
    {
      title: "Database Schema",
      description: "Complete database schema including all tables and their structures",
      mimeType: "text/plain"
    },
    async (uri) => {
      try {
        const database = getDatabase();
        const tables = database.prepare(`
          SELECT name, sql FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all() as Array<{ name: string; sql: string }>;

        if (tables.length === 0) {
          return {
            contents: [{
              uri: uri.href,
              text: "No tables found in database"
            }]
          };
        }

        const schemaText = tables.map(table => `-- Table: ${table.name}\n${table.sql};`).join('\n\n');

        return {
          contents: [{
            uri: uri.href,
            text: schemaText
          }]
        };
      } catch (error) {
        console.error("Error reading schema:", error);
        return {
          contents: [{
            uri: uri.href,
            text: `Error reading schema: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Tables list resource
  server.registerResource(
    "tables",
    "tables://list",
    {
      title: "Database Tables",
      description: "List of all tables in the database",
      mimeType: "application/json"
    },
    async (uri) => {
      try {
        const database = getDatabase();
        const tables = database.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all() as Array<{ name: string }>;

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(tables.map(t => t.name), null, 2)
          }]
        };
      } catch (error) {
        console.error("Error reading tables:", error);
        return {
          contents: [{
            uri: uri.href,
            text: `Error reading tables: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Table info resource (dynamic)
  server.registerResource(
    "table-info",
    new ResourceTemplate("table-info://{tableName}", { list: undefined }),
    {
      title: "Table Information",
      description: "Detailed information about a specific table"
    },
    async (uri, { tableName }) => {
      try {
        const database = getDatabase();

        // Get table info
        const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
        const indexes = database.prepare(`PRAGMA index_list(${tableName})`).all();
        const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${tableName})`).all();

        const info = {
          table: tableName,
          columns,
          indexes,
          foreignKeys,
          columnInfo: formatTableInfo(columns)
        };

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(info, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error reading table info for ${tableName}:`, error);
        return {
          contents: [{
            uri: uri.href,
            text: `Error reading table info: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Tools

  // Query tool (read-only)
  server.registerTool(
    "query",
    {
      title: "Execute SQL Query",
      description: "Execute a read-only SQL query and return results",
      inputSchema: {
        sql: z.string().describe("SQL query to execute (SELECT statements only)")
      }
    },
    async ({ sql }) => {
      try {
        const validation = validateSqlQuery(sql);
        if (!validation.isValid) {
          return handleDatabaseError(new Error(validation.error || "Invalid SQL"));
        }

        if (!validation.isReadOnly) {
          return handleDatabaseError(new Error("Only read-only queries are allowed. Use 'execute' tool for write operations."));
        }

        const database = getDatabase();
        const results = database.prepare(sql).all();

        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Execute tool (write operations)
  server.registerTool(
    "execute",
    {
      title: "Execute SQL Statement",
      description: "Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE, CREATE, DROP)",
      inputSchema: {
        sql: z.string().describe("SQL statement to execute")
      }
    },
    async ({ sql }) => {
      try {
        const validation = validateSqlQuery(sql);
        if (!validation.isValid) {
          return handleDatabaseError(new Error(validation.error || "Invalid SQL"));
        }

        const database = getDatabase();
        const result = database.prepare(sql).run();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              changes: result.changes,
              lastInsertRowid: result.lastInsertRowid,
              message: `Statement executed successfully. ${result.changes} row(s) affected.`
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Describe table tool
  server.registerTool(
    "describe-table",
    {
      title: "Describe Table",
      description: "Get detailed information about a table structure",
      inputSchema: {
        tableName: z.string().describe("Name of the table to describe")
      }
    },
    async ({ tableName }) => {
      try {
        const database = getDatabase();

        // Check if table exists
        const tableExists = database.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name=?
        `).get(tableName);

        if (!tableExists) {
          return handleDatabaseError(new Error(`Table '${tableName}' does not exist`));
        }

        const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
        const indexes = database.prepare(`PRAGMA index_list(${tableName})`).all();
        const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${tableName})`).all();

        const description = {
          tableName,
          columns,
          indexes,
          foreignKeys,
          columnCount: columns.length,
          formattedColumns: formatTableInfo(columns)
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(description, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // List tables tool
  server.registerTool(
    "list-tables",
    {
      title: "List Tables",
      description: "List all tables in the database",
      inputSchema: {}
    },
    async () => {
      try {
        const database = getDatabase();
        const tables = database.prepare(`
          SELECT name, sql FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all();

        return {
          content: [{
            type: "text",
            text: JSON.stringify(tables, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Create table tool
  server.registerTool(
    "create-table",
    {
      title: "Create Table",
      description: "Create a new table with specified columns and constraints",
      inputSchema: {
        name: z.string().describe("Table name"),
        columns: z.array(z.object({
          name: z.string().describe("Column name"),
          type: z.string().describe("Column type (TEXT, INTEGER, REAL, BLOB)"),
          primaryKey: z.boolean().optional().describe("Whether this is a primary key"),
          notNull: z.boolean().optional().describe("Whether this column is NOT NULL"),
          unique: z.boolean().optional().describe("Whether this column is UNIQUE"),
          defaultValue: z.string().optional().describe("Default value for the column")
        })).describe("Array of column definitions"),
        ifNotExists: z.boolean().optional().default(true).describe("Add IF NOT EXISTS clause")
      }
    },
    async ({ name, columns, ifNotExists }) => {
      try {
        const columnDefinitions = columns.map(col => {
          let def = `${col.name} ${col.type}`;
          if (col.primaryKey) def += " PRIMARY KEY";
          if (col.notNull) def += " NOT NULL";
          if (col.unique) def += " UNIQUE";
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
          return def;
        });

        const createStatement = `CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${name} (${columnDefinitions.join(', ')})`;

        const database = getDatabase();
        const result = database.prepare(createStatement).run();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Table '${name}' created successfully`,
              sql: createStatement,
              changes: result.changes
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Drop table tool
  server.registerTool(
    "drop-table",
    {
      title: "Drop Table",
      description: "Delete a table from the database",
      inputSchema: {
        name: z.string().describe("Table name to drop"),
        ifExists: z.boolean().optional().default(true).describe("Add IF EXISTS clause")
      }
    },
    async ({ name, ifExists }) => {
      try {
        const dropStatement = `DROP TABLE ${ifExists ? 'IF EXISTS ' : ''}${name}`;

        const database = getDatabase();
        const result = database.prepare(dropStatement).run();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Table '${name}' dropped successfully`,
              sql: dropStatement,
              changes: result.changes
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Insert records tool
  server.registerTool(
    "insert-record",
    {
      title: "Insert Record",
      description: "Insert a new record into a table",
      inputSchema: {
        table: z.string().describe("Table name"),
        data: z.record(z.any()).describe("Record data as key-value pairs")
      }
    },
    async ({ table, data }) => {
      try {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        const insertStatement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        const database = getDatabase();
        const result = database.prepare(insertStatement).run(...values);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Record inserted successfully",
              insertedId: result.lastInsertRowid,
              changes: result.changes,
              sql: insertStatement
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Update records tool
  server.registerTool(
    "update-record",
    {
      title: "Update Record",
      description: "Update existing records in a table",
      inputSchema: {
        table: z.string().describe("Table name"),
        data: z.record(z.any()).describe("Updated data as key-value pairs"),
        where: z.string().describe("WHERE clause to identify records to update")
      }
    },
    async ({ table, data, where }) => {
      try {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);

        const updateStatement = `UPDATE ${table} SET ${setClause} WHERE ${where}`;

        const database = getDatabase();
        const result = database.prepare(updateStatement).run(...values);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Records updated successfully",
              changes: result.changes,
              sql: updateStatement
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Delete records tool
  server.registerTool(
    "delete-record",
    {
      title: "Delete Record",
      description: "Delete records from a table",
      inputSchema: {
        table: z.string().describe("Table name"),
        where: z.string().describe("WHERE clause to identify records to delete")
      }
    },
    async ({ table, where }) => {
      try {
        const deleteStatement = `DELETE FROM ${table} WHERE ${where}`;

        const database = getDatabase();
        const result = database.prepare(deleteStatement).run();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Records deleted successfully",
              changes: result.changes,
              sql: deleteStatement
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Transaction tool
  server.registerTool(
    "transaction",
    {
      title: "Execute Transaction",
      description: "Execute multiple SQL statements within a transaction",
      inputSchema: {
        statements: z.array(z.string()).describe("Array of SQL statements to execute in transaction")
      }
    },
    async ({ statements }) => {
      const database = getDatabase();
      const transaction = database.transaction((stmts: string[]) => {
        const results = [];
        for (const stmt of stmts) {
          const validation = validateSqlQuery(stmt);
          if (!validation.isValid) {
            throw new Error(`Invalid SQL: ${validation.error}`);
          }
          const result = database.prepare(stmt).run();
          results.push({
            sql: stmt,
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
          });
        }
        return results;
      });

      try {
        const results = transaction(statements);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Transaction completed successfully",
              results,
              totalStatements: statements.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleDatabaseError(error);
      }
    }
  );

  // Prompts

  // Analyze schema prompt
  server.registerPrompt(
    "analyze-schema",
    {
      title: "Analyze Database Schema",
      description: "Generate a comprehensive analysis of the database schema",
      argsSchema: {
        includeData: z.string().optional().describe("Set to 'true' to include sample data in analysis")
      }
    },
    async ({ includeData }) => {
      const shouldIncludeData = includeData === 'true';
      try {
        const database = getDatabase();
        const tables = database.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all() as Array<{ name: string }>;

        let schemaAnalysis = "Please analyze this SQLite database schema:\n\n";

        for (const table of tables) {
          const columns = database.prepare(`PRAGMA table_info(${table.name})`).all();
          const indexes = database.prepare(`PRAGMA index_list(${table.name})`).all();
          const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${table.name})`).all();

          schemaAnalysis += `Table: ${table.name}\n`;
          schemaAnalysis += `Columns: ${formatTableInfo(columns)}\n`;

          if (indexes.length > 0) {
            schemaAnalysis += `Indexes: ${indexes.map((idx: any) => idx.name).join(', ')}\n`;
          }

          if (foreignKeys.length > 0) {
            schemaAnalysis += `Foreign Keys: ${foreignKeys.length} constraint(s)\n`;
          }

          if (shouldIncludeData) {
            const sampleData = database.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
            if (sampleData.length > 0) {
              schemaAnalysis += `Sample Data (3 rows): ${JSON.stringify(sampleData, null, 2)}\n`;
            }
          }

          schemaAnalysis += "\n";
        }

        schemaAnalysis += "Please provide insights about:\n";
        schemaAnalysis += "1. Database design patterns and relationships\n";
        schemaAnalysis += "2. Potential optimization opportunities\n";
        schemaAnalysis += "3. Data integrity and constraint recommendations\n";
        schemaAnalysis += "4. Indexing suggestions for better performance\n";

        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: schemaAnalysis
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Error analyzing schema: ${error instanceof Error ? error.message : String(error)}`
            }
          }]
        };
      }
    }
  );

  // Generate query prompt
  server.registerPrompt(
    "generate-query",
    {
      title: "Generate SQL Query",
      description: "Help generate SQL queries based on requirements",
      argsSchema: {
        requirement: z.string().describe("Description of what you want to query"),
        tables: z.string().optional().describe("Comma-separated list of tables to focus on")
      }
    },
    async ({ requirement, tables }) => {
      try {
        const database = getDatabase();
        let schemaContext = "";

        if (tables && tables.trim().length > 0) {
          // Get schema for specific tables
          const tableList = tables.split(',').map(t => t.trim());
          for (const tableName of tableList) {
            const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
            schemaContext += `Table ${tableName}: ${formatTableInfo(columns)}\n`;
          }
        } else {
          // Get schema for all tables
          const allTables = database.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
          `).all() as Array<{ name: string }>;

          for (const table of allTables) {
            const columns = database.prepare(`PRAGMA table_info(${table.name})`).all();
            schemaContext += `Table ${table.name}: ${formatTableInfo(columns)}\n`;
          }
        }

        const prompt = `Given the following database schema:

${schemaContext}

Please generate an appropriate SQL query for this requirement: ${requirement}

Provide:
1. The complete SQL query
2. Explanation of what the query does
3. Any assumptions made
4. Suggestions for optimization if applicable`;

        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: prompt
            }
          }]
        };
      } catch (error) {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Error generating query prompt: ${error instanceof Error ? error.message : String(error)}`
            }
          }]
        };
      }
    }
  );

  // Optimize query prompt
  server.registerPrompt(
    "optimize-query",
    {
      title: "Optimize SQL Query",
      description: "Get suggestions for optimizing a SQL query",
      argsSchema: {
        query: z.string().describe("SQL query to optimize"),
        executionContext: z.string().optional().describe("Additional context about how the query is used")
      }
    },
    ({ query, executionContext }) => {
      const prompt = `Please analyze and suggest optimizations for this SQL query:

\`\`\`sql
${query}
\`\`\`

${executionContext ? `Execution context: ${executionContext}\n` : ''}

Please provide:
1. Performance analysis of the current query
2. Specific optimization recommendations
3. Alternative query approaches if applicable
4. Index recommendations
5. Potential bottlenecks to watch out for

Consider factors like:
- Query execution plan
- Index usage
- Join efficiency
- WHERE clause optimization
- SELECT column optimization`;

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: prompt
          }
        }]
      };
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("SQLite MCP Server running on stdio");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  if (db) {
    console.error('Closing database connection...');
    db.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (db) {
    console.error('Closing database connection...');
    db.close();
  }
  process.exit(0);
});

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}