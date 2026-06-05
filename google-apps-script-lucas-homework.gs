const SHEET_NAME = 'lucas homework';
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

  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const rows = records
    .filter(record => record && typeof record === 'object')
    .map(recordToRow_);

  if (rows.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length)
      .setValues(rows);
  }

  return json_({ ok: true, received: rows.length });
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

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function ensureHeaders_(sheet) {
  const range = sheet.getRange(1, 1, 1, HEADERS.length);
  const existing = range.getValues()[0].join('');

  if (!existing) {
    range.setValues([HEADERS]);
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

function valueOrBlank_(value) {
  return value === undefined || value === null ? '' : value;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
