# **Comprehensive Product Specification Document: SONA Fan-Centric Hub (V17)**

## **1\. Product Overview & Personas**

> * **Target Audience:** A closed, invite-only community of passionate music fans, stans, playlist curators, and tastemakers.  
> * **Core Purpose:** A centralized, aesthetic community hub where fans discover music, bond over shared tastes, and curate collaborative listening crates.  
> * **Core Problem Solved:** Eliminates the fragmentation of the modern fan experience by combining music discovery and communal curation in one unified, aesthetic social environment.

### **Key User Personas**

> * **The Superfan (Enthusiast):** Browses the platform daily to discover niche tracks, build custom crates, and connect with other fans who share their hyper-specific genre tastes.  
> * **The Tastemaker (Curator):** Scours the platform and external sites to build highly curated playlists (Crates) that gain followers. Relies heavily on the tagging system and category filters to organize their aesthetic boards.  
> * **The Verified Artist (Deferred to v1.1):** Claims their verified profile to share exclusive updates and interact directly with listeners.

## **2\. Technical Architecture & Stack**

| Layer | Technology | Implementation Details & Rationale |
| :---- | :---- | :---- |
| **Frontend & Hosting** | Next.js 15 / Vercel | Developed and published on Vercel (Hobby Tier) for true free-tier serverless hosting. The Global Audio Player is mounted at the root Layout level. |
| **State Management** | Zustand | Tracks the current playing URL, play/pause state, and the "Up Next" queue. Queue state is persisted to localStorage so it survives hard refreshes. |
| **Database** | Replit PostgreSQL | Relational database provided by Replit. All authorization and ownership checks MUST be handled manually in the Next.js API routes. |
| **ORM (Data Fetching)** | Drizzle ORM | Lightweight, type-safe database queries that integrate seamlessly with Next.js serverless functions. |
| **Auth** | Clerk | Handles secure sign in/sign up. Public signups are restricted via Clerk's allowlist features or custom invite code logic. |
| **Media Storage** | Cloudinary | Generous free tier used strictly for avatar and crate cover images (max 5MB). |
| **Audio Engine** | Hybrid Widget APIs | Utilizes postMessage APIs from provider widgets (SoundCloud / YouTube). |
| **Realtime Updates** | Client Polling | Clients poll for new comments to keep serverless architecture simple. |

## **3\. UI Component & Layout Breakdown**

> * **Sidebar Navigation (Left)**  
  * **Primary Navigation:** Vertical menu (Now Playing, Browse, Communities, Charts, Settings).  
  * **Custom Content:** Dedicated CRATES section with custom user lists and a "+ New playlist" CTA.  
  * **Global Search & Filters:** Search bar and category/tag filters to support aesthetic curation and fandom discovery.  
> * **Main Dashboard / Feed (Center)**  
  * **Now Playing Card:** Floating container showcasing current track metadata and media controls.  
  * **Up Next Preview:** Embedded row showing upcoming track title, artist, and duration.  
> * **Interactive Hero Element (Right)**  
  * **Decorative Vinyl Display:** High-resolution dynamic vinyl record graphic. This is purely decorative and synced to playback state; it does NOT replace the provider's player UI.  
> * **Persistent Footer / Status Bar (Bottom)**  
  * **Global Controls:** Master volume and playback controls.  
  * **Embedded Player constraints (ToS Compliance):** Both YouTube and SoundCloud iframes MUST remain visible (small, dimmed, \~200x200px) in the footer to comply with their respective API Terms of Service.  
> * **Mobile Responsive Spec**  
  * Below lg breakpoint: Sidebar collapses to a hamburger drawer. Hero vinyl shrinks or hides completely. Footer transforms into a condensed mobile mini-player bar.

## **4\. Feature Implementation & Phased Roadmap (v1 Cut Line)**

### **Phase 1: UI/UX Design & Prototyping**

> * Define warm vintage design system, wireframe the three-pane layout, and document responsive breakpoints for mobile.

### **Phase 2: Infrastructure, Auth & Security**

> * **Project Scaffolding:** Initialize Next.js 15 and Tailwind CSS on Vercel.  
> * **Database Setup:** Provision Replit PostgreSQL, write Drizzle schema. Configure Postgres ENUMs and DB-backed rate limiting.  
> * **Security & Auth:** Integrate Clerk. Lock down public registration to invite-code only. Write strict application-level authorization middleware to protect API routes.

### **Phase 3: Layout & Global State**

> * Translate designs into code. Configure Zustand at the root layout level with localStorage persistence for the Up Next queue.

### **Phase 4: Content, Discovery & Fandom (The v1 Cut Line)**

> * **Post Creation API:** Build route accepting URLs. *Security Requirement:* Validate media\_url against an allowlist (soundcloud.com, youtube.com). The oEmbed fetch MUST go directly to the provider endpoints, preventing SSRF.  
> * **Discovery Feed:** Build masonry grid highlighting curated tracks with cursor-based pagination on created\_at.  
> * **Social, Follows & Crates:** Implement Likes, Bookmarks (standalone saving), Crate items, user Follows, and 2-tier maximum comments (using polling). Track views via the PostViews table.

### **Phase 5: Deferred Features (v1.1 Roadmap)**

> * Verified Artist badges, full Admin Dashboard, and Resend email workflows (DMCA/alerts).

## **5\. Strict Relational Database Schema**

*Note: All Foreign Keys mapping to Users or Posts MUST declare ON DELETE CASCADE. User IDs are VARCHAR(255) to match Clerk's ID format.*

| Table | Column Name | Data Type | Modifiers / Relations |
| :---- | :---- | :---- | :---- |
| **Users** | id | VARCHAR(255) | Primary Key (Matches Clerk User ID) |
|  | username | VARCHAR(50) | Unique, Not Null |
|  | email | VARCHAR(255) | Unique, Not Null |
|  | role | ENUM ('user', 'admin') | Default: 'user' |
|  | bio, links, avatar\_url | Various | Nullable metadata (Cloudinary URL for avatars) |
| **Posts** | id | UUID | Primary Key |
|  | user\_id | VARCHAR(255) | Foreign Key \-\> Users(id) CASCADE |
|  | media\_url | TEXT | Not Null (YouTube/SoundCloud only) |
|  | title, artist\_name, thumbnail\_url, duration\_seconds | Various | Fetched via provider oEmbed API |
|  | tags | JSONB | Indexed via GIN for tags-only Fandom Search |
|  | view\_count | INTEGER | Default: 0 |
|  | is\_hidden | BOOLEAN | Default: False (Set by flagging, awaits admin review) |
|  | created\_at | TIMESTAMP | Default: now() |
| **PostViews** | post\_id | UUID | Composite PK, FK \-\> Posts(id) CASCADE |
|  | user\_id | VARCHAR(255) | Composite PK, FK \-\> Users(id) CASCADE |
|  | viewed\_at | TIMESTAMP | Default: now() |
| **Crates** | id | UUID | Primary Key |
|  | owner\_id | VARCHAR(255) | Foreign Key \-\> Users(id) CASCADE |
|  | title, description, cover\_url | Various | Metadata |
|  | is\_public | BOOLEAN | Default: True |
|  | created\_at | TIMESTAMP | Default: now() |
| **CrateItems** | crate\_id | UUID | Composite PK, FK \-\> Crates(id) CASCADE |
|  | post\_id | UUID | Composite PK, FK \-\> Posts(id) CASCADE |
|  | added\_by | VARCHAR(255) | Not Null, FK \-\> Users(id) CASCADE |
|  | position | INTEGER | For custom ordering |
|  | added\_at | TIMESTAMP | Default: now() |
| **Bookmarks** | post\_id | UUID | Composite PK, FK \-\> Posts(id) CASCADE |
|  | user\_id | VARCHAR(255) | Composite PK, FK \-\> Users(id) CASCADE |
| **Likes** | post\_id, user\_id | Various | Composite PK, Cascading FKs |
| **Follows** | follower\_id | VARCHAR(255) | Composite PK, FK \-\> Users(id) CASCADE |
|  | followed\_id | VARCHAR(255) | Composite PK, FK \-\> Users(id) CASCADE. CHECK(follower\_id \!= followed\_id) |
| **Comments** | id | UUID | Primary Key. Capped at 2 tiers deep via app logic. |
|  | post\_id, parent\_id | UUID | Cascading FKs |
|  | user\_id | VARCHAR(255) | Cascading FKs |
|  | body, created\_at | Various | Content and Timestamp |
| **RateLimits** | id | UUID | Primary Key |
|  | user\_id\_or\_ip | VARCHAR | Identifier for the action |
|  | action | VARCHAR | e.g., 'post\_creation', 'crate\_add' |
|  | timestamp | TIMESTAMP | Default: now() |
| **InviteCodes** | code | VARCHAR | Primary Key |
|  | created\_by | VARCHAR(255) | FK \-\> Users(id) CASCADE |
|  | used\_by | VARCHAR(255) | Nullable, FK \-\> Users(id) CASCADE |
|  | created\_at | TIMESTAMP | Default: now() |

### **Required Database Indexes**

> * Posts(created\_at) \- Essential for cursor-based pagination.  
> * Posts(tags) \- GIN Index for Fandom Search.  
> * Comments(created\_at), Likes(user\_id), Bookmarks(user\_id), Crates(owner\_id), Follows(follower\_id)

## **6\. API Route Inventory & Security Notes**

**SECURITY WARNING:** With the move to Replit PostgreSQL, EVERY write route (POST/PATCH/DELETE) MUST implement manual application-level authorization in Next.js to verify the request comes from the owner of the resource or an Admin.

### **GET Routes (Read)**

> * GET /api/posts \- Fetch feed. Requires cursor parameter for created\_at pagination.  
> * GET /api/posts/\[id\] \- Fetch single post detail & comments.  
> * GET /api/users/\[id\] \- Fetch user profile (bio, links, crates, likes, followers).  
> * GET /api/crates/\[id\] \- Fetch crate metadata and joined CrateItems.  
> * GET /api/search \- Fandom search against Posts(tags) via GIN index.

### **POST / PATCH / DELETE Routes (Write)**

> * POST /api/auth/invite/consume \- Validate and consume an invite code, mapping it to used\_by.  
> * POST /api/posts \- Create post. Checks allowlist, queries provider oEmbed API directly. Hit against RateLimits DB table.  
> * POST /api/posts/\[id\]/view \- Log a unique view in PostViews.  
> * DELETE /api/posts/\[id\] \- Delete post (Owner or Admin only).  
> * POST /api/likes & DELETE /api/likes \- Toggle post like.  
> * POST /api/bookmarks & DELETE /api/bookmarks \- Toggle standalone post bookmark.  
> * POST /api/follows & DELETE /api/follows \- Toggle user follow.  
> * POST /api/crates/items \- Add post to crate (Rate-limited for public crates).  
> * DELETE /api/crates/items \- Remove item (Crate owner can remove any item).  
> * POST /api/comments \- Create comment (Max depth: 2 tiers).  
> * DELETE /api/comments/\[id\] \- Delete comment (Owner or Admin only).  
> * PATCH /api/admin/posts/\[id\]/flag \- User report flag. Sets is\_hidden=True for admin review.  
> * PATCH /api/admin/posts/\[id\]/visibility \- Admin route to unhide/hide flagged posts.

## **7\. Error, Empty & Loading States**

> * **Discovery Feed:** Skeleton loaders for images. Empty state: "No tracks found."  
> * **Crates:** Empty state: "This crate is empty."