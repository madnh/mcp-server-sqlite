# SQLite MCP Server

A comprehensive Model Context Protocol (MCP) server for SQLite database operations. This server enables AI assistants to interact with SQLite databases through a standardized interface, providing safe and efficient database operations.

## Features

### 🔍 **Resources**

- **Database Schema**: View complete database schema with all tables and structures
- **Tables List**: Get a list of all tables in the database
- **Table Info**: Detailed information about specific tables including columns, indexes, and foreign keys

### 🛠️ **Tools**

- **query**: Execute read-only SQL queries (SELECT statements)
- **execute**: Execute write operations (INSERT, UPDATE, DELETE, CREATE, DROP)
- **create-table**: Create new tables with column definitions and constraints
- **drop-table**: Remove tables from the database
- **describe-table**: Get detailed table structure information
- **list-tables**: List all tables in the database
- **insert-record**: Insert new records with data validation
- **update-record**: Update existing records with WHERE conditions
- **delete-record**: Delete records with WHERE conditions
- **transaction**: Execute multiple SQL statements atomically

### 💬 **Prompts**

- **analyze-schema**: Generate comprehensive database schema analysis
- **generate-query**: Help create SQL queries based on natural language requirements
- **optimize-query**: Get optimization suggestions for existing SQL queries

## Installation

### Option 1: Install from npm (Recommended)

Install globally:

```bash
npm install -g mcp-server-sqlite
```

Or use with npx (no installation required):

```bash
npx mcp-server-sqlite --help
```

### Option 2: Local Development with npm link

For local development and testing:

1. Clone this repository:

```bash
git clone https://github.com/madnh/mcp-server-sqlite.git
cd mcp-server-sqlite
```

2. Install dependencies and build:

```bash
npm install
npm run build
```

3. Link globally for development:

```bash
npm link
```

4. Now you can use the command globally:

```bash
mcp-server-sqlite --db ./database.db
mcp-server-sqlite --help
```

5. To unlink when done developing:

```bash
npm unlink -g mcp-server-sqlite
```

### Option 3: From Source (Development Mode)

1. Follow steps 1-2 from Option 2
2. Run directly with:

```bash
npm run dev                    # Development mode
npm run build && npm start     # Production mode
```

## Usage

### Basic Usage

#### Via npm/npx (Recommended)

```bash
# Basic usage (creates database.db if not exists)
npx mcp-server-sqlite

# Specify database path
npx mcp-server-sqlite --db ./my-database.db

# Using long form
npx mcp-server-sqlite --database /path/to/production.db

# Get help
npx mcp-server-sqlite --help

# Check version
npx mcp-server-sqlite --version
```

#### Via environment variable

```bash
export SQLITE_DB_PATH=./my-database.db
npx mcp-server-sqlite
```

#### Development mode (from source)

```bash
npm run dev
```

#### Production mode (from source)

```bash
npm run build
npm start
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure your database path:

```
SQLITE_DB_PATH=./your-database.db
```

### Example Database Setup

Create a sample database with test data:

```bash
node examples/setup-database.js
```

This creates `example.db` with sample tables and data for testing.

### With Claude Desktop

#### Option 1: Using npx (Recommended)

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["mcp-server-sqlite", "--db", "/path/to/your/database.db"]
    }
  }
}
```

#### Option 2: Using global installation

If you installed globally with `npm install -g mcp-server-sqlite`:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "mcp-server-sqlite",
      "args": ["--database", "/path/to/your/database.db"]
    }
  }
}
```

#### Option 3: Using environment variables

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["mcp-server-sqlite"],
      "env": {
        "SQLITE_DB_PATH": "/path/to/your/database.db"
      }
    }
  }
}
```

#### Option 4: From source (development)

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "node",
      "args": ["/path/to/mcp-server-sqlite/dist/cli.js"],
      "env": {
        "SQLITE_DB_PATH": "/path/to/your/database.db"
      }
    }
  }
}
```

## API Reference

### Resources

#### `schema://database`

Returns the complete database schema including all tables and their SQL definitions.

#### `tables://list`

Returns a JSON list of all table names in the database.

#### `table-info://{tableName}`

Returns detailed information about a specific table including:

- Column definitions
- Indexes
- Foreign key constraints

### Tools

#### `query`

Execute read-only SQL queries.

```typescript
{
  sql: string; // SELECT query to execute
}
```

#### `execute`

Execute write operations.

```typescript
{
  sql: string; // INSERT, UPDATE, DELETE, CREATE, or DROP statement
}
```

#### `create-table`

Create a new table with structured column definitions.

```typescript
{
  name: string,
  columns: Array<{
    name: string,
    type: string, // TEXT, INTEGER, REAL, BLOB
    primaryKey?: boolean,
    notNull?: boolean,
    unique?: boolean,
    defaultValue?: string
  }>,
  ifNotExists?: boolean
}
```

#### `insert-record`

Insert a new record into a table.

```typescript
{
  table: string,
  data: Record<string, any> // Column-value pairs
}
```

#### `update-record`

Update existing records.

```typescript
{
  table: string,
  data: Record<string, any>, // Column-value pairs to update
  where: string // WHERE clause
}
```

#### `delete-record`

Delete records from a table.

```typescript
{
  table: string,
  where: string // WHERE clause
}
```

#### `transaction`

Execute multiple statements atomically.

```typescript
{
  statements: string[] // Array of SQL statements
}
```

### Prompts

#### `analyze-schema`

Generate comprehensive database analysis.

```typescript
{
  includeData?: boolean // Include sample data in analysis
}
```

#### `generate-query`

Generate SQL queries from natural language requirements.

```typescript
{
  requirement: string, // What you want to query
  tables?: string[] // Specific tables to focus on
}
```

#### `optimize-query`

Get query optimization suggestions.

```typescript
{
  query: string, // SQL query to optimize
  executionContext?: string // Additional context
}
```

## Database Features

### Safety & Security

- **SQL Injection Protection**: Uses parameterized queries
- **Query Validation**: Validates SQL statements before execution
- **Read/Write Separation**: Separate tools for read-only vs write operations
- **Transaction Support**: Atomic execution of multiple statements

### Performance Optimizations

- **Connection Pooling**: Efficient database connection management
- **WAL Mode**: Write-Ahead Logging for better performance
- **Prepared Statements**: Cached and optimized query execution
- **Memory Optimization**: Configured for optimal memory usage

### Supported SQLite Features

- All standard SQL data types (TEXT, INTEGER, REAL, BLOB)
- Primary keys, foreign keys, unique constraints
- Indexes and query optimization
- Views and complex queries
- Transactions and ACID compliance
- PRAGMA statements for configuration

## Examples

### Query Data

```sql
SELECT u.username, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username
ORDER BY total_spent DESC;
```

### Create Table

```typescript
{
  "name": "customers",
  "columns": [
    {"name": "id", "type": "INTEGER", "primaryKey": true},
    {"name": "name", "type": "TEXT", "notNull": true},
    {"name": "email", "type": "TEXT", "unique": true},
    {"name": "created_at", "type": "DATETIME", "defaultValue": "CURRENT_TIMESTAMP"}
  ]
}
```

### Insert Record

```typescript
{
  "table": "customers",
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Transaction

```typescript
{
  "statements": [
    "BEGIN TRANSACTION",
    "INSERT INTO orders (user_id, total_amount) VALUES (1, 99.99)",
    "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (last_insert_rowid(), 1, 2, 49.99)",
    "UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = 1",
    "COMMIT"
  ]
}
```

## Development

### Local Development with npm link

The recommended way to develop and test locally:

```bash
# Setup for development
npm install
npm run build
npm link

# Now test your changes globally
mcp-server-sqlite --db ./example.db

# After making changes, rebuild and test
npm run build
mcp-server-sqlite --version

# Clean up when done
npm unlink -g mcp-server-sqlite
```

### Scripts

- `npm run build`: Build TypeScript to JavaScript
- `npm run dev`: Run in development mode with auto-reload
- `npm start`: Run the compiled server
- `npm run stdio`: Run server with stdio transport
- `npm link`: Link package globally for development testing
- `npm pack --dry-run`: Preview what will be published

### Project Structure

```
mcp-server-sqlite/
├── src/
│   └── index.ts          # Main server implementation
├── examples/
│   ├── sample-data.sql   # Sample database schema and data
│   └── setup-database.js # Database setup script
├── dist/                 # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

## Error Handling

The server provides comprehensive error handling:

- **SQL Syntax Errors**: Clear error messages for malformed queries
- **Constraint Violations**: Detailed information about constraint failures
- **Connection Issues**: Graceful handling of database connection problems
- **Permission Errors**: Safe handling of unauthorized operations

## Limitations

- **File System Access**: Server can only access databases in allowed paths
- **Resource Limits**: Large result sets may be truncated for performance
- **Concurrent Access**: Uses SQLite's built-in locking mechanisms
- **Schema Changes**: Some DDL operations may require server restart

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Check the examples/ directory for usage patterns
- Review the SQLite documentation for SQL syntax
- Open an issue on the project repository
