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

// ═══════════════════════════════════════════
// ข้อมูล 3 สาขา
// ═══════════════════════════════════════════
const BRANCHES = {
  '1': { name: 'สาขา 1', startH: 8, startM: 0, endH: 22, endM: 0, grace: 0 },
  '2': { name: 'สาขา 2', startH: 8, startM: 0, endH: 20, endM: 0, grace: 0 },
  '3': { name: 'สาขา 3', startH: 8, startM: 0, endH: 21, endM: 0, grace: 0 },
};

let attendanceData = {};
// { userId: { name, logs: [{type, time, date, branch}], pendingAction } }

function getTodayBKK() {
  return new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function getTimeBKK() {
  return new Date().toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function getDateLabelBKK() {
  return new Date().toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
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

// ═══════════════════════════════════════════
// เมนูหลัก
// ═══════════════════════════════════════════
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
                cornerRadius: '10px', backgroundColor: 'rgba(255,255,255,0.18)',
                justifyContent: 'center', alignItems: 'center',
                contents: [{ type: 'text', text: 'YD', size: 'sm', weight: 'bold', color: '#ffffff', align: 'center' }]
              },
              {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'YD HR', weight: 'bold', size: 'xl', color: '#ffffff' },
                  { type: 'text', text: 'ระบบบันทึกเวลาทำงาน', size: 'xs', color: 'rgba(255,255,255,0.65)' }
                ]
              }
            ]
          },
          { type: 'separator', margin: '14px', color: 'rgba(255,255,255,0.2)' },
          {
            type: 'box', layout: 'horizontal', margin: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDC64', size: 'sm' },
              { type: 'text', text: '  สวัสดี, ' + name, size: 'sm', color: 'rgba(255,255,255,0.85)', flex: 1 }
            ]
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '\uD83D\uDCC5', size: 'sm' },
              { type: 'text', text: '  ' + getDateLabelBKK(), size: 'sm', color: 'rgba(255,255,255,0.65)', flex: 1, wrap: true }
            ]
          }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        backgroundColor: '#f7f9ff',
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
                backgroundColor: '#e8f0fb', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'ประวัติ', text: 'ประวัติวันนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCB', size: 'xl', align: 'center' },
                  { type: 'text', text: 'ประวัติวันนี้', size: 'sm', color: '#003d99', align: 'center', margin: '4px', weight: 'bold' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#eef3fb', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'สรุป', text: 'สรุปเดือนนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCA', size: 'xl', align: 'center' },
                  { type: 'text', text: 'สรุปเดือนนี้', size: 'sm', color: '#003d99', align: 'center', margin: '4px', weight: 'bold' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#f0f5ff',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE · YD HR System', size: 'xxs', color: '#aab', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// เลือกสาขา (แสดงก่อนเข้างาน)
// ═══════════════════════════════════════════
function createBranchSelector(action) {
  const actionLabel = action === 'in' ? 'เข้างาน' : 'ออกงาน';
  const actionIcon = action === 'in' ? '\u2705' : '\uD83D\uDEAA';
  return {
    type: 'flex',
    altText: 'เลือกสาขา',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: actionIcon, size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: actionLabel + ' — เลือกสาขา', weight: 'bold', color: '#ffffff', size: 'md' },
              { type: 'text', text: 'กรุณาเลือกสาขาที่ทำงานวันนี้', size: 'xs', color: 'rgba(255,255,255,0.65)' }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: [
          {
            type: 'box', layout: 'vertical', cornerRadius: '12px',
            backgroundColor: '#e8f0fb', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 1', text: action + '_branch_1' },
            contents: [
              { type: 'box', layout: 'horizontal', alignItems: 'center',
                contents: [
                  { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
                  { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                    contents: [
                      { type: 'text', text: 'สาขา 1', weight: 'bold', color: '#003d99', size: 'md' },
                      { type: 'text', text: '08:00 – 22:00 น.', size: 'xs', color: '#555' }
                    ]
                  },
                  { type: 'text', text: '\u276F', color: '#003d99', size: 'lg', align: 'end' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'vertical', cornerRadius: '12px',
            backgroundColor: '#e8f0fb', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 2', text: action + '_branch_2' },
            contents: [
              { type: 'box', layout: 'horizontal', alignItems: 'center',
                contents: [
                  { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
                  { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                    contents: [
                      { type: 'text', text: 'สาขา 2', weight: 'bold', color: '#003d99', size: 'md' },
                      { type: 'text', text: '08:00 – 20:00 น.', size: 'xs', color: '#555' }
                    ]
                  },
                  { type: 'text', text: '\u276F', color: '#003d99', size: 'lg', align: 'end' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'vertical', cornerRadius: '12px',
            backgroundColor: '#e8f0fb', paddingAll: '14px',
            action: { type: 'message', label: 'สาขา 3', text: action + '_branch_3' },
            contents: [
              { type: 'box', layout: 'horizontal', alignItems: 'center',
                contents: [
                  { type: 'text', text: '\uD83C\uDFE5', size: 'lg', flex: 0 },
                  { type: 'box', layout: 'vertical', margin: 'sm', flex: 1,
                    contents: [
                      { type: 'text', text: 'สาขา 3', weight: 'bold', color: '#003d99', size: 'md' },
                      { type: 'text', text: '08:00 – 21:00 น.', size: 'xs', color: '#555' }
                    ]
                  },
                  { type: 'text', text: '\u276F', color: '#003d99', size: 'lg', align: 'end' }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}

// ═══════════════════════════════════════════
// ผลเข้างาน
// ═══════════════════════════════════════════
function createCheckInResult(name, time, lateMin, branchId) {
  const isLate = lateMin > 0;
  const branch = BRANCHES[branchId];

  const lateBlock = isLate ? {
    type: 'box', layout: 'vertical', margin: 'md',
    backgroundColor: '#fef2f2', cornerRadius: '12px', paddingAll: '16px',
    contents: [
      { type: 'text', text: '\u26A0\uFE0F มาสาย', size: 'sm', color: '#b91c1c', align: 'center', weight: 'bold' },
      { type: 'text', text: lateMin + ' นาที', size: '5xl', weight: 'bold', color: '#b91c1c', align: 'center' },
      { type: 'text', text: 'สายจากเวลา 08:00 น.', size: 'xxs', color: '#dc2626', align: 'center', wrap: true, margin: 'sm' }
    ]
  } : {
    type: 'box', layout: 'vertical', margin: 'md',
    backgroundColor: '#e8f0fb', cornerRadius: '12px', paddingAll: '14px',
    contents: [
      { type: 'text', text: '\uD83C\uDF89 มาตรงเวลา', size: 'lg', weight: 'bold', color: '#003d99', align: 'center' },
      { type: 'text', text: 'ขอบคุณที่มาตรงเวลานะครับ', size: 'xs', color: '#0057d8', align: 'center', margin: 'sm' }
    ]
  };

  return {
    type: 'flex',
    altText: (isLate ? '\u26A0\uFE0F ' + name + ' มาสาย ' + lateMin + ' นาที' : '\u2705 ' + name + ' เข้างานตรงเวลา') + ' ' + branch.name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isLate ? '#b91c1c' : '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: isLate ? '\u26A0\uFE0F' : '\u2705', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'บันทึกเข้างาน', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: 'YD HR · ' + branch.name, size: 'xs', color: 'rgba(255,255,255,0.65)' }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#111', align: 'center' },
          {
            type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center', justifyContent: 'center',
            contents: [
              { type: 'text', text: '\uD83C\uDFE5 ' + branch.name, size: 'xs', color: '#003d99', align: 'center',
                backgroundColor: '#e8f0fb', cornerRadius: '20px' }
            ]
          },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#999', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: isLate ? '#fff5f5' : '#f0f5ff', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาเข้างาน', size: 'xs', color: '#888', align: 'center', letterSpacing: '1px' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm',
                color: isLate ? '#b91c1c' : '#003d99' }
            ]
          },
          { type: 'separator', margin: 'md', color: isLate ? '#fca5a5' : '#c7d8f8' },
          lateBlock
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: isLate ? '#fff5f5' : '#f0f5ff',
        contents: [{
          type: 'text',
          text: isLate ? ('\uD83D\uDD34 สายรวมวันนี้ ' + lateMin + ' นาที') : '\uD83D\uDFE2 ตรงเวลา',
          size: 'xs', color: isLate ? '#b91c1c' : '#003d99', align: 'center', weight: 'bold'
        }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// ผลออกงาน
// ═══════════════════════════════════════════
function createCheckOutResult(name, time, inTime, branchId) {
  const branch = BRANCHES[branchId];
  const inLate = inTime ? calcLateMinutes(inTime, branchId) : 0;
  return {
    type: 'flex',
    altText: '\uD83D\uDEAA ' + name + ' ออกงาน ' + time + ' น. ' + branch.name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#003d99',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDEAA', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'บันทึกออกงาน', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: 'YD HR · ' + branch.name, size: 'xs', color: 'rgba(255,255,255,0.65)' }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#111', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#999', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: '#eef3fb', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาออกงาน', size: 'xs', color: '#888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm', color: '#003d99' }
            ]
          },
          { type: 'separator', margin: 'lg', color: '#c7d8f8' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: inLate > 0 ? '#fef2f2' : '#e8f0fb', cornerRadius: '10px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'เข้างาน', size: 'xxs', color: '#888', align: 'center' },
                  { type: 'text', text: inTime ? inTime + ' น.' : '-', size: 'md', weight: 'bold', align: 'center',
                    color: inLate > 0 ? '#b91c1c' : '#003d99' },
                  inLate > 0
                    ? { type: 'text', text: 'สาย ' + inLate + ' นาที', size: 'xxs', color: '#b91c1c', align: 'center', weight: 'bold' }
                    : { type: 'text', text: 'ตรงเวลา', size: 'xxs', color: '#003d99', align: 'center' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#eef3fb', cornerRadius: '10px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'ออกงาน', size: 'xxs', color: '#888', align: 'center' },
                  { type: 'text', text: time + ' น.', size: 'md', weight: 'bold', align: 'center', color: '#003d99' },
                  { type: 'text', text: 'เรียบร้อย', size: 'xxs', color: '#003d99', align: 'center' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#f0f5ff',
        contents: [{ type: 'text', text: '\uD83D\uDC4B เดินทางกลับบ้านปลอดภัยนะครับ', size: 'xs', color: '#003d99', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// ประวัติวันนี้
// ═══════════════════════════════════════════
function createTodayHistory(name, logs) {
  const rows = logs.map(function(l) {
    const lateMin = l.type === 'in' ? calcLateMinutes(l.time, l.branch) : 0;
    const isLate = lateMin > 0;
    const branch = BRANCHES[l.branch] || { name: 'ไม่ระบุ' };
    return {
      type: 'box', layout: 'vertical', cornerRadius: '10px', paddingAll: '10px', marginBottom: '6px',
      backgroundColor: l.type === 'in' ? (isLate ? '#fef2f2' : '#f0f5ff') : '#eef3fb',
      contents: [
        {
          type: 'box', layout: 'horizontal', alignItems: 'center',
          contents: [
            { type: 'text', text: l.type === 'in' ? '\u2705 เข้างาน' : '\uD83D\uDEAA ออกงาน', size: 'sm', weight: 'bold', flex: 1,
              color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' },
            { type: 'text', text: l.time + ' น.', size: 'md', weight: 'bold', align: 'end',
              color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' }
          ]
        },
        {
          type: 'box', layout: 'horizontal', margin: 'xs',
          contents: [
            { type: 'text', text: '\uD83C\uDFE5 ' + branch.name, size: 'xxs', color: '#666', flex: 1 },
            l.type === 'in'
              ? (isLate
                  ? { type: 'text', text: '\u26A0\uFE0F สาย ' + lateMin + ' นาที', size: 'xxs', color: '#b91c1c', align: 'end', weight: 'bold' }
                  : { type: 'text', text: '\u2713 ตรงเวลา', size: 'xxs', color: '#003d99', align: 'end' })
              : { type: 'text', text: '— ออกงาน', size: 'xxs', color: '#888', align: 'end' }
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
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'ประวัติวันนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: name + ' · ' + getDateLabelBKK(), size: 'xxs', color: 'rgba(255,255,255,0.65)', wrap: true }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: rows.length > 0 ? rows.concat([
          { type: 'separator', margin: 'md', color: totalLateToday > 0 ? '#fca5a5' : '#c7d8f8' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            backgroundColor: totalLateToday > 0 ? '#fef2f2' : '#e8f0fb',
            cornerRadius: '8px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายวันนี้', size: 'xs', color: totalLateToday > 0 ? '#b91c1c' : '#003d99', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLateToday > 0 ? totalLateToday + ' นาที' : '0 นาที (ตรงเวลา)',
                size: 'xs', weight: 'bold', align: 'end', color: totalLateToday > 0 ? '#b91c1c' : '#003d99' }
            ]
          }
        ]) : [{ type: 'text', text: 'ยังไม่มีการลงเวลาวันนี้', color: '#aaa', align: 'center', size: 'sm' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// สรุปเดือนนี้
// ═══════════════════════════════════════════
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

  // สรุปแยกสาขา
  const branchSummary = ['1','2','3'].map(function(bid) {
    const b = BRANCHES[bid];
    const bLogs = monthLogs.filter(function(l){ return l.branch === bid; });
    const bLate = bLogs.filter(function(l){ return calcLateMinutes(l.time, bid) > 0; }).length;
    const bLateMin = bLogs.reduce(function(s,l){ return s + calcLateMinutes(l.time, bid); }, 0);
    return {
      type: 'box', layout: 'horizontal', paddingAll: '8px', cornerRadius: '8px',
      backgroundColor: '#f0f5ff', marginBottom: '5px',
      contents: [
        { type: 'text', text: '\uD83C\uDFE5 ' + b.name, size: 'xs', color: '#003d99', flex: 2, weight: 'bold' },
        { type: 'text', text: bLogs.length + ' วัน', size: 'xs', color: '#444', flex: 1, align: 'center' },
        { type: 'text', text: bLate > 0 ? 'สาย ' + bLate + ' วัน (' + bLateMin + ' น.)' : 'ตรงเวลา \u2713',
          size: 'xs', flex: 3, align: 'end', color: bLate > 0 ? '#b91c1c' : '#003d99', weight: bLate > 0 ? 'bold' : 'regular' }
      ]
    };
  });

  return {
    type: 'flex',
    altText: '\uD83D\uDCCA ' + name + ' สาย ' + lateDays + ' วัน รวม ' + totalLateMin + ' นาที',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#001f66',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDCCA', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'สรุปเดือนนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: name + ' · ' + monthName, size: 'xxs', color: 'rgba(255,255,255,0.65)', wrap: true }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#e8f0fb', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(totalDays), size: '3xl', weight: 'bold', color: '#003d99', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#003d99', align: 'center' },
                  { type: 'text', text: 'ทำงานทั้งหมด', size: 'xxs', color: '#888', align: 'center', margin: 'sm' }
                ]
              },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#eef5e8', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(onTimeDays), size: '3xl', weight: 'bold', color: '#166534', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#166534', align: 'center' },
                  { type: 'text', text: 'มาตรงเวลา', size: 'xxs', color: '#888', align: 'center', margin: 'sm' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#fef2f2', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(lateDays), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'มาสาย', size: 'xxs', color: '#888', align: 'center', margin: 'sm' },
                  lateDays > 0
                    ? { type: 'text', text: '\u26A0 ' + lateDays + ' วัน', size: 'xxs', color: '#b91c1c', align: 'center', weight: 'bold' }
                    : { type: 'text', text: '\uD83C\uDF89 ไม่มีสาย', size: 'xxs', color: '#166534', align: 'center' }
                ]
              },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#fff5f5', cornerRadius: '12px', paddingAll: '12px',
                contents: [
                  { type: 'text', text: String(totalLateMin), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'นาที', size: 'xxs', color: '#b91c1c', align: 'center' },
                  { type: 'text', text: 'รวมสายทั้งหมด', size: 'xxs', color: '#888', align: 'center', margin: 'sm' },
                  totalLateMin > 0
                    ? { type: 'text', text: '\uD83D\uDD34 รวม ' + totalLateMin + ' นาที', size: 'xxs', color: '#b91c1c', align: 'center', weight: 'bold' }
                    : { type: 'text', text: '\u2705 ไม่มีสาย', size: 'xxs', color: '#166534', align: 'center' }
                ]
              }
            ]
          },
          { type: 'separator', color: '#c7d8f8' },
          { type: 'text', text: 'แยกตามสาขา', size: 'xs', color: '#003d99', weight: 'bold', margin: 'sm' },
          ...branchSummary,
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            backgroundColor: totalLateMin > 0 ? '#fef2f2' : '#e8f0fb',
            cornerRadius: '10px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายเดือนนี้', size: 'sm', color: '#b91c1c', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLateMin + ' นาที', size: 'sm', color: '#b91c1c', align: 'end', weight: 'bold' }
            ]
          },
          totalLateMin > 0
            ? { type: 'text', text: 'คิดเป็น ' + Math.floor(totalLateMin/60) + ' ชั่วโมง ' + (totalLateMin%60) + ' นาที', size: 'xxs', color: '#dc2626', align: 'end' }
            : { type: 'text', text: 'ยอดเยี่ยม! ไม่มีการมาสายเลย \uD83C\uDF89', size: 'xs', color: '#003d99', align: 'center' }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#f0f5ff',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE · YD HR System', size: 'xxs', color: '#7788bb', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// Webhook
// ═══════════════════════════════════════════
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
    attendanceData[userId] = { name: userName, logs: [], pendingAction: null };
  } else {
    attendanceData[userId].name = userName;
  }

  const today = getTodayBKK();
  const now = getTimeBKK();
  const todayLogs = getTodayLogs(userId);
  const lastLog = todayLogs[todayLogs.length - 1];

  // เมนูหลัก
  if (['เมนู', 'menu', 'hr', 'HR', 'ยาดีเชียงใหม่', 'yadee'].includes(text)) {
    attendanceData[userId].pendingAction = null;
    await client.replyMessage({ replyToken, messages: [createMainMenu(userName)] });
    return;
  }

  // เข้างาน → แสดงเลือกสาขา
  if (text === 'เข้างาน') {
    if (lastLog && lastLog.type === 'in') {
      await client.replyMessage({ replyToken, messages: [{
        type: 'text', text: '\u26A0\uFE0F คุณลงเวลาเข้างานแล้ว\nเวลา ' + lastLog.time + ' น. (' + (BRANCHES[lastLog.branch] || {name:''}).name + ')\n\nหากต้องการออกงาน กด "ออกงาน"'
      }]});
      return;
    }
    attendanceData[userId].pendingAction = 'in';
    await client.replyMessage({ replyToken, messages: [createBranchSelector('in')] });
    return;
  }

  // ออกงาน → แสดงเลือกสาขา
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
    attendanceData[userId].pendingAction = 'out';
    await client.replyMessage({ replyToken, messages: [createBranchSelector('out')] });
    return;
  }

  // รับการเลือกสาขา in_branch_1 / in_branch_2 / in_branch_3
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
      attendanceData[userId].pendingAction = null;
      await client.replyMessage({ replyToken, messages: [createCheckInResult(userName, now, lateMin, branchId)] });
    } else {
      const inLog = todayLogs.find(function(l){ return l.type === 'in'; });
      attendanceData[userId].logs.push({ type: 'out', time: now, date: today, branch: branchId });
      attendanceData[userId].pendingAction = null;
      await client.replyMessage({ replyToken, messages: [createCheckOutResult(userName, now, inLog ? inLog.time : null, branchId)] });
    }
    return;
  }

  // ประวัติวันนี้
  if (text === 'ประวัติวันนี้') {
    await client.replyMessage({ replyToken, messages: [createTodayHistory(userName, todayLogs)] });
    return;
  }

  // สรุปเดือนนี้
  if (text === 'สรุปเดือนนี้') {
    await client.replyMessage({ replyToken, messages: [createMonthlySummary(userName, attendanceData[userId].logs)] });
    return;
  }

  // ข้อความอื่น
  await client.replyMessage({ replyToken, messages: [
    { type: 'text', text: 'สวัสดีครับ ' + userName + ' \uD83D\uDC4B\n\nพิมพ์ว่า "ยาดีเชียงใหม่" เพื่อเริ่มใช้งานระบบลงเวลาได้เลยครับ' },
    createMainMenu(userName)
  ]});
}

app.get('/', (req, res) => res.send('YD HR Bot is running! \uD83D\uDFE2'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('YD HR Bot running on port ' + PORT));
