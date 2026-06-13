const FORM_ENDPOINT = "";
const EXAM_MINUTES = 45;

const state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  flagged: new Set(),
  startedAt: null,
  remainingSeconds: EXAM_MINUTES * 60,
  timerId: null,
  submitted: false,
  submitPending: false,
  lead: null
};

const screens = {
  lead: document.querySelector("#lead-screen"),
  exam: document.querySelector("#exam-screen"),
  results: document.querySelector("#results-screen"),
  review: document.querySelector("#review-screen")
};

const els = {
  leadForm: document.querySelector("#lead-form"),
  leadError: document.querySelector("#lead-error"),
  questionNumber: document.querySelector("#question-number"),
  questionTotal: document.querySelector("#question-total"),
  timer: document.querySelector("#timer"),
  answeredCount: document.querySelector("#answered-count"),
  questionGrid: document.querySelector("#question-grid"),
  questionDomain: document.querySelector("#question-domain"),
  questionText: document.querySelector("#question-text"),
  questionHelp: document.querySelector("#question-help"),
  choiceList: document.querySelector("#choice-list"),
  flagButton: document.querySelector("#flag-button"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  submitButton: document.querySelector("#submit-button"),
  submitStatus: document.querySelector("#submit-status"),
  scoreHeadline: document.querySelector("#score-headline"),
  scoreSummary: document.querySelector("#score-summary"),
  scorePercent: document.querySelector("#score-percent"),
  domainBreakdown: document.querySelector("#domain-breakdown"),
  reviewButton: document.querySelector("#review-button"),
  restartButton: document.querySelector("#restart-button"),
  backResultsButton: document.querySelector("#back-results-button"),
  reviewList: document.querySelector("#review-list")
};

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch("questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Question bank could not be loaded.");
    }
    state.questions = await response.json();
    els.questionTotal.textContent = state.questions.length;
    renderQuestionMap();
  } catch (error) {
    els.leadError.textContent = "The simulator question bank is unavailable. Please try again soon.";
    els.leadForm.querySelector("button").disabled = true;
  }
}

function bindEvents() {
  els.leadForm.addEventListener("submit", startExam);
  els.flagButton.addEventListener("click", toggleFlag);
  els.prevButton.addEventListener("click", () => goToQuestion(state.currentIndex - 1));
  els.nextButton.addEventListener("click", () => goToQuestion(state.currentIndex + 1));
  els.submitButton.addEventListener("click", confirmSubmit);
  els.reviewButton.addEventListener("click", showReview);
  els.restartButton.addEventListener("click", restartExam);
  els.backResultsButton.addEventListener("click", () => showScreen("results"));
}

async function startExam(event) {
  event.preventDefault();
  const formData = new FormData(els.leadForm);
  const lead = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    consent: formData.get("consent") === "on",
    startedAt: new Date().toISOString()
  };

  if (!lead.name || !lead.email || !lead.consent) {
    els.leadError.textContent = "Please enter your name, email, and consent before starting.";
    return;
  }

  state.lead = lead;
  localStorage.setItem("pmpdaily-simulator-lead", JSON.stringify(lead));
  sendLead(lead);

  state.startedAt = Date.now();
  state.remainingSeconds = EXAM_MINUTES * 60;
  showScreen("exam");
  renderQuestion();
  startTimer();
}

async function sendLead(lead) {
  if (!FORM_ENDPOINT) return;

  try {
    await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead)
    });
  } catch (error) {
    console.warn("Lead endpoint unavailable", error);
  }
}

function startTimer() {
  clearInterval(state.timerId);
  updateTimer();
  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    updateTimer();
    if (state.remainingSeconds <= 0) {
      submitExam(true);
    }
  }, 1000);
}

function updateTimer() {
  const minutes = Math.max(0, Math.floor(state.remainingSeconds / 60));
  const seconds = Math.max(0, state.remainingSeconds % 60);
  els.timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const selected = state.answers[question.id] || [];
  els.questionNumber.textContent = state.currentIndex + 1;
  els.questionDomain.textContent = `${question.domain} | ${question.difficulty}`;
  els.questionText.textContent = question.question;
  els.questionHelp.textContent = question.type === "multiple"
    ? "Select all answers that apply."
    : "Select the best answer.";

  els.choiceList.innerHTML = "";
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    const letter = String.fromCharCode(65 + index);
    button.className = `choice ${selected.includes(choice.id) ? "selected" : ""}`;
    button.type = "button";
    button.innerHTML = `<span class="choice-marker">${letter}</span><span>${choice.text}</span>`;
    button.addEventListener("click", () => selectChoice(question, choice.id));
    els.choiceList.appendChild(button);
  });

  els.flagButton.classList.toggle("active", state.flagged.has(question.id));
  els.flagButton.textContent = state.flagged.has(question.id) ? "Flagged for review" : "Flag for review";
  els.prevButton.disabled = state.currentIndex === 0;
  els.nextButton.disabled = state.currentIndex === state.questions.length - 1;
  renderQuestionMap();
}

function selectChoice(question, choiceId) {
  state.submitPending = false;
  els.submitStatus.textContent = "";

  if (question.type === "multiple") {
    const current = new Set(state.answers[question.id] || []);
    current.has(choiceId) ? current.delete(choiceId) : current.add(choiceId);
    state.answers[question.id] = Array.from(current);
  } else {
    state.answers[question.id] = [choiceId];
  }
  renderQuestion();
}

function toggleFlag() {
  const question = state.questions[state.currentIndex];
  if (state.flagged.has(question.id)) {
    state.flagged.delete(question.id);
  } else {
    state.flagged.add(question.id);
  }
  renderQuestion();
}

function goToQuestion(index) {
  if (index < 0 || index >= state.questions.length) return;
  state.submitPending = false;
  els.submitStatus.textContent = "";
  state.currentIndex = index;
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestionMap() {
  if (!state.questions.length) return;

  els.questionGrid.innerHTML = "";
  state.questions.forEach((question, index) => {
    const button = document.createElement("button");
    const answered = (state.answers[question.id] || []).length > 0;
    button.className = [
      "map-button",
      index === state.currentIndex ? "current" : "",
      answered ? "answered" : "",
      state.flagged.has(question.id) ? "flagged" : ""
    ].join(" ");
    button.type = "button";
    button.textContent = index + 1;
    button.addEventListener("click", () => goToQuestion(index));
    els.questionGrid.appendChild(button);
  });

  const answeredCount = Object.values(state.answers).filter((answer) => answer.length > 0).length;
  els.answeredCount.textContent = `${answeredCount} answered`;
}

function confirmSubmit() {
  const unanswered = state.questions.length - Object.values(state.answers).filter((answer) => answer.length > 0).length;

  if (unanswered && !state.submitPending) {
    state.submitPending = true;
    els.submitStatus.textContent = `You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Click Submit exam again to finish anyway.`;
    return;
  }

  submitExam(false);
}

function submitExam(timedOut) {
  if (state.submitted) return;
  state.submitted = true;
  clearInterval(state.timerId);

  const results = calculateResults();
  localStorage.setItem("pmpdaily-simulator-last-result", JSON.stringify({
    lead: state.lead,
    submittedAt: new Date().toISOString(),
    timedOut,
    score: results.score,
    correct: results.correct,
    total: results.total
  }));

  renderResults(results, timedOut);
  showScreen("results");
}

function calculateResults() {
  let correct = 0;
  const byDomain = {};

  state.questions.forEach((question) => {
    const selected = state.answers[question.id] || [];
    const isCorrect = answersMatch(selected, question.correctAnswers);
    if (isCorrect) correct += 1;

    byDomain[question.domain] ||= { correct: 0, total: 0 };
    byDomain[question.domain].total += 1;
    if (isCorrect) byDomain[question.domain].correct += 1;
  });

  return {
    correct,
    total: state.questions.length,
    score: Math.round((correct / state.questions.length) * 100),
    byDomain
  };
}

function answersMatch(selected, correctAnswers) {
  if (selected.length !== correctAnswers.length) return false;
  return selected.every((answer) => correctAnswers.includes(answer));
}

function renderResults(results, timedOut) {
  const passingSignal = results.score >= 70 ? "Strong practice result" : "Keep practicing";
  els.scoreHeadline.textContent = timedOut ? "Time expired" : passingSignal;
  els.scoreSummary.textContent = `You answered ${results.correct} of ${results.total} questions correctly for a score of ${results.score}%. Review your explanations to identify the patterns behind missed questions.`;
  els.scorePercent.textContent = `${results.score}%`;
  document.documentElement.style.setProperty("--score-angle", `${Math.round(results.score * 3.6)}deg`);

  els.domainBreakdown.innerHTML = "";
  Object.entries(results.byDomain).forEach(([domain, data]) => {
    const percent = Math.round((data.correct / data.total) * 100);
    const row = document.createElement("div");
    row.className = "domain-row";
    row.innerHTML = `
      <strong><span>${domain}</span><span>${data.correct}/${data.total} (${percent}%)</span></strong>
      <div class="bar"><span style="width:${percent}%"></span></div>
    `;
    els.domainBreakdown.appendChild(row);
  });
}

function showReview() {
  els.reviewList.innerHTML = "";
  state.questions.forEach((question, index) => {
    const selected = state.answers[question.id] || [];
    const isCorrect = answersMatch(selected, question.correctAnswers);
    const item = document.createElement("article");
    item.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;
    item.innerHTML = `
      <div class="review-meta">
        <span class="pill">Question ${index + 1}</span>
        <span class="pill">${question.domain}</span>
        <span class="pill ${isCorrect ? "good" : "bad"}">${isCorrect ? "Correct" : "Needs review"}</span>
      </div>
      <h2>${question.question}</h2>
      <div class="answer-review">
        ${question.choices.map((choice) => {
          const selectedClass = selected.includes(choice.id) && !question.correctAnswers.includes(choice.id) ? " wrong" : "";
          const correctClass = question.correctAnswers.includes(choice.id) ? " right" : "";
          const label = selected.includes(choice.id) ? "Your choice: " : question.correctAnswers.includes(choice.id) ? "Correct: " : "";
          return `<div class="${correctClass}${selectedClass}"><strong>${label}</strong>${choice.text}</div>`;
        }).join("")}
      </div>
      <p class="explanation"><strong>Explanation:</strong> ${question.explanation}</p>
    `;
    els.reviewList.appendChild(item);
  });
  showScreen("review");
}

function restartExam() {
  state.currentIndex = 0;
  state.answers = {};
  state.flagged = new Set();
  state.startedAt = null;
  state.remainingSeconds = EXAM_MINUTES * 60;
  state.submitted = false;
  state.submitPending = false;
  els.submitStatus.textContent = "";
  clearInterval(state.timerId);
  updateTimer();
  showScreen("lead");
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
