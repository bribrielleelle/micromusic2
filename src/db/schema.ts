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
