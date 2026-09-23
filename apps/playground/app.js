const form = document.getElementById("form");
const out = document.getElementById("out");
const viz = document.getElementById("viz");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");
const healthLine = document.getElementById("healthLine");
const topicBlurb = document.getElementById("topicBlurb");
const questionsView = document.getElementById("questionsView");

const choiceBlock = document.getElementById("choiceBlock");
const scoreBlock = document.getElementById("scoreBlock");
const noulBlock = document.getElementById("noulBlock");
const imageField = document.getElementById("imageField");

/** Topics map to real System One shapes (decisioning — not free-form generation). */
const topics = {
  support: {
    title: "Support routing",
    blurb: "Route tickets and decide whether to escalate.",
    showChoice: true,
    showScore: false,
    showNoul: true,
    showImage: false,
    state:
      "Customer: I was charged twice for my order and nobody has replied. I am furious.",
    choiceInstr: "Which team should handle this?",
    choiceCriteria: {
      billing: "charges, refunds, payments",
      shipping: "delivery and tracking",
      technical: "bugs and outages",
    },
    noulInstr: "Escalate to a human agent now?",
  },
  moderation: {
    title: "Moderation gate",
    blurb: "Toxicity gate before a comment goes live.",
    showChoice: false,
    showScore: false,
    showNoul: true,
    showImage: false,
    state:
      "This product is garbage and the CEO should be ashamed. Absolute scam — never buying again.",
    noulInstr:
      "Would a majority of moderators rate this comment as toxic (rude, disrespectful, or aggressive enough that people leave the thread)?",
  },
  content: {
    title: "Content quality",
    blurb: "Score a draft reply before it sends.",
    showChoice: false,
    showScore: true,
    showNoul: true,
    showImage: false,
    state:
      "Draft reply:\n\nThanks for writing in. We looked into the double charge and issued a refund to your original payment method. It should appear in 3–5 business days. Let us know if it does not show up.",
    scoreInstr:
      "Rate how ready this support reply is to send, from unusable to publish-ready.",
    scoreCriteria: [
      "unusable: wrong, rude, or empty",
      "weak: incomplete or unclear",
      "acceptable: covers the basics with rough edges",
      "strong: clear, correct, on-brand",
      "publish-ready: polished and complete",
    ],
    noulInstr: "Should a human edit this draft before send?",
  },
  vision: {
    title: "Vision triage",
    blurb: "Triage a checkout screenshot with typed questions.",
    showChoice: true,
    showScore: false,
    showNoul: true,
    showImage: true,
    state:
      "User uploaded this checkout screenshot and says payment failed after they clicked Pay.",
    imageUrl: "https://picsum.photos/seed/kev-checkout/960/640",
    choiceInstr: "What does this screenshot most likely need?",
    choiceCriteria: {
      payment_bug: "failed payment, declined card, checkout error UI",
      account_access: "login, lockout, permissions",
      ui_glitch: "layout broken, missing buttons, rendering issue",
      unclear: "cannot tell from the image/context",
    },
    noulInstr: "Is this urgent enough to page on-call?",
  },
  intent: {
    title: "Assistant intent",
    blurb: "Route an assistant utterance to the right skill.",
    showChoice: true,
    showScore: false,
    showNoul: false,
    showImage: false,
    state: "set an alarm for 7 am tomorrow and also dim the lights in the kitchen",
    choiceInstr: "Primary assistant intent for this utterance?",
    choiceCriteria: {
      alarm_set: "create or change an alarm/timer",
      iot_lights: "control lights or smart home devices",
      calendar: "meetings, events, scheduling",
      weather: "forecast or conditions",
      other: "none of the above / compound / unclear",
    },
  },
};

let activeTopic = "support";

function renderQuestionsView(t) {
  const lines = [];
  if (t.showChoice) {
    const keys = Object.keys(t.choiceCriteria ?? {}).join(" · ");
    lines.push(
      `<p class="q-line"><span class="q-name">topic</span> <span class="q-type">choice</span> ${escapeHtml(keys)}</p>`,
    );
  }
  if (t.showScore) {
    const levels = (t.scoreCriteria ?? [])
      .map((s) => String(s).split(":")[0].trim())
      .join(" · ");
    lines.push(
      `<p class="q-line"><span class="q-name">quality</span> <span class="q-type">score</span> ${escapeHtml(levels)}</p>`,
    );
  }
  if (t.showNoul) {
    lines.push(
      `<p class="q-line"><span class="q-name">gate</span> <span class="q-type">noul</span> ${escapeHtml(t.noulInstr ?? "")}</p>`,
    );
  }
  questionsView.innerHTML = lines.join("") || `<p class="q-line">No questions</p>`;
}

function applyTopic(key) {
  const t = topics[key];
  if (!t) return;
  activeTopic = key;

  document.querySelectorAll(".topic").forEach((el) => {
    el.classList.toggle("active", el.dataset.topic === key);
  });

  if (topicBlurb) topicBlurb.textContent = t.blurb ?? t.title;
  document.getElementById("state").value = t.state;
  renderQuestionsView(t);

  choiceBlock.hidden = !t.showChoice;
  scoreBlock.hidden = !t.showScore;
  noulBlock.hidden = !t.showNoul;
  imageField.hidden = !t.showImage;

  if (t.showChoice) {
    document.getElementById("choiceInstr").value = t.choiceInstr;
    document.getElementById("choiceCriteria").value = JSON.stringify(
      t.choiceCriteria,
      null,
      2,
    );
  }
  if (t.showScore) {
    document.getElementById("scoreInstr").value = t.scoreInstr;
    document.getElementById("scoreCriteria").value = JSON.stringify(
      t.scoreCriteria,
      null,
      2,
    );
  }
  if (t.showNoul) {
    document.getElementById("noulInstr").value = t.noulInstr;
  }
  if (t.showImage) {
    document.getElementById("imageUrl").value = t.imageUrl ?? "";
  } else {
    document.getElementById("imageUrl").value = "";
  }

  clearError();
  viz.innerHTML = `<div class="empty"><p class="empty-title">${escapeHtml(
    t.title,
  )}</p><p class="empty-body">Edit the sample, then evaluate for calibrated probabilities.</p></div>`;
  out.textContent = "";
  setView("viz");
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

function showError(msg) {
  formError.hidden = false;
  formError.textContent = msg;
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle("loading", on);
}

function setView(view) {
  const showViz = view === "viz";
  viz.hidden = !showViz;
  out.hidden = showViz;
  const toggle = document.getElementById("jsonToggle");
  if (toggle) {
    toggle.dataset.view = showViz ? "raw" : "viz";
    toggle.textContent = showViz ? "View JSON" : "View summary";
  }
}

function pct(n) {
  return `${(Math.max(0, Math.min(1, Number(n) || 0)) * 100).toFixed(1)}%`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderViz(data) {
  const answers = data?.answers ?? {};
  const blocks = [];

  for (const [name, ans] of Object.entries(answers)) {
    if (ans.type === "choice") {
      const conf = Number(ans.confidence ?? 0);
      const entries = Object.entries(ans.probabilities ?? {}).sort(
        (a, b) => b[1] - a[1],
      );
      const bars = entries
        .map(([key, p]) => {
          return `<div class="bar-row">
            <span class="bar-key">${escapeHtml(key)}</span>
            <div class="bar-track"><div class="bar-fill" data-w="${p}"></div></div>
            <span class="bar-pct">${Math.round(p * 100)}%</span>
          </div>`;
        })
        .join("");
      blocks.push(`<article class="answer-block">
        <div class="answer-meta">
          <span class="answer-key">${escapeHtml(name)}</span>
          <div class="answer-right">
            <span class="answer-pick">${escapeHtml(ans.choice)}</span>
            <span class="badge success">CONF ${conf.toFixed(2)}</span>
          </div>
        </div>
        ${bars}
      </article>`);
    } else if (ans.type === "noul") {
      const p = Number(ans.noul ?? 0);
      const yes = p >= 0.5;
      const tone = yes ? "danger" : "info";
      const label = yes ? `YES ${p.toFixed(2)}` : `NO ${p.toFixed(2)}`;
      blocks.push(`<article class="answer-block">
        <div class="answer-meta">
          <span class="answer-key">${escapeHtml(name)}</span>
          <div class="answer-right">
            <span class="answer-pick">${yes ? "YES" : "NO"}</span>
            <span class="badge ${tone}">${label}</span>
          </div>
        </div>
        <div class="bar-row">
          <span class="bar-key">yes</span>
          <div class="bar-track"><div class="bar-fill" data-w="${p}"></div></div>
          <span class="bar-pct">${Math.round(p * 100)}%</span>
        </div>
        <div class="bar-row">
          <span class="bar-key">no</span>
          <div class="bar-track"><div class="bar-fill" data-w="${1 - p}"></div></div>
          <span class="bar-pct">${Math.round((1 - p) * 100)}%</span>
        </div>
      </article>`);
    } else if (ans.type === "score") {
      const conf = Number(ans.confidence ?? 0);
      const entries = Object.entries(ans.probabilities ?? {}).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      );
      const bars = entries
        .map(([key, p]) => {
          const label = ans.legend?.[key] ?? key;
          return `<div class="bar-row">
            <span class="bar-key" title="${escapeHtml(label)}">${escapeHtml(
              String(label).split(":")[0] || key,
            )}</span>
            <div class="bar-track"><div class="bar-fill" data-w="${p}"></div></div>
            <span class="bar-pct">${Math.round(p * 100)}%</span>
          </div>`;
        })
        .join("");
      const pick =
        ans.legend?.[String(Math.round(Number(ans.score)))] ??
        Number(ans.score).toFixed(2);
      blocks.push(`<article class="answer-block">
        <div class="answer-meta">
          <span class="answer-key">${escapeHtml(name)}</span>
          <div class="answer-right">
            <span class="answer-pick">${escapeHtml(String(pick).split(":")[0])}</span>
            <span class="badge info">CONF ${conf.toFixed(2)}</span>
          </div>
        </div>
        ${bars}
      </article>`);
    }
  }

  const latency = data?.usage?.latency_ms;
  const model = data?.model;
  const meta =
    latency != null || model
      ? `<p class="latency">${model ? escapeHtml(model) : "model"}${
          latency != null ? ` · ${Math.round(latency)} ms` : ""
        }${data?.usage?.cache_hit ? " · cache" : ""}</p>`
      : "";

  if (!blocks.length) {
    viz.innerHTML = `<div class="empty"><p class="empty-title">Empty</p><p class="empty-body">No answers returned.</p></div>`;
    return;
  }

  viz.innerHTML = blocks.join("") + meta;
  requestAnimationFrame(() => {
    viz.querySelectorAll(".bar-fill").forEach((el) => {
      const w = Number(el.getAttribute("data-w") || 0);
      el.style.width = `${Math.max(0, Math.min(1, w)) * 100}%`;
    });
  });
}

function buildPayload() {
  const t = topics[activeTopic];
  const stateText = document.getElementById("state").value;
  const imageUrl = document.getElementById("imageUrl").value.trim();

  /** @type {Record<string, unknown>} */
  const state =
    t.showImage && imageUrl
      ? {
          text: stateText,
          images: [{ url: imageUrl, media_type: "image/png" }],
        }
      : stateText;

  /** @type {Record<string, unknown>} */
  const questions = {};

  if (t.showChoice) {
    questions.topic = {
      type: "choice",
      instructions: document.getElementById("choiceInstr").value,
      criteria: JSON.parse(document.getElementById("choiceCriteria").value),
    };
  }
  if (t.showScore) {
    questions.quality = {
      type: "score",
      instructions: document.getElementById("scoreInstr").value,
      criteria: JSON.parse(document.getElementById("scoreCriteria").value),
    };
  }
  if (t.showNoul) {
    questions.gate = {
      type: "noul",
      instructions: document.getElementById("noulInstr").value,
    };
  }

  return {
    model: "kev-latest",
    state,
    questions,
    trace: document.getElementById("trace").checked,
  };
}

async function evaluate() {
  clearError();
  let payload;
  try {
    payload = buildPayload();
  } catch {
    showError("Criteria JSON is invalid.");
    return;
  }

  if (!Object.keys(payload.questions).length) {
    showError("This topic has no questions configured.");
    return;
  }

  setLoading(true);
  setView("viz");
  viz.innerHTML = `<div class="empty"><p class="empty-title">Evaluating</p><p class="empty-body">System One is returning typed probabilities…</p></div>`;

  try {
    const res = await fetch("/v1/systemone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    if (!res.ok) {
      const msg =
        data?.error?.message || data?.message || `Request failed (${res.status})`;
      showError(msg);
      viz.innerHTML = `<div class="empty"><p class="empty-title">Failed</p><p class="empty-body">${escapeHtml(
        msg,
      )}</p></div>`;
      return;
    }
    renderViz(data);
  } catch (err) {
    const msg = String(err);
    showError(msg);
    viz.innerHTML = `<div class="empty"><p class="empty-title">Network error</p><p class="empty-body">${escapeHtml(
      msg,
    )}</p></div>`;
    out.textContent = msg;
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  evaluate();
});

form.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    evaluate();
  }
});

document.getElementById("btnExample")?.addEventListener("click", () => {
  applyTopic("support");
  document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll(".topic").forEach((btn) => {
  btn.addEventListener("click", () => applyTopic(btn.dataset.topic));
});

document.getElementById("jsonToggle")?.addEventListener("click", (e) => {
  const view = e.currentTarget.dataset.view || "raw";
  setView(view);
});

async function pingHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    healthLine.textContent = `${data.backend ?? "server"} · ${data.model ?? "ok"}`;
  } catch {
    healthLine.textContent = "Server unreachable";
  }
}

pingHealth();
applyTopic("support");
