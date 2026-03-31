/**
 * Realty Expense Manager — Google Sheet Setup Script
 *
 * HOW TO USE:
 *   1. Open the Google Sheet
 *   2. Extensions → Apps Script
 *   3. Replace all code with this file's contents
 *   4. Click ▶ Run → setupAll()
 *   5. Authorize when prompted
 *   6. Close Apps Script — your sheet is ready
 */

function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupOperating(ss);
  setupEarnest(ss);
  setupCommission(ss);

  // Remove the default "Sheet1" if it still exists
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('Setup complete — 3 tabs created with sample data.');
}

// ─── Operating Expenses ───────────────────────────────────────────
function setupOperating(ss) {
  var sheet = getOrCreateSheet(ss, 'Operating Expenses');
  sheet.clear();
  sheet.setTabColor('#4fc3f7');

  var headers = ['Date', 'Description', 'Category', 'Agent', 'Amount', 'Running Balance'];
  var data = [headers];

  var agents = [
    'Sarah Mitchell', 'James Cooper', 'Lisa Rodriguez', 'Marcus Johnson',
    'Emily Parker', 'David Chen', 'Rachel Adams', 'Tyler Brooks',
    'Amanda Foster', 'Brian Williams'
  ];

  var expenses = [
    ['2026-03-28', 'ZILLOW PREMIER #4821',       'Marketing',          'Sarah Mitchell',   -245.00],
    ['2026-03-27', 'ALABAMA POWER #1190',        'Utilities',          '',                 -387.42],
    ['2026-03-27', 'STAPLES #8823',              'Office Supplies',    'Emily Parker',      -62.18],
    ['2026-03-26', 'AT&T WIRELESS #0099',        'Utilities',          '',                 -189.00],
    ['2026-03-25', 'SHELL OIL #5571',            'Vehicle',            'James Cooper',      -47.83],
    ['2026-03-25', 'FACEBOOK ADS #3341',         'Marketing',          'Lisa Rodriguez',   -150.00],
    ['2026-03-24', 'MLS DUES Q1 #2001',          'MLS Fees',           '',                 -425.00],
    ['2026-03-24', 'DOCUSIGN MONTHLY #7784',     'Technology',         '',                 -25.00],
    ['2026-03-22', 'CHICK-FIL-A #1102',          'Client Entertainment','Tyler Brooks',     -34.56],
    ['2026-03-21', 'CLANTON OFFICE LEASE #0401',  'Rent',              '',                -2200.00],
    ['2026-03-21', 'CE COURSE ONLINE #5519',     'Professional Dev',   'Rachel Adams',    -199.00],
    ['2026-03-20', 'GOOGLE ADS #8800',           'Marketing',          'Marcus Johnson',  -300.00],
    ['2026-03-19', 'VISTAPRINT #4415',           'Marketing',          'Amanda Foster',    -89.95],
    ['2026-03-18', 'SPECTRUM INTERNET #3302',    'Utilities',          '',                 -129.99],
    ['2026-03-17', 'CHEVRON #6612',              'Vehicle',            'David Chen',        -52.10],
    ['2026-03-17', 'OFFICE DEPOT #2290',         'Office Supplies',    '',                  -78.43],
    ['2026-03-15', 'STARBUCKS #9918',            'Client Entertainment','Sarah Mitchell',   -18.75],
    ['2026-03-14', 'E&O INSURANCE PREM #1001',   'Insurance',          '',                -875.00],
    ['2026-03-13', 'STATE FARM AUTO #4400',      'Insurance',          'Brian Williams',  -210.00],
    ['2026-03-12', 'AMAZON BUSINESS #3371',      'Office Supplies',    '',                 -143.29],
    ['2026-03-10', 'ZOOM MONTHLY #8801',         'Technology',         '',                  -14.99],
    ['2026-03-10', 'DROPBOX BUSINESS #6678',     'Technology',         '',                  -19.99],
    ['2026-03-08', 'REALTOR.COM LEADS #2110',    'Marketing',          'James Cooper',    -175.00],
    ['2026-03-07', 'BP #3349',                   'Vehicle',            'Emily Parker',      -39.21],
    ['2026-03-05', 'NAR DUES ANNUAL #0010',      'Professional Dev',   '',                -500.00],
    ['2026-03-04', 'CANVA PRO #4490',            'Technology',         '',                  -12.99],
    ['2026-03-03', 'RESTAURANT DEPOSIT',         'Client Entertainment','',                 112.50],
    ['2026-03-01', 'JIFFY LUBE #7810',           'Vehicle',            'Lisa Rodriguez',    -74.88],
    ['2026-02-28', 'ALLSTATE QUARTERLY #2200',   'Insurance',          '',                -650.00],
    ['2026-02-26', 'EXXON #4419',               'Vehicle',            'Marcus Johnson',    -55.00]
  ];

  var balance = 24850.00; // Starting balance
  for (var i = 0; i < expenses.length; i++) {
    balance += expenses[i][4];
    expenses[i].push(balance);
    data.push(expenses[i]);
  }

  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  formatSheet(sheet, headers.length, data.length);
  sheet.getRange(2, 5, data.length - 1, 1).setNumberFormat('$#,##0.00;($#,##0.00)');
  sheet.getRange(2, 6, data.length - 1, 1).setNumberFormat('$#,##0.00');

  // Conditional: negative amounts red, positive green
  var amtRange = sheet.getRange(2, 5, data.length - 1, 1);
  amtRange.setFontColor(null); // reset
  for (var r = 2; r <= data.length; r++) {
    var val = sheet.getRange(r, 5).getValue();
    sheet.getRange(r, 5).setFontColor(val >= 0 ? '#66bb6a' : '#ef5350');
  }

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 140);
}

// ─── Earnest Money ────────────────────────────────────────────────
function setupEarnest(ss) {
  var sheet = getOrCreateSheet(ss, 'Earnest Money');
  sheet.clear();
  sheet.setTabColor('#ffb74d');

  var headers = ['Date', 'Property', 'Client', 'Amount', 'Disbursement Date'];
  var data = [headers];

  var entries = [
    ['2026-03-29', '412 Oak St, Clanton',          'Thompson Family',    2500.00, '2026-04-28'],
    ['2026-03-26', '1808 Peach Tree Ln, Jemison',  'Maria Gonzalez',     3000.00, '2026-04-25'],
    ['2026-03-22', '305 College St, Clanton',       'David & Amy Parks',  1500.00, '2026-04-20'],
    ['2026-03-18', '720 Lay Dam Rd, Clanton',       'Robert Chen',        5000.00, '2026-04-17'],
    ['2026-03-15', '55 7th Ave S, Clanton',         'Sarah Williams',     2000.00, '2026-04-14'],
    ['2026-03-10', '1200 County Rd 42, Maplesville','Jenkins Estate',    10000.00, '2026-04-09'],
    ['2026-03-07', '900 2nd Ave N, Clanton',        'Priya Patel',        3500.00, '2026-04-06'],
    ['2026-03-03', '445 Chilton Way, Thorsby',      'Mike & Jen Taylor',  2000.00, '2026-04-02'],
    ['2026-02-28', '1601 Airport Rd, Clanton',      'Anderson Group LLC', 7500.00, '2026-03-29'],
    ['2026-02-24', '88 Falkville Rd, Jemison',      'Linda Morrison',     1800.00, '2026-03-25'],
    ['2026-02-20', '2310 Hwy 31, Clanton',          'J. Harper & Sons',   4000.00, '2026-03-21'],
    ['2026-02-15', '110 Mulberry St, Clanton',       'Karen Nguyen',      2500.00, '2026-03-16']
  ];

  for (var i = 0; i < entries.length; i++) {
    data.push(entries[i]);
  }

  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  formatSheet(sheet, headers.length, data.length);
  sheet.getRange(2, 4, data.length - 1, 1).setNumberFormat('$#,##0.00');

  // Highlight rows where disbursement is within 7 days
  var today = new Date();
  for (var r = 2; r <= data.length; r++) {
    var disbDate = new Date(sheet.getRange(r, 5).getValue());
    var diff = (disbDate - today) / (1000 * 60 * 60 * 24);
    if (diff >= 0 && diff <= 7) {
      sheet.getRange(r, 1, 1, headers.length).setBackground('#3e2723'); // dark amber hint
      sheet.getRange(r, 5).setFontColor('#ffb74d').setFontWeight('bold');
    }
  }

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 150);
}

// ─── Commission Account ──────────────────────────────────────────
function setupCommission(ss) {
  var sheet = getOrCreateSheet(ss, 'Commission Account');
  sheet.clear();
  sheet.setTabColor('#81c784');

  var headers = ['Date', 'Agent', 'Property', 'Commission Amount', 'Split %'];
  var data = [headers];

  var entries = [
    ['2026-03-28', 'Sarah Mitchell',   '412 Oak St, Clanton',          8750.00,  '70/30'],
    ['2026-03-25', 'James Cooper',     '1808 Peach Tree Ln, Jemison', 12000.00,  '70/30'],
    ['2026-03-22', 'Lisa Rodriguez',   '305 College St, Clanton',      6500.00,  '60/40'],
    ['2026-03-18', 'Marcus Johnson',   '720 Lay Dam Rd, Clanton',     15200.00,  '75/25'],
    ['2026-03-15', 'Emily Parker',     '55 7th Ave S, Clanton',        5400.00,  '60/40'],
    ['2026-03-10', 'David Chen',       '1200 County Rd 42, Maplesville',21000.00,'80/20'],
    ['2026-03-07', 'Rachel Adams',     '900 2nd Ave N, Clanton',       9800.00,  '70/30'],
    ['2026-03-03', 'Tyler Brooks',     '445 Chilton Way, Thorsby',     7200.00,  '65/35'],
    ['2026-02-27', 'Amanda Foster',    '1601 Airport Rd, Clanton',    18500.00,  '75/25'],
    ['2026-02-24', 'Brian Williams',   '88 Falkville Rd, Jemison',     4800.00,  '60/40'],
    ['2026-02-20', 'Sarah Mitchell',   '2310 Hwy 31, Clanton',        11200.00,  '70/30'],
    ['2026-02-15', 'James Cooper',     '110 Mulberry St, Clanton',     8900.00,  '70/30'],
    ['2026-02-10', 'Lisa Rodriguez',   '616 Pine St, Verbena',         6100.00,  '60/40'],
    ['2026-02-05', 'Emily Parker',     '77 Dam Rd, Mitchell Lake',     7750.00,  '65/35']
  ];

  for (var i = 0; i < entries.length; i++) {
    data.push(entries[i]);
  }

  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  formatSheet(sheet, headers.length, data.length);
  sheet.getRange(2, 4, data.length - 1, 1).setNumberFormat('$#,##0.00');

  // Total row
  var totalRow = data.length + 1;
  sheet.getRange(totalRow, 1).setValue('');
  sheet.getRange(totalRow, 3).setValue('TOTAL').setFontWeight('bold').setFontColor('#81c784');
  sheet.getRange(totalRow, 4).setFormula('=SUM(D2:D' + data.length + ')').setFontWeight('bold').setNumberFormat('$#,##0.00').setFontColor('#81c784');

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 90);
}

// ─── Helpers ─────────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatSheet(sheet, cols, rows) {
  // Header row
  var headerRange = sheet.getRange(1, 1, 1, cols);
  headerRange
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Inter, Arial, sans-serif')
    .setBackground('#1e1e2e')
    .setFontColor('#e0e0e0')
    .setHorizontalAlignment('left');

  // Freeze header
  sheet.setFrozenRows(1);

  // Data rows
  if (rows > 1) {
    var dataRange = sheet.getRange(2, 1, rows - 1, cols);
    dataRange
      .setFontSize(10)
      .setFontFamily('Inter, Arial, sans-serif')
      .setFontColor('#ccc')
      .setVerticalAlignment('middle');

    // Alternating row colors
    for (var r = 2; r <= rows; r++) {
      var bg = r % 2 === 0 ? '#252536' : '#1a1a2e';
      sheet.getRange(r, 1, 1, cols).setBackground(bg);
    }
  }

  // Date columns left-aligned
  sheet.getRange(2, 1, Math.max(rows - 1, 1), 1).setNumberFormat('yyyy-mm-dd');

  // Borders
  sheet.getRange(1, 1, rows, cols).setBorder(
    false, false, false, false, false, true,
    '#333', SpreadsheetApp.BorderStyle.SOLID
  );
}
