import knex, { Knex } from 'knex';

interface MySQLServerConnectionConfig {
    connectionString: string;
}

interface SQLServerConn {
    getDB(): any;
    setDB(db: Knex): void;
}

class SQLServerConnection implements SQLServerConn {
    private db: Knex;

    constructor(config: MySQLServerConnectionConfig) {
        this.db = knex({
            client: 'mssql',
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

export default SQLServerConnection;