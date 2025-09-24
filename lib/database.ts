import 'server-only';

// @ts-expect-error - better-sqlite3 types will be available after proper installation
import Database from 'better-sqlite3';
import { join } from 'path';
import bcrypt from 'bcryptjs';

// Database file path
const dbPath = join(process.cwd(), 'database.sqlite');

// Initialize database connection
let db: Database.Database;

export function getDatabase() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDatabase();
  }
  return db;
}

// Database version for migrations
const DATABASE_VERSION = 3;

// Initialize database tables
function initializeDatabase() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )
  `;

  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `;

  const createPaymentChannelsTable = `
    CREATE TABLE IF NOT EXISTS payment_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      status INTEGER DEFAULT 1,
      seller_signature TEXT,
      refund_tx_data TEXT,
      funding_tx_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `;

  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_payment_channels_user_id ON payment_channels (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_channels_channel_id ON payment_channels (channel_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_channels_status ON payment_channels (status)'
  ];

  try {
    db.exec(createUsersTable);
    db.exec(createSessionsTable);
    db.exec(createPaymentChannelsTable);
    createIndexes.forEach(index => db.exec(index));
    
    // Run migrations
    runMigrations();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Database migrations
function runMigrations() {
  // Create database_info table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS database_info (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Get current database version
  const versionStmt = db.prepare('SELECT value FROM database_info WHERE key = ?');
  const versionRow = versionStmt.get('version') as { value: string } | undefined;
  const currentVersion = versionRow ? parseInt(versionRow.value) : 1;

  console.log(`Current database version: ${currentVersion}, target version: ${DATABASE_VERSION}`);

  // Run migrations sequentially
  if (currentVersion < 2) {
    migrateToVersion2();
  }
  if (currentVersion < 3) {
    migrateToVersion3();
  }

  // Update database version
  const updateVersionStmt = db.prepare('INSERT OR REPLACE INTO database_info (key, value) VALUES (?, ?)');
  updateVersionStmt.run('version', DATABASE_VERSION.toString());
}

// Migration to version 2: Replace is_active with status in payment_channels
function migrateToVersion2() {
  console.log('Running migration to version 2: adding status column to payment_channels');
  
  try {
    // Check if status column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasStatusColumn = columns.some(col => col.name === 'status');
    
    if (!hasStatusColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add status column
      db.exec('ALTER TABLE payment_channels ADD COLUMN status INTEGER DEFAULT 1');
      
      // Update existing records: convert is_active to status
      // is_active = 1 -> status = 1 (INACTIVE)
      // is_active = 0 -> status = 3 (INVALID)
      db.exec('UPDATE payment_channels SET status = CASE WHEN is_active = 1 THEN 1 ELSE 3 END');
      
      // Create new index for status
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_status ON payment_channels (status)');
      
      // Drop old index for is_active if it exists
      try {
        db.exec('DROP INDEX IF EXISTS idx_payment_channels_is_active');
      } catch (e) {
        // Index might not exist, ignore error
      }
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added status column and migrated data');
    } else {
      console.log('Status column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 2:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 3: Add funding_tx_data column to payment_channels
function migrateToVersion3() {
  console.log('Running migration to version 3: adding funding_tx_data column to payment_channels');
  
  try {
    // Check if funding_tx_data column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasFundingTxColumn = columns.some(col => col.name === 'funding_tx_data');
    
    if (!hasFundingTxColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add funding_tx_data column
      db.exec('ALTER TABLE payment_channels ADD COLUMN funding_tx_data TEXT');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added funding_tx_data column');
    } else {
      console.log('Funding_tx_data column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 3:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// User interface
export interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Session interface
export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

// User creation interface
export interface CreateUserData {
  email: string;
  username: string;
  password: string;
}

// User database operations
export class UserRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const { email, username, password } = userData;
    
    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const stmt = this.db.prepare(`
      INSERT INTO users (email, username, password_hash)
      VALUES (?, ?, ?)
    `);

    try {
      const result = stmt.run(email, username, password_hash);
      return this.getUserById(result.lastInsertRowid as number)!;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email or username already exists');
      }
      throw error;
    }
  }

  getUserById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  getUserByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  getUserByUsername(username: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | null;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  updateLastLogin(userId: number): void {
    const stmt = this.db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(userId);
  }
}

// Session database operations
export class SessionRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createSession(userId: number, sessionId: string, expiresAt: Date): Session {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, userId, expiresAt.toISOString());
    return this.getSession(sessionId)!;
  }

  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(sessionId) as Session | null;
  }

  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  deleteExpiredSessions(): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
    stmt.run(new Date().toISOString());
  }

  deleteUserSessions(userId: number): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    stmt.run(userId);
  }
}

// Payment Channel status constants
export const PAYMENT_CHANNEL_STATUS = {
  INACTIVE: 1,    // 未激活
  ACTIVE: 2,      // 已激活  
  INVALID: 3,     // 已作废
} as const;

export type PaymentChannelStatus = typeof PAYMENT_CHANNEL_STATUS[keyof typeof PAYMENT_CHANNEL_STATUS];

// Payment Channel interface
export interface PaymentChannel {
  id: number;
  user_id: number;
  channel_id: string;
  amount: number;
  duration_days: number;
  status: PaymentChannelStatus;
  seller_signature: string | null;
  refund_tx_data: string | null;
  funding_tx_data: string | null;
  created_at: string;
  updated_at: string;
}

// Payment Channel creation interface
export interface CreatePaymentChannelData {
  user_id: number;
  channel_id: string;
  amount: number;
  duration_days: number;
  status?: PaymentChannelStatus;
  seller_signature?: string;
  refund_tx_data?: string;
  funding_tx_data?: string;
}

// Payment Channel database operations
export class PaymentChannelRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createPaymentChannel(channelData: CreatePaymentChannelData): PaymentChannel {
    const { user_id, channel_id, amount, duration_days, status, seller_signature, refund_tx_data, funding_tx_data } = channelData;
    
    const stmt = this.db.prepare(`
      INSERT INTO payment_channels (user_id, channel_id, amount, duration_days, status, seller_signature, refund_tx_data, funding_tx_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const channelStatus = status || PAYMENT_CHANNEL_STATUS.INACTIVE; // Default to inactive
      const result = stmt.run(user_id, channel_id, amount, duration_days, channelStatus, seller_signature || null, refund_tx_data || null, funding_tx_data || null);
      return this.getPaymentChannelById(result.lastInsertRowid as number)!;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Payment channel with this ID already exists');
      }
      throw error;
    }
  }

  getPaymentChannelById(id: number): PaymentChannel | null {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE id = ?');
    return stmt.get(id) as PaymentChannel | null;
  }

  getPaymentChannelByChannelId(channelId: string): PaymentChannel | null {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE channel_id = ?');
    return stmt.get(channelId) as PaymentChannel | null;
  }

  getPaymentChannelsByUserId(userId: number): PaymentChannel[] {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as PaymentChannel[];
  }

  updatePaymentChannelSignature(channelId: string, signature: string, refundTxData: string): PaymentChannel | null {
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET seller_signature = ?, refund_tx_data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    stmt.run(signature, refundTxData, channelId);
    return this.getPaymentChannelByChannelId(channelId);
  }

  updatePaymentChannelStatus(channelId: string, status: PaymentChannelStatus): PaymentChannel | null {
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    stmt.run(status, channelId);
    return this.getPaymentChannelByChannelId(channelId);
  }

  activatePaymentChannel(channelId: string): PaymentChannel | null {
    return this.updatePaymentChannelStatus(channelId, PAYMENT_CHANNEL_STATUS.ACTIVE);
  }

  invalidatePaymentChannel(channelId: string): PaymentChannel | null {
    return this.updatePaymentChannelStatus(channelId, PAYMENT_CHANNEL_STATUS.INVALID);
  }

  getPaymentChannelsByStatus(userId: number, status: PaymentChannelStatus): PaymentChannel[] {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE user_id = ? AND status = ? ORDER BY created_at DESC');
    return stmt.all(userId, status) as PaymentChannel[];
  }
}