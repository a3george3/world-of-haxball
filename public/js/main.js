// =========================================
//  RANKING – TOP LEAGUES TODAY (SIDEBAR)
// =========================================

let voteToastTimer = null;

function showVoteToast(message, isError = false) {
  const toast = document.getElementById("vote-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("error", "show");

  if (isError) {
    toast.classList.add("error");
  }

  // forțăm reflow ca să resetăm animația
  void toast.offsetWidth;

  toast.classList.add("show");

  if (voteToastTimer) {
    clearTimeout(voteToastTimer);
  }
  voteToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// =========================================
// THREAD TOAST (independent)
// =========================================

let threadToastTimer = null;

function showThreadToast(message, isError = false) {
  const toast = document.getElementById("thread-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("show", "error");

  if (isError) {
    toast.classList.add("error");
  }

  void toast.offsetWidth;

  toast.classList.add("show");

  if (threadToastTimer) {
    clearTimeout(threadToastTimer);
  }

  threadToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// încarcă lista cu ligile din /api/leagues/ranking
async function loadRanking(options = {}) {
  const { full = false, containerId = "ranking-list" } = options;
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "Loading...";

  try {
    const url = full ? "/api/leagues/ranking/full" : "/api/leagues/ranking";
    const res = await fetch(url);
    const leagues = await res.json();

    container.innerHTML = "";
    if (!leagues.length) {
      container.innerHTML = "<p>No leagues yet.</p>";
      return;
    }

    leagues.forEach((league, index) => {
      const votes = league.votes_today || 0;

      const item = document.createElement("article");
      item.className = "ranking-item";

      const logoHtml = league.logo_url
        ? `<div class="ranking-logo">
             <img src="${league.logo_url}" alt="${league.name} logo">
           </div>`
        : `<div class="ranking-logo placeholder">
             <span>${(league.name || "?").charAt(0)}</span>
           </div>`;

      const logoInline = league.logo_url
        ? `<img class="ranking-logo-inline" src="${league.logo_url}" alt="${league.name} logo">`
        : `<span class="ranking-logo-inline placeholder">${(league.name || "?").charAt(0)}</span>`;

      item.innerHTML = `
  <div class="ranking-left">
    <div class="ranking-header-row">
      <span class="ranking-position">#${index + 1}</span>
      ${logoInline}
      <span class="ranking-name">${league.name}</span>
    </div>
    <div class="ranking-meta">
      ${league.region || "N/A"}
    </div>
  </div>

  <div class="ranking-right">
    <button class="ranking-vote-btn" data-league-id="${league.id}">
      <span class="vote-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6l1-5-7 7v11h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"/>
        </svg>
      </span>
      <span class="vote-count">${votes}</span>
    </button>
  </div>
`;

      container.appendChild(item);
    });

    // reatașezi event listeners pentru vote
    container.querySelectorAll(".ranking-vote-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const leagueId = btn.getAttribute("data-league-id");
        voteForLeague(leagueId);
      });
    });
  } catch (err) {
    console.error("Error loading ranking:", err);
    container.innerHTML = "<p>Could not load ranking.</p>";
  }
}

// trimite un vot către backend pentru o ligă
async function voteForLeague(leagueId) {
  try {
    const res = await fetch(`/api/leagues/${leagueId}/vote`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        showVoteToast("You need to be logged in to vote.", true);
      } else {
        showVoteToast(data.message || "Could not register your vote.", true);
      }
      return;
    }

    showVoteToast(data.message || "You voted successfully!");
    loadRanking(); // reîncarcă lista după vot
  } catch (err) {
    console.error("Vote error:", err);
    showVoteToast("Something went wrong while voting.", true);
  }
}

// =========================================
//  AUTH STATUS + NAVBAR USER
// =========================================

async function checkAuthStatus() {
  try {
    const res = await fetch("/api/auth/me");

    if (!res.ok) {
      updateNavbarForUser(null);
      return;
    }

    const user = await res.json();
    updateNavbarForUser(user);
  } catch {
    updateNavbarForUser(null);
  }
}

function updateNavbarForUser(user) {
  const loginItem = document.getElementById("nav-login-item");
  const navUser = document.getElementById("nav-user");
  const navUsername = document.getElementById("nav-username");

  // Ținem user-ul curent global, ca să știm cine e când afișăm reply-urile
  window.currentUser = user || null;

  if (!loginItem || !navUser || !navUsername) return;

  if (user) {
    loginItem.style.display = "none";
    navUser.style.display = "flex";
    navUsername.textContent = user.username;
  } else {
    loginItem.style.display = "";
    navUser.style.display = "none";
    navUsername.textContent = "";
  }
}

// =========================================
//  FORUM – LISTĂ THREADS + CREARE THREAD
// =========================================

// ===== Forum pagination state =====
let forumCurrentPage = 1;
const FORUM_PAGE_SIZE = 10;

async function loadForumThreads(page = 1) {
  const listEl = document.getElementById("forum-threads-list");
  const countEl = document.getElementById("forum-threads-count");
  const paginationEl = document.getElementById("forum-pagination");

  if (!listEl) return; // nu suntem pe forum.html

  forumCurrentPage = page;

  try {
    const res = await fetch(
      `/api/forum/threads?page=${page}&limit=${FORUM_PAGE_SIZE}`,
    );
    if (!res.ok) {
      console.error("Failed to load threads:", res.status);
      listEl.innerHTML = "<p>Could not load threads.</p>";
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }

    const data = await res.json();
    const threads = data.threads || [];
    const total = data.total ?? threads.length;
    const pageSize = data.pageSize || FORUM_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    listEl.innerHTML = "";

    if (!threads.length) {
      listEl.innerHTML = "<p>No threads yet. Be the first to start one.</p>";
      if (countEl) countEl.textContent = "0 threads";
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }

    threads.forEach((t) => {
      const item = document.createElement("article");
      item.className = "forum-thread-item";

      const repliesCount = t.reply_count || 0;

      const lastInfo = t.last_reply_author
        ? `Last reply by ${t.last_reply_author}`
        : "No replies yet";

      item.innerHTML = `
        <div class="forum-thread-main">
          <h3 class="forum-thread-title">${t.title}</h3>
          <div class="forum-thread-meta">
            <span>by ${t.author}</span>
            <span>• ${t.category || "general"}</span>
            <span>• ${new Date(t.created_at).toLocaleString()}</span>
            <span class="forum-thread-last">• ${lastInfo}</span>
          </div>
        </div>
        <div class="forum-thread-stats">
          <span class="forum-thread-replies">${repliesCount}</span>
        </div>
      `;

      item.addEventListener("click", () => {
        window.location.href = `thread.html?id=${t.id}`;
      });

      listEl.appendChild(item);
    });

    // textul cu numărul de threaduri – folosim TOTAL, nu doar pe pagină
    if (countEl) {
      countEl.textContent = total === 1 ? "1 thread" : `${total} threads`;
    }

    // ----- Paginare (Prev / Next) -----
    if (paginationEl) {
      if (totalPages <= 1) {
        paginationEl.innerHTML = "";
      } else {
        paginationEl.innerHTML = "";

        const prevBtn = document.createElement("button");
        prevBtn.textContent = "← Previous";
        prevBtn.className = "forum-page-btn";
        prevBtn.disabled = page <= 1;
        prevBtn.addEventListener("click", () => {
          if (page > 1) loadForumThreads(page - 1);
        });

        const infoSpan = document.createElement("span");
        infoSpan.className = "forum-page-info";
        infoSpan.textContent = `Page ${page} of ${totalPages}`;

        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Next →";
        nextBtn.className = "forum-page-btn";
        nextBtn.disabled = page >= totalPages;
        nextBtn.addEventListener("click", () => {
          if (page < totalPages) loadForumThreads(page + 1);
        });

        paginationEl.appendChild(prevBtn);
        paginationEl.appendChild(infoSpan);
        paginationEl.appendChild(nextBtn);
      }
    }
  } catch (err) {
    console.error("Forum threads error:", err);
    listEl.innerHTML = "<p>Server error loading threads.</p>";
    if (paginationEl) paginationEl.innerHTML = "";
  }
}

function setupNewThreadForm() {
  const form = document.getElementById("new-thread-form");
  const msg = document.getElementById("forum-new-thread-message");
  if (!form || !msg) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("thread-title").value.trim();
    const category = document.getElementById("thread-category").value;
    const content = document.getElementById("thread-content").value.trim();

    const MAX_TITLE_LEN = 80;

    if (!title || !content) {
      msg.textContent = "Please fill title and message.";
      msg.classList.add("error");
      return;
    }

    if (title.length > MAX_TITLE_LEN) {
      msg.textContent = `Title must be at most ${MAX_TITLE_LEN} characters.`;
      msg.classList.add("error");
      return;
    }

    try {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // înainte: body: JSON.stringify({ title, category, content }),
        body: JSON.stringify({
          title,
          body: content, // <= AICI e cheia
          category, // serverul o ignoră momentan, dar nu deranjează
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          res.status === 401
            ? "You must be logged in to post."
            : data.message || "Could not create thread.";

        msg.textContent = errorMessage;
        msg.classList.add("error");

        // 🔔 toast roșu pentru eroare
        showThreadToast(errorMessage, true);
        return;
      }

      // ✅ succes
      msg.textContent = "";
      msg.classList.remove("error", "success");

      form.reset();

      // 🔔 toast verde care coboară de sus
      showThreadToast("Thread posted successfully!");

      // ⏩ redirect la pagina de forum după 1.5 secunde
      setTimeout(() => {
        window.location.href = "forum.html";
      }, 1500);
    } catch (err) {
      console.error("New thread error:", err);
      msg.textContent = "Server error.";
      msg.classList.add("error");

      // 🔔 toast roșu și pentru erori de server
      showThreadToast("Server error.", true);
    }
  });
}

// =====================
// FORMATĂRI TEXT (Markdown light)
// =====================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractYouTubeId(url) {
  try {
    // scoatem eventualele ghilimele / spații
    const cleanUrl = url.split('"')[0];

    // format scurt: https://youtu.be/VIDEOID
    const shortIndex = cleanUrl.indexOf("youtu.be/");
    if (shortIndex !== -1) {
      const idPart = cleanUrl.substring(shortIndex + "youtu.be/".length);
      return idPart.split(/[?&#]/)[0]; // oprim la ? sau & sau #
    }

    // format lung: https://www.youtube.com/watch?v=VIDEOID
    const watchIndex = cleanUrl.indexOf("watch?v=");
    if (watchIndex !== -1) {
      const idPart = cleanUrl.substring(watchIndex + "watch?v=".length);
      return idPart.split(/[?&#]/)[0];
    }

    return null;
  } catch (e) {
    console.error("extractYouTubeId error:", e);
    return null;
  }
}

function renderFormattedText(raw) {
  let safe = escapeHtml(raw || "");

  // **bold**
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // *italic*
  safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // @username -> badge de mențiune
  safe = safe.replace(
    /@([a-zA-Z0-9_]{2,24})/g,
    '<span class="mention-tag">@$1</span>',
  );

  // 1) link-uri simple
  safe = safe.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // 2) newline -> <br>
  safe = safe.replace(/\n/g, "<br>");

  // 3) transformăm link-urile YouTube în iframe
  safe = safe.replace(
    /<a href="(https?:\/\/[^"]+)"[^>]*>[^<]+<\/a>/g,
    (match, url) => {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return match;
      }

      return `
        <div class="video-embed">
          <iframe
            src="https://www.youtube.com/embed/${videoId}"
            title="YouTube video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      `;
    },
  );

  return safe;
}
// =========================================
//  FORUM – PAGINA UNUI SINGUR THREAD
// =========================================

async function loadThreadPage() {
  const container = document.getElementById("thread-view");
  if (!container) return; // nu suntem pe thread.html

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    container.innerHTML = "<p>Thread not found.</p>";
    return;
  }

  try {
    const res = await fetch(`/api/forum/threads/${id}`);
    if (!res.ok) {
      container.innerHTML = "<p>Could not load thread.</p>";
      return;
    }

    const data = await res.json();
    const thread = data.thread;
    const replies = data.replies || [];

    container.innerHTML = `
      <header class="forum-header">
        <div class="header-div">
          <h1>${thread.title}</h1>
          <p class="forum-subtitle">
            by ${thread.author} • ${thread.category || "general"} •
            ${new Date(thread.created_at).toLocaleString()}
          </p>

          <div class="thread-body">
  ${renderFormattedText(thread.body)}
</div>
        </div>
      </header>

      <section class="thread-replies">
        <h2>${replies.length} replies</h2>
        <div id="thread-replies-list"></div>
      </section>
    `;

    const repliesList = document.getElementById("thread-replies-list");
    if (!repliesList) return;

    if (replies.length === 0) {
      repliesList.innerHTML = "<p>No replies yet.</p>";
    } else {
      repliesList.innerHTML = "";
      replies.forEach((r) => {
  const div = document.createElement("div");
  div.className = "thread-reply";

  // cine e logat acum?
  const cu = window.currentUser || null;
  const canDelete =
    cu && (cu.is_admin || cu.username === r.author);

  // dacă e reply la alt reply, construim un mic citat
  let quoteHtml = "";
  if (r.parent_id && r.parent_body && r.parent_author) {
    const parentSnippet =
      r.parent_body.length > 120
        ? r.parent_body.slice(0, 120) + "…"
        : r.parent_body;

    quoteHtml = `
      <div class="reply-quote-box inline-quote">
        <div class="reply-quote-author">Replying to ${r.parent_author}</div>
        <div class="reply-quote-text">${renderFormattedText(parentSnippet)}</div>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="thread-reply-meta">
      <div class="thread-reply-meta-left">
        <span class="reply-author">${r.author}</span>
        <span class="reply-date">• ${new Date(
          r.created_at,
        ).toLocaleString()}</span>
      </div>

      <div class="thread-reply-meta-right">
        <button
          class="thread-reply-btn"
          data-reply-id="${r.id}"
          data-author="${r.author}"
        >
          Reply
        </button>

        ${
          canDelete
            ? `
          <button
            class="thread-reply-delete-btn"
            data-reply-id="${r.id}"
            title="Delete reply"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M9 3v1H4v2h16V4h-5V3H9zm1 5v9h2V8h-2zm4 0v9h2V8h-2zM6 8v9h2V8H6z"/>
            </svg>
          </button>
        `
            : ""
        }
      </div>
    </div>

    ${quoteHtml}
    <p>${renderFormattedText(r.body)}</p>
  `;

  repliesList.appendChild(div);
});

      // attach click pentru butoanele "Reply"
      const quoteBox = document.getElementById("reply-quote-box");
      const parentInput = document.getElementById("reply-parent-id");
      const textarea = document.getElementById("reply-body");

      document.querySelectorAll(".thread-reply-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!quoteBox || !parentInput || !textarea) return;

          const replyId = btn.dataset.replyId;
          const author = btn.dataset.author || "user";

          const bodyText =
            btn.closest(".thread-reply").querySelector("p")?.textContent || "";
          const snippet =
            bodyText.length > 120 ? bodyText.slice(0, 120) + "…" : bodyText;

          parentInput.value = replyId;
          quoteBox.innerHTML = `
            <div class="reply-quote-author">Replying to ${author}</div>
            <div class="reply-quote-text">${renderFormattedText(snippet)}</div>
          `;
          quoteBox.classList.add("visible");

          textarea.focus();
        });
      });
      // --- attach click pentru delete
const params2 = new URLSearchParams(window.location.search);
const threadId = params2.get("id");

document.querySelectorAll(".thread-reply-delete-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const replyId = btn.getAttribute("data-reply-id");
    if (!threadId || !replyId) return;

    const ok = confirm("Delete this reply?");
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/forum/threads/${threadId}/replies/${replyId}`,
        { method: "DELETE" },
      );

      const data = await res.json();

      if (!res.ok) {
        showThreadToast(data.message || "Could not delete reply.", true);
        return;
      }

      // scoatem reply-ul din DOM
      const wrapper = btn.closest(".thread-reply");
      if (wrapper) wrapper.remove();

      // actualizăm textul "X replies" din header
      const h2 = document.querySelector(".thread-replies > h2");
      if (h2) {
        const current = parseInt(h2.textContent, 10) || 0;
        h2.textContent = `${Math.max(current - 1, 0)} replies`;
      }

      showThreadToast("Reply deleted.");
    } catch (err) {
      console.error("Delete reply error:", err);
      showThreadToast("Server error deleting reply.", true);
    }
  });
});
    }
  } catch (err) {
    console.error("Thread page error:", err);
    container.innerHTML = "<p>Server error.</p>";
  }
}

function setupReplyForm() {
  const form = document.getElementById("reply-form");
  const msg = document.getElementById("reply-message");
  if (!form || !msg) return; // nu suntem pe thread.html

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const parentInput = document.getElementById("reply-parent-id");
  const quoteBox = document.getElementById("reply-quote-box");
  const textarea = document.getElementById("reply-body");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = textarea.value.trim();
    if (!body) {
      const errorMessage = "Reply cannot be empty.";
      msg.textContent = errorMessage;
      msg.classList.add("error");

      showThreadToast(errorMessage, true);
      return;
    }

    const parentReplyId = parentInput ? parentInput.value || null : null;

    try {
      const res = await fetch(`/api/forum/threads/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentReplyId }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          res.status === 401
            ? "You must be logged in to reply."
            : data.message || "Could not post reply.";

        msg.textContent = errorMessage;
        msg.classList.add("error");

        showThreadToast(errorMessage, true);
        return;
      }

      // succes
      msg.textContent = "Reply posted.";
      msg.classList.remove("error");
      msg.classList.add("success");
      form.reset();

      // resetăm citatul
      if (parentInput) parentInput.value = "";
      if (quoteBox) {
        quoteBox.innerHTML = "";
        quoteBox.classList.remove("visible");
      }

      showThreadToast("Reply posted!");

      // ⏩ redirect la forum după ~1.5 secunde
      setTimeout(() => {
        window.location.href = "forum.html";
      }, 1500);
    } catch (err) {
      console.error("Reply error:", err);
      msg.textContent = "Server error.";
      msg.classList.add("error");

      showThreadToast("Server error.", true);
    }
  });
}

function initProsettingsTable() {
  const table = document.querySelector(".player-settings");
  if (!table) return; // nu suntem pe prosettings.html

  const rows = Array.from(table.querySelectorAll("tr.player-row"));

  rows.forEach((row) => {
    const btn = row.querySelector(".toggle-details");
    if (!btn) return;

    const detailsRow = row.nextElementSibling;
    // ne asigurăm că următorul rând e chiar .player-details
    if (!detailsRow || !detailsRow.classList.contains("player-details")) return;

    // ascundem by default (în caz că nu e ascuns din CSS)
    detailsRow.style.display = "none";

    btn.addEventListener("click", () => {
      const isOpen = detailsRow.style.display === "table-row";

      if (isOpen) {
        detailsRow.style.display = "none";
        btn.textContent = "+"; // închis
      } else {
        detailsRow.style.display = "table-row";
        btn.textContent = "−"; // deschis
      }
    });
  });
}

// =========================================
//  PLAYER COMPARISON (nik vs Levitan)
// =========================================

async function loadComparisonSummary() {
  const scoreNikEl = document.getElementById("cmp-nik-score");
  const scoreLevEl = document.getElementById("cmp-lev-score");
  const totalVotesEl = document.getElementById("cmp-total-votes");

  // dacă nu suntem pe pagina cu cardul, ieșim
  if (!scoreNikEl || !scoreLevEl || !totalVotesEl) return;

  try {
    const res = await fetch("/api/comparison/nik-levitan");
    if (!res.ok) {
      console.error("Comparison summary error:", res.status);
      return;
    }

    const data = await res.json();

    // scor general (cele 5 categorii -> 0–5 puncte)
    scoreNikEl.textContent = data.nikScore ?? 0;
    scoreLevEl.textContent = data.levScore ?? 0;

    // total voturi
    totalVotesEl.textContent = data.totalVotes ?? 0;

    // dacă ai în HTML și <span id="am-total-votes"> poți umple și acolo:
    const totalExtra = document.getElementById("am-total-votes");
    if (totalExtra) {
      totalExtra.textContent = data.totalVotes ?? 0;
    }

    // umplem și detaliile pe categorii (dacă există panelul)
    updateComparisonDetails(data);
  } catch (err) {
    console.error("Comparison summary fetch error:", err);
  }
}

function updateComparisonDetails(summary) {
  const cats = summary && summary.categories;
  if (!cats) return;

  // dacă nu există panelul, nu facem nimic
  const testEl = document.getElementById("am-gameiq-nik");
  if (!testEl) return;

  const mapping = [
    { catKey: "game_iq", nikId: "am-gameiq-nik", levId: "am-gameiq-levitan" },
    { catKey: "skill", nikId: "am-skill-nik", levId: "am-skill-levitan" },
    {
      catKey: "positioning",
      nikId: "am-positioning-nik",
      levId: "am-positioning-levitan",
    },
    {
      catKey: "finishing",
      nikId: "am-finishing-nik",
      levId: "am-finishing-levitan",
    },
    {
      catKey: "defending",
      nikId: "am-defending-nik",
      levId: "am-defending-levitan",
    },
  ];

  mapping.forEach(({ catKey, nikId, levId }) => {
    const cat = cats[catKey] || {};

    // în JSON vine { nik: number, Levitan: number } (cu L mare)
    const nikVal = cat.nik ?? 0;
    const levVal = cat.Levitan ?? cat.levitan ?? 0;

    const nikEl = document.getElementById(nikId);
    const levEl = document.getElementById(levId);

    if (nikEl) nikEl.textContent = nikVal;
    if (levEl) levEl.textContent = levVal;
  });
}

function setupAmDetailsToggle() {
  const btn = document.getElementById("am-details-toggle");
  const panel = document.getElementById("am-details-panel");

  if (!btn || !panel) return;

  btn.addEventListener("click", () => {
    panel.classList.toggle("am-details-panel-hidden");
    btn.classList.toggle("am-details-toggle-open");
    // Dacă vrei să schimbi și textul, decomentează:
    // const label = btn.childNodes[0]; // primul text node
    // if (label && label.nodeType === Node.TEXT_NODE) {
    //   label.textContent = panel.classList.contains("am-details-panel-hidden")
    //     ? "Extend vote details "
    //     : "Hide vote details ";
    // }
  });
}

function setupComparisonVoting() {
  const form = document.getElementById("comparison-form");
  const msg = document.getElementById("comparison-message");
  if (!form || !msg) return; // nu suntem pe index sau nu există secțiunea

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = {
      game_iq: formData.get("game_iq"),
      skill: formData.get("skill"),
      positioning: formData.get("positioning"),
      finishing: formData.get("finishing"),
      defending: formData.get("defending"),
    };

    // verificăm că toate sunt completate
    for (const [key, value] of Object.entries(payload)) {
      if (!value) {
        msg.textContent = "Please vote in all categories.";
        msg.classList.add("error");
        showVoteToast("Please vote in all categories.", true);
        return;
      }
    }

    try {
      const res = await fetch("/api/comparison/nik-levitan/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          res.status === 401
            ? "You must be logged in to vote."
            : data.message || "Could not register your vote.";

        msg.textContent = errorMessage;
        msg.classList.remove("success");
        msg.classList.add("error");

        showVoteToast(errorMessage, true);
        return;
      }

      msg.textContent = "Thank you for your vote!";
      msg.classList.remove("error");
      msg.classList.add("success");

      showVoteToast("Vote recorded successfully!");

      // reîncărcăm sumarul
      loadComparisonSummary();

      // opțional: blocăm formularul după vot
      Array.from(form.elements).forEach((el) => {
        if (el.tagName === "INPUT" || el.tagName === "BUTTON") {
          el.disabled = true;
        }
      });
    } catch (err) {
      console.error("Comparison vote error:", err);
      msg.textContent = "Server error while voting.";
      msg.classList.remove("success");
      msg.classList.add("error");
      showVoteToast("Server error while voting.", true);
    }
  });

  // la load, aducem și sumarul
  loadComparisonSummary();
}

// function setupAmDetailsToggle() {
//   const btn = document.getElementById("am-details-toggle");
//   const panel = document.getElementById("am-details-panel");

//   if (!btn || !panel) return;

//   // containerul secțiunii de comparație (ca să-l ținem fix)
//   const container =
//     btn.closest(".comparison-inner") ||
//     btn.closest(".comparison-section") ||
//     document.body;

//   btn.addEventListener("click", () => {
//     // poziția verticală a secțiunii înainte de toggle
//     const topBefore =
//       container.getBoundingClientRect().top + window.scrollY;

//     // deschidem / închidem panelul
//     panel.classList.toggle("am-details-panel-hidden");
//     btn.classList.toggle("am-details-toggle-open");

//     // readucem secțiunea la aceeași poziție în viewport
//     window.scrollTo({
//       top: topBefore,
//       left: window.scrollX,
//       behavior: "instant" in window ? "instant" : "auto",
//     });
//   });
// }

// function initComparisonParticles() {
//   const canvas = document.getElementById("comparison-particles");
//   if (!canvas) return;

//   const ctx = canvas.getContext("2d");

//   function resize() {
//     const dpr = window.devicePixelRatio || 1;
//     const rect = canvas.getBoundingClientRect();
//     canvas.width = rect.width * dpr;
//     canvas.height = rect.height * dpr;
//     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
//   }

//   resize();
//   window.addEventListener("resize", resize);

//   // -------- CONFIG --------
//   const orbCount = 40;     // „nebuloase” mari care pulsează
//   const sparkCount = 140;  // scântei cu dâră
//   const sparks = [];
//   const orbs = [];

//   // centrele: stânga (nik), centru (VS), dreapta (Levitan)
//   function getEmitters() {
//     const rect = canvas.getBoundingClientRect();
//     const w = rect.width;
//     const h = rect.height;

//     return {
//       left: { x: w * 0.23, y: h * 0.55 },
//       center: { x: w * 0.5, y: h * 0.45 },
//       right: { x: w * 0.77, y: h * 0.55 },
//     };
//   }

//   // inițializare orbs (bule mari luminoase)
//   const emit = getEmitters();
//   for (let i = 0; i < orbCount; i++) {
//     const side = i < orbCount / 3 ? "left" : i < (2 * orbCount) / 3 ? "center" : "right";
//     const base = emit[side];

//     orbs.push({
//       side,
//       baseX: base.x + (Math.random() - 0.5) * 70,
//       baseY: base.y + (Math.random() - 0.5) * 70,
//       radius: 12 + Math.random() * 18,
//       angle: Math.random() * Math.PI * 2,
//       speed: 0.01 + Math.random() * 0.02,
//       offset: 6 + Math.random() * 10,
//       hue:
//         side === "left"
//           ? 18 + Math.random() * 20 // roșiatic
//           : side === "right"
//           ? 205 + Math.random() * 20 // albastru
//           : 130 + Math.random() * 20, // verde
//       alphaBase: 0.25 + Math.random() * 0.3,
//     });
//   }

//   // inițializare scântei
//   function spawnSpark(burstSide) {
//     const emitters = getEmitters();
//     const side =
//       burstSide ||
//       (Math.random() < 0.4 ? "left" : Math.random() < 0.7 ? "right" : "center");

//     const base = emitters[side];

//     const angle =
//       side === "left"
//         ? -0.2 + Math.random() * 0.8 // răspândire spre dreapta
//         : side === "right"
//         ? (Math.PI - 0.6) + Math.random() * 0.8 // răspândire spre stânga
//         : -Math.PI / 2 + (Math.random() - 0.5) * 1.4; // centru

//     const speed = 1.1 + Math.random() * 1.9;

//     const hue =
//       side === "left"
//         ? 10 + Math.random() * 30
//         : side === "right"
//         ? 200 + Math.random() * 30
//         : 120 + Math.random() * 30;

//     sparks.push({
//       side,
//       x: base.x + (Math.random() - 0.5) * 35,
//       y: base.y + (Math.random() - 0.5) * 35,
//       prevX: base.x,
//       prevY: base.y,
//       vx: Math.cos(angle) * speed,
//       vy: Math.sin(angle) * speed,
//       life: 0,
//       maxLife: 40 + Math.random() * 30,
//       hue,
//     });

//     if (sparks.length > sparkCount) {
//       sparks.splice(0, sparks.length - sparkCount);
//     }
//   }

//   // pre-spawn câteva scântei
//   for (let i = 0; i < sparkCount / 2; i++) spawnSpark();

//   let lastTime = performance.now();
//   let burstTimer = 0;

//   function animate(now) {
//     requestAnimationFrame(animate);
//     const dt = (now - lastTime) || 16;
//     lastTime = now;

//     const rect = canvas.getBoundingClientRect();
//     const w = rect.width;
//     const h = rect.height;

//     // fundal „motion blur” pentru dâre
//     ctx.globalCompositeOperation = "source-over";
//     ctx.fillStyle = "rgba(0, 4, 20, 0.45)";
//     ctx.fillRect(0, 0, w, h);

//     // ORBS – nebuloase pulsante
//     ctx.globalCompositeOperation = "lighter";
//     orbs.forEach((o) => {
//       o.angle += o.speed * dt * 0.05;

//       const ox = Math.cos(o.angle) * o.offset;
//       const oy = Math.sin(o.angle) * o.offset;

//       const x = o.baseX + ox;
//       const y = o.baseY + oy;

//       const pulse = 0.5 + Math.sin(now * 0.002 + o.angle) * 0.3;
//       const alpha = o.alphaBase * (0.6 + pulse * 0.8);

//       const radius = o.radius * (0.7 + pulse * 0.4);

//       const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
//       gradient.addColorStop(0, `hsla(${o.hue}, 100%, 65%, ${alpha})`);
//       gradient.addColorStop(1, `hsla(${o.hue}, 100%, 10%, 0)`);

//       ctx.beginPath();
//       ctx.fillStyle = gradient;
//       ctx.arc(x, y, radius, 0, Math.PI * 2);
//       ctx.fill();
//     });

//     // SCÂNTEI – dâre agresive
//     sparks.forEach((s) => {
//       s.life += dt * 0.06;
//       if (s.life > s.maxLife) {
//         // re-spawn
//         s.life = 0;
//         const side = Math.random() < 0.5 ? "left" : "right";
//         spawnSpark(side);
//         return;
//       }

//       s.prevX = s.x;
//       s.prevY = s.y;
//       s.x += s.vx;
//       s.y += s.vy;

//       // ușor „gravitație” spre centru vertical
//       s.vy += (Math.random() - 0.5) * 0.04;

//       const t = 1 - s.life / s.maxLife;
//       const alpha = Math.max(0, t);
//       const width = 1.2 + (1 - t) * 2.4;

//       ctx.beginPath();
//       ctx.moveTo(s.prevX, s.prevY);
//       ctx.lineTo(s.x, s.y);
//       ctx.strokeStyle = `hsla(${s.hue}, 100%, 65%, ${alpha})`;
//       ctx.lineWidth = width;
//       ctx.stroke();
//     });

//     // din când în când, burst mare
//     burstTimer += dt;
//     if (burstTimer > 900 + Math.random() * 900) {
//       burstTimer = 0;
//       const sideRand = Math.random();
//       const side =
//         sideRand < 0.4 ? "left" : sideRand < 0.8 ? "right" : "center";
//       for (let i = 0; i < 18; i++) {
//         spawnSpark(side);
//       }
//     }
//   }

//   requestAnimationFrame(animate);
// }

// =========================================
//  SIDEBAR – LAST 5 FORUM THREADS
// =========================================

async function loadLatestForumThreads() {
  const container = document.getElementById("latest-threads-list");
  if (!container) return;

  container.innerHTML = "Loading...";

  try {
    const res = await fetch("/api/forum/threads/latest");
    if (!res.ok) {
      container.innerHTML = "<p>Could not load discussions.</p>";
      return;
    }

    const threads = await res.json();
    container.innerHTML = "";

    if (!threads.length) {
      container.innerHTML = "<p>No discussions yet.</p>";
      return;
    }

    threads.forEach((t, index) => {
      const item = document.createElement("div");
      item.className = "latest-thread-item";

      const repliesCount = t.reply_count || 0;
      const isHot = repliesCount > 10;

      const lastInfo = t.last_reply_author
        ? `Last reply by ${t.last_reply_author}`
        : "No replies yet";

      // ===== NEW badge logic (reply < 24h) =====
      let isNew = false;

      if (t.last_reply_at) {
        const lastReplyDate = new Date(t.last_reply_at);
        const now = new Date();
        const diffHours = (now - lastReplyDate) / (1000 * 60 * 60);
        if (diffHours < 24) {
          isNew = true;
        }
      }

      item.innerHTML = `
        <div class="latest-thread-left">
          <div class="latest-thread-title">
            ${t.title}
            ${isNew ? '<span class="thread-new-badge">NEW</span>' : ""}
          </div>
          <div class="latest-thread-meta">
            ${lastInfo}
          </div>
        </div>

        <div class="latest-thread-replies ${isHot ? "hot-thread" : ""}">
          <span class="replies-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
            </svg>
          </span>
          <span class="replies-count">${repliesCount}</span>
        </div>
      `;

      // ===== animație POP =====
      item.style.opacity = "0";
      item.style.transform = "translateY(15px)";

      setTimeout(
        () => {
          item.style.transition = "all 0.4s ease";
          item.style.opacity = "1";
          item.style.transform = "translateY(0)";
        },
        100 + index * 70,
      );

      item.addEventListener("click", () => {
        window.location.href = `thread.html?id=${t.id}`;
      });

      container.appendChild(item);
    });
  } catch (err) {
    console.error("Latest threads error:", err);
    container.innerHTML = "<p>Server error.</p>";
  }
}

// =========================================
//  CODUL TĂU EXISTENT + AUTH PAGES
// =========================================

document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("mobile-menu");
  const navLinks = document.getElementById("nav-links");

  if (menuButton && navLinks) {
    menuButton.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      menuButton.classList.toggle("open");
    });
  }

  // Dropdown mobile
  const dropdownToggle = document.querySelector(".dropdown-toggle");
  const dropdownMenu = document.querySelector(".dropdown-menu");

  if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        dropdownMenu.classList.toggle("dropdown-open");
        dropdownToggle.classList.toggle("dropdown-active");
      }
    });
  }

  // ===== FORM -> COPY TO CLIPBOARD FOR DISCORD =====
  const applyForm = document.getElementById("apply-form-eu");
  const resultMsg = document.getElementById("apply-result-msg");

  if (applyForm && resultMsg) {
    applyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(applyForm);

      const text = [
        `Region: ${formData.get("region") || ""}`,
        `League name: ${formData.get("league-name") || ""}`,
        `Format: ${formData.get("format") || ""}`,
        `Country / sub-region: ${formData.get("country") || ""}`,
        `Contact email: ${formData.get("contact-email") || ""}`,
        `Discord contact: ${formData.get("discord") || ""}`,
        `Website / stream: ${formData.get("website") || ""}`,
        "",
        "Description:",
        `${formData.get("description") || ""}`,
      ].join("\n");

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // fallback pentru browsere mai vechi
          const temp = document.createElement("textarea");
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
        }

        resultMsg.textContent =
          "Application copied! Open Discord, add @YourDiscord#1234 and paste this in a DM.";
        resultMsg.classList.remove("error");
        resultMsg.classList.add("success");
      } catch (err) {
        console.error(err);
        resultMsg.textContent =
          "Could not copy automatically. Please select and copy the text manually.";
        resultMsg.classList.remove("success");
        resultMsg.classList.add("error");
      }
    });
  }

  // 🔹 Apelăm ranking-ul DOAR dacă există secțiunea (pe index.html)
  loadRanking();

  // top 5 pe homepage (dacă există container-ul)
  const homeRanking = document.getElementById("ranking-list");
  if (homeRanking) {
    loadRanking(); // folosește endpoint-ul LIMIT 5
  }

  // full ranking pe ranking.html
  const fullRanking = document.getElementById("ranking-list-full");
  if (fullRanking) {
    loadRanking({ full: true, containerId: "ranking-list-full" });
  }

  // LOGIN PAGE (username + password)
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");

  if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("login-username").value;
      const password = document.getElementById("login-password").value;

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          loginMessage.textContent = data.message || "Login failed";
          loginMessage.classList.add("error");
          return;
        }

        // redirect după login
        window.location.href = "index.html";
      } catch (err) {
        loginMessage.textContent = "Server error";
        loginMessage.classList.add("error");
      }
    });
  }

  // REGISTER PAGE
  const registerForm = document.getElementById("register-form");
  const registerMessage = document.getElementById("register-message");

  if (registerForm && registerMessage) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("reg-username").value;
      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          registerMessage.textContent = data.message || "Register failed";
          registerMessage.classList.add("error");
          return;
        }

        // după register mergem la login
        window.location.href = "login.html";
      } catch (err) {
        registerMessage.textContent = "Server error";
        registerMessage.classList.add("error");
      }
    });
  }

  // LOGOUT
  const logoutBtn = document.getElementById("nav-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.error("Logout error:", err);
      }
      updateNavbarForUser(null);
      loadRanking();
      window.location.href = "index.html";
    });
  }

  // --- FORUM BUTTON "NEW THREAD" ---
  const newThreadBtn = document.getElementById("forum-new-thread-btn");
  if (newThreadBtn) {
    newThreadBtn.addEventListener("click", () => {
      window.location.href = "new-thread.html";
    });
  }

  // --- FORUM PAGE: listă threads ---
  const forumList = document.getElementById("forum-threads-list");
  if (forumList) {
    loadForumThreads();
  }

  // --- PAGINA / FORMULARUL DE NEW THREAD ---
  const newThreadForm = document.getElementById("new-thread-form");
  if (newThreadForm) {
    setupNewThreadForm();
  }

  // --- THREAD PAGE (un singur thread) ---
  const threadView = document.getElementById("thread-view");
  if (threadView) {
    loadThreadPage();
    setupReplyForm();
  }

  // verificăm dacă userul e logat când se încarcă pagina

  // initProsettingsTable();
  setupComparisonVoting();
  loadLatestForumThreads();
  // initComparisonParticles();;
  initProsettingsTable();
  setupAmDetailsToggle();
  // ================================
// REPLY TOOLBAR LOGIC
// ================================

const replyTextarea = document.getElementById("reply-body");

if (replyTextarea) {

  // AUTO EXPAND
  replyTextarea.addEventListener("input", () => {
    replyTextarea.style.height = "auto";
    replyTextarea.style.height = replyTextarea.scrollHeight + "px";
  });

  // BOLD / ITALIC / QUOTE
  document.querySelectorAll(".reply-tool-btn[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag");
      const start = replyTextarea.selectionStart;
      const end = replyTextarea.selectionEnd;
      const selected = replyTextarea.value.substring(start, end);

      let wrapped = "";

      if (tag === "quote") {
        wrapped = `\n> ${selected}\n`;
      } else {
        wrapped = `<${tag}>${selected}</${tag}>`;
      }

      replyTextarea.setRangeText(wrapped, start, end, "end");
      replyTextarea.focus();
    });
  });

  // YOUTUBE QUICK INSERT
  const ytBtn = document.getElementById("yt-btn");
  if (ytBtn) {
    ytBtn.addEventListener("click", () => {
      const url = prompt("Paste YouTube link:");
      if (!url) return;

      replyTextarea.value += `\n${url}\n`;
      replyTextarea.focus();
    });
  }

  // EMOJI QUICK INSERT
  const emojiBtn = document.getElementById("emoji-btn");
  if (emojiBtn) {
    emojiBtn.addEventListener("click", () => {
      replyTextarea.value += " 😊🔥🎮";
      replyTextarea.focus();
    });
  }
  
}
  checkAuthStatus();
});
