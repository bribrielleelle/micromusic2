import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('user').notNull(),
  isVerifiedArtist: boolean('is_verified_artist').default(false).notNull(),
  verifiedArtistName: varchar('verified_artist_name', { length: 120 }),
  verifiedAt: timestamp('verified_at'),
  bio: text('bio'),
  links: jsonb('links').$type<Record<string, string>>(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaUrl: text('media_url').notNull(),
    title: text('title'),
    artistName: text('artist_name'),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: integer('duration_seconds'),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    isHidden: boolean('is_hidden').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_created_at_idx').on(table.createdAt),
    index('posts_tags_gin_idx').using('gin', table.tags),
  ],
);

export const postViews = pgTable(
  'post_views',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const crates = pgTable(
  'crates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: varchar('owner_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    coverUrl: text('cover_url'),
    isPublic: boolean('is_public').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('crates_owner_id_idx').on(table.ownerId)],
);

export const crateItems = pgTable(
  'crate_items',
  {
    crateId: uuid('crate_id')
      .notNull()
      .references(() => crates.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    addedBy: varchar('added_by', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    position: integer('position').default(0).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.crateId, table.postId] })],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index('bookmarks_user_id_idx').on(table.userId),
  ],
);

export const likes = pgTable(
  'likes',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index('likes_user_id_idx').on(table.userId),
  ],
);

export const follows = pgTable(
  'follows',
  {
    followerId: varchar('follower_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followedId: varchar('followed_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followedId] }),
    index('follows_follower_id_idx').on(table.followerId),
    check('follows_no_self_follow', sql`${table.followerId} <> ${table.followedId}`),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('comments_created_at_idx').on(table.createdAt)],
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userIdOrIp: varchar('user_id_or_ip', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('rate_limits_lookup_idx').on(table.userIdOrIp, table.action, table.timestamp),
  ],
);

export const inviteCodes = pgTable('invite_codes', {
  code: varchar('code', { length: 64 }).primaryKey(),
  createdBy: varchar('created_by', { length: 255 }).references(() => users.id, {
    onDelete: 'cascade',
  }),
  usedBy: varchar('used_by', { length: 255 }).references(() => users.id, {
    onDelete: 'cascade',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const artistVerificationRequests = pgTable(
  'artist_verification_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artistName: varchar('artist_name', { length: 120 }).notNull(),
    portfolioUrl: text('portfolio_url').notNull(),
    notes: text('notes'),
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    reviewedBy: varchar('reviewed_by', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('artist_verif_user_idx').on(table.userId, table.status)],
);

export const dmcaReports = pgTable(
  'dmca_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    reporterUserId: varchar('reporter_user_id', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    reporterEmail: varchar('reporter_email', { length: 255 }).notNull(),
    claimantName: varchar('claimant_name', { length: 120 }).notNull(),
    reason: text('reason').notNull(),
    rightsUrl: text('rights_url'),
    status: varchar('status', { length: 24 }).default('open').notNull(),
    resolvedBy: varchar('resolved_by', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('dmca_reports_status_idx').on(table.status, table.createdAt)],
);

export const emailAlerts = pgTable(
  'email_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    alertType: varchar('alert_type', { length: 64 }).notNull(),
    subject: text('subject').notNull(),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    deliveryStatus: varchar('delivery_status', { length: 32 }).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('email_alerts_created_idx').on(table.createdAt)],
);

