
interface TableSchema {
  primaryKey: string | null;
  textColumns: string[];
}

interface DatabaseSchema {
  [tableName: string]: TableSchema;
}

export const processSchemaRows = (rows: any[]): DatabaseSchema => {
  const schema: DatabaseSchema = {};

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