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
const DATABASE_VERSION = 14; // Update to version 14 for verified_at column

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
  if (currentVersion < 4) {
    migrateToVersion4();
  }
  if (currentVersion < 5) {
    migrateToVersion5();
  }
  if (currentVersion < 6) {
    migrateToVersion6();
  }
  if (currentVersion < 7) {
    migrateToVersion7();
  }
  if (currentVersion < 8) {
    migrateToVersion8();
  }
  if (currentVersion < 9) {
    migrateToVersion9();
  }
  if (currentVersion < 10) {
    migrateToVersion10();
  }
  if (currentVersion < 11) {
    migrateToVersion11();
  }
  if (currentVersion < 12) {
    migrateToVersion12();
  }
  if (currentVersion < 13) {
    migrateToVersion13();
  }
  if (currentVersion < 14) {
    migrateToVersion14();
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

// Migration to version 4: Add is_default column to payment_channels
function migrateToVersion4() {
  console.log('Running migration to version 4: adding is_default column to payment_channels');
  
  try {
    // Check if is_default column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasIsDefaultColumn = columns.some(col => col.name === 'is_default');
    
    if (!hasIsDefaultColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add is_default column
      db.exec('ALTER TABLE payment_channels ADD COLUMN is_default BOOLEAN DEFAULT 0');
      
      // Create index for is_default
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_is_default ON payment_channels (is_default)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added is_default column');
    } else {
      console.log('Is_default column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 4:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 5: Add consumed_tokens column to payment_channels
function migrateToVersion5() {
  console.log('Running migration to version 5: adding consumed_tokens column to payment_channels');
  
  try {
    // Check if consumed_tokens column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasConsumedTokensColumn = columns.some(col => col.name === 'consumed_tokens');
    
    if (!hasConsumedTokensColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add consumed_tokens column
      db.exec('ALTER TABLE payment_channels ADD COLUMN consumed_tokens INTEGER DEFAULT 0');
      
      // Create index for consumed_tokens
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_consumed_tokens ON payment_channels (consumed_tokens)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added consumed_tokens column');
    } else {
      console.log('Consumed_tokens column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 5:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 6: Create chunk_payments table
function migrateToVersion6() {
  console.log('Running migration to version 6: creating chunk_payments table');
  
  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Create chunk_payments table
    const createChunkPaymentsTable = `
      CREATE TABLE IF NOT EXISTS chunk_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        channel_id TEXT,
        tokens_count INTEGER NOT NULL,
        is_paid INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        paid_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    db.exec(createChunkPaymentsTable);
    
    // Create indexes for performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunk_payments_user_session ON chunk_payments (user_id, session_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunk_payments_chunk_id ON chunk_payments (chunk_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunk_payments_is_paid ON chunk_payments (is_paid)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunk_payments_created_at ON chunk_payments (created_at)');
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('Successfully created chunk_payments table and indexes');
  } catch (error) {
    console.error('Error during migration to version 6:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 7: Add tx_hash column to payment_channels
function migrateToVersion7() {
  console.log('Running migration to version 7: adding tx_hash column to payment_channels');
  
  try {
    // Check if tx_hash column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasTxHashColumn = columns.some(col => col.name === 'tx_hash');
    
    if (!hasTxHashColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add tx_hash column
      db.exec('ALTER TABLE payment_channels ADD COLUMN tx_hash TEXT');
      
      // Create index for tx_hash
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_tx_hash ON payment_channels (tx_hash)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added tx_hash column');
    } else {
      console.log('Tx_hash column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 7:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 8: Refactor users table for private key authentication
function migrateToVersion8() {
  console.log('Running migration to version 8: refactoring users table for private key authentication');
  
  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Check if public_key column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(users)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasPublicKeyColumn = columns.some(col => col.name === 'public_key');
    
    if (!hasPublicKeyColumn) {
      // Add public_key column without UNIQUE constraint first
      db.exec('ALTER TABLE users ADD COLUMN public_key TEXT');
      
      // Create index for public_key
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_public_key ON users (public_key)');
      
      console.log('Successfully added public_key column and index');
    } else {
      console.log('Public_key column already exists, skipping column addition');
    }
    
    // Note: We keep email, username, and password_hash columns for backward compatibility
    // During migration, existing users can still login with old credentials
    // New users will use private key authentication
    // The uniqueness will be enforced at the application level
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('Successfully completed migration to version 8');
  } catch (error) {
    console.error('Error during migration to version 8:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 9: Make email and password_hash nullable for private key users
function migrateToVersion9() {
  console.log('Running migration to version 9: making email and password_hash nullable');
  
  try {
    // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
    db.exec('BEGIN TRANSACTION');
    
    // Create new table with nullable email and password_hash
    const createNewUsersTable = `
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        public_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )
    `;
    
    db.exec(createNewUsersTable);
    
    // Copy data from old table to new table
    db.exec(`
      INSERT INTO users_new (id, email, username, password_hash, public_key, created_at, updated_at, is_active)
      SELECT id, email, username, password_hash, public_key, created_at, updated_at, is_active
      FROM users
    `);
    
    // Drop old table
    db.exec('DROP TABLE users');
    
    // Rename new table
    db.exec('ALTER TABLE users_new RENAME TO users');
    
    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_public_key ON users (public_key)');
    
    db.exec('COMMIT');
    
    console.log('Successfully completed migration to version 9');
  } catch (error) {
    console.error('Error during migration to version 9:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 10: Add payment transaction fields to chunk_payments table
function migrateToVersion10() {
  console.log('Running migration to version 10: adding payment transaction fields to chunk_payments');
  
  try {
    // Check if the new columns already exist
    const pragmaStmt = db.prepare('PRAGMA table_info(chunk_payments)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasTransactionFields = columns.some(col => col.name === 'cumulative_payment');
    
    if (!hasTransactionFields) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add new columns for payment transaction data
      db.exec('ALTER TABLE chunk_payments ADD COLUMN cumulative_payment INTEGER');
      db.exec('ALTER TABLE chunk_payments ADD COLUMN remaining_balance INTEGER');
      db.exec('ALTER TABLE chunk_payments ADD COLUMN transaction_data TEXT');
      db.exec('ALTER TABLE chunk_payments ADD COLUMN buyer_signature TEXT');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added payment transaction fields to chunk_payments');
    } else {
      console.log('Payment transaction fields already exist, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 10:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 11: Add settle_hash column to payment_channels table
function migrateToVersion11() {
  console.log('Running migration to version 11: adding settle_hash column to payment_channels');
  
  try {
    // Check if settle_hash column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasSettleHashColumn = columns.some(col => col.name === 'settle_hash');
    
    if (!hasSettleHashColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add settle_hash column
      db.exec('ALTER TABLE payment_channels ADD COLUMN settle_hash TEXT');
      
      // Create index for settle_hash
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_settle_hash ON payment_channels (settle_hash)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added settle_hash column');
    } else {
      console.log('Settle_hash column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 11:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 12: Create scheduled_task_logs table
function migrateToVersion12() {
  console.log('Running migration to version 12: creating scheduled_task_logs table');
  
  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Create scheduled_task_logs table
    const createScheduledTaskLogsTable = `
      CREATE TABLE IF NOT EXISTS scheduled_task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT NOT NULL,
        task_type TEXT NOT NULL,
        execution_status TEXT NOT NULL,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        duration_ms INTEGER,
        result_data TEXT,
        error_message TEXT,
        settled_count INTEGER DEFAULT 0,
        checked_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.exec(createScheduledTaskLogsTable);
    
    // Create indexes for performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_task_logs_task_name ON scheduled_task_logs (task_name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_task_logs_task_type ON scheduled_task_logs (task_type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_task_logs_status ON scheduled_task_logs (execution_status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_task_logs_started_at ON scheduled_task_logs (started_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_scheduled_task_logs_created_at ON scheduled_task_logs (created_at)');
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('Successfully created scheduled_task_logs table');
  } catch (error) {
    console.error('Error during migration to version 12:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 13: Add duration_seconds column to payment_channels
function migrateToVersion13() {
  console.log('Running migration to version 13: adding duration_seconds column to payment_channels');
  
  try {
    // Check if duration_seconds column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasDurationSecondsColumn = columns.some(col => col.name === 'duration_seconds');
    
    if (!hasDurationSecondsColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add duration_seconds column
      db.exec('ALTER TABLE payment_channels ADD COLUMN duration_seconds INTEGER');
      
      // Migrate existing data: convert duration_days to duration_seconds
      db.exec('UPDATE payment_channels SET duration_seconds = duration_days * 24 * 60 * 60 WHERE duration_seconds IS NULL');
      
      // Create index for duration_seconds
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_duration_seconds ON payment_channels (duration_seconds)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added duration_seconds column and migrated data');
    } else {
      console.log('Duration_seconds column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 13:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Migration to version 14: Add verified_at column to payment_channels
function migrateToVersion14() {
  console.log('Running migration to version 14: adding verified_at column to payment_channels');
  
  try {
    // Check if verified_at column already exists
    const pragmaStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = pragmaStmt.all() as Array<{ name: string }>;
    const hasVerifiedAtColumn = columns.some(col => col.name === 'verified_at');
    
    if (!hasVerifiedAtColumn) {
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      // Add verified_at column
      db.exec('ALTER TABLE payment_channels ADD COLUMN verified_at DATETIME');
      
      // For existing active channels, set verified_at to created_at as a reasonable default
      db.exec(`UPDATE payment_channels SET verified_at = created_at WHERE status = ${PAYMENT_CHANNEL_STATUS.ACTIVE}`);
      
      // Create index for verified_at
      db.exec('CREATE INDEX IF NOT EXISTS idx_payment_channels_verified_at ON payment_channels (verified_at)');
      
      // Commit transaction
      db.exec('COMMIT');
      
      console.log('Successfully added verified_at column and updated existing data');
    } else {
      console.log('Verified_at column already exists, skipping migration');
    }
  } catch (error) {
    console.error('Error during migration to version 14:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// User interface
export interface User {
  id: number;
  email?: string | null; // Optional and nullable for private key users
  username: string;
  password_hash?: string | null; // Optional and nullable for private key users
  public_key?: string | null; // New primary identifier for private key users
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

// User creation interface - Legacy for backward compatibility
export interface CreateUserData {
  email?: string;
  username: string;
  password?: string;
  public_key?: string;
}

// New user creation interface for private key authentication
export interface CreateUserFromPublicKey {
  username: string;
  public_key: string;
}

// User database operations
export class UserRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const { email, username, password, public_key } = userData;
    
    if (public_key) {
      // New private key authentication flow
      const stmt = this.db.prepare(`
        INSERT INTO users (username, public_key, is_active)
        VALUES (?, ?, 1)
      `);
      
      try {
        const result = stmt.run(username, public_key);
        return this.getUserById(result.lastInsertRowid as number)!;
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new Error('Username or public key already exists');
        }
        throw error;
      }
    } else if (email && password) {
      // Legacy email/password authentication flow
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
    } else {
      throw new Error('Either public_key or email/password must be provided');
    }
  }

  // New method for creating user from private key
  async createUserFromPublicKey(userData: CreateUserFromPublicKey): Promise<User> {
    const { username, public_key } = userData;
    
    // Check if public key already exists
    const existingUser = this.getUserByPublicKey(public_key);
    if (existingUser) {
      throw new Error('Public key already exists');
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO users (username, public_key, is_active)
      VALUES (?, ?, 1)
    `);

    try {
      const result = stmt.run(username, public_key);
      return this.getUserById(result.lastInsertRowid as number)!;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Username already exists');
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

  getUserByPublicKey(publicKey: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE public_key = ?');
    return stmt.get(publicKey) as User | null;
  }

  getUserByUsername(username: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | null;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password_hash) {
      return false; // User created with private key, no password to verify
    }
    return await bcrypt.compare(password, user.password_hash);
  }

  updateLastLogin(userId: number): void {
    const stmt = this.db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(userId);
  }

  // Admin method to get all users
  getAllUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as User[];
  }

  // Admin method to update user status
  updateUserStatus(userId: number, is_active: boolean): void {
    const stmt = this.db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(is_active ? 1 : 0, userId);
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
  SETTLED: 4,     // 已结算
  EXPIRED: 5,     // 已过期
} as const;

export type PaymentChannelStatus = typeof PAYMENT_CHANNEL_STATUS[keyof typeof PAYMENT_CHANNEL_STATUS];

// Payment Channel interface
export interface PaymentChannel {
  id: number;
  user_id: number;
  channel_id: string;
  amount: number;
  duration_days: number;
  duration_seconds: number; // New field for duration in seconds
  status: PaymentChannelStatus;
  seller_signature: string | null;
  refund_tx_data: string | null;
  funding_tx_data: string | null;
  tx_hash: string | null; // Transaction hash after confirmation
  settle_hash: string | null; // Settlement transaction hash
  verified_at: string | null; // When channel becomes active (funding confirmed)
  is_default: number; // SQLite stores boolean as integer (0 or 1)
  consumed_tokens: number; // Number of tokens consumed
  created_at: string;
  updated_at: string;
}

// Chunk Payment interface
export interface ChunkPayment {
  id: number;
  chunk_id: string;
  user_id: number;
  session_id: string;
  channel_id: string | null;
  tokens_count: number;
  is_paid: number; // SQLite stores boolean as integer (0 or 1)
  cumulative_payment: number | null; // Payment amount in CKB accumulated
  remaining_balance: number | null; // Remaining balance in CKB in channel
  transaction_data: string | null; // JSON string of transaction data
  buyer_signature: string | null; // Buyer signature for the transaction
  created_at: string;
  paid_at: string | null;
}

// Chunk Payment creation interface
export interface CreateChunkPaymentData {
  chunk_id: string;
  user_id: number;
  session_id: string;
  channel_id?: string;
  tokens_count: number;
  is_paid?: boolean; // API accepts boolean, will be converted to integer internally
}

// Scheduled Task Log interface
export interface ScheduledTaskLog {
  id: number;
  task_name: string;
  task_type: string;
  execution_status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result_data: string | null;
  error_message: string | null;
  settled_count: number;
  checked_count: number;
  created_at: string;
}

// Scheduled Task Log creation interface
export interface CreateScheduledTaskLogData {
  task_name: string;
  task_type: string;
  execution_status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  result_data?: string;
  error_message?: string;
  settled_count?: number;
  checked_count?: number;
}

// Payment Channel creation interface
export interface CreatePaymentChannelData {
  user_id: number;
  channel_id: string;
  amount: number;
  duration_days: number;
  duration_seconds?: number; // Optional seconds field
  status?: PaymentChannelStatus;
  seller_signature?: string;
  refund_tx_data?: string;
  funding_tx_data?: string;
  is_default?: boolean; // API accepts boolean, will be converted to integer internally
  consumed_tokens?: number; // Number of tokens consumed, defaults to 0
}

// Payment Channel database operations
export class PaymentChannelRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createPaymentChannel(channelData: CreatePaymentChannelData): PaymentChannel {
    const { user_id, channel_id, amount, duration_days, duration_seconds, status, seller_signature, refund_tx_data, funding_tx_data, is_default, consumed_tokens } = channelData;
    
    const stmt = this.db.prepare(`
      INSERT INTO payment_channels (user_id, channel_id, amount, duration_days, duration_seconds, status, seller_signature, refund_tx_data, funding_tx_data, is_default, consumed_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const channelStatus = status || PAYMENT_CHANNEL_STATUS.INACTIVE; // Default to inactive
      const defaultFlag = is_default ? 1 : 0; // Convert boolean to integer for SQLite
      const consumedTokens = consumed_tokens || 0; // Default to 0 consumed tokens
      const durationInSeconds = duration_seconds || (duration_days * 24 * 60 * 60); // Calculate seconds if not provided
      const result = stmt.run(user_id, channel_id, amount, duration_days, durationInSeconds, channelStatus, seller_signature || null, refund_tx_data || null, funding_tx_data || null, defaultFlag, consumedTokens);
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

  updatePaymentChannelTxHash(channelId: string, txHash: string): PaymentChannel | null {
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET tx_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    stmt.run(txHash, channelId);
    return this.getPaymentChannelByChannelId(channelId);
  }

  updatePaymentChannelSettleHash(channelId: string, settleHash: string): PaymentChannel | null {
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET settle_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    stmt.run(settleHash, channelId);
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
    // Set both status to ACTIVE and verified_at to current timestamp
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET status = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    stmt.run(PAYMENT_CHANNEL_STATUS.ACTIVE, channelId);
    return this.getPaymentChannelByChannelId(channelId);
  }

  invalidatePaymentChannel(channelId: string): PaymentChannel | null {
    return this.updatePaymentChannelStatus(channelId, PAYMENT_CHANNEL_STATUS.INVALID);
  }

  getPaymentChannelsByStatus(userId: number, status: PaymentChannelStatus): PaymentChannel[] {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE user_id = ? AND status = ? ORDER BY created_at DESC');
    return stmt.all(userId, status) as PaymentChannel[];
  }

  // Default channel management methods
  getUserDefaultChannel(userId: number): PaymentChannel | null {
    const stmt = this.db.prepare('SELECT * FROM payment_channels WHERE user_id = ? AND is_default = 1 AND status = ? LIMIT 1');
    return stmt.get(userId, PAYMENT_CHANNEL_STATUS.ACTIVE) as PaymentChannel | null;
  }

  setChannelAsDefault(channelId: string, userId: number): PaymentChannel | null {
    const transaction = this.db.transaction(() => {
      // First, remove default flag from all other channels for this user
      const clearDefaultStmt = this.db.prepare('UPDATE payment_channels SET is_default = 0 WHERE user_id = ? AND channel_id != ?');
      clearDefaultStmt.run(userId, channelId);
      
      // Then set the specified channel as default
      const setDefaultStmt = this.db.prepare('UPDATE payment_channels SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ? AND user_id = ?');
      setDefaultStmt.run(channelId, userId);
    });
    
    transaction();
    return this.getPaymentChannelByChannelId(channelId);
  }

  clearUserDefaultChannel(userId: number): void {
    const stmt = this.db.prepare('UPDATE payment_channels SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    stmt.run(userId);
  }

  // Auto-assign default channel to the first active channel if no default exists
  autoAssignDefaultChannel(userId: number): PaymentChannel | null {
    // Check if user already has a default channel
    const existingDefault = this.getUserDefaultChannel(userId);
    if (existingDefault) {
      return existingDefault;
    }

    // Find the first active channel for this user
    const activeChannels = this.getPaymentChannelsByStatus(userId, PAYMENT_CHANNEL_STATUS.ACTIVE);
    if (activeChannels.length > 0) {
      const firstActiveChannel = activeChannels[0];
      return this.setChannelAsDefault(firstActiveChannel.channel_id, userId);
    }

    return null;
  }

  // Admin method to get all payment channels
  getAllPaymentChannels(): PaymentChannel[] {
    const stmt = this.db.prepare('SELECT * FROM payment_channels ORDER BY created_at DESC');
    return stmt.all() as PaymentChannel[];
  }

  // Admin method to update channel status by ID
  updatePaymentChannelStatusById(channelId: number, status: PaymentChannelStatus): PaymentChannel | null {
    const stmt = this.db.prepare(`
      UPDATE payment_channels 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(status, channelId);
    return this.getPaymentChannelById(channelId);
  }

  // Method to get expired active channels using verified_at and duration_seconds
  getExpiredActiveChannels(): PaymentChannel[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_channels 
      WHERE status = ? 
      AND verified_at IS NOT NULL
      AND (
        (duration_seconds IS NOT NULL AND datetime(verified_at, '+' || duration_seconds || ' seconds') < datetime('now'))
        OR (duration_seconds IS NULL AND datetime(verified_at, '+' || duration_days || ' days') < datetime('now'))
      )
      ORDER BY verified_at ASC
    `);
    return stmt.all(PAYMENT_CHANNEL_STATUS.ACTIVE) as PaymentChannel[];
  }

  // Method to expire a channel by channel_id
  expirePaymentChannel(channelId: string): PaymentChannel | null {
    return this.updatePaymentChannelStatus(channelId, PAYMENT_CHANNEL_STATUS.EXPIRED);
  }

  // Batch method to expire multiple channels
  expirePaymentChannels(channelIds: string[]): number {
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE payment_channels 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE channel_id = ?
      `);
      
      let expiredCount = 0;
      for (const channelId of channelIds) {
        const result = stmt.run(PAYMENT_CHANNEL_STATUS.EXPIRED, channelId);
        if (result.changes > 0) {
          expiredCount++;
        }
      }
      return expiredCount;
    });
    
    return transaction();
  }
}

// Chunk Payment database operations
export class ChunkPaymentRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createChunkPayment(chunkData: CreateChunkPaymentData): ChunkPayment {
    const { chunk_id, user_id, session_id, channel_id, tokens_count, is_paid } = chunkData;
    
    const stmt = this.db.prepare(`
      INSERT INTO chunk_payments (chunk_id, user_id, session_id, channel_id, tokens_count, is_paid)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      const paidFlag = is_paid ? 1 : 0; // Convert boolean to integer for SQLite
      const result = stmt.run(chunk_id, user_id, session_id, channel_id || null, tokens_count, paidFlag);
      return this.getChunkPaymentById(result.lastInsertRowid as number)!;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Chunk payment with this ID already exists');
      }
      throw error;
    }
  }

  getChunkPaymentById(id: number): ChunkPayment | null {
    const stmt = this.db.prepare('SELECT * FROM chunk_payments WHERE id = ?');
    return stmt.get(id) as ChunkPayment | null;
  }

  getChunkPaymentByChunkId(chunkId: string): ChunkPayment | null {
    const stmt = this.db.prepare('SELECT * FROM chunk_payments WHERE chunk_id = ?');
    return stmt.get(chunkId) as ChunkPayment | null;
  }

  getUnpaidChunksByUserSession(userId: number, sessionId: string): ChunkPayment[] {
    const stmt = this.db.prepare('SELECT * FROM chunk_payments WHERE user_id = ? AND session_id = ? AND is_paid = 0 ORDER BY created_at ASC');
    return stmt.all(userId, sessionId) as ChunkPayment[];
  }

  getChunkPaymentsByUserSession(userId: number, sessionId: string): ChunkPayment[] {
    const stmt = this.db.prepare('SELECT * FROM chunk_payments WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC');
    return stmt.all(userId, sessionId) as ChunkPayment[];
  }

  markChunksAsPaid(chunkIds: string[], channelId: string): void {
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE chunk_payments 
        SET is_paid = 1, paid_at = CURRENT_TIMESTAMP, channel_id = ?
        WHERE chunk_id = ?
      `);
      
      for (const chunkId of chunkIds) {
        stmt.run(channelId, chunkId);
      }
    });
    
    transaction();
  }

  // Update chunk payment with transaction data from pay-enhanced
  updateChunkPaymentWithTransactionData(
    chunkId: string, 
    channelId: string, 
    cumulativePayment: number, 
    remainingBalance: number, 
    transactionData: Record<string, unknown>, 
    buyerSignature: string
  ): ChunkPayment | null {
    const stmt = this.db.prepare(`
      UPDATE chunk_payments 
      SET is_paid = 1, 
          paid_at = CURRENT_TIMESTAMP, 
          channel_id = ?,
          cumulative_payment = ?,
          remaining_balance = ?,
          transaction_data = ?,
          buyer_signature = ?
      WHERE chunk_id = ?
    `);
    
    stmt.run(
      channelId, 
      cumulativePayment, 
      remainingBalance, 
      JSON.stringify(transactionData), 
      buyerSignature, 
      chunkId
    );
    
    return this.getChunkPaymentByChunkId(chunkId);
  }

  getUnpaidTokensCount(userId: number, sessionId: string): number {
    const stmt = this.db.prepare('SELECT SUM(tokens_count) as total FROM chunk_payments WHERE user_id = ? AND session_id = ? AND is_paid = 0');
    const result = stmt.get(userId, sessionId) as { total: number | null };
    return result.total || 0;
  }

  getUserTotalUnpaidTokens(userId: number): number {
    const stmt = this.db.prepare('SELECT SUM(tokens_count) as total FROM chunk_payments WHERE user_id = ? AND is_paid = 0');
    const result = stmt.get(userId) as { total: number | null };
    return result.total || 0;
  }

  // Get total unpaid tokens for a specific payment channel
  getChannelUnpaidTokens(channelId: string): number {
    const stmt = this.db.prepare('SELECT SUM(tokens_count) as total FROM chunk_payments WHERE channel_id = ? AND is_paid = 0');
    const result = stmt.get(channelId) as { total: number | null };
    return result.total || 0;
  }

  // Get cumulative tokens for a payment channel (including current chunk)
  getChannelCumulativeTokensWithCurrent(channelId: string, currentTokens: number = 0): number {
    const stmt = this.db.prepare('SELECT SUM(tokens_count) as total FROM chunk_payments WHERE channel_id = ?');
    const result = stmt.get(channelId) as { total: number | null };
    const existingTokens = result.total || 0;
    return existingTokens + currentTokens;
  }

  deleteOldUnpaidChunks(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000)).toISOString();
    const stmt = this.db.prepare('DELETE FROM chunk_payments WHERE is_paid = 0 AND created_at < ?');
    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  getLatestSessionForUser(userId: number): string | null {
    const stmt = this.db.prepare('SELECT session_id FROM chunk_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    const result = stmt.get(userId) as { session_id: string } | null;
    return result?.session_id || null;
  }
}

// Scheduled Task Log database operations
export class ScheduledTaskLogRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createTaskLog(logData: CreateScheduledTaskLogData): ScheduledTaskLog {
    const { 
      task_name, 
      task_type, 
      execution_status, 
      started_at, 
      completed_at, 
      duration_ms, 
      result_data, 
      error_message, 
      settled_count, 
      checked_count 
    } = logData;
    
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_task_logs (
        task_name, task_type, execution_status, started_at, completed_at, 
        duration_ms, result_data, error_message, settled_count, checked_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(
        task_name,
        task_type,
        execution_status,
        started_at,
        completed_at || null,
        duration_ms || null,
        result_data || null,
        error_message || null,
        settled_count || 0,
        checked_count || 0
      );
      return this.getTaskLogById(result.lastInsertRowid as number)!;
    } catch (error) {
      console.error('Error creating task log:', error);
      throw error;
    }
  }

  getTaskLogById(id: number): ScheduledTaskLog | null {
    const stmt = this.db.prepare('SELECT * FROM scheduled_task_logs WHERE id = ?');
    return stmt.get(id) as ScheduledTaskLog | null;
  }

  getTaskLogsByName(taskName: string, limit: number = 100): ScheduledTaskLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_task_logs 
      WHERE task_name = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(taskName, limit) as ScheduledTaskLog[];
  }

  getTaskLogsByNamePaginated(taskName: string, page: number = 1, pageSize: number = 20): {
    logs: ScheduledTaskLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_task_logs 
      WHERE task_name = ?
    `);
    const { count: total } = countStmt.get(taskName) as { count: number };
    
    // Get paginated logs
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_task_logs 
      WHERE task_name = ? 
      ORDER BY started_at DESC 
      LIMIT ? OFFSET ?
    `);
    const logs = stmt.all(taskName, pageSize, offset) as ScheduledTaskLog[];
    
    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  getTaskLogsByType(taskType: string, limit: number = 100): ScheduledTaskLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_task_logs 
      WHERE task_type = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(taskType, limit) as ScheduledTaskLog[];
  }

  getTaskLogsByStatus(status: string, limit: number = 100): ScheduledTaskLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_task_logs 
      WHERE execution_status = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(status, limit) as ScheduledTaskLog[];
  }

  getAllTaskLogs(limit: number = 100): ScheduledTaskLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_task_logs 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as ScheduledTaskLog[];
  }

  updateTaskLog(id: number, updateData: Partial<CreateScheduledTaskLogData>): ScheduledTaskLog | null {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return this.getTaskLogById(id);
    }
    
    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE scheduled_task_logs 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getTaskLogById(id);
  }

  deleteOldTaskLogs(daysOld: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare('DELETE FROM scheduled_task_logs WHERE created_at < ?');
    const result = stmt.run(cutoffDate);
    return result.changes;
  }

  getTaskExecutionStats(taskName?: string): {
    total: number;
    success: number;
    failed: number;
    running: number;
    avgDuration: number | null;
  } {
    let whereClause = '';
    const params: (string | number)[] = [];
    
    if (taskName) {
      whereClause = 'WHERE task_name = ?';
      params.push(taskName);
    }
    
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN execution_status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN execution_status = 'running' THEN 1 ELSE 0 END) as running,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) as avgDuration
      FROM scheduled_task_logs
      ${whereClause}
    `);
    
    return stmt.get(...params) as {
      total: number;
      success: number;
      failed: number;
      running: number;
      avgDuration: number | null;
    };
  }
}