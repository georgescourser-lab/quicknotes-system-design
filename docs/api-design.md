# QuickNotes REST API Specification

This document defines the production REST API specification for the **QuickNotes** cloud service. It serves as the engineering contract between the frontend client applications and the backend engineering team.

---

## 1. Overview & Conventions

- **Base URL:** `https://api.quicknotes.io/v1`
- **Protocol:** HTTPS only (TLS 1.3)
- **Data Format:** JSON (`Content-Type: application/json; charset=utf-8`)
- **Authentication:** Bearer token (JWT) passed in the `Authorization` header (`Authorization: Bearer <jwt_token>`).
- **Date & Time:** ISO 8601 UTC format (`YYYY-MM-DDTHH:MM:SSZ`).
- **Pagination:** Cursor or offset-based via `page` and `limit` query parameters.

---

## 2. API Endpoints

The QuickNotes backend exposes the following RESTful endpoints:

| HTTP Method | Endpoint Path | Description | Success Status | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **`GET`** | `/api/v1/notes` | Retrieves a paginated list of notes owned by the authenticated user. Supports filtering by tag (`?tag=work`) and search keyword (`?q=meeting`). | `200 OK` | Yes |
| **`POST`** | `/api/v1/notes` | Creates a new note for the authenticated user. | `201 Created` | Yes |
| **`GET`** | `/api/v1/notes/{id}` | Retrieves a single note by its unique identifier. | `200 OK` | Yes |
| **`PUT`** | `/api/v1/notes/{id}` | Updates an existing note's title, body, or attached tags. | `200 OK` | Yes |
| **`DELETE`** | `/api/v1/notes/{id}` | Permanently removes a note owned by the authenticated user. | `204 No Content` | Yes |
| **`GET`** | `/api/v1/tags` | Lists all distinct tags created and used across the authenticated user's notes. | `200 OK` | Yes |
| **`POST`** | `/api/v1/auth/login` | Authenticates user credentials (email & password) and returns an access token. | `200 OK` | No |

---

## 3. Request & Response Examples

### A. Create a Note (`POST /api/v1/notes`)

Creates a new note with a title, optional markdown body, and optional category tags.

#### Request Example
```http
POST /api/v1/notes HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json; charset=utf-8

{
  "title": "System Design Architecture Meeting",
  "body": "Discussed migrating QuickNotes from local state to a distributed cloud architecture with Redis caching and read replicas.",
  "tags": ["architecture", "engineering", "work"]
}
```

#### Response Example
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/v1/notes/1042

{
  "id": 1042,
  "user_id": 482,
  "title": "System Design Architecture Meeting",
  "body": "Discussed migrating QuickNotes from local state to a distributed cloud architecture with Redis caching and read replicas.",
  "tags": ["architecture", "engineering", "work"],
  "created_at": "2026-10-28T07:30:00Z",
  "updated_at": "2026-10-28T07:30:00Z"
}
```

---

### B. List Notes (`GET /api/v1/notes`)

Returns a paginated list of notes owned by the authenticated user, ordered by `updated_at` descending.

#### Request Example
```http
GET /api/v1/notes?page=1&limit=2 HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Response Example
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "data": [
    {
      "id": 1042,
      "user_id": 482,
      "title": "System Design Architecture Meeting",
      "body": "Discussed migrating QuickNotes from local state to a distributed cloud architecture with Redis caching and read replicas.",
      "tags": ["architecture", "engineering", "work"],
      "created_at": "2026-10-28T07:30:00Z",
      "updated_at": "2026-10-28T07:30:00Z"
    },
    {
      "id": 1039,
      "user_id": 482,
      "title": "Grocery List",
      "body": "- Oat milk\n- Espresso roast\n- Sourdough loaf",
      "tags": ["personal"],
      "created_at": "2026-10-27T18:15:00Z",
      "updated_at": "2026-10-27T18:20:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "limit": 2,
    "total_records": 18,
    "total_pages": 9,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 4. Error Status Codes and Error Body Specification

When an error occurs, the API returns an appropriate HTTP status code along with a standardized JSON error envelope providing human-readable context and machine-readable error codes.

### Error Envelope Schema
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human-readable summary of the error.",
    "details": [
      {
        "field": "title",
        "issue": "Specific explanation of what failed."
      }
    ],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```

### Supported Error Codes

| Status Code | Reason | Cause / Scenario | Example Response Body |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | Validation Failure | Client sent malformed JSON, missing mandatory fields (e.g., missing title), or exceeding constraints (e.g., title > 100 characters). | See Example 1 below |
| **`401 Unauthorized`** | Authentication Missing or Expired | The request lacks an `Authorization` header, the JWT token is expired, or the signature is invalid. | See Example 2 below |
| **`403 Forbidden`** | Authorization Refused | The user is authenticated, but attempts to read, modify, or delete a note belonging to another user. | See Example 3 below |
| **`404 Not Found`** | Resource Missing | The requested resource (e.g., `/api/v1/notes/99999`) does not exist or has been deleted. | See Example 4 below |
| **`500 Internal Server Error`** | Server / Infrastructure Failure | An unhandled runtime exception, database timeout, or upstream network failure occurred on the server. | See Example 5 below |

---

### Concrete Error Response Examples

#### Example 1: `400 Bad Request` (Validation Error)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body failed schema validation.",
    "details": [
      {
        "field": "title",
        "issue": "Title is required and must not exceed 100 characters."
      }
    ],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```

#### Example 2: `401 Unauthorized` (Token Missing or Expired)
```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Authentication required. Your access token has expired or is invalid.",
    "details": [],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```

#### Example 3: `403 Forbidden` (Access Denied)
```json
{
  "error": {
    "code": "FORBIDDEN_ACCESS",
    "message": "You do not have permission to access or modify this note.",
    "details": [],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```

#### Example 4: `404 Not Found` (Note Does Not Exist)
```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "No note found with ID 99999.",
    "details": [],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```

#### Example 5: `500 Internal Server Error` (Server Failure)
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred while processing your request. Please try again later.",
    "details": [],
    "timestamp": "2026-10-28T07:30:00Z"
  }
}
```
