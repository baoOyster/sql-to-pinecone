import SQLiteConnection from "./connection/sqlite";
import PostgresConnection from "./connection/postgres";
import MySQLConnection from "./connection/mysql";
import SQLServerConnection from "./connection/sqlserver";
import { processSchemaRows } from "../utils/helper";

export interface AdapterConfig {
    _connectionType: "sqlite" | "postgres" | "mysql" | "mssql";
}

interface TableSchema {
  primaryKey: string | null;
  textColumns: string[];
}

interface DatabaseSchema {
  [tableName: string]: TableSchema;
}

class Adapter {
    private connectionString: string = process.env.DB_CONNECTION_STRING || "";
    private filename: string = process.env.SQLITE_DB_FILE || ":memory:";
    private connection: any;
    private connectionType: "sqlite" | "postgres" | "mysql" | "mssql";

    constructor(config: AdapterConfig) {
        this.connectionType = config._connectionType;
        this.onInit();
    }

    private onInit() {
        switch (this.connectionType) {
            case "postgres":
                this.connection = new PostgresConnection({ connectionString: this.connectionString });
                break;
            case "mysql":
                this.connection = new MySQLConnection({ connectionString: this.connectionString });
                break;
            case "mssql":
                this.connection = new SQLServerConnection({ connectionString: this.connectionString });
                break;
            case "sqlite":
                this.connection = new SQLiteConnection({ filename: this.filename });
                break;

            default:
                break;
        }
    }

    public async getProcessSchemaRows(): Promise<any> {
        let query: string = "";
        switch (this.connectionType) {
            case "postgres":
                query = `
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
                break;

            // ---- MySQL / MariaDB ----
            case "mysql":
                query = `
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
                break;

            // ---- SQL Server ----
            case "mssql":
                query = `
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
                break;

            // ---- SQLite ----
            case "sqlite":
                const schema: DatabaseSchema = {};

                // 1. Get all user tables
                const tablesResult = await this.connection.raw(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
                );
                const tables = tablesResult.map((t: { name: string }) => t.name);

                // 2. Loop through each table and get its info
                for (const tableName of tables) {
                    const tableInfo: { name: string; type: string; pk: number }[] =
                    await this.connection.raw(`PRAGMA table_info(${tableName});`);

                    const tableSchema: TableSchema = {
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
                        if (
                            colType.includes("CHAR") ||
                            colType.includes("TEXT") ||
                            colType.includes("JSON")
                        ) {
                            tableSchema.textColumns.push(column.name);
                        }
                    }
                        schema[tableName] = tableSchema;
      
                }
                return schema;
            
            default:
                throw new Error("Unsupported connection type for schema retrieval.");
        }

        if (!query) {
            throw new Error("query is empty");
            
        }
        const [rows] = await this.connection.raw(query);

        return processSchemaRows(rows);
    }
}
