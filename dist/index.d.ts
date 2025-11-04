declare const sqlToPinecone: (sqlDatabaseType: "mysql2" | "pg" | "sqlite3" | "mssql", sqlConnectionString: string, pineconeApiKey: string, pineconeIndexName: string, embeddingTextField: string) => Promise<void>;
export default sqlToPinecone;
