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

  // verificăm dacă userul e logat când se încarcă pagina
  checkAuthStatus();
});
