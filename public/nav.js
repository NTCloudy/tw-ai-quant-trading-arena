// Side navigation + collapsible sections (same behaviour as the futures dashboard).
// Builds the menu from the page's top-level sections, so new sections show up automatically.
(function () {
  const css = `
  #tpSide { position:fixed; top:0; left:0; bottom:0; width:210px; overflow-y:auto; z-index:900;
    background:rgba(8,12,24,.96); border-right:1px solid rgba(148,163,184,.18); padding:14px 8px 24px;
    font-size:13px; }
  #tpSide .grp { font-size:11px; color:#64748b; margin:14px 10px 6px; letter-spacing:1px; }
  #tpSide a { display:block; color:#cbd5e1; text-decoration:none; padding:7px 10px; border-radius:8px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #tpSide a:hover { background:rgba(56,189,248,.10); }
  #tpSide a.active { background:rgba(56,189,248,.18); color:#fff; }
  #tpSide .tools button { width:100%; margin-top:6px; background:#16203a; color:#e2e8f0;
    border:1px solid rgba(148,163,184,.25); border-radius:8px; padding:6px; cursor:pointer; font-size:12px; }
  body.tp-has-side { padding-left:220px; }
  #tpNavToggle { display:none; position:fixed; left:10px; bottom:14px; z-index:950; background:#16203a; color:#e2e8f0;
    border:1px solid rgba(148,163,184,.3); border-radius:10px; padding:8px 12px; font-size:14px; cursor:pointer; }
  @media (max-width: 1100px) {
    body.tp-has-side { padding-left:0; }
    #tpSide { transform:translateX(-100%); transition:transform .2s; box-shadow:4px 0 20px rgba(0,0,0,.5); }
    #tpSide.open { transform:none; }
    #tpNavToggle { display:block; }
  }
  .tp-sec { scroll-margin-top:16px; }
  .tp-head { cursor:pointer; user-select:none; position:relative; }
  .tp-head::after { content:'▾'; position:absolute; right:6px; top:4px; color:#94a3b8; font-size:14px; }
  .tp-sec.tp-collapsed .tp-head::after { content:'▸'; }
  .tp-sec.tp-collapsed > :not(.tp-head) { display:none !important; }
  .tp-sec.tp-collapsed { padding-bottom:6px; }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const key = (sec) => 'tpCollapsed:' + location.pathname + ':' + sec.id;
  const FIXED = { 'Simulation Controls': '🎛️ 模式與設定', 'Custom Ticker Watchlist': '⭐ 自訂標的池' };
  const titleOf = (sec) => {
    const label = sec.getAttribute('aria-label');
    if (label && FIXED[label]) return FIXED[label];
    const el = sec.querySelector('.section-title, .briefing-live-pill, .panel-card-title, h2, h3');
    let t = (el ? el.textContent : sec.getAttribute('aria-label') || sec.id).trim().replace(/\s+/g, ' ');
    t = t.replace(/[（(][^）)]*[）)]/g, '').trim();
    t = t.replace(/ ＆ .*$/, '').replace(/^(.{2})3 位 AI 操盤手/, '$1AI ').trim();
    return t.length > 20 ? t.slice(0, 19) + '…' : t;
  };

  function build() {
    const shell = document.querySelector('.terminal-shell') || document.body;
    const secs = [...shell.querySelectorAll(':scope > section')];
    if (!secs.length) return;
    const nav = document.createElement('nav');
    nav.id = 'tpSide';
    nav.innerHTML = '<div class="grp">目錄</div>';
    secs.forEach((sec, i) => {
      if (!sec.id) sec.id = 'tpSec' + i;
      sec.classList.add('tp-sec');
      const head = sec.querySelector(':scope > .section-header, :scope > .briefing-header, :scope > .watchlist-header')
        || sec.firstElementChild;
      if (head) {
        head.classList.add('tp-head');
        head.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input, select, label')) return;
          sec.classList.toggle('tp-collapsed');
          localStorage.setItem(key(sec), sec.classList.contains('tp-collapsed') ? '1' : '0');
        });
      }
      if (localStorage.getItem(key(sec)) === '1') sec.classList.add('tp-collapsed');
      const a = document.createElement('a');
      a.href = '#' + sec.id;
      a.textContent = titleOf(sec);
      a.title = a.textContent;
      a.addEventListener('click', () => {
        if (sec.classList.contains('tp-collapsed')) {
          sec.classList.remove('tp-collapsed');
          localStorage.setItem(key(sec), '0');
        }
        nav.classList.remove('open');
      });
      nav.appendChild(a);
    });
    const tools = document.createElement('div');
    tools.innerHTML = '<div class="grp">工具</div><div class="tools"><button id="tpExpand">全部展開</button>'
      + '<button id="tpCollapse">全部收合</button></div>';
    nav.appendChild(tools);
    document.body.appendChild(nav);
    document.body.classList.add('tp-has-side');
    const setAll = (collapsed) => secs.forEach((s) => {
      s.classList.toggle('tp-collapsed', collapsed);
      localStorage.setItem(key(s), collapsed ? '1' : '0');
    });
    nav.querySelector('#tpExpand').onclick = () => setAll(false);
    nav.querySelector('#tpCollapse').onclick = () => setAll(true);

    const toggle = document.createElement('button');
    toggle.id = 'tpNavToggle';
    toggle.textContent = '☰ 目錄';
    toggle.onclick = () => nav.classList.toggle('open');
    document.body.appendChild(toggle);

    const obs = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    }), { rootMargin: '-20px 0px -65% 0px' });
    secs.forEach((s) => obs.observe(s));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
