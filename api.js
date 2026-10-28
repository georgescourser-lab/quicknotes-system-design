// QuickNotes API Client
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// DOM References
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
const notesList = document.getElementById("notes-list");

/**
 * Reusable async request function that calls fetch, checks response.ok,
 * and throws descriptive errors on non-2xx responses.
 *
 * @param {string} url - Target URL
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<{status: number, data: any}>}
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const err = await response.json();
      if (err && err.message) message = err.message;
    } catch {
      // Fallback to statusText
    }
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  if (response.status === 204) {
    return { status: response.status, data: null };
  }

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Updates the status message banner with distinct types (loading, success, error).
 * Always sets text using textContent to prevent XSS.
 *
 * @param {string} message - Text message
 * @param {"loading"|"success"|"error"|""} [type=""] - Status type
 */
function setStatus(message, type = "") {
  if (!message) {
    statusEl.textContent = "";
    statusEl.className = "";
    return;
  }
  statusEl.textContent = message;
  statusEl.className = `visible ${type}`;
}

/**
 * Creates a note DOM element using textContent only for user-provided data.
 *
 * @param {{id: number|string, title: string, body?: string}} note
 * @returns {HTMLLIElement}
 */
function createNoteElement(note) {
  const li = document.createElement("li");
  li.className = "note-item";
  li.dataset.id = String(note.id);

  const header = document.createElement("div");
  header.className = "note-header";

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = note.title;

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const idBadge = document.createElement("span");
  idBadge.className = "note-id";
  idBadge.textContent = `#${note.id}`;

  actions.appendChild(idBadge);
  header.appendChild(title);
  header.appendChild(actions);
  li.appendChild(header);

  if (note.body) {
    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body;
    li.appendChild(body);
  }

  return li;
}

/**
 * Displays an empty-state message inside the notes list.
 */
function renderEmptyState() {
  notesList.innerHTML = "";
  const li = document.createElement("li");
  li.className = "empty-state";
  li.textContent = "No notes available. Click 'Load notes' or create one above.";
  notesList.appendChild(li);
}

/**
 * Task 1: Load 10 notes via GET.
 */
async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "loading");

  try {
    const res = await request(`${API_URL}?_limit=10`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const notes = res.data;
    notesList.innerHTML = "";

    if (!Array.isArray(notes) || notes.length === 0) {
      renderEmptyState();
      setStatus("Loaded 0 notes from the server.", "success");
      return;
    }

    notes.forEach((note) => {
      notesList.appendChild(createNoteElement(note));
    });

    setStatus("Loaded 10 notes from the server.", "success");
  } catch (error) {
    console.error("Load notes error:", error);
    setStatus(`Failed to load notes: ${error.message}`, "error");
  } finally {
    loadBtn.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener("click", loadNotes);
