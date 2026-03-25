/* ═══════════════════════════════════════
   羽曦堂 · Sprint 2: 跨年商品連線 Module
═══════════════════════════════════════ */

/* ═══════════════════════════════════════════
   Sprint 2 — 跨年商品連線 JS
═══════════════════════════════════════════ */
var linkState = {
  projectId: null,
  lyYear: '', tyYear: '',
  lySkus: [],   // SKUs from last year's project sections
  tySkus: [],   // SKUs from this year's project sections
  links: [],    // [{lyCode, tyCode, lyName, tyName, colorIdx}]
  selectedLy: null,
  colorMap: {}  // lyCode → colorIdx
};

var NODE_COLORS_JS = [
  {bg:'#E6F1FB',border:'#378ADD',text:'#0C447C',line:'#378ADD'},
  {bg:'#EAF3DE',border:'#3B6D11',text:'#27500A',line:'#3B6D11'},
  {bg:'#FAEEDA',border:'#BA7517',text:'#633806',line:'#BA7517'},
  {bg:'#EEEDFE',border:'#534AB7',text:'#3C3489',line:'#534AB7'},
  {bg:'#FAECE7',border:'#993C1D',text:'#712B13',line:'#993C1D'},
  {bg:'#FBEAF0',border:'#993556',text:'#72243E',line:'#72243E'},
  {bg:'#E1F5EE',border:'#0F6E56',text:'#085041',line:'#0F6E56'},
  {bg:'#F1EFE8',border:'#5F5E5A',text:'#444441',line:'#5F5E5A'},
];

function getLinkColor(lyCode) {
  if (linkState.colorMap[lyCode] === undefined) {
    var used = Object.keys(linkState.colorMap).length;
    linkState.colorMap[lyCode] = used % NODE_COLORS_JS.length;
  }
  return NODE_COLORS_JS[linkState.colorMap[lyCode]];
}

/* Navigate to link view */
window.goToLinkView = async function() {
  var proj = projects.find(function(p){ return p.id === appState.currentProjectId; });
  if (!proj) return;

  linkState.projectId = proj.id;
  linkState.lyYear = proj.ly;
  linkState.tyYear = proj.ty;
  linkState.links = [];
  linkState.selectedLy = null;
  linkState.colorMap = {};

  /* Collect TY SKUs grouped by section/price band */
  var tyMap = {};
  proj.sections.forEach(function(s) {
    s.tyItems.forEach(function(item) {
      if (item.name && !tyMap[item.name]) {
        tyMap[item.name] = { name: item.name, code: item.name, section: s.title };
      }
    });
  });
  linkState.tySkus = Object.values(tyMap);

  /* Collect LY SKUs grouped by section/price band */
  var lyMap = {};
  proj.sections.forEach(function(s) {
    s.lyItems.forEach(function(item) {
      if (item.name && !lyMap[item.name]) {
        lyMap[item.name] = { name: item.name, code: item.name, section: s.title };
      }
    });
  });
  linkState.lySkus = Object.values(lyMap);
  linkState.sections = proj.sections.map(function(s){ return s.title; });

  /* Load existing links from Supabase */
  try {
    var res = await sb.from('sku_links').select('*')
      .eq('user_id', currentUser.id)
      .eq('project_id', proj.id);
    (res.data || []).forEach(function(row) {
      var lyItem = linkState.lySkus.find(function(s){ return s.code === row.ly_sku_code; });
      var tyItem = linkState.tySkus.find(function(s){ return s.code === row.ty_sku_code; });
      if (lyItem && tyItem) {
        var col = getLinkColor(row.ly_sku_code);
        linkState.links.push({
          lyCode: row.ly_sku_code, tyCode: row.ty_sku_code,
          lyName: lyItem.name, tyName: tyItem.name,
          colorIdx: linkState.colorMap[row.ly_sku_code]
        });
      }
    });
  } catch(e) { console.error('Load links error:', e); }

  /* Update header labels */
  document.getElementById('link-ly-head').textContent = proj.ly + ' LY（去年）';
  document.getElementById('link-ty-head').textContent = proj.ty + ' TY（今年）';
  document.getElementById('link-page-sub').textContent =
    proj.title + '：建立 ' + proj.ly + ' vs ' + proj.ty + ' 商品對比連結';

  /* Show view, hide others */
  document.getElementById('view-hub').style.display = 'none';
  document.getElementById('view-detail').style.display = 'none';
  document.getElementById('view-sku').style.display = 'none';
  document.getElementById('view-link').style.display = 'block';
  document.getElementById('nav-hub').style.display = 'none';
  document.getElementById('nav-detail').style.display = 'flex';
  appState.view = 'link';
  applySidebarState();

  renderLinkNodes();
  renderLinkPairs();
};

window.goBackFromLink = function() {
  document.getElementById('view-link').style.display = 'none';
  window.openProject(linkState.projectId);
};

/* Render LY and TY node columns - grouped by price band */
function renderLinkNodes() {
  var lyCol = document.getElementById('link-ly-nodes');
  var tyCol = document.getElementById('link-ty-nodes');
  if (!lyCol || !tyCol) return;
  lyCol.innerHTML = '';
  tyCol.innerHTML = '';

  var sections = linkState.sections || [];

  /* Group items by section */
  function groupBySection(items) {
    var grouped = {};
    var noSection = [];
    items.forEach(function(item) {
      if (item.section) {
        if (!grouped[item.section]) grouped[item.section] = [];
        grouped[item.section].push(item);
      } else {
        noSection.push(item);
      }
    });
    return { grouped: grouped, noSection: noSection };
  }

  function addSectionHeader(col, title) {
    var h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);padding:10px 4px 4px;border-top:0.5px solid var(--border-soft);margin-top:4px';
    h.textContent = title;
    col.appendChild(h);
  }

  var lyGrouped = groupBySection(linkState.lySkus);
  var tyGrouped = groupBySection(linkState.tySkus);

  /* Render LY by section */
  sections.forEach(function(sec) {
    var lyItems = lyGrouped.grouped[sec] || [];
    if (lyItems.length === 0) return;
    addSectionHeader(lyCol, sec);
    lyItems.forEach(function(item) { renderLyNode(lyCol, item); });
  });
  lyGrouped.noSection.forEach(function(item) { renderLyNode(lyCol, item); });

  /* Render TY by section */
  sections.forEach(function(sec) {
    var tyItems = tyGrouped.grouped[sec] || [];
    if (tyItems.length === 0) return;
    addSectionHeader(tyCol, sec);
    tyItems.forEach(function(item) { renderTyNode(tyCol, item); });
  });
  tyGrouped.noSection.forEach(function(item) { renderTyNode(tyCol, item); });

  setTimeout(drawLinkLines, 50);
}

function renderLyNode(lyCol, item) {
    var isSelected = linkState.selectedLy === item.code;
    var myLinks = linkState.links.filter(function(l){ return l.lyCode === item.code; });
    var col = getLinkColor(item.code);
    var node = document.createElement('div');
    node.id = 'ly-node-' + encodeURIComponent(item.code);
    node.className = 'link-node';
    node.style.cssText = 'background:' + col.bg + ';color:' + col.text +
      ';border-color:' + (isSelected ? col.border : 'transparent') +
      ';' + (isSelected ? 'box-shadow:0 4px 14px rgba(0,0,0,.12)' : '');
    node.innerHTML =
      '<div class="link-node-name">' + item.name +
      (myLinks.length ? '<span style="font-size:10px;margin-left:5px;opacity:.6">×' + myLinks.length + '</span>' : '') +
      '</div>' +
      '<div class="link-port port-r" id="port-r-' + encodeURIComponent(item.code) +
      '" style="background:' + col.border + ';border-color:' + col.border + '"></div>';
    node.onclick = function() {
      linkState.selectedLy = (linkState.selectedLy === item.code) ? null : item.code;
      var hint = document.getElementById('link-hint-text');
      if (linkState.selectedLy) {
        hint.textContent = '已選：' + item.name + ' → 點右側 TY 商品完成連線';
      } else {
        hint.textContent = '點選左側 LY 商品（選中）→ 再點右側 TY 商品完成連線。支援一對多。';
      }
      renderLinkNodes();
      drawLinkLines();
    };
    lyCol.appendChild(node);
}

  /* TY nodes rendered by renderTyNode */

function renderTyNode(tyCol, item) {
    var myLinks = linkState.links.filter(function(l){ return l.tyCode === item.code; });
    var node = document.createElement('div');
    node.id = 'ty-node-' + encodeURIComponent(item.code);
    node.className = 'link-node';

    if (myLinks.length > 0) {
      var firstCol = NODE_COLORS_JS[linkState.colorMap[myLinks[0].lyCode] || 0];
      node.style.cssText = 'background:' + firstCol.bg + ';color:' + firstCol.text +
        ';border-color:' + firstCol.border;
      if (myLinks.length > 1) {
        var secondCol = NODE_COLORS_JS[linkState.colorMap[myLinks[1].lyCode] || 1];
        node.style.background = 'linear-gradient(135deg,' + firstCol.bg + ' 50%,' + secondCol.bg + ' 50%)';
      }
    } else {
      node.style.cssText = 'background:var(--bg-card-solid);border-color:var(--border-soft);color:var(--text-main)';
    }

    node.innerHTML =
      '<div class="link-port port-l" id="port-l-' + encodeURIComponent(item.code) + '"></div>' +
      '<div class="link-node-name">' + item.name +
      (myLinks.length > 1 ? '<span style="font-size:10px;margin-left:4px;opacity:.6">×' + myLinks.length + '</span>' : '') +
      '</div>';

    node.onclick = function() {
      if (!linkState.selectedLy) return;
      var already = linkState.links.find(function(l){
        return l.lyCode === linkState.selectedLy && l.tyCode === item.code;
      });
      if (!already) {
        var lyItem = linkState.lySkus.find(function(s){ return s.code === linkState.selectedLy; });
        var col = getLinkColor(linkState.selectedLy);
        linkState.links.push({
          lyCode: linkState.selectedLy, tyCode: item.code,
          lyName: lyItem ? lyItem.name : linkState.selectedLy,
          tyName: item.name,
          colorIdx: linkState.colorMap[linkState.selectedLy]
        });
      }
      linkState.selectedLy = null;
      document.getElementById('link-hint-text').textContent =
        '連線完成！繼續點選左側商品，或管理下方清單。';
      renderLinkNodes();
      drawLinkLines();
      renderLinkPairs();
    };
    tyCol.appendChild(node);
}

/* Draw SVG connector lines */
function drawLinkLines() {
  var svg = document.getElementById('link-svg-canvas');
  var card = document.querySelector('.link-canvas-card');
  if (!svg || !card) return;

  var cRect = card.getBoundingClientRect();
  svg.setAttribute('viewBox', '0 0 ' + card.offsetWidth + ' ' + card.offsetHeight);
  svg.innerHTML = '';

  linkState.links.forEach(function(link) {
    var fromPort = document.getElementById('port-r-' + encodeURIComponent(link.lyCode));
    var toPort   = document.getElementById('port-l-' + encodeURIComponent(link.tyCode));
    if (!fromPort || !toPort) return;

    var fr = fromPort.getBoundingClientRect();
    var tr = toPort.getBoundingClientRect();
    var x1 = fr.left - cRect.left + fr.width / 2;
    var y1 = fr.top  - cRect.top  + fr.height / 2;
    var x2 = tr.left - cRect.left + tr.width / 2;
    var y2 = tr.top  - cRect.top  + tr.height / 2;
    var col = NODE_COLORS_JS[link.colorIdx] || NODE_COLORS_JS[0];
    var cpx = (x1 + x2) / 2;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + cpx + ',' + y1 + ' ' + cpx + ',' + y2 + ' ' + x2 + ',' + y2);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', col.line);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.75');
    svg.appendChild(path);

    /* End dot */
    var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', '4');
    dot.setAttribute('fill', col.line);
    svg.appendChild(dot);
  });
}

/* Render pairs list */
function renderLinkPairs() {
  var list = document.getElementById('link-pairs-list');
  var noPairs = document.getElementById('link-no-pairs');
  if (!list) return;
  list.innerHTML = '';
  noPairs.style.display = linkState.links.length ? 'none' : 'block';

  linkState.links.forEach(function(link, i) {
    var col = NODE_COLORS_JS[link.colorIdx] || NODE_COLORS_JS[0];
    var row = document.createElement('div');
    row.className = 'link-pair-row';
    row.innerHTML =
      '<span class="link-pair-tag" style="background:' + col.bg + ';color:' + col.text + ';border:1px solid ' + col.border + '">' + link.lyName + '</span>' +
      '<span class="link-pair-arrow">→ 對比 →</span>' +
      '<span class="link-pair-tag" style="background:' + col.bg + ';color:' + col.text + ';border:1px solid ' + col.border + '">' + link.tyName + '</span>' +
      '<button class="link-pair-remove" title="移除">×</button>';
    row.querySelector('.link-pair-remove').onclick = function() {
      linkState.links.splice(i, 1);
      renderLinkNodes();
      drawLinkLines();
      renderLinkPairs();
    };
    list.appendChild(row);
  });
}

/* Save links to Supabase */
window.saveLinkData = async function() {
  if (!currentUser || !linkState.projectId) return;
  showLoading('儲存連線中…');
  try {
    /* Delete existing links for this project */
    await sb.from('sku_links').delete()
      .eq('user_id', currentUser.id)
      .eq('project_id', linkState.projectId);

    /* Insert new links */
    if (linkState.links.length > 0) {
      var rows = linkState.links.map(function(link) {
        return {
          user_id: currentUser.id,
          project_id: linkState.projectId,
          ly_sku_code: link.lyCode,
          ty_sku_code: link.tyCode
        };
      });
      await sb.from('sku_links').insert(rows);
    }

    hideLoading();
    showToast('連線已儲存 (' + linkState.links.length + ' 組)', 'success');
    window.goBackFromLink();
  } catch(e) {
    hideLoading();
    console.error('saveLinkData error:', e);
    showToast('儲存失敗', 'error');
  }
};

/* Redraw lines on resize */
window.addEventListener('resize', function() {
  if (appState.view === 'link') setTimeout(drawLinkLines, 50);
});
