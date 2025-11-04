"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pinecone_1 = require("@pinecone-database/pinecone");
const knex_1 = __importDefault(require("knex"));
// ---- SCHEMA DISCOVERY ----
/**
 * Helper function to process flat schema rows from PG, MySQL, and MSSQL.
 * @param rows The flat list of columns from information_schema
 * @returns A structured DatabaseSchema object
 */
const processSchemaRows = (rows) => {
    const schema = {};
    // Define a comprehensive list of text-like data types
    const textTypes = [
        // General
        "text",
        "varchar",
        "char",
        "json",
        // PostgreSQL
        "character varying",
        "jsonb",
        // MySQL
        "tinytext",
        "mediumtext",
        "longtext",
        // SQL Server
        "nvarchar",
        "nchar",
        "ntext",
    ];
    for (const row of rows) {
        const { table_name, column_name, data_type, is_primary_key } = row;
        // Initialize the table in our schema object if it's not already there
        if (!schema[table_name]) {
            schema[table_name] = { primaryKey: null, textColumns: [] };
        }
        // Assign the primary key. We only take the first one found.
        if (is_primary_key === "YES" && !schema[table_name].primaryKey) {
            schema[table_name].primaryKey = column_name;
        }
        // Add to text columns if the data type matches
        if (textTypes.includes(data_type)) {
            schema[table_name].textColumns.push(column_name);
        }
    }
    return schema;
};
/**
 * Dynamically discovers the schema (PK and text columns) for all tables.
 * @param db The Knex database instance
 * @returns A promise that resolves to the DatabaseSchema object
 */
async function getDatabaseSchema(db) {
    switch (db.client.config.client) {
        // ---- PostgreSQL ----
        case "pg": {
            const query = `
        SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            CASE
                WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'YES'
                ELSE 'NO'
            END AS is_primary_key
        FROM
            information_schema.columns c
        LEFT JOIN
            information_schema.key_column_usage kcu ON c.table_name = kcu.table_name
            AND c.column_name = kcu.column_name
            AND c.table_schema = kcu.table_schema
        LEFT JOIN
            information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_name = tc.table_name
            AND kcu.table_schema = tc.table_schema
            AND tc.constraint_type = 'PRIMARY KEY'
        WHERE
            c.table_schema = 'public'
            AND c.table_name NOT IN ('pg_stat_statements', 'spatial_ref_sys'); -- Filter out common extensions
      `;
            const result = await db.raw(query);
            return processSchemaRows(result.rows);
        }
        // ---- MySQL / MariaDB ----
        case "mysql2": {
            const query = `
        SELECT
            table_name,
            column_name,
            data_type,
            CASE
                WHEN column_key = 'PRI' THEN 'YES'
                ELSE 'NO'
            END AS is_primary_key
        FROM
            information_schema.columns
        WHERE
            table_schema = DATABASE();
      `;
            const [rows] = await db.raw(query);
            return processSchemaRows(rows);
        }
        // ---- SQL Server ----
        case "mssql": {
            const query = `
        SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            CASE
                WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'YES'
                ELSE 'NO'
            END AS is_primary_key
        FROM
            information_schema.columns c
        LEFT JOIN
            information_schema.key_column_usage kcu ON c.table_name = kcu.table_name
            AND c.column_name = kcu.column_name
        LEFT JOIN
            information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_name = tc.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
        WHERE
            c.table_catalog = DB_NAME();
      `;
            const result = await db.raw(query);
            return processSchemaRows(result.recordset);
        }
        // ---- SQLite ----
        case "sqlite3": {
            const schema = {};
            // 1. Get all user tables
            const tablesResult = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
            const tables = tablesResult.map((t) => t.name);
            // 2. Loop through each table and get its info
            for (const tableName of tables) {
                const tableInfo = await db.raw(`PRAGMA table_info(${tableName});`);
                const tableSchema = {
                    primaryKey: null,
                    textColumns: [],
                };
                for (const column of tableInfo) {
                    // Find the primary key (pk > 0)
                    if (column.pk > 0 && !tableSchema.primaryKey) {
                        tableSchema.primaryKey = column.name;
                    }
                    // Find text columns
                    const colType = column.type.toUpperCase();
                    if (colType.includes("CHAR") ||
                        colType.includes("TEXT") ||
                        colType.includes("JSON")) {
                        tableSchema.textColumns.push(column.name);
                    }
                }
                schema[tableName] = tableSchema;
            }
            return schema;
        }
        default:
            throw new Error(`Unsupported database client: ${db.client.config.client}`);
    }
}
const sqlToPinecone = async (sqlDatabaseType, sqlConnectionString, pineconeApiKey, pineconeIndexName, embeddingTextField) => {
    const db = (0, knex_1.default)({
        client: sqlDatabaseType,
        connection: sqlConnectionString,
    });
    const pc = new pinecone_1.Pinecone({
        apiKey: pineconeApiKey,
    });
    const index = pc.Index(pineconeIndexName);
    const modelName = "llama-text-embed-v2";
    try {
        console.log("Discovering database schema...");
        const databaseSchema = await getDatabaseSchema(db);
        console.log("Discovered schema:", JSON.stringify(databaseSchema, null, 2));
        console.log("Starting data migration...");
        for (const tableName of Object.keys(databaseSchema)) {
            const tableSchema = databaseSchema[tableName];
            if (!tableSchema.primaryKey) {
                console.warn(`Skipping table '${tableName}': No primary key found.`);
                continue;
            }
            if (tableSchema.textColumns.length === 0) {
                console.warn(`Skipping table '${tableName}': No text columns found.`);
                continue;
            }
            const namespace = index.namespace(tableName);
            console.log(`Processing table '${tableName}' into namespace '${tableName}'...`);
            const stream = db(tableName).select("*").stream();
            let batchToEmbed = [];
            const BATCH_SIZE = 100;
            for await (const row of stream) {
                const textToEmbed = tableSchema.textColumns
                    .map((col) => row[col])
                    .filter(Boolean)
                    .join(" ");
                if (!textToEmbed) {
                    continue;
                }
                const metadata = row;
                metadata[embeddingTextField] = textToEmbed;
                batchToEmbed.push({
                    id: String(row[tableSchema.primaryKey]),
                    text: textToEmbed,
                    metadata: metadata,
                });
                if (batchToEmbed.length >= BATCH_SIZE) {
                    console.log(`Embedding and upserting batch of ${batchToEmbed.length} to namespace '${tableName}'`);
                    const texts = batchToEmbed.map((r) => r.text);
                    const embeddings = await pc.inference.embed(modelName, texts, {
                        inputType: "passage",
                        truncate: "END",
                    });
                    const upsertBatch = batchToEmbed.map((record, i) => ({
                        id: record.id,
                        values: embeddings.data[i].values,
                        metadata: record.metadata,
                    }));
                    await namespace.upsert(upsertBatch);
                    batchToEmbed = [];
                }
            }
            if (batchToEmbed.length > 0) {
                console.log(`Embedding and upserting final batch of ${batchToEmbed.length} to namespace '${tableName}'`);
                const texts = batchToEmbed.map((r) => r.text);
                const embeddings = await pc.inference.embed(modelName, texts, {
                    inputType: "passage",
                    truncate: "END",
                });
                const upsertBatch = batchToEmbed.map((record, i) => ({
                    id: record.id,
                    values: embeddings.data[i].values,
                    metadata: record.metadata,
                }));
                await namespace.upsert(upsertBatch);
            }
            console.log(`✅ Finished processing table '${tableName}'.`);
        }
    }
    catch (error) {
        console.error("Error during processing:", error);
    }
    finally {
        await db.destroy();
        console.log("Database connection closed.");
    }
};
exports.default = sqlToPinecone;
