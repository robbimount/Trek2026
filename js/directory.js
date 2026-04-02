/**
 * Trek Family Directory — Authentication & Rendering
 *
 * SETUP:
 * Replace YOUR_GOOGLE_CLIENT_ID with your OAuth 2.0 Client ID from
 * Google Cloud Console → APIs & Services → Credentials.
 *
 * Access control (who can sign in, who sees which families) is managed
 * entirely in data/directory.json — no need to touch this file for
 * adding/removing users or updating family assignments.
 */

// ============================================================
// Configuration
// ============================================================

const CLIENT_ID = '359413044723-jcdum67h4hdgucabnml95jb6i4e1l663.apps.googleusercontent.com';

// ============================================================
// UI elements
// ============================================================

const signInScreen          = document.getElementById('sign-in-screen');
const accessDeniedScreen    = document.getElementById('access-denied-screen');
const directoryScreen       = document.getElementById('directory-screen');
const announcementsSection  = document.getElementById('announcements-section');
const announcementsList     = document.getElementById('announcements-list');
const signOutBtn            = document.getElementById('sign-out-btn');
const deniedEmailEl         = document.getElementById('denied-email');
const userNameEl            = document.getElementById('user-name');
const familiesGrid          = document.getElementById('families-grid');
const familiesSummary       = document.getElementById('families-summary');

// ============================================================
// Google Identity Services initialization
// ============================================================

window.addEventListener('load', () => {
  if (typeof google === 'undefined') {
    console.error('Google Identity Services script did not load.');
    return;
  }

  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
  });

  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280 }
  );
});

// ============================================================
// Auth callback — called by Google after sign-in
// ============================================================

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  const email   = (payload.email || '').toLowerCase().trim();
  const name    = payload.name || email;

  // Fetch directory data, then determine access from it
  fetch('data/directory.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load directory data.');
      return res.json();
    })
    .then(data => resolveAccess(data, email, name))
    .catch(err => {
      console.error(err);
      showAccessDenied(email);
    });
}

// ============================================================
// Access resolution — all access rules live in the JSON
// ============================================================

function resolveAccess(data, email, name) {
  const leaders = (data.leaders || []).map(e => e.toLowerCase().trim());
  const isLeader = leaders.includes(email);

  const visibleFamilies = isLeader
    ? (data.families || [])
    : (data.families || []).filter(f =>
        (f.accessEmails || []).map(e => e.toLowerCase().trim()).includes(email)
      );

  if (!isLeader && visibleFamilies.length === 0) {
    showAccessDenied(email);
    return;
  }

  showDirectory(name, isLeader, visibleFamilies, data.announcements || []);
}

// ============================================================
// Screen transitions
// ============================================================

function showDirectory(name, isLeader, families, announcements) {
  signInScreen.style.display    = 'none';
  accessDeniedScreen.style.display = 'none';
  directoryScreen.style.display = 'block';
  signOutBtn.style.display      = 'inline-block';
  userNameEl.textContent        = name;

  renderAnnouncements(announcements);
  renderDirectory(families, isLeader);
}

function showAccessDenied(email) {
  signInScreen.style.display       = 'none';
  accessDeniedScreen.style.display = 'flex';
  directoryScreen.style.display    = 'none';
  signOutBtn.style.display         = 'none';
  deniedEmailEl.textContent        = email;
}

function showSignIn() {
  signInScreen.style.display       = 'flex';
  accessDeniedScreen.style.display = 'none';
  directoryScreen.style.display    = 'none';
  signOutBtn.style.display         = 'none';
}

// ============================================================
// Sign-out
// ============================================================

signOutBtn.addEventListener('click', () => {
  google.accounts.id.disableAutoSelect();
  showSignIn();
});

document.getElementById('try-different-account-btn').addEventListener('click', () => {
  google.accounts.id.disableAutoSelect();
  showSignIn();
  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280 }
  );
});

// ============================================================
// Announcements rendering
// ============================================================

function renderAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) {
    announcementsSection.style.display = 'none';
    return;
  }

  announcementsSection.style.display = 'block';
  announcementsList.innerHTML = announcements.map(a => {
    const title = escapeHtml(a.title || '');
    const body  = escapeHtml(a.body  || '');
    const date  = a.date ? `<time class="announcement-date">${escapeHtml(a.date)}</time>` : '';
    return `
      <article class="announcement-card">
        <div class="announcement-header">
          ${date}
          <h3 class="announcement-title">${title}</h3>
        </div>
        <p class="announcement-body">${body}</p>
      </article>`;
  }).join('');
}

// ============================================================
// Directory rendering
// ============================================================

function renderDirectory(families, isLeader) {
  if (families.length === 0) {
    familiesGrid.innerHTML = '<div class="directory-empty"><h2>No families listed yet.</h2><p>Check back soon!</p></div>';
    familiesSummary.textContent = '';
    return;
  }

  const totalMembers = families.reduce((sum, f) => sum + (f.members || []).length, 0);
  const label = isLeader ? 'All families' : (families.length === 1 ? 'Your family' : 'Your families');
  familiesSummary.textContent = `${label} · ${families.length} ${families.length === 1 ? 'family' : 'families'} · ${totalMembers} members`;

  familiesGrid.innerHTML = families.map(family => buildFamilyCard(family)).join('');
}

function buildFamilyCard(family) {
  const name    = escapeHtml(family.name || 'Unnamed Family');
  const members = family.members || [];

  const membersHtml = members.length > 0
    ? members.map(m => {
        const memberName  = escapeHtml(m.name  || '');
        const memberRole  = m.role  ? `<span class="member-role">${escapeHtml(m.role)}</span>` : '';
        const memberNotes = m.notes ? `<span class="member-notes">${escapeHtml(m.notes)}</span>` : '';

        const details = [
          m.ward   ? `<span class="member-detail">${escapeHtml(m.ward)}</span>`   : '',
          m.age    ? `<span class="member-detail">${escapeHtml(String(m.age))}</span>` : '',
          m.gender ? `<span class="member-detail">${escapeHtml(m.gender)}</span>` : '',
          m.phone  ? `<a class="member-detail member-phone" href="tel:${escapeHtml(m.phone)}">${escapeHtml(m.phone)}</a>` : '',
        ].filter(Boolean).join('<span class="member-detail-sep">·</span>');

        return `<li class="member-item">
          <div class="member-row">
            <span class="member-name">${memberName}</span>
            ${memberRole}${memberNotes}
          </div>
          ${details ? `<div class="member-details">${details}</div>` : ''}
        </li>`;
      }).join('')
    : '<li class="member-item"><span class="member-name" style="color:#aaa;font-style:italic">No members listed</span></li>';

  const countText = members.length === 1 ? '1 member' : `${members.length} members`;

  return `
    <article class="family-card" aria-label="${name} family">
      <div class="family-card-header">
        <div class="family-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
        </div>
        <h2 class="family-card-name">${name}</h2>
      </div>
      <div class="family-card-body">
        <ul class="member-list" aria-label="Members of ${name} family">
          ${membersHtml}
        </ul>
        <p class="family-card-count">${countText}</p>
      </div>
    </article>`;
}

// ============================================================
// Utilities
// ============================================================

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json      = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
