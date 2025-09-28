# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-09-28

### Added

- Initial release of SQLite MCP Server
- Comprehensive MCP server implementation for SQLite database operations
- **Resources**: 3 types (schema, tables list, table info)
- **Tools**: 10 database operation tools (query, execute, CRUD operations, transactions)
- **Prompts**: 3 AI-assisted prompts (schema analysis, query generation, optimization)
- CLI interface with command-line arguments support
- TypeScript implementation with full type safety
- Better-sqlite3 integration for high performance
- SQL injection protection via parameterized queries
- Transaction support for atomic operations
- Comprehensive error handling and validation
- WAL mode for optimal database performance
- Sample database with realistic e-commerce data
- Complete documentation and examples
- npm package ready for global installation
- Claude Desktop integration examples

### Features

- **Database Resources**

  - Complete schema viewing
  - Table listing and detailed information
  - Dynamic table info with foreign keys and indexes

- **Database Tools**

  - Safe read-only queries
  - Write operations with validation
  - Table creation and management
  - Record CRUD operations
  - Multi-statement transactions

- **AI Prompts**

  - Schema analysis and recommendations
  - Natural language to SQL query generation
  - Query optimization suggestions

- **CLI Interface**
  - Command-line arguments (`--db`, `--help`, `--version`)
  - Environment variable support
  - Multiple installation methods

### Technical

- Built with TypeScript and Zod for type safety
- Uses better-sqlite3 for optimal performance
- Implements MCP protocol v2024-11-05
- Supports both stdio and HTTP transports
- Includes comprehensive test data and examples
