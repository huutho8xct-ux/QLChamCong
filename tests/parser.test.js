/* Chạy: node tests/parser.test.js */
'use strict';
require('../assets/js/core.js');
require('../assets/js/parser.js');
var QLCC = globalThis.QLCC;

var staff = [
  { id: 's1', name: 'Nguyễn Văn An' },
  { id: 's2', name: 'Trần Thị Bình' },
  { id: 's3', name: 'Lê Văn Cường' },
  { id: 's4', name: 'Phạm Thị Dung' },
  { id: 's5', name: 'Hoàng Văn Hùng' },
  { id: 's6', name: 'Nguyễn Thị Lan' },
  { id: 's7', name: 'Võ Minh Khoa' }
];
var settings = { workSaturday: false, holidays: [], defaultAbsence: 'P' };
var opt = { staff: staff, settings: settings, year: 2026, month: 11, today: '2026-11-07' };

var pass = 0, fail = 0;
function summarize(r) {
  return r.entries.filter(function (e) { return !e.skip; }).map(function (e) {
    return e.staffId + ' ' + e.date + ' ' + e.session + ' ' + e.code + (e.kind === 'bonus' ? '(' + e.amount + ')' : '');
  });
}
function check(name, text, expected, extra) {
  var r = QLCC.Parser.parse(text, opt);
  var got = summarize(r);
  var ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok && extra) ok = extra(r);
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else {
    fail++;
    console.log('  ✗ ' + name + '\n    text: ' + text + '\n    expected: ' + JSON.stringify(expected) + '\n    got:      ' + JSON.stringify(got));
    console.log('    warnings: ' + JSON.stringify(r.warnings) + ' unknown: ' + JSON.stringify(r.unknown));
  }
}

console.log('Parser tests');
check('cơ bản sáng', 'Ngày 05/11/2026: Nguyễn Văn An nghỉ phép buổi sáng', ['s1 2026-11-05 am P']);
check('nhiều người, khác buổi', 'Ngày 05/11/2026: Nguyễn Văn An nghỉ phép buổi sáng, Trần Thị Bình đi công tác cả ngày',
  ['s1 2026-11-05 am P', 's2 2026-11-05 full CT']);
check('danh sách chung', 'Nguyễn Văn An, Trần Thị Bình nghỉ ốm chiều ngày 4/11', ['s1 2026-11-04 pm Ô', 's2 2026-11-04 pm Ô']);
check('khoảng ngày bỏ cuối tuần', 'Lê Văn Cường nghỉ ốm từ 05/11 đến 10/11',
  ['s3 2026-11-05 full Ô', 's3 2026-11-06 full Ô', 's3 2026-11-09 full Ô', 's3 2026-11-10 full Ô']);
check('khoảng gọn 3-4/11', 'Phạm Thị Dung nghỉ phép 3-4/11', ['s4 2026-11-03 full P', 's4 2026-11-04 full P']);
check('sáng phép chiều học', 'Ngày 06/11: Phạm Thị Dung nghỉ phép buổi sáng, buổi chiều đi học',
  ['s4 2026-11-06 am P', 's4 2026-11-06 pm H']);
check('ngữ cảnh ngày dòng trên', 'Ngày 12 tháng 11 năm 2026\nNguyễn Văn An nghỉ bù\nTrần Thị Bình: chiều nghỉ không lương',
  ['s1 2026-11-12 full NB', 's2 2026-11-12 pm Ro']);
check('trực thứ 7 -> bù', 'Hoàng Văn Hùng trực ngày 07/11/2026', ['s5 2026-11-07 full BU(1)']);
check('đi làm chủ nhật nửa ngày -> bù 0,5', 'Hoàng Văn Hùng đi làm sáng chủ nhật 08/11', ['s5 2026-11-08 am BU(0.5)']);
check('cộng bù chỉ định', 'Cộng 2 ngày bù cho Nguyễn Văn An ngày 10/11', ['s1 2026-11-10 full BU(2)']);
check('tên gọi ngắn', 'Chị Lan nghỉ con ốm ngày 9/11', ['s6 2026-11-09 full Cô']);
check('mặc định không rõ loại', 'Lê Văn Cường nghỉ ngày 11/11', ['s3 2026-11-11 full P'],
  function (r) { return /mặc định/.test(r.entries[0].warn); });
check('hôm nay', 'Trần Thị Bình đi công tác hôm qua', ['s2 2026-11-06 full CT']);
check('ngày lễ bị bỏ qua', 'Nguyễn Văn An nghỉ phép ngày 02/09/2026', [],
  function (r) { return r.entries.length === 1 && r.entries[0].skip; });
check('tên lạ được báo', 'Ngày 05/11: Đỗ Minh Quang nghỉ phép', [],
  function (r) { return r.unknown.length === 1 && r.unknown[0].name === 'Đỗ Minh Quang'; });
check('mỗi người một ngày', 'Nguyễn Văn An nghỉ ốm ngày 3/11, Trần Thị Bình nghỉ phép ngày 4/11',
  ['s1 2026-11-03 full Ô', 's2 2026-11-04 full P']);
check('A sáng, B chiều cùng loại', 'Ngày 5/11 Nguyễn Văn An sáng, Trần Thị Bình chiều nghỉ phép',
  ['s1 2026-11-05 am P', 's2 2026-11-05 pm P']);
check('loại ở đầu câu', 'Đi công tác ngày 13/11/2026: Nguyễn Văn An, Lê Văn Cường',
  ['s1 2026-11-13 full CT', 's3 2026-11-13 full CT']);
check('nhiều ngày liệt kê', 'Trần Thị Bình nghỉ phép ngày 3, 4 và 5/11',
  ['s2 2026-11-03 full P', 's2 2026-11-04 full P', 's2 2026-11-05 full P']);
check('thiếu ngày cảnh báo', 'Nguyễn Văn An nghỉ phép', [], function (r) { return r.warnings.length === 1; });
check('không phép', '16/11/2026 Lê Văn Cường vắng không lý do buổi chiều', ['s3 2026-11-16 pm KP']);
check('dấu gạch đầu dòng', '- 17/11: Nguyễn Văn An đi học cả ngày\n- 18/11: Nguyễn Văn An nghỉ việc riêng (đám cưới con)',
  ['s1 2026-11-17 full H', 's1 2026-11-18 full R']);
check('cộng bù số lẻ + làm thêm', 'Cộng 1,5 ngày bù cho Võ Minh Khoa ngày 16/11 do làm thêm giờ', ['s7 2026-11-16 full BU(1.5)']);
check('không dấu', 'ngay 19/11 nguyen van an nghi phep sang', ['s1 2026-11-19 am P']);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
