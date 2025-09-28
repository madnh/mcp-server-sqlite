#!/usr/bin/env node

/**
 * CLI wrapper for the SQLite MCP Server
 * This script handles command line arguments and environment setup
 */

import { main } from './index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get CLI arguments
const args = process.argv.slice(2);

// Help text
const HELP_TEXT = `
SQLite MCP Server

USAGE:
  mcp-server-sqlite [OPTIONS]

OPTIONS:
  --db, --database <path>    Path to SQLite database file
  --help, -h                 Show this help message
  --version, -v              Show version information

ENVIRONMENT VARIABLES:
  SQLITE_DB_PATH             Path to SQLite database file (default: ./database.db)

EXAMPLES:
  mcp-server-sqlite --db ./my-database.db
  mcp-server-sqlite --database /path/to/production.db

  # Using environment variable
  export SQLITE_DB_PATH=/path/to/database.db
  mcp-server-sqlite

Claude Desktop Configuration:
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["mcp-server-sqlite", "--db", "/path/to/your/database.db"]
    }
  }
}
`;

// Parse command line arguments
function parseArgs() {
  const config = {
    showHelp: false,
    showVersion: false,
    dbPath: process.env.SQLITE_DB_PATH || './database.db'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        config.showHelp = true;
        break;

      case '--version':
      case '-v':
        config.showVersion = true;
        break;

      case '--db':
      case '--database':
        if (i + 1 < args.length) {
          config.dbPath = args[i + 1];
          i++; // Skip next argument
        } else {
          console.error('Error: --db requires a database path argument');
          process.exit(1);
        }
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option '${arg}'`);
          console.error('Use --help to see available options');
          process.exit(1);
        } else {
          // Treat as database path if no flag specified
          config.dbPath = arg;
        }
        break;
    }
  }

  return config;
}

// Get package version
async function getVersion() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.join(__dirname, '..', 'package.json');
    const fs = await import('fs');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return 'unknown';
  }
}

// Main CLI function
async function cli() {
  const config = parseArgs();

  if (config.showHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (config.showVersion) {
    const version = await getVersion();
    console.log(`SQLite MCP Server v${version}`);
    process.exit(0);
  }

  // Set the database path environment variable
  process.env.SQLITE_DB_PATH = config.dbPath;

  try {
    // Start the MCP server
    await main();
  } catch (error) {
    console.error('Error starting SQLite MCP Server:', error);
    process.exit(1);
  }
}

// Only run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((error) => {
    console.error('CLI error:', error);
    process.exit(1);
  });
}
