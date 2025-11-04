# SQL to Pinecone Vector

Module TypeScript để tự động chuyển đổi nội dung cơ sở dữ liệu SQL thành vector database Pinecone với embeddings được tạo bởi AI.

## Tổng quan

Module này tự động khám phá schema của cơ sở dữ liệu SQL, trích xuất nội dung văn bản từ các bảng, tạo vector embeddings sử dụng Pinecone inference API, và lưu trữ chúng trong Pinecone để phục vụ cho tìm kiếm ngữ nghĩa và các ứng dụng AI.

**Tính năng chính:**

- 🔍 **Tự động khám phá Schema** - Tự động phát hiện primary keys và các cột text
- 🗄️ **Hỗ trợ đa Database** - Hoạt động với PostgreSQL, MySQL, SQL Server, và SQLite
- 🚀 **Xử lý theo Batch** - Xử lý hiệu quả các tập dữ liệu lớn với streaming và batching
- 🤖 **AI Embeddings** - Sử dụng model `llama-text-embed-v2` của Pinecone để tạo vector
- 📦 **Tổ chức Namespace** - Mỗi bảng trở thành một namespace riêng biệt trong Pinecone

## Cơ sở dữ liệu được hỗ trợ

- PostgreSQL (`pg`)
- MySQL/MariaDB (`mysql2`)
- Microsoft SQL Server (`mssql`)
- SQLite (`sqlite3`)

## Cài đặt

```bash
npm install git+https://github.com/baoOyster/sql-to-pinecone.git
```

### Dependencies

Các dependencies sau sẽ được cài đặt tự động:

- `@pinecone-database/pinecone` - Pinecone client
- `knex` - SQL query builder
- `mssql`, `mysql2`, `pg`, `sqlite3` - Database drivers

## Cách sử dụng

### Ví dụ cơ bản

```typescript
import sqlToPinecone from "sql-to-pinecone-vector";

await sqlToPinecone(
  "pg", // Loại database
  "postgresql://user:password@host:5432/database", // Connection string
  "your-pinecone-api-key", // Pinecone API key
  "your-index-name", // Tên Pinecone index
  "text" // Tên trường metadata cho text được nhúng
);
```

### Ví dụ PostgreSQL

```typescript
import sqlToPinecone from "sql-to-pinecone-vector";

await sqlToPinecone(
  "pg",
  "postgresql://postgres:password@localhost:5432/mydb",
  "pcsk_xxx...your-api-key",
  "sql-to-pinecone",
  "text"
);
```

### Ví dụ MySQL

```typescript
await sqlToPinecone(
  "mysql2",
  "mysql://root:password@localhost:3306/mydb",
  "pcsk_xxx...your-api-key",
  "sql-to-pinecone",
  "text"
);
```

### Ví dụ SQL Server

```typescript
await sqlToPinecone(
  "mssql",
  "Server=localhost,1433;Database=mydb;User Id=sa;Password=yourPassword;",
  "pcsk_xxx...your-api-key",
  "sql-to-pinecone",
  "text"
);
```

### Ví dụ SQLite

```typescript
await sqlToPinecone(
  "sqlite3",
  "./path/to/database.db",
  "pcsk_xxx...your-api-key",
  "sql-to-pinecone",
  "text"
);
```

## Tham số

| Tham số               | Kiểu dữ liệu                               | Mô tả                                                   |
| --------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `sqlDatabaseType`     | `'mysql2' \| 'pg' \| 'sqlite3' \| 'mssql'` | Loại cơ sở dữ liệu SQL bạn đang kết nối                 |
| `sqlConnectionString` | `string`                                   | Chuỗi kết nối/URL database                              |
| `pineconeApiKey`      | `string`                                   | API key Pinecone của bạn                                |
| `pineconeIndexName`   | `string`                                   | Tên của Pinecone index để lưu trữ vectors               |
| `embeddingTextField`  | `string`                                   | Tên trường metadata nơi text được nhúng sẽ được lưu trữ |

## Cách hoạt động

1. **Khám phá Schema**: Module tự động phân tích cơ sở dữ liệu của bạn để tìm:

   - Primary keys cho mỗi bảng
   - Các cột text (VARCHAR, TEXT, CHAR, JSON, etc.)

2. **Streaming Dữ liệu**: Các hàng được stream từ mỗi bảng để xử lý hiệu quả các tập dữ liệu lớn

3. **Trích xuất Text**: Text từ tất cả các cột text trong mỗi hàng được nối lại với nhau

4. **Batch Embedding**: Texts được xử lý theo batch (100 bản ghi mỗi lần) và gửi đến embedding model của Pinecone

5. **Lưu trữ Vector**: Embedded vectors được upsert vào Pinecone với:
   - **ID**: Giá trị primary key
   - **Vector**: Embedding được tạo
   - **Metadata**: Tất cả dữ liệu hàng gốc cộng với trường text được nhúng
   - **Namespace**: Tên bảng

## Các kiểu dữ liệu Text được hỗ trợ

Module tự động phát hiện các kiểu cột văn bản sau:

**Chung:**

- `text`, `varchar`, `char`, `json`

**PostgreSQL:**

- `character varying`, `jsonb`

**MySQL:**

- `tinytext`, `mediumtext`, `longtext`

**SQL Server:**

- `nvarchar`, `nchar`, `ntext`

## Yêu cầu

### Thiết lập Pinecone

1. Tạo tài khoản Pinecone tại [pinecone.io](https://www.pinecone.io/)
2. Tạo một index với các thiết lập sau:
   - **Dimensions**: 1024 (cho model `llama-text-embed-v2`)
   - **Metric**: cosine (khuyến nghị)
3. Lấy API key của bạn từ Pinecone console

### Thiết lập Database

- Đảm bảo database của bạn có thể truy cập được từ ứng dụng
- Các bảng nên có primary keys được định nghĩa
- Ít nhất một cột text phải tồn tại trong các bảng bạn muốn vector hóa

## Dành cho người bảo trì(Maintainer)

### Chạy trong môi trường Development

```bash
npm run dev
```

### Build cho Production

```bash
npm run build
npm start
```

## Ví dụ Output

```
Discovering database schema...
Discovered schema: {
  "users": {
    "primaryKey": "id",
    "textColumns": ["name", "email", "bio"]
  },
  "posts": {
    "primaryKey": "post_id",
    "textColumns": ["title", "content"]
  }
}
Starting data migration...
Processing table 'users' into namespace 'users'...
Embedding and upserting batch of 100 to namespace 'users'
Embedding and upserting final batch of 45 to namespace 'users'
✅ Finished processing table 'users'.
Processing table 'posts' into namespace 'posts'...
Embedding and upserting batch of 100 to namespace 'posts'
✅ Finished processing table 'posts'.
Database connection closed.
```

## Giới hạn & Lưu ý

- Các bảng không có primary keys sẽ tự động bị bỏ qua
- Các bảng không có cột text sẽ tự động bị bỏ qua
- Các bảng hệ thống và extensions (như `pg_stat_statements`, `spatial_ref_sys`) được lọc ra
- Kích thước batch cố định là 100 bản ghi mỗi embedding request
- Sử dụng model `llama-text-embed-v2` của Pinecone (1024 dimensions)
- Text sẽ bị cắt từ cuối nếu vượt quá giới hạn của model

## Xử lý Lỗi

Module bao gồm xử lý lỗi toàn diện:

- Lỗi kết nối database được bắt và ghi log
- Các batch thất bại không làm dừng toàn bộ quá trình
- Kết nối database được đóng đúng cách trong block `finally`

## Các trường hợp sử dụng

- **Tìm kiếm Ngữ nghĩa**: Cho phép tìm kiếm ngôn ngữ tự nhiên trên dữ liệu SQL của bạn
- **Ứng dụng AI**: Cung cấp nội dung database cho các hệ thống RAG (Retrieval-Augmented Generation)
- **Di chuyển Dữ liệu**: Chuyển dữ liệu SQL legacy sang vector databases hiện đại
- **Hệ thống Gợi ý**: Tạo gợi ý dựa trên độ tương đồng văn bản
- **Khám phá Nội dung**: Tìm các bản ghi liên quan giữa các bảng sử dụng tìm kiếm ngữ nghĩa

## Khắc phục sự cố

### Lỗi Kết nối

Đảm bảo định dạng connection string của bạn khớp với loại database:

- **PostgreSQL**: `postgresql://user:password@host:port/database`
- **MySQL**: `mysql://user:password@host:port/database`
- **SQL Server**: `Server=host,port;Database=db;User Id=user;Password=pass;`
- **SQLite**: `/path/to/file.db`

### Không khớp Dimension của Index

Đảm bảo Pinecone index của bạn có 1024 dimensions cho model `llama-text-embed-v2`.

### Thiếu Cột Text

Nếu các bảng bị bỏ qua, hãy xác minh chúng có chứa các cột kiểu text (VARCHAR, TEXT, etc.).

## Tác giả

Nghiêm Gia Bảo

## License

ISC

## Đóng góp

Module này được thiết kế cho sử dụng nội bộ công ty. Để báo cáo lỗi hoặc yêu cầu tính năng, vui lòng liên hệ với đội ngũ phát triển.
