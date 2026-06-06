const RAW_SHEET_PREFIX = 'lucas homework';
const SUMMARY_SHEET_NAME = 'weekly summary';

const HEADERS = [
  'receivedAt',
  'timestamp',
  'clientTimezone',
  'student',
  'result',
  'problem',
  'operation',
  'left',
  'right',
  'expectedAnswer',
  'studentAnswer',
  'rawAnswer',
  'questionNumber',
  'source',
  'attemptId',
  'sessionId',
  'maxDigits',
  'autoNext',
  'soundEnabled',
  'pageUrl',
  'userAgent'
];

const SUMMARY_HEADERS = [
  'week',
  'weekStart',
  'weekEnd',
  'student',
  'attempts',
  'correct',
  'wrong',
  'accuracy',
  'add',
  'sub',
  'mul',
  'div',
  'uniqueSessions',
  'lastReceivedAt'
];

function doGet() {
  return json_({
    ok: true,
    message: 'MathStar Lucas homework endpoint is ready.'
  });
}

function doPost(e) {
  const payload = parsePayload_(e);
  const records = Array.isArray(payload.records)
    ? payload.records
    : payload.record
      ? [payload.record]
      : [payload];

  const validRecords = records.filter(
    record => record && typeof record === 'object'
  );
  const grouped = groupRecordsByWeek_(validRecords);

  Object.keys(grouped).forEach(weekKey => {
    const group = grouped[weekKey];
    const sheet = getSheet_(group.week.sheetName);
    ensureHeaders_(sheet, HEADERS);

    const rows = group.records.map(recordToRow_);
    if (rows.length) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length)
        .setValues(rows);
    }

    updateWeeklySummary_(sheet, group.week);
  });

  return json_({ ok: true, received: validRecords.length });
}

function groupRecordsByWeek_(records) {
  return records.reduce((groups, record) => {
    const week = getWeekInfo_(getRecordDate_(record));
    if (!groups[week.key]) {
      groups[week.key] = { week, records: [] };
    }
    groups[week.key].records.push(record);
    return groups;
  }, {});
}

function getRecordDate_(record) {
  const parsed = record.timestamp ? new Date(record.timestamp) : new Date();
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getWeekInfo_(date) {
  const tz = getTimezone_();
  const year = Number(Utilities.formatDate(date, tz, 'yyyy'));
  const month = Number(Utilities.formatDate(date, tz, 'MM')) - 1;
  const dayOfMonth = Number(Utilities.formatDate(date, tz, 'dd'));
  const localDate = new Date(year, month, dayOfMonth);
  const dayOfWeek = localDate.getDay() || 7;

  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() + 1 - dayOfWeek);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const iso = getIsoWeek_(monday);
  const key = `${iso.year}-W${String(iso.week).padStart(2, '0')}`;

  return {
    key,
    start: Utilities.formatDate(monday, tz, 'yyyy-MM-dd'),
    end: Utilities.formatDate(sunday, tz, 'yyyy-MM-dd'),
    sheetName: `${RAW_SHEET_PREFIX} ${key}`
  };
}

function getIsoWeek_(date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week
  };
}

function getTimezone_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

function parsePayload_(e) {
  const raw =
    e && e.postData && e.postData.contents ? e.postData.contents : '{}';

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {
      parseError: String(error),
      raw
    };
  }
}

function getSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const existing = range.getValues()[0].join('');

  if (!existing) {
    range.setValues([headers]);
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function recordToRow_(record) {
  const settings = record.settings || {};

  return [
    new Date(),
    record.timestamp || '',
    record.clientTimezone || '',
    record.student || '',
    record.result || '',
    record.problem || '',
    record.operation || '',
    valueOrBlank_(record.left),
    valueOrBlank_(record.right),
    valueOrBlank_(record.expectedAnswer),
    valueOrBlank_(record.studentAnswer),
    valueOrBlank_(record.rawAnswer),
    valueOrBlank_(record.questionNumber),
    record.source || '',
    record.attemptId || '',
    record.sessionId || '',
    valueOrBlank_(settings.maxDigits),
    valueOrBlank_(settings.autoNext),
    valueOrBlank_(settings.soundEnabled),
    record.pageUrl || '',
    record.userAgent || ''
  ];
}

function updateWeeklySummary_(rawSheet, week) {
  const summarySheet = getSheet_(SUMMARY_SHEET_NAME);
  ensureHeaders_(summarySheet, SUMMARY_HEADERS);

  const values = rawSheet.getDataRange().getValues();
  const rows = values.slice(1).filter(row => row[0]);
  const resultIndex = HEADERS.indexOf('result');
  const operationIndex = HEADERS.indexOf('operation');
  const sessionIndex = HEADERS.indexOf('sessionId');
  const studentIndex = HEADERS.indexOf('student');
  const receivedAtIndex = HEADERS.indexOf('receivedAt');

  const attempts = rows.length;
  const correct = rows.filter(row => row[resultIndex] === 'correct').length;
  const wrong = rows.filter(row => row[resultIndex] === 'wrong').length;
  const operations = { add: 0, sub: 0, mul: 0, div: 0 };
  const sessions = new Set();
  let lastReceivedAt = '';
  let student = 'Lucas';

  rows.forEach(row => {
    const operation = row[operationIndex];
    if (operations[operation] !== undefined) {
      operations[operation] += 1;
    }

    if (row[sessionIndex]) {
      sessions.add(row[sessionIndex]);
    }

    if (row[studentIndex]) {
      student = row[studentIndex];
    }

    const receivedAt = row[receivedAtIndex];
    if (
      receivedAt instanceof Date &&
      (!lastReceivedAt || receivedAt > lastReceivedAt)
    ) {
      lastReceivedAt = receivedAt;
    }
  });

  const summaryRow = [
    week.key,
    week.start,
    week.end,
    student,
    attempts,
    correct,
    wrong,
    attempts ? correct / attempts : 0,
    operations.add,
    operations.sub,
    operations.mul,
    operations.div,
    sessions.size,
    lastReceivedAt
  ];

  const rowNumber = findSummaryRow_(summarySheet, week.key);
  summarySheet
    .getRange(rowNumber, 1, 1, SUMMARY_HEADERS.length)
    .setValues([summaryRow]);
  summarySheet.getRange(rowNumber, 8).setNumberFormat('0.0%');
}

function findSummaryRow_(summarySheet, weekKey) {
  const lastRow = summarySheet.getLastRow();
  if (lastRow <= 1) {
    return 2;
  }

  const keys = summarySheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const existingIndex = keys.findIndex(row => row[0] === weekKey);

  return existingIndex >= 0 ? existingIndex + 2 : lastRow + 1;
}

function valueOrBlank_(value) {
  return value === undefined || value === null ? '' : value;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
