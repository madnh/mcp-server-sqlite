#!/usr/bin/env node

/**
 * Setup script to create sample database with test data
 * Run with: node examples/setup-database.js
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function setupDatabase() {
    console.log('Setting up sample SQLite database...');

    // Create database
    const db = new Database('./example.db', { verbose: console.log });

    try {
        // Read and execute SQL file
        const sqlFile = join(__dirname, 'sample-data.sql');
        const sql = readFileSync(sqlFile, 'utf8');

        // Split by semicolons and execute each statement
        const statements = sql.split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        db.transaction(() => {
            for (const statement of statements) {
                if (statement.trim()) {
                    db.exec(statement);
                }
            }
        })();

        console.log('✅ Sample database created successfully at ./example.db');
        console.log('Database contains:');

        // Show table stats
        const tables = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();

        for (const table of tables) {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
            console.log(`  - ${table.name}: ${count.count} records`);
        }

        console.log('\nTo use this database with the MCP server:');
        console.log('  export SQLITE_DB_PATH=./example.db');
        console.log('  npm run dev');

    } catch (error) {
        console.error('❌ Error setting up database:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    setupDatabase();
}