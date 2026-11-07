/* =========================================================
 * QLCC - Giao diện ứng dụng
 * ========================================================= */
(function () {
  'use strict';
  var Q = window.QLCC, S = Q.Store;
  S.load();

  var now = new Date();
  var state = {
    view: 'dashboard',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    inputText: '',
    parsed: null,
    paint: { code: null, session: 'full' },
    tsFilter: '',
    summaryMode: 'month',
    staffFilter: '',
    showInactive: false,
    bonusScope: 'year',
    dayDate: '',
    dayTo: '',
    dayCode: 'P',
    dayFilter: '',
    dayDraft: null
  };

  var TITLES = {
    dashboard: 'Tổng quan', input: 'Nhập chấm công bằng văn bản', help: 'Hướng dẫn sử dụng', timesheet: 'Bảng chấm công',
    summary: 'Thống kê tổng hợp', bonus: 'Quản lý ngày bù', staff: 'Danh sách viên chức', settings: 'Cài đặt & Dữ liệu',
    daily: 'Chấm nghỉ theo ngày', leave: 'Quản lý ngày phép năm'
  };

  /* ================= Tiện ích ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.classList.add('hide'); }, 3200);
    setTimeout(function () { el.remove(); }, 3700);
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function groupOf(code) { return Q.CODE_MAP[code] ? Q.CODE_MAP[code].group : ''; }
  function codeLabel(code) {
    if (code === 'BU') return 'Cộng ngày bù';
    return Q.CODE_MAP[code] ? Q.CODE_MAP[code].label : code;
  }
  function codeOptions(selected, extra) {
    var html = '';
    (extra || []).forEach(function (o) {
      html += '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    Q.CODES.forEach(function (c) {
      html += '<option value="' + esc(c.code) + '"' + (c.code === selected ? ' selected' : '') + '>' + esc(c.code + ' – ' + c.label) + '</option>';
    });
    return html;
  }
  function badge(code) {
    if (!code) return '';
    var g = code === 'BU' ? 'bonus' : groupOf(code);
    return '<span class="code-badge g-' + g + '">' + esc(code === 'BU' ? '+Bù' : code) + '</span>';
  }
  function sessionLabel(s) { return s === 'am' ? 'Sáng' : s === 'pm' ? 'Chiều' : 'Cả ngày'; }
  function cellText(c) {
    if (!c.am && !c.pm) return '';
    if (c.am === c.pm) return c.am;
    return (c.am || '·') + '/' + (c.pm || '·');
  }
  function cellClass(c) {
    var cls = [];
    if (c.offday) cls.push(c.holiday && !Q.isWeekend(c.date || '', S.data.settings) ? 'hol' : 'off');
    if (c.future) cls.push('future');
    if (c.am && c.am === c.pm) cls.push('g-' + groupOf(c.am));
    else if (c.am || c.pm) cls.push('mix');
    if (!c.auto) cls.push('manual');
    return cls.join(' ');
  }
  function monthLabel(m, y) { return 'Tháng ' + Q.pad(m) + '/' + y; }
  function confirmBox(msg) { return window.confirm(msg); }

  /* ================= Modal ================= */
  var Modal = {
    open: function (title, body, foot, opts) {
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = body;
      $('#modalFoot').innerHTML = foot || '';
      var m = $('#modal');
      m.hidden = false;
      m.querySelector('.modal').className = 'modal' + (opts && opts.wide ? ' wide' : '');
      var first = m.querySelector('input:not([type=checkbox]),select,textarea');
      if (first) setTimeout(function () { first.focus(); }, 30);
    },
    close: function () { $('#modal').hidden = true; }
  };
  $('#modal').addEventListener('click', function (e) {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) Modal.close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#modal').hidden) Modal.close();
  });

  /* ================= Kỳ báo cáo ================= */
  function initPeriod() {
    var sm = $('#selMonth'), sy = $('#selYear');
    var h = '';
    for (var m = 1; m <= 12; m++) h += '<option value="' + m + '">Tháng ' + m + '</option>';
    sm.innerHTML = h;
    var yh = '';
    for (var y = now.getFullYear() - 5; y <= now.getFullYear() + 2; y++) yh += '<option value="' + y + '">' + y + '</option>';
    sy.innerHTML = yh;
    sm.addEventListener('change', function () { state.month = +sm.value; render(); });
    sy.addEventListener('change', function () { state.year = +sy.value; render(); });
    $('#prevMonth').addEventListener('click', function () { shiftMonth(-1); });
    $('#nextMonth').addEventListener('click', function () { shiftMonth(1); });
    $('#thisMonth').addEventListener('click', function () { state.year = now.getFullYear(); state.month = now.getMonth() + 1; render(); });
  }
  function shiftMonth(d) {
    state.month += d;
    if (state.month < 1) { state.month = 12; state.year--; }
    if (state.month > 12) { state.month = 1; state.year++; }
    render();
  }
  function syncPeriod() {
    var sy = $('#selYear');
    if (!sy.querySelector('option[value="' + state.year + '"]')) {
      var o = document.createElement('option'); o.value = state.year; o.textContent = state.year; sy.appendChild(o);
    }
    $('#selMonth').value = state.month;
    sy.value = state.year;
  }

  /* ================= Điều hướng ================= */
  $('#nav').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-view]');
    if (!a) return;
    go(a.getAttribute('data-view'));
    $('#sidebar').classList.remove('open');
  });
  $('#menuToggle').addEventListener('click', function () { $('#sidebar').classList.toggle('open'); });
  function go(view) {
    state.view = view;
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    syncPeriod();
    $('#pageTitle').textContent = TITLES[state.view];
    $all('#nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-view') === state.view); });
    var st = S.data.settings;
    $('#unitNameSide').textContent = st.unitName || 'Chưa đặt tên đơn vị';
    var v = Views[state.view] || Views.dashboard;
    $('#content').innerHTML = v.html();
    if (v.bind) v.bind();
  }

  /* ================= Dữ liệu mẫu ================= */
  var SAMPLE_STAFF = [
    ['Nguyễn Văn An', 'Giám đốc', 'Ban Giám đốc'],
    ['Trần Thị Bình', 'Phó Giám đốc', 'Ban Giám đốc'],
    ['Lê Văn Cường', 'Trưởng phòng', 'Phòng Hành chính – Tổng hợp'],
    ['Phạm Thị Dung', 'Kế toán viên', 'Phòng Hành chính – Tổng hợp'],
    ['Hoàng Văn Hùng', 'Chuyên viên', 'Phòng Nghiệp vụ'],
    ['Nguyễn Thị Lan', 'Viên chức', 'Phòng Nghiệp vụ'],
    ['Võ Minh Khoa', 'Viên chức', 'Phòng Nghiệp vụ'],
    ['Đặng Thu Hà', 'Thủ quỹ', 'Phòng Hành chính – Tổng hợp']
  ];
  function sampleText() {
    var y = state.year, m = Q.pad(state.month);
    return 'Ngày 03/' + m + '/' + y + ': Nguyễn Văn An đi công tác cả ngày, Trần Thị Bình nghỉ phép buổi sáng\n' +
      'Lê Văn Cường nghỉ ốm từ ngày 05/' + m + ' đến 07/' + m + '\n' +
      'Ngày 10/' + m + '/' + y + '\n' +
      '- Phạm Thị Dung nghỉ phép sáng, chiều đi học bồi dưỡng\n' +
      '- Chị Lan nghỉ con ốm cả ngày\n' +
      '- Hoàng Văn Hùng, Võ Minh Khoa đi tập huấn buổi chiều\n' +
      'Đặng Thu Hà nghỉ bù ngày 12/' + m + '\n' +
      'Hoàng Văn Hùng trực cơ quan thứ bảy ngày 15/' + m + ' (cộng bù)\n' +
      'Cộng 1,5 ngày bù cho Võ Minh Khoa ngày 16/' + m + ' do làm thêm giờ';
  }
  function loadSampleStaff() {
    SAMPLE_STAFF.forEach(function (r, i) {
      S.addStaff({ code: 'VC' + Q.pad(i + 1), name: r[0], position: r[1], department: r[2] });
    });
    if (!S.data.settings.unitName) {
      S.data.settings.unitName = 'Trung tâm Dịch vụ công';
      S.data.settings.parentUnit = 'Sở Nội vụ';
    }
    S.save();
  }

  /* ================= VIEW: Tổng quan ================= */
  var Views = {};
  Views.dashboard = {
    html: function () {
      var staff = S.activeStaff();
      var y = state.year, m = state.month;
      if (!staff.length) {
        return '<div class="card hero"><div class="about"><img src="assets/icon.png" alt=""><div>' +
          '<h2>Chào mừng đến với phần mềm Quản lý Chấm công – Ngày phép</h2>' +
          '<div class="muted">Chấm công, theo dõi ngày phép năm và ngày bù cho viên chức đơn vị sự nghiệp công lập.</div></div></div>' +
          '<p>Chỉ cần <b>3 bước thiết lập</b> (khoảng 2 phút) là bắt đầu sử dụng được:</p>' +
          '<ol class="steps"><li><b>Thông tin đơn vị</b>: tên đơn vị, người ký bảng chấm công.</li>' +
          '<li><b>Danh sách viên chức</b>: gõ hoặc dán từ Excel, mỗi dòng một người.</li>' +
          '<li><b>Số ngày phép năm</b> của từng người (mặc định 12 ngày).</li></ol>' +
          '<div class="row gap wrap"><button class="btn btn-primary btn-lg" id="btnWizard">▶ Bắt đầu thiết lập</button>' +
          '<button class="btn" id="btnSample">Dùng thử với dữ liệu mẫu</button>' +
          '<label class="btn">⬆ Khôi phục từ file sao lưu<input type="file" id="heroImport" accept=".json,application/json" hidden></label></div></div>';
      }
      var std = 0, totalWork = 0, totalAbs = 0, groups = { work: 0, paid: 0, bhxh: 0, unpaid: 0 };
      var absRank = [];
      var lastDay = Q.ymd(y, m, Q.daysInMonth(y, m));
      var bonusTotal = 0;
      staff.forEach(function (s) {
        var st = Q.monthStats(S.data, s.id, y, m);
        std = st.std;
        totalWork += st.work;
        groups.work += st.work; groups.paid += st.paid - st.counts.L; groups.bhxh += st.bhxh; groups.unpaid += st.unpaid;
        var abs = st.paid - st.counts.L + st.bhxh + st.unpaid;
        totalAbs += abs;
        absRank.push({ s: s, abs: abs, st: st });
        bonusTotal += Q.bonusBalance(S.data, s.id, lastDay).balance;
      });
      absRank.sort(function (a, b) { return b.abs - a.abs; });
      var leaveUsedAll = 0, leaveTotalAll = 0;
      var leaveList = staff.map(function (s) {
        var al = Q.annualLeave(S.data, s, y);
        leaveUsedAll += al.used; leaveTotalAll += al.total;
        return { s: s, al: al };
      }).sort(function (a, b) { return a.al.remain - b.al.remain; });
      var today = Q.todayYmd();
      var todayList = [];
      staff.forEach(function (s) {
        var c = Q.dayCell(S.data, s.id, today);
        if (!c.auto && ((c.am && c.am !== '+') || (c.pm && c.pm !== '+'))) todayList.push({ s: s, c: c });
      });
      var gsum = groups.work + groups.paid + groups.bhxh + groups.unpaid || 1;
      var html = '<div class="stats">' +
        stat('Viên chức đang làm việc', staff.length, 'người', 'blue') +
        stat('Ngày công chuẩn ' + monthLabel(m, y), std, 'ngày', 'green') +
        stat('Tổng ngày nghỉ, vắng trong tháng', Q.fmtNum0(totalAbs), 'ngày', 'amber') +
        stat('Ngày phép năm ' + y + ' đã nghỉ', Q.fmtNum0(leaveUsedAll) + ' / ' + Q.fmtNum0(leaveTotalAll), 'ngày', 'sky') +
        stat('Ngày bù còn tồn (lũy kế)', Q.fmtNum0(bonusTotal), 'ngày', 'violet') +
        '</div>';

      html += '<div class="grid-2">';
      // Hôm nay
      html += '<div class="card"><div class="card-head"><h3>Tình hình hôm nay – ' + Q.WD_LONG[new Date().getDay()] + ', ' + Q.fmtDate(today) + '</h3></div>';
      if (!Q.isWorkingDay(today, S.data.settings)) {
        var hn = Q.holidayName(today, S.data.settings);
        html += '<div class="empty">Hôm nay là ngày nghỉ' + (hn ? ' (' + esc(hn) + ')' : '') + '.</div>';
      } else if (!todayList.length) {
        html += '<div class="empty ok">✓ Tất cả viên chức đi làm đầy đủ.</div>';
      } else {
        html += '<table class="table compact"><tbody>' + todayList.map(function (x) {
          var parts = [];
          if (x.c.am === x.c.pm) parts.push(badge(x.c.am) + ' ' + esc(codeLabel(x.c.am)) + ' (cả ngày)');
          else {
            if (x.c.am && x.c.am !== '+') parts.push(badge(x.c.am) + ' Sáng: ' + esc(codeLabel(x.c.am)));
            if (x.c.pm && x.c.pm !== '+') parts.push(badge(x.c.pm) + ' Chiều: ' + esc(codeLabel(x.c.pm)));
          }
          return '<tr><td><b>' + esc(x.s.name) + '</b><div class="muted small">' + esc(x.s.position || '') + '</div></td><td>' + parts.join('<br>') + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
      html += '</div>';

      // Cơ cấu
      html += '<div class="card"><div class="card-head"><h3>Cơ cấu ngày công ' + monthLabel(m, y) + '</h3></div>' +
        '<div class="stackbar">' +
        ['work', 'paid', 'bhxh', 'unpaid'].map(function (g) {
          var w = groups[g] / gsum * 100;
          return w > 0 ? '<div class="seg g-' + g + '" style="width:' + w + '%" title="' + Q.GROUP_LABEL[g] + ': ' + Q.fmtNum0(groups[g]) + '"></div>' : '';
        }).join('') + '</div><div class="legend-row">' +
        ['work', 'paid', 'bhxh', 'unpaid'].map(function (g) {
          return '<div><span class="dot g-' + g + '"></span>' + (g === 'paid' ? 'Nghỉ hưởng lương (trừ lễ)' : Q.GROUP_LABEL[g]) + ': <b>' + Q.fmtNum0(groups[g]) + '</b> ngày</div>';
        }).join('') + '</div>' +
        '<h4 class="mt">Viên chức nghỉ nhiều nhất trong tháng</h4>' +
        (absRank.filter(function (x) { return x.abs > 0; }).length ? '<div class="bars">' + absRank.filter(function (x) { return x.abs > 0; }).slice(0, 6).map(function (x) {
          var max = absRank[0].abs || 1;
          return '<div class="bar-row"><div class="bar-name">' + esc(x.s.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (x.abs / max * 100) + '%"></div></div><div class="bar-val">' + Q.fmtNum0(x.abs) + '</div></div>';
        }).join('') + '</div>' : '<div class="empty">Chưa có ngày nghỉ nào trong tháng.</div>') +
        '</div>';
      html += '</div>';

      // Ngày phép năm
      html += '<div class="grid-2"><div class="card"><div class="card-head row"><h3>Ngày phép năm ' + y + ' – ít ngày còn lại nhất</h3><div class="spacer"></div><a data-go="leave" class="small">Xem tất cả →</a></div>' +
        '<table class="table compact leave-low"><tbody>' + leaveList.slice(0, 6).map(function (x) {
          var pct = x.al.total > 0 ? Math.max(0, Math.min(100, x.al.remain / x.al.total * 100)) : 0;
          return '<tr><td><b>' + esc(x.s.name) + '</b></td><td class="num muted small">đã nghỉ ' + Q.fmtNum0(x.al.used) + '/' + Q.fmtNum0(x.al.total) + '</td>' +
            '<td style="width:40%"><div class="remain"><b class="' + (x.al.remain < 0 ? 'neg' : '') + '">' + Q.fmtNum0(x.al.remain) + '</b><div class="bar-track"><div class="bar-fill ok" style="width:' + pct + '%"></div></div></div></td></tr>';
        }).join('') + '</tbody></table>' +
        (leaveList.some(function (x) { return !x.al.entered; }) ? '<div class="alert warn small mt">Có viên chức chưa nhập số ngày phép năm ' + y + ' (đang dùng mặc định ' + S.data.settings.annualLeave + ' ngày). <a data-go="leave">Nhập ngay</a></div>' : '') +
        '</div>';
      // Hành động nhanh
      html += '<div class="card"><div class="card-head"><h3>Thao tác nhanh</h3></div><div class="quick q2">' +
        quick('daily', '☑', 'Chấm nghỉ theo ngày', 'Tích chọn người nghỉ sáng, chiều, cả ngày') +
        quick('leave', '✈', 'Ngày phép năm', 'Nhập phép đầu năm, xem số ngày còn lại') +
        quick('timesheet', '▤', 'Xem / sửa bảng chấm công', 'Bảng công theo mẫu C01-HD, in và xuất Excel') +
        quick('summary', '∑', 'Thống kê tổng hợp', 'Tổng hợp theo tháng, theo năm cho từng viên chức') +
        '</div></div></div>';
      return html;

      function stat(label, val, unit, color) {
        return '<div class="stat c-' + color + '"><div class="stat-label">' + esc(label) + '</div><div class="stat-val">' + esc(val) + ' <span>' + unit + '</span></div></div>';
      }
      function quick(view, ico, t, d) {
        return '<a class="quick-item" data-go="' + view + '"><div class="q-ico">' + ico + '</div><div><b>' + t + '</b><div class="muted small">' + d + '</div></div></a>';
      }
    },
    bind: function () {
      var w = $('#btnWizard');
      if (w) w.addEventListener('click', function () { openSetupWizard(1); });
      var hi = $('#heroImport');
      if (hi) hi.addEventListener('change', function () { importBackupFile(this.files[0]); });
      var b = $('#btnSample');
      if (b) b.addEventListener('click', function () {
        loadSampleStaff();
        state.inputText = sampleText();
        toast('Đã nạp ' + SAMPLE_STAFF.length + ' viên chức mẫu. Hãy thử phân tích văn bản mẫu.');
        go('input');
      });
    }
  };

  /* ================= VIEW: Nhập văn bản ================= */
  Views.input = {
    html: function () {
      var st = S.data.settings;
      var html = '<div class="grid-input">';
      html += '<div class="card"><div class="card-head"><h3>Dán hoặc gõ nội dung chấm công</h3>' +
        '<div class="muted small">Ngày không ghi năm/tháng sẽ lấy theo kỳ đang chọn: <b>' + monthLabel(state.month, state.year) + '</b></div></div>' +
        '<textarea id="txtInput" class="txt-input" spellcheck="false" placeholder="Ví dụ:\nNgày 05/11/2026: Nguyễn Văn An nghỉ phép buổi sáng, Trần Thị Bình đi công tác cả ngày\nLê Văn Cường nghỉ ốm từ 03/11 đến 06/11\nHoàng Văn Hùng trực thứ bảy 08/11 (cộng 1 ngày bù)">' + esc(state.inputText) + '</textarea>' +
        '<div class="row gap wrap mt">' +
        '<button class="btn btn-primary" id="btnParse">⚡ Phân tích văn bản <kbd>Ctrl+Enter</kbd></button>' +
        '<button class="btn" id="btnExample">Chèn ví dụ mẫu</button>' +
        '<button class="btn btn-ghost" id="btnClear">Xoá nội dung</button>' +
        '<label class="inline-field">Khi chỉ ghi "nghỉ", tính là: <select id="selDefault">' + codeOptions(st.defaultAbsence) + '</select></label>' +
        '</div></div>';
      html += '<div class="card help"><div class="card-head"><h3>Cách viết để phần mềm hiểu</h3></div>' +
        '<ul class="help-list">' +
        '<li><b>Ngày:</b> 05/11/2026 · 5/11 · ngày 5 tháng 11 · từ 3/11 đến 6/11 · 3-6/11 · ngày 3, 4 và 5/11 · hôm nay, hôm qua</li>' +
        '<li><b>Buổi:</b> sáng · chiều · cả ngày (không ghi = cả ngày)</li>' +
        '<li><b>Loại:</b> nghỉ phép (P) · nghỉ bù (NB) · ốm (Ô) · con ốm (Cô) · thai sản (TS) · công tác (CT) · học, tập huấn (H) · việc riêng, cưới, tang (R) · không lương (Ro) · không phép, vắng (KP) · đi làm (xoá nghỉ)</li>' +
        '<li><b>Ngày bù:</b> trực, làm thêm, đi làm thứ bảy/CN → tự cộng ngày bù. Hoặc ghi "cộng 2 ngày bù cho …"</li>' +
        '<li><b>Tên:</b> họ tên đầy đủ, hoặc tên gọi (vd "chị Lan") nếu không trùng. Có thể ghi nhiều người: "A, B nghỉ phép"</li>' +
        '<li>Dòng chỉ có ngày sẽ áp dụng cho các dòng phía dưới.</li>' +
        '</ul></div>';
      html += '</div>';

      if (state.parsed) html += Views.input.resultHtml();

      // Nhật ký
      var hist = S.data.history;
      html += '<div class="card"><div class="card-head"><h3>Nhật ký ghi dữ liệu từ văn bản</h3></div>';
      if (!hist.length) html += '<div class="empty">Chưa có lần ghi nào.</div>';
      else {
        html += '<table class="table compact"><thead><tr><th>Thời gian</th><th>Số mục</th><th>Nội dung</th><th></th></tr></thead><tbody>' +
          hist.slice(0, 10).map(function (h, i) {
            var t = new Date(h.time);
            return '<tr><td class="nowrap">' + t.toLocaleString('vi-VN') + '</td><td>' + h.count + '</td><td class="clip">' + esc(h.text.split('\n')[0]) + (h.text.indexOf('\n') > 0 ? ' …' : '') + '</td><td class="right">' +
              (i === 0 ? '<button class="btn btn-sm btn-danger-ghost" data-undo="' + h.id + '">↶ Hoàn tác</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      html += '</div>';
      return html;
    },
    resultHtml: function () {
      var p = state.parsed;
      var staff = S.activeStaff();
      var html = '<div class="card result" id="resultCard"><div class="card-head"><h3>Kết quả phân tích</h3>' +
        '<div class="muted small">Kiểm tra, chỉnh sửa nếu cần rồi bấm <b>Ghi vào dữ liệu</b>.</div></div>';
      if (p.unknown.length) {
        html += '<div class="alert warn"><b>Tên chưa có trong danh sách viên chức:</b><div class="chips">' +
          p.unknown.map(function (u, i) {
            return '<span class="chip">' + esc(u.name) + ' <button class="btn btn-xs" data-addunknown="' + i + '">+ Thêm vào danh sách</button></span>';
          }).join('') + '</div><div class="small muted">Sau khi thêm, phần mềm sẽ tự phân tích lại.</div></div>';
      }
      if (p.warnings.length) {
        html += '<div class="alert danger"><b>Cần lưu ý:</b><ul>' + p.warnings.map(function (w) {
          return '<li>Dòng ' + w.line + ': ' + esc(w.message) + ' <span class="muted">"' + esc(w.text) + '"</span></li>';
        }).join('') + '</ul></div>';
      }
      if (!p.entries.length) {
        html += '<div class="empty">Không tìm thấy mục chấm công nào. Hãy kiểm tra tên viên chức có trong danh sách và có ghi ngày.</div></div>';
        return html;
      }
      var nAtt = 0, nBonus = 0;
      p.entries.forEach(function (e) { if (e.checked) { if (e.kind === 'bonus') nBonus++; else nAtt++; } });
      html += '<div class="table-wrap"><table class="table entries"><thead><tr>' +
        '<th><input type="checkbox" id="chkAll" checked title="Chọn tất cả"></th><th>Dòng</th><th>Viên chức</th><th>Ngày</th><th>Buổi</th><th>Loại chấm công</th><th>Hiện tại</th><th>Ghi chú</th></tr></thead><tbody>';
      p.entries.forEach(function (e, i) {
        var cur = '';
        if (e.kind === 'att') {
          var c = Q.dayCell(S.data, e.staffId, e.date);
          cur = c.auto ? '<span class="muted">' + esc(cellText(c) || '—') + '</span>' : badge(cellText(c));
        } else {
          cur = '<span class="muted">Tồn: ' + Q.fmtNum0(Q.bonusBalance(S.data, e.staffId, '9999-12-31').balance) + '</span>';
        }
        html += '<tr class="' + (e.checked ? '' : 'unchecked') + (e.skip ? ' skip' : '') + '" data-i="' + i + '">' +
          '<td><input type="checkbox" data-f="checked"' + (e.checked ? ' checked' : '') + '></td>' +
          '<td class="muted" title="' + esc(e.source) + '">' + e.line + '</td>' +
          '<td><select data-f="staffId">' + staff.map(function (s) {
            return '<option value="' + s.id + '"' + (s.id === e.staffId ? ' selected' : '') + '>' + esc(s.name) + '</option>';
          }).join('') + '</select></td>' +
          '<td><input type="date" data-f="date" value="' + e.date + '"><div class="muted small">' + Q.WD_LONG[Q.weekday(e.date)] + '</div></td>' +
          '<td><select data-f="session"><option value="full"' + (e.session === 'full' ? ' selected' : '') + '>Cả ngày</option>' +
          '<option value="am"' + (e.session === 'am' ? ' selected' : '') + '>Sáng</option><option value="pm"' + (e.session === 'pm' ? ' selected' : '') + '>Chiều</option></select></td>' +
          '<td><div class="row gap-s"><select data-f="code">' + codeOptions(e.code, [['BU', '⊕ Cộng ngày bù (làm thêm, trực)']]) + '</select>' +
          (e.kind === 'bonus' ? '<input type="number" class="num" step="0.5" min="0" data-f="amount" value="' + e.amount + '" title="Số ngày bù">' : '') + '</div></td>' +
          '<td>' + cur + '</td>' +
          '<td class="small">' + (e.warn ? '<span class="warn-text">⚠ ' + esc(e.warn) + '</span>' : '<span class="ok-text">✓ Hợp lệ</span>') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="row gap mt result-foot"><button class="btn btn-primary btn-lg" id="btnApply">✔ Ghi vào dữ liệu (' + nAtt + ' mục chấm công' + (nBonus ? ', ' + nBonus + ' mục ngày bù' : '') + ')</button>' +
        '<button class="btn btn-ghost" id="btnCancelParse">Huỷ</button></div></div>';
      return html;
    },
    doParse: function () {
      var text = $('#txtInput').value;
      state.inputText = text;
      if (!S.activeStaff().length) { toast('Chưa có viên chức nào trong danh sách. Hãy thêm viên chức trước.', 'err'); return; }
      if (!text.trim()) { toast('Hãy nhập nội dung văn bản.', 'err'); return; }
      var r = Q.Parser.parse(text, {
        staff: S.data.staff, settings: S.data.settings, year: state.year, month: state.month,
        defaultAbsence: S.data.settings.defaultAbsence
      });
      r.entries.forEach(function (e) { e.checked = !e.skip; });
      state.parsed = r;
      render();
      var rc = $('#resultCard');
      if (rc) rc.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    bind: function () {
      var ta = $('#txtInput');
      ta.addEventListener('input', function () { state.inputText = ta.value; });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); Views.input.doParse(); } });
      $('#btnParse').addEventListener('click', Views.input.doParse);
      $('#btnExample').addEventListener('click', function () {
        if (!S.activeStaff().length) loadSampleStaff();
        state.inputText = sampleText(); state.parsed = null; render();
      });
      $('#btnClear').addEventListener('click', function () { state.inputText = ''; state.parsed = null; render(); });
      $('#selDefault').addEventListener('change', function () { S.data.settings.defaultAbsence = this.value; S.save(); toast('Đã lưu mã nghỉ mặc định.'); });
      $all('[data-undo]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirmBox('Hoàn tác lần ghi dữ liệu này? Các ô chấm công sẽ trở lại như trước khi ghi.')) return;
          S.undoHistory(b.getAttribute('data-undo'));
          toast('Đã hoàn tác.');
          render();
        });
      });
      if (!state.parsed) return;
      var p = state.parsed;
      $all('[data-addunknown]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = p.unknown[+b.getAttribute('data-addunknown')];
          openStaffModal(null, { name: u.name }, function () { Views.input.doParse(); });
        });
      });
      var all = $('#chkAll');
      if (all) {
        all.checked = p.entries.every(function (e) { return e.checked; });
        all.addEventListener('change', function () {
          p.entries.forEach(function (e) { e.checked = all.checked; });
          render();
        });
      }
      $all('.entries tbody tr').forEach(function (tr) {
        var e = p.entries[+tr.getAttribute('data-i')];
        $all('[data-f]', tr).forEach(function (inp) {
          inp.addEventListener('change', function () {
            var f = inp.getAttribute('data-f');
            if (f === 'checked') e.checked = inp.checked;
            else if (f === 'amount') e.amount = parseFloat(inp.value) || 0;
            else if (f === 'staffId') { e.staffId = inp.value; e.staffName = S.getStaff(inp.value).name; }
            else if (f === 'date') { if (inp.value) { e.date = inp.value; e.skip = false; e.warn = ''; } }
            else if (f === 'session') { e.session = inp.value; if (e.kind === 'bonus' && !e.explicitAmount) e.amount = inp.value === 'full' ? 1 : 0.5; }
            else if (f === 'code') {
              e.code = inp.value;
              e.kind = inp.value === 'BU' ? 'bonus' : 'att';
              if (e.kind === 'bonus' && !e.amount) e.amount = e.session === 'full' ? 1 : 0.5;
              e.warn = '';
            }
            if (e.kind === 'att' && !Q.isWorkingDay(e.date, S.data.settings)) {
              e.warn = 'Ngày ' + Q.fmtDate(e.date) + ' không phải ngày làm việc.';
            }
            render();
          });
        });
      });
      $('#btnApply').addEventListener('click', function () {
        var sel = p.entries.filter(function (e) { return e.checked; });
        if (!sel.length) { toast('Chưa chọn mục nào.', 'err'); return; }
        var h = S.applyEntries(sel, state.inputText);
        var nb = h.bonusIds.length;
        toast('Đã ghi ' + (sel.length - nb) + ' mục chấm công' + (nb ? ' và ' + nb + ' mục ngày bù' : '') + '.');
        state.parsed = null;
        state.inputText = '';
        // chuyển kỳ tới tháng của mục đầu tiên nếu khác
        var d = sel[0].date;
        state.year = +d.slice(0, 4); state.month = +d.slice(5, 7);
        render();
      });
      $('#btnCancelParse').addEventListener('click', function () { state.parsed = null; render(); });
    }
  };

  /* ================= VIEW: Bảng chấm công ================= */
  function timesheetData(filter) {
    var y = state.year, m = state.month, n = Q.daysInMonth(y, m);
    var days = [];
    for (var d = 1; d <= n; d++) {
      var s = Q.ymd(y, m, d);
      days.push({ d: d, s: s, wd: Q.weekday(s), off: !Q.isWorkingDay(s, S.data.settings), hol: Q.holidayName(s, S.data.settings) });
    }
    var f = Q.nameKey(filter || '');
    var staff = S.activeStaff().filter(function (s) { return !f || Q.nameKey(s.name).indexOf(f) >= 0; });
    var bonusDays = {};
    S.data.bonus.forEach(function (b) { bonusDays[b.staffId + '|' + b.date] = (bonusDays[b.staffId + '|' + b.date] || 0) + b.amount; });
    var rows = staff.map(function (s) {
      var cells = days.map(function (dd) {
        var c = Q.dayCell(S.data, s.id, dd.s);
        c.date = dd.s;
        c.bonus = bonusDays[s.id + '|' + dd.s] || 0;
        return c;
      });
      return { staff: s, cells: cells, st: Q.monthStats(S.data, s.id, y, m) };
    });
    return { days: days, rows: rows };
  }

  Views.timesheet = {
    html: function () {
      var data = timesheetData(state.tsFilter);
      var html = '<div class="card ts-toolbar"><div class="row gap wrap">' +
        '<input type="search" id="tsFilter" placeholder="🔍 Tìm viên chức..." value="' + esc(state.tsFilter) + '">' +
        '<div class="spacer"></div><button class="btn" id="tsPrint">🖨 In bảng</button><button class="btn btn-success" id="tsExcel">⬇ Xuất Excel</button></div>' +
        '<div class="row gap wrap mt"><div class="paint"><span class="muted small">Chấm nhanh:</span>' +
        '<button class="pbtn' + (!state.paint.code ? ' active' : '') + '" data-paint="">✎ Mở chi tiết</button>' +
        '<button class="pbtn g-work' + (state.paint.code === '+' ? ' active' : '') + '" data-paint="+" title="Đi làm (xoá nghỉ)">+</button>' +
        Q.CODES.filter(function (c) { return c.code !== '+' && c.code !== 'L'; }).map(function (c) {
          return '<button class="pbtn g-' + c.group + (state.paint.code === c.code ? ' active' : '') + '" data-paint="' + esc(c.code) + '" title="' + esc(c.label) + '">' + esc(c.code) + '</button>';
        }).join('') +
        '<select id="paintSession"><option value="full">Cả ngày</option><option value="am"' + (state.paint.session === 'am' ? ' selected' : '') + '>Sáng</option><option value="pm"' + (state.paint.session === 'pm' ? ' selected' : '') + '>Chiều</option></select>' +
        '</div></div>' + (state.paint.code ? '<div class="paint-hint">Đang chấm nhanh: <b>' + esc(state.paint.code + ' – ' + codeLabel(state.paint.code)) + '</b> (' + sessionLabel(state.paint.session) + '). Bấm vào ô để ghi; bấm "Mở chi tiết" để tắt.</div>' : '') + '</div>';
      if (!data.rows.length) {
        return html + '<div class="card"><div class="empty">Chưa có viên chức. <a data-go="staff">Thêm viên chức</a></div></div>';
      }
      html += '<div class="card p0"><div class="ts-wrap"><table class="ts" id="tsTable"><thead><tr>' +
        '<th class="sticky c-stt" rowspan="2">STT</th><th class="sticky c-name" rowspan="2">Họ và tên</th>';
      data.days.forEach(function (dd) {
        html += '<th class="' + (dd.off ? (dd.hol && dd.wd !== 0 && dd.wd !== 6 ? 'hol' : 'off') : '') + (dd.s === Q.todayYmd() ? ' today' : '') + '" title="' + esc(Q.WD_LONG[dd.wd] + (dd.hol ? ' – ' + dd.hol : '')) + '">' + dd.d + '</th>';
      });
      html += '<th class="tot" colspan="6">Tổng hợp (ngày)</th></tr><tr>';
      data.days.forEach(function (dd) {
        html += '<th class="wd ' + (dd.off ? (dd.hol && dd.wd !== 0 && dd.wd !== 6 ? 'hol' : 'off') : '') + '">' + Q.WD_SHORT[dd.wd] + '</th>';
      });
      html += '<th class="tot" title="Đi làm + Công tác + Học tập">Làm việc</th><th class="tot" title="Nghỉ phép">P</th><th class="tot" title="Nghỉ bù">NB</th><th class="tot" title="Ốm, con ốm, thai sản, tai nạn">BHXH</th><th class="tot" title="Không lương, không phép">KL</th><th class="tot strong" title="Tổng số ngày hưởng lương">Hưởng lương</th></tr></thead><tbody>';
      data.rows.forEach(function (r, i) {
        html += '<tr><td class="sticky c-stt">' + (i + 1) + '</td><td class="sticky c-name"><b>' + esc(r.staff.name) + '</b><div class="muted small">' + esc(r.staff.position || '') + '</div></td>';
        r.cells.forEach(function (c, di) {
          var title = Q.fmtDate(c.date) + ' – ' + r.staff.name;
          if (c.am || c.pm) title += '\nSáng: ' + (c.am ? codeLabel(c.am) : '—') + '\nChiều: ' + (c.pm ? codeLabel(c.pm) : '—');
          if (c.holiday) title += '\n' + c.holiday;
          if (c.note) title += '\nGhi chú: ' + c.note;
          if (c.bonus) title += '\nĐược cộng ' + c.bonus + ' ngày bù';
          html += '<td class="cell ' + cellClass(c) + '" data-s="' + r.staff.id + '" data-d="' + c.date + '" title="' + esc(title) + '">' + esc(cellText(c)) +
            (c.note ? '<i class="note-dot"></i>' : '') + (c.bonus ? '<i class="bonus-dot"></i>' : '') + '</td>';
        });
        var st = r.st;
        html += '<td class="tot">' + Q.fmtNum(st.work) + '</td><td class="tot">' + Q.fmtNum(st.counts.P) + '</td><td class="tot">' + Q.fmtNum(st.counts.NB) +
          '</td><td class="tot">' + Q.fmtNum(st.bhxh) + '</td><td class="tot">' + Q.fmtNum(st.unpaid) + '</td><td class="tot strong">' + Q.fmtNum0(st.totalWithBonus) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      html += legendHtml();
      return html;
    },
    bind: function () {
      var f = $('#tsFilter');
      f.addEventListener('input', function () {
        state.tsFilter = f.value;
        var pos = f.selectionStart;
        render();
        var nf = $('#tsFilter'); nf.focus(); nf.setSelectionRange(pos, pos);
      });
      $all('[data-paint]').forEach(function (b) {
        b.addEventListener('click', function () { state.paint.code = b.getAttribute('data-paint') || null; render(); });
      });
      $('#paintSession').addEventListener('change', function () { state.paint.session = this.value; render(); });
      $('#tsPrint').addEventListener('click', function () { printTimesheet(); });
      $('#tsExcel').addEventListener('click', function () { exportTimesheetExcel(); });
      var t = $('#tsTable');
      if (t) t.addEventListener('click', function (e) {
        var td = e.target.closest('td.cell');
        if (!td) return;
        var sid = td.getAttribute('data-s'), d = td.getAttribute('data-d');
        if (state.paint.code) {
          if (!Q.isWorkingDay(d, S.data.settings) && state.paint.code !== '+') {
            toast('Ngày ' + Q.fmtDate(d) + ' là ngày nghỉ. Mở chi tiết ô để chấm làm thêm / cộng bù.', 'err');
            return;
          }
          if (!Q.isWorkingDay(d, S.data.settings)) { openCellModal(sid, d); return; }
          S.setSession(d, sid, state.paint.session, state.paint.code);
          S.save();
          render();
        } else openCellModal(sid, d);
      });
    }
  };

  function legendHtml() {
    return '<div class="card legend"><b>Ký hiệu:</b> ' + Q.CODES.map(function (c) {
      return '<span class="lg">' + badge(c.code) + ' ' + esc(c.label) + '</span>';
    }).join('') + '<span class="lg"><span class="code-badge mixd">P/+</span> Sáng / Chiều khác nhau</span>' +
      '<span class="lg"><i class="note-dot static"></i> Có ghi chú</span><span class="lg"><i class="bonus-dot static"></i> Có cộng ngày bù</span></div>';
  }

  function openCellModal(staffId, d) {
    var s = S.getStaff(staffId);
    var c = Q.dayCell(S.data, staffId, d);
    var rec = S.getRecord(d, staffId) || { am: '', pm: '', note: '' };
    var working = Q.isWorkingDay(d, S.data.settings);
    var hol = Q.holidayName(d, S.data.settings);
    var bonuses = S.data.bonus.filter(function (b) { return b.staffId === staffId && b.date === d; });
    var am = working ? (c.am || '+') : (rec.am || '');
    var pm = working ? (c.pm || '+') : (rec.pm || '');
    var extra = working ? [] : [['', '— Nghỉ (không chấm) —']];
    var body = '<div class="cell-info"><b>' + esc(s.name) + '</b> · ' + Q.WD_LONG[Q.weekday(d)] + ', ' + Q.fmtDate(d) +
      (hol ? ' · <span class="tag hol">' + esc(hol) + '</span>' : '') + (!working && !hol ? ' · <span class="tag off">Ngày nghỉ</span>' : '') + '</div>' +
      '<div class="quick-codes">' + [['+', 'Đi làm']].concat(Q.CODES.filter(function (x) { return x.code !== '+' && x.code !== 'L'; }).map(function (x) { return [x.code, x.short]; })).map(function (x) {
        return '<button class="pbtn g-' + groupOf(x[0]) + '" data-qc="' + esc(x[0]) + '" title="Cả ngày: ' + esc(codeLabel(x[0])) + '">' + esc(x[0]) + '<small>' + esc(x[1]) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="form-grid"><label>Buổi sáng<select id="cmAm">' + codeOptions(am, extra) + '</select></label>' +
      '<label>Buổi chiều<select id="cmPm">' + codeOptions(pm, extra) + '</select></label>' +
      '<label class="span2">Ghi chú<input id="cmNote" value="' + esc(rec.note || '') + '" placeholder="Số quyết định, lý do..."></label></div>';
    if (!working) {
      body += '<label class="check"><input type="checkbox" id="cmBonus"' + (bonuses.length ? '' : ' checked') + '> Cộng ngày bù tương ứng khi chấm làm việc vào ngày nghỉ</label>';
    }
    if (bonuses.length) {
      body += '<div class="alert info small">Ngày này đã được cộng bù: ' + bonuses.map(function (b) {
        return '<b>' + Q.fmtNum0(b.amount) + '</b> ngày' + (b.reason ? ' (' + esc(b.reason.slice(0, 60)) + ')' : '');
      }).join('; ') + '</div>';
    }
    var foot = '<button class="btn btn-ghost" id="cmReset">Về mặc định</button><div class="spacer"></div>' +
      '<button class="btn" data-close>Đóng</button><button class="btn btn-primary" id="cmSave">Lưu</button>';
    Modal.open('Chấm công chi tiết', body, foot);
    $all('[data-qc]').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#cmAm').value = b.getAttribute('data-qc'); $('#cmPm').value = b.getAttribute('data-qc');
      });
    });
    $('#cmReset').addEventListener('click', function () {
      S.setRecord(d, staffId, null); S.save(); Modal.close(); render(); toast('Đã đưa ô về mặc định.');
    });
    $('#cmSave').addEventListener('click', function () {
      var a = $('#cmAm').value, p = $('#cmPm').value, note = $('#cmNote').value.trim();
      S.setRecord(d, staffId, { am: a, pm: p, note: note });
      if (!working) {
        var cb = $('#cmBonus');
        var workCodes = ['+', 'CT', 'H'];
        var amt = (workCodes.indexOf(a) >= 0 ? 0.5 : 0) + (workCodes.indexOf(p) >= 0 ? 0.5 : 0);
        if (cb && cb.checked && amt > 0) {
          S.addBonus({ staffId: staffId, date: d, amount: amt, reason: 'Làm việc ngày nghỉ ' + Q.fmtDate(d) + (note ? ' – ' + note : ''), source: 'cell' });
          toast('Đã cộng ' + Q.fmtNum0(amt) + ' ngày bù.');
        }
      }
      S.save(); Modal.close(); render();
    });
  }

  /* ================= In ấn & Xuất Excel ================= */
  function headerBlock(title, sub) {
    var st = S.data.settings;
    return '<table class="ph"><tr><td class="ph-l"><div>' + esc((st.parentUnit || '').toUpperCase()) + '</div><div><b>' + esc((st.unitName || 'ĐƠN VỊ').toUpperCase()) + '</b></div>' +
      (st.department ? '<div>Bộ phận: ' + esc(st.department) + '</div>' : '') + '</td>' +
      '<td class="ph-r"><div><b>Mẫu số C01-HD</b></div><div class="small"><i>(Ban hành kèm theo Thông tư số 107/2017/TT-BTC ngày 10/10/2017 của Bộ Tài chính)</i></div></td></tr></table>' +
      '<h2 class="p-title">' + esc(title) + '</h2><div class="p-sub">' + esc(sub) + '</div>';
  }
  function signBlock() {
    var st = S.data.settings, sg = st.signers || {};
    var t = new Date();
    return '<div class="p-date"><i>' + esc(st.location || '…………') + ', ngày ' + t.getDate() + ' tháng ' + (t.getMonth() + 1) + ' năm ' + t.getFullYear() + '</i></div>' +
      '<table class="signs"><tr><td><b>NGƯỜI CHẤM CÔNG</b><div class="small"><i>(Ký, họ tên)</i></div><div class="sname">' + esc(sg.maker) + '</div></td>' +
      '<td><b>PHỤ TRÁCH BỘ PHẬN</b><div class="small"><i>(Ký, họ tên)</i></div><div class="sname">' + esc(sg.head) + '</div></td>' +
      '<td><b>THỦ TRƯỞNG ĐƠN VỊ</b><div class="small"><i>(Ký, họ tên, đóng dấu)</i></div><div class="sname">' + esc(sg.director) + '</div></td></tr></table>';
  }
  function legendPrint() {
    return '<div class="p-legend"><b>Ký hiệu chấm công:</b> ' + Q.CODES.map(function (c) { return c.label + ': <b>' + c.code + '</b>'; }).join('; ') + '.</div>';
  }
  function timesheetTableExport(xls) {
    var data = timesheetData('');
    var bd = xls ? ' border="1"' : '';
    var th = xls ? ' style="background:#dbeafe;font-weight:bold;text-align:center"' : '';
    var offS = xls ? ' style="background:#e5e7eb;text-align:center"' : ' class="off"';
    var html = '<table class="pt"' + bd + '><thead><tr><th rowspan="2"' + th + '>STT</th><th rowspan="2"' + th + '>Họ và tên</th><th rowspan="2"' + th + '>Chức vụ</th>' +
      '<th colspan="' + data.days.length + '"' + th + '>Ngày trong tháng</th><th colspan="6"' + th + '>Quy ra công</th></tr><tr>';
    data.days.forEach(function (dd) { html += '<th' + (dd.off ? offS : th) + '>' + dd.d + '<br>' + Q.WD_SHORT[dd.wd] + '</th>'; });
    ['Số công làm việc', 'Nghỉ phép', 'Nghỉ bù', 'Hưởng BHXH', 'Không lương', 'Tổng hưởng lương'].forEach(function (h) { html += '<th' + th + '>' + h + '</th>'; });
    html += '</tr></thead><tbody>';
    data.rows.forEach(function (r, i) {
      var cst = xls ? ' style="text-align:center"' : '';
      html += '<tr><td' + cst + '>' + (i + 1) + '</td><td>' + esc(r.staff.name) + '</td><td>' + esc(r.staff.position || '') + '</td>';
      r.cells.forEach(function (c) {
        html += '<td' + (c.offday ? offS : cst) + '>' + esc(cellText(c)) + '</td>';
      });
      var st = r.st;
      var num = xls ? ' style="text-align:center;mso-number-format:\'0.0\'"' : ' class="num"';
      html += '<td' + num + '>' + st.work + '</td><td' + num + '>' + st.counts.P + '</td><td' + num + '>' + st.counts.NB + '</td><td' + num + '>' + st.bhxh +
        '</td><td' + num + '>' + st.unpaid + '</td><td' + num + '><b>' + st.totalWithBonus + '</b></td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  function doPrint(inner) {
    $('#printArea').innerHTML = inner;
    document.body.classList.add('printing');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('printing'); }, 300);
    }, 50);
  }
  function printTimesheet() {
    doPrint(headerBlock('BẢNG CHẤM CÔNG', 'Tháng ' + state.month + ' năm ' + state.year) + timesheetTableExport(false) + legendPrint() + signBlock());
  }
  function xlsWrap(title, inner) {
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">' +
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>' + esc(title) + '</x:Name><x:WorksheetOptions><x:Print><x:ValidPrinterInfo/><x:Landscape/></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
      '<style>td,th{font-family:"Times New Roman";font-size:11pt;vertical-align:middle} .c{text-align:center}</style></head><body>' + inner + '</body></html>';
  }
  function xlsHeader(title, sub, cols) {
    var st = S.data.settings;
    return '<table><tr><td colspan="' + Math.ceil(cols / 2) + '">' + esc((st.parentUnit || '').toUpperCase()) + '</td><td colspan="' + Math.floor(cols / 2) + '" style="text-align:right"><b>Mẫu số C01-HD</b></td></tr>' +
      '<tr><td colspan="' + cols + '"><b>' + esc((st.unitName || '').toUpperCase()) + '</b></td></tr>' +
      '<tr><td colspan="' + cols + '" style="text-align:center;font-size:16pt"><b>' + esc(title) + '</b></td></tr>' +
      '<tr><td colspan="' + cols + '" style="text-align:center"><i>' + esc(sub) + '</i></td></tr><tr><td></td></tr></table>';
  }
  function xlsSign(cols) {
    var sg = S.data.settings.signers || {};
    var w = Math.floor(cols / 3);
    return '<table><tr><td></td></tr><tr><td colspan="' + w + '" style="text-align:center"><b>NGƯỜI CHẤM CÔNG</b></td><td colspan="' + w + '" style="text-align:center"><b>PHỤ TRÁCH BỘ PHẬN</b></td><td colspan="' + (cols - 2 * w) + '" style="text-align:center"><b>THỦ TRƯỞNG ĐƠN VỊ</b></td></tr>' +
      '<tr><td colspan="' + w + '" style="text-align:center"><i>(Ký, họ tên)</i></td><td colspan="' + w + '" style="text-align:center"><i>(Ký, họ tên)</i></td><td colspan="' + (cols - 2 * w) + '" style="text-align:center"><i>(Ký, họ tên, đóng dấu)</i></td></tr>' +
      '<tr><td></td></tr><tr><td></td></tr><tr><td></td></tr><tr><td colspan="' + w + '" style="text-align:center"><b>' + esc(sg.maker) + '</b></td><td colspan="' + w + '" style="text-align:center"><b>' + esc(sg.head) + '</b></td><td colspan="' + (cols - 2 * w) + '" style="text-align:center"><b>' + esc(sg.director) + '</b></td></tr></table>';
  }
  function exportTimesheetExcel() {
    var cols = 3 + Q.daysInMonth(state.year, state.month) + 6;
    var html = xlsHeader('BẢNG CHẤM CÔNG', 'Tháng ' + state.month + ' năm ' + state.year, cols) + timesheetTableExport(true) +
      '<table><tr><td colspan="' + cols + '"><i>' + esc('Ký hiệu: ' + Q.CODES.map(function (c) { return c.code + ' = ' + c.label; }).join('; ')) + '</i></td></tr></table>' + xlsSign(cols);
    download('BangChamCong_T' + Q.pad(state.month) + '_' + state.year + '.xls', xlsWrap('T' + state.month + '-' + state.year, html), 'application/vnd.ms-excel;charset=utf-8');
    toast('Đã xuất file Excel.');
  }

  /* ================= VIEW: Thống kê tổng hợp ================= */
  var SUM_COLS = ['+', 'CT', 'H', 'P', 'NB', 'L', 'R', 'Ô', 'Cô', 'TS', 'T', 'Ro', 'KP'];
  function summaryMonthRows() {
    var y = state.year, m = state.month, last = Q.ymd(y, m, Q.daysInMonth(y, m));
    return S.activeStaff().map(function (s) {
      var st = Q.monthStats(S.data, s.id, y, m);
      return { s: s, st: st, bal: Q.bonusBalance(S.data, s.id, last), leave: Q.annualLeave(S.data, s, y) };
    });
  }
  function summaryYearRows() {
    var y = state.year;
    return S.activeStaff().map(function (s) {
      var months = [];
      for (var m = 1; m <= 12; m++) months.push(Q.monthStats(S.data, s.id, y, m));
      var yr = Q.rangeStats(S.data, s.id, Q.ymd(y, 1, 1), Q.ymd(y, 12, 31));
      return { s: s, months: months, yr: yr, bal: Q.bonusBalance(S.data, s.id, Q.ymd(y, 12, 31)), leave: Q.annualLeave(S.data, s, y) };
    });
  }
  function summaryMonthTable(xls) {
    var rows = summaryMonthRows();
    var bd = xls ? ' border="1"' : '';
    var th = xls ? ' style="background:#dbeafe;font-weight:bold;text-align:center"' : '';
    var c = xls ? ' style="text-align:center"' : ' class="num"';
    var addB = S.data.settings.addBonusToTotal;
    var html = '<table class="table sum pt"' + bd + '><thead><tr><th rowspan="2"' + th + '>STT</th><th rowspan="2"' + th + '>Họ và tên</th><th rowspan="2"' + th + '>Chức vụ</th><th rowspan="2"' + th + '>Công chuẩn</th>' +
      '<th colspan="3"' + th + '>Làm việc</th><th colspan="4"' + th + '>Nghỉ hưởng lương</th><th colspan="4"' + th + '>Nghỉ hưởng BHXH</th><th colspan="2"' + th + '>Không lương</th>' +
      '<th rowspan="2"' + th + '>Tổng hưởng lương' + (addB ? ' (gồm bù)' : '') + '</th><th colspan="3"' + th + '>Ngày bù</th><th colspan="2"' + th + '>Phép năm ' + state.year + '</th></tr><tr>';
    SUM_COLS.forEach(function (k) { html += '<th' + th + ' title="' + esc(codeLabel(k)) + '">' + esc(k) + '</th>'; });
    html += '<th' + th + '>Phát sinh</th><th' + th + '>Đã nghỉ</th><th' + th + '>Còn tồn</th><th' + th + '>Đã nghỉ</th><th' + th + '>Còn lại</th></tr></thead><tbody>';
    var tot = {}; SUM_COLS.forEach(function (k) { tot[k] = 0; });
    var tTotal = 0, tEarn = 0, tUsed = 0, tBal = 0;
    rows.forEach(function (r, i) {
      html += '<tr><td' + c + '>' + (i + 1) + '</td><td><b>' + esc(r.s.name) + '</b></td><td>' + esc(r.s.position || '') + '</td><td' + c + '>' + r.st.std + '</td>';
      SUM_COLS.forEach(function (k) { tot[k] += r.st.counts[k]; html += '<td' + c + '>' + (xls ? (r.st.counts[k] || '') : Q.fmtNum(r.st.counts[k])) + '</td>'; });
      tTotal += r.st.totalWithBonus; tEarn += r.st.bonusEarned; tUsed += r.st.bonusUsed; tBal += r.bal.balance;
      html += '<td' + c + '><b>' + (xls ? r.st.totalWithBonus : Q.fmtNum0(r.st.totalWithBonus)) + '</b></td>' +
        '<td' + c + '>' + (xls ? (r.st.bonusEarned || '') : Q.fmtNum(r.st.bonusEarned)) + '</td><td' + c + '>' + (xls ? (r.st.bonusUsed || '') : Q.fmtNum(r.st.bonusUsed)) + '</td>' +
        '<td' + c + '><b class="' + (r.bal.balance < 0 ? 'neg' : '') + '">' + (xls ? r.bal.balance : Q.fmtNum0(r.bal.balance)) + '</b></td>' +
        '<td' + c + '>' + (xls ? r.leave.used : Q.fmtNum0(r.leave.used)) + '</td><td' + c + '><b class="' + (r.leave.remain < 0 ? 'neg' : '') + '">' + (xls ? r.leave.remain : Q.fmtNum0(r.leave.remain)) + '</b></td></tr>';
    });
    if (rows.length) {
      var tc = xls ? ' style="text-align:center;font-weight:bold;background:#f1f5f9"' : ' class="num"';
      html += '<tr class="total-row"><td' + tc + '></td><td' + tc + ' colspan="3">TỔNG CỘNG</td>';
      SUM_COLS.forEach(function (k) { html += '<td' + tc + '>' + (xls ? (tot[k] || '') : Q.fmtNum(tot[k])) + '</td>'; });
      html += '<td' + tc + '>' + (xls ? tTotal : Q.fmtNum0(tTotal)) + '</td><td' + tc + '>' + (xls ? tEarn : Q.fmtNum(tEarn)) + '</td><td' + tc + '>' + (xls ? tUsed : Q.fmtNum(tUsed)) + '</td><td' + tc + '>' + (xls ? tBal : Q.fmtNum0(tBal)) + '</td><td' + tc + '></td><td' + tc + '></td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }
  function summaryYearTable(xls) {
    var rows = summaryYearRows();
    var bd = xls ? ' border="1"' : '';
    var th = xls ? ' style="background:#dbeafe;font-weight:bold;text-align:center"' : '';
    var c = xls ? ' style="text-align:center"' : ' class="num"';
    var html = '<table class="table sum pt"' + bd + '><thead><tr><th rowspan="2"' + th + '>STT</th><th rowspan="2"' + th + '>Họ và tên</th>' +
      '<th colspan="12"' + th + '>Tổng ngày hưởng lương theo tháng</th><th rowspan="2"' + th + '>Cả năm</th><th rowspan="2"' + th + '>Công tác</th><th rowspan="2"' + th + '>Học tập</th><th colspan="3"' + th + '>Phép năm</th>' +
      '<th rowspan="2"' + th + '>Nghỉ BHXH</th><th rowspan="2"' + th + '>Không lương</th><th colspan="3"' + th + '>Ngày bù</th></tr><tr>';
    for (var m = 1; m <= 12; m++) html += '<th' + th + '>T' + m + '</th>';
    html += '<th' + th + '>Định mức</th><th' + th + '>Đã nghỉ</th><th' + th + '>Còn lại</th><th' + th + '>Phát sinh</th><th' + th + '>Đã nghỉ</th><th' + th + '>Tồn cuối năm</th></tr></thead><tbody>';
    var f = xls ? function (n) { return n || ''; } : Q.fmtNum;
    var f0 = xls ? function (n) { return n; } : Q.fmtNum0;
    rows.forEach(function (r, i) {
      html += '<tr><td' + c + '>' + (i + 1) + '</td><td><b>' + esc(r.s.name) + '</b></td>';
      r.months.forEach(function (st) { html += '<td' + c + '>' + f(st.totalWithBonus) + '</td>'; });
      var yr = r.yr;
      html += '<td' + c + '><b>' + f0(yr.totalWithBonus) + '</b></td><td' + c + '>' + f(yr.counts.CT) + '</td><td' + c + '>' + f(yr.counts.H) + '</td>' +
        '<td' + c + '>' + f0(r.leave.total) + '</td><td' + c + '>' + f(r.leave.used) + '</td><td' + c + '><b class="' + (r.leave.remain < 0 ? 'neg' : '') + '">' + f0(r.leave.remain) + '</b></td>' +
        '<td' + c + '>' + f(yr.bhxh) + '</td><td' + c + '>' + f(yr.unpaid) + '</td><td' + c + '>' + f(yr.bonusEarned) + '</td><td' + c + '>' + f(yr.bonusUsed) + '</td><td' + c + '><b class="' + (r.bal.balance < 0 ? 'neg' : '') + '">' + f0(r.bal.balance) + '</b></td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  Views.summary = {
    html: function () {
      var isMonth = state.summaryMode === 'month';
      var html = '<div class="card"><div class="row gap wrap"><div class="tabs">' +
        '<button class="tab' + (isMonth ? ' active' : '') + '" data-mode="month">Theo tháng (' + monthLabel(state.month, state.year) + ')</button>' +
        '<button class="tab' + (!isMonth ? ' active' : '') + '" data-mode="year">Theo năm ' + state.year + '</button></div><div class="spacer"></div>' +
        '<button class="btn" id="sumPrint">🖨 In</button><button class="btn btn-success" id="sumExcel">⬇ Xuất Excel</button></div></div>';
      if (!S.activeStaff().length) return html + '<div class="card"><div class="empty">Chưa có viên chức.</div></div>';
      html += '<div class="card p0"><div class="table-wrap">' + (isMonth ? summaryMonthTable(false) : summaryYearTable(false)) + '</div></div>';
      html += '<div class="card note small muted">' +
        '<b>Cách tính:</b> Công chuẩn = số ngày làm việc trong tháng (trừ thứ 7' + (S.data.settings.workSaturday ? ' – đang tính là ngày làm việc' : '') + ', Chủ nhật, ngày lễ). ' +
        'Tổng hưởng lương = Đi làm + Công tác + Học tập + Phép + Nghỉ bù + Lễ + Việc riêng có lương' + (S.data.settings.addBonusToTotal ? ' + Ngày bù phát sinh trong kỳ' : '') + '. ' +
        'Ngày làm thêm, trực vào ngày nghỉ được quy thành <b>ngày bù</b>; "Còn tồn" = tổng bù phát sinh – tổng đã nghỉ bù (lũy kế). ' +
        (S.data.settings.onlyToToday ? 'Các ngày sau hôm nay chưa được tính công.' : '') + '</div>';
      return html;
    },
    bind: function () {
      $all('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { state.summaryMode = b.getAttribute('data-mode'); render(); }); });
      $('#sumPrint').addEventListener('click', function () {
        var isMonth = state.summaryMode === 'month';
        doPrint(headerBlock(isMonth ? 'BẢNG TỔNG HỢP NGÀY CÔNG' : 'BẢNG TỔNG HỢP NGÀY CÔNG NĂM', isMonth ? 'Tháng ' + state.month + ' năm ' + state.year : 'Năm ' + state.year) +
          (isMonth ? summaryMonthTable(false) : summaryYearTable(false)) + legendPrint() + signBlock());
      });
      $('#sumExcel').addEventListener('click', function () {
        var isMonth = state.summaryMode === 'month';
        var cols = isMonth ? 26 : 25;
        var html = xlsHeader(isMonth ? 'BẢNG TỔNG HỢP NGÀY CÔNG' : 'BẢNG TỔNG HỢP NGÀY CÔNG NĂM', isMonth ? 'Tháng ' + state.month + ' năm ' + state.year : 'Năm ' + state.year, cols) +
          (isMonth ? summaryMonthTable(true) : summaryYearTable(true)) + xlsSign(cols);
        download((isMonth ? 'TongHop_T' + Q.pad(state.month) + '_' : 'TongHop_Nam_') + state.year + '.xls', xlsWrap('Tong hop', html), 'application/vnd.ms-excel;charset=utf-8');
        toast('Đã xuất file Excel.');
      });
    }
  };

  /* ================= VIEW: Ngày bù ================= */
  Views.bonus = {
    html: function () {
      var staff = S.activeStaff();
      var y = state.year, m = state.month;
      var last = Q.ymd(y, m, Q.daysInMonth(y, m));
      var defDate = (Q.todayYmd().slice(0, 7) === Q.ymd(y, m, 1).slice(0, 7)) ? Q.todayYmd() : Q.ymd(y, m, 1);
      var html = '<div class="grid-2">';
      html += '<div class="card"><div class="card-head"><h3>⊕ Cộng thêm ngày bù</h3><div class="muted small">Dùng khi viên chức trực, làm thêm ngày nghỉ, hoặc được cơ quan cho bù.</div></div>' +
        '<div class="form-grid">' +
        '<label class="span2">Viên chức<select id="bnStaff"><option value="__all">— Tất cả viên chức đang làm việc —</option>' +
        staff.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + (s.position ? ' – ' + esc(s.position) : '') + '</option>'; }).join('') + '</select></label>' +
        '<label>Ngày phát sinh<input type="date" id="bnDate" value="' + defDate + '"></label>' +
        '<label>Số ngày bù<input type="number" id="bnAmount" step="0.5" min="0.5" value="1"></label>' +
        '<label class="span2">Lý do<input id="bnReason" placeholder="VD: Trực cơ quan thứ 7; Làm thêm phục vụ hội nghị..."></label>' +
        '</div><div class="row gap mt"><button class="btn btn-primary" id="bnAdd">⊕ Cộng ngày bù</button></div>' +
        '<div class="muted small mt">Để <b>sử dụng</b> ngày bù, chấm ký hiệu <b>NB</b> (nghỉ bù) trong Bảng chấm công hoặc ghi "nghỉ bù" trong văn bản.</div></div>';

      html += '<div class="card"><div class="card-head"><h3>Số dư ngày bù đến hết ' + monthLabel(m, y) + '</h3></div>';
      if (!staff.length) html += '<div class="empty">Chưa có viên chức.</div>';
      else {
        html += '<table class="table compact"><thead><tr><th>Viên chức</th><th class="num">Phát sinh</th><th class="num">Đã nghỉ bù</th><th class="num">Còn tồn</th></tr></thead><tbody>' +
          staff.map(function (s) {
            var b = Q.bonusBalance(S.data, s.id, last);
            return '<tr><td>' + esc(s.name) + '</td><td class="num">' + Q.fmtNum0(b.earned) + '</td><td class="num">' + Q.fmtNum0(b.used) + '</td><td class="num"><b class="' + (b.balance < 0 ? 'neg' : b.balance > 0 ? 'pos' : '') + '">' + Q.fmtNum0(b.balance) + '</b></td></tr>';
          }).join('') + '</tbody></table>';
      }
      html += '</div></div>';

      var scopeYear = state.bonusScope === 'year';
      var list = S.data.bonus.filter(function (b) {
        return scopeYear ? b.date.slice(0, 4) === String(y) : b.date.slice(0, 7) === Q.ymd(y, m, 1).slice(0, 7);
      }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      html += '<div class="card"><div class="card-head row"><h3>Danh sách ngày bù đã cộng</h3><div class="spacer"></div><div class="tabs sm">' +
        '<button class="tab' + (!scopeYear ? ' active' : '') + '" data-bscope="month">' + monthLabel(m, y) + '</button>' +
        '<button class="tab' + (scopeYear ? ' active' : '') + '" data-bscope="year">Năm ' + y + '</button></div></div>';
      if (!list.length) html += '<div class="empty">Chưa có ngày bù nào trong kỳ.</div>';
      else {
        html += '<table class="table compact"><thead><tr><th>Ngày</th><th>Viên chức</th><th class="num">Số ngày</th><th>Lý do</th><th>Nguồn</th><th></th></tr></thead><tbody>' +
          list.map(function (b) {
            var s = S.getStaff(b.staffId);
            return '<tr><td class="nowrap">' + Q.WD_SHORT[Q.weekday(b.date)] + ', ' + Q.fmtDate(b.date) + '</td><td>' + esc(s ? s.name : '(đã xoá)') + '</td><td class="num"><b>' + Q.fmtNum0(b.amount) + '</b></td><td class="clip">' + esc(b.reason) + '</td>' +
              '<td><span class="tag">' + (b.source === 'text' ? 'Văn bản' : b.source === 'cell' ? 'Bảng công' : 'Nhập tay') + '</span></td>' +
              '<td class="right"><button class="btn btn-xs btn-danger-ghost" data-delbonus="' + b.id + '">Xoá</button></td></tr>';
          }).join('') + '</tbody></table>';
      }
      html += '</div>';
      return html;
    },
    bind: function () {
      var add = $('#bnAdd');
      if (add) add.addEventListener('click', function () {
        var sid = $('#bnStaff').value, d = $('#bnDate').value, amt = parseFloat($('#bnAmount').value), reason = $('#bnReason').value.trim();
        if (!d) { toast('Chọn ngày phát sinh.', 'err'); return; }
        if (!(amt > 0)) { toast('Số ngày bù phải lớn hơn 0.', 'err'); return; }
        var ids = sid === '__all' ? S.activeStaff().map(function (s) { return s.id; }) : [sid];
        if (!ids.length) { toast('Chưa có viên chức.', 'err'); return; }
        if (sid === '__all' && !confirmBox('Cộng ' + amt + ' ngày bù cho tất cả ' + ids.length + ' viên chức?')) return;
        ids.forEach(function (id) { S.addBonus({ staffId: id, date: d, amount: amt, reason: reason, source: 'manual' }); });
        S.save();
        toast('Đã cộng ' + Q.fmtNum0(amt) + ' ngày bù cho ' + ids.length + ' viên chức.');
        render();
      });
      $all('[data-bscope]').forEach(function (b) { b.addEventListener('click', function () { state.bonusScope = b.getAttribute('data-bscope'); render(); }); });
      $all('[data-delbonus]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirmBox('Xoá mục ngày bù này?')) return;
          S.removeBonus(b.getAttribute('data-delbonus')); S.save(); toast('Đã xoá.'); render();
        });
      });
    }
  };

  /* ================= VIEW: Chấm nghỉ theo ngày (tích chọn) ================= */
  function dayRowFromRecord(date, staffId) {
    var rec = S.getRecord(date, staffId);
    var am = rec && rec.am && rec.am !== '+' ? rec.am : '';
    var pm = rec && rec.pm && rec.pm !== '+' ? rec.pm : '';
    if (am && pm && am === pm) return { checked: true, session: 'full', code: am };
    if (am && !pm) return { checked: true, session: 'am', code: am };
    if (!am && pm) return { checked: true, session: 'pm', code: pm };
    if (am && pm) return { checked: true, session: 'mixed', code: am, pmCode: pm };
    return { checked: false, session: 'full', code: state.dayCode };
  }
  function buildDayDraft() {
    var draft = {}, orig = {};
    S.activeStaff().forEach(function (s) {
      orig[s.id] = dayRowFromRecord(state.dayDate, s.id);
      draft[s.id] = Object.assign({}, orig[s.id]);
    });
    state.dayDraft = { date: state.dayDate, rows: draft, orig: orig };
  }
  function rowLeaveDays(r) {
    if (!r || !r.checked) return 0;
    if (r.session === 'mixed') return (r.code === 'P' ? 0.5 : 0) + (r.pmCode === 'P' ? 0.5 : 0);
    if (r.code !== 'P') return 0;
    return r.session === 'full' ? 1 : 0.5;
  }
  function rowChanged(a, b) {
    if (a.checked !== b.checked) return true;
    if (!a.checked) return false;
    return a.session !== b.session || a.code !== b.code || a.pmCode !== b.pmCode;
  }
  function dayRangeDates() {
    var list = [state.dayDate];
    if (state.dayTo && state.dayTo > state.dayDate) {
      for (var d = Q.addDays(state.dayDate, 1), g = 0; d <= state.dayTo && g < 120; d = Q.addDays(d, 1), g++) {
        if (Q.isWorkingDay(d, S.data.settings)) list.push(d);
      }
    }
    return list;
  }

  Views.daily = {
    html: function () {
      if (!state.dayDate) {
        var t = Q.todayYmd();
        state.dayDate = t.slice(0, 7) === Q.ymd(state.year, state.month, 1).slice(0, 7) ? t : Q.ymd(state.year, state.month, 1);
      }
      if (!state.dayDraft || state.dayDraft.date !== state.dayDate) buildDayDraft();
      var d = state.dayDate, y = +d.slice(0, 4);
      var working = Q.isWorkingDay(d, S.data.settings);
      var hol = Q.holidayName(d, S.data.settings);
      var staff = S.activeStaff();
      var f = Q.nameKey(state.dayFilter || '');
      var rows = state.dayDraft.rows, orig = state.dayDraft.orig;
      var dates = dayRangeDates();
      var nDays = dates.length;

      var html = '<div class="card day-toolbar"><div class="row gap wrap">' +
        '<div class="day-pick"><button class="btn-icon" id="dayPrev" title="Ngày làm việc trước">‹</button>' +
        '<input type="date" id="dayDate" value="' + d + '"><button class="btn-icon" id="dayNext" title="Ngày làm việc sau">›</button>' +
        '<button class="btn btn-ghost btn-sm" id="dayToday">Hôm nay</button></div>' +
        '<div class="day-title"><b>' + Q.WD_LONG[Q.weekday(d)] + ', ' + Q.fmtDate(d) + '</b>' +
        (hol ? ' <span class="tag hol">' + esc(hol) + '</span>' : (!working ? ' <span class="tag off">Ngày nghỉ</span>' : '')) + '</div>' +
        '<div class="spacer"></div>' +
        '<label class="inline-field">Nghỉ nhiều ngày, đến hết ngày <input type="date" id="dayTo" value="' + esc(state.dayTo || '') + '" min="' + d + '"></label>' +
        '</div><div class="row gap wrap mt">' +
        '<label class="inline-field nomargin">Loại nghỉ khi tích chọn <select id="dayCode">' + codeOptions(state.dayCode).replace(/<option value="\+"[^>]*>[^<]*<\/option>/, '') + '</select></label>' +
        '<input type="search" id="dayFilter" placeholder="🔍 Tìm viên chức..." value="' + esc(state.dayFilter || '') + '">' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-sm" id="dayAllFull">☑ Chọn tất cả (cả ngày)</button>' +
        '<button class="btn btn-sm btn-ghost" id="dayNone">☐ Bỏ chọn tất cả</button></div>' +
        (nDays > 1 ? '<div class="paint-hint">Các viên chức được tích sẽ được ghi nghỉ <b>' + nDays + ' ngày làm việc</b> từ ' + Q.fmtDate(d) + ' đến ' + Q.fmtDate(state.dayTo) + ' (tự bỏ qua thứ bảy, chủ nhật, ngày lễ).</div>' : '') +
        '</div>';

      if (!staff.length) return html + '<div class="card"><div class="empty">Chưa có viên chức. <a data-go="staff">Thêm viên chức</a></div></div>';
      if (!working) {
        return html + '<div class="card"><div class="empty">Ngày ' + Q.fmtDate(d) + ' là ' + (hol ? 'ngày lễ (' + esc(hol) + ')' : 'ngày nghỉ cuối tuần') +
          ', không cần chấm nghỉ.<br>Chọn ngày khác, hoặc vào <a data-go="bonus">Ngày bù</a> nếu có người trực / làm thêm.</div></div>';
      }

      var nChecked = 0, nChanged = 0;
      html += '<div class="card p0"><div class="table-wrap"><table class="table day-table"><thead><tr>' +
        '<th class="w40"></th><th>STT</th><th>Họ và tên</th><th>Nghỉ buổi nào?</th><th>Loại nghỉ</th><th>Trước đó</th><th class="num">Phép năm ' + y + ' còn lại</th></tr></thead><tbody>';
      staff.forEach(function (s, i) {
        var r = rows[s.id], o = orig[s.id];
        if (r.checked) nChecked++;
        var changed = rowChanged(r, o);
        if (changed) nChanged++;
        if (f && Q.nameKey(s.name + ' ' + (s.position || '')).indexOf(f) < 0) return;
        var al = Q.annualLeave(S.data, s, y);
        var delta = (rowLeaveDays(r) - rowLeaveDays(o)) * (r.checked && r.code === 'P' && r.session !== 'mixed' ? nDays : 1);
        if (nDays > 1 && r.checked && r.code === 'P' && r.session !== 'mixed') {
          delta = rowLeaveDays(r) * nDays - rowLeaveDays(o);
          // các ngày sau trong khoảng đã là phép thì không trừ lại
          dates.slice(1).forEach(function (dd) {
            var ro = dayRowFromRecord(dd, s.id);
            delta -= rowLeaveDays(ro);
          });
        }
        var after = al.remain - delta;
        var seg = function (val, label) {
          return '<button class="seg-btn' + (r.checked && r.session === val ? ' on' : '') + '" data-sess="' + val + '" data-sid="' + s.id + '">' + label + '</button>';
        };
        var prev = o.checked ? (o.session === 'mixed' ? badge(o.code) + ' sáng, ' + badge(o.pmCode) + ' chiều'
          : badge(o.code) + ' ' + sessionLabel(o.session).toLowerCase()) : '<span class="muted">Đi làm</span>';
        html += '<tr class="' + (r.checked ? 'on' : '') + (changed ? ' changed' : '') + '" data-sid="' + s.id + '">' +
          '<td><input type="checkbox" class="big-check" data-chk="' + s.id + '"' + (r.checked ? ' checked' : '') + '></td>' +
          '<td class="muted">' + (i + 1) + '</td>' +
          '<td><b>' + esc(s.name) + '</b><div class="muted small">' + esc(s.position || '') + '</div></td>' +
          '<td>' + (r.checked && r.session === 'mixed'
            ? '<span class="small">Sáng ' + badge(r.code) + ' · Chiều ' + badge(r.pmCode) + '</span> <button class="btn btn-xs" data-sess="full" data-sid="' + s.id + '">Đổi</button>'
            : '<div class="seg-group">' + seg('am', 'Sáng') + seg('pm', 'Chiều') + seg('full', 'Cả ngày') + '</div>') + '</td>' +
          '<td>' + (r.session === 'mixed' && r.checked ? '' : '<select data-code="' + s.id + '"' + (r.checked ? '' : ' class="dim"') + '>' +
            codeOptions(r.code).replace(/<option value="\+"[^>]*>[^<]*<\/option>/, '') + '</select>') + '</td>' +
          '<td class="small">' + prev + '</td>' +
          '<td class="num nowrap"><span class="' + (al.remain < 0 ? 'neg' : '') + '">' + Q.fmtNum0(al.remain) + '</span>' +
          (delta ? ' → <b class="' + (after < 0 ? 'neg' : 'pos') + '">' + Q.fmtNum0(after) + '</b>' : '') +
          '<div class="muted small">/ ' + Q.fmtNum0(al.total) + ' ngày</div></td></tr>';
      });
      html += '</tbody></table></div>' +
        '<div class="day-foot"><div><b>' + nChecked + '</b> viên chức nghỉ trong ngày' + (nChanged ? ' · <span class="warn-text">' + nChanged + ' thay đổi chưa lưu</span>' : '') + '</div><div class="spacer"></div>' +
        (nChanged ? '<button class="btn btn-ghost" id="dayReset">Huỷ thay đổi</button>' : '') +
        '<button class="btn btn-primary btn-lg" id="daySave"' + (nChanged || nDays > 1 ? '' : ' disabled') + '>✔ Lưu chấm nghỉ' + (nDays > 1 ? ' (' + nDays + ' ngày)' : ' ngày ' + Q.fmtDate(d).slice(0, 5)) + '</button></div></div>';
      html += '<div class="card small muted">Mẹo: tích ô vuông hoặc bấm <b>Sáng / Chiều / Cả ngày</b> để chọn người nghỉ. Bỏ tích = người đó đi làm bình thường. ' +
        'Nghỉ loại <b>P – Nghỉ phép</b> sẽ tự trừ vào số ngày phép năm (nhập ở mục <a data-go="leave">Phép năm</a>).</div>';
      return html;
    },
    bind: function () {
      function setDate(v) {
        if (!v) return;
        if (state.dayDraft && Object.keys(state.dayDraft.rows).some(function (k) { return rowChanged(state.dayDraft.rows[k], state.dayDraft.orig[k]); }) &&
          !confirmBox('Có thay đổi chưa lưu. Bỏ qua thay đổi và chuyển ngày?')) { render(); return; }
        state.dayDate = v; state.dayDraft = null;
        if (state.dayTo && state.dayTo <= v) state.dayTo = '';
        state.year = +v.slice(0, 4); state.month = +v.slice(5, 7);
        render();
      }
      function stepWorking(dir) {
        var d = state.dayDate;
        for (var i = 0; i < 14; i++) { d = Q.addDays(d, dir); if (Q.isWorkingDay(d, S.data.settings)) break; }
        setDate(d);
      }
      $('#dayDate').addEventListener('change', function () { setDate(this.value); });
      $('#dayPrev').addEventListener('click', function () { stepWorking(-1); });
      $('#dayNext').addEventListener('click', function () { stepWorking(1); });
      $('#dayToday').addEventListener('click', function () { setDate(Q.todayYmd()); });
      $('#dayTo').addEventListener('change', function () { state.dayTo = this.value; render(); });
      $('#dayCode').addEventListener('change', function () {
        state.dayCode = this.value;
        // áp dụng cho các dòng đang tích mà chưa có dữ liệu trước đó
        var rows = state.dayDraft.rows;
        Object.keys(rows).forEach(function (k) { if (!rows[k].checked) rows[k].code = state.dayCode; });
        render();
      });
      var f = $('#dayFilter');
      if (f) f.addEventListener('input', function () { state.dayFilter = f.value; var p = f.selectionStart; render(); var n = $('#dayFilter'); n.focus(); n.setSelectionRange(p, p); });
      if (!state.dayDraft || !$('.day-table')) return;
      var rows = state.dayDraft.rows;
      $all('[data-chk]').forEach(function (c) {
        c.addEventListener('change', function () {
          var r = rows[c.getAttribute('data-chk')];
          r.checked = c.checked;
          if (r.checked && r.session === 'mixed') { /* giữ nguyên */ }
          render();
        });
      });
      $all('[data-sess]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = rows[b.getAttribute('data-sid')];
          var v = b.getAttribute('data-sess');
          if (r.checked && r.session === v) r.checked = false;   // bấm lại để bỏ chọn
          else { r.checked = true; r.session = v; delete r.pmCode; if (!r.code || r.code === '+') r.code = state.dayCode; }
          render();
        });
      });
      $all('[data-code]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var r = rows[sel.getAttribute('data-code')];
          r.code = sel.value; r.checked = true; if (r.session === 'mixed') r.session = 'full';
          render();
        });
      });
      $('#dayAllFull').addEventListener('click', function () {
        Object.keys(rows).forEach(function (k) { var r = rows[k]; if (!r.checked) { r.checked = true; r.session = 'full'; r.code = state.dayCode; } });
        render();
      });
      $('#dayNone').addEventListener('click', function () {
        Object.keys(rows).forEach(function (k) { rows[k].checked = false; });
        render();
      });
      var rs = $('#dayReset');
      if (rs) rs.addEventListener('click', function () { buildDayDraft(); render(); });
      $('#daySave').addEventListener('click', function () {
        var dd = state.dayDraft, dates = dayRangeDates();
        var entries = [], negatives = [];
        var y = +state.dayDate.slice(0, 4);
        S.activeStaff().forEach(function (s) {
          var r = dd.rows[s.id], o = dd.orig[s.id];
          var changed = rowChanged(r, o);
          function push(date, session, code) { entries.push({ kind: 'att', staffId: s.id, staffName: s.name, date: date, session: session, code: code }); }
          function writeDay(date) {
            if (r.session === 'mixed') return;
            if (r.session === 'full') push(date, 'full', r.code);
            else if (r.session === 'am') { push(date, 'am', r.code); push(date, 'pm', '+'); }
            else { push(date, 'am', '+'); push(date, 'pm', r.code); }
          }
          if (changed) {
            if (r.checked) writeDay(dates[0]);
            else push(dates[0], 'full', '+');
          }
          if (r.checked && dates.length > 1) dates.slice(1).forEach(writeDay);
        });
        if (!entries.length) { toast('Không có thay đổi nào để lưu.', 'err'); return; }
        // Kiểm tra vượt phép năm
        var tmp = JSON.parse(JSON.stringify(S.data));
        var touched = {};
        entries.forEach(function (e) {
          touched[e.staffId] = 1;
          if (!tmp.records[e.date]) tmp.records[e.date] = {};
          var cur = tmp.records[e.date][e.staffId] || { am: '', pm: '' };
          var code = e.code === '+' ? '' : e.code;
          if (e.session !== 'pm') cur.am = code;
          if (e.session !== 'am') cur.pm = code;
          tmp.records[e.date][e.staffId] = cur;
        });
        Object.keys(touched).forEach(function (id) {
          var s = S.getStaff(id);
          var al = Q.annualLeave(tmp, s, y);
          var before = Q.annualLeave(S.data, s, y);
          if (al.remain < 0 && al.remain < before.remain) negatives.push(s.name + ' (còn ' + Q.fmtNum0(al.remain) + ' ngày)');
        });
        if (negatives.length && !confirmBox('Các viên chức sau sẽ VƯỢT số ngày phép năm ' + y + ':\n- ' + negatives.join('\n- ') + '\n\nVẫn lưu?')) return;
        var label = 'Chấm nghỉ theo ngày ' + Q.fmtDate(dates[0]) + (dates.length > 1 ? ' đến ' + Q.fmtDate(dates[dates.length - 1]) : '');
        S.applyEntries(entries, label);
        toast('Đã lưu chấm nghỉ ' + (dates.length > 1 ? dates.length + ' ngày.' : 'ngày ' + Q.fmtDate(dates[0]) + '.'));
        state.dayDraft = null; state.dayTo = '';
        render();
      });
    }
  };

  /* ================= VIEW: Phép năm ================= */
  function leaveRows(y) {
    return S.activeStaff().map(function (s) {
      var al = Q.annualLeave(S.data, s, y);
      var months = [];
      for (var m = 1; m <= 12; m++) months.push(Q.leaveUsed(S.data, s.id, Q.ymd(y, m, 1), Q.ymd(y, m, Q.daysInMonth(y, m))));
      return { s: s, al: al, months: months };
    });
  }
  function leaveTableExport(xls) {
    var y = state.year;
    var bd = xls ? ' border="1"' : '';
    var th = xls ? ' style="background:#dbeafe;font-weight:bold;text-align:center"' : '';
    var c = xls ? ' style="text-align:center"' : ' class="num"';
    var html = '<table class="table sum pt"' + bd + '><thead><tr><th rowspan="2"' + th + '>STT</th><th rowspan="2"' + th + '>Họ và tên</th><th rowspan="2"' + th + '>Chức vụ</th>' +
      '<th rowspan="2"' + th + '>Phép được hưởng</th><th rowspan="2"' + th + '>Năm trước chuyển sang</th><th rowspan="2"' + th + '>Tổng</th><th colspan="12"' + th + '>Số ngày đã nghỉ phép theo tháng</th>' +
      '<th rowspan="2"' + th + '>Đã nghỉ</th><th rowspan="2"' + th + '>Còn lại</th></tr><tr>';
    for (var m = 1; m <= 12; m++) html += '<th' + th + '>T' + m + '</th>';
    html += '</tr></thead><tbody>';
    leaveRows(y).forEach(function (r, i) {
      html += '<tr><td' + c + '>' + (i + 1) + '</td><td>' + esc(r.s.name) + '</td><td>' + esc(r.s.position || '') + '</td><td' + c + '>' + r.al.quota + '</td><td' + c + '>' + (r.al.carry || '') + '</td><td' + c + '>' + r.al.total + '</td>';
      r.months.forEach(function (v) { html += '<td' + c + '>' + (v || '') + '</td>'; });
      html += '<td' + c + '>' + r.al.used + '</td><td' + c + '><b>' + r.al.remain + '</b></td></tr>';
    });
    return html + '</tbody></table>';
  }
  function openLeaveDetail(staffId, y) {
    var s = S.getStaff(staffId);
    var list = [];
    Object.keys(S.data.records).sort().forEach(function (d) {
      if (d.slice(0, 4) !== String(y)) return;
      var r = S.data.records[d][staffId];
      if (!r || !Q.isWorkingDay(d, S.data.settings)) return;
      var a = r.am === 'P', p = r.pm === 'P';
      if (a || p) list.push({ d: d, s: a && p ? 'Cả ngày' : a ? 'Sáng' : 'Chiều', v: (a ? 0.5 : 0) + (p ? 0.5 : 0), note: r.note });
    });
    var al = Q.annualLeave(S.data, s, y);
    var body = '<div class="leave-sum"><div><span>Được hưởng</span><b>' + Q.fmtNum0(al.total) + '</b></div><div><span>Đã nghỉ</span><b>' + Q.fmtNum0(al.used) + '</b></div><div><span>Còn lại</span><b class="' + (al.remain < 0 ? 'neg' : 'pos') + '">' + Q.fmtNum0(al.remain) + '</b></div></div>' +
      (list.length ? '<table class="table compact mt"><thead><tr><th>Ngày</th><th>Buổi</th><th class="num">Số ngày</th><th>Ghi chú</th></tr></thead><tbody>' + list.map(function (x) {
        return '<tr><td>' + Q.WD_SHORT[Q.weekday(x.d)] + ', ' + Q.fmtDate(x.d) + '</td><td>' + x.s + '</td><td class="num">' + Q.fmtNum0(x.v) + '</td><td class="muted">' + esc(x.note || '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">Chưa nghỉ phép ngày nào trong năm ' + y + '.</div>');
    Modal.open('Chi tiết nghỉ phép năm ' + y + ' – ' + s.name, body, '<div class="spacer"></div><button class="btn" data-close>Đóng</button>');
  }
  Views.leave = {
    html: function () {
      var y = state.year;
      var rows = leaveRows(y);
      var notEntered = rows.filter(function (r) { return !r.al.entered; }).length;
      var html = '<div class="card"><div class="row gap wrap"><div><h3>Phép năm ' + y + '</h3><div class="muted small">Nhập số ngày phép được hưởng của từng viên chức từ đầu năm. Mỗi lần chấm <b>P – Nghỉ phép</b> sẽ tự trừ vào số còn lại.</div></div>' +
        '<div class="spacer"></div><button class="btn" id="lvPrint">🖨 In</button><button class="btn btn-success" id="lvExcel">⬇ Xuất Excel</button></div>' +
        '<div class="row gap wrap mt">' +
        '<label class="inline-field nomargin">Số ngày phép cho tất cả: <input type="number" class="num" id="lvAll" min="0" step="1" value="' + S.data.settings.annualLeave + '"></label>' +
        '<button class="btn btn-sm" id="lvApplyEmpty">Áp dụng cho người chưa nhập' + (notEntered ? ' (' + notEntered + ')' : '') + '</button>' +
        '<button class="btn btn-sm" id="lvApplyAll">Áp dụng cho tất cả</button>' +
        '<button class="btn btn-sm" id="lvCopyPrev">Lấy số ngày được hưởng của năm ' + (y - 1) + '</button>' +
        '<button class="btn btn-sm" id="lvCarry">Chuyển phép còn lại năm ' + (y - 1) + ' sang</button>' +
        '</div></div>';
      if (!rows.length) return html + '<div class="card"><div class="empty">Chưa có viên chức.</div></div>';
      html += '<div class="card p0"><div class="table-wrap"><table class="table leave-table"><thead><tr><th>STT</th><th>Họ và tên</th>' +
        '<th class="num">Phép được hưởng</th><th class="num">Năm trước chuyển sang</th><th class="num">Tổng</th>';
      for (var m = 1; m <= 12; m++) html += '<th class="num mcol">T' + m + '</th>';
      html += '<th class="num">Đã nghỉ</th><th>Còn lại</th></tr></thead><tbody>';
      rows.forEach(function (r, i) {
        var pct = r.al.total > 0 ? Math.max(0, Math.min(100, r.al.remain / r.al.total * 100)) : 0;
        html += '<tr><td class="muted">' + (i + 1) + '</td><td><a data-lvdetail="' + r.s.id + '"><b>' + esc(r.s.name) + '</b></a><div class="muted small">' + esc(r.s.position || '') + '</div></td>' +
          '<td class="num"><input type="number" class="num' + (r.al.entered ? '' : ' placeholder-val') + '" min="0" step="0.5" data-lvq="' + r.s.id + '" value="' + (r.al.entered ? r.al.quota : '') + '" placeholder="' + r.al.quota + '"></td>' +
          '<td class="num"><input type="number" class="num" min="0" step="0.5" data-lvc="' + r.s.id + '" value="' + (r.al.carry || '') + '" placeholder="0"></td>' +
          '<td class="num"><b>' + Q.fmtNum0(r.al.total) + '</b></td>';
        r.months.forEach(function (v) { html += '<td class="num mcol">' + (v ? '<span class="code-badge g-paid">' + Q.fmtNum0(v) + '</span>' : '<span class="muted">·</span>') + '</td>'; });
        html += '<td class="num"><b>' + Q.fmtNum0(r.al.used) + '</b></td><td class="remain-cell"><div class="remain"><b class="' + (r.al.remain < 0 ? 'neg' : '') + '">' + Q.fmtNum0(r.al.remain) + '</b>' +
          '<div class="bar-track"><div class="bar-fill ok" style="width:' + pct + '%"></div></div></div></td></tr>';
      });
      html += '</tbody></table></div></div>';
      html += '<div class="card small muted">Ô "Phép được hưởng" để trống sẽ lấy số mặc định (của viên chức hoặc trong Cài đặt) – hiển thị mờ. ' +
        'Bấm vào tên để xem chi tiết các ngày đã nghỉ phép. Số ngày phép theo Bộ luật Lao động: 12 ngày/năm, cộng thêm 1 ngày cho mỗi 5 năm làm việc (tuỳ quy định của đơn vị).</div>';
      return html;
    },
    bind: function () {
      var y = state.year;
      function rec(s) { s.leave = s.leave || {}; s.leave[y] = s.leave[y] || {}; return s.leave[y]; }
      $('#lvPrint').addEventListener('click', function () {
        doPrint(headerBlock('BẢNG THEO DÕI NGÀY NGHỈ PHÉP NĂM', 'Năm ' + y) + leaveTableExport(false) + signBlock());
      });
      $('#lvExcel').addEventListener('click', function () {
        var html = xlsHeader('BẢNG THEO DÕI NGÀY NGHỈ PHÉP NĂM', 'Năm ' + y, 20) + leaveTableExport(true) + xlsSign(20);
        download('PhepNam_' + y + '.xls', xlsWrap('Phep nam ' + y, html), 'application/vnd.ms-excel;charset=utf-8');
        toast('Đã xuất file Excel.');
      });
      $all('[data-lvq]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var s = S.getStaff(inp.getAttribute('data-lvq'));
          rec(s).quota = inp.value === '' ? '' : +inp.value;
          S.save(); toast('Đã lưu phép năm của ' + s.name + '.'); render();
        });
      });
      $all('[data-lvc]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var s = S.getStaff(inp.getAttribute('data-lvc'));
          rec(s).carry = +inp.value || 0;
          S.save(); toast('Đã lưu.'); render();
        });
      });
      $all('[data-lvdetail]').forEach(function (a) { a.addEventListener('click', function () { openLeaveDetail(a.getAttribute('data-lvdetail'), y); }); });
      function applyAll(onlyEmpty) {
        var v = +$('#lvAll').value;
        if (!(v >= 0)) return;
        var n = 0;
        S.activeStaff().forEach(function (s) {
          if (onlyEmpty && Q.leaveQuota(S.data, s, y).entered) return;
          rec(s).quota = v; n++;
        });
        S.save(); toast('Đã đặt ' + v + ' ngày phép năm ' + y + ' cho ' + n + ' viên chức.'); render();
      }
      $('#lvApplyEmpty').addEventListener('click', function () { applyAll(true); });
      $('#lvApplyAll').addEventListener('click', function () {
        if (confirmBox('Đặt lại số ngày phép năm ' + y + ' cho TẤT CẢ viên chức?')) applyAll(false);
      });
      $('#lvCopyPrev').addEventListener('click', function () {
        var n = 0;
        S.activeStaff().forEach(function (s) {
          var p = s.leave && s.leave[y - 1];
          if (p && p.quota !== undefined && p.quota !== '') { rec(s).quota = p.quota; n++; }
        });
        S.save(); toast(n ? 'Đã sao chép cho ' + n + ' viên chức.' : 'Năm ' + (y - 1) + ' chưa nhập phép năm.', n ? 'ok' : 'err'); render();
      });
      $('#lvCarry').addEventListener('click', function () {
        if (!confirmBox('Chuyển số ngày phép còn lại (nếu > 0) của năm ' + (y - 1) + ' sang năm ' + y + '?')) return;
        var n = 0;
        S.activeStaff().forEach(function (s) {
          var r = Q.annualLeave(S.data, s, y - 1);
          rec(s).carry = r.remain > 0 ? r.remain : 0;
          if (r.remain > 0) n++;
        });
        S.save(); toast('Đã chuyển phép cho ' + n + ' viên chức.'); render();
      });
    }
  };

  /* ================= VIEW: Danh sách viên chức ================= */
  function openStaffModal(id, preset, after) {
    var s = id ? S.getStaff(id) : Object.assign({ name: '', code: '', position: '', department: '', alias: '', annualLeave: '', active: true }, preset || {});
    var body = '<div class="form-grid">' +
      '<label class="span2"><span>Họ và tên <span class="req">*</span></span><input id="sfName" value="' + esc(s.name) + '" placeholder="Nguyễn Văn A"></label>' +
      '<label>Mã viên chức<input id="sfCode" value="' + esc(s.code || '') + '"></label>' +
      '<label>Chức vụ / chức danh<input id="sfPos" value="' + esc(s.position || '') + '" list="dlPos"></label>' +
      '<label>Phòng / Khoa / Tổ<input id="sfDept" value="' + esc(s.department || '') + '" list="dlDept"></label>' +
      '<label>Số ngày phép năm (mặc định)<input type="number" id="sfLeave" min="0" step="1" value="' + esc(s.annualLeave === undefined ? '' : s.annualLeave) + '" placeholder="Mặc định: ' + S.data.settings.annualLeave + '"></label>' +
      '<label class="span2">Tên gọi khác (để nhận diện trong văn bản, cách nhau dấu phẩy)<input id="sfAlias" value="' + esc(s.alias || '') + '" placeholder="VD: Hùng KT, Thầy Hùng"></label>' +
      '<label class="check span2"><input type="checkbox" id="sfActive"' + (s.active !== false ? ' checked' : '') + '> Đang làm việc (bỏ chọn nếu đã nghỉ việc, chuyển công tác)</label>' +
      '</div>' + datalists();
    var foot = '<div class="spacer"></div><button class="btn" data-close>Huỷ</button><button class="btn btn-primary" id="sfSave">Lưu</button>';
    Modal.open(id ? 'Sửa thông tin viên chức' : 'Thêm viên chức', body, foot);
    $('#sfSave').addEventListener('click', function () {
      var name = $('#sfName').value.trim().replace(/\s+/g, ' ');
      if (!name) { toast('Nhập họ và tên.', 'err'); return; }
      var dup = S.data.staff.filter(function (x) { return x.id !== id && Q.nameKey(x.name) === Q.nameKey(name); });
      if (dup.length && !confirmBox('Đã có viên chức trùng tên "' + name + '". Vẫn lưu?')) return;
      var obj = {
        name: name, code: $('#sfCode').value.trim(), position: $('#sfPos').value.trim(), department: $('#sfDept').value.trim(),
        alias: $('#sfAlias').value.trim(), annualLeave: $('#sfLeave').value === '' ? '' : +$('#sfLeave').value, active: $('#sfActive').checked
      };
      if (id) Object.assign(s, obj); else S.addStaff(obj);
      S.save(); Modal.close();
      toast(id ? 'Đã cập nhật.' : 'Đã thêm viên chức ' + name + '.');
      if (after) after(); else render();
    });
    $('#sfName').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#sfSave').click(); });
  }
  function datalists() {
    var pos = {}, dep = {};
    S.data.staff.forEach(function (s) { if (s.position) pos[s.position] = 1; if (s.department) dep[s.department] = 1; });
    ['Giám đốc', 'Phó Giám đốc', 'Hiệu trưởng', 'Phó Hiệu trưởng', 'Trưởng phòng', 'Phó Trưởng phòng', 'Tổ trưởng', 'Kế toán', 'Văn thư', 'Viên chức', 'Giáo viên', 'Bác sĩ', 'Điều dưỡng'].forEach(function (p) { pos[p] = 1; });
    return '<datalist id="dlPos">' + Object.keys(pos).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dlDept">' + Object.keys(dep).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>';
  }
  /** Đọc 1 dòng danh sách viên chức (dán từ Excel hoặc gõ tay). Bỏ qua cột STT, dòng tiêu đề */
  function parseStaffLine(l) {
    var cols = String(l || '').split(/\t|;|\|/).map(function (x) { return x.trim(); });
    while (cols.length && /^\d+[.)]?$/.test(cols[0])) cols.shift();
    if (!cols.length) return null;
    var name = cols[0].replace(/^\d+[.)]?\s+/, '').replace(/\s+/g, ' ');
    if (!name || /^(stt|họ\s*(và)?\s*tên|ho\s*(va)?\s*ten)\b/i.test(name) || /\d/.test(name)) return null;
    return { name: name, position: cols[1] || '', department: cols[2] || '', code: cols[3] || '' };
  }
  QLCC.parseStaffLine = parseStaffLine;

  function openBulkStaff() {
    var body = '<p class="muted small">Mỗi dòng một người. Định dạng: <b>Họ và tên ; Chức vụ ; Phòng/Tổ ; Mã</b> (các cột sau tuỳ chọn). Có thể sao chép trực tiếp các cột từ Excel (phân cách bằng Tab).</p>' +
      '<textarea id="bulkTxt" class="txt-input" style="min-height:220px" placeholder="Nguyễn Văn An; Giám đốc; Ban Giám đốc\nTrần Thị Bình; Kế toán; Phòng Hành chính\nLê Văn Cường"></textarea>';
    var foot = '<div class="spacer"></div><button class="btn" data-close>Huỷ</button><button class="btn btn-primary" id="bulkSave">Thêm vào danh sách</button>';
    Modal.open('Nhập nhiều viên chức', body, foot, { wide: true });
    $('#bulkSave').addEventListener('click', function () {
      var lines = $('#bulkTxt').value.split(/\r?\n/);
      var added = 0, skipped = 0;
      var existing = {};
      S.data.staff.forEach(function (s) { existing[Q.nameKey(s.name)] = 1; });
      lines.forEach(function (l) {
        var r = parseStaffLine(l);
        if (!r) return;
        if (existing[Q.nameKey(r.name)]) { skipped++; return; }
        existing[Q.nameKey(r.name)] = 1;
        S.addStaff(r);
        added++;
      });
      S.save(); Modal.close();
      toast('Đã thêm ' + added + ' viên chức' + (skipped ? ', bỏ qua ' + skipped + ' tên đã có' : '') + '.');
      render();
    });
  }
  Views.staff = {
    html: function () {
      var f = Q.nameKey(state.staffFilter);
      var list = S.allStaffSorted().filter(function (s) {
        if (!state.showInactive && s.active === false) return false;
        return !f || Q.nameKey(s.name + ' ' + (s.position || '') + ' ' + (s.department || '') + ' ' + (s.code || '')).indexOf(f) >= 0;
      });
      var html = '<div class="card"><div class="row gap wrap">' +
        '<button class="btn btn-primary" id="stAdd">+ Thêm viên chức</button>' +
        '<button class="btn" id="stBulk">⇪ Nhập nhiều (dán từ Excel)</button>' +
        '<input type="search" id="stFilter" placeholder="🔍 Tìm theo tên, chức vụ, phòng..." value="' + esc(state.staffFilter) + '">' +
        '<label class="check"><input type="checkbox" id="stInactive"' + (state.showInactive ? ' checked' : '') + '> Hiện cả người đã nghỉ việc</label>' +
        '<div class="spacer"></div><span class="muted">Tổng: <b>' + S.activeStaff().length + '</b> đang làm việc</span></div></div>';
      html += '<div class="card p0">';
      if (!list.length) html += '<div class="empty">Chưa có viên chức nào. Bấm <b>+ Thêm viên chức</b> hoặc <b>Nhập nhiều</b>.</div>';
      else {
        html += '<div class="table-wrap"><table class="table"><thead><tr><th>STT</th><th>Mã</th><th>Họ và tên</th><th>Chức vụ</th><th>Phòng / Tổ</th><th>Tên gọi khác</th><th class="num">Phép năm</th><th>Trạng thái</th><th class="right">Thao tác</th></tr></thead><tbody>' +
          list.map(function (s, i) {
            return '<tr class="' + (s.active === false ? 'inactive' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(s.code || '') + '</td><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.position || '') + '</td><td>' + esc(s.department || '') + '</td>' +
              '<td class="muted">' + esc(s.alias || '') + '</td><td class="num">' + (s.annualLeave === '' || s.annualLeave === undefined ? '<span class="muted">' + S.data.settings.annualLeave + '</span>' : s.annualLeave) + '</td>' +
              '<td>' + (s.active === false ? '<span class="tag off">Đã nghỉ</span>' : '<span class="tag ok">Đang làm việc</span>') + '</td>' +
              '<td class="right nowrap"><button class="btn btn-xs" data-up="' + s.id + '" title="Lên">▲</button><button class="btn btn-xs" data-down="' + s.id + '" title="Xuống">▼</button> ' +
              '<button class="btn btn-xs" data-edit="' + s.id + '">Sửa</button> <button class="btn btn-xs btn-danger-ghost" data-del="' + s.id + '">Xoá</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      html += '</div>';
      return html;
    },
    bind: function () {
      $('#stAdd').addEventListener('click', function () { openStaffModal(null); });
      $('#stBulk').addEventListener('click', openBulkStaff);
      var f = $('#stFilter');
      f.addEventListener('input', function () { state.staffFilter = f.value; var p = f.selectionStart; render(); var n = $('#stFilter'); n.focus(); n.setSelectionRange(p, p); });
      $('#stInactive').addEventListener('change', function () { state.showInactive = this.checked; render(); });
      $all('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openStaffModal(b.getAttribute('data-edit')); }); });
      $all('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = S.getStaff(b.getAttribute('data-del'));
          if (!confirmBox('Xoá viên chức "' + s.name + '" và TOÀN BỘ dữ liệu chấm công, ngày bù của người này?\n\nNếu người này chỉ nghỉ việc/chuyển công tác, nên dùng "Sửa" và bỏ chọn "Đang làm việc" để giữ lại lịch sử.')) return;
          S.removeStaff(s.id); S.save(); toast('Đã xoá.'); render();
        });
      });
      function move(id, dir) {
        var list = S.allStaffSorted();
        list.forEach(function (s, i) { s.order = i + 1; });
        var i = list.findIndex(function (s) { return s.id === id; });
        var j = i + dir;
        if (j < 0 || j >= list.length) return;
        var t = list[i].order; list[i].order = list[j].order; list[j].order = t;
        S.save(); render();
      }
      $all('[data-up]').forEach(function (b) { b.addEventListener('click', function () { move(b.getAttribute('data-up'), -1); }); });
      $all('[data-down]').forEach(function (b) { b.addEventListener('click', function () { move(b.getAttribute('data-down'), 1); }); });
    }
  };

  /* ================= VIEW: Cài đặt ================= */
  Views.settings = {
    html: function () {
      var st = S.data.settings, sg = st.signers;
      var y = state.year;
      var hols = Q.FIXED_HOLIDAYS.map(function (h) { return { date: y + '-' + h.md, name: h.name, fixed: true }; })
        .concat(st.holidays.filter(function (h) { return h.date.slice(0, 4) === String(y); }))
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var html = '<div class="grid-2">';
      html += '<div class="card"><div class="card-head"><h3>Thông tin đơn vị</h3></div><div class="form-grid">' +
        '<label class="span2">Cơ quan chủ quản<input data-set="parentUnit" value="' + esc(st.parentUnit) + '" placeholder="VD: UBND TỈNH ... / SỞ ..."></label>' +
        '<label class="span2">Tên đơn vị<input data-set="unitName" value="' + esc(st.unitName) + '" placeholder="VD: Trung tâm ..."></label>' +
        '<label>Bộ phận (nếu chấm theo bộ phận)<input data-set="department" value="' + esc(st.department) + '"></label>' +
        '<label>Địa danh (dòng ngày ký)<input data-set="location" value="' + esc(st.location) + '" placeholder="VD: Cần Thơ"></label>' +
        '<label>Người chấm công<input data-sign="maker" value="' + esc(sg.maker) + '"></label>' +
        '<label>Phụ trách bộ phận<input data-sign="head" value="' + esc(sg.head) + '"></label>' +
        '<label class="span2">Thủ trưởng đơn vị<input data-sign="director" value="' + esc(sg.director) + '"></label>' +
        '</div></div>';
      html += '<div class="card"><div class="card-head"><h3>Quy định tính công</h3></div><div class="form-grid">' +
        '<label class="check span2"><input type="checkbox" data-setb="workSaturday"' + (st.workSaturday ? ' checked' : '') + '> Thứ bảy là ngày làm việc</label>' +
        '<label class="check span2"><input type="checkbox" data-setb="onlyToToday"' + (st.onlyToToday ? ' checked' : '') + '> Chỉ tính công đến ngày hôm nay (ngày tương lai để trống)</label>' +
        '<label class="check span2"><input type="checkbox" data-setb="addBonusToTotal"' + (st.addBonusToTotal ? ' checked' : '') + '> Cộng ngày bù phát sinh vào tổng ngày công hưởng lương của tháng</label>' +
        '<label>Số ngày phép năm mặc định<input type="number" min="0" data-setn="annualLeave" value="' + st.annualLeave + '"></label>' +
        '<label>Khi văn bản chỉ ghi "nghỉ", tính là<select data-set="defaultAbsence">' + codeOptions(st.defaultAbsence) + '</select></label>' +
        '</div></div>';
      html += '</div>';

      html += '<div class="grid-2"><div class="card"><div class="card-head row"><h3>Ngày nghỉ lễ, Tết năm ' + y + '</h3><div class="spacer"></div>' +
        (Q.SUGGESTED_HOLIDAYS[y] ? '<button class="btn btn-sm" id="holSuggest">Nạp lịch nghỉ Tết, Giỗ Tổ gợi ý ' + y + '</button>' : '') + '</div>' +
        '<table class="table compact"><tbody>' + hols.map(function (h) {
          return '<tr><td class="nowrap">' + Q.WD_SHORT[Q.weekday(h.date)] + ', ' + Q.fmtDate(h.date) + '</td><td>' + esc(h.name) + '</td><td class="right">' +
            (h.fixed ? '<span class="tag">Cố định</span>' : '<button class="btn btn-xs btn-danger-ghost" data-delhol="' + h.date + '">Xoá</button>') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="row gap mt wrap"><input type="date" id="holDate"><input id="holName" placeholder="Tên ngày nghỉ (VD: Nghỉ Tết Nguyên đán)"><button class="btn btn-primary" id="holAdd">+ Thêm</button></div>' +
        '<div class="muted small mt">Lịch gợi ý cần đối chiếu với thông báo nghỉ lễ chính thức hằng năm. Đổi năm ở thanh chọn kỳ phía trên để xem năm khác.</div></div>';

      var size = (JSON.stringify(S.data).length / 1024).toFixed(1);
      html += '<div class="card"><div class="card-head"><h3>Sao lưu & khôi phục dữ liệu</h3></div>' +
        '<p class="muted small">Dữ liệu được lưu trên máy này (' + size + ' KB). Hãy <b>sao lưu thường xuyên</b> ra file để phòng mất dữ liệu hoặc chuyển sang máy khác.</p>' +
        '<div class="row gap wrap"><button class="btn btn-primary" id="bkExport">⬇ Sao lưu ra file</button>' +
        '<label class="btn">⬆ Khôi phục từ file<input type="file" id="bkImport" accept=".json,application/json" hidden></label></div>' +
        (S.desktop ? '<div class="alert info small mt">Bản cài đặt Windows: dữ liệu được tự động ghi vào <b>' + esc(S.desktop.info().dataDir) + '</b> và tự sao lưu mỗi ngày trong thư mục <b>SaoLuu</b> (giữ 60 ngày gần nhất).' +
          '<div class="mt"><button class="btn btn-sm" id="bkOpenDir">📂 Mở thư mục dữ liệu</button></div></div>' : '') +
        '<hr><div class="row gap wrap"><button class="btn" id="bkSample">Nạp viên chức mẫu</button>' +
        '<button class="btn btn-danger" id="bkReset">Xoá toàn bộ dữ liệu</button></div></div></div>';
      return html;
    },
    bind: function () {
      var st = S.data.settings;
      $all('[data-set]').forEach(function (i) { i.addEventListener('change', function () { st[i.getAttribute('data-set')] = i.value.trim(); S.save(); toast('Đã lưu.'); render(); }); });
      $all('[data-sign]').forEach(function (i) { i.addEventListener('change', function () { st.signers[i.getAttribute('data-sign')] = i.value.trim(); S.save(); toast('Đã lưu.'); }); });
      $all('[data-setb]').forEach(function (i) { i.addEventListener('change', function () { st[i.getAttribute('data-setb')] = i.checked; S.save(); toast('Đã lưu.'); }); });
      $all('[data-setn]').forEach(function (i) { i.addEventListener('change', function () { st[i.getAttribute('data-setn')] = +i.value || 0; S.save(); toast('Đã lưu.'); }); });
      var sug = $('#holSuggest');
      if (sug) sug.addEventListener('click', function () {
        var n = 0;
        Q.SUGGESTED_HOLIDAYS[state.year].forEach(function (h) {
          if (!st.holidays.some(function (x) { return x.date === h[0]; })) { st.holidays.push({ date: h[0], name: h[1] }); n++; }
        });
        S.save(); toast('Đã thêm ' + n + ' ngày nghỉ.'); render();
      });
      $('#holAdd').addEventListener('click', function () {
        var d = $('#holDate').value, n = $('#holName').value.trim() || 'Ngày nghỉ lễ';
        if (!d) { toast('Chọn ngày.', 'err'); return; }
        if (st.holidays.some(function (x) { return x.date === d; })) { toast('Ngày này đã có.', 'err'); return; }
        st.holidays.push({ date: d, name: n }); S.save(); toast('Đã thêm ngày nghỉ.'); render();
      });
      $all('[data-delhol]').forEach(function (b) {
        b.addEventListener('click', function () {
          st.holidays = st.holidays.filter(function (h) { return h.date !== b.getAttribute('data-delhol'); }); S.save(); render();
        });
      });
      $('#bkExport').addEventListener('click', function () {
        var t = new Date();
        download('SaoLuu_ChamCong_' + Q.dateToYmd(t) + '.json', JSON.stringify(S.data, null, 1), 'application/json');
        toast('Đã tạo file sao lưu.');
      });
      $('#bkImport').addEventListener('change', function () { importBackupFile(this.files[0]); });
      var od = $('#bkOpenDir');
      if (od) od.addEventListener('click', function () { S.desktop.openDataDir(); });
      $('#bkSample').addEventListener('click', function () { loadSampleStaff(); toast('Đã nạp viên chức mẫu.'); render(); });
      $('#bkReset').addEventListener('click', function () {
        if (!confirmBox('XOÁ TOÀN BỘ dữ liệu (viên chức, chấm công, ngày bù, cài đặt)? Thao tác không thể hoàn tác.\nNên sao lưu trước khi xoá.')) return;
        if (!confirmBox('Xác nhận lần cuối: xoá toàn bộ dữ liệu?')) return;
        S.reset(); state.parsed = null; toast('Đã xoá toàn bộ dữ liệu.'); render();
      });
    }
  };


  /* ================= Khôi phục từ file ================= */
  function importBackupFile(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || !d.staff || !d.records) throw new Error('File không đúng định dạng');
        if (S.data.staff.length && !confirmBox('Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng dữ liệu trong file (' + d.staff.length + ' viên chức). Tiếp tục?')) return;
        S.replace(d); toast('Đã khôi phục dữ liệu (' + d.staff.length + ' viên chức).'); render();
      } catch (e) { toast('Không đọc được file: ' + e.message, 'err'); }
    };
    r.readAsText(file);
  }

  /* ================= Trình thiết lập lần đầu ================= */
  function openSetupWizard(step) {
    var st = S.data.settings, y = new Date().getFullYear();
    var steps = ['1. Thông tin đơn vị', '2. Danh sách viên chức', '3. Ngày phép năm'];
    var head = '<div class="wizard-steps">' + steps.map(function (t, i) {
      return '<div class="' + (i + 1 === step ? 'on' : i + 1 < step ? 'done' : '') + '">' + (i + 1 < step ? '✓ ' : '') + t + '</div>';
    }).join('') + '</div>';
    var body = head, foot = '';
    if (step === 1) {
      body += '<p class="wizard-lead">Thông tin này được in trên đầu bảng chấm công và phần ký tên.</p><div class="form-grid">' +
        '<label class="span2">Cơ quan chủ quản<input id="wzParent" value="' + esc(st.parentUnit) + '" placeholder="VD: SỞ VĂN HÓA, THỂ THAO VÀ DU LỊCH"></label>' +
        '<label class="span2"><span>Tên đơn vị <span class="req">*</span></span><input id="wzUnit" value="' + esc(st.unitName) + '" placeholder="VD: THƯ VIỆN THÀNH PHỐ"></label>' +
        '<label>Địa danh (dòng ngày ký)<input id="wzLoc" value="' + esc(st.location) + '" placeholder="VD: Cần Thơ"></label>' +
        '<label>Người chấm công<input id="wzMaker" value="' + esc(st.signers.maker) + '"></label>' +
        '<label class="span2">Thủ trưởng đơn vị<input id="wzDir" value="' + esc(st.signers.director) + '"></label></div>';
      foot = '<button class="btn btn-ghost" data-close>Để sau</button><div class="spacer"></div><button class="btn btn-primary" id="wzNext">Tiếp theo →</button>';
    } else if (step === 2) {
      var n = S.data.staff.length;
      body += '<p class="wizard-lead">Mỗi dòng một người: <b>Họ và tên ; Chức vụ ; Phòng/Tổ</b> (chức vụ, phòng không bắt buộc). Có thể sao chép các cột từ Excel rồi dán vào.' +
        (n ? '<br><span class="ok-text">Đã có ' + n + ' viên chức trong danh sách.</span>' : '') + '</p>' +
        '<textarea id="wzStaff" class="txt-input" style="min-height:220px" placeholder="Nguyễn Văn An; Giám đốc; Ban Giám đốc\nTrần Thị Bình; Kế toán; Phòng Hành chính\nLê Văn Cường; Viên chức; Phòng Nghiệp vụ"></textarea>';
      foot = '<button class="btn" id="wzBack">← Quay lại</button><div class="spacer"></div><button class="btn btn-primary" id="wzNext">Tiếp theo →</button>';
    } else {
      body += '<p class="wizard-lead">Số ngày phép năm ' + y + ' áp dụng cho tất cả viên chức. Người có thâm niên (cứ 5 năm được thêm 1 ngày) có thể sửa riêng trong mục <b>Ngày phép năm</b>.</p><div class="form-grid">' +
        '<label>Số ngày phép năm ' + y + '<input type="number" id="wzLeave" min="0" step="1" value="' + (st.annualLeave || 12) + '"></label>' +
        '<label>Khi chỉ ghi "nghỉ", tính là<select id="wzDef">' + codeOptions(st.defaultAbsence) + '</select></label>' +
        '<label class="check span2"><input type="checkbox" id="wzSat"' + (st.workSaturday ? ' checked' : '') + '> Đơn vị làm việc cả thứ bảy</label>' +
        '<label class="check span2"><input type="checkbox" id="wzHol" checked> Nạp sẵn lịch nghỉ Tết, Giỗ Tổ năm ' + y + ' (gợi ý)</label></div>';
      foot = '<button class="btn" id="wzBack">← Quay lại</button><div class="spacer"></div><button class="btn btn-success" id="wzDone">✔ Hoàn tất</button>';
    }
    Modal.open('Thiết lập phần mềm', body, foot, { wide: true });
    var back = $('#wzBack');
    if (back) back.addEventListener('click', function () { openSetupWizard(step - 1); });
    var next = $('#wzNext');
    if (next) next.addEventListener('click', function () {
      if (step === 1) {
        var unit = $('#wzUnit').value.trim();
        if (!unit) { toast('Nhập tên đơn vị.', 'err'); return; }
        st.parentUnit = $('#wzParent').value.trim(); st.unitName = unit; st.location = $('#wzLoc').value.trim();
        st.signers.maker = $('#wzMaker').value.trim(); st.signers.director = $('#wzDir').value.trim();
        S.save(); openSetupWizard(2);
      } else {
        var existing = {}, added = 0;
        S.data.staff.forEach(function (x) { existing[Q.nameKey(x.name)] = 1; });
        $('#wzStaff').value.split(/\r?\n/).forEach(function (l) {
          var r = parseStaffLine(l);
          if (!r || existing[Q.nameKey(r.name)]) return;
          existing[Q.nameKey(r.name)] = 1;
          S.addStaff(r); added++;
        });
        if (!S.data.staff.length) { toast('Nhập ít nhất một viên chức.', 'err'); return; }
        S.save(); if (added) toast('Đã thêm ' + added + ' viên chức.');
        openSetupWizard(3);
      }
    });
    var done = $('#wzDone');
    if (done) done.addEventListener('click', function () {
      var v = +$('#wzLeave').value || 0;
      st.annualLeave = v; st.defaultAbsence = $('#wzDef').value; st.workSaturday = $('#wzSat').checked;
      S.data.staff.forEach(function (x) {
        x.leave = x.leave || {}; x.leave[y] = x.leave[y] || {};
        if (x.leave[y].quota === undefined || x.leave[y].quota === '') x.leave[y].quota = v;
      });
      if ($('#wzHol').checked && Q.SUGGESTED_HOLIDAYS[y]) {
        Q.SUGGESTED_HOLIDAYS[y].forEach(function (h) {
          if (!st.holidays.some(function (x) { return x.date === h[0]; })) st.holidays.push({ date: h[0], name: h[1] });
        });
      }
      st.setupDone = true;
      S.save(); Modal.close();
      toast('Thiết lập xong! Bắt đầu chấm công.');
      go('daily');
    });
  }

  /* ================= VIEW: Hướng dẫn ================= */
  Views.help = {
    html: function () {
      var ver = S.desktop ? S.desktop.info().version : '';
      function card(n, title, items, ordered) {
        var tag = ordered ? 'ol' : 'ul';
        return '<div class="card help-card"><h3><span class="num-c">' + n + '</span>' + title + '</h3><' + tag + '>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</' + tag + '></div>';
      }
      return '<div class="card"><div class="about"><img src="assets/icon.png" alt=""><div><h2>Quản lý Chấm công – Ngày phép</h2>' +
        '<div class="muted">Phần mềm chấm công và quản lý ngày phép cho viên chức đơn vị sự nghiệp công lập' + (ver ? ' · Phiên bản ' + esc(ver) : '') + '</div></div>' +
        '<div class="spacer"></div><button class="btn btn-primary" id="hpWizard">▶ Mở trình thiết lập</button></div></div>' +
        '<div class="help-grid">' +
        card(1, 'Thiết lập ban đầu (một lần)', [
          'Khai báo <a data-go="settings">thông tin đơn vị</a> và người ký.',
          'Nhập <a data-go="staff">danh sách viên chức</a> (dán từ Excel được).',
          'Nhập <a data-go="leave">số ngày phép năm</a> cho từng người vào đầu mỗi năm.'], true) +
        card(2, 'Chấm nghỉ hằng ngày', [
          'Vào <a data-go="daily">Chấm nghỉ theo ngày</a> và chọn ngày.',
          'Tích chọn người nghỉ, bấm <b>Sáng</b>, <b>Chiều</b> hoặc <b>Cả ngày</b>.',
          'Chọn loại nghỉ: phép, ốm, công tác, học tập, nghỉ bù… rồi bấm <b>Lưu</b>.',
          'Người không được tích tự động tính là đi làm đủ.'], true) +
        card(3, 'Ngày phép năm', [
          'Nghỉ <b>P – Nghỉ phép</b> tự trừ vào số phép: nửa ngày trừ 0,5, cả ngày trừ 1.',
          'Phần mềm báo trước khi vượt số ngày phép.',
          'Bấm vào tên trong <a data-go="leave">Ngày phép năm</a> để xem từng ngày đã nghỉ.',
          'Đầu năm mới: bấm <b>Chuyển phép còn lại năm trước sang</b> nếu đơn vị cho phép.']) +
        card(4, 'Ngày bù', [
          'Trực, làm thêm vào thứ bảy, chủ nhật hoặc ngày lễ: vào <a data-go="bonus">Ngày bù</a> để cộng thêm.',
          'Khi viên chức nghỉ bù, chấm ký hiệu <b>NB</b>. Phần mềm tự trừ vào số ngày bù còn tồn.']) +
        card(5, 'Báo cáo cuối tháng', [
          '<a data-go="timesheet">Bảng chấm công</a> theo mẫu C01-HD: bấm <b>In bảng</b> hoặc <b>Xuất Excel</b>.',
          '<a data-go="summary">Thống kê tổng hợp</a> theo tháng hoặc theo năm.',
          'Bảng theo dõi ngày phép năm in hoặc xuất Excel được.']) +
        card(6, 'An toàn dữ liệu', [
          S.desktop ? 'Dữ liệu tự lưu tại <b>' + esc(S.desktop.info().dataDir) + '</b> và tự sao lưu mỗi ngày.' : 'Dữ liệu lưu trong trình duyệt của máy này.',
          'Nên bấm <b>Sao lưu ra file</b> (mục <a data-go="settings">Cài đặt</a>) mỗi tháng và chép ra USB.',
          'Đổi máy: cài phần mềm trên máy mới, rồi bấm <b>Khôi phục từ file</b>.']) +
        '</div>' +
        '<div class="card small muted"><b>Phím tắt:</b> Ctrl+Enter để phân tích văn bản · Esc để đóng hộp thoại · F5 để tải lại (bản Windows).</div>';
    },
    bind: function () { $('#hpWizard').addEventListener('click', function () { openSetupWizard(1); }); }
  };

  /* ================= Khởi động ================= */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.getAttribute('data-go')); }
  });
  initPeriod();
  var h = (location.hash || '').slice(1);
  if (Views[h]) state.view = h;
  if (S.desktop) { try { $('#sideInfo').textContent = 'Phiên bản ' + S.desktop.info().version + ' · Dữ liệu tự sao lưu mỗi ngày.'; } catch (e) { /* bỏ qua */ } }
  render();
  if (!S.data.staff.length && !S.data.settings.setupDone) setTimeout(function () { openSetupWizard(1); }, 300);
})();
