# QuickNotes Cloud Architecture & System Design Plan

## 1. System Requirements

### Functional Requirements
- **Core Note CRUD:** Users can create, view, update, and delete text notes with titles (max 100 chars), rich bodies, and organization tags.
- **Search & Filtering:** Users can list notes with pagination, filter by tag, search by keyword, and pin important notes to the top.
- **Multi-Device Synchronization:** Notes are synchronized across web and mobile clients with atomic guarantees.
- **Security & Authorization:** Strict tenant isolation; users can only access their own notes via JWT authentication.

### Non-Functional Requirements
- **Availability:** 99.95% uptime SLA (less than 4.38 hours of downtime per year).
- **Latency:** Sub-50ms latency for read requests; sub-100ms for write requests under normal load.
- **Scalability:** System horizontally scales to support 1 million registered users and peak traffic surges (5× average).
- **Data Durability:** Zero data loss for committed notes through continuous write-ahead log (WAL) archiving and multi-AZ database replication.
- **Fault Tolerance:** No single points of failure (SPOF); automatic failover across all application, caching, and database tiers.

---

## 2. Load & Storage Estimates (1 Million Users)

### Baseline Assumptions
- **Total Registered Users:** 1,000,000 users.
- **Daily Active Users (DAU):** 20% active daily = **200,000 DAU**.
- **User Activity Per Day:**
  - Each active user creates or edits **2 notes per day**.
  - Each active user views/refreshes their notes feed **20 times per day**.
- **Peak Multiplier:** 5× average traffic to handle peak morning and evening usage.
- **Average Note Size:**
  - Title: ~50 bytes (max 100 bytes).
  - Body: ~1,000 bytes (1 KB).
  - Metadata & Tags: ~250 bytes.
  - Total per note: $\approx 1.3\text{ KB}$.

---

### A. Writes Per Second (Uploads / Updates)
- **Daily Writes:**
  $$\text{Daily Writes} = 200,000 \text{ DAU} \times 2 \text{ writes/day} = 400,000 \text{ write requests/day}$$
- **Average Writes Per Second:**
  $$\text{Avg Writes/sec} = \frac{400,000}{86,400 \text{ seconds}} \approx 4.63 \text{ writes/sec} \ (\approx 5 \text{ writes/sec})$$
- **Peak Writes Per Second (5× Multiplier):**
  $$\text{Peak Writes/sec} = 4.63 \times 5 \approx 23.15 \text{ writes/sec} \ (\approx 25 \text{ writes/sec})$$

---

### B. Reads Per Second (Feed Views / Searches)
- **Daily Reads:**
  $$\text{Daily Reads} = 200,000 \text{ DAU} \times 20 \text{ reads/day} = 4,000,000 \text{ read requests/day}$$
- **Average Reads Per Second:**
  $$\text{Avg Reads/sec} = \frac{4,000,000}{86,400 \text{ seconds}} \approx 46.30 \text{ reads/sec} \ (\approx 47 \text{ reads/sec})$$
- **Peak Reads Per Second (5× Multiplier):**
  $$\text{Peak Reads/sec} = 46.30 \times 5 \approx 231.50 \text{ reads/sec} \ (\approx 235 \text{ reads/sec})$$

---

### C. Storage Growth Per Year
- **New Notes Per Day:** $200,000 \text{ DAU} \times 1 \text{ new note} = 200,000 \text{ notes/day}$.
- **Daily Raw Storage:**
  $$200,000 \text{ notes} \times 1.3\text{ KB} = 260,000\text{ KB} = 260\text{ MB/day} = 0.26\text{ GB/day}$$
- **Annual Raw Storage (365 days):**
  $$0.26\text{ GB/day} \times 365\text{ days} \approx 94.9\text{ GB/year}$$
- **Total Storage with Indexes and Overheads ($2\times$ safety factor):**
  $$\text{Total Annual Storage} \approx 94.9\text{ GB} \times 2 \approx \mathbf{190\text{ GB/year}}$$
  *Conclusion:* Because annual data volume is under 200 GB, the entire database working set fits comfortably in high-performance NVMe SSD storage and server RAM, confirming that a normalized relational database (PostgreSQL) is extraordinarily cost-effective and performant.

---

## 3. High-Level Architecture Diagram

```
                              +--------------------------+
                              |   Client Applications    |
                              |  (Web Browser / Mobile)  |
                              +-------------+------------+
                                            |
                                            | 1. DNS Resolution
                                            v
                              +--------------------------+
                              |      DNS (Route 53)      |
                              +-------------+------------+
                                            |
                        +-------------------+-------------------+
                        | (Static Assets)                       | (API Traffic)
                        v                                       v
              +-------------------+                   +-------------------+
              |    Global CDN     |                   |   Load Balancer   |
              | (Cloudflare/CF)   |                   | (NGINX / AWS ALB) |
              +-------------------+                   +---------+---------+
                                                                |
                                             +------------------+------------------+
                                             |                                     |
                                             v                                     v
                                   +-------------------+                 +-------------------+
                                   |   App Server 1    |                 |   App Server 2    |
                                   | (Node / Express)  |                 | (Node / Express)  |
                                   +----+---------+----+                 +----+---------+----+
                                        |         |                           |         |
                                        |         +-------------+-------------+         |
                                        |                       |                       |
                                        v                       v                       v
                              +-------------------+   +-------------------+   +-------------------+
                              |   Redis Cache     |   |   Message Queue   |   |   Database Tier   |
                              | (User Note Feeds) |   | (RabbitMQ / SQS)  |   |                   |
                              +-------------------+   +---------+---------+   | +---------------+ |
                                                                |             | |  Primary DB   | |
                                                                v             | |   (Writes)    | |
                                                      +-------------------+   | +-------+-------+ |
                                                      | Background Worker |   |         | Replic. |
                                                      | (Search/Indexing/ |   |         v         |
                                                      |  Email Reminders) |   | +---------------+ |
                                                      +-------------------+   | | Read Replica  | |
                                                                              | |    (Reads)    | |
                                                                              | +---------------+ |
                                                                              +-------------------+
```

---

## 4. Component Explanations (One Sentence Each)

- **DNS (Domain Name System):** Resolves the QuickNotes host domain to geographic IP addresses using latency-based routing and health checks to guide clients to available infrastructure.
- **CDN (Content Delivery Network):** Caches static application assets (HTML, CSS, JavaScript bundles) at globally distributed edge nodes to ensure sub-second initial page load times and shield origin servers from static file requests.
- **Load Balancer:** Distributes incoming HTTPS API requests evenly across redundant application servers using least-connections routing, terminating SSL certificates and handling traffic spikes.
- **App Server 1 & App Server 2:** Run stateless application business logic, validate incoming requests, authenticate JWT security credentials, and orchestrate queries between the cache, database, and background queues.
- **Cache (Redis):** Stores active user sessions, recently queried note lists, and tag counts in RAM to deliver sub-millisecond read responses and protect database replicas from repetitive query load.
- **Primary Database (PostgreSQL Primary):** Serves as the authoritative source of truth for all transactional write operations (creating, editing, and deleting notes) and replicates updates to read replicas.
- **Read Replica (PostgreSQL Replica):** Handles read-only queries for user feeds, pagination, and note searches, scaling read capacity horizontally and preventing heavy queries from slowing down write transactions.
- **Message Queue (RabbitMQ / AWS SQS):** Decouples time-consuming background operations from user-facing API request threads by buffering asynchronous tasks in a durable queue.
- **Worker:** Consumes queued background tasks asynchronously to perform search index updates, send reminder emails, and calculate user productivity analytics without blocking API clients.

---

## 5. Step-by-Step Request Flows

### A. Flow of `GET /notes` (Listing Notes)

```
Client         Load Balancer       App Server           Redis Cache         Read Replica DB
  |                  |                  |                    |                     |
  | 1. GET /notes    |                  |                    |                     |
  |----------------->|                  |                    |                     |
  |                  | 2. Route request |                    |                     |
  |                  |----------------->|                    |                     |
  |                  |                  | 3. Check cache     |                     |
  |                  |                  |------------------->|                     |
  |                  |                  | 4. Cache Miss      |                     |
  |                  |                  |<-------------------|                     |
  |                  |                  | 5. Query user notes|                     |
  |                  |                  |----------------------------------------->|
  |                  |                  | 6. Return notes rows                     |
  |                  |                  |<-----------------------------------------|
  |                  |                  | 7. Set cache (TTL) |                     |
  |                  |                  |------------------->|                     |
  |                  | 8. 200 OK (JSON) |                    |                     |
  |                  |<-----------------|                    |                     |
  | 9. Render Feed   |                  |                    |                     |
  |<-----------------|                  |                    |                     |
```

1. **Request Dispatch:** The client browser sends an authenticated `GET /api/v1/notes?page=1&limit=10` request with a Bearer JWT header.
2. **Load Distribution:** The Load Balancer performs TLS termination and forwards the request to an available App Server.
3. **Authentication & Cache Inspection:** The App Server validates the JWT signature, extracts `user_id`, and queries Redis for the cache key `user:{user_id}:notes:page:1`.
4. **Cache Hit Path:** If present in Redis, the App Server immediately returns the cached JSON payload, completing the request in under 15ms.
5. **Cache Miss Path:** If the cache key is missing or expired, the App Server queries the **Database Read Replica** using indexed pagination (`WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC LIMIT 10`).
6. **Cache Rehydration:** The App Server writes the fetched notes array into Redis with a 5-minute Time-To-Live (TTL).
7. **Client Response:** The App Server returns `HTTP 200 OK` with the JSON notes array to the client.

---

### B. Flow of `POST /notes` (Creating a Note)

```
Client         Load Balancer       App Server           Primary DB          Redis Cache       Message Queue
  |                  |                  |                    |                   |                  |
  | 1. POST /notes   |                  |                    |                   |                  |
  |----------------->|                  |                    |                   |                  |
  |                  | 2. Route request |                    |                   |                  |
  |                  |----------------->|                    |                   |                  |
  |                  |                  | 3. Validate input  |                   |                  |
  |                  |                  | 4. Insert note row |                   |                  |
  |                  |                  |------------------->|                   |                  |
  |                  |                  | 5. Return note_id  |                   |                  |
  |                  |                  |<-------------------|                   |                  |
  |                  |                  | 6. Invalidate feed |                   |                  |
  |                  |                  |--------------------------------------->|                  |
  |                  |                  | 7. Enqueue index job                   |                  |
  |                  |                  |---------------------------------------------------------->|
  |                  | 8. 201 Created   |                    |                   |                  |
  |                  |<-----------------|                    |                   |                  |
  | 9. Prepend Note  |                  |                    |                   |                  |
  |<-----------------|                  |                    |                   |                  |
```

1. **Submission:** The user submits a note title (e.g., "Architecture Plan") and body via `POST /api/v1/notes`.
2. **Routing & Authentication:** The Load Balancer passes the payload to an App Server, which authenticates the JWT.
3. **Payload Validation:** The App Server validates that `title` is present, non-blank, and does not exceed 100 characters.
4. **Transactional Write:** The App Server initiates a write transaction on the **Primary Database**, inserting the record into the `notes` table and linking any associated tags in `note_tags`.
5. **Cache Invalidation:** To prevent stale reads, the App Server evicts or updates the cached feed keys in Redis (`user:{user_id}:notes:*`).
6. **Asynchronous Job Enqueue:** The App Server emits a message (`{note_id, action: "NOTE_CREATED"}`) to the Message Queue so background workers can update full-text search indexes or sync analytics.
7. **Immediate Response:** The App Server returns `HTTP 201 Created` with the newly assigned `note_id` and timestamp directly to the client.

---

## 6. Architectural Trade-Offs

### Trade-Off 1: Cache-Aside with Invalidation vs. Write-Through Caching
- **Decision:** **Cache-Aside with Explicit Invalidation on Write.**
- **Rationale:** 
  - *Advantage:* In Cache-Aside, only notes belonging to actively browsing users are loaded into Redis, keeping memory consumption extremely compact and avoiding caching dormant data from inactive accounts.
  - *Disadvantage:* The first read after a write or cache eviction experiences a slight cache miss penalty while querying the read replica.
  - *Mitigation:* Explicit key invalidation on `POST`/`PUT`/`DELETE` combined with a 5-minute TTL guarantees that users always read their own latest edits without risking stale data divergence.

### Trade-Off 2: Read Replica Replication Lag vs. Read-Your-Writes Consistency
- **Decision:** **Route writes and immediate post-write reads to Primary; route general browsing to Read Replica.**
- **Rationale:**
  - *Advantage:* Offloading general feed pagination and searches to the read replica prevents read traffic from exhausting I/O on the primary database instance.
  - *Disadvantage:* Asynchronous replication from Primary to Replica incurs a 10–50ms replication lag. If a user immediately refreshes their feed after creating a note, the replica might not have applied the replication WAL record yet.
  - *Mitigation:* The frontend application immediately prepends newly created notes to local state upon receiving the `HTTP 201 Created` response. If a full refresh is requested within 5 seconds of a write, the app server routes the query to the Primary DB or reads directly from the freshly populated Redis cache.

---

## 7. Avoiding Single Points of Failure (SPOF)

To satisfy the 99.95% availability SLA, every layer in the QuickNotes architecture is redundant and automated for instant failover:

1. **DNS & Edge Resilience:** Amazon Route 53 utilizes globally distributed Anycast DNS servers with automated health checks. If an entire cloud region suffers an outage, DNS traffic fails over to a secondary region.
2. **Load Balancer Redundancy:** Cloud Load Balancers (AWS Application Load Balancer / NGINX Plus) run in an active-active configuration across multiple Availability Zones (AZs) with automatic health probes.
3. **Stateless App Servers:** Application servers maintain zero persistent in-memory session state (sessions reside in Redis, and auth tokens are stateless JWTs). If App Server 1 crashes, the Load Balancer instantly routes all traffic to App Server 2 without dropping user sessions. An Auto-Scaling Group dynamically launches replacement instances.
4. **Redis Cache High Availability:** Redis is deployed as a Multi-AZ cluster using Redis Sentinel or AWS ElastiCache with automatic primary-replica failover. If the Redis primary fails, a replica is promoted within 5 seconds. If Redis goes completely offline, the system gracefully degrades by querying the read replica directly.
5. **Database High Availability (Multi-AZ Primary & Standby):** The PostgreSQL database is configured with synchronous physical replication to a hot standby in an alternate AZ and asynchronous replication to read replicas. If the primary database hardware fails, automated health checks trigger a standby promotion in under 60 seconds without data loss.
6. **Resilient Queues & Workers:** Message brokers (RabbitMQ/SQS) persist messages to durable disk storage. Workers operate in a stateless worker pool. If a worker process crashes mid-task, unacknowledged messages automatically re-enter the queue, while poisoned messages are directed to a Dead-Letter Queue (DLQ) after 3 retry attempts.
