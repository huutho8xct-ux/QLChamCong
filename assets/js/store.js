/* =========================================================
 * QLCC - Lưu trữ dữ liệu (localStorage) + thao tác dữ liệu
 * ========================================================= */
(function (root) {
  'use strict';
  var QLCC = root.QLCC;
  var KEY = 'qlcc_data_v1';

  function defaultData() {
    return {
      version: 1,
      settings: {
        unitName: '',
        parentUnit: '',
        department: '',
        workSaturday: false,
        onlyToToday: true,
        defaultAbsence: 'P',
        annualLeave: 12,
        addBonusToTotal: false,
        holidays: [],
        signers: { maker: '', head: '', director: '' },
        location: ''
      },
      staff: [],
      records: {},   // { 'YYYY-MM-DD': { staffId: { am, pm, note } } }
      bonus: [],     // [{ id, staffId, date, amount, reason, source }]
      history: []    // nhật ký ghi từ văn bản (để hoàn tác)
    };
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var Store = {
    data: null,
    load: function () {
      var d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
      this.data = this.migrate(d || defaultData());
      return this.data;
    },
    migrate: function (d) {
      var def = defaultData();
      d.settings = Object.assign({}, def.settings, d.settings || {});
      d.settings.signers = Object.assign({}, def.settings.signers, d.settings.signers || {});
      d.staff = d.staff || [];
      d.records = d.records || {};
      d.bonus = d.bonus || [];
      d.history = d.history || [];
      return d;
    },
    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        return true;
      } catch (e) {
        alert('Không lưu được dữ liệu: ' + e.message);
        return false;
      }
    },
    reset: function () { this.data = defaultData(); this.save(); },
    replace: function (d) { this.data = this.migrate(d); this.save(); },
    uid: uid,

    /* --- Viên chức --- */
    activeStaff: function () {
      return this.data.staff.filter(function (s) { return s.active !== false; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },
    allStaffSorted: function () {
      return this.data.staff.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },
    getStaff: function (id) {
      for (var i = 0; i < this.data.staff.length; i++) if (this.data.staff[i].id === id) return this.data.staff[i];
      return null;
    },
    addStaff: function (s) {
      var max = 0;
      this.data.staff.forEach(function (x) { if ((x.order || 0) > max) max = x.order; });
      var obj = Object.assign({ id: uid('vc'), active: true, order: max + 1 }, s);
      this.data.staff.push(obj);
      return obj;
    },
    removeStaff: function (id) {
      this.data.staff = this.data.staff.filter(function (s) { return s.id !== id; });
      var recs = this.data.records;
      Object.keys(recs).forEach(function (d) {
        delete recs[d][id];
        if (!Object.keys(recs[d]).length) delete recs[d];
      });
      this.data.bonus = this.data.bonus.filter(function (b) { return b.staffId !== id; });
    },

    /* --- Chấm công --- */
    getRecord: function (date, staffId) {
      return (this.data.records[date] && this.data.records[date][staffId]) || null;
    },
    setRecord: function (date, staffId, rec) {
      var recs = this.data.records;
      var clean = rec && (rec.am || rec.pm || rec.note) ? {
        am: rec.am && rec.am !== '+' ? rec.am : '',
        pm: rec.pm && rec.pm !== '+' ? rec.pm : '',
        note: rec.note || ''
      } : null;
      // Ngày cuối tuần/lễ: giữ cả '+' (đi làm) nếu người dùng cố ý chấm
      if (rec && !QLCC.isWorkingDay(date, this.data.settings)) {
        clean = rec.am || rec.pm || rec.note ? { am: rec.am || '', pm: rec.pm || '', note: rec.note || '' } : null;
      }
      if (clean && !clean.am && !clean.pm && !clean.note) clean = null;
      if (!clean) {
        if (recs[date]) { delete recs[date][staffId]; if (!Object.keys(recs[date]).length) delete recs[date]; }
        return;
      }
      if (!recs[date]) recs[date] = {};
      recs[date][staffId] = clean;
    },
    /** Ghi một buổi: session 'am' | 'pm' | 'full' */
    setSession: function (date, staffId, session, code, note) {
      var cur = this.getRecord(date, staffId) || { am: '', pm: '', note: '' };
      var next = { am: cur.am, pm: cur.pm, note: cur.note };
      if (session === 'full' || session === 'am') next.am = code;
      if (session === 'full' || session === 'pm') next.pm = code;
      if (note !== undefined && note !== null) next.note = note;
      this.setRecord(date, staffId, next);
    },

    /* --- Ngày bù --- */
    addBonus: function (b) {
      var obj = Object.assign({ id: uid('bu'), amount: 1, reason: '', source: 'manual' }, b);
      obj.amount = Number(obj.amount) || 0;
      this.data.bonus.push(obj);
      return obj;
    },
    removeBonus: function (id) {
      this.data.bonus = this.data.bonus.filter(function (b) { return b.id !== id; });
    },

    /* --- Ghi kết quả phân tích văn bản (có nhật ký để hoàn tác) --- */
    applyEntries: function (entries, text) {
      var self = this;
      var changes = [];
      var touched = {};
      var bonusIds = [];
      entries.forEach(function (e) {
        if (e.kind === 'bonus') {
          var b = self.addBonus({ staffId: e.staffId, date: e.date, amount: e.amount, reason: e.source, source: 'text' });
          bonusIds.push(b.id);
          return;
        }
        var k = e.date + '|' + e.staffId;
        if (!touched[k]) {
          var before = self.getRecord(e.date, e.staffId);
          changes.push({ date: e.date, staffId: e.staffId, before: before ? Object.assign({}, before) : null });
          touched[k] = 1;
        }
        self.setSession(e.date, e.staffId, e.session, e.code);
      });
      var h = {
        id: uid('h'), time: new Date().toISOString(), text: String(text || '').slice(0, 500),
        count: entries.length, changes: changes, bonusIds: bonusIds
      };
      this.data.history.unshift(h);
      this.data.history = this.data.history.slice(0, 30);
      this.save();
      return h;
    },
    undoHistory: function (id) {
      var self = this;
      var h = this.data.history.filter(function (x) { return x.id === id; })[0];
      if (!h) return false;
      h.changes.forEach(function (c) { self.setRecord(c.date, c.staffId, c.before); });
      this.data.bonus = this.data.bonus.filter(function (b) { return h.bonusIds.indexOf(b.id) < 0; });
      this.data.history = this.data.history.filter(function (x) { return x.id !== id; });
      this.save();
      return true;
    }
  };

  QLCC.Store = Store;
})(window);
