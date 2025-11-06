import knex, { Knex } from 'knex';

interface PostgreSQLConnectionConfig {
    connectionString: string;
}

interface PostgreSQLConn {
    getDB(): any;
    setDB(db: Knex): void;
}

class PostgreSQLConnection implements PostgreSQLConn {
    private db: Knex;

    constructor(config: PostgreSQLConnectionConfig) {
        this.db = knex({
            client: 'pg',
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

export default PostgreSQLConnection;