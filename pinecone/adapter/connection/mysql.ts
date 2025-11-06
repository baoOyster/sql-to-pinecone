/**
 * This can be used to create both MySQL and MariaDB connection adapter.
 */

import knex, { Knex } from "knex";

interface MySQLConnectionConfig {
    connectionString: string;
}

interface MySQLConn {
    getDB(): any;
    setDB(db: Knex): void;
}

class MySQLConnection implements MySQLConn {
    private db: Knex;

    constructor(config: MySQLConnectionConfig) {
        this.db = knex({
            client: "mysql2",
            connection: config.connectionString
        });
    }

    public getDB(): any {
        return this.db;
    }

    public setDB(db: Knex): void {
        this.db = db;
    }
}

export default MySQLConnection;