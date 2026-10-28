# QuickNotes Data Model Specification

This document details the database schema, relational entities, constraints, and query patterns for the **QuickNotes** production service.

---

## 1. Entities & Schema Overview

The QuickNotes service is structured around four normalized relational entities:

### 1. `users`
Represents registered user accounts.
- `user_id` (`INTEGER PRIMARY KEY AUTOINCREMENT` / `BIGSERIAL`): Unique internal identifier.
- `username` (`VARCHAR(50) NOT NULL UNIQUE`): Unique public handle for the user.
- `email` (`VARCHAR(255) NOT NULL UNIQUE`): Validated email address for authentication and notifications.
- `password_hash` (`VARCHAR(255) NOT NULL`): Securely salted hash (Argon2id or bcrypt).
- `created_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Account creation timestamp.
- `updated_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Last profile modification timestamp.

### 2. `notes`
Represents individual text notes created and owned by a user.
- `note_id` (`INTEGER PRIMARY KEY AUTOINCREMENT` / `BIGSERIAL`): Unique identifier for each note.
- `user_id` (`INTEGER NOT NULL`): Foreign key referencing `users(user_id)` with `ON DELETE CASCADE`.
- `title` (`VARCHAR(100) NOT NULL`): Note headline (constrained between 1 and 100 characters).
- `body` (`TEXT`): Note content body (optional, markdown formatted).
- `is_pinned` (`BOOLEAN NOT NULL DEFAULT 0`): Flag indicating if the note is pinned to the top of the feed.
- `created_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Timestamp when note was created.
- `updated_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Timestamp when note was last edited.

### 3. `tags`
Represents categorization labels defined by users to organize their notes.
- `tag_id` (`INTEGER PRIMARY KEY AUTOINCREMENT` / `BIGSERIAL`): Unique identifier for each tag.
- `user_id` (`INTEGER NOT NULL`): Foreign key referencing `users(user_id)` with `ON DELETE CASCADE`.
- `name` (`VARCHAR(50) NOT NULL`): Normalized tag label (e.g., `work`, `ideas`, `personal`).
- `created_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Tag creation timestamp.
- `UNIQUE(user_id, name)`: Ensures a user cannot create duplicate tag names.

### 4. `note_tags` (Associative Junction Table)
Resolves the many-to-many relationship between notes and tags.
- `note_id` (`INTEGER NOT NULL`): Foreign key referencing `notes(note_id)` with `ON DELETE CASCADE`.
- `tag_id` (`INTEGER NOT NULL`): Foreign key referencing `tags(tag_id)` with `ON DELETE CASCADE`.
- `created_at` (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`): Timestamp when tag was attached.
- `PRIMARY KEY (note_id, tag_id)`: Composite primary key ensuring a tag cannot be attached to the same note more than once.

---

## 2. Relationships Explained

- **`users` to `notes` (One-to-Many / 1:N):**
  A single user can create zero, one, or many notes. Every note must belong to exactly one user (`notes.user_id`). If a user deletes their account, all associated notes cascade-delete automatically.
- **`users` to `tags` (One-to-Many / 1:N):**
  Tags are scoped per user to give users complete autonomy over their vocabulary without cross-tenant collisions. One user can own multiple unique tags.
- **`notes` to `tags` (Many-to-Many / M:N via `note_tags`):**
  A note can have multiple tags (e.g., `#meeting`, `#architecture`, `#work`), and a single tag can be referenced across multiple notes. In relational database theory, storing multi-valued tags in a single column violates First Normal Form (1NF). The junction table `note_tags` decomposes this M:N relationship into two clean 1:N relationships (`notes -> note_tags` and `tags -> note_tags`), enforcing referential integrity and supporting high-performance index lookups.

---

## 3. DDL: CREATE TABLE Statements

The following DDL statements define the QuickNotes database schema (compatible with SQLite and PostgreSQL):

```sql
-- Enable foreign key constraint checking (SQLite)
PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Table
CREATE TABLE notes (
    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. Tags Table (User-Scoped)
CREATE TABLE tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

-- 4. Note_Tags Junction Table
CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);
```

---

## 4. Example SQL Queries

### Query 1: List All Notes for a User with Aggregated Tags (JOIN + GROUP BY)
Retrieves the user's notes sorted with pinned notes first, then latest updated notes, aggregating comma-separated tag names.

```sql
SELECT
    n.note_id,
    n.title,
    n.body,
    n.is_pinned,
    n.updated_at,
    COALESCE(GROUP_CONCAT(t.name, ', '), '') AS tags
FROM notes n
LEFT JOIN note_tags nt ON n.note_id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.tag_id
WHERE n.user_id = 1
GROUP BY n.note_id, n.title, n.body, n.is_pinned, n.updated_at
ORDER BY n.is_pinned DESC, n.updated_at DESC
LIMIT 10 OFFSET 0;
```

---

### Query 2: Filter Notes by a Specific Tag (Multi-Table JOIN)
Retrieves all notes created by a user that are tagged with `'architecture'`.

```sql
SELECT
    n.note_id,
    n.title,
    n.body,
    n.updated_at,
    t.name AS tag_name
FROM notes n
JOIN note_tags nt ON n.note_id = nt.note_id
JOIN tags t ON nt.tag_id = t.tag_id
WHERE n.user_id = 1
  AND t.name = 'architecture'
ORDER BY n.updated_at DESC;
```

---

### Query 3: Search Notes by Keyword Across Title and Body
Performs text search across a user's notes matching a keyword like `'database'`.

```sql
SELECT
    note_id,
    title,
    body,
    updated_at
FROM notes
WHERE user_id = 1
  AND (title LIKE '%database%' OR body LIKE '%database%')
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 5. Indexes and Performance Optimization

```sql
-- 1. Composite Index for User Note Feeds
CREATE INDEX idx_notes_user_updated ON notes(user_id, is_pinned DESC, updated_at DESC);

-- 2. Reverse Lookup Index for Tag Filtering
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);

-- 3. Lookup Index for Tag Names
CREATE INDEX idx_tags_user_name ON tags(user_id, name);
```

### Justification:
- **`idx_notes_user_updated`**: The single most frequent read operation in QuickNotes is displaying a user's notes list (`WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC`). Without this index, the database must perform a full table scan over millions of notes across all users and run an in-memory filesort. This composite B-tree index narrows the search instantly to rows belonging to `user_id` and reads them sequentially in pre-sorted order, reducing query latency from $O(N)$ to $O(\log N)$.
- **`idx_note_tags_tag_id`**: In `note_tags`, the composite primary key `(note_id, tag_id)` implicitly indexes queries starting with `note_id`. However, queries filtering notes by tag (`JOIN note_tags ON t.tag_id = nt.tag_id`) filter by `tag_id`. Adding an index on `tag_id` allows reverse lookups without a full table scan of the junction table.

---

## 6. SQL vs. NoSQL Justification

For the QuickNotes production backend, a **relational SQL database (such as PostgreSQL)** was chosen over a NoSQL document database (such as MongoDB). 

### Rationale:
1. **Strict Referential Integrity & Cascades:** QuickNotes features strict relational ownership between users, notes, and tags. Relational foreign key constraints with `ON DELETE CASCADE` guarantee that deleting a note or a user automatically removes orphaned entries in `note_tags` and `notes` at the storage layer without relying on fragile application-level cleanup logic.
2. **Normalized Tag Sharing:** In a NoSQL document store, tags would typically be embedded as an array of strings inside each note document. While embedding simplifies simple writes, renaming or querying tags across an entire user account requires costly multi-document scans and updates, risking data divergence. A normalized SQL schema manages tags independently while maintaining $O(1)$ updates.
3. **ACID Transaction Guarantees:** Note editing, tag assignments, and pin states require atomic transactions to ensure consistent state during concurrent user actions (e.g., syncing across multiple devices).
4. **Scale Profile Compatibility:** At 1 million users, total relational metadata consumes less than 15 GB, which fits easily into memory on a single modern relational database instance paired with read replicas. The horizontal partitioning benefits of NoSQL are unneeded for this workload, while SQL provides vastly superior data integrity, query expressiveness, and developer ergonomics.
