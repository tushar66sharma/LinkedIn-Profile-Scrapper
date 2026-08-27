// ─── DOM References ──────────────────────────────────────────────────────────
const form        = document.getElementById('searchForm');
const input       = document.getElementById('profileUrl');
const searchBtn   = document.getElementById('searchBtn');
const btnText     = searchBtn.querySelector('.btn-text');
const btnLoader   = searchBtn.querySelector('.btn-loader');
const errorBanner = document.getElementById('errorBanner');
const errorMsg    = document.getElementById('errorMessage');
const results     = document.getElementById('results');
const rawToggle   = document.getElementById('rawToggle');
const rawJson     = document.getElementById('rawJson');

// ─── Example Links ───────────────────────────────────────────────────────────
document.querySelectorAll('.example-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    input.value = link.dataset.url;
    form.dispatchEvent(new Event('submit'));
  });
});

// ─── Raw JSON Toggle ─────────────────────────────────────────────────────────
rawToggle.addEventListener('click', () => {
  const isHidden = rawJson.hidden;
  rawJson.hidden = !isHidden;
  rawToggle.innerHTML = isHidden
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> Hide Raw JSON`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg> View Raw JSON`;
});

// ─── Form Submit ─────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url) return;

  setLoading(true);
  hideError();
  hideResults();

  try {
    const apiUrl = `/api/profile?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || json.status === 'error') {
      showError(json.message || `Server error: ${res.status}`);
      return;
    }

    renderProfile(json.data, json);

  } catch (err) {
    showError('Failed to reach the API. Make sure the server is running.');
  } finally {
    setLoading(false);
  }
});

// ─── Render Functions ─────────────────────────────────────────────────────────
function renderProfile(data, rawData) {
  // ── Basic Info ──
  const imgEl          = document.getElementById('profileImage');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  if (data.profileImage) {
    imgEl.src = data.profileImage;
    imgEl.hidden = false;
    avatarPlaceholder.hidden = true;
  } else {
    imgEl.hidden = true;
    avatarPlaceholder.hidden = false;
  }

  setText('profileName',    data.name     || 'Name not found');
  setText('profileHeadline', data.headline || 'No headline available');
  setText('locationText',   data.location || 'Location unknown');

  const aboutSection = document.getElementById('aboutSection');
  const aboutText    = document.getElementById('aboutText');
  if (data.about) {
    aboutText.textContent = data.about;
    aboutSection.hidden = false;
  } else {
    aboutSection.hidden = true;
  }

  // ── Experience ──
  const expList  = document.getElementById('experienceList');
  const expEmpty = document.getElementById('expEmpty');
  expList.innerHTML = '';
  if (data.experience && data.experience.length > 0) {
    expEmpty.hidden = true;
    data.experience.forEach((exp, i) => {
      const isLast = i === data.experience.length - 1;
      expList.innerHTML += `
        <li class="timeline-item">
          <div class="timeline-dot-col">
            <div class="timeline-dot"></div>
            ${!isLast ? '<div class="timeline-line"></div>' : ''}
          </div>
          <div class="timeline-content">
            <p class="timeline-title">${escHtml(exp.title || '—')}</p>
            <p class="timeline-sub">${escHtml(exp.company || '')}</p>
            <p class="timeline-date">${escHtml(exp.dateRange || '')}</p>
          </div>
        </li>`;
    });
  } else {
    expEmpty.hidden = false;
  }

  // ── Education ──
  const eduList  = document.getElementById('educationList');
  const eduEmpty = document.getElementById('eduEmpty');
  eduList.innerHTML = '';
  if (data.education && data.education.length > 0) {
    eduEmpty.hidden = true;
    data.education.forEach((edu, i) => {
      const isLast = i === data.education.length - 1;
      eduList.innerHTML += `
        <li class="timeline-item">
          <div class="timeline-dot-col">
            <div class="timeline-dot"></div>
            ${!isLast ? '<div class="timeline-line"></div>' : ''}
          </div>
          <div class="timeline-content">
            <p class="timeline-title">${escHtml(edu.school || '—')}</p>
            <p class="timeline-sub">${escHtml(edu.degree || '')} ${edu.fieldOfStudy ? '· ' + escHtml(edu.fieldOfStudy) : ''}</p>
            <p class="timeline-date">${escHtml(edu.dateRange || '')}</p>
          </div>
        </li>`;
    });
  } else {
    eduEmpty.hidden = false;
  }

  // ── Skills ──
  const skillsList  = document.getElementById('skillsList');
  const skillsEmpty = document.getElementById('skillsEmpty');
  skillsList.innerHTML = '';
  if (data.skills && data.skills.length > 0) {
    skillsEmpty.hidden = true;
    data.skills.forEach(skill => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = skill;
      skillsList.appendChild(tag);
    });
  } else {
    skillsEmpty.hidden = false;
  }

  // ── Certifications & Languages ──
  const certsList  = document.getElementById('certsList');
  const langsList  = document.getElementById('langsList');
  const extraEmpty = document.getElementById('extraEmpty');
  certsList.innerHTML = '';
  langsList.innerHTML = '';

  const hasCerts = data.certifications && data.certifications.length > 0;
  const hasLangs = data.languages && data.languages.length > 0;

  if (!hasCerts && !hasLangs) {
    extraEmpty.hidden = false;
  } else {
    extraEmpty.hidden = true;

    if (hasCerts) {
      certsList.innerHTML = `<p class="section-title" style="margin-bottom:10px;">Certifications</p><div class="item-list">${
        data.certifications.map(c => `
          <div class="item-entry">
            <p class="item-name">${escHtml(c.name || '—')}</p>
            ${c.authority ? `<p class="item-sub">${escHtml(c.authority)}</p>` : ''}
          </div>`).join('')
      }</div>`;
    }

    if (hasLangs) {
      langsList.innerHTML = `<p class="section-title" style="margin-bottom:10px;${hasCerts ? 'margin-top:20px;' : ''}">Languages</p><div class="tags-wrapper">${
        data.languages.map(l => `<span class="tag">${escHtml(l)}</span>`).join('')
      }</div>`;
    }
  }

  // ── Raw JSON ──
  rawJson.textContent = JSON.stringify(rawData, null, 2);
  rawJson.hidden = true;
  rawToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg> View Raw JSON`;

  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(loading) {
  searchBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoader.hidden = !loading;
}

function showError(message) {
  errorMsg.textContent = message;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
}

function hideResults() {
  results.hidden = true;
}
