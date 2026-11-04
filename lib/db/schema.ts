import { pgTable, text, timestamp, boolean, serial, integer, primaryKey } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const alertSettings = pgTable('alert_settings', {
  userId: text('userId').primaryKey(),
  email: text('email').notNull(),
  frequency: text('frequency').notNull().default('instant'),
  lastSentAt: timestamp('lastSentAt'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const watchItems = pgTable('watch_items', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull().default(''),
  yearMin: integer('yearMin'),
  yearMax: integer('yearMax'),
  notify: boolean('notify').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const seenMatches = pgTable(
  'seen_matches',
  {
    watchItemId: integer('watchItemId').notNull(),
    userId: text('userId').notNull(),
    stock: text('stock').notNull(),
    year: text('year').notNull(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    row: text('row').notNull().default(''),
    firstSeenAt: timestamp('firstSeenAt').notNull().defaultNow(),
    notifiedAt: timestamp('notifiedAt'),
  },
  (t) => [primaryKey({ columns: [t.watchItemId, t.stock] })],
)

export type WatchItem = typeof watchItems.$inferSelect
export type Frequency = 'instant' | 'daily' | 'weekly'
