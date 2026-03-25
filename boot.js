/* ═══════════════════════════════════════
   羽曦堂 · Boot JS (canvas, sidebar, initAuth)
═══════════════════════════════════════ */

/* ── Boot ── */

// ── Mouse glow ──
document.addEventListener('mousemove', function(e) {
  var g = document.getElementById('glow');
  if (g) { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; }
});

// ── Ripple ──
var rOvl = document.getElementById('ripple-overlay');
function fireRipple(x, y, color, size) {
  if (!rOvl) return;
  var d = document.createElement('div'); d.className = 'rip-circle';
  d.style.cssText = 'left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;background:'+color+';';
  rOvl.appendChild(d); setTimeout(function(){ d.remove(); }, 700);
}

// ── Welcome canvas ──
var dpr = window.devicePixelRatio || 1;
var wCvs = document.getElementById('wc');
var wCtx = wCvs ? wCvs.getContext('2d') : null;
var wW, wH, wFS, wPX, wPY, wRun = false, wT = 0;
function setupW() {
  if (!wCtx) return;
  wFS = Math.max(56, Math.min(108, window.innerWidth * 0.09));
  wPX = wFS * .1; wPY = wFS * .2;
  wCtx.font = '800 ' + wFS + 'px Urbanist,sans-serif';
  var m = wCtx.measureText('Welcome');
  wW = m.width + wPX * 2; wH = wFS * 1.18 + wPY * 2;
  wCvs.width = Math.ceil(wW * dpr); wCvs.height = Math.ceil(wH * dpr);
  wCvs.style.width = Math.ceil(wW) + 'px'; wCvs.style.height = Math.ceil(wH) + 'px';
  wCtx.scale(dpr, dpr);
}
var wB = [
  {cx:.30,cy:.55,tx:.30,ty:.55,xf:.00013,xp:0,yf:.00010,yp:1.40,r:1.05,sp:.07,s:[{t:0,c:'rgba(18,16,138,1)'},{t:.45,c:'rgba(20,18,145,.75)'},{t:.8,c:'rgba(22,20,150,.28)'},{t:1,c:'rgba(18,16,138,0)'}]},
  {cx:.60,cy:.45,tx:.60,ty:.45,xf:.00028,xp:2.10,yf:.00022,yp:3.30,r:.80,sp:.13,s:[{t:0,c:'rgba(62,26,140,1)'},{t:.4,c:'rgba(65,28,145,.8)'},{t:.75,c:'rgba(68,30,148,.32)'},{t:1,c:'rgba(62,26,140,0)'}]},
  {cx:.50,cy:.50,tx:.50,ty:.50,xf:.00018,xp:4.50,yf:.00015,yp:.60,r:.90,sp:.09,s:[{t:0,c:'rgba(30,45,184,1)'},{t:.45,c:'rgba(32,48,188,.7)'},{t:.8,c:'rgba(35,52,192,.28)'},{t:1,c:'rgba(30,45,184,0)'}]},
  {cx:.70,cy:.30,tx:.70,ty:.30,xf:.00044,xp:5.60,yf:.00038,yp:2.20,r:.42,sp:.20,s:[{t:0,c:'rgba(120,175,245,1)'},{t:.28,c:'rgba(115,168,238,.82)'},{t:.65,c:'rgba(108,160,230,.4)'},{t:1,c:'rgba(120,175,245,0)'}]}
];
function wOsc(f, p) { return (Math.sin(wT * f * Math.PI * 2 + p) + 1) * .5; }
function drawW() {
  if (!wCtx) return;
  wT++; wCtx.clearRect(0, 0, wW, wH);
  wCtx.globalCompositeOperation = 'source-over';
  wCtx.font = '800 ' + wFS + 'px Urbanist,sans-serif';
  wCtx.fillStyle = '#080d30'; wCtx.fillText('Welcome', wPX, wPY + wFS * .88);
  wCtx.globalCompositeOperation = 'source-atop';
  wB.forEach(function(b) {
    b.tx = .04 + wOsc(b.xf, b.xp) * .92; b.ty = .04 + wOsc(b.yf, b.yp) * .92;
    b.cx += (b.tx - b.cx) * b.sp; b.cy += (b.ty - b.cy) * b.sp;
    var g = wCtx.createRadialGradient(b.cx*wW, b.cy*wH, 0, b.cx*wW, b.cy*wH, Math.max(wW,wH)*b.r);
    b.s.forEach(function(s) { g.addColorStop(s.t, s.c); });
    wCtx.fillStyle = g; wCtx.fillRect(0, 0, wW, wH);
  });
  wCtx.globalCompositeOperation = 'source-over';
  if (wRun) requestAnimationFrame(drawW);
}

// ── Left panel canvas ──
var lCvs = document.getElementById('left-canvas');
var lCtx = lCvs ? lCvs.getContext('2d') : null;
var lRun = false, lT = 0;
function setupL() {
  if (!lCtx) return;
  var p = lCvs.parentElement, pw = p.offsetWidth, ph = p.offsetHeight;
  lCvs.width = Math.ceil(pw * dpr); lCvs.height = Math.ceil(ph * dpr);
  lCvs.style.width = pw + 'px'; lCvs.style.height = ph + 'px';
  lCtx.scale(dpr, dpr);
}
var lB = [
  {cx:.20,cy:.72,tx:.20,ty:.72,xf:.000042,xp:0,yf:.000033,yp:1.50,r:1.10,sp:.018,s:[{t:0,c:'rgba(14,10,110,.95)'},{t:.35,c:'rgba(18,14,120,.70)'},{t:.72,c:'rgba(22,16,130,.28)'},{t:1,c:'rgba(14,10,110,0)'}]},
  {cx:.58,cy:.42,tx:.58,ty:.42,xf:.000065,xp:1.80,yf:.000052,yp:3.10,r:.88,sp:.022,s:[{t:0,c:'rgba(58,22,135,.92)'},{t:.38,c:'rgba(65,28,145,.72)'},{t:.74,c:'rgba(70,30,150,.26)'},{t:1,c:'rgba(58,22,135,0)'}]},
  {cx:.72,cy:.28,tx:.72,ty:.28,xf:.000050,xp:3.60,yf:.000040,yp:0.80,r:.95,sp:.020,s:[{t:0,c:'rgba(25,40,175,.90)'},{t:.40,c:'rgba(30,48,185,.68)'},{t:.78,c:'rgba(35,55,190,.24)'},{t:1,c:'rgba(25,40,175,0)'}]},
  {cx:.62,cy:.62,tx:.62,ty:.62,xf:.000088,xp:5.20,yf:.000072,yp:2.40,r:.50,sp:.030,s:[{t:0,c:'rgba(105,165,240,.92)'},{t:.28,c:'rgba(98,158,232,.74)'},{t:.64,c:'rgba(90,150,222,.35)'},{t:1,c:'rgba(105,165,240,0)'}]},
  {cx:.14,cy:.18,tx:.14,ty:.18,xf:.000038,xp:4.00,yf:.000030,yp:2.90,r:.82,sp:.015,s:[{t:0,c:'rgba(10,8,90,.88)'},{t:.42,c:'rgba(14,10,100,.62)'},{t:.82,c:'rgba(18,12,115,.20)'},{t:1,c:'rgba(10,8,90,0)'}]}
];
function lOsc(f, p) { return (Math.sin(lT * f * Math.PI * 2 + p) + 1) * .5; }
function drawL() {
  if (!lCtx) return;
  lT++; var lW = lCvs.width/dpr, lH = lCvs.height/dpr;
  lCtx.clearRect(0, 0, lW, lH); lCtx.fillStyle = '#060920'; lCtx.fillRect(0, 0, lW, lH);
  lB.forEach(function(b) {
    b.tx = .04 + lOsc(b.xf, b.xp) * .92; b.ty = .04 + lOsc(b.yf, b.yp) * .92;
    b.cx += (b.tx - b.cx) * b.sp; b.cy += (b.ty - b.cy) * b.sp;
    var cx = b.cx*lW, cy = b.cy*lH, r = Math.max(lW,lH)*b.r;
    var g = lCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    b.s.forEach(function(s) { g.addColorStop(s.t, s.c); });
    lCtx.fillStyle = g; lCtx.fillRect(0, 0, lW, lH);
  });
  if (lRun) requestAnimationFrame(drawL);
}

// ── Page transitions ──
window.showLogin = function() {
  var wp = document.getElementById('page-welcome');
  var lp = document.getElementById('page-login');
  if (!wp || !lp) return;
  wp.classList.add('out-left');
  setTimeout(function() {
    wp.classList.add('hidden');
    lp.classList.remove('hidden', 'slide-right');
    var card = document.getElementById('split-card');
    if (card) { card.style.animation = 'none'; card.offsetHeight; card.style.animation = ''; }
    if (!lRun) { setupL(); lRun = true; requestAnimationFrame(drawL); }
  }, 420);
};
window.showWelcome = function() {
  var lp = document.getElementById('page-login');
  var wp = document.getElementById('page-welcome');
  if (!lp || !wp) return;
  lp.classList.add('slide-right');
  setTimeout(function() {
    lp.classList.add('hidden'); lp.classList.remove('slide-right');
    wp.classList.remove('hidden', 'out-left');
  }, 400);
};

// ── Button listeners ──
var btnEnter = document.getElementById('btn-enter');
if (btnEnter) {
  btnEnter.addEventListener('click', function(e) {
    fireRipple(e.clientX, e.clientY, 'rgba(255,255,255,0.5)', 320);
    setTimeout(window.showLogin, 120);
  });
}
var btnBack = document.getElementById('btn-back');
if (btnBack) btnBack.addEventListener('click', window.showWelcome);

// ── Boot canvas ──
document.fonts.ready.then(function() {
  if (!wCtx) return;
  setupW();
  wCtx.font = '800 ' + wFS + 'px Urbanist,sans-serif';
  wCtx.fillStyle = '#1e2db8'; wCtx.fillText('Welcome', wPX, wPY + wFS * .88);
  setTimeout(function() { wRun = true; requestAnimationFrame(drawW); }, 1300);
});
window.addEventListener('resize', function() {
  wRun = false;
  setTimeout(function() {
    setupW(); wRun = true; requestAnimationFrame(drawW);
    if (lRun) { lRun = false; setupL(); lRun = true; requestAnimationFrame(drawL); }
  }, 80);
});

Chart.register(ChartDataLabels);

/* Sidebar collapse toggle */
var sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
window.toggleSidebar = function() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('sidebar_collapsed', sidebarCollapsed);
  applySidebarState();
};
function applySidebarState() {
  var sidebar = document.querySelector('.sidebar');
  var icon    = document.getElementById('sidebar-toggle-icon');
  var tab     = document.getElementById('sidebar-tab');
  var main    = document.querySelector('main.main-content');
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    if (icon) icon.style.transform = 'rotate(180deg)';
    if (tab)  tab.classList.add('show');
    if (main) main.style.paddingLeft = 'calc(52px + clamp(16px, 3vw, 36px))';
  } else {
    sidebar.classList.remove('collapsed');
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (tab)  tab.classList.remove('show');
    if (main) main.style.paddingLeft = 'calc(268px + clamp(16px, 3vw, 36px))';
  }
}
/* Apply on load */
document.addEventListener('DOMContentLoaded', function() {
  applySidebarState();
});

initAuth();