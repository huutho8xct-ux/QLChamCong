/* =========================================================
 * QLCC - Bộ phân tích văn bản chấm công (tiếng Việt tự nhiên)
 *
 * Ví dụ nhận diện được:
 *   Ngày 05/11/2026: Nguyễn Văn An nghỉ phép buổi sáng, Trần Thị Bình đi công tác cả ngày
 *   Lê Văn Cường nghỉ ốm từ 03/11 đến 05/11
 *   Phạm Thị Dung nghỉ phép sáng, chiều đi học
 *   Hoàng Văn Em trực thứ 7 ngày 08/11  -> cộng 1 ngày bù
 *   Cộng 2 ngày bù cho Nguyễn Văn An ngày 10/11
 * ========================================================= */
(function (root) {
  'use strict';
  var QLCC = root.QLCC = root.QLCC || (typeof require !== 'undefined' ? require('./core.js') : {});
  var normalize = QLCC.normalize;

  /* ---------- Từ khoá ---------- */
  var SESSION_FULL = /\b(ca\s+ngay|nguyen\s+ngay|tron\s+ngay|ca\s+hai\s+buoi|ca\s+2\s+buoi|2\s+buoi|1\s+ngay|mot\s+ngay|ngay\s+cong)\b/;
  var SESSION_AM = /\b(sang)\b/;
  var SESSION_PM = /\b(chieu)\b/;
  var SESSION_HALF = /\b(nua\s+ngay|0[.,]5\s+ngay|1\s+buoi|mot\s+buoi)\b/;

  // Thứ tự ưu tiên rất quan trọng
  var TYPE_RULES = [
    [/\b(nghi\s*bu|nghi\s+tru\s+bu|tru\s+(ngay\s+)?bu)\b/, 'NB'],
    [/\b(con\s+om|con\s+benh|cham\s+con|con\s+nam\s+vien)\b/, 'Cô'],
    [/\b(thai\s+san|sinh\s+con|kham\s+thai|sinh\s+em\s+be)\b/, 'TS'],
    [/\b(tai\s+nan)\b/, 'T'],
    [/\b(om|benh|nam\s+vien|kham\s+benh|dieu\s+duong|sot|nhap\s+vien|phau\s+thuat)\b/, 'Ô'],
    [/\b(khong\s+luong|khong\s+huong\s+luong)\b/, 'Ro'],
    [/\b(khong\s+phep|vang\s+mat|tu\s+y\s+nghi|khong\s+ly\s+do|vang|nghi\s+tu\s+do)\b/, 'KP'],
    [/\b(viec\s+rieng|ket\s+hon|dam\s+cuoi|le\s+cuoi|cuoi\s+(vo|chong|con)|dam\s+tang|dam\s+hieu|viec\s+hieu|tang\s+(cha|me|bo|vo|chong|con|ong|ba))\b/, 'R'],
    [/\b(cong\s+tac)\b/, 'CT'],
    [/\b(hoc|tap\s+huan|boi\s+duong|dao\s+tao|hoi\s+nghi|hoi\s+thao|di\s+thi|coi\s+thi|cham\s+thi)\b/, 'H'],
    [/\b(nghi\s+le|nghi\s+tet|le\s+tet)\b/, 'L'],
    [/\b(lam\s+them|truc|lam\s+bu|tang\s+ca|ngoai\s+gio|lam\s+viec\s+(vao\s+)?(thu\s*(7|bay)|chu\s+nhat|cn)|di\s+lam\s+(vao\s+)?(thu\s*(7|bay)|chu\s+nhat|cn))\b/, 'BU'],
    [/\b(phep)\b/, 'P'],
    [/\b(di\s+lam|lam\s+viec|co\s+mat|lam\s+binh\s+thuong|di\s+lam\s+lai|xoa\s+nghi|huy\s+nghi)\b/, '+'],
    [/\b(nghi)\b/, 'DEFAULT']
  ];
  // "Cộng 2 ngày bù", "được cộng thêm 1,5 ngày bù"
  var BONUS_EXPLICIT = /\b(?:cong|duoc|them|tang)(?:\s+(?:them|cong|duoc))*\s+(\d+(?:[.,]\d+)?)\s*ngay\s*(?:nghi\s*)?bu\b/;

  var HONORIFIC = /(?:anh|chi|co|thay|ong|ba|em|d\/c|dc|dong\s+chi|bac)\s+$/;
  var STOP_SINGLE = { sang: 1, chieu: 1, nam: 1, ngay: 1, thang: 1, ca: 1, bu: 1, le: 1, tet: 1, hoc: 1, phep: 1, om: 1, truc: 1, vang: 1, nghi: 1 };

  var SURNAMES = ('nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly dinh mai truong lam to chau dao cao luu thai ta ' +
    'quach kieu ha luong tang trinh doan than trieu chu la au tu khong giang nghiem ton phung mac lai vuong diep hua dam ong nong lo quan ' +
    'van kim tieu banh lu thach son hong giap khuc ninh tong lieu uong thieu bach nghiem').split(' ');
  var SURNAME_SET = {};
  SURNAMES.forEach(function (s) { SURNAME_SET[s] = 1; });

  var UP = 'A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ';
  var LOW = 'a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ';
  var CAP_SEQ = new RegExp('[' + UP + '][' + LOW + ']*(?:[ \\t]+[' + UP + '][' + LOW + ']*){1,4}', 'g');

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function detectSession(t) {
    if (!t) return null;
    var am = SESSION_AM.test(t), pm = SESSION_PM.test(t);
    if (am && pm) return 'full';
    if (SESSION_FULL.test(t)) return 'full';
    if (am) return 'am';
    if (pm) return 'pm';
    if (SESSION_HALF.test(t)) return 'am';
    return null;
  }
  function detectType(t) {
    if (!t) return null;
    var m = BONUS_EXPLICIT.exec(t);
    if (m) return { code: 'BU', amount: parseFloat(m[1].replace(',', '.')) };
    for (var i = 0; i < TYPE_RULES.length; i++) {
      if (TYPE_RULES[i][0].test(t)) return { code: TYPE_RULES[i][1] };
    }
    return null;
  }

  /* ---------- Nhận diện ngày ---------- */
  function fixYear(y, base) {
    if (y === undefined || y === null || y === '') return null;
    y = +y;
    if (y < 100) y += 2000;
    return y;
  }

  /** Trả về danh sách token ngày: {start, end, d, m, y} (m, y có thể null) hoặc {start,end,range:[tok,tok]} */
  function findDateTokens(n, ctx) {
    var tokens = [];
    var used = [];
    function free(s, e) {
      for (var i = 0; i < used.length; i++) if (s < used[i][1] && e > used[i][0]) return false;
      return true;
    }
    function add(tok) { tokens.push(tok); used.push([tok.start, tok.end]); }
    function scan(re, fn) {
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(n))) {
        var s = m.index, e = m.index + m[0].length;
        if (free(s, e)) { var t = fn(m, s, e); if (t) add(t); }
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    // yyyy-mm-dd
    scan(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, function (m, s, e) {
      return { start: s, end: e, d: +m[3], m: +m[2], y: +m[1] };
    });
    // 3-5/11[/2026], 3 den 5/11
    scan(/(?<![\d\/.])(\d{1,2})\s*(?:-|–|den|toi|~)\s*(?:ngay\s+)?(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*[\/.]\s*(\d{4}|\d{2}))?(?![\d\/])/g, function (m, s, e) {
      var y = fixYear(m[4]);
      return { start: s, end: e, range: [{ d: +m[1], m: +m[3], y: y }, { d: +m[2], m: +m[3], y: y }] };
    });
    // dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy
    scan(/(?<![\d\/.])(\d{1,2})\s*([\/.\-])\s*(\d{1,2})\s*\2\s*(\d{4}|\d{2})(?![\d])/g, function (m, s, e) {
      return { start: s, end: e, d: +m[1], m: +m[3], y: fixYear(m[4]) };
    });
    // 5 thang 11 [nam 2026]
    scan(/(\d{1,2})\s+thang\s+(\d{1,2})(?:\s*,?\s*nam\s+(\d{4}))?/g, function (m, s, e) {
      return { start: s, end: e, d: +m[1], m: +m[2], y: fixYear(m[3]) };
    });
    // dd/mm
    scan(/(?<![\d\/.,])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d\/])/g, function (m, s, e) {
      return { start: s, end: e, d: +m[1], m: +m[2], y: null };
    });
    // Danh sách: ngay 3, 4 va 5/11
    scan(/ngay\s+((?:\d{1,2}\s*(?:,|va|&|;)\s*)+)(?=\d{1,2}\s*(?:\/|\s+thang))/g, function (m, s, e) {
      var days = m[1].match(/\d{1,2}/g) || [];
      return { start: s, end: e, list: days.map(function (x) { return { d: +x, m: null, y: null }; }) };
    });
    // ngay 3 (chỉ có ngày)
    scan(/\bngay\s+(\d{1,2})(?![\d\/.\-]|\s*thang|\s*ngay|\s*buoi)/g, function (m, s, e) {
      return { start: s, end: e, d: +m[1], m: null, y: null };
    });
    // Tương đối
    scan(/\b(hom\s+nay|hom\s+qua|ngay\s+mai|hom\s+kia)\b/g, function (m, s, e) {
      var base = QLCC.parseYmd(ctx.today);
      var k = m[1].replace(/\s+/g, ' ');
      var off = k === 'hom nay' ? 0 : k === 'hom qua' ? -1 : k === 'ngay mai' ? 1 : -2;
      base.setDate(base.getDate() + off);
      return { start: s, end: e, d: base.getDate(), m: base.getMonth() + 1, y: base.getFullYear() };
    });
    tokens.sort(function (a, b) { return a.start - b.start; });
    return tokens;
  }

  /** Gom token thành nhóm ngày (đã điền tháng/năm, đã mở rộng khoảng) */
  function buildDateGroups(n, tokens, ctx) {
    // Làm phẳng: mỗi phần tử {start,end, parts:[{d,m,y}], isRange}
    var flat = tokens.map(function (t) {
      if (t.range) return { start: t.start, end: t.end, parts: t.range.slice(), isRange: true };
      if (t.list) return { start: t.start, end: t.end, parts: t.list.slice(), isList: true };
      return { start: t.start, end: t.end, parts: [{ d: t.d, m: t.m, y: t.y }] };
    });
    // Điền tháng/năm còn thiếu từ token phía sau, rồi từ ngữ cảnh
    function lastPart(i) { return flat[i].parts[flat[i].parts.length - 1]; }
    for (var i = 0; i < flat.length; i++) {
      flat[i].parts.forEach(function (p) {
        if (p.m === null) {
          for (var j = i; j < flat.length; j++) {
            var q = (j === i) ? lastPart(i) : flat[j].parts[0];
            if (q.m !== null && q !== p) { p.m = q.m; if (p.y === null && q.y !== null) p.y = q.y; break; }
          }
        }
        if (p.y === null) {
          for (var k = i; k < flat.length; k++) {
            var r = flat[k].parts[flat[k].parts.length - 1];
            if (r.y !== null && r !== p && r.m === p.m) { p.y = r.y; break; }
          }
        }
        if (p.m === null) { p.m = ctx.ctxMonth; if (p.y === null) p.y = ctx.ctxYear; }
        if (p.y === null) p.y = ctx.ctxYear;
      });
    }
    // Ghép khoảng "tu A den B"
    var groups = [];
    for (var a = 0; a < flat.length; a++) {
      var f = flat[a];
      var g = { start: f.start, end: f.end, dates: [], isRange: !!f.isRange, invalid: [] };
      var nxt = flat[a + 1];
      if (nxt && !f.isRange && !f.isList && !nxt.isRange && !nxt.isList) {
        var gap = n.slice(f.end, nxt.start);
        if (/^\s*(?:den|toi|-|–|~|>|cho\s+den)\s*(?:het\s+)?(?:ngay\s+)?$/.test(gap)) {
          f = { parts: [f.parts[0], nxt.parts[0]], isRange: true };
          g.end = nxt.end; g.isRange = true;
          a++;
        }
      }
      var partsOk = f.parts.filter(function (p) {
        var ok = QLCC.isValidDate(p.y, p.m, p.d);
        if (!ok) g.invalid.push(p.d + '/' + p.m + '/' + p.y);
        return ok;
      });
      if (f.isRange && partsOk.length === 2) {
        var s1 = QLCC.ymd(partsOk[0].y, partsOk[0].m, partsOk[0].d);
        var s2 = QLCC.ymd(partsOk[1].y, partsOk[1].m, partsOk[1].d);
        if (s2 < s1) { var tmp = s1; s1 = s2; s2 = tmp; }
        var guard = 0;
        for (var s = s1; s <= s2 && guard < 370; s = QLCC.addDays(s, 1), guard++) g.dates.push(s);
      } else {
        partsOk.forEach(function (p) { g.dates.push(QLCC.ymd(p.y, p.m, p.d)); });
      }
      if (g.dates.length || g.invalid.length) groups.push(g);
    }
    return groups;
  }

  /* ---------- Nhận diện tên ---------- */
  function buildNameIndex(staff) {
    var idx = [];
    var lastNameCount = {};
    staff.forEach(function (s) {
      var key = QLCC.nameKey(s.name);
      var parts = key.split(' ');
      var last = parts[parts.length - 1];
      lastNameCount[last] = (lastNameCount[last] || 0) + 1;
    });
    staff.forEach(function (s) {
      if (!s.name) return;
      var key = QLCC.nameKey(s.name);
      if (!key) return;
      idx.push({ staff: s, kind: 'full', len: key.length,
        re: new RegExp('(?<![a-z0-9])' + key.split(' ').map(escapeRe).join('\\s+') + '(?![a-z0-9])', 'g') });
      var aliases = String(s.alias || '').split(/[,;]/).map(function (a) { return a.trim(); }).filter(Boolean);
      aliases.forEach(function (a) {
        var ak = QLCC.nameKey(a);
        if (ak.indexOf(' ') > 0) {
          idx.push({ staff: s, kind: 'alias', len: ak.length,
            re: new RegExp('(?<![a-z0-9])' + ak.split(' ').map(escapeRe).join('\\s+') + '(?![a-z0-9])', 'g') });
        } else {
          idx.push({ staff: s, kind: 'single', len: a.length, word: a.normalize('NFC') });
        }
      });
      // Tên gọi (từ cuối) - chỉ khi duy nhất, so khớp chính xác có dấu và viết hoa
      var origParts = s.name.normalize('NFC').trim().split(/\s+/);
      var lastOrig = origParts[origParts.length - 1];
      var keyParts = key.split(' ');
      if (origParts.length > 1 && lastNameCount[keyParts[keyParts.length - 1]] === 1) {
        idx.push({ staff: s, kind: 'single', len: lastOrig.length, word: lastOrig });
      }
    });
    idx.sort(function (a, b) {
      var pa = a.kind === 'single' ? 1 : 0, pb = b.kind === 'single' ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return b.len - a.len;
    });
    return idx;
  }

  function findNames(orig, n, index) {
    var found = [];
    function free(s, e) {
      for (var i = 0; i < found.length; i++) if (s < found[i].end && e > found[i].start) return false;
      return true;
    }
    index.forEach(function (it) {
      if (it.kind === 'single') {
        var w = it.word;
        var re = new RegExp('(?<![' + LOW + UP + '0-9])' + escapeRe(w) + '(?![' + LOW + UP + '0-9])', 'g');
        var m;
        while ((m = re.exec(orig))) {
          var s = m.index, e = s + m[0].length;
          var wk = normalize(w);
          if (STOP_SINGLE[wk]) {
            // tên trùng với từ thông dụng -> yêu cầu có danh xưng phía trước (anh, chị, đ/c...)
            if (!HONORIFIC.test(n.slice(Math.max(0, s - 12), s))) continue;
          }
          if (free(s, e)) found.push({ start: s, end: e, staff: it.staff, kind: 'single' });
        }
      } else {
        it.re.lastIndex = 0;
        var mm;
        while ((mm = it.re.exec(n))) {
          var s2 = mm.index, e2 = s2 + mm[0].length;
          if (free(s2, e2)) found.push({ start: s2, end: e2, staff: it.staff, kind: it.kind });
        }
      }
    });
    found.sort(function (a, b) { return a.start - b.start; });
    // Gộp trùng cùng một viên chức liền kề (vd: "Nguyễn Văn An (An)")
    return found;
  }

  function findUnknownNames(orig, blocked) {
    var res = [];
    CAP_SEQ.lastIndex = 0;
    var m;
    while ((m = CAP_SEQ.exec(orig))) {
      var s = m.index, e = s + m[0].length;
      var overlap = blocked.some(function (b) { return s < b[1] && e > b[0]; });
      if (overlap) continue;
      var words = m[0].split(/\s+/);
      // bỏ các từ đầu không phải họ
      while (words.length && !SURNAME_SET[normalize(words[0])]) words.shift();
      if (words.length >= 2 && words.length <= 5) res.push(words.join(' '));
    }
    return res;
  }

  /* ---------- Tách đoạn ---------- */
  function splitSegments(text) {
    var segs = [];
    String(text || '').normalize('NFC').split(/\r?\n/).forEach(function (line, li) {
      line.split(/;|\.(?=\s)|\|\|/).forEach(function (part) {
        var p = part.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/, '').trim();
        if (p) segs.push({ text: p, line: li + 1, raw: line.trim() });
      });
    });
    return segs;
  }

  function blank(str, ranges, offset) {
    var arr = str.split('');
    ranges.forEach(function (r) {
      for (var i = Math.max(0, r[0] - offset); i < Math.min(arr.length, r[1] - offset); i++) arr[i] = ' ';
    });
    return arr.join('');
  }

  /** Phân tích phần văn bản gắn với 1 tên -> danh sách {session, type} */
  function analyzeOwn(t) {
    var res = { items: [], hasSession: false, hasType: false };
    if (!t || !t.trim()) return res;
    var parts = t.split(/,|\s(?:va|con|nhung|roi)\s/);
    var infos = parts.map(function (p) { return { s: detectSession(p), t: detectType(p) }; });
    var sessParts = infos.filter(function (x) { return x.s; });
    var whole = { s: detectSession(t), t: detectType(t) };
    res.hasSession = !!whole.s;
    res.hasType = !!whole.t;
    if (sessParts.length >= 2) {
      for (var i = 0; i < infos.length; i++) {
        if (!infos[i].s) continue;
        var ty = infos[i].t;
        if (!ty) for (var j = i - 1; j >= 0 && !ty; j--) if (infos[j].t && !infos[j].s) ty = infos[j].t;
        if (!ty) for (var k = i + 1; k < infos.length && !ty; k++) if (infos[k].t) ty = infos[k].t;
        res.items.push({ session: infos[i].s, type: ty || null });
      }
    } else if (whole.s || whole.t) {
      res.items.push({ session: whole.s, type: whole.t });
    }
    return res;
  }

  /* ---------- Hàm chính ---------- */
  /**
   * @param {string} text
   * @param {object} opt { staff:[], settings:{}, year, month, today:'YYYY-MM-DD', defaultAbsence:'P' }
   * @returns {{entries:Array, warnings:Array, unknown:Array}}
   */
  function parse(text, opt) {
    opt = opt || {};
    var staff = (opt.staff || []).filter(function (s) { return s.active !== false; });
    var settings = opt.settings || {};
    var today = opt.today || QLCC.todayYmd();
    var ctx = { ctxYear: opt.year || +today.slice(0, 4), ctxMonth: opt.month || +today.slice(5, 7), today: today };
    var defaultAbsence = opt.defaultAbsence || settings.defaultAbsence || 'P';
    var index = buildNameIndex(staff);
    var entries = [], warnings = [], unknownMap = {};
    var contextDates = null;

    splitSegments(text).forEach(function (seg) {
      var orig = seg.text;
      var n = normalize(orig).replace(/\b1\s*\/\s*2\s+ngay\b/g, 'nua ngay');
      var tokens = findDateTokens(n, ctx);
      var groups = buildDateGroups(n, tokens, ctx);
      groups.forEach(function (g) {
        g.invalid.forEach(function (iv) { warnings.push({ line: seg.line, text: seg.raw, message: 'Ngày không hợp lệ: ' + iv }); });
      });
      var dateRanges = groups.map(function (g) { return [g.start, g.end]; });
      var names = findNames(orig, n, index).filter(function (nm) {
        return !dateRanges.some(function (r) { return nm.start < r[1] && nm.end > r[0]; });
      });

      // Tên chưa có trong danh sách
      var blocked = dateRanges.concat(names.map(function (x) { return [x.start, x.end]; }));
      findUnknownNames(orig, blocked).forEach(function (u) {
        var k = QLCC.nameKey(u);
        if (!unknownMap[k]) unknownMap[k] = { name: u, line: seg.line, text: seg.raw };
      });

      if (!names.length) {
        // Đoạn chỉ có ngày -> cập nhật ngữ cảnh ngày cho các dòng sau
        var allDates = [];
        groups.forEach(function (g) { allDates = allDates.concat(g.dates); });
        if (allDates.length) {
          contextDates = { dates: allDates, isRange: groups.some(function (g) { return g.isRange; }) };
          var last = allDates[allDates.length - 1];
          ctx.ctxYear = +last.slice(0, 4); ctx.ctxMonth = +last.slice(5, 7);
        }
        var rest = blank(n, dateRanges, 0);
        var ty = detectType(rest);
        var hasUnknown = findUnknownNames(orig, blocked).length > 0;
        if (ty && ty.code !== 'DEFAULT' && !hasUnknown && !allDates.length) {
          warnings.push({ line: seg.line, text: seg.raw, message: 'Không nhận diện được tên viên chức trong câu này.' });
        } else if (ty && allDates.length && rest.replace(/[^a-z]/g, '').length > 12 && !hasUnknown && /\b(nghi|cong\s+tac|hoc|truc|om|phep|di\s+lam)\b/.test(rest)) {
          warnings.push({ line: seg.line, text: seg.raw, message: 'Có ngày và nội dung chấm công nhưng không tìm thấy tên viên chức nào.' });
        }
        return;
      }

      // Chia vùng: prefix + phần riêng của từng tên
      var segLen = n.length;
      var prefixEnd = names[0].start;
      function groupsIn(s, e) { return groups.filter(function (g) { return g.start >= s && g.start < e; }); }
      function datesOf(gs) {
        var d = []; var r = false;
        gs.forEach(function (g) { d = d.concat(g.dates); if (g.isRange) r = true; });
        return d.length ? { dates: d, isRange: r } : null;
      }
      var prefixText = blank(n.slice(0, prefixEnd), dateRanges, 0);
      var prefixInfo = analyzeOwn(prefixText);
      var prefixDates = datesOf(groupsIn(0, prefixEnd));
      if (prefixDates) {
        contextDates = prefixDates;
        var l2 = prefixDates.dates[prefixDates.dates.length - 1];
        ctx.ctxYear = +l2.slice(0, 4); ctx.ctxMonth = +l2.slice(5, 7);
      }

      var per = names.map(function (nm, i) {
        var s = nm.end, e = (i + 1 < names.length) ? names[i + 1].start : segLen;
        var ownRaw = n.slice(s, e);
        var own = blank(ownRaw, dateRanges, s).replace(/^[\s()\-:,.]+/, ' ');
        var info = analyzeOwn(own);
        return { nm: nm, info: info, dates: datesOf(groupsIn(s, e)) };
      });

      // Kế thừa từ tên phía sau (danh sách "A, B, C nghỉ phép...")
      for (var i = per.length - 1; i >= 0; i--) {
        var p = per[i], nx = per[i + 1];
        p.followItems = null; p.followDates = null;
        if (nx) {
          var nxItems = nx.info.items.length ? nx.info.items : nx.followItems;
          if (!p.info.items.length && nxItems) p.followItems = nxItems;
          else if (p.info.items.length && nxItems) {
            // có buổi nhưng chưa có loại -> mượn loại của người sau
            p.info.items.forEach(function (it) {
              if (!it.type) {
                var t2 = null;
                nxItems.forEach(function (x) { if (!t2 && x.type) t2 = x.type; });
                it.type = t2;
              }
            });
          }
          p.followDates = nx.dates || nx.followDates;
        }
      }

      var prevDates = null;
      per.forEach(function (p) {
        var items = p.info.items.length ? p.info.items.map(function (x) { return { session: x.session, type: x.type }; })
          : (p.followItems ? p.followItems.map(function (x) { return { session: x.session, type: x.type }; }) : []);
        if (!items.length) items = [{ session: null, type: null }];
        var pType = prefixInfo.items.length ? prefixInfo.items[0].type : null;
        var pSess = prefixInfo.items.length ? prefixInfo.items[0].session : null;
        items.forEach(function (it) {
          if (!it.type) it.type = pType;
          else if (pType && pType.amount && pType.code === 'BU' && it.type.code === 'BU' && !it.type.amount) it.type = pType;
          if (!it.session) it.session = pSess || 'full';
          if (!it.type) it.type = { code: 'DEFAULT', implicit: true };
        });
        var dinfo = p.dates || prefixDates || p.followDates || prevDates || contextDates;
        if (p.dates) prevDates = p.dates;
        if (!dinfo) {
          warnings.push({ line: seg.line, text: seg.raw, message: 'Thiếu ngày cho viên chức "' + p.nm.staff.name + '". Hãy ghi ngày ở đầu dòng hoặc trong câu.' });
          return;
        }
        items.forEach(function (it) {
          var code = it.type.code === 'DEFAULT' ? defaultAbsence : it.type.code;
          dinfo.dates.forEach(function (d) {
            var working = QLCC.isWorkingDay(d, settings);
            var isBonus = code === 'BU' || (code === '+' && !working);
            var e = {
              staffId: p.nm.staff.id, staffName: p.nm.staff.name, date: d,
              session: it.session, code: isBonus ? 'BU' : code, kind: isBonus ? 'bonus' : 'att',
              amount: isBonus ? (it.type.amount ? it.type.amount : (it.session === 'full' ? 1 : 0.5)) : (it.session === 'full' ? 1 : 0.5),
              explicitAmount: !!it.type.amount,
              implicit: it.type.code === 'DEFAULT',
              line: seg.line, source: seg.raw, warn: ''
            };
            if (!isBonus && !working) {
              if (dinfo.isRange && dinfo.dates.length > 1) return; // bỏ qua ngày nghỉ trong khoảng
              var hn = QLCC.holidayName(d, settings);
              e.warn = 'Ngày ' + QLCC.fmtDate(d) + ' là ' + (hn ? 'ngày lễ (' + hn + ')' : QLCC.WD_LONG[QLCC.weekday(d)]) + ' – không phải ngày làm việc.';
              e.skip = true;
            }
            if (e.implicit && !e.skip) e.warn = 'Không rõ loại nghỉ – dùng mặc định "' + (QLCC.CODE_MAP[code] ? QLCC.CODE_MAP[code].label : code) + '".';
            entries.push(e);
          });
        });
        // Với cộng bù có số ngày chỉ định: chỉ ghi 1 lần (ngày đầu tiên)
      });
    });

    // Gộp bản ghi cộng bù có số ngày chỉ định bị nhân theo nhiều ngày
    var seen = {};
    entries = entries.filter(function (e) {
      if (e.kind === 'bonus' && e.explicitAmount) {
        var k = e.staffId + '|' + e.source + '|' + e.line;
        if (seen[k]) return false;
        seen[k] = 1;
      }
      return true;
    });

    // Đánh dấu bản ghi trùng (cùng người, ngày, buổi) -> bản sau thắng
    var keyMap = {};
    entries.forEach(function (e, i) {
      if (e.kind !== 'att' || e.skip) return;
      var sessions = e.session === 'full' ? ['am', 'pm'] : [e.session];
      sessions.forEach(function (s) {
        var k = e.staffId + '|' + e.date + '|' + s;
        if (keyMap[k] !== undefined && entries[keyMap[k]] !== e) {
          entries[keyMap[k]].warn = (entries[keyMap[k]].warn ? entries[keyMap[k]].warn + ' ' : '') + 'Bị ghi đè bởi dòng ' + e.line + '.';
        }
        keyMap[k] = i;
      });
    });

    var unknown = Object.keys(unknownMap).map(function (k) { return unknownMap[k]; });
    return { entries: entries, warnings: warnings, unknown: unknown };
  }

  QLCC.Parser = { parse: parse, detectSession: detectSession, detectType: detectType, splitSegments: splitSegments };
  if (typeof module !== 'undefined' && module.exports) module.exports = QLCC;
})(typeof window !== 'undefined' ? window : globalThis);
