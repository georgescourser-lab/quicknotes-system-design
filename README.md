# QuickNotes: System Design & API Client

Welcome to the **QuickNotes System Design & API Client** repository. This project is the capstone engineering delivery transitioning QuickNotes from a browser-only client into a scalable, enterprise-grade cloud service engineered for over 1 million users.

---

## 📖 Project Overview

QuickNotes provides a clean, responsive note-taking interface backed by a distributed cloud architecture. The deliverables in this repository consist of:

1. **Production-Ready Frontend API Client:** An interactive, accessible web application (`index.html`, `style.css`, `api.js`) demonstrating full CRUD operations (`GET`, `POST`, `DELETE`) with robust input validation, status management, error handling, and XSS prevention.
2. **System Design & Architecture Documentation:** Three engineering specifications located in the `docs/` directory guiding backend engineering teams on API contracts, database modeling, and cloud infrastructure scaling.

---

## 🚀 How to Run the API Client

The frontend client is built with vanilla HTML5, CSS3, and JavaScript, requiring zero external build tools or dependencies.

### Option 1: Using Python's Built-in HTTP Server (Recommended)
Open a terminal in this repository's root folder and run:

```bash
# Python 3
python -m http.server 8000
```
Then navigate your browser to:
```
http://localhost:8000/
```

### Option 2: Using Node.js `npx serve` or `http-server`
```bash
npx serve .
```

### Option 3: Direct Browser File Access
Double-click `index.html` to open it directly in Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari.

---

## 🛠 Features & Client Verification

- **GET (Load Notes):** Fetches the first 10 notes from the server (`https://jsonplaceholder.typicode.com/posts?_limit=10`), showing an active loading state (`"Loading notes..."`) while disabling buttons to prevent duplicate requests.
- **POST (Create Note):** Enforces client-side validation (title is mandatory and capped at 100 characters; body is optional). Submits the payload and prepends the newly created note to the top of the feed, displaying HTTP status `201` and the newly assigned `id`.
- **DELETE (Remove Note):** Each note has a Delete button that dispatches `DELETE /posts/{id}` and removes the note element from the DOM with status updates.
- **Four Distinct States:** Gracefully transitions between **Loading**, **Success**, **Error**, and **Empty** states with dedicated visual banners.
- **XSS Protection:** All user-provided strings are injected strictly through `.textContent`.

---

## 📚 System Design Documentation

Detailed engineering specifications are available in the [`docs/`](docs/) directory:

1. [**API Design Specification (`docs/api-design.md`)**](docs/api-design.md)  
   Covers 7 RESTful endpoints, request/response JSON schemas, pagination parameters, and standardized HTTP error codes (`400`, `401`, `403`, `404`, `500`).

2. [**Data Model Specification (`docs/data-model.md`)**](docs/data-model.md)  
   Details the 4 relational entities (`users`, `notes`, `tags`, `note_tags`), 1:N and M:N relationships, SQL DDL statements, indexes, example queries with `JOIN` and `GROUP BY`, and an architectural justification for choosing SQL over NoSQL.

3. [**Cloud Architecture & Scaling Plan (`docs/architecture.md`)**](docs/architecture.md)  
   Contains functional/non-functional requirements, traffic/storage calculations for 1,000,000 users, an ASCII architecture diagram (DNS, CDN, Load Balancer, App Servers, Redis Cache, Primary DB with Read Replica, Queue, and Worker), component descriptions, detailed request flows for `GET` and `POST`, and trade-offs resolving single points of failure (SPOF).

---

## 💡 What I Learned

Through researching, designing, and building this capstone project:

1. **Designing for Read-Heavy Asymmetry:** Calculating capacity estimates for 1 million users highlighted how dramatically real-world web apps skew towards reads ($\approx 47$ to $235$ reads/sec vs. $5$ to $25$ writes/sec). This reinforced the necessity of decoupling read throughput (via Redis cache-aside and PostgreSQL read replicas) from transactional write integrity.
2. **Relational Junction Normalization vs. Document Denormalization:** Modeling tags through the associative table `note_tags` demonstrated how SQL enforces referential integrity with cascading deletes at the database engine level, preventing orphan tags and update anomalies that frequently plague unnormalized document stores.
3. **Resilient Asynchronous Request Decoupling:** Integrating message queues (e.g., RabbitMQ/SQS) and background workers separates expensive tasks (full-text search indexing, thumbnail generation, email dispatch) from user-facing API threads, ensuring sub-100ms user response times while preventing server CPU exhaustion.
4. **Defensive API Client Engineering:** Building reusable fetch wrappers with rigorous status code inspection, try/catch/finally blocks, and safe `.textContent` DOM insertion guarantees resilience against malformed network responses, server errors, and cross-site scripting (XSS) vulnerabilities.
