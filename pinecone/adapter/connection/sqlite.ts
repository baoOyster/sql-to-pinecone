import knex, { Knex } from 'knex';

interface SQLiteConnectionConfig {
    filename: string;
}

interface SQLiteConn {
    getDB(): any;
    setDB(db: Knex): void;
}

class SQLiteConnection implements SQLiteConn {
    private db: Knex;

    constructor(config: SQLiteConnectionConfig) {
        this.db = knex({
            client: 'sqlite3',
            connection: {
                filename: config.filename
            },
            useNullAsDefault: true
        });
    }

    public getDB(): any {
        return this.db;
    }

    public setDB(db: Knex): void {
        this.db = db;
    }
}
export default SQLiteConnection;