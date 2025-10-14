import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

(async () => {
  const db = await open({ filename: './my_database.db', driver: sqlite3.Database });

  await db.exec(`
    PRAGMA foreign_keys = ON;
     CREATE TABLE IF NOT EXISTS traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,     
    status TEXT,                
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    tags TEXT,                
    metadata TEXT                  
    );
  `);

  console.log('DB initialized ✅');
  await db.close();
})();