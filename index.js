const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const BRANCHES = {
  '1': { name: 'สาขา 1', startH: 8, startM: 0, endH: 22, endM: 0, grace: 0 },
  '2': { name: 'สาขา 2', startH: 8, startM: 0, endH: 20, endM: 0, grace: 0 },
  '3': { name: 'สาขา 3', startH: 8, startM: 0, endH: 21, endM: 0, grace: 0 },
};

let attendanceData = {};

function getTodayBKK() {
  return new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function getTimeBKK() {
  return new Date().toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function getDateLabelBKK() {
  return new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function calcLateMinutes(timeStr, branch) {
  const b = BRANCHES[branch];
  if (!b) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const workStart = b.startH * 60 + b.startM + b.grace;
  const arrival = h * 60 + m;
  return arrival > workStart ? arrival - workStart : 0;
}

function getTodayLogs(userId) {
  const today = getTodayBKK();
  if (!attendanceData[userId]) return [];
  return attendanceData[userId].logs.filter(l => l.date === today);
}

// เมนูหลัก
function createMainMenu(name) {
  return {
    type: 'flex',
    altText: 'เมนู YD HR',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        backgroundColor: '#003d99',
        contents: [
          {
            type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', width: '44px', height: '44px',
                cornerRadius: '10px', backgroundColor: '#0057cc',
                justifyContent: 'center', alignItems: 'center',
                contents: [{ type: 'text', text: 'YD', size: 'sm', weight: 'bold', color: '#ffffff', align: 'center' }]
              },
              {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'YD HR', weight: 'bold', size: 'xl', color: '#ffffff' },
                  { type: 'text', text: 'ระบบบันทึกเวลาทำงาน', size: 'xs', color: '#99bbff' }
                ]
              }
            ]
          },
          { type: 'separator', margin: '14px', color: '#0057cc' },
          { type: 'text', text: '\uD83D\uDC64  สวัสดี, ' + name, size: 'sm', color: '#cce0ff', margin: '10px' },
          { type: 'text', text: '\uD83D\uDCC5  ' + getDateLabelBKK(), size: 'xs', color: '#99bbff', wrap: true }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        backgroundColor: '#f0f5ff',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#003d99', cornerRadius: '12px',
                paddingAll: '14px', alignItems: 'center',
                action: { type: 'message', label: 'เข้างาน', text: 'เข้างาน' },
                contents: [
                  { type: 'text', text: '\u2705', size: 'xxl', align: 'center' },
                  { type: 'text', text: 'เข้างาน', weight: 'bold', color: '#ffffff', size: 'sm', align: 'center', margin: '6px' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#b91c1c', cornerRadius: '12px',
                paddingAll: '14px', alignItems: 'center',
                action: { type: 'message', label: 'ออกงาน', text: 'ออกงาน' },
                contents: [
                  { type: 'text', text: '\uD83D\uDEAA', size: 'xxl', align: 'center' },
                  { type: 'text', text: 'ออกงาน', weight: 'bold', color: '#ffffff', size: 'sm', align: 'center', margin: '6px' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#dbeafe', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'ประวัติ', text: 'ประวัติวันนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCB', size: 'xl', align: 'center' },
                  { type: 'text', text: 'ประวัติวันนี้', size: 'sm', color: '#1e3a8a', align: 'center', margin: '4px', weight: 'bold' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#e0e7ff', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'สรุป', text: 'สรุปเดือนนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCA', size: 'xl', align: 'center' },
                  { type: 'text', text: 'สรุปเดือนนี้', size: 'sm', color: '#1e3a8a', align: 'center', margin: '4px', weight: 'bold' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#e8f0fe',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE \u00B7 YD HR System', size: 'xxs', color: '#7799cc', align: 'center' }]
      }
    }
  };
}

// เลือกสาขา
function createBranchSelector(action) {
  const isIn = action === 'in';
  return {
    type: 'flex',
    altText: 'เลือกสาขา',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isIn ? '#003d99' : '#b91c1c',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: isIn ? '\u2705' : '\uD83D\uDEAA', size: 'xl' },
            { type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: (isIn ? 'เข้างาน' : 'ออกงาน') + ' \u2014 เลือกสาขา', weight: 'bold', color: '#ffffff', size: 'md' },
                { type: 'text', text: 'กรุณาเลือกสาขาที่ทำงานวันนี้', size: 'xs', color: '#ccddff' }
              ]
            }
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: [
          {
            type: 'box', layout: 'horizontal', alignItems: 'center',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 1', text: action + '_branch_1' },
            contents: [
              { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
              { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                contents: [
                  { type: 'text', text: 'สาขา 1', weight: 'bold', color: '#1e3a8a', size: 'md' },
                  { type: 'text', text: '08:00 \u2013 22:00 น.', size: 'xs', color: '#555' }
                ]
              },
              { type: 'text', text: '\u276F', color: '#003d99', size: 'lg' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', alignItems: 'center',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 2', text: action + '_branch_2' },
            contents: [
              { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
              { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                contents: [
                  { type: 'text', text: 'สาขา 2', weight: 'bold', color: '#1e3a8a', size: 'md' },
                  { type: 'text', text: '08:00 \u2013 20:00 น.', size: 'xs', color: '#555' }
                ]
              },
              { type: 'text', text: '\u276F', color: '#003d99', size: 'lg' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', alignItems: 'center',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 3', text: action + '_branch_3' },
            contents: [
              { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
              { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                contents: [
                  { type: 'text', text: 'สาขา 3', weight: 'bold', color: '#1e3a8a', size: 'md' },
                  { type: 'text', text: '08:00 \u2013 21:00 น.', size: 'xs', color: '#555' }
                ]
              },
              { type: 'text', text: '\u276F', color: '#003d99', size: 'lg' }
            ]
          }
        ]
      }
    }
  };
}

// ผลเข้างาน
function createCheckInResult(name, time, lateMin, branchId) {
  const isLate = lateMin > 0;
  const branch = BRANCHES[branchId];
  return {
    type: 'flex',
    altText: (isLate ? '\u26A0\uFE0F มาสาย ' + lateMin + ' นาที' : '\u2705 มาตรงเวลา') + ' \u2014 ' + branch.name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isLate ? '#b91c1c' : '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: isLate ? '\u26A0\uFE0F' : '\u2705', size: 'xl' },
            { type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: 'บันทึกเข้างาน', weight: 'bold', color: '#ffffff', size: 'lg' },
                { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#ccddff' }
              ]
            }
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#111111', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#999999', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: isLate ? '#fee2e2' : '#dbeafe',
            cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาเข้างาน', size: 'xs', color: '#888888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm',
                color: isLate ? '#b91c1c' : '#003d99' }
            ]
          },
          isLate ? {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#fee2e2', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: '\u26A0\uFE0F มาสาย', size: 'sm', color: '#b91c1c', align: 'center', weight: 'bold' },
              { type: 'text', text: String(lateMin) + ' นาที', size: '5xl', weight: 'bold', color: '#b91c1c', align: 'center' },
              { type: 'text', text: 'สายจากเวลา 08:00 น.', size: 'xxs', color: '#dc2626', align: 'center', margin: 'sm' }
            ]
          } : {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
            contents: [
              { type: 'text', text: '\uD83C\uDF89 มาตรงเวลา', size: 'lg', weight: 'bold', color: '#003d99', align: 'center' },
              { type: 'text', text: 'ขอบคุณที่มาตรงเวลานะครับ', size: 'xs', color: '#1d4ed8', align: 'center', margin: 'sm' }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: isLate ? '#fee2e2' : '#dbeafe',
        contents: [{
          type: 'text',
          text: isLate ? '\uD83D\uDD34 สายรวมวันนี้ ' + lateMin + ' นาที' : '\uD83D\uDFE2 ตรงเวลา',
          size: 'xs', color: isLate ? '#b91c1c' : '#003d99', align: 'center', weight: 'bold'
        }]
      }
    }
  };
}

// ผลออกงาน
function createCheckOutResult(name, time, inTime, branchId) {
  const branch = BRANCHES[branchId];
  const inLate = inTime ? calcLateMinutes(inTime, branchId) : 0;
  return {
    type: 'flex',
    altText: '\uD83D\uDEAA ออกงาน ' + time + ' น. \u2014 ' + branch.name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDEAA', size: 'xl' },
            { type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: 'บันทึกออกงาน', weight: 'bold', color: '#ffffff', size: 'lg' },
                { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#99bbff' }
              ]
            }
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#111111', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#999999', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาออกงาน', size: 'xs', color: '#888888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm', color: '#003d99' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: inLate > 0 ? '#fee2e2' : '#dbeafe',
                cornerRadius: '10px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'เข้างาน', size: 'xxs', color: '#888888', align: 'center' },
                  { type: 'text', text: inTime ? inTime + ' น.' : '-', size: 'md', weight: 'bold', align: 'center',
                    color: inLate > 0 ? '#b91c1c' : '#003d99' },
                  inLate > 0
                    ? { type: 'text', text: 'สาย ' + inLate + ' นาที', size: 'xxs', color: '#b91c1c', align: 'center', weight: 'bold' }
                    : { type: 'text', text: 'ตรงเวลา', size: 'xxs', color: '#003d99', align: 'center' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#dbeafe', cornerRadius: '10px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'ออกงาน', size: 'xxs', color: '#888888', align: 'center' },
                  { type: 'text', text: time + ' น.', size: 'md', weight: 'bold', align: 'center', color: '#003d99' },
                  { type: 'text', text: 'เรียบร้อย', size: 'xxs', color: '#003d99', align: 'center' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#dbeafe',
        contents: [{ type: 'text', text: '\uD83D\uDC4B เดินทางกลับบ้านปลอดภัยนะครับ', size: 'xs', color: '#003d99', align: 'center' }]
      }
    }
  };
}

// ประวัติวันนี้
function createTodayHistory(name, logs) {
  const rows = logs.map(function(l) {
    const lateMin = l.type === 'in' ? calcLateMinutes(l.time, l.branch) : 0;
    const isLate = lateMin > 0;
    const branch = BRANCHES[l.branch] || { name: 'ไม่ระบุ' };
    return {
      type: 'box', layout: 'horizontal', alignItems: 'center',
      backgroundColor: l.type === 'in' ? (isLate ? '#fee2e2' : '#dbeafe') : '#e0e7ff',
      cornerRadius: '10px', paddingAll: '10px',
      contents: [
        { type: 'box', layout: 'vertical', flex: 1,
          contents: [
            { type: 'text', text: l.type === 'in' ? '\u2705 เข้างาน' : '\uD83D\uDEAA ออกงาน',
              size: 'sm', weight: 'bold', color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' },
            { type: 'text', text: '\uD83C\uDFE5 ' + branch.name, size: 'xxs', color: '#666666' }
          ]
        },
        { type: 'box', layout: 'vertical', alignItems: 'flex-end',
          contents: [
            { type: 'text', text: l.time + ' น.', size: 'md', weight: 'bold',
              color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' },
            l.type === 'in'
              ? (isLate
                  ? { type: 'text', text: '\u26A0\uFE0F สาย ' + lateMin + ' นาที', size: 'xxs', color: '#b91c1c', weight: 'bold' }
                  : { type: 'text', text: '\u2713 ตรงเวลา', size: 'xxs', color: '#003d99' })
              : { type: 'text', text: '\u2014 ออกงาน', size: 'xxs', color: '#888888' }
          ]
        }
      ]
    };
  });

  const totalLateToday = logs.filter(function(l){ return l.type === 'in'; })
    .reduce(function(s, l){ return s + calcLateMinutes(l.time, l.branch); }, 0);

  return {
    type: 'flex',
    altText: '\uD83D\uDCCB ประวัติวันนี้ของ ' + name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDCCB', size: 'xl' },
            { type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: 'ประวัติวันนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
                { type: 'text', text: name, size: 'xs', color: '#99bbff' }
              ]
            }
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: rows.length > 0 ? rows.concat([
          { type: 'separator', margin: 'md', color: '#93c5fd' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            backgroundColor: totalLateToday > 0 ? '#fee2e2' : '#dbeafe',
            cornerRadius: '8px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายวันนี้', size: 'xs', color: totalLateToday > 0 ? '#b91c1c' : '#003d99', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLateToday > 0 ? totalLateToday + ' นาที' : '0 นาที',
                size: 'xs', weight: 'bold', align: 'end', color: totalLateToday > 0 ? '#b91c1c' : '#003d99' }
            ]
          }
        ]) : [{ type: 'text', text: 'ยังไม่มีการลงเวลาวันนี้', color: '#aaaaaa', align: 'center', size: 'sm' }]
      }
    }
  };
}

// สรุปเดือนนี้
function createMonthlySummary(name, logs) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthLogs = logs.filter(function(l) {
    const parts = l.date.split('/');
    return parts[1] === month && l.type === 'in';
  });
  const totalDays = monthLogs.length;
  const lateDays = monthLogs.filter(function(l){ return calcLateMinutes(l.time, l.branch) > 0; }).length;
  const totalLateMin = monthLogs.reduce(function(s, l){ return s + calcLateMinutes(l.time, l.branch); }, 0);
  const onTimeDays = totalDays - lateDays;
  const monthName = now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long', year: 'numeric' });

  const branchRows = ['1','2','3'].map(function(bid) {
    const b = BRANCHES[bid];
    const bLogs = monthLogs.filter(function(l){ return l.branch === bid; });
    const bLate = bLogs.filter(function(l){ return calcLateMinutes(l.time, bid) > 0; }).length;
    const bLateMin = bLogs.reduce(function(s,l){ return s + calcLateMinutes(l.time, bid); }, 0);
    return {
      type: 'box', layout: 'horizontal', alignItems: 'center',
      backgroundColor: '#dbeafe', cornerRadius: '8px', paddingAll: '8px',
      contents: [
        { type: 'text', text: '\uD83C\uDFE5 ' + b.name, size: 'xs', color: '#1e3a8a', flex: 2, weight: 'bold' },
        { type: 'text', text: bLogs.length + ' วัน', size: 'xs', color: '#444444', flex: 1, align: 'center' },
        { type: 'text', text: bLate > 0 ? 'สาย ' + bLate + ' วัน (' + bLateMin + ' น.)' : 'ตรงเวลา \u2713',
          size: 'xs', flex: 3, align: 'end', color: bLate > 0 ? '#b91c1c' : '#003d99',
          weight: bLate > 0 ? 'bold' : 'regular' }
      ]
    };
  });

  return {
    type: 'flex',
    altText: '\uD83D\uDCCA สรุปเดือนนี้ ' + name + ' สาย ' + totalLateMin + ' นาที',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#001f66',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDCCA', size: 'xl' },
            { type: 'box', layout: 'vertical',
              contents: [
                { type: 'text', text: 'สรุปเดือนนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
                { type: 'text', text: name + ' \u00B7 ' + monthName, size: 'xxs', color: '#99bbff', wrap: true }
              ]
            }
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(totalDays), size: '3xl', weight: 'bold', color: '#003d99', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#003d99', align: 'center' },
                  { type: 'text', text: 'ทำงานทั้งหมด', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#dcfce7', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(onTimeDays), size: '3xl', weight: 'bold', color: '#166534', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#166534', align: 'center' },
                  { type: 'text', text: 'มาตรงเวลา', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#fee2e2', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(lateDays), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'มาสาย', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#fef2f2', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(totalLateMin), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'นาที', size: 'xxs', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'รวมสายทั้งหมด', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              }
            ]
          },
          { type: 'separator', color: '#93c5fd', margin: 'sm' },
          { type: 'text', text: 'แยกตามสาขา', size: 'xs', color: '#003d99', weight: 'bold', margin: 'sm' },
          ...branchRows,
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            backgroundColor: totalLateMin > 0 ? '#fee2e2' : '#dbeafe',
            cornerRadius: '10px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายเดือนนี้', size: 'sm', color: '#b91c1c', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLateMin + ' นาที', size: 'sm', color: '#b91c1c', align: 'end', weight: 'bold' }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#dbeafe',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE \u00B7 YD HR System', size: 'xxs', color: '#7799cc', align: 'center' }]
      }
    }
  };
}

// Webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();
  for (const event of req.body.events) {
    await handleEvent(event);
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  const text = event.message.text.trim();
  const replyToken = event.replyToken;

  let userName = 'พนักงาน';
  try {
    const profile = await client.getProfile(userId);
    userName = profile.displayName;
  } catch (e) {}

  if (!attendanceData[userId]) {
    attendanceData[userId] = { name: userName, logs: [] };
  } else {
    attendanceData[userId].name = userName;
  }

  const today = getTodayBKK();
  const now = getTimeBKK();
  const todayLogs = getTodayLogs(userId);
  const lastLog = todayLogs[todayLogs.length - 1];

  if (['เมนู', 'menu', 'hr', 'HR', 'ยาดีเชียงใหม่', 'yadee'].includes(text)) {
    await client.replyMessage({ replyToken, messages: [createMainMenu(userName)] });
    return;
  }

  if (text === 'เข้างาน') {
    if (lastLog && lastLog.type === 'in') {
      await client.replyMessage({ replyToken, messages: [{ type: 'text',
        text: '\u26A0\uFE0F คุณลงเวลาเข้างานแล้ว\nเวลา ' + lastLog.time + ' น. (' + (BRANCHES[lastLog.branch] || {name:''}).name + ')\n\nหากต้องการออกงาน กด "ออกงาน"'
      }]});
      return;
    }
    await client.replyMessage({ replyToken, messages: [createBranchSelector('in')] });
    return;
  }

  if (text === 'ออกงาน') {
    const inLog = todayLogs.find(function(l){ return l.type === 'in'; });
    if (!inLog) {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '\u26A0\uFE0F ยังไม่ได้ลงเวลาเข้างานวันนี้\nกรุณากด "เข้างาน" ก่อนนะครับ' }] });
      return;
    }
    if (lastLog && lastLog.type === 'out') {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '\u26A0\uFE0F คุณลงเวลาออกงานแล้ว\nเวลา ' + lastLog.time + ' น.' }] });
      return;
    }
    await client.replyMessage({ replyToken, messages: [createBranchSelector('out')] });
    return;
  }

  if (text.startsWith('in_branch_') || text.startsWith('out_branch_')) {
    const parts = text.split('_');
    const action = parts[0];
    const branchId = parts[2];
    if (!BRANCHES[branchId]) {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: 'ไม่พบสาขาที่เลือกครับ' }] });
      return;
    }
    if (action === 'in') {
      const lateMin = calcLateMinutes(now, branchId);
      attendanceData[userId].logs.push({ type: 'in', time: now, date: today, branch: branchId });
      await client.replyMessage({ replyToken, messages: [createCheckInResult(userName, now, lateMin, branchId)] });
    } else {
      const inLog = todayLogs.find(function(l){ return l.type === 'in'; });
      attendanceData[userId].logs.push({ type: 'out', time: now, date: today, branch: branchId });
      await client.replyMessage({ replyToken, messages: [createCheckOutResult(userName, now, inLog ? inLog.time : null, branchId)] });
    }
    return;
  }

  if (text === 'ประวัติวันนี้') {
    await client.replyMessage({ replyToken, messages: [createTodayHistory(userName, todayLogs)] });
    return;
  }

  if (text === 'สรุปเดือนนี้') {
    await client.replyMessage({ replyToken, messages: [createMonthlySummary(userName, attendanceData[userId].logs)] });
    return;
  }

  await client.replyMessage({ replyToken, messages: [
    { type: 'text', text: 'สวัสดีครับ ' + userName + ' \uD83D\uDC4B\n\nพิมพ์ว่า "ยาดีเชียงใหม่" เพื่อเริ่มใช้งานระบบลงเวลาได้เลยครับ' },
    createMainMenu(userName)
  ]});
}

app.get('/', (req, res) => res.send('YD HR Bot is running! \uD83D\uDFE2'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('YD HR Bot running on port ' + PORT));
