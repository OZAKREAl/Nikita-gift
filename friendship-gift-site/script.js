/*
  Логика сайта. Весь контент находится в data.js.
  Публичный режим показывает только approvedForPublication: true.
  Личный режим показывает отобранные элементы с approvedForPublication: false,
  но полностью исключённые чувствительные сведения не хранятся в массиве контента.
*/
(() => {
  'use strict';

  const data = window.FRIENDSHIP_DATA;
  if (!data) {
    document.body.innerHTML = '<main style="padding:40px;color:white;background:#101214;min-height:100vh"><h1>Не найден data.js</h1><p>Проверьте, что файл лежит рядом с index.html.</p></main>';
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const state = {
    mode: localStorage.getItem('friendship-mode') || data.siteConfig.defaultMode || 'public',
    factFilter: 'all',
    timelineYear: 'all',
    quoteIndex: 0,
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    uselessClicks: 0,
  };

  let revealObserver;
  let counterObserver;
  let toastTimer;

  const privacyMap = {
    low: 'безопасно',
    medium: 'только для своих',
    high: 'ручная проверка',
  };

  function visible(item) {
    if (!item) return false;
    return state.mode === 'personal' || item.approvedForPublication === true;
  }

  function visibleItems(list = []) {
    return list.filter(visible);
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function setMode(mode) {
    if (!['public', 'personal'].includes(mode)) return;
    state.mode = mode;
    localStorage.setItem('friendship-mode', mode);
    document.body.dataset.mode = mode;
    renderAll();
    $('#modeDialog')?.close();
    showToast(mode === 'public' ? 'Открыта безопасная версия.' : 'Открыта личная версия. Проверьте материалы перед публикацией.');
  }

  function renderShell() {
    const cfg = data.siteConfig;
    document.title = cfg.title;
    document.body.dataset.mode = state.mode;
    $('#brandTitle').textContent = cfg.title;
    $('#footerTitle').textContent = cfg.title;
    $('#heroTitle').textContent = cfg.title;
    $('#heroSubtitle').textContent = cfg.subtitle;
    $('#heroPerson').textContent = `Именинник: ${cfg.birthdayPerson}`;
    $('#heroPeriod').textContent = cfg.period;
    $('#startButton').textContent = cfg.startButton;
    $('#sourceNote').textContent = cfg.sourceNote;
    $('#modeButtonText').textContent = state.mode === 'public' ? cfg.publicModeLabel : cfg.personalModeLabel;
  }

  function renderDossier() {
    $('#dossierGrid').innerHTML = visibleItems(data.dossier).map((item, index) => `
      <article class="dossier-card reveal" data-index="${String(index + 1).padStart(2, '0')}">
        <div><p class="card-label">${escapeHTML(item.title)}</p><p class="card-text">${escapeHTML(item.text)}</p></div>
        <div><div class="value">${escapeHTML(item.value)}</div><p class="card-comment">${escapeHTML(item.comment)}</p></div>
      </article>
    `).join('');
  }

  function renderStats() {
    $('#statsGrid').innerHTML = visibleItems(data.stats).map(item => `
      <article class="stat-card reveal">
        <span class="stat-kicker">${escapeHTML(item.category)} · ${escapeHTML(item.date)}</span>
        <div class="stat-value" data-counter="${typeof item.value === 'number' ? item.value : ''}" data-display="${escapeHTML(item.display)}">${typeof item.value === 'number' ? '0' : escapeHTML(item.display)}</div>
        <p class="card-label">${escapeHTML(item.title)}</p>
        <p class="card-comment">${escapeHTML(item.comment)}</p>
      </article>
    `).join('');
  }

  function renderFacts() {
    let items = visibleItems(data.facts);
    if (state.factFilter === 'low') items = items.filter(item => item.privacyLevel === 'low');
    if (state.factFilter === 'personal') items = state.mode === 'personal'
      ? data.facts.filter(item => item.approvedForPublication === false)
      : [];

    $('#factsGrid').innerHTML = items.length ? items.map(item => `
      <article class="fact-card reveal" tabindex="0" role="button" aria-expanded="false">
        <div class="fact-top">
          <span class="category-pill">${escapeHTML(item.date)}</span>
          <span class="privacy-badge ${escapeHTML(item.privacyLevel)}">${escapeHTML(privacyMap[item.privacyLevel] || item.privacyLevel)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="card-text">${escapeHTML(item.text)}</p>
        <div class="fact-context"><b>Контекст:</b> ${escapeHTML(item.context || 'Дополнительный контекст не требуется.')}</div>
        <span class="fact-open" aria-hidden="true">+</span>
      </article>
    `).join('') : `<div class="missing-data reveal"><h3>Здесь ничего нет</h3><p>${state.mode === 'public' ? 'Материалы этого фильтра доступны только в личной версии.' : 'Нет элементов для выбранного фильтра.'}</p></div>`;

    $$('.fact-card').forEach(card => {
      const toggle = () => {
        card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', String(card.classList.contains('is-open')));
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  function renderDictionary(activeIndex = 0) {
    const items = visibleItems(data.dictionary);
    const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
    $('#dictionaryList').innerHTML = items.map((item, index) => `
      <button class="dictionary-term ${index === safeIndex ? 'is-active' : ''}" type="button" role="option" aria-selected="${index === safeIndex}" data-dictionary-index="${index}">${escapeHTML(item.title)}</button>
    `).join('');

    const item = items[safeIndex];
    if (!item) {
      $('#dictionaryCard').innerHTML = '<h3>Нет данных</h3>';
      return;
    }
    $('#dictionaryCard').innerHTML = `
      <span class="privacy-badge ${escapeHTML(item.privacyLevel)}">${escapeHTML(item.danger)}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="dictionary-meaning">${escapeHTML(item.text)}</p>
      <div class="definition-grid">
        <div class="definition-item"><span>Кто чаще</span><b>${escapeHTML(item.usedBy)}</b></div>
        <div class="definition-item"><span>Период / происхождение</span><b>${escapeHTML(item.origin)}</b></div>
        <div class="definition-item"><span>Пример контекста</span><b>${escapeHTML(item.example)}</b></div>
        <div class="definition-item"><span>Источник</span><b>${escapeHTML(item.sourceReference)}</b></div>
      </div>
    `;

    $$('.dictionary-term').forEach(button => button.addEventListener('click', () => renderDictionary(Number(button.dataset.dictionaryIndex))));
  }

  function renderLanguage() {
    $('#wordTableBody').innerHTML = data.languageStats.words.map(item => `
      <tr><td><b>${escapeHTML(item.label)}</b></td><td>${item.bogdan}</td><td>${item.nikita}</td><td>${escapeHTML(item.note)}</td></tr>
    `).join('');
    const item = data.languageStats.emojiPlaceholder;
    $('#emojiPlaceholder').innerHTML = `
      <span class="category-pill">плейсхолдер без выдумок</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.text)}</p>
      <p><b>Нужно добавить:</b> ${escapeHTML(item.requiredData)}</p>
    `;
  }

  function renderTimeline() {
    const items = visibleItems(data.timeline);
    const years = ['all', ...items.map(item => item.date)];
    $('#timelineFilters').innerHTML = years.map(year => `
      <button class="chip ${state.timelineYear === year ? 'is-active' : ''}" type="button" data-year="${escapeHTML(year)}">${year === 'all' ? 'Все годы' : escapeHTML(year)}</button>
    `).join('');

    const maxMessages = Math.max(...items.map(item => item.messages || 0), 1);
    const filtered = state.timelineYear === 'all' ? items : items.filter(item => item.date === state.timelineYear);
    $('#timelineTrack').innerHTML = filtered.map(item => `
      <article class="timeline-item reveal">
        <div class="timeline-year">${escapeHTML(item.date)}</div>
        <div class="timeline-card">
          <span class="privacy-badge ${escapeHTML(item.privacyLevel)}">${escapeHTML(item.messages.toLocaleString('ru-RU'))} сообщений</span>
          <h3>${escapeHTML(item.title)}</h3>
          <p class="card-text">${escapeHTML(item.text)}</p>
          <p><b>Атмосфера:</b> ${escapeHTML(item.mood)}</p>
          <div class="timeline-meta">${(item.themes || []).map(theme => `<span class="timeline-tag">${escapeHTML(theme)}</span>`).join('')}</div>
          <div class="timeline-volume"><div class="volume-bar"><span style="--w:${Math.max(1, (item.messages / maxMessages) * 100)}%"></span></div><b>${escapeHTML(item.messages.toLocaleString('ru-RU'))}</b></div>
          ${item.note ? `<p class="card-comment">${escapeHTML(item.note)}</p>` : ''}
        </div>
      </article>
    `).join('');

    $$('[data-year]').forEach(button => button.addEventListener('click', () => {
      state.timelineYear = button.dataset.year;
      renderTimeline();
      observeDynamicElements();
    }));
  }

  function renderStories(activeIndex = 0) {
    const items = visibleItems(data.storylines);
    const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
    $('#storyTabs').innerHTML = items.map((item, index) => `
      <button class="story-tab ${index === safeIndex ? 'is-active' : ''}" type="button" role="tab" aria-selected="${index === safeIndex}" data-story-index="${index}">${escapeHTML(item.title)}</button>
    `).join('');

    const item = items[safeIndex];
    if (!item) return;
    $('#storyStage').innerHTML = `
      <span class="privacy-badge ${escapeHTML(item.privacyLevel)}">${escapeHTML(item.date)}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="story-lead">${escapeHTML(item.text)}</p>
      <div class="story-steps">
        <div class="story-step"><span>01 · С чего началось</span>${escapeHTML(item.start)}</div>
        <div class="story-step"><span>02 · План</span>${escapeHTML(item.plan)}</div>
        <div class="story-step"><span>03 · Где сломалось</span>${escapeHTML(item.failure)}</div>
        <div class="story-step"><span>04 · Самое смешное</span>${escapeHTML(item.funniest)}</div>
        <div class="story-step"><span>05 · Финал</span>${escapeHTML(item.ending)}</div>
      </div>
      <blockquote class="story-quote">${escapeHTML(item.quote)}</blockquote>
    `;
    $$('.story-tab').forEach(button => button.addEventListener('click', () => renderStories(Number(button.dataset.storyIndex))));
  }

  function renderPlans() {
    $('#plansGrid').innerHTML = visibleItems(data.plans).map(item => `
      <article class="plan-card reveal">
        <div class="fact-top"><span class="status-badge">${escapeHTML(item.status)}</span><span class="category-pill">${escapeHTML(item.date)}</span></div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="card-text">${escapeHTML(item.text)}</p>
        <div class="plan-meter" aria-label="Вероятность реализации ${item.probability}%"><span style="--probability:${item.probability}%"></span></div>
        <div class="plan-foot"><span>${escapeHTML(item.returns)}</span><b>${item.probability}%</b></div>
        <p class="card-comment">${escapeHTML(item.comment)}</p>
      </article>
    `).join('');
  }

  function renderDebates() {
    $('#debatesAccordion').innerHTML = visibleItems(data.debates).map((item, index) => `
      <article class="accordion-item reveal">
        <button class="accordion-button" type="button" aria-expanded="false" aria-controls="debate-${index}">
          <div><span class="category-pill">${escapeHTML(item.date)} · ${escapeHTML(item.duration)}</span><h3>${escapeHTML(item.title)}</h3></div><span aria-hidden="true">+</span>
        </button>
        <div class="accordion-panel" id="debate-${index}">
          <p>${escapeHTML(item.text)}</p>
          <div class="debate-grid">
            <div class="debate-field"><b>Главные аргументы</b>${(item.arguments || []).map(argument => `• ${escapeHTML(argument)}`).join('<br>')}</div>
            <div class="debate-field"><b>Чем закончилось</b>${escapeHTML(item.ending)}</div>
            <div class="debate-field"><b>Кто сменил тему</b>${escapeHTML(item.themeChangedBy)}</div>
            <div class="debate-field"><b>Был ли смысл</b>${escapeHTML(item.meaning)}</div>
          </div>
        </div>
      </article>
    `).join('');
    $$('.accordion-button').forEach(button => button.addEventListener('click', () => {
      const item = button.closest('.accordion-item');
      item.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(item.classList.contains('is-open')));
    }));
  }

  function quotePool() {
    return visibleItems(data.quotes);
  }

  function renderQuote(randomize = false) {
    const items = quotePool();
    if (!items.length) return;
    if (randomize) {
      let next = Math.floor(Math.random() * items.length);
      if (items.length > 1 && next === state.quoteIndex) next = (next + 1) % items.length;
      state.quoteIndex = next;
    } else {
      state.quoteIndex = Math.min(state.quoteIndex, items.length - 1);
    }
    const item = items[state.quoteIndex];
    $('#quoteCategory').textContent = item.category;
    $('#randomQuote').textContent = `«${item.text}»`;
    $('#quoteMeta').textContent = `${item.author} · ${item.date}`;
    $('#quoteContext').textContent = item.context;
  }

  function renderMiniStories() {
    $('#miniStoriesRail').innerHTML = visibleItems(data.miniStories).map(item => `
      <article class="mini-story-card reveal">
        <span class="mini-story-icon" aria-hidden="true">${escapeHTML(item.icon)}</span>
        <span class="category-pill">${escapeHTML(item.date)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.text)}</p>
        <p class="story-ending">${escapeHTML(item.ending)}</p>
      </article>
    `).join('');
  }

  function renderAwards() {
    $('#awardsGrid').innerHTML = visibleItems(data.awards).map(item => `
      <article class="award-card reveal" tabindex="0" role="button" aria-expanded="false">
        <div class="award-envelope"><span>Открыть конверт</span></div>
        <div class="award-content">
          <h3>${escapeHTML(item.title)}</h3>
          <div class="award-winner">${escapeHTML(item.winner)}</div>
          <div class="award-proof">${escapeHTML(item.proof)}</div>
          <p class="card-text">${escapeHTML(item.text)}</p>
          <p class="card-comment">Ведущий: ${escapeHTML(item.hostComment)}</p>
        </div>
      </article>
    `).join('');

    $$('.award-card').forEach(card => {
      const open = () => {
        card.classList.add('is-open');
        card.setAttribute('aria-expanded', 'true');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
  }

  function quizPool() {
    return data.quiz.filter(item => state.mode === 'personal' || item.approvedForPublication === true);
  }

  function renderQuiz(resetAnswer = true) {
    const items = quizPool();
    if (!items.length) return;
    state.quizIndex %= items.length;
    if (resetAnswer) state.quizAnswered = false;
    const item = items[state.quizIndex];
    $('#quizProgress').textContent = `${state.quizIndex + 1}/${items.length}`;
    $('#quizScore').textContent = `${state.quizScore} верно`;
    $('#quizQuote').textContent = `«${item.quote}»`;
    $('#quizOptions').innerHTML = item.options.map(option => `<button class="quiz-option" type="button" data-answer="${escapeHTML(option)}">${escapeHTML(option)}</button>`).join('');
    $('#quizResult').textContent = '';
    $('#nextQuizButton').hidden = true;

    $$('.quiz-option').forEach(button => button.addEventListener('click', () => {
      if (state.quizAnswered) return;
      state.quizAnswered = true;
      const isCorrect = button.dataset.answer === item.correct;
      if (isCorrect) state.quizScore += 1;
      $$('.quiz-option').forEach(optionButton => {
        if (optionButton.dataset.answer === item.correct) optionButton.classList.add('is-correct');
        else if (optionButton === button) optionButton.classList.add('is-wrong');
        optionButton.disabled = true;
      });
      $('#quizScore').textContent = `${state.quizScore} верно`;
      $('#quizResult').innerHTML = `<b>${isCorrect ? 'Верно.' : `Нет. Это ${escapeHTML(item.correct)}.`}</b> ${escapeHTML(item.date)} · ${escapeHTML(item.context)} ${escapeHTML(item.comment)}`;
      $('#nextQuizButton').hidden = false;
    }));
  }

  function renderGenerator() {
    const select = $('#situationSelect');
    select.innerHTML = data.responseGenerator.map((item, index) => `<option value="${index}">${escapeHTML(item.situation)}</option>`).join('');
    generateResponses();
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function generateResponses() {
    const item = data.responseGenerator[Number($('#situationSelect').value || 0)];
    $('#responseGrid').innerHTML = `
      <article class="response-card"><span>Богдан.exe</span><blockquote>«${escapeHTML(randomFrom(item.bogdan))}»</blockquote></article>
      <article class="response-card"><span>Никита.exe</span><blockquote>«${escapeHTML(randomFrom(item.nikita))}»</blockquote></article>
    `;
    $('#syntheticNote').textContent = item.note;
  }

  function renderGallery() {
    const items = visibleItems(data.gallery);
    $('#galleryGrid').innerHTML = items.map((item, index) => `
      <article class="gallery-card reveal" tabindex="0" role="button" data-gallery-index="${index}">
        <img class="gallery-real is-hidden" src="${escapeHTML(item.src)}" alt="${escapeHTML(item.title)}">
        <div class="gallery-placeholder">
          <span class="category-pill">${escapeHTML(item.date)}</span>
          <div><b>${escapeHTML(item.title)}</b><p class="card-comment">${escapeHTML(item.text)}</p></div>
          <code>${escapeHTML(item.src)}</code>
        </div>
      </article>
    `).join('');

    $$('.gallery-card').forEach(card => {
      const img = $('img', card);
      img.addEventListener('load', () => {
        img.classList.remove('is-hidden');
        $('.gallery-placeholder', card).classList.add('is-hidden');
      }, { once: true });
      const open = () => openGallery(items[Number(card.dataset.galleryIndex)]);
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });

    $('#audioList').innerHTML = visibleItems(data.audio).map(item => `
      <article class="audio-card reveal">
        <div><b>${escapeHTML(item.title)}</b><p class="card-comment">${escapeHTML(item.text)}</p></div>
        <div><audio controls preload="none" src="${escapeHTML(item.src)}"></audio><div class="audio-placeholder">Файл: <code>${escapeHTML(item.src)}</code></div></div>
      </article>
    `).join('');
  }

  function openGallery(item) {
    const content = $('#galleryDialogContent');
    content.innerHTML = `
      <img src="${escapeHTML(item.src)}" alt="${escapeHTML(item.title)}" onerror="this.remove()">
      <span class="privacy-badge ${escapeHTML(item.privacyLevel)}">${escapeHTML(item.date)}</span>
      <h2>${escapeHTML(item.title)}</h2>
      <p>${escapeHTML(item.text)}</p>
      <p><b>Связанная история:</b> ${escapeHTML(item.story)}</p>
      <p><code>${escapeHTML(item.src)}</code></p>
    `;
    $('#galleryDialog').showModal();
  }

  function renderWarm() {
    $('#warmGrid').innerHTML = visibleItems(data.warmMoments).map(item => `
      <article class="warm-card reveal">
        <span class="category-pill">${escapeHTML(item.date)}</span>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.text)}</p>
      </article>
    `).join('');
  }

  function renderFinal() {
    $('#finalTitle').textContent = `${data.siteConfig.birthdayPerson.slice(0, -1)}ит, с днём рождения.`;
    $('#finalMessage').textContent = state.mode === 'personal' ? data.finalMessage.personal : data.finalMessage.public;

    const visual = $('#finalVisual');
    visual.innerHTML = `
      <img class="is-hidden" src="assets/images/hero-photo.jpg" alt="Совместная фотография Богдана и Никиты">
      <div class="photo-placeholder"><span>совместная фотография</span><small>assets/images/hero-photo.jpg</small></div>
    `;
    const image = $('img', visual);
    image.addEventListener('load', () => {
      image.classList.remove('is-hidden');
      $('.photo-placeholder', visual).classList.add('is-hidden');
    }, { once: true });
  }

  function renderReviewLists() {
    const fill = (selector, items) => { $(selector).innerHTML = items.map(item => `<li>${escapeHTML(item)}</li>`).join(''); };
    fill('#approvalList', data.reviewLists.quotesNeedApproval);
    fill('#excludedList', data.reviewLists.excludedSensitive);
    fill('#mediaSlotList', data.reviewLists.mediaSlots);
  }

  function renderAll() {
    renderShell();
    renderDossier();
    renderStats();
    renderFacts();
    renderDictionary();
    renderLanguage();
    renderTimeline();
    renderStories();
    renderPlans();
    renderDebates();
    renderQuote();
    renderMiniStories();
    renderAwards();
    state.quizIndex = 0;
    state.quizScore = 0;
    renderQuiz();
    renderGenerator();
    renderGallery();
    renderWarm();
    renderFinal();
    renderReviewLists();
    observeDynamicElements();
  }

  function observeDynamicElements() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    $$('.reveal').forEach(element => revealObserver.observe(element));

    if (counterObserver) counterObserver.disconnect();
    counterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.55 });
    $$('[data-counter]').forEach(counter => counterObserver.observe(counter));
  }

  function animateCounter(element) {
    const target = Number(element.dataset.counter);
    const finalDisplay = element.dataset.display;
    if (!Number.isFinite(target)) { element.textContent = finalDisplay; return; }
    const duration = 900;
    const start = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased).toLocaleString('ru-RU');
      if (progress < 1) requestAnimationFrame(step);
      else element.textContent = finalDisplay;
    };
    requestAnimationFrame(step);
  }

  function bindStaticEvents() {
    $('#modeButton').addEventListener('click', () => $('#modeDialog').showModal());
    $$('[data-set-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.setMode)));

    $('#menuButton').addEventListener('click', () => {
      const nav = $('#mobileNav');
      const open = nav.classList.toggle('is-open');
      $('#menuButton').setAttribute('aria-expanded', String(open));
    });
    $$('#mobileNav a').forEach(link => link.addEventListener('click', () => {
      $('#mobileNav').classList.remove('is-open');
      $('#menuButton').setAttribute('aria-expanded', 'false');
    }));

    $$('[data-scroll]').forEach(button => button.addEventListener('click', () => $(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' })));

    $$('[data-fact-filter]').forEach(button => button.addEventListener('click', () => {
      state.factFilter = button.dataset.factFilter;
      $$('[data-fact-filter]').forEach(item => item.classList.toggle('is-active', item === button));
      renderFacts();
      observeDynamicElements();
    }));

    $('#newQuoteButton').addEventListener('click', () => renderQuote(true));
    $('#nextQuizButton').addEventListener('click', () => {
      state.quizIndex = (state.quizIndex + 1) % quizPool().length;
      renderQuiz();
    });
    $('#generateResponseButton').addEventListener('click', generateResponses);
    $('#situationSelect').addEventListener('change', generateResponses);

    $('#rouletteButton').addEventListener('click', () => {
      const memes = visibleItems(data.dictionary);
      const meme = randomFrom(memes);
      showToast(`${meme.title}: ${meme.text}`);
    });

    $('#lastJokeButton').addEventListener('click', () => {
      const jokes = state.mode === 'personal'
        ? ['Слит шлюха.', 'Рисуй везде Калашникова.', 'На выхах резюме сделаю. Напизжу.', 'Ты на квесте?']
        : ['Как обычно.', 'Пустослов.', 'Я в воде размешиваю и представляю кофе.', 'Ты на квесте?'];
      $('#easterMessage').textContent = randomFrom(jokes);
    });

    $('#uselessButton').addEventListener('click', () => {
      state.uselessClicks += 1;
      const messages = ['Щас.', 'Ещё щас.', 'Почти.', 'Ну ладно.', 'НЕ ИГНОРИРУЙ МЕНЯ'];
      $('#easterMessage').textContent = messages[Math.min(state.uselessClicks - 1, messages.length - 1)];
      if (state.uselessClicks >= 5) $('#uselessButton').textContent = 'Кнопка выполнила ничего';
    });

    $('#openReviewButton').addEventListener('click', () => $('#reviewDialog').showModal());
    $('#copySourceButton').addEventListener('click', async () => {
      const text = `${data.siteConfig.title} — интерактивный сайт по подготовленному анализу Telegram-переписки`;
      try { await navigator.clipboard.writeText(text); showToast('Название источника скопировано.'); }
      catch { showToast(text); }
    });

    window.addEventListener('scroll', () => {
      $('#topbar').classList.toggle('is-scrolled', window.scrollY > 18);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
      $('#readingProgress').style.width = `${progress}%`;
    }, { passive: true });
  }

  bindStaticEvents();
  renderAll();
})();
