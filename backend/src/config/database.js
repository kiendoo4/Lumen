import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'research_user',
  password: process.env.DB_PASSWORD || 'research_password',
  database: process.env.DB_NAME || 'research_agent',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;


