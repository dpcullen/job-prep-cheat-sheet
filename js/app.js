// ============================================
// JOB PREP CHEAT SHEET - Main Application
// ============================================

(function () {
  "use strict";

  // --- DOM Elements ---
  const gate = document.getElementById("access-gate");
  const gateTitle = document.getElementById("gate-title");
  const accessForm = document.getElementById("access-form");
  const accessInput = document.getElementById("access-input");
  const accessError = document.getElementById("access-error");
  const app = document.getElementById("app");
  const appTitle = document.getElementById("app-title");
  const jobInput = document.getElementById("job-input");
  const generateBtn = document.getElementById("generate-btn");
  const clearBtn = document.getElementById("clear-btn");
  const inputSection = document.getElementById("input-section");
  const loadingSection = document.getElementById("loading-section");
  const errorSection = document.getElementById("error-section");
  const errorMessage = document.getElementById("error-message");
  const retryBtn = document.getElementById("retry-btn");
  const outputSection = document.getElementById("output-section");
  const printBtn = document.getElementById("print-btn");
  const newBtn = document.getElementById("new-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // --- Branding ---
  gateTitle.textContent = CONFIG.BUSINESS_NAME
    ? `${CONFIG.BUSINESS_NAME}`
    : "Job Prep Cheat Sheet";
  appTitle.textContent = `📋 Job Prep Cheat Sheet`;

  // --- Access Control ---
  const SESSION_KEY = "jpcs_access";

  function checkAccess() {
    return sessionStorage.getItem(SESSION_KEY) === "granted";
  }

  function grantAccess() {
    sessionStorage.setItem(SESSION_KEY, "granted");
    gate.hidden = true;
    app.hidden = false;
  }

  function revokeAccess() {
    sessionStorage.removeItem(SESSION_KEY);
    gate.hidden = false;
    app.hidden = true;
    accessInput.value = "";
    accessError.hidden = true;
  }

  // Skip access gate — go straight to app
  grantAccess();

  logoutBtn.addEventListener("click", revokeAccess);

  // --- UI State ---
  function showState(state) {
    inputSection.hidden = state !== "input";
    loadingSection.hidden = state !== "loading";
    errorSection.hidden = state !== "error";
    outputSection.hidden = state !== "output";
  }

  clearBtn.addEventListener("click", function () {
    jobInput.value = "";
    jobInput.focus();
  });

  newBtn.addEventListener("click", function () {
    jobInput.value = "";
    showState("input");
    jobInput.focus();
  });

  retryBtn.addEventListener("click", function () {
    showState("input");
  });

  printBtn.addEventListener("click", function () {
    window.print();
  });

  // --- Generate Cheat Sheet ---
  generateBtn.addEventListener("click", async function () {
    const text = jobInput.value.trim();
    if (!text) {
      jobInput.focus();
      return;
    }
    if (text.length < 50) {
      showError(
        "Please paste a more complete job description (at least a few sentences)."
      );
      return;
    }

    showState("loading");

    try {
      const data = await analyzeJob(text);
      renderCheatSheet(data);
      showState("output");
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to analyze job description. Please try again.");
    }
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    showState("error");
  }

  // --- Gemini API ---
  async function analyzeJob(jobText) {
    if (
      !CONFIG.GEMINI_API_KEY ||
      CONFIG.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE"
    ) {
      throw new Error(
        "Gemini API key not configured. Please update js/config.js with your API key."
      );
    }

    const prompt = buildPrompt(jobText);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `API error (${response.status})`;
      if (response.status === 429) {
        throw new Error("Rate limit reached. Please wait a minute and try again.");
      }
      throw new Error(errMsg);
    }

    const result = await response.json();
    const rawText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error("Failed to parse AI response. Please try again.");
    }
  }

  function buildPrompt(jobText) {
    return `You are a career advisor analyzing a job description. Extract and generate a concise, high-impact preparation cheat sheet. Return ONLY valid JSON matching the schema below.

JOB DESCRIPTION:
"""
${jobText}
"""

Return JSON with this exact structure:
{
  "roleTitle": "string - exact job title",
  "companyName": "string - company name",
  "companyOverview": "string - 2-3 sentences: what the company does, industry, approximate size/stage, estimated valuation or funding if known, headquarters location",
  "roleSummary": "string - 2-3 sentences summarizing the role, team, and reporting structure if mentioned",
  "mustHaves": ["array of 4-6 strings - critical qualifications and requirements"],
  "niceToHaves": ["array of 3-5 strings - preferred but not required qualifications"],
  "companyIntel": "string - 3-4 sentences covering: recent news or developments about the company, key competitors, market position, and any notable earnings or growth metrics. If the company is public, mention recent stock performance or revenue trends. Note what the candidate should research further.",
  "highlights": ["array of 5-7 strings - specific attributes, experiences, and skills the candidate should emphasize in their application and interviews based on what this role values most"],
  "questions": [
    {
      "question": "string - likely interview question",
      "tip": "string - brief advice on how to answer"
    }
  ],
  "talkingPoints": ["array of 4-6 strings - key themes and narratives the candidate should weave into their application and interviews"],
  "compensation": "string - any compensation info mentioned (salary, equity, benefits), or 'Not specified in job description' if none",
  "location": "string - work location and remote/hybrid/onsite details"
}

For the questions array, include 5-6 questions spanning: behavioral, role-specific technical, company culture fit, and strategic thinking.

Be specific and actionable. Avoid generic advice. Tailor everything to THIS specific role and company.`;
  }

  // --- Render Cheat Sheet ---
  function renderCheatSheet(data) {
    // Header
    document.getElementById("cs-role-title").textContent =
      data.roleTitle || "Role Title";
    document.getElementById("cs-company-name").textContent =
      data.companyName || "Company";
    document.getElementById("cs-date").textContent = new Date().toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
    document.getElementById("cs-branding").textContent =
      CONFIG.BUSINESS_NAME || "";

    // Company Overview
    document.getElementById("cs-company-overview").innerHTML = formatText(
      data.companyOverview
    );

    // Role Summary
    document.getElementById("cs-role-summary").innerHTML = formatText(
      data.roleSummary
    );

    // Requirements
    renderList("cs-must-haves", data.mustHaves);
    renderList("cs-nice-to-haves", data.niceToHaves);

    // Company Intel
    document.getElementById("cs-company-intel").innerHTML = formatText(
      data.companyIntel
    );

    // Highlights
    renderList("cs-highlights", data.highlights);

    // Questions
    const questionsEl = document.getElementById("cs-questions");
    questionsEl.innerHTML = "";
    if (data.questions && data.questions.length) {
      data.questions.forEach(function (q) {
        const div = document.createElement("div");
        div.className = "cs-question-group";
        div.innerHTML = `<p class="cs-question">${escapeHtml(q.question)}</p><p class="cs-question-tip">${escapeHtml(q.tip)}</p>`;
        questionsEl.appendChild(div);
      });
    }

    // Talking Points
    renderList("cs-talking-points", data.talkingPoints);

    // Compensation
    const compSection = document.getElementById("cs-comp-section");
    const compEl = document.getElementById("cs-compensation");
    if (data.compensation || data.location) {
      compSection.hidden = false;
      let compHtml = "";
      if (data.location) compHtml += `<p><strong>Location:</strong> ${escapeHtml(data.location)}</p>`;
      if (data.compensation) compHtml += `<p><strong>Compensation:</strong> ${escapeHtml(data.compensation)}</p>`;
      compEl.innerHTML = compHtml;
    } else {
      compSection.hidden = true;
    }

    // Footer
    document.getElementById("cs-footer-text").textContent =
      `Prepared by ${CONFIG.BUSINESS_NAME || "Job Prep Cheat Sheet"} • For personal use only • ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
  }

  function renderList(elementId, items) {
    const el = document.getElementById(elementId);
    el.innerHTML = "";
    if (items && items.length) {
      items.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        el.appendChild(li);
      });
    }
  }

  function formatText(text) {
    if (!text) return "<p>—</p>";
    return text
      .split(/\n\n|\n/)
      .filter(Boolean)
      .map(function (p) {
        return "<p>" + escapeHtml(p) + "</p>";
      })
      .join("");
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
