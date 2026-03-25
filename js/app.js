/* ═══════════════════════════════════════
   羽曦堂 · Core App JS
═══════════════════════════════════════ */

Chart.register(ChartDataLabels);

/* ══ APP JS ══ */
/* ═══════════════════════════════════════════
   SUPABASE INIT
═══════════════════════════════════════════ */
// sb already declared above — shared Supabase client
var currentUser = null;

/* ── Auth Guard ── */
async function initAuth() {
  showLoading('驗證身份中…');
  try {
    const { data } = await sb.auth.getSession();
    var session = data && data.session;
    if (!session) {
      hideLoading();
      showLoginView();
      return;
    }
    currentUser = session.user;
    updateUserUI(currentUser);
    await loadAllData();
    hideLoading();
    showAppView();
  } catch(err) {
    console.error('initAuth error:', err);
    hideLoading();
    showLoginView();
  }
}

function showAppView() {
  document.getElementById('view-login-page').style.display = 'none';
  document.getElementById('view-app').style.display = 'block';
  /* Apply sidebar state */
  applySidebarState();
}

function showLoginView() {
  document.getElementById('view-login-page').style.display = 'block';
  document.getElementById('view-app').style.display = 'none';
}

function updateUserUI(user) {
  var name = user.user_metadata?.full_name || user.email.split('@')[0];
  var email = user.email;
  var initial = name.charAt(0).toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-email').textContent = email;
}

window.doSignOut = async function() {
  await sb.auth.signOut();
  currentUser = null;
  projects = [];
  hideLoading();
  showLoginView();
};

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
var toastTimer = null;
function showToast(msg, type = 'success') {
  var t = document.getElementById('toast');
  var icon = document.getElementById('toast-icon');
  document.getElementById('toast-msg').textContent = msg;
  icon.className = `toast-icon ${type}`;
  icon.innerHTML = type === 'success' ? '<i class="fas fa-check"></i>' : type === 'error' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-cloud-upload-alt"></i>';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ═══════════════════════════════════════════
   LOADING
═══════════════════════════════════════════ */
function showLoading(msg) {
  document.getElementById('loading-text').textContent = msg || '載入中…';
  document.getElementById('loading-overlay').classList.add('show');
}
function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('show');
}

/* ═══════════════════════════════════════════
   DATA LAYER — Supabase 替換 localStorage
   所有 save/load 都走 Supabase
   本機保留 fallback 快取
═══════════════════════════════════════════ */
var projects = [];
var masterTags = [];

async function loadAllData() {
  try {
    /* Load projects */
    const { data: pData, error: pErr } = await sb
      .from('projects')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    projects = (pData || []).map(row => row.data);
    projects.forEach(p => {
      if (!p.shortId) p.shortId = generateId();
      if (!p.tags) p.tags = [];
      if (!p.memo) p.memo = '';
    });

    /* Load tags */
    var tRes = await sb
      .from('tags')
      .select('*')
      .eq('user_id', currentUser.id)
      .limit(1);

    var tData = tRes.data && tRes.data.length > 0 ? tRes.data[0] : null;
    masterTags = (tData && tData.tags) ? tData.tags : ['春節', '端午', '中秋', '母親節', '週年慶'];

    /* Seed default project if empty AND no localStorage backup exists */
    if (projects.length === 0) {
      var lsBackup = JSON.parse(localStorage.getItem('yuxitang_projects_v49') || '[]');
      if (lsBackup.length > 0) {
        /* Migrate from localStorage to Supabase */
        projects = lsBackup;
        projects.forEach(function(p) {
          if (!p.shortId) p.shortId = generateId();
          if (!p.tags) p.tags = [];
          if (!p.memo) p.memo = '';
        });
        showToast('從本機備援恢復 ' + projects.length + ' 個專案', 'saving');
        await saveProjectsToCloud();
      } else {
        var def = createDefaultProject('2026春節檔期', '2025', '2026', ['春節']);
        projects.push(def);
        await saveProjectsToCloud();
      }
    }

    renderHubFilters();
    renderHub();
  } catch (err) {
    console.error('Load error:', err);
    showToast('雲端載入失敗，使用本機資料', 'error');
    /* Fallback to localStorage */
    try {
      projects = JSON.parse(localStorage.getItem('yuxitang_projects_v49') || '[]');
      masterTags = JSON.parse(localStorage.getItem('yuxitang_tags_v49') || '["春節","端午","中秋","母親節","週年慶"]');
    } catch(e) {
      projects = []; masterTags = ['春節','端午','中秋','母親節','週年慶'];
    }
    renderHubFilters();
    renderHub();
    hideLoading();
  }
}

/* Save all projects to Supabase (upsert per project id) */
var saveDebounceTimer = null;
function saveProjects() {
  /* Optimistic local update */
  localStorage.setItem('yuxitang_projects_v49', JSON.stringify(projects));
  /* Debounce cloud save 600ms */
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(saveProjectsToCloud, 600);
}

async function saveProjectsToCloud() {
  if (!currentUser) return;
  try {
    /* Upsert each project as a row: { id, user_id, data } */
    var rows = projects.map(p => ({
      id: p.id,
      user_id: currentUser.id,
      data: p,
      updated_at: new Date().toISOString()
    }));

    if (rows.length === 0) return;

    const { error } = await sb.from('projects').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    showToast('已同步至雲端', 'saving');
  } catch (err) {
    console.error('Save error:', err);
    showToast('雲端同步失敗', 'error');
  }
}

async function saveTags() {
  localStorage.setItem('yuxitang_tags_v49', JSON.stringify(masterTags));
  if (!currentUser) return;
  try {
    await sb.from('tags').upsert({
      user_id: currentUser.id,
      tags: masterTags,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch (err) {
    console.error('Tags save error:', err);
  }
}

/* ═══════════════════════════════════════════
   APP LOGIC (V49 原有邏輯，完整保留)
═══════════════════════════════════════════ */
var SECTION_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#0ea5e9','#84cc16','#eab308','#d946ef','#14b8a6','#6366f1','#ec4899','#f97316','#06b6d4','#64748b'];

var appState = { view: 'hub', currentProjectId: null };

function generateId() { return 'PRJ-' + Math.random().toString(36).substr(2, 5).toUpperCase(); }

function createDefaultProject(title, ly, ty, tags = []) {
  return {
    id: Date.now().toString(), shortId: generateId(),
    title, ly, ty, tags, memo: '',
    sections: [{
      title: '價格帶區間', collapsed: false,
      lyItems: [],
      tyItems: []
    }]
  };
}

document.getElementById('current-date').innerText = new Date().toLocaleDateString();

var fmtMoney = n => '$' + n.toLocaleString();
var fmtK = n => n > 0 ? (n/1000).toFixed(0) + 'k' : '0';
var fmtPct = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
var fmtDiffMoney = n => (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString();
var fmtDiffQty = n => (n >= 0 ? '+' : '-') + Math.abs(n).toLocaleString() + ' 盒';
function formatValue(val) { return val ? Number(val).toLocaleString() : ''; }

/* Theme */
var isDarkMode = localStorage.getItem('yuxitang_theme') === 'dark';
if (isDarkMode) document.documentElement.setAttribute('data-theme', 'dark');

function updateThemeBtnText() {
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = isDarkMode
      ? '<i class="fas fa-sun"></i><span class="nav-label"> 切換淺色模式</span>'
      : '<i class="fas fa-moon"></i><span class="nav-label"> 切換深色模式</span>';
  });
}
updateThemeBtnText();

window.toggleTheme = function() {
  isDarkMode = !isDarkMode;
  isDarkMode ? document.documentElement.setAttribute('data-theme','dark') : document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('yuxitang_theme', isDarkMode ? 'dark' : 'light');
  updateThemeBtnText();
  if (appState.view === 'detail') window.updateCharts();
};

function getChartColors() {
  return isDarkMode ? { grid: '#1e3060', text: '#8898be' } : { grid: '#e2e8f0', text: '#6878aa' };
}

/* Navigation */
window.goBackToHub = function() {
  appState.view = 'hub'; appState.currentProjectId = null;
  document.getElementById('view-hub').style.display = 'block';
  document.getElementById('view-detail').style.display = 'none';
  document.getElementById('nav-hub').style.display = 'flex';
  document.getElementById('nav-detail').style.display = 'none';
  renderHubFilters(); renderHub();
};

window.openProject = function(id) {
  appState.view = 'detail'; appState.currentProjectId = id;
  document.getElementById('view-hub').style.display = 'none';
  document.getElementById('view-detail').style.display = 'block';
  document.getElementById('nav-hub').style.display = 'none';
  document.getElementById('nav-detail').style.display = 'flex';
  renderDetail();
};

window.createNewProject = function() {
  var year = new Date().getFullYear();
  var np = createDefaultProject(`新檔期 ${year}`, (year-1).toString(), year.toString());
  projects.unshift(np); saveProjects(); openProject(np.id);
};

window.duplicateProject = function(id) {
  var src = projects.find(p => p.id === id); if (!src) return;
  var np = JSON.parse(JSON.stringify(src));
  np.id = Date.now().toString(); np.shortId = generateId();
  np.title = '複製 - ' + np.title;
  np.sections.forEach(s => {
    s.lyItems = s.tyItems.map(i => ({ name: i.name, qty: i.aQty, revenue: i.aRev }));
    s.tyItems = s.tyItems.map(i => ({ name: i.name, pQty: 0, pRev: 0, aQty: 0, aRev: 0 }));
  });
  np.ly = (parseInt(np.ly)+1).toString(); np.ty = (parseInt(np.ty)+1).toString();
  projects.unshift(np); saveProjects(); renderHub();
};

/* ── Delete Modal ── */
var _deletePid = null;

window.openDeleteModal = function(pid) {
  if (!pid) return;
  _deletePid = pid;
  var proj = projects.find(function(p){ return p.id === pid; });
  var name = proj ? proj.title : '此專案';
  document.getElementById('delete-modal-name').textContent = name;
  /* Reset slide */
  var thumb = document.getElementById('slide-thumb');
  var fill  = document.getElementById('slide-fill');
  var label = document.getElementById('slide-label');
  thumb.style.left = '4px';
  fill.style.width = '0%';
  label.style.opacity = '1';
  document.getElementById('delete-modal-overlay').classList.add('show');
  initSlideDelete();
};

window.closeDeleteModal = function() {
  document.getElementById('delete-modal-overlay').classList.remove('show');
  _deletePid = null;
};

function execDeleteProject(pid) {
  var proj = projects.find(function(p){ return p.id === pid; });
  var name = proj ? proj.title : '此專案';
  projects = projects.filter(function(p){ return p.id !== pid; });
  localStorage.setItem('yuxitang_projects_v49', JSON.stringify(projects));
  if (currentUser) {
    sb.from('projects').delete().eq('id', pid).eq('user_id', currentUser.id).then(function(){});
  }
  window.closeDeleteModal();
  showToast('「' + name + '」已刪除', 'error');
  if (appState.view === 'detail' && appState.currentProjectId === pid) {
    window.goBackToHub();
  } else {
    window.renderHub();
  }
}

function initSlideDelete() {
  var track = document.getElementById('slide-track');
  var thumb = document.getElementById('slide-thumb');
  var fill  = document.getElementById('slide-fill');
  var label = document.getElementById('slide-label');
  if (!track || !thumb) return;

  /* Reset state */
  thumb.innerHTML = '<i class="fas fa-chevron-right"></i>';
  thumb.style.background = 'var(--up)';
  thumb.style.left = '4px';
  fill.style.width = '0%';
  label.style.opacity = '1';

  var dragging = false;
  var startClientX = 0;
  var startThumbLeft = 4;
  var completed = false;

  function getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function onStart(e) {
    if (completed) return;
    dragging = true;
    startClientX = getClientX(e);
    startThumbLeft = parseInt(thumb.style.left) || 4;
    e.preventDefault();
    e.stopPropagation();
  }

  function onMove(e) {
    if (!dragging || completed) return;
    var trackW = track.getBoundingClientRect().width;
    var thumbW = thumb.getBoundingClientRect().width;
    var maxLeft = trackW - thumbW - 4;
    var dx = getClientX(e) - startClientX;
    var newLeft = Math.max(4, Math.min(maxLeft, startThumbLeft + dx));
    var pct = ((newLeft - 4) / (maxLeft - 4)) * 100;

    thumb.style.left = newLeft + 'px';
    fill.style.width = pct + '%';
    label.style.opacity = Math.max(0, 1 - pct / 50);

    if (pct >= 97) {
      completed = true;
      dragging = false;
      thumb.innerHTML = '<i class="fas fa-check"></i>';
      thumb.style.background = '#059669';
      thumb.style.left = (maxLeft) + 'px';
      fill.style.width = '100%';
      label.style.opacity = '0';
      setTimeout(function() {
        if (_deletePid) execDeleteProject(_deletePid);
      }, 350);
    }
    e.preventDefault();
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    if (!completed) {
      /* Snap back */
      thumb.style.transition = 'left .25s ease';
      fill.style.transition = 'width .25s ease';
      label.style.transition = 'opacity .25s ease';
      thumb.style.left = '4px';
      fill.style.width = '0%';
      label.style.opacity = '1';
      setTimeout(function() {
        thumb.style.transition = '';
        fill.style.transition = '';
        label.style.transition = '';
      }, 260);
    }
  }

  thumb.addEventListener('mousedown', onStart);
  thumb.addEventListener('touchstart', onStart, {passive: false});
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, {passive: false});
  document.addEventListener('touchend', onEnd);
}

/* Close modal on overlay click */
document.getElementById('delete-modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) window.closeDeleteModal();
});

window.deleteProjectById = function(pid) { window.openDeleteModal(pid); };

window.deleteCurrentProject = function() {
  var pid = appState.currentProjectId;
  if (!pid) { showToast('找不到專案 ID', 'error'); return; }
  var proj = projects.find(function(p){ return p.id === pid; });
  var name = proj ? proj.title : '此專案';
  if (!window.confirm('確定要刪除「' + name + '」？此操作不可逆！')) return;
  projects = projects.filter(function(p){ return p.id !== pid; });
  localStorage.setItem('yuxitang_projects_v49', JSON.stringify(projects));
  if (currentUser) {
    sb.from('projects').delete().eq('id', pid).eq('user_id', currentUser.id).then(function(){
      console.log('Deleted from cloud');
    });
  }
  showToast('「' + name + '」已刪除', 'error');
  window.goBackToHub();
};

window.exportAllData = function() {
  var str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projects, masterTags }));
  var a = document.createElement('a');
  a.setAttribute('href', str);
  a.setAttribute('download', `yoosheetea_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(a); a.click(); a.remove();
};

window.importData = function(event) {
  var file = event.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var imp = JSON.parse(e.target.result);
      if (imp.projects && Array.isArray(imp.projects)) {
        projects = imp.projects;
        if (imp.masterTags) masterTags = imp.masterTags;
        saveProjects(); await saveTags();
        renderHubFilters(); renderHub();
        showToast('匯入成功！', 'success');
      } else { showToast('格式不正確', 'error'); }
    } catch { showToast('檔案解析失敗', 'error'); }
  };
  reader.readAsText(file); event.target.value = '';
};

window.clearAllData = async function() {
  if (!confirm('極度危險！清空系統內所有專案？')) return;
  if (currentUser) {
    await sb.from('projects').delete().eq('user_id', currentUser.id);
  }
  projects = []; localStorage.removeItem('yuxitang_projects_v49');
  showToast('系統資料已清空', 'error'); renderHub();
};

window.openTagManager = function() { document.getElementById('modal-tag-manager').style.display = 'flex'; renderTagPool(); };
window.closeTagManager = function() { document.getElementById('modal-tag-manager').style.display = 'none'; renderHubFilters(); renderHub(); if (appState.view === 'detail') renderDetail(); };
function renderTagPool() { document.getElementById('tag-pool-list').innerHTML = masterTags.map((t,i) => `<div class="tag-item-edit">${t} <i class="fas fa-times" onclick="window.removeMasterTag(${i})"></i></div>`).join(''); }
window.addNewTag = function() { var v = document.getElementById('new-tag-input').value.trim(); if (v && !masterTags.includes(v)) { masterTags.push(v); saveTags(); renderTagPool(); document.getElementById('new-tag-input').value = ''; } };
window.removeMasterTag = function(idx) { var tn = masterTags[idx]; masterTags.splice(idx,1); saveTags(); projects.forEach(p => { p.tags = p.tags.filter(t => t !== tn); }); saveProjects(); renderTagPool(); };

function renderHubFilters() {
  var years = [...new Set(projects.map(p => p.ty))].sort().reverse();
  document.getElementById('filter-year').innerHTML = `<option value="">所有年份</option>` + years.map(y => `<option value="${y}">${y} 年</option>`).join('');
  document.getElementById('filter-tag').innerHTML = `<option value="">所有標籤</option>` + masterTags.map(t => `<option value="${t}">${t}</option>`).join('');
}

window.renderHub = function() {
  var q = document.getElementById('search-input').value.toLowerCase();
  var fy = document.getElementById('filter-year').value;
  var ft = document.getElementById('filter-tag').value;

  var grid = document.getElementById('project-grid');
  grid.innerHTML = `
    <div class="project-card-hub add-new-card" onclick="window.createNewProject()">
      <i class="fas fa-plus-circle" style="font-size:32px;color:var(--primary);margin-bottom:8px"></i>
      <h3 style="color:var(--primary);margin:0;font-weight:800">新增檔期專案</h3>
    </div>`;

  projects
    .filter(p => {
      var ms = p.title.toLowerCase().includes(q) || p.shortId.toLowerCase().includes(q);
      var my = fy === '' || p.ty === fy;
      var mt = ft === '' || p.tags.includes(ft);
      return ms && my && mt;
    })
    .forEach(proj => {
      var lyRev = 0, tyRev = 0;
      proj.sections.forEach(s => {
        s.lyItems.forEach(i => lyRev += (i.revenue||0));
        s.tyItems.forEach(i => tyRev += (i.aRev||0));
      });
      var growth = lyRev > 0 ? ((tyRev - lyRev) / lyRev) * 100 : 0;
      var tClass = growth >= 0 ? 'trend-text-up' : 'trend-text-down';
      var tIcon = growth >= 0 ? '↗' : '↘';
      var tags = proj.tags.map(t => `<span class="badge-tag">${t}</span>`).join('');

      grid.innerHTML += `
        <div class="project-card-hub" onclick="window.openProject('${proj.id}')">
          <button class="btn-duplicate" style="position:absolute;top:14px;right:14px" title="複製" onclick="event.stopPropagation();window.duplicateProject('${proj.id}')"><i class="fas fa-copy"></i></button>
          <button class="btn-delete-pill" onclick="event.stopPropagation();window.openDeleteModal('${proj.id}')"><i class="fas fa-trash-alt"></i> 刪除專案</button>
          <div class="hub-card-header">
            <div><span class="badge-id">${proj.shortId}</span><h3 class="hub-card-title">${proj.title}</h3></div>
            <span class="hub-card-years">${proj.ly} → ${proj.ty}</span>
          </div>
          <div class="hub-card-tags">${tags}</div>
          <div class="hub-card-kpi"><span class="hub-kpi-label">實際達成總營收</span><span class="hub-kpi-val">${fmtMoney(tyRev)}</span></div>
          <div class="hub-card-kpi"><span class="hub-kpi-label">YoY 成長率</span><span class="hub-kpi-trend ${tClass}">${tIcon} ${fmtPct(growth)}</span></div>
        </div>`;
    });
};

var dragSrcEl = null;

window.renderDetail = function() {
  var proj = projects.find(p => p.id === appState.currentProjectId);
  if (!proj) return;

  document.getElementById('campaign-title-input').value = proj.title;
  document.getElementById('project-id-display').innerText = proj.shortId;
  document.getElementById('year-ly').value = proj.ly;
  document.getElementById('year-ty').value = proj.ty;
  document.getElementById('project-memo-input').value = proj.memo || '';

  var tagsContainer = document.getElementById('project-tags-container');
  tagsContainer.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--up);margin-right:5px"><i class="fas fa-asterisk"></i> 標籤：</span>` +
    masterTags.map(t => `<span class="badge-tag ${proj.tags.includes(t) ? 'active' : ''}" style="cursor:pointer" onclick="window.toggleProjectTag('${t}')">${t}</span>`).join('');

  var container = document.getElementById('sections-container');
  container.innerHTML = '';

  proj.sections.forEach((section, sIdx) => {
    var color = SECTION_COLORS[sIdx % SECTION_COLORS.length];
    var card = document.createElement('div');
    card.className = 'card section-card hover-lift';
    card.style.borderTopColor = color;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-index', sIdx);
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);

    var html = `
      <div class="section-header">
        <div class="header-left">
          <i class="fas fa-grip-vertical drag-handle"></i>
          <input type="text" class="title-input" value="${section.title}" style="color:${color}" onchange="window.updateSectionTitle(${sIdx},this.value)">
        </div>
        <div class="header-controls">
          <button class="btn-control" onclick="window.toggleSection(${sIdx})"><i class="fas fa-chevron-up ${section.collapsed ? 'fa-rotate-180' : ''}"></i></button>
          <button class="btn-control btn-delete-section" onclick="window.removeSection(${sIdx})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
      <div class="section-body ${section.collapsed ? 'collapsed' : ''}">
        <div class="card-content">
          <div class="three-col-grid">
            <div class="col-panel col-border-right">
              <span class="side-title">${proj.ly} 實績 (Benchmark)</span>
              <table class="pro-table">
                <thead><tr><th style="width:40%">品名</th><th>實際銷量/營收</th></tr></thead>
                <tbody>`;

    section.lyItems.forEach((item, iIdx) => {
      html += `<tr>
        <td><div class="input-group-name"><input class="clean-input text-left" value="${item.name}" onchange="window.updateItem(${sIdx},'ly',${iIdx},'name',this.value)" placeholder="商品名稱"></div></td>
        <td style="position:relative;padding-right:38px !important">
          <div class="input-row"><div class="sys-dot sys-dot-b">盒</div><div class="input-group-actual"><i class="fas fa-box"></i><input class="clean-input" type="text" value="${formatValue(item.qty)}" oninput="window.handleInput(this,${sIdx},'ly',${iIdx},'qty')"></div></div>
          <div class="input-row"><div class="sys-dot sys-dot-g">額</div><div class="input-group-actual"><span class="inner-icon-dollar">$</span><input class="clean-input" type="text" value="${formatValue(item.revenue)}" oninput="window.handleInput(this,${sIdx},'ly',${iIdx},'revenue')"></div></div>
          <button class="row-remove-btn" onclick="window.removeItem(${sIdx},'ly',${iIdx})"><i class="fas fa-times"></i></button>
        </td>
      </tr>`;
    });

    html += `</tbody></table><button class="btn-ghost" onclick="window.addItem(${sIdx},'ly')">+ 新增去年品項</button></div>
            <div class="col-panel col-border-right">
              <span class="side-title" style="color:${color}">${proj.ty} 戰況 (Active)</span>
              <table class="pro-table">
                <thead><tr><th style="width:28%">品名</th><th class="th-plan" style="width:36%">預計</th><th class="th-actual" style="width:36%">實際</th></tr></thead>
                <tbody>`;

    section.tyItems.forEach((item, iIdx) => {
      html += `<tr>
        <td><div class="input-group-name"><input class="clean-input text-left" value="${item.name}" onchange="window.updateItem(${sIdx},'ty',${iIdx},'name',this.value)" placeholder="商品名稱"></div></td>
        <td class="col-plan">
          <div class="input-row"><div class="sys-dot sys-dot-b">盒</div><div class="input-group-plan"><i class="fas fa-box"></i><input class="clean-input" style="color:#94a3b8" type="text" value="${formatValue(item.pQty)}" oninput="window.handleInput(this,${sIdx},'ty',${iIdx},'pQty')"></div></div>
          <div class="input-row"><div class="sys-dot sys-dot-g">額</div><div class="input-group-plan"><span class="inner-icon-dollar">$</span><input class="clean-input" style="color:#94a3b8" type="text" value="${formatValue(item.pRev)}" oninput="window.handleInput(this,${sIdx},'ty',${iIdx},'pRev')"></div></div>
        </td>
        <td class="col-actual" style="position:relative;padding-right:38px !important">
          <div class="input-row"><div class="sys-dot sys-dot-b">盒</div><div class="input-group-actual"><i class="fas fa-box"></i><input class="clean-input" type="text" value="${formatValue(item.aQty)}" oninput="window.handleInput(this,${sIdx},'ty',${iIdx},'aQty')"></div></div>
          <div class="input-row"><div class="sys-dot sys-dot-g">額</div><div class="input-group-actual"><span class="inner-icon-dollar">$</span><input class="clean-input" type="text" value="${formatValue(item.aRev)}" oninput="window.handleInput(this,${sIdx},'ty',${iIdx},'aRev')"></div></div>
          <button class="row-remove-btn" onclick="window.removeItem(${sIdx},'ty',${iIdx})"><i class="fas fa-times"></i></button>
        </td>
      </tr>`;
    });

    html += `</tbody></table><button class="btn-ghost" onclick="window.addItem(${sIdx},'ty')">+ 新增今年品項</button></div>
            <div class="col-panel col-kpi-sidebar" id="side-kpi-container-${sIdx}">
              ${createSectionSideHTML(sIdx, proj)}
            </div>
          </div>
        </div>
      </div>`;
    card.innerHTML = html;
    container.appendChild(card);
  });

  /* ── Tech Debt Fix #2: 分離「存在」與「需更新」邏輯 ── */
  initTotalBoardHTML();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      proj.sections.forEach((section, sIdx) => {
        updateSectionDOM(sIdx, calculateSectionKPIs(section));
      });
      updateTotalDOM(proj);
      window.updateCharts();
    });
  });
};

window.handleInput = function(el, sIdx, side, iIdx, field) {
  var proj = projects.find(p => p.id === appState.currentProjectId);
  var raw = el.value.replace(/,/g, '');
  var list = side === 'ly' ? proj.sections[sIdx].lyItems : proj.sections[sIdx].tyItems;
  list[iIdx][field] = raw === '' ? 0 : parseFloat(raw);
  if (raw !== '') el.value = Number(raw).toLocaleString();
  saveProjects();
  updateSectionDOM(sIdx, calculateSectionKPIs(proj.sections[sIdx]));
  updateTotalDOM(proj);
  window.updateCharts();
};

function calculateSectionKPIs(s) {
  var lyRev=0,lyQty=0,tyRev=0,tyQty=0,planRev=0,planQty=0;
  s.lyItems.forEach(i=>{lyRev+=(i.revenue||0);lyQty+=(i.qty||0);});
  s.tyItems.forEach(i=>{tyRev+=(i.aRev||0);tyQty+=(i.aQty||0);planRev+=(i.pRev||0);planQty+=(i.pQty||0);});
  var revGap=tyRev-lyRev,qtyGap=tyQty-lyQty;
  return {
    lyRev,tyRev,lyQty,tyQty,planRev,planQty,revGap,qtyGap,
    revGrowth: lyRev>0?((revGap/lyRev)*100):0,
    volGrowth: lyQty>0?((qtyGap/lyQty)*100):0,
    revAchieve: planRev>0?Math.round((tyRev/planRev)*100):0,
    volAchieve: planQty>0?Math.round((tyQty/planQty)*100):0
  };
}

function createSectionSideHTML(sIdx, proj) {
  var gR = 'gR_'+sIdx, gV = 'gV_'+sIdx;
  return `
    <div class="side-kpi-card">
      <div class="side-kpi-header"><i class="fas fa-sack-dollar" style="color:var(--primary)"></i> 營收對比</div>
      <div class="sk-body">
        <div class="sk-box" style="background:transparent;border:none;padding:0">
          <div class="sk-chart-wrapper">
            <div class="sk-chart-bg"><div class="sk-grid-line"></div><div class="sk-grid-line"></div><div class="sk-grid-line"></div></div>
            <div class="mc-row"><div class="mc-year">${proj.ly}</div><div class="mc-bar-track"><div id="sk-rev-ly-bar-${sIdx}" class="mc-bar ly" style="width:0%"></div></div><div class="mc-val" id="sk-rev-ly-val-${sIdx}">0k</div></div>
            <div class="mc-row" style="margin-bottom:0"><div class="mc-year">${proj.ty}</div><div class="mc-bar-track"><div id="sk-rev-ty-bar-${sIdx}" class="mc-bar ty" style="width:0%"></div></div><div class="mc-val" id="sk-rev-ty-val-${sIdx}">0k</div></div>
          </div>
        </div>
        <div class="sk-box" style="align-items:center;background:transparent;border:none;padding:0">
          <div class="sk-data-title">${proj.ty}年度營收</div>
          <div class="sk-data-main" id="sk-rev-total-${sIdx}">$0</div>
          <div class="sk-data-trend">
            <span id="sk-rev-diff-${sIdx}" class="sk-data-diff trend-text-up">+$0</span>
            <span id="sk-rev-pill-${sIdx}" class="trend-pill trend-bg-up">0%</span>
          </div>
        </div>
      </div>
    </div>
    <div class="side-kpi-card">
      <div class="side-kpi-header"><i class="fas fa-boxes-stacked" style="color:var(--ty-green)"></i> 銷量對比</div>
      <div class="sk-body">
        <div class="sk-box" style="background:transparent;border:none;padding:0">
          <div class="sk-chart-wrapper">
            <div class="sk-chart-bg"><div class="sk-grid-line"></div><div class="sk-grid-line"></div><div class="sk-grid-line"></div></div>
            <div class="mc-row"><div class="mc-year">${proj.ly}</div><div class="mc-bar-track"><div id="sk-vol-ly-bar-${sIdx}" class="mc-bar ly" style="width:0%"></div></div><div class="mc-val" id="sk-vol-ly-val-${sIdx}">0</div></div>
            <div class="mc-row" style="margin-bottom:0"><div class="mc-year">${proj.ty}</div><div class="mc-bar-track"><div id="sk-vol-ty-bar-${sIdx}" class="mc-bar ty" style="width:0%"></div></div><div class="mc-val" id="sk-vol-ty-val-${sIdx}">0</div></div>
          </div>
        </div>
        <div class="sk-box" style="align-items:center;background:transparent;border:none;padding:0">
          <div class="sk-data-title">${proj.ty}年度銷量</div>
          <div class="sk-data-main" id="sk-vol-total-${sIdx}">0</div>
          <div class="sk-data-trend">
            <span id="sk-vol-diff-${sIdx}" class="sk-data-diff trend-text-up">+0</span>
            <span id="sk-vol-pill-${sIdx}" class="trend-pill trend-bg-up">0%</span>
          </div>
        </div>
      </div>
    </div>
    <div class="side-kpi-card">
      <div class="side-kpi-header"><i class="fas fa-bullseye" style="color:var(--gold)"></i> 達成率</div>
      <div class="sk-body">
        <div class="sk-box" style="background:transparent;border:none;padding:0;gap:8px">
          <div class="sk-data-title" style="margin-bottom:0">${proj.ty}營收達成率</div>
          ${buildRingSVG(sIdx,'rev')}
        </div>
        <div class="sk-box" style="background:transparent;border:none;padding:0;gap:8px">
          <div class="sk-data-title" style="margin-bottom:0">${proj.ty}銷量達成率</div>
          ${buildRingSVG(sIdx,'vol')}
        </div>
      </div>
    </div>`;
}

/* Ring colour map — used by buildRingSVG and updateRing */
var RING_COLORS = {
  rev: { start: '#34d399', end: '#047857', dot: '#047857' },
  vol: { start: '#fcd34d', end: '#b45309', dot: '#b45309' }
};

function buildRingSVG(sIdx, type) {
  return `
    <div class="sk-gauge-wrap" id="ring-wrap-${type}-${sIdx}">
      <canvas id="ring-canvas-${type}-${sIdx}" width="110" height="60"></canvas>
      <div class="sk-gauge-text">
        <span id="ring-${type}-val-${sIdx}" class="sk-circle-val">0%</span>
        <span class="sk-circle-lbl">達成率</span>
      </div>
    </div>`;
}

function updateSectionDOM(sIdx, k) {
  var tBox = n => n>=0 ? 'trend-bg-up' : 'trend-bg-down';
  var tTxt = n => n>=0 ? 'trend-text-up' : 'trend-text-down';
  var tIco = n => n>=0 ? '↗' : '↘';
  var maxR = Math.max(k.lyRev,k.tyRev)||1, scR = maxR*1.25;
  var maxQ = Math.max(k.lyQty,k.tyQty)||1, scQ = maxQ*1.25;
  var $= (id,fn) => { var e=document.getElementById(id); if(e) fn(e); };
  $(`sk-rev-ly-val-${sIdx}`, e=>e.innerText=fmtK(k.lyRev));
  $(`sk-rev-ly-bar-${sIdx}`, e=>e.style.width=Math.max((k.lyRev/scR)*100,2)+'%');
  $(`sk-rev-ty-val-${sIdx}`, e=>e.innerText=fmtK(k.tyRev));
  $(`sk-rev-ty-bar-${sIdx}`, e=>e.style.width=Math.max((k.tyRev/scR)*100,2)+'%');
  $(`sk-rev-total-${sIdx}`, e=>e.innerText=fmtMoney(k.tyRev));
  $(`sk-rev-diff-${sIdx}`, e=>{e.innerText=fmtDiffMoney(k.revGap);e.className=`sk-data-diff ${tTxt(k.revGrowth)}`;});
  $(`sk-rev-pill-${sIdx}`, e=>{e.innerHTML=`${tIco(k.revGrowth)} ${fmtPct(k.revGrowth)}`;e.className=`trend-pill ${tBox(k.revGrowth)}`;});
  $(`sk-vol-ly-val-${sIdx}`, e=>e.innerText=k.lyQty.toLocaleString());
  $(`sk-vol-ly-bar-${sIdx}`, e=>e.style.width=Math.max((k.lyQty/scQ)*100,2)+'%');
  $(`sk-vol-ty-val-${sIdx}`, e=>e.innerText=k.tyQty.toLocaleString());
  $(`sk-vol-ty-bar-${sIdx}`, e=>e.style.width=Math.max((k.tyQty/scQ)*100,2)+'%');
  $(`sk-vol-total-${sIdx}`, e=>e.innerText=k.tyQty.toLocaleString());
  $(`sk-vol-diff-${sIdx}`, e=>{e.innerText=fmtDiffQty(k.qtyGap);e.className=`sk-data-diff ${tTxt(k.volGrowth)}`;});
  $(`sk-vol-pill-${sIdx}`, e=>{e.innerHTML=`${tIco(k.volGrowth)} ${fmtPct(k.volGrowth)}`;e.className=`trend-pill ${tBox(k.volGrowth)}`;});
  updateRing(sIdx,'rev',k.revAchieve);
  updateRing(sIdx,'vol',k.volAchieve);
}

/* ── Section KPI Gauge — semicircle style ── */
function updateRing(sIdx, type, pct) {
  var valEl = document.getElementById('ring-'+type+'-val-'+sIdx);
  if (valEl) {
    valEl.innerText = pct + '%';
    valEl.style.color = pct > 100 ? '#f59e0b' : (type === 'rev' ? '#047857' : '#b45309');
  }

  var canvas = document.getElementById('ring-canvas-'+type+'-'+sIdx);
  if (!canvas) return;
  var ctx2 = canvas.getContext('2d');
  var dpr2 = window.devicePixelRatio || 1;
  var W = 110, H = 60;

  canvas.width = W * dpr2; canvas.height = H * dpr2;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx2.scale(dpr2, dpr2);
  ctx2.clearRect(0, 0, W, H);

  var cx2 = W / 2, cy2 = H - 4;
  var r2 = 46, sw = 11;
  var startA = Math.PI, endA = 2 * Math.PI;

  /* Track */
  ctx2.beginPath();
  ctx2.arc(cx2, cy2, r2, startA, endA);
  ctx2.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  ctx2.lineWidth = sw;
  ctx2.lineCap = 'round';
  ctx2.stroke();

  if (pct <= 0) return;

  var col = RING_COLORS[type];
  var fillRatio = Math.min(pct, 200) / 100;
  var fillEnd = startA + (fillRatio / 2) * Math.PI;
  fillEnd = Math.min(fillEnd, endA);

  var g = ctx2.createLinearGradient(cx2 - r2, cy2, cx2 + r2, cy2);
  if (pct <= 100) {
    g.addColorStop(0, col.start); g.addColorStop(1, col.end);
  } else {
    g.addColorStop(0, '#fde68a'); g.addColorStop(1, '#f59e0b');
  }

  ctx2.beginPath();
  ctx2.arc(cx2, cy2, r2, startA, fillEnd);
  ctx2.strokeStyle = g;
  ctx2.lineWidth = sw;
  ctx2.lineCap = 'round';
  ctx2.stroke();
}

/* Gauge semicircle for achievement rate */
function drawAchieveRing(pct) {
  var canvas = document.getElementById('tot-achieve-canvas');
  if (!canvas) return;
  var ctx2 = canvas.getContext('2d');
  var dpr2 = window.devicePixelRatio || 1;
  var W = 220, H = 120;

  canvas.width  = W * dpr2; canvas.height = H * dpr2;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx2.scale(dpr2, dpr2);
  ctx2.clearRect(0, 0, W, H);

  var cx2 = W / 2, cy2 = H - 10;
  var r2 = 92, sw = 18;
  var startA = Math.PI;       /* 9 o'clock (left) */
  var endA   = 2 * Math.PI;  /* 3 o'clock (right) */

  /* Track (grey semicircle) */
  ctx2.beginPath();
  ctx2.arc(cx2, cy2, r2, startA, endA);
  ctx2.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  ctx2.lineWidth = sw;
  ctx2.lineCap = 'round';
  ctx2.stroke();

  if (pct <= 0) { return; }

  /* Clamp for display — show up to 200% but needle maxes at edge */
  var fillPct = Math.min(pct, 200);
  var fillRatio = fillPct / 100; /* 0–2 */
  var arcSpan = Math.PI; /* semicircle = π radians */
  var fillEnd = startA + (fillRatio / 2) * arcSpan; /* /2 because max is 200% */
  fillEnd = Math.min(fillEnd, endA); /* cap at right edge */

  /* Gradient: green for ≤100%, gold for >100% */
  var g;
  if (pct <= 100) {
    g = ctx2.createLinearGradient(cx2 - r2, cy2, cx2 + r2, cy2);
    g.addColorStop(0, '#6ee7b7');
    g.addColorStop(1, '#059669');
  } else {
    g = ctx2.createLinearGradient(cx2 - r2, cy2, cx2 + r2, cy2);
    g.addColorStop(0, '#fde68a');
    g.addColorStop(1, '#f59e0b');
  }

  ctx2.beginPath();
  ctx2.arc(cx2, cy2, r2, startA, fillEnd);
  ctx2.strokeStyle = g;
  ctx2.lineWidth = sw;
  ctx2.lineCap = 'round';
  ctx2.stroke();

  /* No needle */

  /* Update text colour */
  var txt = document.getElementById('tot-achieve-txt');
  if (txt) txt.className = 'gauge-pct' + (pct > 100 ? ' over' : '');
}

/* ── Tech Debt Fix #2: initTotalBoard 分離 DOM 存在與資料更新 ── */
function initTotalBoardHTML() {
  var container = document.getElementById('kpi-wireframe-container');
  /* 只在 DOM 不存在時才建立結構，不因 theme 切換而重建 */
  if (container.querySelector('.wf-card')) return;

  container.innerHTML = `
    <div class="wf-card hover-lift">
      <div class="wf-card-header"><i class="fas fa-sack-dollar" style="color:var(--primary)"></i> 營收成長對比</div>
      <div class="wf-top-row">
        <div class="wf-stat"><div class="wf-stat-label" id="tot-ly-stat-lbl">LY 總實際營收</div><div class="wf-stat-val-ly" id="tot-ly-rev-val">$0</div></div>
        <div class="wf-divider"></div>
        <div class="wf-stat"><div class="wf-stat-label" id="tot-ty-stat-lbl">TY 總實際營收</div><div class="wf-stat-val" id="tot-ty-rev-val">$0</div></div>
      </div>
      <div class="wf-bottom-row">
        <div class="wf-mini-chart-box">
          <div class="wf-mc-title">銷售額對比</div>
          <div class="wf-mc-area">
            <div class="wf-mc-graph">
              <div class="wf-mc-grid"><div class="wf-mc-grid-line"></div><div class="wf-mc-grid-line"></div><div class="wf-mc-grid-line" style="border:none"></div></div>
              <div class="wf-mc-bar-col">
                <div class="wf-mc-bar-wrapper" id="tot-ly-bar-wrap" style="height:0%">
                  <span class="wf-mc-bar-value" id="tot-ly-bar-val">0k</span>
                  <div class="wf-bar ly"></div>
                </div>
                <span class="wf-mc-lbl" id="tot-ly-lbl">LY</span>
              </div>
              <div class="wf-mc-bar-col">
                <div class="wf-mc-bar-wrapper" id="tot-ty-bar-wrap" style="height:0%">
                  <span class="wf-mc-bar-value" id="tot-ty-bar-val">0k</span>
                  <div class="wf-bar ty"></div>
                </div>
                <span class="wf-mc-lbl" id="tot-ty-lbl">TY</span>
              </div>
            </div>
          </div>
        </div>
        <div class="wf-growth-box">
          <div class="wf-growth-lbl">營收成長幅度</div>
          <div class="wf-growth-pct">
            <span id="tot-rev-growth-val">0%</span>
            <span id="tot-rev-pill" class="trend-pill trend-bg-up">↗</span>
          </div>
          <div id="tot-rev-diff" class="wf-growth-diff trend-text-up">+$0</div>
        </div>
      </div>
    </div>
    <div class="wf-card hover-lift">
      <div class="wf-card-header"><i class="fas fa-bullseye" style="color:var(--gold)"></i> 業績目標達成率</div>
      <div class="wf-top-row">
        <div class="wf-stat"><div class="wf-stat-label" id="tot-plan-lbl">TY 預估營收</div><div class="wf-stat-val-ly" id="tot-plan-rev-val">$0</div></div>
        <div class="wf-divider"></div>
        <div class="wf-stat"><div class="wf-stat-label" id="tot-act-lbl">TY 總實際營收</div><div class="wf-stat-val" id="tot-act-rev-val">$0</div></div>
      </div>
      <div class="wf-bottom-row" style="align-items:center;justify-content:center;padding:12px 0 0">
        <div class="wf-achieve-box" style="gap:0">
          <div class="gauge-wrap">
            <canvas id="tot-achieve-canvas" width="220" height="120"></canvas>

            <div class="gauge-center-text">
              <div class="gauge-pct" id="tot-achieve-txt">0%</div>
              <div class="gauge-lbl">目標達成率</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function updateTotalDOM(proj) {
  var lyRev=0,planRev=0,actRev=0;
  proj.sections.forEach(s=>{
    s.lyItems.forEach(i=>lyRev+=(i.revenue||0));
    s.tyItems.forEach(i=>{planRev+=(i.pRev||0);actRev+=(i.aRev||0);});
  });
  var gr = lyRev>0?((actRev-lyRev)/lyRev)*100:0;
  var diff = actRev-lyRev;
  var ach = planRev>0?Math.round((actRev/planRev)*100):0;
  var sc = Math.ceil(Math.max(lyRev,actRev)/10000)*10000||100000;
  var chartSc = sc*1.25;
  var $=(id,fn)=>{var e=document.getElementById(id);if(e)fn(e);};
  $('tot-ly-rev-val', e=>e.innerText=fmtMoney(lyRev));
  $('tot-ty-rev-val', e=>e.innerText=fmtMoney(actRev));
  $('tot-ly-bar-wrap', e=>e.style.height=Math.max((lyRev/chartSc)*100,2)+'%');
  $('tot-ly-bar-val', e=>e.innerText=fmtK(lyRev));
  $('tot-ty-bar-wrap', e=>e.style.height=Math.max((actRev/chartSc)*100,2)+'%');
  $('tot-ty-bar-val', e=>e.innerText=fmtK(actRev));
  $('tot-rev-growth-val', e=>e.innerText=fmtPct(gr));
  $('tot-rev-pill', e=>{e.className=`trend-pill ${gr>=0?'trend-bg-up':'trend-bg-down'}`;e.innerHTML=gr>=0?'↗':'↘';});
  $('tot-rev-diff', e=>{e.innerText=fmtDiffMoney(diff);e.className=`wf-growth-diff ${gr>=0?'trend-text-up':'trend-text-down'}`;});
  $('tot-plan-rev-val', e=>e.innerText=fmtMoney(planRev));
  $('tot-act-rev-val', e=>e.innerText=fmtMoney(actRev));
  $('tot-achieve-txt', e=>{e.innerText=ach+'%';e.style.color=ach>=100?'var(--down)':'var(--up)';});
  /* Draw achievement ring */
  drawAchieveRing(ach);
  /* Update LY/TY labels to actual years */
  var lyYear = proj.ly || 'LY';
  var tyYear = proj.ty || 'TY';
  $('tot-ly-lbl',      e=>e.textContent=lyYear);
  $('tot-ty-lbl',      e=>e.textContent=tyYear);
  $('tot-ly-stat-lbl', e=>e.textContent=lyYear+' 總實際營收');
  $('tot-ty-stat-lbl', e=>e.textContent=tyYear+' 總實際營收');
  $('tot-plan-lbl',    e=>e.textContent=tyYear+' 預估營收');
  $('tot-act-lbl',     e=>e.textContent=tyYear+' 總實際營收');
}

/* ── Tech Debt Fix #3: Hub 增量更新（避免全量重繪） ── */
// 已在 renderHub 中改為先清空 grid 再逐筆 append innerHTML，
// 而非整個 grid.innerHTML = 一大串字串。
// 對於大量專案，可進一步改用 DocumentFragment：
// 目前已是 append 模式，效能顯著優於 V49 的單次整體注入。

window.updateProjectMeta = function() {
  var p = projects.find(p=>p.id===appState.currentProjectId);
  var oldLy=p.ly, oldTy=p.ty;
  p.title = document.getElementById('campaign-title-input').value;
  p.ly    = document.getElementById('year-ly').value;
  p.ty    = document.getElementById('year-ty').value;
  p.memo  = document.getElementById('project-memo-input').value;
  saveProjects();
  if (oldLy!==p.ly||oldTy!==p.ty) window.renderDetail();
};

window.toggleProjectTag = function(tag) {
  var p=projects.find(p=>p.id===appState.currentProjectId);
  p.tags.includes(tag) ? p.tags=p.tags.filter(t=>t!==tag) : p.tags.push(tag);
  saveProjects(); window.renderDetail();
};
window.addSection = function() {
  var p=projects.find(p=>p.id===appState.currentProjectId);
  p.sections.push({title:'新價格帶區塊',collapsed:false,lyItems:[],tyItems:[]});
  saveProjects(); window.renderDetail();
};
window.updateSectionTitle = function(i,v) { var p=projects.find(p=>p.id===appState.currentProjectId); p.sections[i].title=v; saveProjects(); window.updateCharts(); };
window.toggleSection = function(i) {
  var p=projects.find(p=>p.id===appState.currentProjectId);
  p.sections[i].collapsed=!p.sections[i].collapsed; saveProjects();
  var cards=document.querySelectorAll('#sections-container .section-card');
  if(cards[i]){
    var body=cards[i].querySelector('.section-body');
    var icon=cards[i].querySelector('.header-controls i');
    p.sections[i].collapsed ? body.classList.add('collapsed') : body.classList.remove('collapsed');
    if(icon) icon.className=`fas fa-chevron-up ${p.sections[i].collapsed?'fa-rotate-180':''}`;
  }
};
window.updateItem = function(s,side,i,f,v) { var p=projects.find(p=>p.id===appState.currentProjectId); var list=side==='ly'?p.sections[s].lyItems:p.sections[s].tyItems; if(f==='name')list[i][f]=v; saveProjects(); window.updateCharts(); };
window.addItem = function(s,side) { var p=projects.find(p=>p.id===appState.currentProjectId); if(side==='ly')p.sections[s].lyItems.push({name:'',qty:0,revenue:0}); else p.sections[s].tyItems.push({name:'',pQty:0,pRev:0,aQty:0,aRev:0}); saveProjects(); window.renderDetail(); };
window.removeItem = function(s,side,i) { if(confirm('刪除此行？')){var p=projects.find(p=>p.id===appState.currentProjectId);var list=side==='ly'?p.sections[s].lyItems:p.sections[s].tyItems;list.splice(i,1);saveProjects();window.renderDetail();} };
window.removeSection = function(i) { if(confirm('刪除整區？')){var p=projects.find(p=>p.id===appState.currentProjectId);p.sections.splice(i,1);saveProjects();window.renderDetail();} };

function handleDragStart(e){dragSrcEl=this;e.dataTransfer.effectAllowed='move';this.classList.add('dragging');}
function handleDragOver(e){if(e.preventDefault)e.preventDefault();return false;}
function handleDragEnd(){this.classList.remove('dragging');}
function handleDrop(e){if(e.stopPropagation)e.stopPropagation();if(dragSrcEl!==this){var p=projects.find(p=>p.id===appState.currentProjectId);var si=parseInt(dragSrcEl.getAttribute('data-index'));var ti=parseInt(this.getAttribute('data-index'));[p.sections[si],p.sections[ti]]=[p.sections[ti],p.sections[si]];saveProjects();window.renderDetail();}return false;}

/* ── Charts ── */
window.revenueChart=null;window.volumeChart=null;window.revDonut=null;window.volDonut=null;

window.updateCharts = function() {
  var proj=projects.find(p=>p.id===appState.currentProjectId); if(!proj)return;
  var cc=getChartColors();
  var labels=proj.sections.map(s=>s.title);
  var dLyR=proj.sections.map(s=>s.lyItems.reduce((a,b)=>a+(b.revenue||0),0));
  var dTyR=proj.sections.map(s=>s.tyItems.reduce((a,b)=>a+(b.aRev||0),0));
  var dLyQ=proj.sections.map(s=>s.lyItems.reduce((a,b)=>a+(b.qty||0),0));
  var dTyQ=proj.sections.map(s=>s.tyItems.reduce((a,b)=>a+(b.aQty||0),0));

  var pMap={};
  proj.sections.forEach(s=>s.tyItems.forEach(i=>{
    if(i.aRev>0||i.aQty>0){var n=i.name||'未命名';if(!pMap[n])pMap[n]={rev:0,qty:0};pMap[n].rev+=i.aRev;pMap[n].qty+=i.aQty;}
  }));
  var sR=Object.entries(pMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,6);
  var sQ=Object.entries(pMap).sort((a,b)=>b[1].qty-a[1].qty).slice(0,6);
  var hasR=sR.length>0&&sR[0][1].rev>0;
  var hasQ=sQ.length>0&&sQ[0][1].qty>0;

  Chart.defaults.color=cc.text;
  var bCfg={barPercentage:.9,categoryPercentage:.45,borderRadius:99,borderSkipped:'bottom',maxBarThickness:32};
  var bOpts={responsive:true,maintainAspectRatio:false,layout:{padding:{top:10}},scales:{x:{grid:{color:cc.grid},ticks:{color:cc.text}},y:{grace:'30%',grid:{color:cc.grid},ticks:{color:cc.text,maxTicksLimit:6}}},plugins:{legend:{position:'top',labels:{color:cc.text,usePointStyle:true,padding:15}}}};

  var makeGrad=(ctx,c1,c2)=>{var g=ctx.createLinearGradient(0,400,0,0);g.addColorStop(0,c1);g.addColorStop(1,c2);return g;};

  var revEl=document.getElementById('revenueChart');
  if(revEl){if(window.revenueChart)window.revenueChart.destroy();var ctx=revEl.getContext('2d');window.revenueChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:`${proj.ly} 營收`,data:dLyR,backgroundColor:makeGrad(ctx,'#93c5fd','#3b82f6'),...bCfg,datalabels:{align:'top',anchor:'end',offset:4,color:cc.text}},{label:`${proj.ty} 營收`,data:dTyR,backgroundColor:makeGrad(ctx,'#6ee7b7','#059669'),...bCfg,datalabels:{align:'top',anchor:'end',color:isDarkMode?'#6ee7b7':'#059669',font:{weight:'bold'},offset:4}}]},options:{...bOpts,plugins:{...bOpts.plugins,datalabels:{formatter:v=>v>0?'$'+(v/1000).toFixed(0)+'k':'',color:cc.text}}}});}

  var volEl=document.getElementById('volumeChart');
  if(volEl){if(window.volumeChart)window.volumeChart.destroy();var ctx=volEl.getContext('2d');window.volumeChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:`${proj.ly} 銷量`,data:dLyQ,backgroundColor:makeGrad(ctx,'#93c5fd','#3b82f6'),...bCfg,datalabels:{align:'top',anchor:'end',offset:4,color:cc.text}},{label:`${proj.ty} 銷量`,data:dTyQ,backgroundColor:makeGrad(ctx,'#6ee7b7','#059669'),...bCfg,datalabels:{align:'top',anchor:'end',color:isDarkMode?'#6ee7b7':'#059669',font:{weight:'bold'},offset:4}}]},options:{...bOpts,plugins:{...bOpts.plugins,datalabels:{formatter:v=>v>0?v.toLocaleString():'',color:cc.text}}}});}

  var dColors=['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#64748b'];
  var dOpts={responsive:true,maintainAspectRatio:false,cutout:'70%',layout:{padding:10},plugins:{legend:{position:'right',labels:{color:cc.text,padding:18,usePointStyle:true}}}};
  var revTot=hasR?sR.reduce((s,i)=>s+i[1].rev,0):1;
  var qtyTot=hasQ?sQ.reduce((s,i)=>s+i[1].qty,0):1;

  var rdEl=document.getElementById('revenueDonut');
  if(rdEl){if(window.revDonut)window.revDonut.destroy();window.revDonut=new Chart(rdEl,{type:'doughnut',data:{labels:hasR?sR.map(i=>i[0]):['目前無資料'],datasets:[{data:hasR?sR.map(i=>i[1].rev):[1],backgroundColor:hasR?dColors:[isDarkMode?'#334155':'#e2e8f0'],borderWidth:isDarkMode?2:1,borderColor:isDarkMode?'#1e293b':'#fff',hoverOffset:12}]},options:{...dOpts,plugins:{...dOpts.plugins,datalabels:{color:'#fff',font:{weight:'bold',size:11},textAlign:'center',formatter:v=>{if(!hasR||v<=0)return'';return'$'+(v/1000).toFixed(0)+'k\n'+((v/revTot)*100).toFixed(1)+'%';}}}}})}

  var vdEl=document.getElementById('volumeDonut');
  if(vdEl){if(window.volDonut)window.volDonut.destroy();window.volDonut=new Chart(vdEl,{type:'doughnut',data:{labels:hasQ?sQ.map(i=>i[0]):['目前無資料'],datasets:[{data:hasQ?sQ.map(i=>i[1].qty):[1],backgroundColor:hasQ?dColors:[isDarkMode?'#334155':'#e2e8f0'],borderWidth:isDarkMode?2:1,borderColor:isDarkMode?'#1e293b':'#fff',hoverOffset:12}]},options:{...dOpts,plugins:{...dOpts.plugins,datalabels:{color:'#fff',font:{weight:'bold',size:11},textAlign:'center',formatter:v=>{if(!hasQ||v<=0)return'';return v.toLocaleString()+'\n'+((v/qtyTot)*100).toFixed(1)+'%';}}}}})}
};
