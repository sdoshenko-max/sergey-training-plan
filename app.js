(function () {
  "use strict";

  const planData = window.TRAINING_PLAN;
  if (!planData) {
    document.querySelector("#plan").textContent = "Не удалось загрузить план. Обнови страницу.";
    return;
  }

  const DAY_MS = 86400000;
  const startDate = new Date(`${planData.startDate}T12:00:00Z`);
  const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "long", timeZone: "UTC",
  });
  const yearFormatter = new Intl.DateTimeFormat("ru-RU", {
    year: "numeric", timeZone: "UTC",
  });
  const dateAt = (offset) => new Date(startDate.getTime() + offset * DAY_MS);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  const weeks = Array.from({ length: planData.totalWeeks }, (_, index) => {
    const first = dateAt(index * 7);
    const last = dateAt(index * 7 + 4);
    const deload = planData.deloadWeeks.includes(index + 1);
    return {
      week: index + 1,
      range: `${dateFormatter.format(first)} – ${dateFormatter.format(last)}`,
      year: first.getUTCFullYear() === last.getUTCFullYear()
        ? yearFormatter.format(first)
        : `${first.getUTCFullYear()} / ${last.getUTCFullYear()}`,
      deload,
      days: planData.workouts.map((workout) => ({
        id: `w${index + 1}-${workout.id}`,
        date: `${workout.weekdayShort}, ${dateFormatter.format(dateAt(index * 7 + workout.dayOffset))}`,
        workout,
        deload,
      })),
    };
  });

  function renderTechnique(technique, deload) {
    return `<div class="technique-details">
      <p><strong>Как делать</strong></p>
      <ul class="technique-list">${technique.map(([label, text]) =>
        `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(deload ? text.replaceAll("2–3", "3–4") : text)}</li>`
      ).join("")}</ul>
    </div>`;
  }

  function renderExercises(exercises, dayId, deload) {
    return exercises.map((item) => {
      const exerciseId = `${dayId}-${item.id}`;
      const sets = deload ? Math.max(1, Math.ceil(item.sets / 2)) : item.sets;
      return `<li class="exercise-item">
        <button class="exercise-toggle" type="button" data-exercise="${exerciseId}" aria-expanded="false" aria-controls="exercise-${exerciseId}">
          <span class="exercise-label"><span class="exercise-name">${escapeHtml(item.name)}</span></span>
          <span class="exercise-sets">${sets} × ${escapeHtml(item.reps)}</span>
        </button>
        <div class="exercise-panel" id="exercise-${exerciseId}" data-exercise-panel="${exerciseId}" hidden>
          <div class="exercise-content">
            <figure class="equipment-photo">
              <a href="${escapeHtml(item.image)}" target="_blank" rel="noopener" aria-label="Открыть фото: ${escapeHtml(item.imageAlt)}">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" width="900" height="1200" loading="lazy" decoding="async">
              </a>
              <figcaption>Твой зал · нажми на фото, чтобы увеличить</figcaption>
            </figure>
            <div class="exercise-instructions">
              <p><strong>Инвентарь:</strong> ${escapeHtml(item.equipment)}</p>
              <p class="exercise-rest"><strong>Отдых:</strong> ${escapeHtml(item.rest)}</p>
              ${renderTechnique(item.technique, deload)}
            </div>
          </div>
        </div>
      </li>`;
    }).join("");
  }

  function renderDay(day) {
    const workout = day.workout;
    return `<article class="day-item">
      <button class="day-toggle" type="button" data-day="${day.id}" aria-expanded="false" aria-controls="details-${day.id}">
        <span class="day-main">
          <span class="day-number">${escapeHtml(workout.weekdayShort)}</span>
          <span><span class="day-date">${escapeHtml(day.date)}</span><strong>${escapeHtml(workout.title)}</strong></span>
        </span>
        <span class="day-meta"><span>Зал ${escapeHtml(workout.time)}</span>${workout.footballTime ? `<span class="football-time">Футбол ${escapeHtml(workout.footballTime)}</span>` : ""}</span>
      </button>
      <div class="day-panel" id="details-${day.id}" data-panel="${day.id}" hidden>
        ${workout.note ? `<p class="session-note${workout.id === "legs" ? " recovery-note" : ""}">${escapeHtml(day.deload ? workout.note.replaceAll("2–3", "3–4") : workout.note)}</p>` : ""}
        ${day.deload ? '<p class="session-note deload-note">Облегчённая неделя: ниже уже указано сокращённое число рабочих подходов. Оставляй 3–4 повтора в запасе.</p>' : ""}
        <ol class="exercise-list">${renderExercises(workout.exercises, day.id, day.deload)}</ol>
      </div>
    </article>`;
  }

  function renderWeek(week) {
    return `<section class="week-group${week.deload ? " is-deload" : ""}" id="week-${week.week}" aria-label="Неделя ${week.week}">
      <header class="week-header">
        <span class="week-kicker">Неделя ${week.week}</span>
        <h2>${escapeHtml(week.range)}</h2>
        <span class="week-meta">${escapeHtml(week.year)} · ${week.deload ? "Облегчённая" : "Набор массы"}</span>
      </header>
      <div class="day-accordion">${week.days.map(renderDay).join("")}</div>
      <p class="week-rest">Суббота и воскресенье — восстановление.</p>
    </section>`;
  }

  const PANEL_CLOSE_TIMEOUT_MS = 180;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const panelTimers = new WeakMap();

  function clearPanelTimer(panel) {
    const timer = panelTimers.get(panel);

    if (timer) {
      window.clearTimeout(timer);
      panelTimers.delete(panel);
    }
  }

  function closePanelNow(panel) {
    if (!panel) {
      return;
    }

    clearPanelTimer(panel);
    panel.classList.remove("is-open", "is-closing");
    panel.hidden = true;
    panel.style.height = "0px";
  }

  function finishPanelTransition(panel) {
    clearPanelTimer(panel);
    panel.classList.remove("is-closing");

    if (panel.classList.contains("is-open")) {
      panel.style.height = "auto";
      return;
    }

    panel.hidden = true;
    panel.style.height = "0px";
  }

  function schedulePanelFinish(panel) {
    clearPanelTimer(panel);
    panelTimers.set(
      panel,
      window.setTimeout(() => {
        finishPanelTransition(panel);
      }, PANEL_CLOSE_TIMEOUT_MS),
    );
  }

  function setPanelOpen(panel, isOpen) {
    if (!panel) {
      return;
    }

    clearPanelTimer(panel);

    if (isOpen && !panel.hidden && panel.classList.contains("is-open")) {
      panel.classList.remove("is-closing");
      panel.style.height = "auto";
      return;
    }

    if (!isOpen && panel.hidden) {
      panel.classList.remove("is-open", "is-closing");
      panel.style.height = "0px";
      return;
    }

    if (reducedMotion.matches) {
      panel.classList.toggle("is-open", isOpen);
      panel.classList.toggle("is-closing", false);
      panel.hidden = !isOpen;
      panel.style.height = isOpen ? "auto" : "0px";
      return;
    }

    if (isOpen) {
      panel.hidden = false;
      panel.classList.remove("is-closing");
      panel.classList.add("is-open");
      panel.style.height = "0px";

      requestAnimationFrame(() => {
        panel.style.height = `${panel.scrollHeight}px`;
      });

      return;
    }

    panel.style.height = `${panel.scrollHeight}px`;

    requestAnimationFrame(() => {
      panel.classList.toggle("is-open", false);
      panel.classList.toggle("is-closing", true);
      panel.style.height = "0px";
      schedulePanelFinish(panel);
    });
  }

  function closeNestedExercises(dayPanel) {
    dayPanel.querySelectorAll(".exercise-toggle[aria-expanded='true']").forEach((toggle) => {
      const panel = dayPanel.querySelector(`[data-exercise-panel="${toggle.dataset.exercise}"]`);

      toggle.setAttribute("aria-expanded", "false");
      toggle.closest(".exercise-item")?.classList.remove("is-active");
      closePanelNow(panel);
    });
  }

  function bindPanelTransitions() {
    document.querySelectorAll(".day-panel, .exercise-panel").forEach((panel) => {
      panel.addEventListener("transitionend", (event) => {
        if (event.target === panel && event.propertyName === "height") {
          finishPanelTransition(panel);
        }
      });
    });
  }

  function bindDayAccordions() {
    const toggles = document.querySelectorAll(".day-toggle");
    const panels = document.querySelectorAll("[data-panel]");

    function setOpenDay(day) {
      toggles.forEach((toggle) => {
        const isActive = Boolean(day) && toggle.dataset.day === day;
        toggle.closest(".day-item")?.classList.toggle("is-active", isActive);
        toggle.setAttribute("aria-expanded", String(isActive));
      });

      panels.forEach((panel) => {
        const isActive = Boolean(day) && panel.dataset.panel === day;

        if (!isActive) {
          closeNestedExercises(panel);
        }

        setPanelOpen(panel, isActive);
      });
    }

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setOpenDay(isOpen ? null : toggle.dataset.day);
      });
    });
  }

  function bindExerciseAccordions() {
    const exerciseToggles = document.querySelectorAll(".exercise-toggle");

    exerciseToggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const panel = document.querySelector(`[data-exercise-panel="${toggle.dataset.exercise}"]`);
        const isOpen = toggle.getAttribute("aria-expanded") === "true";

        toggle.setAttribute("aria-expanded", String(!isOpen));
        toggle.closest(".exercise-item")?.classList.toggle("is-active", !isOpen);

        setPanelOpen(panel, !isOpen);
      });
    });
  }

  function bindWeekNavigation() {
    const select = document.querySelector("#week-select");
    select.innerHTML = weeks.map((week) => `<option value="${week.week}">Неделя ${week.week}: ${escapeHtml(week.range)}</option>`).join("");
    select.addEventListener("change", () => {
      document.getElementById(`week-${select.value}`)?.scrollIntoView({
        behavior: reducedMotion.matches ? "instant" : "smooth", block: "start",
      });
    });
  }

  function renderPlan() {
    const plan = document.querySelector("#plan");
    if (!plan) return;
    plan.innerHTML = weeks.map(renderWeek).join("");
    document.querySelector("#plan-period").textContent =
      `${dateFormatter.format(startDate)} ${startDate.getUTCFullYear()} – ${dateFormatter.format(dateAt((planData.totalWeeks - 1) * 7 + 4))} ${dateAt((planData.totalWeeks - 1) * 7 + 4).getUTCFullYear()}`;
    bindPanelTransitions();
    bindDayAccordions();
    bindExerciseAccordions();
    bindWeekNavigation();
  }

  renderPlan();
})();
