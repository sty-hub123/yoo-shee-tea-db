/* ═══════════════════════════════════════
   羽曦堂 · SKU 主數據庫 Module
═══════════════════════════════════════ */

/* ═══════════════════════════════════════════
   SKU 主數據庫 — Sprint 1 JS
═══════════════════════════════════════════ */
var skus = [];
var skuEditId = null; // null = new, uuid = edit mode
var skuActiveCat = ''; // category filter

/* Navigation */
window.goToSKU = function() {
  document.getElementById('view-hub').style.display = 'none';
  document.getElementById('view-detail').style.display = 'none';
  document.getElementById('nav-hub').style.display = 'flex';
  document.getElementById('nav-detail').style.display = 'none';
  document.getElementById('view-sku').style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.getElementById('nav-sku-btn');
  if (btn) btn.classList.add('active');
  appState.view = 'sku';
  applySidebarState();
  loadSKUs();
};

/* Override goBackToHub to also hide sku view */
var _origGoBack = window.goBackToHub;
window.goBackToHub = function() {
  document.getElementById('view-sku').style.display = 'none';
  document.getElementById('view-link').style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  var homeBtn = document.getElementById('nav-home-btn');
  if (homeBtn) homeBtn.classList.add('active');
  appState.view = 'hub';
  applySidebarState();
  _origGoBack();
};

/* Load SKUs from Supabase */
async function loadSKUs() {
  if (!currentUser) return;
  try {
    var res = await sb.from('skus').select('*')
      .eq('user_id', currentUser.id)
      .order('sku_code', { ascending: true });
    skus = res.data || [];
    renderSKUTable();
    renderCatFilters();
  } catch(e) {
    console.error('loadSKUs error:', e);
    showToast('載入失敗', 'error');
  }
}

/* Render category filter pills */
function renderCatFilters() {
  var cats = [...new Set(skus.map(function(s){ return s.category; }).filter(Boolean))];
  var el = document.getElementById('sku-cat-filters');
  if (!el) return;
  el.innerHTML = '';
  var allBtn = document.createElement('button');
  allBtn.className = 'cat-pill' + (skuActiveCat === '' ? ' active' : '');
  allBtn.textContent = '全部';
  allBtn.onclick = function() { window.setSKUCat(''); };
  el.appendChild(allBtn);
  cats.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className = 'cat-pill' + (skuActiveCat === cat ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = function() { window.setSKUCat(cat); };
    el.appendChild(btn);
  });
}

window.setSKUCat = function(cat) {
  skuActiveCat = cat;
  renderCatFilters();
  renderSKUTable();
};

/* Render SKU table */
window.renderSKUTable = function() {
  var q = (document.getElementById('sku-search') || {}).value || '';
  q = q.toLowerCase();
  var filtered = skus.filter(function(s) {
    var matchQ = !q || s.sku_code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    var matchCat = !skuActiveCat || s.category === skuActiveCat;
    return matchQ && matchCat;
  });

  var tbody = document.getElementById('sku-tbody');
  var empty = document.getElementById('sku-empty');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = '';
  filtered.forEach(function(s) {
    var tr = document.createElement('tr');
    var statusCls = s.status === 'active' ? 'sku-status-active' : 'sku-status-disc';
    var statusTxt = s.status === 'active' ? '在售' : '停售';

    var td1 = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'sku-code-badge';
    badge.textContent = s.sku_code;
    td1.appendChild(badge);

    var td2 = document.createElement('td');
    td2.style.fontWeight = '700';
    td2.textContent = s.name;

    var td3 = document.createElement('td');
    td3.textContent = '$' + Number(s.price).toLocaleString();

    var td4 = document.createElement('td');
    td4.textContent = s.category || '—';
    if (!s.category) td4.style.color = 'var(--text-subtle)';

    var td5 = document.createElement('td');
    var statusBadge = document.createElement('span');
    statusBadge.className = 'sku-status-badge ' + statusCls;
    statusBadge.textContent = statusTxt;
    td5.appendChild(statusBadge);

    var td6 = document.createElement('td');
    td6.style.cssText = 'color:var(--text-muted);font-size:12px';
    td6.textContent = s.description || '—';
    if (!s.description) td6.style.color = 'var(--text-subtle)';

    var td7 = document.createElement('td');
    td7.style.textAlign = 'center';

    var editBtn = document.createElement('button');
    editBtn.className = 'sku-action-btn';
    editBtn.title = '編輯';
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.onclick = (function(id){ return function(){ window.editSKU(id); }; })(s.id);

    var delBtn = document.createElement('button');
    delBtn.className = 'sku-action-btn danger';
    delBtn.title = '刪除';
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    delBtn.onclick = (function(id){ return function(){ window.deleteSKU(id); }; })(s.id);

    td7.appendChild(editBtn);
    td7.appendChild(delBtn);

    var td8 = document.createElement('td');
    if (s.season_tags && s.season_tags.length) {
      s.season_tags.forEach(function(tag) {
        var pill = document.createElement('span');
        pill.style.cssText = 'display:inline-block;background:var(--primary-light);color:var(--primary);padding:2px 7px;border-radius:100px;font-size:10px;font-weight:700;margin:1px 2px';
        pill.textContent = tag;
        td8.appendChild(pill);
      });
    } else {
      td8.textContent = '—';
      td8.style.color = 'var(--text-subtle)';
    }

    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    tr.appendChild(td4); tr.appendChild(td5); tr.appendChild(td6);
    tr.appendChild(td8); tr.appendChild(td7);
    tbody.appendChild(tr);
  });
};

/* ── SKU Tag input logic ── */
var skuCurrentTags = [];

function renderTagPills() {
  var display = document.getElementById('sku-tags-display');
  if (!display) return;
  display.innerHTML = '';
  skuCurrentTags.forEach(function(tag, i) {
    var pill = document.createElement('span');
    pill.className = 'sku-tag-pill';
    pill.innerHTML = tag + '<span onclick="window.removeSkuTag(' + i + ')">×</span>';
    display.appendChild(pill);
  });
}

window.removeSkuTag = function(i) {
  skuCurrentTags.splice(i, 1);
  renderTagPills();
};

function initTagInput() {
  var input = document.getElementById('sku-tag-bare');
  if (!input) return;
  var commonTags = ['春節', '端午', '中秋', '母親節', '週年慶', '常態', '父親節', '聖誕節'];
  input.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      var tag = input.value.trim().replace(/,$/, '');
      if (tag && !skuCurrentTags.includes(tag)) {
        skuCurrentTags.push(tag);
        renderTagPills();
      }
      input.value = '';
      document.getElementById('tag-suggestions').style.display = 'none';
    } else if (e.key === 'Backspace' && !input.value && skuCurrentTags.length) {
      skuCurrentTags.pop();
      renderTagPills();
    }
  });
  input.addEventListener('input', function() {
    var q = input.value.toLowerCase();
    if (!q) { document.getElementById('tag-suggestions').style.display = 'none'; return; }
    var matches = commonTags.filter(function(t){ return t.includes(q) && !skuCurrentTags.includes(t); });
    var sug = document.getElementById('tag-suggestions');
    if (!matches.length) { sug.style.display = 'none'; return; }
    sug.style.display = 'block';
    sug.innerHTML = '';
    matches.forEach(function(t) {
      var d = document.createElement('div');
      d.className = 'tag-suggestion-item';
      d.textContent = t;
      d.onclick = function() {
        if (!skuCurrentTags.includes(t)) { skuCurrentTags.push(t); renderTagPills(); }
        input.value = '';
        sug.style.display = 'none';
        input.focus();
      };
      sug.appendChild(d);
    });
  });
  document.addEventListener('click', function(e) {
    var sug = document.getElementById('tag-suggestions');
    if (sug && !sug.contains(e.target) && e.target !== input) sug.style.display = 'none';
  });
}

window.openSKUModal = function() {
  skuEditId = null;
  skuCurrentTags = [];
  document.getElementById('sku-modal-title').innerHTML = '<i class="fas fa-plus"></i> 新增商品';
  document.getElementById('sku-f-code').value = '';
  document.getElementById('sku-f-name').value = '';
  document.getElementById('sku-f-price').value = '';
  document.getElementById('sku-f-cat').value = '';
  document.getElementById('sku-f-desc').value = '';
  document.getElementById('sku-f-status').value = 'active';
  renderTagPills();
  var cats = [...new Set(skus.map(function(s){ return s.category; }).filter(Boolean))];
  document.getElementById('sku-cat-list').innerHTML = cats.map(function(cat){ return '<option value="' + cat + '">'; }).join('');
  document.getElementById('sku-modal').classList.add('show');
  setTimeout(function(){ initTagInput(); document.getElementById('sku-f-code').focus(); }, 100);
};

window.editSKU = function(id) {
  var s = skus.find(function(x){ return x.id === id; });
  if (!s) return;
  skuEditId = id;
  document.getElementById('sku-modal-title').innerHTML = '<i class="fas fa-pen"></i> 編輯商品';
  document.getElementById('sku-f-code').value = s.sku_code;
  document.getElementById('sku-f-name').value = s.name;
  document.getElementById('sku-f-price').value = s.price;
  document.getElementById('sku-f-cat').value = s.category || '';
  document.getElementById('sku-f-desc').value = s.description || '';
  document.getElementById('sku-f-status').value = s.status || 'active';
  skuCurrentTags = s.season_tags || [];
  renderTagPills();
  document.getElementById('sku-modal').classList.add('show');
  setTimeout(function(){ initTagInput(); }, 100);
};

window.closeSKUModal = function() {
  document.getElementById('sku-modal').classList.remove('show');
  skuEditId = null;
};

/* Save SKU */
window.saveSKU = async function() {
  var code = document.getElementById('sku-f-code').value.trim();
  var name = document.getElementById('sku-f-name').value.trim();
  var price = parseFloat(document.getElementById('sku-f-price').value);
  var cat = document.getElementById('sku-f-cat').value.trim();
  var desc = document.getElementById('sku-f-desc').value.trim();
  var status = document.getElementById('sku-f-status').value;

  if (!code || !name || isNaN(price)) {
    showToast('商品編號、名稱、售價為必填', 'error');
    return;
  }

  var payload = {
    user_id: currentUser.id,
    sku_code: code,
    name: name,
    price: price,
    category: cat || null,
    description: desc || null,
    status: status,
    season_tags: skuCurrentTags.length ? skuCurrentTags : null,
    updated_at: new Date().toISOString()
  };

  try {
    if (skuEditId) {
      await sb.from('skus').update(payload).eq('id', skuEditId).eq('user_id', currentUser.id);
      showToast('商品已更新', 'success');
    } else {
      await sb.from('skus').insert(payload);
      showToast('商品已新增', 'success');
    }
    window.closeSKUModal();
    await loadSKUs();
  } catch(e) {
    console.error('saveSKU error:', e);
    showToast('儲存失敗：' + (e.message || ''), 'error');
  }
};

/* Delete SKU */
window.deleteSKU = async function(id) {
  var s = skus.find(function(x){ return x.id === id; });
  var name = s ? s.name : '此商品';
  if (!window.confirm('確定刪除「' + name + '」？')) return;
  try {
    await sb.from('skus').delete().eq('id', id).eq('user_id', currentUser.id);
    showToast('「' + name + '」已刪除', 'error');
    await loadSKUs();
  } catch(e) {
    showToast('刪除失敗', 'error');
  }
};

/* Close modal on overlay click */
document.addEventListener('click', function(e) {
  var modal = document.getElementById('sku-modal');
  if (modal && e.target === modal) window.closeSKUModal();
});
