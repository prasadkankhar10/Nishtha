// Nishtha - Gamified Habit Tracker Logic
// Author: prasad kankhar
// -----------------------------
// --- Supabase Initialization ---
let supabaseClient;
document.addEventListener('DOMContentLoaded', function() {
  const SUPABASE_URL = 'https://ngwmxdtgzmaqmnikcsyr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd214ZHRnem1hcW1uaWtjc3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTQ4MDMsImV4cCI6MjA2MTc5MDgwM30.IvI3m-BACWjZ7zPT4h-tkSBLeiSWLyad237eQVHXyvQ';
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
});

// Habit class definition
class Habit {
  constructor(name, category) {
    this.id = crypto.randomUUID(); // Use UUID for Supabase compatibility
    this.name = name;
    this.category = category;
    this.streakCount = 0;
    this.lastCompletedDate = null;
    this.badge = null; // 'bronze', 'silver', 'gold', or null
    this.history = [];
    this.rewards = {}; // Custom rewards for levels
  }
}

function afterHabitChange() {
  renderTotalStreak();
  checkThemeUnlocks();
}

// LocalStorage helpers
function getHabits() {
  return JSON.parse(localStorage.getItem("habits") || "[]");
}
function saveHabits(habits) {
  localStorage.setItem("habits", JSON.stringify(habits));
}

// --- Unified Habits Storage (Supabase + localStorage) ---
async function getHabitsUnified() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    // Try Supabase first
    const { data, error } = await supabaseClient
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const habits = data.map(h => ({
        id: h.id,
        name: h.name,
        category: h.category,
        streakCount: h.streak_count,
        lastCompletedDate: h.last_completed_date,
        badge: h.badge,
        history: h.history || [],
        rewards: h.rewards || {}
      }));
      // Sync to localStorage for offline use
      localStorage.setItem('habits', JSON.stringify(habits));
      return habits;
    }
  }
  // Fallback to localStorage
  return JSON.parse(localStorage.getItem('habits') || '[]');
}

async function saveHabitsUnified(habits) {
  // Always save to localStorage
  localStorage.setItem('habits', JSON.stringify(habits));
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    // Remove all old habits for this user
    await supabaseClient.from('habits').delete().eq('user_id', user.id);
    // Insert all current habits
    for (const habit of habits) {
      const insertObj = {
        user_id: user.id,
        name: habit.name,
        category: habit.category,
        streak_count: habit.streakCount,
        last_completed_date: habit.lastCompletedDate,
        badge: habit.badge,
        history: habit.history,
        rewards: habit.rewards,
        id: habit.id
      };
      console.log('Inserting habit to Supabase:', insertObj);
      await supabaseClient.from('habits').insert([insertObj]);
    }
  }
}

// --- Level System ---
const LEVELS = [
  { days: 1, name: 'Ārambha' },
  { days: 3, name: 'Abhyāsa' },
  { days: 5, name: 'Niṣṭhā' },
  { days: 7, name: 'Shraddhā' },
  { days: 10, name: 'Vr̥ddhi' },
  { days: 14, name: 'Sādhanā' },
  { days: 21, name: 'Sthairya' },
  { days: 30, name: 'Dhairya' },
  { days: 45, name: 'Pratibaddhatā' },
  { days: 60, name: 'Aikāgrya' },
  { days: 90, name: 'Utsāha' },
  { days: 120, name: 'Parākrama' },
  { days: 180, name: 'Jaya' },
  { days: 270, name: 'Mokṣa' },
  { days: 365, name: 'Siddhi' }
];

function getLevel(streak) {
  let level = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (streak >= LEVELS[i].days) level = i;
    else break;
  }
  return level;
}
function getNextLevel(streak) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (streak < LEVELS[i].days) return i;
  }
  return LEVELS.length; // Maxed out
}
function getXPBarPercent(streak) {
  const curr = getLevel(streak);
  const prevDays = curr > 0 ? LEVELS[curr].days : 0;
  const next = getNextLevel(streak);
  if (next >= LEVELS.length) return 100;
  const nextDays = LEVELS[next].days;
  return Math.round(((streak - prevDays) / (nextDays - prevDays)) * 100);
}

// Render all habits
async function renderHabits() {
  const habits = await getHabitsUnified();
  const list = document.getElementById("habits-list");
  list.innerHTML = "";
  if (habits.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;color:#aaa;">No habits yet. Add one!</p>';
    return;
  }
  habits.forEach((habit) => {
    const streak = habit.streakCount;
    const levelIdx = getLevel(streak);
    const nextLevelIdx = getNextLevel(streak);
    const levelName = LEVELS[levelIdx]?.name || '—';
    const nextLevel = LEVELS[nextLevelIdx];
    const xpPercent = getXPBarPercent(streak);
    let xpTooltip = `Level ${levelIdx+1}: ${levelName}`;
    if (nextLevel) xpTooltip += ` (${streak}/${nextLevel.days} days)`;
    else xpTooltip += ` (Max)`;
    // --- Rewards ---
    const rewards = habit.rewards || {};
    const rewardText = rewards[levelIdx+1] ? `<div class='reward-display'><span class='reward-icon'>🎁</span> <span class='reward-text'>${escapeHTML(rewards[levelIdx+1])}</span></div>` : '';
    const card = document.createElement("div");
    card.className = "habit-card" + (isHabitFailed(habit) ? " failed" : "");
    card.innerHTML = `
      <div class="habit-header">
        <span class="habit-title">${escapeHTML(habit.name)}</span>
        <span class="habit-category">${escapeHTML(habit.category)}</span>
      </div>
      <div class="habit-streak">
        <span class="streak-count">${habit.streakCount}</span>
        <span class="streak-label">Streak</span>
        <span class="level-label">Level ${levelIdx+1}: <b>${levelName}</b></span>
        ${renderBadge(habit)}
      </div>
      <div class="xp-bar" title="${xpTooltip}"><div class="xp-fill" style="width:${xpPercent}%"></div></div>
      ${rewardText}
      <div class="habit-actions">
        <button class="btn success" data-id="${habit.id}" ${isHabitDoneToday(habit) ? "disabled" : ""}>Mark as done</button>
        <button class="btn" data-delete="${habit.id}">Delete</button>
        <button class="btn" data-history="${habit.id}">View History</button>
        <button class="btn" data-reward="${habit.id}">Set Rewards</button>
      </div>
    `;
    if (isHabitDoneToday(habit)) {
      card.classList.add('pulse-card');
      setTimeout(() => card.classList.remove('pulse-card'), 800);
    }
    list.appendChild(card);
  });
}

// Add habit
async function addHabit(name, category) {
  const habits = await getHabitsUnified();
  habits.push(new Habit(name, category));
  await saveHabitsUnified(habits);
  renderHabits();
  afterHabitChange();
}

// Delete habit
async function deleteHabit(id) {
  let habits = await getHabitsUnified();
  habits = habits.filter((h) => h.id !== id);
  await saveHabitsUnified(habits);
  renderHabits();
  afterHabitChange();
}

// Mark as done
async function markHabitDone(id) {
  console.log('markHabitDone called with id:', id);
  const habits = await getHabitsUnified();
  const habit = habits.find((h) => h.id === id);
  console.log('Habit found:', habit);
  if (!habit) return;
  const today = getToday();
  if (habit.lastCompletedDate !== today) {
    const list = document.getElementById("habits-list");
    const card = Array.from(list.children).find(c => c.querySelector('.btn.success')?.getAttribute('data-id') === id);
    const prevLevel = getLevel(habit.streakCount);
    if (isYesterday(habit.lastCompletedDate)) {
      habit.streakCount++;
    } else {
      habit.streakCount = 1;
    }
    habit.lastCompletedDate = today;
    // --- Add to history ---
    if (!habit.history) habit.history = [];
    if (!habit.history.includes(today)) habit.history.push(today);
    updateBadge(habit, card);
    await saveHabitsUnified(habits);
    console.log('Habit after marking done:', habit);
    renderHabits();
    if (card) showFloatingXP(card, '+1 Streak!');
    // Level up effect
    const newLevel = getLevel(habit.streakCount);
    if (newLevel > prevLevel) {
      showToast(`🎉 Level Up! Level ${newLevel+1}: ${LEVELS[newLevel].name}`);
      const xpBar = card?.querySelector('.xp-bar');
      if (xpBar) {
        xpBar.classList.add('pulse-xp');
        setTimeout(() => xpBar.classList.remove('pulse-xp'), 1200);
      }
    } else {
      showToast("Great job! +1 streak");
    }
    playSound("success");
    afterHabitChange();
    await checkWeeklyHabitTargets();
  } else {
    console.log('Habit already marked as done for today.');
  }
}

// Badge logic
function updateBadge(habit, cardEl) {
  const prevBadge = habit.badge;
  if (habit.streakCount >= 20) habit.badge = "gold";
  else if (habit.streakCount >= 10) habit.badge = "silver";
  else if (habit.streakCount >= 5) habit.badge = "bronze";
  else habit.badge = null;
  if (habit.badge && habit.badge !== prevBadge) {
    showConfetti();
    if (cardEl) {
      const xpBar = cardEl.querySelector('.xp-bar');
      if (xpBar) {
        xpBar.classList.add('pulse-xp');
        setTimeout(() => xpBar.classList.remove('pulse-xp'), 1200);
      }
    }
    playSound('success');
  }
}
function renderBadge(habit) {
  if (!habit.badge) return "";
  return `<img src="assets/icons/${
    habit.badge
  }-badge.png" class="badge unlocked" alt="${
    habit.badge
  } badge" title="${capitalize(habit.badge)} Badge!">`;
}

// XP bar percent
function getXPPercent(habit) {
  // XP bar reflects progress to next badge tier, but streak can go unlimited
  if (habit.streakCount >= 20) return 100;
  if (habit.streakCount >= 10) return ((habit.streakCount - 10) / 10) * 100;
  if (habit.streakCount >= 5) return ((habit.streakCount - 5) / 5) * 100;
  return (habit.streakCount / 5) * 100;
}

// Streak reset logic
async function checkMissedHabits() {
  const habits = await getHabitsUnified();
  let changed = false;
  habits.forEach((habit) => {
    if (!isHabitDoneToday(habit) && !isYesterday(habit.lastCompletedDate)) {
      if (habit.streakCount !== 0) changed = true;
      habit.streakCount = 0;
      habit.badge = null;
    }
  });
  if (changed) {
    await saveHabitsUnified(habits);
    renderHabits();
    showToast("Oops! Missed habits reset.");
    playSound("fail");
  }
}

// Helper: Get ISO week string (e.g. '2025-W18')
function getISOWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0,0,0,0);
  // Thursday in current week decides the year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(),0,4);
  return d.getFullYear() + '-W' + String(1 + Math.round(((d.getTime() - week1.getTime())/86400000 - 3 + ((week1.getDay()+6)%7))/7)).padStart(2,'0');
}

// Helper: Count completions in a week
function countCompletionsThisWeek(habit) {
  const week = getISOWeek();
  return (habit.history || []).filter(dateStr => getISOWeek(dateStr) === week).length;
}

// Weekly streak check (run at startup and after marking done)
async function checkWeeklyHabitTargets() {
  const habits = await getHabitsUnified();
  let changed = false;
  const week = getISOWeek();
  habits.forEach(habit => {
    if (habit.lastCheckedWeek !== week) {
      if (countCompletionsThisWeek(habit) === 0) {
        habit.streakCount = 0;
        habit.badge = null;
        changed = true;
      }
      habit.lastCheckedWeek = week;
    }
  });
  if (changed) {
    await saveHabitsUnified(habits);
    renderHabits();
    showToast('Some streaks reset: weekly target not met.');
    playSound('fail');
  }
}

// --- Gamified Theme Unlocking ---
const THEME_UNLOCKS = {
  'heroic': 0,    // Always unlocked
  'mystic': 5,   // Unlock at 5 total streaks
  'retro': 15    // Unlock at 15 total streaks
};

function getTotalStreak() {
  return getHabits().reduce((sum, h) => sum + (h.streakCount || 0), 0);
}

function getUnlockedThemes() {
  const totalStreak = getTotalStreak();
  return THEMES.filter(t => totalStreak >= (THEME_UNLOCKS[t.key] || 0)).map(t => t.key);
}

function isThemeUnlocked(themeKey) {
  return getTotalStreak() >= (THEME_UNLOCKS[themeKey] || 0);
}

function setTheme(themeKey, animate = true, showToastOnLock = true) {
  if (!isThemeUnlocked(themeKey)) {
    if (showToastOnLock) showToast('🔒 Theme locked! Reach more streaks to unlock.');
    return;
  }
  document.body.classList.remove(...THEMES.map(t => 'theme-' + t.key));
  document.body.classList.add('theme-' + themeKey);
  localStorage.setItem('nishtha-theme', themeKey);
  // Animate button
  const btn = document.getElementById('theme-switcher');
  if (btn && animate) {
    btn.classList.remove('theme-animate');
    void btn.offsetWidth; // trigger reflow
    btn.classList.add('theme-animate');
  }
}

function cycleTheme() {
  const current = getCurrentTheme();
  const unlocked = getUnlockedThemes();
  let idx = THEMES.findIndex(t => t.key === current);
  let nextIdx = (idx + 1) % THEMES.length;
  // Find next unlocked theme
  for (let i = 0; i < THEMES.length; i++) {
    if (unlocked.includes(THEMES[nextIdx].key)) break;
    nextIdx = (nextIdx + 1) % THEMES.length;
  }
  const next = THEMES[nextIdx];
  setTheme(next.key);
  showToast(next.toast);
}

// --- Theme Gallery Modal ---
function showThemeGallery() {
  let modal = document.getElementById('theme-gallery-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'theme-gallery-modal';
    modal.innerHTML = `
      <div class="theme-gallery-backdrop"></div>
      <div class="theme-gallery">
        <h2>Theme Gallery</h2>
        <div class="theme-list"></div>
        <button class="btn" id="close-theme-gallery">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.theme-gallery-backdrop').onclick = closeThemeGallery;
    modal.querySelector('#close-theme-gallery').onclick = closeThemeGallery;
  }
  renderThemeList();
  modal.style.display = 'flex';
}
function closeThemeGallery() {
  const modal = document.getElementById('theme-gallery-modal');
  if (modal) modal.style.display = 'none';
}
function renderThemeList() {
  const list = document.querySelector('.theme-list');
  if (!list) return;
  const totalStreak = getTotalStreak();
  list.innerHTML = THEMES.map(t => {
    const unlocked = isThemeUnlocked(t.key);
    return `
      <div class="theme-card${unlocked ? '' : ' locked'}" data-theme="${t.key}" title="${unlocked ? t.label : 'Unlock at ' + THEME_UNLOCKS[t.key] + ' total streaks!'}">
        <div class="theme-preview theme-${t.key}"></div>
        <div class="theme-label">${t.label}</div>
        <div class="theme-status">${unlocked ? 'Unlocked' : '🔒 Locked'}</div>
      </div>
    `;
  }).join('');
  // Click to select theme
  list.querySelectorAll('.theme-card').forEach(card => {
    card.onclick = () => {
      const theme = card.getAttribute('data-theme');
      if (isThemeUnlocked(theme)) {
        setTheme(theme);
        showToast('Theme applied!');
        closeThemeGallery();
      } else {
        showToast('🔒 Theme locked! Reach more streaks to unlock.');
      }
    };
  });
}

// --- Unlock Animation & Toast ---
function checkThemeUnlocks() {
  const unlocked = getUnlockedThemes();
  const prev = JSON.parse(localStorage.getItem('nishtha-unlocked-themes') || '["heroic"]');
  unlocked.forEach(theme => {
    if (!prev.includes(theme) && theme !== 'heroic') {
      showToast(`🎉 New Theme Unlocked: ${THEMES.find(t => t.key === theme).label}!`);
      // Optionally, add a confetti or badge animation here
    }
  });
  localStorage.setItem('nishtha-unlocked-themes', JSON.stringify(unlocked));
}

// --- Total Streak Counter in Header ---
function renderTotalStreak() {
  let el = document.getElementById('total-streak');
  if (!el) {
    el = document.createElement('div');
    el.id = 'total-streak';
    el.className = 'total-streak';
    document.querySelector('.app-header').appendChild(el);
  }
  el.innerHTML = `🔥 Total Streak: <b>${getTotalStreak()}</b>`;
}

// Add missing getCurrentTheme function
function getCurrentTheme() {
  return localStorage.getItem('nishtha-theme') || 'heroic';
}

// --- Theme Definitions ---
const THEMES = [
  { key: 'heroic', label: 'Heroic Mode', toast: '🦸 Heroic Mode Activated!' },
  { key: 'mystic', label: 'Mystic Mode', toast: '🔮 Mystic Mode Activated!' },
  { key: 'retro', label: '🕹️ Retro Mode Activated!' }
];

// Utility functions
function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function isYesterday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10);
}
function isHabitDoneToday(habit) {
  return habit.lastCompletedDate === getToday();
}
function isHabitFailed(habit) {
  return (
    !isHabitDoneToday(habit) &&
    habit.lastCompletedDate &&
    !isYesterday(habit.lastCompletedDate)
  );
}
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
// Toast
function showToast(msg) {
  let toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

// Sound (optional, stub for now)
function playSound(type) {
  // Uncomment and add your sound files in assets/sounds/
  // let audio = new Audio(`assets/sounds/${type}.mp3`);
  // audio.play();
}

// Render theme dropdown
function renderThemeDropdown() {
  const dropdown = document.getElementById('theme-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = THEMES.map(t => {
    const unlocked = isThemeUnlocked(t.key);
    return `<option value="${t.key}" ${!unlocked ? 'disabled' : ''}>${t.label}${!unlocked ? ' (Locked)' : ''}</option>`;
  }).join('');
  dropdown.value = getCurrentTheme();
  dropdown.onchange = function() {
    setTheme(this.value);
    showToast(THEMES.find(t => t.key === this.value).toast);
  };
}

// --- Confetti Animation ---
function showConfetti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  for (let i = 0; i < 32; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = `hsl(${Math.random()*360},90%,60%)`;
    piece.style.animationDelay = (Math.random() * 0.7) + 's';
    confetti.appendChild(piece);
  }
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 1800);
}

// --- Floating XP Text ---
function showFloatingXP(card, text) {
  const xp = document.createElement('div');
  xp.className = 'floating-xp';
  xp.textContent = text;
  card.appendChild(xp);
  setTimeout(() => xp.remove(), 1200);
}

// --- Habit History Modal ---
function showHabitHistory(habitId) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  let modal = document.getElementById('history-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.innerHTML = `
      <div class="history-backdrop"></div>
      <div class="history-modal-content">
        <h2>History: ${escapeHTML(habit.name)}</h2>
        <div id="history-calendar"></div>
        <div id="history-levels"></div>
        <button class="btn" id="close-history-modal">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.history-backdrop').onclick = closeHabitHistory;
    modal.querySelector('#close-history-modal').onclick = closeHabitHistory;
  }
  renderHistoryCalendar(habit);
  renderHistoryLevels(habit);
  modal.style.display = 'flex';
}

function closeHabitHistory() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.style.display = 'none';
}

function renderHistoryCalendar(habit) {
  const days = 30;
  const today = new Date();
  const calendar = document.getElementById('history-calendar');
  calendar.innerHTML = '';
  let html = '<div class="calendar-grid">';
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const done = habit.history && habit.history.includes(dateStr);
    html += `<div class="calendar-cell${done ? ' done' : ''}" title="${dateStr}">${d.getDate()}</div>`;
  }
  html += '</div>';
  calendar.innerHTML = html;
}

function renderHistoryLevels(habit) {
  const container = document.getElementById('history-levels');
  if (!container) return;
  const streak = habit.streakCount;
  const rewards = habit.rewards || {};
  let html = '<div class="levels-list"><h3>Levels</h3><ul>';
  LEVELS.forEach((level, idx) => {
    const reached = streak >= level.days;
    html += `<li class="level-item${reached ? ' reached' : ''}">` +
      `<span class="level-num">${idx+1}.</span> ` +
      `<span class="level-name">${level.name}</span> ` +
      `<span class="level-days">(${level.days} days)</span>` +
      (rewards[idx+1] ? ` <span class='reward-icon'>🎁</span> <span class='reward-text'>${escapeHTML(rewards[idx+1])}</span>` : '') +
      (reached ? ' <span class="level-status">✔</span>' : '') +
      '</li>';
  });
  html += '</ul></div>';
  container.innerHTML = html;
}

// --- Set Rewards Modal ---
function showSetRewards(habitId) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  if (!habit.rewards) habit.rewards = {};
  let modal = document.getElementById('rewards-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rewards-modal';
    modal.innerHTML = `
      <div class="history-backdrop"></div>
      <div class="history-modal-content" style="max-width:400px;">
        <h2>Set Rewards for ${escapeHTML(habit.name)}</h2>
        <form id="rewards-form"></form>
        <button class="btn" id="save-rewards">Save</button>
        <button class="btn" id="close-rewards">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.history-backdrop').onclick = closeSetRewards;
    modal.querySelector('#close-rewards').onclick = closeSetRewards;
    document.getElementById('save-rewards').onclick = () => saveSetRewards(habitId);
  }
  // Render form
  const form = document.getElementById('rewards-form');
  form.innerHTML = LEVELS.map((level, idx) => {
    const val = habit.rewards[idx+1] || '';
    return `<div class='reward-row'><label>Level ${idx+1} (${level.name}):</label><input type='text' data-level='${idx+1}' value="${escapeHTML(val)}" placeholder='e.g. Buy a car, Get a treat...'></div>`;
  }).join('');
  modal.style.display = 'flex';
}
function closeSetRewards() {
  const modal = document.getElementById('rewards-modal');
  if (modal) modal.style.display = 'none';
}
async function saveSetRewards(habitId) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  if (!habit.rewards) habit.rewards = {};
  document.querySelectorAll('#rewards-form input[data-level]').forEach(input => {
    const level = input.getAttribute('data-level');
    const val = input.value.trim();
    if (val) habit.rewards[level] = val;
    else delete habit.rewards[level];
  });
  await saveHabitsUnified(habits);
  closeSetRewards();
  renderHabits();
  showToast('Rewards updated!');
}

// --- Daily/Weekly Reminder Popup ---
function showReminderPopup() {
  const habits = getHabits();
  const today = getToday();
  const uncompleted = habits.filter(h => h.lastCompletedDate !== today);
  if (uncompleted.length === 0) return;
  const settings = JSON.parse(localStorage.getItem('nishtha-reminder-settings') || '{"mode":"daily","time":"08:00"}');
  if (settings.mode === 'every') {
    // Show every page load
  } else if (settings.mode === 'daily') {
    if (localStorage.getItem('nishtha-reminder') === today) return;
    localStorage.setItem('nishtha-reminder', today);
  } else if (settings.mode === 'time') {
    // Only show if current time matches or has just passed the set time (within 10 min window)
    const now = new Date();
    const [h, m] = settings.time.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diff = now - target;
    if (diff < 0 || diff > 10*60*1000) return; // Only show within 10 min after set time
    if (localStorage.getItem('nishtha-reminder') === today+settings.time) return;
    localStorage.setItem('nishtha-reminder', today+settings.time);
  }
  // Popup
  const popup = document.createElement('div');
  popup.className = 'reminder-popup';
  popup.innerHTML = `
    <div class="reminder-content">
      <h3>⏰ Daily Reminder</h3>
      <p>You have <b>${uncompleted.length}</b> habit${uncompleted.length > 1 ? 's' : ''} to complete today!</p>
      <ul>${uncompleted.map(h => `<li>${escapeHTML(h.name)}</li>`).join('')}</ul>
      <button class="btn" id="close-reminder-popup">Got it!</button>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('close-reminder-popup').onclick = () => popup.remove();
}

// --- Reminder Settings Modal ---
function showReminderSettings() {
  let modal = document.getElementById('reminder-settings-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reminder-settings-modal';
    modal.innerHTML = `
      <div class="history-backdrop"></div>
      <div class="history-modal-content" style="max-width:350px;">
        <h2>Reminder Settings</h2>
        <form id="reminder-settings-form">
          <label><input type="radio" name="reminder-mode" value="every" required> Every page load</label><br>
          <label><input type="radio" name="reminder-mode" value="daily"> Once per day (default)</label><br>
          <label><input type="radio" name="reminder-mode" value="time"> At specific time: <input type="time" id="reminder-time" value="08:00"></label>
        </form>
        <button class="btn" id="save-reminder-settings">Save</button>
        <button class="btn" id="close-reminder-settings">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.history-backdrop').onclick = closeReminderSettings;
    modal.querySelector('#close-reminder-settings').onclick = closeReminderSettings;
    document.getElementById('save-reminder-settings').onclick = saveReminderSettings;
  }
  // Load current settings
  const settings = JSON.parse(localStorage.getItem('nishtha-reminder-settings') || '{"mode":"daily","time":"08:00"}');
  document.querySelector(`#reminder-settings-form input[value="${settings.mode}"]`).checked = true;
  document.getElementById('reminder-time').value = settings.time || '08:00';
  modal.style.display = 'flex';
}
function closeReminderSettings() {
  const modal = document.getElementById('reminder-settings-modal');
  if (modal) modal.style.display = 'none';
}
function saveReminderSettings() {
  const mode = document.querySelector('input[name="reminder-mode"]:checked').value;
  const time = document.getElementById('reminder-time').value;
  localStorage.setItem('nishtha-reminder-settings', JSON.stringify({mode, time}));
  closeReminderSettings();
  showToast('Reminder settings saved!');
}

// --- Browser Notification API (optional) ---
function showBrowserNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const habits = getHabits();
    const today = getToday();
    const uncompleted = habits.filter(h => h.lastCompletedDate !== today);
    if (uncompleted.length > 0) {
      // Use a unique tag so notification can be replaced if needed
      new Notification('Nishtha Reminder', {
        body: `You have ${uncompleted.length} habit${uncompleted.length > 1 ? 's' : ''} to complete today!`,
        icon: 'assets/icons/app-icon.png',
        tag: 'nishtha-daily-reminder',
        renotify: true
      });
    }
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification();
      }
    });
  }
}

// --- Data Management: Export/Import/Reset ---
function exportHabits() {
  const habits = getHabits();
  const data = JSON.stringify(habits, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nishtha-habits-backup-${getToday()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function importHabitsFromFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      if (!confirm('Importing will replace all your current habits. Continue?')) return;
      localStorage.setItem('habits', JSON.stringify(imported));
      renderHabits();
      showToast('Habits imported!');
      afterHabitChange();
    } catch (err) {
      showToast('Import failed: Invalid file.');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
  localStorage.clear();
  renderHabits();
  showToast('All data reset!');
  afterHabitChange();
}

// --- Auth Logic ---
function showAuthModal(show = true, error = '') {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = show ? 'flex' : 'none';
  document.getElementById('auth-error').textContent = error || '';
}
function setLoggedInUI(isLoggedIn) {
  document.getElementById('logout-btn').style.display = isLoggedIn ? '' : 'none';
  document.querySelector('main').style.display = isLoggedIn ? '' : 'none';
  document.querySelector('.add-habit-section').style.display = isLoggedIn ? '' : 'none';
  document.getElementById('habits-list').style.display = isLoggedIn ? '' : 'none';
}
async function handleAuthState() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    showAuthModal(false);
    setLoggedInUI(true);
    // TODO: Load habits from Supabase here
  } else {
    showAuthModal(true);
    setLoggedInUI(false);
  }
}
window.addEventListener('DOMContentLoaded', async () => {
  await renderHabits();
  checkMissedHabits();
  await checkWeeklyHabitTargets();
  setTheme(getCurrentTheme(), false);
  renderTotalStreak();
  checkThemeUnlocks();
  renderThemeDropdown();
  showReminderPopup();
  showBrowserNotification();
  // Theme gallery button (beside theme switcher)
  const themeBtn = document.getElementById('theme-switcher');
  if (themeBtn) {
    let pressTimer;
    themeBtn.onmousedown = () => { pressTimer = setTimeout(showThemeGallery, 600); };
    themeBtn.onmouseup = themeBtn.onmouseleave = () => { clearTimeout(pressTimer); };
    themeBtn.onclick = (e) => {
      if (!pressTimer) cycleTheme();
    };
    // Add a separate gallery button next to theme switcher
    let galleryBtn = document.getElementById('theme-gallery-btn');
    if (!galleryBtn) {
      galleryBtn = document.createElement('button');
      galleryBtn.id = 'theme-gallery-btn';
      galleryBtn.className = 'btn';
      galleryBtn.title = 'Open Theme Gallery';
      galleryBtn.innerHTML = '🖼️ Themes';
      themeBtn.parentNode.insertBefore(galleryBtn, themeBtn.nextSibling);
      galleryBtn.onclick = showThemeGallery;
    }
  }

  // Show/hide add habit form
  document.getElementById("show-add-habit").onclick = () => {
    document.getElementById("add-habit-form").classList.remove("hidden");
    document.getElementById("show-add-habit").style.display = "none";
  };
  document.getElementById("cancel-add-habit").onclick = () => {
    document.getElementById("add-habit-form").classList.add("hidden");
    document.getElementById("show-add-habit").style.display = "";
  };

  // Add habit submit
  document.getElementById("add-habit-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("habit-name").value.trim();
    const category = document.getElementById("habit-category").value.trim();
    if (name && category) {
      await addHabit(name, category);
      document.getElementById("add-habit-form").reset();
      document.getElementById("add-habit-form").classList.add("hidden");
      document.getElementById("show-add-habit").style.display = "";
    }
  };

  // Habit actions (mark as done, delete, view history, set rewards)
  document.getElementById("habits-list").onclick = async (e) => {
    if (e.target.matches("button[data-id]")) {
      markHabitDone(e.target.getAttribute("data-id"));
    } else if (e.target.matches("button[data-delete]")) {
      if (confirm("Delete this habit?"))
        deleteHabit(e.target.getAttribute("data-delete"));
    } else if (e.target.matches("button[data-history]")) {
      showHabitHistory(e.target.getAttribute("data-history"));
    } else if (e.target.matches("button[data-reward]")) {
      showSetRewards(e.target.getAttribute("data-reward"));
    }
  };

  // Reminder Settings button
  document.getElementById('reminder-settings-btn').onclick = showReminderSettings;

  // Export/Import/Reset buttons
  document.getElementById('export-data-btn').onclick = exportHabits;
  document.getElementById('import-data-btn').onclick = () => {
    document.getElementById('import-data-file').click();
  };
  document.getElementById('import-data-file').onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      importHabitsFromFile(e.target.files[0]);
      e.target.value = '';
    }
  };
  document.getElementById('reset-data-btn').onclick = resetAllData;

  // --- PWA Install Button Logic ---
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.style.display = '';
  });
  const installBtn = document.getElementById('install-app-btn');
  if (installBtn) {
    installBtn.style.display = 'none'; // Hide by default
    installBtn.onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('App installed!');
        }
        deferredPrompt = null;
        installBtn.style.display = 'none';
      }
    };
  }

  // Auth form logic
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthModal(true, error.message);
    } else {
      showAuthModal(false);
      setLoggedInUI(true);
      // TODO: Load habits from Supabase here
    }
  };
  document.getElementById('auth-signup-btn').onclick = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      showAuthModal(true, error.message);
    } else {
      showAuthModal(false);
      setLoggedInUI(true);
      // TODO: Load habits from Supabase here
    }
  };

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  document.getElementById('auth-google-btn').onclick = async () => {
    const redirectUrl = isMobile()
      ? 'https://prasadkankhar.me/Nishtha/'
      : 'http://prasadkankhar.me/Nishtha/';
    console.log('Google sign-in redirectTo:', redirectUrl); // For debugging
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    if (error) showAuthModal(true, error.message);
  };
  document.getElementById('logout-btn').onclick = async () => {
    await supabaseClient.auth.signOut();
    showAuthModal(true);
    setLoggedInUI(false);
    // Optionally clear localStorage or habits
  };
  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange(handleAuthState);

  // --- Dev Cheat Panel (Development Only) ---
  function showDevPanel() {
    if (document.getElementById('dev-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'dev-panel';
    panel.innerHTML = `
      <h3>🛠️ Dev Cheat Panel</h3>
      <button class="btn" id="dev-add-habit">Add Test Habit</button>
      <button class="btn" id="dev-max-streak">Max All Streaks</button>
      <button class="btn" id="dev-reset-streaks">Reset All Streaks</button>
      <button class="btn" id="dev-unlock-themes">Unlock All Themes</button>
      <div style="display:flex;gap:0.5em;align-items:center;justify-content:center;margin:0.7em 0;">
        <input type="number" id="dev-streak-increment" min="1" value="1" style="width:3.5em;padding:0.3em 0.5em;border-radius:0.7em;border:1px solid #ccc;">
        <button class="btn" id="dev-increment-streak">+ Streak All</button>
      </div>
      <button class="btn" id="dev-close">Close</button>
    `;
    document.body.appendChild(panel);
    // Button actions
    document.getElementById('dev-add-habit').onclick = () => {
      addHabit('Test Habit ' + Math.floor(Math.random()*1000), 'Dev');
    };
    document.getElementById('dev-max-streak').onclick = () => {
      let habits = getHabits();
      habits.forEach(h => { h.streakCount = 25; h.lastCompletedDate = getToday(); updateBadge(h); });
      saveHabits(habits); renderHabits(); afterHabitChange();
    };
    document.getElementById('dev-reset-streaks').onclick = () => {
      let habits = getHabits();
      habits.forEach(h => { h.streakCount = 0; h.lastCompletedDate = null; h.badge = null; });
      saveHabits(habits); renderHabits(); afterHabitChange();
    };
    document.getElementById('dev-unlock-themes').onclick = () => {
      localStorage.setItem('nishtha-unlocked-themes', JSON.stringify(THEMES.map(t=>t.key)));
      showToast('All themes unlocked for testing!');
      checkThemeUnlocks();
    };
    document.getElementById('dev-increment-streak').onclick = () => {
      const inc = parseInt(document.getElementById('dev-streak-increment').value, 10) || 1;
      let habits = getHabits();
      const today = getToday();
      habits.forEach(h => {
        for (let i = 0; i < inc; i++) {
          h.streakCount++;
          // Add today+i to history for realism (simulate consecutive days)
          let d = new Date(today);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().slice(0, 10);
          if (!h.history) h.history = [];
          if (!h.history.includes(dateStr)) h.history.push(dateStr);
          h.lastCompletedDate = dateStr;
        }
        updateBadge(h);
      });
      saveHabits(habits); renderHabits(); afterHabitChange();
      showToast('Streaks incremented!');
    };
    document.getElementById('dev-close').onclick = () => panel.remove();
  }
  // Secret key combo to open dev panel (Ctrl+Shift+D)
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      showDevPanel();
    }
  });
});


