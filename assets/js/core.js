/* =========================================================
 * QLCC - Core: hằng số, tiện ích ngày tháng, chuẩn hoá chuỗi,
 * lịch làm việc và các hàm tính toán công.
 * Dùng được cả trong trình duyệt (window.QLCC) và Node (module.exports).
 * ========================================================= */
(function (root) {
  'use strict';
  var QLCC = root.QLCC = root.QLCC || {};

  /* ---------- Ký hiệu chấm công (theo mẫu C01-HD, có bổ sung) ---------- */
  // group: work = có mặt làm việc; paid = nghỉ hưởng lương; bhxh = nghỉ hưởng BHXH; unpaid = không hưởng lương
  var CODES = [
    { code: '+',  label: 'Đi làm (lương thời gian)', short: 'Đi làm',    group: 'work' },
    { code: 'CT', label: 'Đi công tác',               short: 'Công tác',  group: 'work' },
    { code: 'H',  label: 'Hội nghị, học tập, bồi dưỡng', short: 'Học tập', group: 'work' },
    { code: 'P',  label: 'Nghỉ phép',                 short: 'Phép',      group: 'paid' },
    { code: 'NB', label: 'Nghỉ bù',                   short: 'Nghỉ bù',   group: 'paid' },
    { code: 'L',  label: 'Nghỉ lễ, Tết',              short: 'Lễ, Tết',   group: 'paid' },
    { code: 'R',  label: 'Nghỉ việc riêng có lương (cưới, tang...)', short: 'Việc riêng', group: 'paid' },
    { code: 'Ô',  label: 'Ốm, điều dưỡng',            short: 'Ốm',        group: 'bhxh' },
    { code: 'Cô', label: 'Con ốm',                    short: 'Con ốm',    group: 'bhxh' },
    { code: 'TS', label: 'Thai sản',                  short: 'Thai sản',  group: 'bhxh' },
    { code: 'T',  label: 'Tai nạn',                   short: 'Tai nạn',   group: 'bhxh' },
    { code: 'Ro', label: 'Nghỉ không lương',          short: 'Không lương', group: 'unpaid' },
    { code: 'KP', label: 'Nghỉ không phép / vắng không lý do', short: 'Không phép', group: 'unpaid' }
  ];
  var CODE_MAP = {};
  CODES.forEach(function (c) { CODE_MAP[c.code] = c; });
  var GROUP_LABEL = { work: 'Làm việc', paid: 'Nghỉ hưởng lương', bhxh: 'Nghỉ hưởng BHXH', unpaid: 'Không hưởng lương' };

  QLCC.CODES = CODES;
  QLCC.CODE_MAP = CODE_MAP;
  QLCC.GROUP_LABEL = GROUP_LABEL;

  /* ---------- Ngày tháng ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dateToYmd(dt) { return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function isValidDate(y, m, d) {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1)) return false;
    return d <= daysInMonth(y, m);
  }
  function weekday(s) { return parseYmd(s).getDay(); } // 0 = CN
  function addDays(s, n) { var dt = parseYmd(s); dt.setDate(dt.getDate() + n); return dateToYmd(dt); }
  function fmtDate(s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var WD_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  QLCC.pad = pad; QLCC.ymd = ymd; QLCC.dateToYmd = dateToYmd; QLCC.parseYmd = parseYmd;
  QLCC.daysInMonth = daysInMonth; QLCC.isValidDate = isValidDate; QLCC.weekday = weekday;
  QLCC.addDays = addDays; QLCC.fmtDate = fmtDate; QLCC.WD_SHORT = WD_SHORT; QLCC.WD_LONG = WD_LONG;

  /* ---------- Chuẩn hoá chuỗi tiếng Việt ----------
   * Bỏ dấu + chữ thường, GIỮ NGUYÊN độ dài để vị trí ký tự khớp với chuỗi gốc (NFC). */
  function normalize(s) {
    s = String(s || '').normalize('NFC');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === 'đ' || c === 'Đ') { out += 'd'; continue; }
      var code = c.charCodeAt(0);
      if (code >= 0xD800 && code <= 0xDFFF) { out += ' '; continue; } // surrogate (emoji...)
      var b = c.normalize('NFD')[0].toLowerCase();
      out += (b && b.length) ? b[0] : ' ';
    }
    return out;
  }
  function nameKey(s) { return normalize(s).replace(/\s+/g, ' ').trim(); }
  QLCC.normalize = normalize;
  QLCC.nameKey = nameKey;

  /* ---------- Ngày lễ ---------- */
  // Ngày lễ dương lịch cố định (tự động áp dụng mọi năm)
  var FIXED_HOLIDAYS = [
    { md: '01-01', name: 'Tết Dương lịch' },
    { md: '04-30', name: 'Ngày Chiến thắng' },
    { md: '05-01', name: 'Ngày Quốc tế Lao động' },
    { md: '09-02', name: 'Quốc khánh' }
  ];
  // Gợi ý lịch nghỉ Tết Âm lịch, Giỗ Tổ và ngày nghỉ liền kề Quốc khánh (cần đối chiếu thông báo chính thức)
  var SUGGESTED_HOLIDAYS = {
    2025: [['2025-01-27', 'Nghỉ Tết Nguyên đán'], ['2025-01-28', 'Nghỉ Tết Nguyên đán'], ['2025-01-29', 'Tết Nguyên đán (Mùng 1)'],
           ['2025-01-30', 'Nghỉ Tết Nguyên đán'], ['2025-01-31', 'Nghỉ Tết Nguyên đán'], ['2025-04-07', 'Giỗ Tổ Hùng Vương'],
           ['2025-09-01', 'Nghỉ Quốc khánh']],
    2026: [['2026-02-16', 'Nghỉ Tết Nguyên đán'], ['2026-02-17', 'Tết Nguyên đán (Mùng 1)'], ['2026-02-18', 'Nghỉ Tết Nguyên đán'],
           ['2026-02-19', 'Nghỉ Tết Nguyên đán'], ['2026-02-20', 'Nghỉ Tết Nguyên đán'], ['2026-04-27', 'Nghỉ bù Giỗ Tổ Hùng Vương'],
           ['2026-09-01', 'Nghỉ Quốc khánh']],
    2027: [['2027-02-04', 'Nghỉ Tết Nguyên đán'], ['2027-02-05', 'Nghỉ Tết Nguyên đán'], ['2027-02-08', 'Nghỉ Tết Nguyên đán'],
           ['2027-02-09', 'Nghỉ Tết Nguyên đán'], ['2027-02-10', 'Nghỉ Tết Nguyên đán'], ['2027-04-16', 'Giỗ Tổ Hùng Vương'],
           ['2027-09-03', 'Nghỉ Quốc khánh']]
  };
  QLCC.FIXED_HOLIDAYS = FIXED_HOLIDAYS;
  QLCC.SUGGESTED_HOLIDAYS = SUGGESTED_HOLIDAYS;

  function holidayName(s, settings) {
    var md = s.slice(5);
    for (var i = 0; i < FIXED_HOLIDAYS.length; i++) if (FIXED_HOLIDAYS[i].md === md) return FIXED_HOLIDAYS[i].name;
    var list = (settings && settings.holidays) || [];
    for (var j = 0; j < list.length; j++) if (list[j].date === s) return list[j].name || 'Ngày nghỉ lễ';
    return null;
  }
  function isWeekend(s, settings) {
    var w = weekday(s);
    if (w === 0) return true;
    if (w === 6) return !(settings && settings.workSaturday);
    return false;
  }
  function isWorkingDay(s, settings) {
    if (isWeekend(s, settings)) return false;
    return !holidayName(s, settings);
  }
  QLCC.holidayName = holidayName;
  QLCC.isWeekend = isWeekend;
  QLCC.isWorkingDay = isWorkingDay;

  /* ---------- Tính công ---------- */
  function todayYmd() { return dateToYmd(new Date()); }
  QLCC.todayYmd = todayYmd;

  /** Ký hiệu thực tế của một ngày cho một viên chức: {am, pm, note, auto, holiday, offday} */
  function dayCell(data, staffId, s) {
    var settings = data.settings;
    var rec = data.records[s] && data.records[s][staffId];
    var hol = holidayName(s, settings);
    var weekend = isWeekend(s, settings);
    var future = settings.onlyToToday && s > todayYmd();
    var cell = { am: '', pm: '', note: '', auto: true, holiday: hol, offday: weekend || !!hol, future: future };
    if (rec && (rec.am || rec.pm)) {
      cell.am = rec.am || (weekend || hol ? '' : '+');
      cell.pm = rec.pm || (weekend || hol ? '' : '+');
      cell.note = rec.note || '';
      cell.auto = false;
      return cell;
    }
    if (rec && rec.note) cell.note = rec.note;
    if (weekend) return cell;
    if (hol) { cell.am = cell.pm = 'L'; return cell; }
    if (future) return cell;
    cell.am = cell.pm = '+';
    return cell;
  }
  QLCC.dayCell = dayCell;

  function emptyCounts() {
    var c = {};
    CODES.forEach(function (x) { c[x.code] = 0; });
    return c;
  }

  /** Thống kê một viên chức trong khoảng ngày [from, to] (YYYY-MM-DD) */
  function rangeStats(data, staffId, from, to) {
    var counts = emptyCounts();
    var std = 0;
    for (var s = from; s <= to; s = addDays(s, 1)) {
      if (isWorkingDay(s, data.settings)) std += 1;
      var cell = dayCell(data, staffId, s);
      // Làm việc vào ngày nghỉ (T7, CN, lễ) không tính vào công tháng -> được bù bằng "Ngày bù"
      if (cell.offday && !cell.auto) continue;
      if (cell.am && counts[cell.am] !== undefined) counts[cell.am] += 0.5;
      if (cell.pm && counts[cell.pm] !== undefined) counts[cell.pm] += 0.5;
    }
    var g = { work: 0, paid: 0, bhxh: 0, unpaid: 0 };
    CODES.forEach(function (x) { g[x.group] += counts[x.code]; });
    var bonusEarned = 0;
    (data.bonus || []).forEach(function (b) {
      if (b.staffId === staffId && b.date >= from && b.date <= to) bonusEarned += Number(b.amount) || 0;
    });
    var total = g.work + g.paid;
    var res = {
      counts: counts, std: std, work: g.work, paid: g.paid, bhxh: g.bhxh, unpaid: g.unpaid,
      totalPaid: total, bonusEarned: bonusEarned, bonusUsed: counts.NB,
      totalWithBonus: total + (data.settings.addBonusToTotal ? bonusEarned : 0)
    };
    return res;
  }
  QLCC.rangeStats = rangeStats;

  function monthStats(data, staffId, y, m) {
    return rangeStats(data, staffId, ymd(y, m, 1), ymd(y, m, daysInMonth(y, m)));
  }
  QLCC.monthStats = monthStats;

  /** Số ngày bù tồn (lũy kế) tính đến hết ngày `upto` */
  function bonusBalance(data, staffId, upto) {
    var earned = 0, used = 0;
    (data.bonus || []).forEach(function (b) {
      if (b.staffId === staffId && b.date <= upto) earned += Number(b.amount) || 0;
    });
    Object.keys(data.records).forEach(function (s) {
      if (s > upto) return;
      var r = data.records[s][staffId];
      if (!r) return;
      if (r.am === 'NB') used += 0.5;
      if (r.pm === 'NB') used += 0.5;
    });
    return { earned: earned, used: used, balance: earned - used };
  }
  QLCC.bonusBalance = bonusBalance;

  /** Số ngày phép năm được hưởng của viên chức trong năm y (nhập từ đầu năm) */
  function leaveQuota(data, staff, y) {
    var rec = staff.leave && staff.leave[y];
    var hasRec = rec && rec.quota !== undefined && rec.quota !== null && rec.quota !== '';
    var quota = hasRec ? Number(rec.quota)
      : (staff.annualLeave !== undefined && staff.annualLeave !== null && staff.annualLeave !== '')
        ? Number(staff.annualLeave) : Number(data.settings.annualLeave || 12);
    var carry = rec && rec.carry ? Number(rec.carry) || 0 : 0;
    return { quota: quota, carry: carry, total: quota + carry, entered: !!hasRec };
  }
  QLCC.leaveQuota = leaveQuota;

  /** Số ngày nghỉ phép (P) đã dùng trong khoảng [from, to] - chỉ tính ngày làm việc */
  function leaveUsed(data, staffId, from, to) {
    var used = 0;
    Object.keys(data.records).forEach(function (s) {
      if (s < from || s > to) return;
      var r = data.records[s][staffId];
      if (!r || !isWorkingDay(s, data.settings)) return;
      if (r.am === 'P') used += 0.5;
      if (r.pm === 'P') used += 0.5;
    });
    return used;
  }
  QLCC.leaveUsed = leaveUsed;

  /** Phép năm: được hưởng / đã nghỉ / còn lại trong năm y (tuỳ chọn tính đến ngày `upto`) */
  function annualLeave(data, staff, y, upto) {
    var q = leaveQuota(data, staff, y);
    var to = upto && upto < ymd(y, 12, 31) ? upto : ymd(y, 12, 31);
    var used = leaveUsed(data, staff.id, ymd(y, 1, 1), to);
    return { quota: q.quota, carry: q.carry, total: q.total, entered: q.entered, used: used, remain: q.total - used };
  }
  QLCC.annualLeave = annualLeave;

  function fmtNum(n) {
    if (!n) return '';
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
  }
  function fmtNum0(n) { return (Math.round((n || 0) * 10) / 10).toString().replace('.', ','); }
  QLCC.fmtNum = fmtNum;
  QLCC.fmtNum0 = fmtNum0;

  if (typeof module !== 'undefined' && module.exports) module.exports = QLCC;
})(typeof window !== 'undefined' ? window : globalThis);
