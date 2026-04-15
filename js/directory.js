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
 *
 * ADMIN SETUP:
 * After running `terraform apply`, set SAVE_API_URL to the value of
 * `terraform output api_gateway_url`.
 */

// ============================================================
// Configuration
// ============================================================

const CLIENT_ID = '359413044723-jcdum67h4hdgucabnml95jb6i4e1l663.apps.googleusercontent.com';

// Admin persistence — set this to the value of `terraform output api_gateway_url`
const SAVE_API_URL = 'https://vhx7wkvrzc.execute-api.us-west-1.amazonaws.com/save';

// ============================================================
// Admin state
// ============================================================

let googleCredentialToken = null; // raw Google JWT; only set on fresh sign-in
let isAdmin = false;
let adminModeActive = false;
let currentDirectoryData = null;  // live copy of full JSON; mutated by edit actions

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
  googleCredentialToken = response.credential; // store for admin saves
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
  currentDirectoryData = data;
  const admins  = (data.admins  || []).map(e => e.toLowerCase().trim());
  const leaders = (data.leaders || []).map(e => e.toLowerCase().trim());

  isAdmin = admins.includes(email);
  const isLeader = isAdmin || leaders.includes(email);

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
  signInScreen.style.display       = 'none';
  accessDeniedScreen.style.display = 'none';
  directoryScreen.style.display    = 'block';
  signOutBtn.style.display         = 'inline-block';
  userNameEl.textContent           = name;

  renderAnnouncements(announcements);
  renderDirectory(families, isLeader);

  if (isAdmin) {
    document.getElementById('admin-mode-btn').style.display = 'inline-block';
    renderAdminPanel();
  }
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
  // Always show section in admin mode so admins can add announcements
  if ((!announcements || announcements.length === 0) && !adminModeActive) {
    announcementsSection.style.display = 'none';
    return;
  }

  announcementsSection.style.display = 'block';

  const adminBar = adminModeActive
    ? `<div class="ann-admin-bar">
         <button class="btn-add-announcement" onclick="addAnnouncement()">+ Add Announcement</button>
       </div>`
    : '';

  announcementsList.innerHTML = adminBar + (announcements || []).map((a, i) => {
    const title = escapeHtml(a.title || '');
    const body  = escapeHtml(a.body  || '');
    const date  = a.date ? `<time class="announcement-date">${escapeHtml(a.date)}</time>` : '';
    const adminBtns = adminModeActive
      ? `<div class="ann-admin-actions">
           <button class="btn-ann-edit" data-index="${i}">Edit</button>
           <button class="btn-ann-delete" data-index="${i}">Delete</button>
         </div>`
      : '';
    return `
      <article class="announcement-card">
        <div class="announcement-header">
          ${date}
          <h3 class="announcement-title">${title}</h3>
          ${adminBtns}
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

  familiesGrid.innerHTML = families.map((family, i) => buildFamilyCard(family, i)).join('');
}

function buildFamilyCard(family, familyIndex) {
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

  const editBtn = adminModeActive
    ? `<button class="btn-admin-edit-family" data-family-index="${familyIndex}"
               aria-label="Edit ${name} family">Edit</button>`
    : '';

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
        ${editBtn}
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
// Event delegation for dynamically rendered admin buttons
// ============================================================

document.getElementById('announcements-list').addEventListener('click', e => {
  if (!adminModeActive) return;
  const btn = e.target.closest('button');
  if (!btn) return;
  const idx = parseInt(btn.dataset.index, 10);
  if (btn.classList.contains('btn-ann-edit'))   openAnnouncementModal(idx);
  if (btn.classList.contains('btn-ann-delete')) deleteAnnouncement(idx);
});

document.getElementById('families-grid').addEventListener('click', e => {
  if (!adminModeActive) return;
  const btn = e.target.closest('button');
  if (!btn) return;
  const idx = parseInt(btn.dataset.familyIndex, 10);
  if (btn.classList.contains('btn-admin-edit-family')) openFamilyModal(idx);
});

// ============================================================
// Admin Mode toggle
// ============================================================

function toggleAdminMode() {
  adminModeActive = !adminModeActive;
  const btn = document.getElementById('admin-mode-btn');
  btn.textContent = adminModeActive ? 'Exit Admin Mode' : 'Admin Mode';
  btn.classList.toggle('btn-admin-active', adminModeActive);
  document.getElementById('admin-panel').style.display = adminModeActive ? 'block' : 'none';
  document.getElementById('save-all-container').style.display = adminModeActive ? 'flex' : 'none';
  renderAnnouncements(currentDirectoryData.announcements || []);
  renderDirectory(currentDirectoryData.families || [], true);
  if (adminModeActive) renderAdminPanel();
}

// ============================================================
// Admin Panel — Leaders & Admins lists
// ============================================================

function renderAdminPanel() {
  renderEmailList('leaders-list', currentDirectoryData.leaders || [], 'removeLeader');
  renderEmailList('admins-list',  currentDirectoryData.admins  || [], 'removeAdmin');
}

function renderEmailList(listId, emails, removeFnName) {
  document.getElementById(listId).innerHTML = emails.map((e, i) =>
    `<li>
       <span>${escapeHtml(e)}</span>
       <button class="btn-admin-remove" onclick="${removeFnName}(${i})" aria-label="Remove ${escapeHtml(e)}">✕</button>
     </li>`
  ).join('');
}

function addLeader() {
  const input = document.getElementById('add-leader-input');
  const email = input.value.toLowerCase().trim();
  if (!email) return;
  if (!currentDirectoryData.leaders.map(e => e.toLowerCase()).includes(email))
    currentDirectoryData.leaders.push(email);
  input.value = '';
  renderAdminPanel();
}

function removeLeader(i) {
  currentDirectoryData.leaders.splice(i, 1);
  renderAdminPanel();
}

function addAdmin() {
  const input = document.getElementById('add-admin-input');
  const email = input.value.toLowerCase().trim();
  if (!email) return;
  if (!currentDirectoryData.admins.map(e => e.toLowerCase()).includes(email))
    currentDirectoryData.admins.push(email);
  input.value = '';
  renderAdminPanel();
}

function removeAdmin(i) {
  currentDirectoryData.admins.splice(i, 1);
  renderAdminPanel();
}

function addNewFamily() {
  currentDirectoryData.families.push({ name: 'New Family', accessEmails: [], members: [] });
  renderDirectory(currentDirectoryData.families, true);
  openFamilyModal(currentDirectoryData.families.length - 1);
}

// ============================================================
// Announcement modal
// ============================================================

function addAnnouncement() {
  currentDirectoryData.announcements.unshift({ date: '', title: '', body: '' });
  renderAnnouncements(currentDirectoryData.announcements);
  openAnnouncementModal(0);
}

function openAnnouncementModal(idx) {
  const a = currentDirectoryData.announcements[idx] || {};
  document.getElementById('ann-edit-index').value = idx;
  document.getElementById('ann-edit-date').value  = a.date  || '';
  document.getElementById('ann-edit-title').value = a.title || '';
  document.getElementById('ann-edit-body').value  = a.body  || '';
  document.getElementById('announcement-modal').style.display = 'flex';
}

function saveAnnouncementModal() {
  const idx = parseInt(document.getElementById('ann-edit-index').value, 10);
  currentDirectoryData.announcements[idx] = {
    date:  document.getElementById('ann-edit-date').value.trim(),
    title: document.getElementById('ann-edit-title').value.trim(),
    body:  document.getElementById('ann-edit-body').value.trim(),
  };
  closeModal('announcement-modal');
  renderAnnouncements(currentDirectoryData.announcements);
}

function deleteAnnouncement(idx) {
  if (!confirm('Delete this announcement?')) return;
  currentDirectoryData.announcements.splice(idx, 1);
  renderAnnouncements(currentDirectoryData.announcements);
}

// ============================================================
// Family modal
// ============================================================

function openFamilyModal(familyIndex) {
  const family = currentDirectoryData.families[familyIndex];
  document.getElementById('family-edit-index').value = familyIndex;
  document.getElementById('family-edit-name').value  = family.name || '';
  renderAccessEmailsEditor(family.accessEmails || []);
  renderMembersEditor(family.members || []);
  document.getElementById('family-modal').style.display = 'flex';
}

function renderAccessEmailsEditor(emails) {
  document.getElementById('family-access-emails-list').innerHTML = emails.map(e =>
    `<div class="access-email-row">
       <input class="access-email-input form-input" type="email" value="${escapeHtml(e)}" placeholder="email@example.com">
       <button class="btn-admin-remove" onclick="removeAccessEmailRow(this)" aria-label="Remove email">✕</button>
     </div>`
  ).join('');
}

function addAccessEmailField() {
  const div = document.createElement('div');
  div.className = 'access-email-row';
  div.innerHTML = `<input class="access-email-input form-input" type="email" placeholder="email@example.com">
                   <button class="btn-admin-remove" onclick="removeAccessEmailRow(this)" aria-label="Remove email">✕</button>`;
  document.getElementById('family-access-emails-list').appendChild(div);
}

function removeAccessEmailRow(btn) {
  btn.closest('.access-email-row').remove();
}

function renderMembersEditor(members) {
  document.getElementById('family-members-editor').innerHTML = members.map(m => memberRowHtml(m)).join('');
}

function memberRowHtml(m) {
  const roleOptions = ['', 'Pa', 'Ma'].map(r =>
    `<option value="${r}" ${(m.role || '') === r ? 'selected' : ''}>${r || '(none)'}</option>`
  ).join('');
  const genderOptions = ['Adult', 'Boy', 'Girl'].map(g =>
    `<option value="${g}" ${(m.gender || 'Adult') === g ? 'selected' : ''}>${g}</option>`
  ).join('');
  const familyNum = m.family || '';
  return `<div class="member-edit-row">
    <input class="me-name   form-input" placeholder="Name"  value="${escapeHtml(m.name  || '')}">
    <input class="me-phone  form-input" placeholder="Phone" value="${escapeHtml(m.phone || '')}">
    <input class="me-ward   form-input" placeholder="Ward"  value="${escapeHtml(m.ward  || '')}">
    <select class="me-role  form-input">${roleOptions}</select>
    <input class="me-age    form-input" placeholder="Age"   value="${escapeHtml(String(m.age || ''))}">
    <select class="me-gender form-input">${genderOptions}</select>
    <input class="me-family form-input" type="number" min="1" placeholder="#" value="${escapeHtml(String(familyNum))}" title="Move to family number">
    <button class="btn-admin-remove" onclick="this.closest('.member-edit-row').remove()" aria-label="Remove member">✕</button>
  </div>`;
}

function addMemberRow() {
  const idx = parseInt(document.getElementById('family-edit-index').value, 10);
  const div = document.createElement('div');
  div.innerHTML = memberRowHtml({ name: '', phone: '', ward: '', role: '', age: '', gender: 'Adult', family: idx + 1 });
  document.getElementById('family-members-editor').appendChild(div.firstElementChild);
}

function saveFamilyModal() {
  const idx = parseInt(document.getElementById('family-edit-index').value, 10);
  const family = currentDirectoryData.families[idx];
  family.name = document.getElementById('family-edit-name').value.trim();
  family.accessEmails = Array.from(
    document.querySelectorAll('#family-access-emails-list .access-email-input')
  ).map(inp => inp.value.trim().toLowerCase()).filter(Boolean);

  const staying = [];
  const moves = [];

  Array.from(document.querySelectorAll('#family-members-editor .member-edit-row')).forEach(row => {
    const targetNum = parseInt(row.querySelector('.me-family').value, 10);
    const targetIdx = targetNum - 1;
    const member = {
      name:   row.querySelector('.me-name').value.trim(),
      phone:  row.querySelector('.me-phone').value.trim(),
      ward:   row.querySelector('.me-ward').value.trim(),
      role:   row.querySelector('.me-role').value,
      age:    row.querySelector('.me-age').value.trim(),
      gender: row.querySelector('.me-gender').value,
    };
    // Move only if the target is a valid, different family
    if (!isNaN(targetIdx) && targetIdx !== idx &&
        targetIdx >= 0 && targetIdx < currentDirectoryData.families.length) {
      member.family = targetNum;
      moves.push({ targetIdx, member });
    } else {
      member.family = idx + 1;
      staying.push(member);
    }
  });

  family.members = staying;
  moves.forEach(({ targetIdx, member }) => {
    currentDirectoryData.families[targetIdx].members.push(member);
  });

  closeModal('family-modal');
  renderDirectory(currentDirectoryData.families, true);
}

function deleteFamilyFromModal() {
  const idx = parseInt(document.getElementById('family-edit-index').value, 10);
  const name = currentDirectoryData.families[idx].name;
  if (!confirm(`Delete the entire "${name}" family? This cannot be undone until you save.`)) return;
  currentDirectoryData.families.splice(idx, 1);
  closeModal('family-modal');
  renderDirectory(currentDirectoryData.families, true);
}

// ============================================================
// Modal utility
// ============================================================

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Close modals when clicking the backdrop
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ============================================================
// Save All Changes — POST full JSON to Lambda via API Gateway
// ============================================================

async function saveAllChanges() {
  if (!googleCredentialToken) {
    alert('Your session does not have a fresh sign-in token. Please sign out and sign back in, then try saving again.');
    return;
  }
  const btn = document.getElementById('save-all-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const resp = await fetch(SAVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleCredentialToken, data: currentDirectoryData }),
    });
    const result = await resp.json();

    if (resp.ok) {
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save All Changes'; btn.disabled = false; }, 2500);
    } else if (resp.status === 403) {
      alert('Access denied. Your Google session may have expired — please sign out and back in.');
      btn.textContent = 'Save All Changes';
      btn.disabled = false;
    } else {
      alert(`Save failed: ${result.error || 'Unknown error'}`);
      btn.textContent = 'Save All Changes';
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    alert('Network error — save failed. Check your connection and try again.');
    btn.textContent = 'Save All Changes';
    btn.disabled = false;
  }
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
