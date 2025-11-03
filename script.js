/* ================================================================
   FINAL script.js — Complete Nivra dashboard & shared UI logic
   - Mood selection + randomized mood lines
   - Journal save (Enter to save, Shift+Enter newline)
   - Chart.js setup + updates
   - Streak logic (persistent, increments once per day on first save)
   - UI microinteractions: loading states, subtle entrance animations
   - Small inline layout fixes (applied by JS) so you don't need CSS overrides
   - Exposes window.selectMood() and window.saveEntry() for inline onclick handlers
   ================================================================= */

(function () {
  "use strict";

  /* -------------------------
     Helpers & safe query
     ------------------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Safe get by many possible ids/names
  function findOne(ids) {
    for (const id of ids) {
      const el = $(id);
      if (el) return el;
    }
    return null;
  }

  // Date helpers
  const todayDateString = () => new Date().toDateString();
  const shortDateLabel = (d = new Date()) => {
    try {
      return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } catch (e) {
      return String(d);
    }
  };
  const prettyFullDate = (d = new Date()) =>
    new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  // Trim array to last max items
  function trimToMax(arr, max = 120) {
    if (!Array.isArray(arr)) return arr;
    if (arr.length <= max) return arr;
    return arr.slice(Math.max(0, arr.length - max));
  }

  /* -------------------------
     LocalStorage keys & load
     ------------------------- */
  const KEY_ENTRIES = "nivra_entries";
  const KEY_LABELS = "nivra_labels";
  const KEY_MOODS = "nivra_moods";
  const KEY_STREAK = "nivra_streak";
  const KEY_LAST_SAVED_DAY = "nivra_lastSavedDay";

  let entries = JSON.parse(localStorage.getItem(KEY_ENTRIES) || "[]");
  let labels = JSON.parse(localStorage.getItem(KEY_LABELS) || "[]");
  let moods = JSON.parse(localStorage.getItem(KEY_MOODS) || "[]");
  let streak = parseInt(localStorage.getItem(KEY_STREAK) || "0", 10) || 0;
  let lastSavedDay = localStorage.getItem(KEY_LAST_SAVED_DAY) || null;

  /* -------------------------
     Mood lines (randomized)
     ------------------------- */
  const MOOD_LINES = {
    sad: [
      "It’s okay to feel down — let’s write one small thing you noticed today.",
      "If it’s heavy, try untangling one thought. You’re allowed to go slow.",
      "Bad days matter. Let's capture a single detail that felt heavy."
    ],
    neutral: [
      "Quiet days are fine — what small thing made today steady?",
      "Neutral is a useful baseline. Note one small observation.",
      "A calm day: what did you do that felt ordinary and good?"
    ],
    happy: [
      "Nice — what made you smile today? Capture that small joy.",
      "Good days are worth saving. One sentence will do.",
      "Remembering this feeling later will help — write it down."
    ],
    excited: [
      "You're buzzing — what’s the spark? Write one sentence to remember.",
      "Energy is awesome. Save the highlight of today!",
      "Capture the 'why' of this excitement in a line."
    ],
    love: [
      "Warm feelings are precious — jot down the moment that caused it.",
      "That glow matters. Save who/what made you feel this way.",
      "A short note will keep this feeling easy to revisit."
    ]
  };

  function pickMoodLine(key) {
    const arr = MOOD_LINES[key] || ["How are you feeling today?"];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* -------------------------
     Mood mapping helpers
     ------------------------- */
  function moodToValue(key) {
    if (!key) return 0;
    const map = {
      sad: 1,
      neutral: 2,
      happy: 3,
      excited: 4,
      love: 5,
      "😢": 1,
      "😐": 2,
      "😊": 3,
      "😁": 4,
      "🤩": 5
    };
    return map[key] || 0;
  }

  function valueToEmoji(v) {
    return ["", "😢", "😐", "😊", "😁", "🤩"][v] || "";
  }

  /* -------------------------
     DOM Elements (try multiple variants)
     ------------------------- */
  const journalInput = findOne(["#journalInput", "#journalText", "textarea#journalInput"]);
  const saveBtn = findOne(["#saveEntryBtn", "#saveBtn", "#saveEntry"]);
  const moodChartCanvas = findOne(["#moodChart", "canvas#moodChart"]);
  const selectedMoodText = findOne(["#selectedMoodText", ".mood-message", "#moodMessage"]);
  const dateStampEl = findOne(["#dateStamp", ".date-stamp"]);
  const streakCountEl = findOne(["#streakCount", "#streakDays", ".streak-count"]);
  const streakContainerEl = findOne([".streak-container", ".streak-counter", ".streak-counter-wrap"]);
  const chartWrapper = moodChartCanvas ? (moodChartCanvas.parentElement || moodChartCanvas) : null;

  /* -------------------------
     Inline layout adjustments (small safe fixes so page matches desired order)
     - These set reasonable spacing and keep chart from being pushed too far
     ------------------------- */
  function applyInlineLayoutTweaks() {
    // target main sections that might be too spaced
    $$(".dashboard-main section").forEach((sec) => {
      sec.style.marginBottom = "28px";
    });

    // journal area shape
    if (journalInput) {
      journalInput.style.width = journalInput.style.width || "82%";
      journalInput.style.maxWidth = "820px";
      journalInput.style.margin = "10px auto";
      journalInput.style.display = "block";
    }

    // Save button spacing
    if (saveBtn) {
      saveBtn.style.marginTop = "10px";
      saveBtn.style.padding = saveBtn.style.padding || "10px 18px";
      saveBtn.style.borderRadius = saveBtn.style.borderRadius || "10px";
    }

    // Chart sizing so it stays near journal section
    if (chartWrapper) {
      chartWrapper.style.maxWidth = "860px";
      chartWrapper.style.margin = chartWrapper.style.margin || "8px auto";
      // if wrapper is a div around canvas, ensure a fixed-ish height
      chartWrapper.style.height = chartWrapper.style.height || "300px";
    }

    // streak bottom-right placement (user asked bottom side — we choose bottom-right)
    if (streakContainerEl) {
      streakContainerEl.style.position = "fixed";
      streakContainerEl.style.bottom = "18px";
      streakContainerEl.style.right = "22px";
      streakContainerEl.style.left = "auto";
      streakContainerEl.style.transform = "none";
      streakContainerEl.style.zIndex = "80";
      streakContainerEl.style.padding = streakContainerEl.style.padding || "10px 14px";
      streakContainerEl.style.borderRadius = streakContainerEl.style.borderRadius || "14px";
      streakContainerEl.style.background = streakContainerEl.style.background || "rgba(255,255,255,0.28)";
      streakContainerEl.style.backdropFilter = "blur(6px)";
      streakContainerEl.style.boxShadow = "0 8px 24px rgba(25,69,105,0.14)";
    }
  }

  /* -------------------------
     Chart.js initialization & update
     ------------------------- */
  let chart = null;
  function createChart() {
    if (!moodChartCanvas) return null;

    // ensure canvas has size
    moodChartCanvas.style.width = moodChartCanvas.style.width || "100%";
    // create or re-use Chart instance
    const ctx = moodChartCanvas.getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels || [],
        datasets: [
          {
            label: "Mood",
            data: moods || [],
            borderColor: "#194569",
            backgroundColor: "rgba(25,69,105,0.08)",
            pointBackgroundColor: "#5F84A2",
            pointBorderColor: "#194569",
            tension: 0.36,
            fill: true,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#13323f", font: { family: "Poppins" } } },
          tooltip: {
            backgroundColor: "#fff",
            titleColor: "#194569",
            bodyColor: "#13323f",
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                const label = valueToEmoji(v) + "  " + (["", "Sad", "Neutral", "Happy", "Excited", "Love"][v] || "");
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#194569" },
            grid: { color: "rgba(25,69,105,0.06)" }
          },
          y: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              color: "#194569",
              callback: (v) => valueToEmoji(v)
            },
            grid: { color: "rgba(25,69,105,0.06)" }
          }
        }
      }
    });

    // ensure canvas fills wrapper height
    if (chartWrapper) {
      // try to set canvas parent height so maintainAspectRatio:false uses it
      chartWrapper.style.height = chartWrapper.style.height || "300px";
    }

    return chart;
  }

  function updateChart() {
    if (!chart) chart = createChart();
    if (!chart) return;
    labels = trimToMax(labels, 120);
    moods = trimToMax(moods, 120);
    chart.data.labels = labels;
    chart.data.datasets[0].data = moods;
    chart.update();
  }

  /* -------------------------
     Streak logic (robust)
     - increments only on first-save-of-day
     - resets to 1 if missed > 1 day
     ------------------------- */
  function loadStreakUI() {
    if (!streakCountEl) return;
    streakCountEl.textContent = String(streak);
  }

  // helper to compute day difference (local)
  function dayDiff(aDateString, bDateString) {
    try {
      const a = new Date(aDateString);
      const b = new Date(bDateString);
      // set to midnight UTC-local zeroing
      a.setHours(0, 0, 0, 0);
      b.setHours(0, 0, 0, 0);
      const diffMs = b - a;
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch (e) {
      return null;
    }
  }

  function updateStreakIfNeededOnSave() {
    const today = todayDateString();

    if (!lastSavedDay) {
      // no previous save
      streak = 1;
      lastSavedDay = today;
    } else {
      // days between lastSavedDay and today
      const diff = dayDiff(lastSavedDay, today);
      if (diff === 0) {
        // already saved today -> no change
      } else if (diff === 1) {
        // consecutive -> increment
        streak = streak + 1;
      } else if (diff > 1) {
        // missed days -> reset to 1
        streak = 1;
      } else {
        // something odd -> set to 1
        streak = 1;
      }
      lastSavedDay = today;
    }

    // persist
    localStorage.setItem(KEY_STREAK, String(streak));
    localStorage.setItem(KEY_LAST_SAVED_DAY, lastSavedDay);
    if (streakCountEl) streakCountEl.textContent = String(streak);
  }

  // small visual effect for streak increase
  function flashStreak() {
    if (!streakContainerEl) return;
    streakContainerEl.classList.add("streak-burst-js");
    setTimeout(() => streakContainerEl.classList.remove("streak-burst-js"), 900);
  }

  /* -------------------------
     Save entry logic (main)
     - validates mood selection
     - adds entry to arrays & localStorage
     - updates chart & streak
     - clears input and gives feedback
     ------------------------- */
  function saveEntry() {
    // guards
    if (!journalInput) {
      console.warn("journal input not found — cannot save.");
      return;
    }

    // determine selected mood key (global window var or dataset)
    let moodKey = window.__currentSelectedMoodKey || null;
    if (!moodKey) {
      // fallback: if selectedMoodText contains "You selected: X" parse it
      if (selectedMoodText) {
        const txt = selectedMoodText.textContent || "";
        const match = txt.match(/You selected:\s*(.+)$/);
        if (match) moodKey = match[1].trim();
      }
    }

    if (!moodKey) {
      alert("Please select a mood before saving.");
      return;
    }

    const note = journalInput.value.trim();
    const now = new Date();
    const iso = now.toISOString();
    const lbl = shortDateLabel(now);
    const val = moodToValue(moodKey);

    // push
    labels.push(lbl);
    moods.push(val);
    entries.push({ date: iso, mood: moodKey, value: val, note: note });

    // trim and persist
    labels = trimToMax(labels, 240);
    moods = trimToMax(moods, 240);
    entries = trimToMax(entries, 240);

    localStorage.setItem(KEY_LABELS, JSON.stringify(labels));
    localStorage.setItem(KEY_MOODS, JSON.stringify(moods));
    localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries));

    // update chart
    updateChart();

    // streak logic: increase only on first save today
    const oldStreak = streak;
    updateStreakIfNeededOnSave();
    const increased = streak > oldStreak;

    // UI updates
    journalInput.value = "";
    // clear selected mood visuals
    $$(".emoji-btn, .mood-icons span").forEach((el) => el.classList && el.classList.remove("active"));
    window.__currentSelectedMoodKey = null;
    if (selectedMoodText) selectedMoodText.textContent = "Mood saved. Take a breath.";

    // feedback micro-interactions
    if (saveBtn) {
      // quick visual pressed effect
      saveBtn.classList.add("loading");
      const prevText = saveBtn.textContent;
      saveBtn.textContent = "Saved ✓";
      setTimeout(() => {
        saveBtn.classList.remove("loading");
        saveBtn.textContent = prevText || "Save Entry";
      }, 900);
    }

    // streak visual if increased
    if (increased) {
      flashStreak();
    }
  }

  /* -------------------------
     Mood wiring (for emoji spans or buttons)
     ------------------------- */
  function wireMoodSelection() {
    // prefer buttons with data-mood attribute
    const emojiBtns = $$(".emoji-btn");
    if (emojiBtns.length) {
      emojiBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.mood;
          setSelectedMood(key, btn);
        });
      });
      return;
    }

    // fallback: spans inside .mood-icons
    const moodSpans = $$(".mood-icons span");
    moodSpans.forEach((span) => {
      span.addEventListener("click", () => {
        const emoji = span.textContent.trim();
        setSelectedMood(emoji, span);
      });
    });
  }

  function setSelectedMood(key, el) {
    // support emoji -> canonical key mapping
    const emojiMap = { "😢": "sad", "😐": "neutral", "😊": "happy", "😁": "excited", "🤩": "love" };
    let canonical = key;
    if (emojiMap[key]) canonical = emojiMap[key];

    // set global for saveEntry pick-up
    window.__currentSelectedMoodKey = canonical;

    // highlight the clicked element
    $$(".emoji-btn, .mood-icons span").forEach((e) => {
      if (e === el) e.classList && e.classList.add("active");
      else e.classList && e.classList.remove("active");
    });

    // set mood line
    if (selectedMoodText) {
      selectedMoodText.style.opacity = 0;
      setTimeout(() => {
        selectedMoodText.textContent = pickMoodLine(canonical);
        selectedMoodText.style.opacity = 1;
      }, 70);
    }
  }

  /* -------------------------
     Keyboard shortcut: Enter saves, Shift+Enter newline
     ------------------------- */
  function wireJournalKeyboard() {
    if (!journalInput) return;
    journalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // small pressed animation on button
        if (saveBtn) {
          saveBtn.classList.add("pressed");
          setTimeout(() => saveBtn.classList.remove("pressed"), 140);
        }
        saveEntry();
      }
    });
  }

  /* -------------------------
     Button micro interactions
     ------------------------- */
  function wireButtons() {
    // Save button visual click
    if (saveBtn) {
      saveBtn.addEventListener("click", (e) => {
        // prevent double-click spam
        saveBtn.disabled = true;
        setTimeout(() => (saveBtn.disabled = false), 900);
        // give immediate visual feedback
        saveBtn.classList.add("active");
        setTimeout(() => saveBtn.classList.remove("active"), 180);
      });
    }

    // small pressed style for all buttons
    $$("button, .btn").forEach((b) => {
      b.addEventListener("mousedown", () => b.classList && b.classList.add("pressed"));
      b.addEventListener("mouseup", () => b.classList && b.classList.remove("pressed"));
      b.addEventListener("mouseleave", () => b.classList && b.classList.remove("pressed"));
    });
  }

  /* -------------------------
     Date stamp update
     ------------------------- */
  function updateDateStamp() {
    if (!dateStampEl) return;
    dateStampEl.textContent = `Today, ${prettyFullDate(new Date())}`;
  }

  /* -------------------------
     Login/Signup wiring (old behavior kept)
     - If login/signup forms exist, give them a loading redirect
     ------------------------- */
  function wireAuthForms() {
    const loginForm = $("#loginForm");
    if (loginForm) {
      const btn = loginForm.querySelector("button[type='submit']");
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (btn) {
          const original = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Logging in...";
          btn.classList.add("loading");
          setTimeout(() => {
            window.location.href = "dashboard.html";
            // restore (not necessary, redirect will navigate away)
            btn.textContent = original;
            btn.disabled = false;
            btn.classList.remove("loading");
          }, 1400);
        } else {
          window.location.href = "dashboard.html";
        }
      });
    }

    const signupForm = $("#signupForm");
    if (signupForm) {
      const btn = signupForm.querySelector("button[type='submit']");
      signupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (btn) {
          const original = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Creating account...";
          btn.classList.add("loading");
          setTimeout(() => {
            window.location.href = "dashboard.html";
            btn.textContent = original;
            btn.disabled = false;
            btn.classList.remove("loading");
          }, 1400);
        } else {
          window.location.href = "dashboard.html";
        }
      });
    }
  }

  /* -------------------------
     Small CSS helpers injected for classes used by script
     - We inject a tiny <style> block so JS classes like .loading, .pressed, .streak-burst-js exist
     - This avoids you having to manually add them to CSS
     ------------------------- */
  function injectHelperStyles() {
    const css = `
      .loading { opacity: .9; transform: translateY(-1px); box-shadow: 0 10px 30px rgba(25,69,105,0.12) !important; }
      .pressed { transform: translateY(1px) scale(.995); opacity: .95; }
      button.loading, .btn.loading { animation: pulse 1.2s infinite ease-in-out; }
      @keyframes pulse { 0%{ box-shadow: 0 0 8px rgba(95,132,162,0.35);}50%{ box-shadow: 0 0 20px rgba(95,132,162,0.7);}100%{ box-shadow:0 0 8px rgba(95,132,162,0.35);} }
      .streak-burst-js { animation: streakBurst 850ms ease; }
      @keyframes streakBurst {
        0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,160,0,0)); }
        30% { transform: scale(1.08); filter: drop-shadow(0 8px 24px rgba(255,160,0,0.16)); }
        60% { transform: scale(0.98); }
        100% { transform: scale(1); filter: none; }
      }
    `;
    const s = document.createElement("style");
    s.setAttribute("data-nivra-helper", "1");
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  /* -------------------------
     Boot sequence
     ------------------------- */
  function boot() {
    // small inline layout fixes to avoid needing CSS overrides
    applyInlineLayoutTweaks();

    // wire UI
    wireMoodSelection();
    wireJournalKeyboard();
    wireButtons();
    wireAuthForms();

    // create chart & update
    createChart();
    updateChart();

    // update date stamp
    updateDateStamp();

    // load streak UI
    loadStreakUI();

    // inject helper styles (so .loading/.pressed classes have effects without manual CSS edits)
    injectHelperStyles();

    // entrance animations for key elements
    if (selectedMoodText) {
      selectedMoodText.style.opacity = 0;
      setTimeout(() => (selectedMoodText.style.transition = "opacity .45s ease"), 30);
      setTimeout(() => (selectedMoodText.style.opacity = 1), 120);
    }

    // ensure save button has accessible label if missing
    if (saveBtn && !saveBtn.getAttribute("aria-label")) {
      saveBtn.setAttribute("aria-label", "Save your journal entry");
    }

    // set some sensible fallback texts
    if (selectedMoodText && selectedMoodText.textContent.trim() === "") {
      selectedMoodText.textContent = "How are you feeling today?";
    }

    // if streak element present but empty, populate it
    if (streakCountEl && streakCountEl.textContent.trim() === "") {
      streakCountEl.textContent = String(streak || 0);
    }
  }

  // Expose small helpers for manual dev usage
  window.selectMood = function (k) {
    // find a matching element to highlight if present
    const el = $$(".mood-icons span").find((s) => s.textContent.trim() === k) || null;
    setTimeout(() => setSelectedMood && setSelectedMood(k, el), 50);
  };

  window.saveEntry = saveEntry;

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    try {
      boot();
    } catch (err) {
      console.error("Error booting Nivra script:", err);
    }
  });

  // Expose debug helper
  window.nivraDebug = function () {
    return {
      entries,
      labels,
      moods,
      streak,
      lastSavedDay,
      localStorage: {
        entries: localStorage.getItem(KEY_ENTRIES),
        labels: localStorage.getItem(KEY_LABELS),
        moods: localStorage.getItem(KEY_MOODS),
        streak: localStorage.getItem(KEY_STREAK),
        lastSavedDay: localStorage.getItem(KEY_LAST_SAVED_DAY)
      }
    };
  };

  // Local helpers used in some functions must be available:
  // setSelectedMood is used by window.selectMood — ensure it's in scope
  function setSelectedMood(key, el) {
    const emojiMap = { "😢": "sad", "😐": "neutral", "😊": "happy", "😁": "excited", "🤩": "love" };
    let canonical = key;
    if (emojiMap[key]) canonical = emojiMap[key];
    window.__currentSelectedMoodKey = canonical;

    $$(".emoji-btn, .mood-icons span").forEach((e) => {
      if (e === el) e.classList && e.classList.add("active");
      else e.classList && e.classList.remove("active");
    });

    if (selectedMoodText) {
      selectedMoodText.style.opacity = 0;
      setTimeout(() => {
        selectedMoodText.textContent = pickMoodLine(canonical);
        selectedMoodText.style.opacity = 1;
      }, 70);
    }
  }
})();
