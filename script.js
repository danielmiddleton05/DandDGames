
// A palette used to give each player a consistent, colorful avatar.
// ACAD palette — kept light enough that dark avatar initials stay readable.
const AVATAR_COLORS = [
  "#6699cf", "#78c4ab", "#eec899", "#f2a486",
  "#5d9d93", "#7db7ea", "#f68d2e", "#9ec0d4",
  "#c6e0de", "#f9bd7e",
];

// Pick a stable color for a name (same name -> same color every time).
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Build a per-player tally of wins and which games they've won.
function buildLeaderboard(results) {
  const players = {};
  for (const entry of results) {
    for (const winner of entry.winners) {
      if (!players[winner]) {
        players[winner] = { name: winner, wins: 0, games: new Set() };
      }
      players[winner].wins += 1;
      players[winner].games.add(entry.game);
    }
  }
  const sorted = Object.values(players).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });
  return assignRanks(sorted);
}

function assignRanks(leaderboard) {
  let rank = 0;
  let prevWins = null;
  leaderboard.forEach((p) => {
    if (p.wins !== prevWins) {
      rank += 1;
      prevWins = p.wins;
    }
    p.rank = rank;
  });

  const countPerRank = {};
  leaderboard.forEach((p) => {
    countPerRank[p.rank] = (countPerRank[p.rank] || 0) + 1;
  });
  leaderboard.forEach((p) => {
    p.tie = countPerRank[p.rank] > 1;
  });

  return leaderboard;
}

/* ---------- Stat strip ---------- */
function renderStats(results, leaderboard) {
  const uniqueGames = new Set(results.map((r) => r.game));
  const stats = [
    { num: results.length, label: "Games Played" },
    { num: leaderboard.length, label: "Champions" },
    { num: uniqueGames.size, label: "Game Types" },
  ];
  document.getElementById("statStrip").innerHTML = stats
    .map(
      (s) => `
      <div class="stat-pill">
        <div class="num">${s.num}</div>
        <div class="label">${s.label}</div>
      </div>`
    )
    .join("");
}

function arrangeForPodium(top) {
  const golds = top.filter((p) => p.rank === 1);
  const rest = top.filter((p) => p.rank !== 1);

  const left = [];
  const right = [];
  rest.forEach((p, i) => {
    (i % 2 === 0 ? left : right).push(p);
  });


  return [...left.reverse(), ...golds, ...right];
}

/* ---------- Podium (top 3 ranks) ---------- */
function renderPodium(leaderboard) {
  const medalByRank = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const classByRank = { 1: "rank-1", 2: "rank-2", 3: "rank-3" };

  const top = leaderboard.filter((p) => p.rank <= 3);
  const arranged = arrangeForPodium(top);

  document.getElementById("podium").innerHTML = arranged
    .map(
      (p, i) => `
      <div class="podium-card ${classByRank[p.rank]}" style="animation-delay:${i * 0.08}s">
        <span class="rank-num">${p.tie ? "T-" : "#"}${p.rank}</span>
        <div class="medal">${medalByRank[p.rank]}</div>
        <div class="avatar">${initials(p.name)}</div>
        <div class="name">${p.name}</div>
        <div class="wins">${p.wins} ${p.wins === 1 ? "win" : "wins"}${
        p.tie ? " · tie" : ""
      }</div>
      </div>`
    )
    .join("");
}

/* ---------- Full standings ---------- */
function renderStandings(leaderboard) {
  document.getElementById("standings").innerHTML = leaderboard
    .map((p) => {
      const gameList = Array.from(p.games).join(", ");
      return `
      <div class="standing-row">
        <div class="pos">${p.tie ? "T" : ""}${p.rank}</div>
        <div class="avatar-sm" style="background:${colorForName(p.name)}">${initials(
        p.name
      )}</div>
        <div>
          <div class="player-name">${p.name}</div>
          <div class="player-games">${gameList}</div>
        </div>
        <div class="win-count">${p.wins} ${p.wins === 1 ? "win" : "wins"}</div>
      </div>`;
    })
    .join("");
}

/* ---------- Game history timeline ---------- */
function parseDateParts(dateStr) {
  // Expects something like "Aug 21, 2026"; falls back gracefully.
  const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (match) return { month: match[1], day: match[2] };
  return { month: "", day: dateStr };
}

function renderTimeline(results) {
  // Sort newest first by parsing the date string into a real Date.
  const sorted = [...results].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // Recaps keyed by date; falls back to an empty object if none defined.
  const history = typeof GAME_HISTORY !== "undefined" ? GAME_HISTORY : {};

  document.getElementById("timeline").innerHTML = sorted
    .map((entry) => {
      const { month, day } = parseDateParts(entry.date);
      const tags = entry.winners
        .map((w) => `<span class="winner-tag">🏅 ${w}</span>`)
        .join("");
      const recap = history[entry.date];
      const hasRecap = Boolean(recap);

      // Only cards that have a recap become interactive/expandable.
      const cardAttrs = hasRecap
        ? ' class="timeline-card has-recap" role="button" tabindex="0" aria-expanded="false"'
        : ' class="timeline-card"';

      const recapBlock = hasRecap
        ? `<div class="recap"><p>${recap}</p></div>`
        : "";

      const chevron = hasRecap
        ? '<div class="chevron" aria-hidden="true">▾</div>'
        : "";

      return `
      <div${cardAttrs}>
        <div class="timeline-main">
          <div class="date-chip">
            <div class="month">${month}</div>
            <div class="day">${day}</div>
          </div>
          <div class="game-info">
            <div class="game-name">${entry.game}</div>
            <div class="winner-tags">${tags}</div>
          </div>
          ${chevron}
        </div>
        ${recapBlock}
      </div>`;
    })
    .join("");

  wireUpTimeline();
}

function wireUpTimeline() {
  const cards = document.querySelectorAll(".timeline-card.has-recap");
  cards.forEach((card) => {
    const toggle = () => {
      const isOpen = card.classList.toggle("open");
      card.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/* ---------- Boot ---------- */
function init() {
  const results = typeof GAME_RESULTS !== "undefined" ? GAME_RESULTS : [];
  const leaderboard = buildLeaderboard(results);

  renderStats(results, leaderboard);
  renderPodium(leaderboard);
  renderStandings(leaderboard);
  renderTimeline(results);
}

document.addEventListener("DOMContentLoaded", init);
