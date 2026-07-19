(() => {
  // Soporta múltiples datasets opcionales: HORARIOS_DATA (original), HORARIOS_DATA_2, y HORARIOS_ALL (array)
  const DATASETS = [];
  if (window.HORARIOS_DATA) DATASETS.push(window.HORARIOS_DATA);
  if (window.HORARIOS_DATA_2) DATASETS.push(window.HORARIOS_DATA_2);
  if (window.HORARIOS_ALL && Array.isArray(window.HORARIOS_ALL)) DATASETS.push(...window.HORARIOS_ALL);
  const hasMultiple = DATASETS.length > 1;
  let currentDatasetIdx = 0;

  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const DAY_ABBR = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const PALETTE = ['#2563eb','#059669','#d97706','#7c3aed','#db2777','#0891b2','#dc2626','#4d7c0f','#9333ea','#b45309','#0d9488','#be185d'];
  const START_H = 6, END_H = 22;

  // DATA apunta al dataset seleccionado (mantiene compatibilidad con el código existente)
  let DATA = DATASETS[currentDatasetIdx] || window.HORARIOS_DATA || { program: '', period: '', courses: [] };
  const makeStoreKey = d => `horario-${(d.program||'').replace(/\s+/g,'_')}-${d.period||''}`;
  let STORE_KEY = makeStoreKey(DATA);

  // seleccion: { [codigoMateria]: nombreGrupo }
  let selection = {};
  try { selection = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) {}
  let isPrinting = false;
  // descarta selecciones que ya no existen en los datos
  for (const code of Object.keys(selection)) {
    const c = DATA.courses.find(c => c.code === code);
    if (!c || !c.groups.some(g => g.name === selection[code])) delete selection[code];
  }

  const openCourses = new Set(Object.keys(selection));

  // Si hay múltiples programas, inserta un selector en el header para cambiar entre ellos
  if (hasMultiple) {
    const header = document.querySelector('header');
    const select = document.createElement('select');
    select.id = 'programSelect';
    DATASETS.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${d.program} · ${d.period}`;
      select.appendChild(opt);
    });
    select.value = String(currentDatasetIdx);
    select.onchange = () => {
      currentDatasetIdx = Number(select.value);
      DATA = DATASETS[currentDatasetIdx];
      STORE_KEY = makeStoreKey(DATA);
      try { selection = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { selection = {}; }
      // limpiar openCourses y recargar
      openCourses.clear();
      for (const code of Object.keys(selection)) openCourses.add(code);
      document.getElementById('subTitle').textContent = `${DATA.program} · Período ${DATA.period} · Universidad Popular del Cesar`;
      renderAll();
    };
    header.insertBefore(select, document.querySelector('header .header-actions'));
  }

  document.getElementById('subTitle').textContent =
    `${DATA.program} · Período ${DATA.period} · Universidad Popular del Cesar`;

  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const endDisplay = t => t;

  const colorOf = code => {
    const codes = Object.keys(selection).sort();
    return PALETTE[codes.indexOf(code) % PALETTE.length];
  };

  function selectedSessions() {
    const out = [];
    for (const [code, gname] of Object.entries(selection)) {
      const course = DATA.courses.find(c => c.code === code);
      const group = course.groups.find(g => g.name === gname);
      for (const s of group.sessions) {
        out.push({ code, cname: course.name, gname, ...s, startMin: toMin(s.start), endMin: toMin(s.end) });
      }
    }
    return out;
  }

  function findConflicts(sessions) {
    const bad = new Set();
    const pairs = [];
    for (let i = 0; i < sessions.length; i++)
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i], b = sessions[j];
        if (a.dayIdx === b.dayIdx && a.startMin < b.endMin && b.startMin < a.endMin) {
          bad.add(i); bad.add(j);
          pairs.push([a, b]);
        }
      }
    return { bad, pairs };
  }

  function groupConflicts(code, g) {
    const others = selectedSessions().filter(s => s.code !== code);
    for (const s of g.sessions) {
      const sa = toMin(s.start), se = toMin(s.end) + 1;
      if (others.some(o => o.dayIdx === s.dayIdx && sa < o.endMin && o.startMin < se)) return true;
    }
    return false;
  }

  const listEl = document.getElementById('courseList');
  const searchEl = document.getElementById('search');

  function renderList() {
    const q = searchEl.value.trim().toLowerCase();
    listEl.innerHTML = '';
    for (const c of DATA.courses) {
      if (q && !(c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) continue;
      const div = document.createElement('div');
      div.className = 'course' + (openCourses.has(c.code) ? ' open' : '');
      const selGroup = selection[c.code];
      const col = selGroup ? colorOf(c.code) : null;

      const head = document.createElement('div');
      head.className = 'course-head';
      head.innerHTML = `
        ${col ? `<span class="dot" style="background:${col}"></span>` : ''}
        <div style="flex:1">
          <div class="code">${c.code}</div>
          <div class="cname">${c.name}</div>
        </div>
        <span class="badge ${selGroup ? 'sel' : ''}" ${col ? `style="--sel-color:${col}"` : ''}>
          ${selGroup ? 'G. ' + selGroup.split('-')[0] : c.groups.length + ' grupos'}
        </span>
        <span class="chev">▶</span>`;
      head.onclick = () => {
        openCourses.has(c.code) ? openCourses.delete(c.code) : openCourses.add(c.code);
        renderList();
      };
      div.appendChild(head);

      const gwrap = document.createElement('div');
      gwrap.className = 'groups';
      for (const g of c.groups) {
        const isSel = selection[c.code] === g.name;
        const conflicts = groupConflicts(c.code, g);
        const gdiv = document.createElement('div');
        gdiv.className = 'group' + (isSel ? ' selected' : '') + (conflicts ? ' conflict' : '');
        if (isSel && col) { gdiv.style.setProperty('--gcolor', col); gdiv.style.setProperty('--gbg', col + '18'); }
        const sessHtml = g.sessions
          .slice().sort((a, b) => a.dayIdx - b.dayIdx || a.start.localeCompare(b.start))
          .map(s => `<b>${DAY_ABBR[s.dayIdx]}</b> ${s.start}–${endDisplay(s.end)} · ${s.room}`)
          .join('<br>');
        gdiv.innerHTML = `
          <div class="gname">Grupo ${g.name}${conflicts ? '<span class="warn">⚠ choca</span>' : ''}</div>
          <div class="sess">${sessHtml || '<i>sin horario publicado</i>'}</div>`;
        gdiv.onclick = () => {
          if (isSel) delete selection[c.code];
          else selection[c.code] = g.name;
          persist();
          renderAll();
        };
        gwrap.appendChild(gdiv);
      }
      div.appendChild(gwrap);
      listEl.appendChild(div);
    }
  }

  const calEl = document.getElementById('calendar');
  const emptyEl = document.getElementById('emptyMsg');
  const legendEl = document.getElementById('courseLegend');
  const themeBtn = document.getElementById('btnTheme');

  function loadTheme() {
    const saved = localStorage.getItem('horario-theme');
    return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    if (themeBtn) themeBtn.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    localStorage.setItem('horario-theme', theme);
  }

  function toggleTheme() {
    const current = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function renderLegend() {
    if (!legendEl) return;
    const items = Object.entries(selection).map(([code, gname]) => {
      const course = DATA.courses.find(c => c.code === code);
      return {
        code,
        gname,
        name: course?.name || code,
        color: colorOf(code),
      };
    });
    if (!items.length) {
      legendEl.style.display = 'none';
      legendEl.innerHTML = '';
      return;
    }
    legendEl.style.display = 'flex';
    legendEl.innerHTML = items.map(item => `
      <div class="legend-item" style="--legend-color:${item.color}">
        <span class="legend-dot"></span>
        <div>
          <div class="legend-name">${item.name}</div>
          <div class="legend-meta">${item.code} · G.${item.gname.split('-')[0]}</div>
        </div>
      </div>`).join('');
  }

  function renderCalendar() {
    const sessions = selectedSessions();
    const { bad, pairs } = findConflicts(sessions);

    const bar = document.getElementById('conflictBar');
    if (pairs.length) {
      const msgs = pairs.map(([a, b]) =>
        `${a.code} (G.${a.gname.split('-')[0]}) y ${b.code} (G.${b.gname.split('-')[0]}) chocan el ${DAYS[a.dayIdx]} ${Math.max(a.startMin,b.startMin) === a.startMin ? a.start : b.start}`);
      bar.textContent = '⚠ ' + msgs.join('  ·  ');
      bar.classList.add('show');
    } else bar.classList.remove('show');

    if (!sessions.length) {
      calEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    calEl.style.display = 'grid';

    const showSaturday = sessions.some(s => s.dayIdx === 5);
    const showSunday = sessions.some(s => s.dayIdx === 6);
    const nDays = showSunday ? 7 : 6;
    calEl.style.setProperty('--ndays', nDays);
    calEl.classList.toggle('hide-saturday', !showSaturday && !showSunday);

    const minStart = Math.min(...sessions.map(s => s.startMin));
    const maxEnd = Math.max(...sessions.map(s => s.endMin));
    const minHour = Math.max(START_H, Math.floor(minStart / 60));
    const maxHour = Math.min(END_H, Math.max(Math.ceil(maxEnd / 60), minHour + 1));
    const hourH = isPrinting ? 38 : 56;
    const totalH = (maxHour - minHour) * hourH;

    let html = '<div class="cal-corner"></div>';
    for (let d = 0; d < nDays; d++) html += `<div class="cal-dayhead">${DAYS[d]}</div>`;

    html += `<div class="cal-times" style="height:${totalH}px">`;
    for (let h = minHour; h <= maxHour; h++) {
      const top = (h - minHour) * hourH + 6;
      html += `<div class="tlabel" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
    }
    html += '</div>';

    for (let d = 0; d < nDays; d++) {
      html += `<div class="cal-day" style="height:${totalH}px">`;
      for (let h = minHour + 1; h < maxHour; h++)
        html += `<div class="hline major" style="top:${(h - minHour) * hourH}px"></div>`;

      const daySess = sessions.map((s, i) => ({ s, i })).filter(x => x.s.dayIdx === d)
        .sort((a, b) => a.s.startMin - b.s.startMin || a.s.endMin - b.s.endMin);
      const cols = [];
      const layout = new Map();
      let cluster = [], clusterEnd = -1;
      const closeCluster = () => {
        for (const it of cluster) layout.get(it.i).ncols = cols.length;
        cols.length = 0; cluster = [];
      };
      for (const it of daySess) {
        if (cluster.length && it.s.startMin >= clusterEnd) closeCluster();
        let col = cols.findIndex(end => end <= it.s.startMin);
        if (col === -1) { col = cols.length; cols.push(0); }
        cols[col] = it.s.endMin;
        layout.set(it.i, { col, ncols: 1 });
        cluster.push(it);
        clusterEnd = Math.max(clusterEnd, it.s.endMin);
      }
      closeCluster();

      for (const { s, i } of daySess) {
        const { col, ncols } = layout.get(i);
        const top = (s.startMin - minHour * 60) / 60 * hourH;
        const height = (s.endMin - s.startMin) / 60 * hourH - 2;
        const w = 100 / ncols;
        html += `<div class="block${bad.has(i) ? ' conflict' : ''}" data-code="${s.code}"
                   style="--block-color:${colorOf(s.code)};top:${top}px;height:${height}px;
                          left:calc(${col * w}% + 3px);right:auto;width:calc(${w}% - 6px)">
            <div class="bname">Grupo ${s.gname.split('-')[0]}</div>
            <div class="btitle">${s.cname}</div>
            <div class="broom">${s.room}</div>
          </div>`;
      }
      html += '</div>';
    }
    calEl.innerHTML = html;

    calEl.querySelectorAll('.block').forEach(b => {
      b.onclick = () => {
        openCourses.add(b.dataset.code);
        searchEl.value = '';
        renderList();
        const target = [...listEl.querySelectorAll('.course-head .code')].find(e => e.textContent === b.dataset.code);
        if (target) target.closest('.course').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  function renderStats() {
    const sessions = selectedSessions();
    const nCourses = Object.keys(selection).length;
    const hours = sessions.reduce((a, s) => a + (s.endMin - s.startMin), 0) / 60;
    document.getElementById('stats').innerHTML = nCourses
      ? `<span><b>${nCourses}</b> materias</span><span><b>${hours % 1 ? hours.toFixed(1) : hours}</b> h/semana</span>`
      : '';
  }

  function updatePrintMeta() {
    const nCourses = Object.keys(selection).length;
    const sessions = selectedSessions();
    const hours = sessions.reduce((a, s) => a + (s.endMin - s.startMin), 0) / 60;
    document.getElementById('printMeta').textContent = `${DATA.program} · Período ${DATA.period} · ${nCourses} materia${nCourses === 1 ? '' : 's'} · ${hours % 1 ? hours.toFixed(1) : hours} h/semana`;
  }

  function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(selection)); }
  function renderAll() { renderList(); renderCalendar(); renderStats(); renderLegend(); updatePrintMeta(); }

  // ---------- Planificador automático ----------
  // Busca por retroceso: primero las materias con menos grupos, descartando de
  // inmediato las combinaciones incompatibles. Así no genera el producto cartesiano.
  const plannerEl = document.createElement('div');
  plannerEl.id = 'plannerModal';
  plannerEl.className = 'planner-modal no-print';
  plannerEl.innerHTML = `
    <div class="planner-card" role="dialog" aria-modal="true" aria-labelledby="plannerTitle">
      <div class="planner-head"><div><h2 id="plannerTitle">Buscar horarios compatibles</h2><p>Elige materias y define tus condiciones. Solo se proponen combinaciones sin choques.</p></div><button class="planner-close" type="button" aria-label="Cerrar">×</button></div>
      <div class="planner-body">
        <section class="planner-courses"><div class="planner-section-title"><b>Materias</b><span id="plannerCount"></span></div><input id="plannerSearch" type="search" placeholder="Filtrar por nombre o código"><div id="plannerCourseList"></div></section>
        <section class="planner-options">
          <div class="planner-section-title"><b>Condiciones obligatorias</b><span>deben cumplirse</span></div>
          <div class="planner-option-group"><span class="planner-label">Horario permitido</span><div class="planner-inline-fields"><label>Desde <select id="prefStart"></select></label><label>Hasta <select id="prefEnd"></select></label></div></div>
          <div class="planner-option-group"><span class="planner-label">Días en los que puedes tener clase</span><div class="planner-days" id="plannerDays"><label><input type="checkbox" data-day="0" checked><span>L</span></label><label><input type="checkbox" data-day="1" checked><span>M</span></label><label><input type="checkbox" data-day="2" checked><span>X</span></label><label><input type="checkbox" data-day="3" checked><span>J</span></label><label><input type="checkbox" data-day="4" checked><span>V</span></label><label><input type="checkbox" data-day="5" checked><span>S</span></label><label><input type="checkbox" data-day="6"><span>D</span></label></div></div>
          <label class="planner-field">Máximo de materias por día <select id="maxCoursesDay"><option value="0">Sin límite</option><option value="1">1 materia</option><option value="2">2 materias</option><option value="3">3 materias</option><option value="4">4 materias</option><option value="5">5 materias</option></select></label>
          <label class="planner-check"><input id="prefKnown" type="checkbox" checked> Excluir grupos sin horario publicado</label>
          <div class="planner-option-group planner-blocks"><div class="planner-label-row"><span class="planner-label">Bloques que debes tener libres</span><span>opcional</span></div><div class="planner-block-form"><select id="blockDay"><option value="-1">Todos los días</option><option value="0">Lunes</option><option value="1">Martes</option><option value="2">Miércoles</option><option value="3">Jueves</option><option value="4">Viernes</option><option value="5">Sábado</option><option value="6">Domingo</option></select><select id="blockStart"></select><select id="blockEnd"></select><button id="addBlock" type="button">Añadir</button></div><div class="planner-block-list" id="plannerBlockList" aria-live="polite"></div></div>
          <label class="planner-field planner-results-limit">Alternativas a mostrar <select id="resultLimit"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option></select></label>
          <button class="primary planner-run" id="plannerRun" type="button">Generar alternativas</button>
          <p class="planner-note">La búsqueda se limita para mantener la app rápida.</p>
        </section>
      </div>
      <div id="plannerResults" class="planner-results"></div>
    </div>`;
  document.body.appendChild(plannerEl);

  const plannerState = { chosen: new Set(), results: [], blocked: [], groupPreferences: new Map() };
  const plannerCourseList = document.getElementById('plannerCourseList');
  const plannerCount = document.getElementById('plannerCount');
  const hourOptions = (id, from, to, selected) => {
    const el = document.getElementById(id);
    for (let h = from; h <= to; h++) el.add(new Option(`${String(h).padStart(2, '0')}:00`, h * 60, false, h === selected));
  };
  hourOptions('prefStart', 6, 12, 6);
  hourOptions('prefEnd', 14, 22, 22);
  hourOptions('blockStart', 6, 21, 12);
  hourOptions('blockEnd', 7, 22, 14);
  function renderPlannerCourses(openGroupCourse) {
    const q = document.getElementById('plannerSearch').value.trim().toLowerCase();
    plannerCourseList.innerHTML = '';
    const columns = [0, 1].map(() => {
      const column = document.createElement('div');
      column.className = 'planner-course-column';
      plannerCourseList.appendChild(column);
      return column;
    });
    let visibleIndex = 0;
    for (const c of DATA.courses) {
      if (q && !c.code.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) continue;
      const label = document.createElement('article');
      label.className = 'planner-course' + (plannerState.chosen.has(c.code) ? ' selected' : '');
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = c.code; input.checked = plannerState.chosen.has(c.code);
      input.onchange = () => {
        if (input.checked) plannerState.chosen.add(c.code);
        else { plannerState.chosen.delete(c.code); plannerState.groupPreferences.delete(c.code); }
        renderPlannerCourses();
      };
      label.onclick = event => {
        if (event.target === input || event.target.closest('details')) return;
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      };
      const text = document.createElement('span'); text.textContent = `${c.code} · ${c.name}`;
      const groups = document.createElement('small'); groups.textContent = `${c.groups.length} grupos`;
      label.append(input, text, groups);
      if (plannerState.chosen.has(c.code)) {
        const details = document.createElement('details'); details.className = 'planner-group-picker'; details.open = openGroupCourse === c.code;
        const selectedGroups = plannerState.groupPreferences.get(c.code);
        const summary = document.createElement('summary');
        summary.innerHTML = `Elegir grupos <em>${selectedGroups ? `${selectedGroups.size} seleccionados` : 'todos'}</em>`;
        const choices = document.createElement('div'); choices.className = 'planner-group-choices';
        c.groups.forEach(group => {
          const choice = document.createElement('label'); choice.className = 'planner-group-choice';
          const groupInput = document.createElement('input'); groupInput.type = 'checkbox'; groupInput.checked = !selectedGroups || selectedGroups.has(group.name);
          const groupText = document.createElement('span'); groupText.textContent = `G. ${group.name}`;
          groupInput.onchange = () => {
            const allowed = new Set(selectedGroups || c.groups.map(item => item.name));
            groupInput.checked ? allowed.add(group.name) : allowed.delete(group.name);
            if (allowed.size === c.groups.length) plannerState.groupPreferences.delete(c.code);
            else plannerState.groupPreferences.set(c.code, allowed);
            renderPlannerCourses(c.code);
          };
          choice.append(groupInput, groupText); choices.appendChild(choice);
        });
        details.append(summary, choices); label.appendChild(details);
      }
      columns[visibleIndex++ % columns.length].appendChild(label);
    }
    plannerCount.textContent = `${plannerState.chosen.size} seleccionadas`;
  }

  const sessionsOverlap = (a, b) => a.dayIdx === b.dayIdx && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
  const dayName = index => DAYS[index] || 'Todos los días';
  function renderBlockedSlots() {
    const list = document.getElementById('plannerBlockList');
    list.innerHTML = plannerState.blocked.map((slot, index) => `<span class="planner-block-chip">${dayName(slot.dayIdx)} · ${String(Math.floor(slot.start / 60)).padStart(2, '0')}:00–${String(Math.floor(slot.end / 60)).padStart(2, '0')}:00<button type="button" data-remove-block="${index}" aria-label="Quitar bloque">×</button></span>`).join('');
  }
  function plannerPreferences() {
    const n = id => Number(document.getElementById(id).value);
    const allowedDays = [...document.querySelectorAll('#plannerDays input:checked')].map(input => Number(input.dataset.day));
    return { start: n('prefStart'), end: n('prefEnd'), allowedDays, maxCourses: n('maxCoursesDay'), known: document.getElementById('prefKnown').checked, blocked: plannerState.blocked, limit: n('resultLimit') };
  }
  function groupAllowed(group, pref) {
    if (pref.known && !group.sessions.length) return false;
    return group.sessions.every(s => {
      // Un grupo sin sesiones puede incluirse si el usuario lo permite, pero
      // una sesión malformada nunca es segura para calcular compatibilidad.
      if (!s.start || !s.end || !/^\d{1,2}:\d{2}$/.test(s.start) || !/^\d{1,2}:\d{2}$/.test(s.end)) return false;
      const start = toMin(s.start), end = toMin(s.end);
      const hitsBlockedSlot = pref.blocked.some(slot => (slot.dayIdx === -1 || slot.dayIdx === s.dayIdx) && start < slot.end && slot.start < end);
      return start >= pref.start && end <= pref.end && pref.allowedDays.includes(s.dayIdx) && !hitsBlockedSlot;
    });
  }
  function scheduleAllowed(groups, pref) {
    if (!pref.maxCourses) return true;
    const coursesPerDay = Array.from({ length: 7 }, () => new Set());
    groups.forEach(({ code, group }) => group.sessions.forEach(s => coursesPerDay[s.dayIdx].add(code)));
    return coursesPerDay.every(courses => courses.size <= pref.maxCourses);
  }
  function scheduleMetrics(groups) {
    const perDay = Array.from({ length: 7 }, () => []);
    groups.forEach(({ group }) => group.sessions.forEach(s => perDay[s.dayIdx].push(s)));
    let usedDays = 0, gaps = 0, span = 0;
    perDay.forEach(day => {
      if (!day.length) return;
      usedDays++; day.sort((a, b) => toMin(a.start) - toMin(b.start));
      const first = toMin(day[0].start), last = Math.max(...day.map(s => toMin(s.end)));
      span += last - first;
      for (let i = 1; i < day.length; i++) gaps += Math.max(0, toMin(day[i].start) - toMin(day[i - 1].end));
    });
    return { usedDays, gaps, span };
  }
  function formatMinutes(value) { const h = Math.floor(value / 60), m = value % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; }
  function runPlanner() {
    const resultEl = document.getElementById('plannerResults');
    const pref = plannerPreferences();
    if (!pref.allowedDays.length) { resultEl.innerHTML = '<p class="planner-message">Selecciona al menos un día disponible.</p>'; return; }
    const chosen = [...plannerState.chosen].map(code => DATA.courses.find(c => c.code === code));
    if (!chosen.length) { resultEl.innerHTML = '<p class="planner-message">Selecciona al menos una materia.</p>'; return; }
    const entries = chosen.map(course => {
      const preferredGroups = plannerState.groupPreferences.get(course.code);
      return { course, groups: course.groups.filter(group => groupAllowed(group, pref) && (!preferredGroups || preferredGroups.has(group.name))) };
    }).sort((a, b) => a.groups.length - b.groups.length);
    const unavailable = entries.filter(e => !e.groups.length).map(e => e.course.code);
    if (unavailable.length) { resultEl.innerHTML = `<p class="planner-message">No hay grupos que cumplan las restricciones para: <b>${unavailable.join(', ')}</b>. Relaja alguna condición.</p>`; return; }
    const candidates = [], picked = [], activeSessions = []; let visited = 0, capped = false;
    const MAX_NODES = 120000, MAX_CANDIDATES = Math.max(pref.limit * 30, 150);
    function search(index) {
      if (visited >= MAX_NODES || candidates.length >= MAX_CANDIDATES) { capped = true; return; }
      if (index === entries.length) { if (scheduleAllowed(picked, pref)) candidates.push(picked.map(x => ({ ...x }))); return; }
      const entry = entries[index];
      for (const group of entry.groups) {
        visited++;
        if (group.sessions.some(s => activeSessions.some(other => sessionsOverlap(s, other)))) continue;
        picked.push({ code: entry.course.code, group }); activeSessions.push(...group.sessions);
        search(index + 1);
        activeSessions.splice(activeSessions.length - group.sessions.length, group.sessions.length); picked.pop();
        if (visited >= MAX_NODES || candidates.length >= MAX_CANDIDATES) return;
      }
    }
    search(0);
    plannerState.results = candidates.map(groups => ({ groups, metrics: scheduleMetrics(groups) })).slice(0, pref.limit);
    if (!plannerState.results.length) { resultEl.innerHTML = '<p class="planner-message">No encontramos una combinación sin choques con esas condiciones. Prueba ampliando las horas o permitiendo otro día.</p>'; return; }
    resultEl.innerHTML = `<div class="planner-results-head"><b>${plannerState.results.length} alternativa${plannerState.results.length === 1 ? '' : 's'}</b><span>${capped ? 'Búsqueda optimizada: se exploró una muestra amplia.' : `${visited.toLocaleString('es-CO')} combinaciones exploradas.`}</span></div>` + plannerState.results.map((result, index) => {
      const m = result.metrics; const detail = result.groups.map(x => `${x.code} · G.${x.group.name.split('-')[0]}`).join(' &nbsp; ');
      return `<article class="planner-result"><div><b>Opción ${index + 1}</b><p>${detail}</p><small>${m.usedDays} días · ${formatMinutes(m.gaps)} de huecos · ${formatMinutes(m.span)} de jornada acumulada</small></div><button type="button" data-result="${index}">Aplicar</button></article>`;
    }).join('');
  }
  document.getElementById('btnPlanner').onclick = () => { plannerState.chosen = new Set(Object.keys(selection)); renderPlannerCourses(); document.getElementById('plannerResults').innerHTML = ''; plannerEl.classList.add('show'); };
  document.querySelector('.planner-close').onclick = () => plannerEl.classList.remove('show');
  plannerEl.onclick = e => { if (e.target === plannerEl) plannerEl.classList.remove('show'); };
  document.addEventListener('click', e => {
    document.querySelectorAll('.planner-group-picker[open]').forEach(picker => {
      if (!picker.contains(e.target)) picker.open = false;
    });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') plannerEl.classList.remove('show'); });
  document.getElementById('plannerSearch').oninput = renderPlannerCourses;
  document.getElementById('addBlock').onclick = () => {
    const dayIdx = Number(document.getElementById('blockDay').value);
    const start = Number(document.getElementById('blockStart').value);
    const end = Number(document.getElementById('blockEnd').value);
    if (start >= end) { document.getElementById('plannerResults').innerHTML = '<p class="planner-message">El bloque debe terminar después de la hora de inicio.</p>'; return; }
    plannerState.blocked.push({ dayIdx, start, end });
    renderBlockedSlots();
  };
  document.getElementById('plannerBlockList').onclick = e => {
    const button = e.target.closest('button[data-remove-block]');
    if (!button) return;
    plannerState.blocked.splice(Number(button.dataset.removeBlock), 1);
    renderBlockedSlots();
  };
  document.getElementById('plannerRun').onclick = runPlanner;
  document.getElementById('plannerResults').onclick = e => {
    const button = e.target.closest('button[data-result]'); if (!button) return;
    const result = plannerState.results[Number(button.dataset.result)];
    selection = Object.fromEntries(result.groups.map(x => [x.code, x.group.name]));
    openCourses.clear(); Object.keys(selection).forEach(code => openCourses.add(code)); persist(); renderAll(); plannerEl.classList.remove('show');
  };

  searchEl.addEventListener('input', renderList);
  if (themeBtn) themeBtn.onclick = toggleTheme;
  applyTheme(loadTheme());
  window.addEventListener('beforeprint', () => {
    isPrinting = true;
    renderCalendar();
  });
  window.addEventListener('afterprint', () => {
    isPrinting = false;
    renderCalendar();
  });
  document.getElementById('btnPrint').onclick = () => window.print();
  document.getElementById('btnClear').onclick = () => {
    if (!Object.keys(selection).length) return;
    if (confirm('¿Quitar todas las materias seleccionadas?')) {
      selection = {};
      persist();
      renderAll();
    }
  };

  renderAll();
})();
