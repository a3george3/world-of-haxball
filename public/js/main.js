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
      countEl.textContent =
        total === 1 ? "1 thread" : `${total} threads`;
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

function renderFormattedText(raw) {
  let safe = escapeHtml(raw);

  // **bold**
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // *italic*
  safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // link simplu: http:// sau https://
  safe = safe.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // newline -> <br>
  safe = safe.replace(/\n/g, "<br>");

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
            <p>${renderFormattedText(thread.body)}</p>
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
            <span>${r.author}</span>
            <span>• ${new Date(r.created_at).toLocaleString()}</span>
          </div>
          ${quoteHtml}
          <p>${renderFormattedText(r.body)}</p>
          <button
            class="thread-reply-btn"
            data-reply-id="${r.id}"
            data-author="${r.author}"
          >
            Reply
          </button>
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
  checkAuthStatus();
});
