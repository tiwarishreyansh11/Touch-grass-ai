import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels = false;

const $ = id => document.getElementById(id);
const STORAGE_KEY = "touchgrass-green-v1";

const missions = [
  {
    id: "walk",
    emoji: "🚶",
    title: "Mindful wander",
    description: "Take a safe 10-minute walk and notice three things around you.",
    xp: 30
  },
  {
    id: "leaves",
    emoji: "🍃",
    title: "Leaf collector",
    description: "Find three different leaf shapes and compare their patterns.",
    xp: 25
  },
  {
    id: "birds",
    emoji: "🐦",
    title: "Birdwatch break",
    description: "Spend five minutes quietly noticing birds or listening to their calls.",
    xp: 40
  },
  {
    id: "sky",
    emoji: "☁️",
    title: "Sky watcher",
    description: "Look up and notice the clouds, colors, or changing light.",
    xp: 20
  },
  {
    id: "plant",
    emoji: "🌱",
    title: "Meet a plant",
    description: "Observe a nearby plant without picking or damaging it.",
    xp: 25
  },
  {
    id: "planet",
    emoji: "🌍",
    title: "Earth-friendly act",
    description: "Choose one small way to reduce waste or care for your surroundings.",
    xp: 35
  }
];

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

const data = loadData();
data.xp ??= 0;
data.completed ??= {};
data.journal ??= [];
data.streak ??= 0;
data.lastVisit ??= "";

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = localDate();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    $("status").textContent =
      "Browser storage is unavailable; progress may not be saved.";
  }
}

function updateStreak() {
  if (data.lastVisit !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    data.streak = data.lastVisit === localDate(yesterday)
      ? data.streak + 1
      : 1;

    data.lastVisit = today;
    saveData();
  }
}

function renderStats() {
  $("xp").innerHTML = `${data.xp} <small>XP</small>`;
  $("completed").textContent = Object.values(data.completed)
    .reduce((sum, list) => sum + list.length, 0);
  $("streak").textContent = data.streak;
}

function renderMissions() {
  const doneToday = data.completed[today] || [];

  $("missionGrid").innerHTML = missions.map(m => {
    const done = doneToday.includes(m.id);

    return `
      <article class="mission-card">
        <div class="mission-emoji">${m.emoji}</div>
        <h3>${m.title}</h3>
        <p>${m.description}</p>
        <div class="mission-bottom">
          <span class="xp-tag">+${m.xp} XP</span>
          <button class="complete-btn ${done ? "done" : ""}"
            data-id="${m.id}" ${done ? "disabled" : ""}>
            ${done ? "✓ Completed" : "Complete +"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

$("missionGrid").addEventListener("click", event => {
  const button = event.target.closest("[data-id]");
  if (!button) return;

  const mission = missions.find(m => m.id === button.dataset.id);
  if (!mission) return;

  data.completed[today] ??= [];
  if (data.completed[today].includes(mission.id)) return;

  data.completed[today].push(mission.id);
  data.xp += mission.xp;

  saveData();
  renderMissions();
  renderStats();
});

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function renderJournal() {
  const root = $("journalEntries");

  if (!data.journal.length) {
    root.innerHTML =
      '<p class="empty-journal">Your outdoor memories will appear here 🌿</p>';
    return;
  }

  root.innerHTML = data.journal.map(entry => `
    <article class="journal-entry">
      <span>🌿 ${escapeHTML(entry.text)}</span>
      <time>${escapeHTML(entry.date)}</time>
    </article>
  `).join("");
}

$("journalForm").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("journalInput");
  const text = input.value.trim();
  if (!text) return;

  data.journal.unshift({
    text,
    date: new Date().toLocaleDateString()
  });

  data.journal = data.journal.slice(0, 50);
  saveData();
  renderJournal();
  input.value = "";
});

// Open-weight image classification using Transformers.js
let classifier;
let photoURL;
let busy = false;

$("photo").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    $("status").textContent = "Please choose an image file.";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    $("status").textContent = "Please select an image smaller than 10 MB.";
    return;
  }

  if (photoURL) URL.revokeObjectURL(photoURL);
  photoURL = URL.createObjectURL(file);

  $("preview").src = photoURL;
  $("previewArea").hidden = false;
  $("results").hidden = true;
  $("status").textContent = "Photo ready. Click Analyze with AI.";
});

$("analyze").addEventListener("click", async () => {
  if (!photoURL || busy) return;

  busy = true;
  $("analyze").disabled = true;
  $("results").hidden = true;

  try {
    $("status").textContent =
      "Loading the AI model. The first download can take some time.";

    if (!classifier) {
      classifier = await pipeline(
        "image-classification",
        "Xenova/vit-base-patch16-224"
      );
    }

    $("status").textContent = "Analyzing your image...";

    const results = await classifier(photoURL, { top_k: 5 });

    $("results").innerHTML = `
      <h3>🔎 AI predictions</h3>
      <p>These are general image categories, not guaranteed species identification.</p>
      ${results.map(result => {
        const score = Math.round(result.score * 100);
        return `
          <div class="result-row">
            <span>${escapeHTML(result.label)}</span>
            <strong>${score}%</strong>
          </div>
          <div class="bar">
            <div style="width:${score}%"></div>
          </div>
        `;
      }).join("")}
    `;

    $("results").hidden = false;
    $("status").textContent =
      "Analysis complete. Your image was processed in the browser.";
  } catch (error) {
    console.error(error);
    $("status").textContent =
      "Could not load the AI model. Check your internet and try again.";
  } finally {
    busy = false;
    $("analyze").disabled = false;
  }
});

updateStreak();
renderStats();
renderMissions();
renderJournal();
saveData();