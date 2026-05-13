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

const WORK_START_HOUR = 9;
const WORK_START_MIN = 0;
const LATE_GRACE_MIN = 5;

let attendanceData = {};

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

function calcLateMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const workStart = WORK_START_HOUR * 60 + WORK_START_MIN + LATE_GRACE_MIN;
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
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        backgroundColor: '#0F6E56',
        contents: [
          {
            type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical',
                width: '48px', height: '48px', cornerRadius: '24px',
                backgroundColor: '#ffffff',
                justifyContent: 'center', alignItems: 'center',
                contents: [{ type: 'text', text: '\uD83C\uDFE2', size: 'xl', align: 'center' }]
              },
              {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'YD HR', weight: 'bold', size: 'xl', color: '#ffffff' },
                  { type: 'text', text: 'ระบบบันทึกเวลาทำงาน', size: 'xs', color: '#9FE1CB' }
                ]
              }
            ]
          },
          { type: 'separator', margin: '16px', color: '#1D9E75' },
          {
            type: 'box', layout: 'horizontal', margin: '12px',
            contents: [
              { type: 'text', text: '\uD83D\uDC64', size: 'sm' },
              { type: 'text', text: '  สวัสดี, ' + name, size: 'sm', color: '#E1F5EE', flex: 1 }
            ]
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '\uD83D\uDCC5', size: 'sm' },
              { type: 'text', text: '  ' + getDateLabelBKK(), size: 'sm', color: '#9FE1CB', flex: 1, wrap: true }
            ]
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        backgroundColor: '#f8fffe',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#1D9E75', cornerRadius: '12px',
                paddingAll: '14px', alignItems: 'center',
                action: { type: 'message', label: 'เข้างาน', text: 'เข้างาน' },
                contents: [
                  { type: 'text', text: '\u2705', size: 'xxl', align: 'center' },
                  { type: 'text', text: 'เข้างาน', weight: 'bold', color: '#ffffff', size: 'md', align: 'center', margin: '6px' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#C0392B', cornerRadius: '12px',
                paddingAll: '14px', alignItems: 'center',
                action: { type: 'message', label: 'ออกงาน', text: 'ออกงาน' },
                contents: [
                  { type: 'text', text: '\uD83D\uDEAA', size: 'xxl', align: 'center' },
                  { type: 'text', text: 'ออกงาน', weight: 'bold', color: '#ffffff', size: 'md', align: 'center', margin: '6px' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#EAF3DE', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'ประวัติ', text: 'ประวัติวันนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCB', size: 'xl', align: 'center' },
                  { type: 'text', text: 'ประวัติวันนี้', size: 'sm', color: '#3B6D11', align: 'center', margin: '4px', weight: 'bold' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1,
                backgroundColor: '#E6F1FB', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'สรุป', text: 'สรุปเดือนนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCA', size: 'xl', align: 'center' },
                  { type: 'text', text: 'สรุปเดือนนี้', size: 'sm', color: '#185FA5', align: 'center', margin: '4px', weight: 'bold' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: '#f0fdf9',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE · YD HR System', size: 'xxs', color: '#aaaaaa', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// เข้างาน — ตัวใหญ่สีแดงเมื่อสาย
// ═══════════════════════════════════════════
function createCheckInResult(name, time, lateMin) {
  const isLate = lateMin > 0;

  const lateBlock = isLate ? {
    type: 'box', layout: 'vertical', margin: 'md',
    backgroundColor: '#fff0f0', cornerRadius: '12px', paddingAll: '16px',
    contents: [
      { type: 'text', text: '\u26A0\uFE0F มาสาย', size: 'sm', color: '#C0392B', align: 'center', weight: 'bold' },
      { type: 'text', text: lateMin + ' นาที', size: '5xl', weight: 'bold', color: '#C0392B', align: 'center' },
      { type: 'text', text: 'สายจากเวลา 09:00 น. (ผ่อนผัน ' + LATE_GRACE_MIN + ' นาที)', size: 'xxs', color: '#E24B4A', align: 'center', wrap: true, margin: 'sm' }
    ]
  } : {
    type: 'box', layout: 'vertical', margin: 'md',
    backgroundColor: '#e6faf3', cornerRadius: '12px', paddingAll: '14px',
    contents: [
      { type: 'text', text: '\uD83C\uDF89 มาตรงเวลา', size: 'lg', weight: 'bold', color: '#0F6E56', align: 'center' },
      { type: 'text', text: 'ขอบคุณที่มาตรงเวลานะครับ', size: 'xs', color: '#1D9E75', align: 'center', margin: 'sm' }
    ]
  };

  return {
    type: 'flex',
    altText: isLate ? ('\u26A0\uFE0F ' + name + ' มาสาย ' + lateMin + ' นาที (' + time + ' น.)') : ('\u2705 ' + name + ' เข้างานตรงเวลา (' + time + ' น.)'),
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isLate ? '#C0392B' : '#0F6E56',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: isLate ? '\u26A0\uFE0F' : '\u2705', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'บันทึกเข้างาน', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: 'YD HR · YADEE HEALTHCARE', size: 'xxs', color: isLate ? '#ffcccc' : '#9FE1CB' }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#2C2C2A', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#888888', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: isLate ? '#fff5f5' : '#f0fdf9', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาเข้างาน', size: 'xs', color: '#888888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm', color: isLate ? '#C0392B' : '#0F6E56' }
            ]
          },
          { type: 'separator', margin: 'md', color: isLate ? '#ffcccc' : '#b3e8d8' },
          lateBlock
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: isLate ? '#fff0f0' : '#f0fdf9',
        contents: [{
          type: 'text',
          text: isLate ? ('\uD83D\uDD34 สายรวมวันนี้ ' + lateMin + ' นาที') : '\uD83D\uDFE2 ตรงเวลา — ไม่มีการสาย',
          size: 'xs', color: isLate ? '#C0392B' : '#0F6E56', align: 'center', weight: 'bold'
        }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// ออกงาน
// ═══════════════════════════════════════════
function createCheckOutResult(name, time, inTime) {
  const inLate = inTime ? calcLateMinutes(inTime) : 0;
  return {
    type: 'flex',
    altText: '\uD83D\uDEAA ' + name + ' ออกงาน ' + time + ' น.',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#185FA5',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDEAA', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'บันทึกออกงาน', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: 'YD HR · YADEE HEALTHCARE', size: 'xxs', color: '#B5D4F4' }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#2C2C2A', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#888888', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: '#EEF5FD', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาออกงาน', size: 'xs', color: '#888888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm', color: '#185FA5' }
            ]
          },
          { type: 'separator', margin: 'lg', color: '#d0e4f7' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: inLate > 0 ? '#fff0f0' : '#e6faf3', cornerRadius: '8px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'เข้างาน', size: 'xxs', color: '#888888', align: 'center' },
                  { type: 'text', text: inTime ? (inTime + ' น.') : '-', size: 'md', weight: 'bold', align: 'center', color: inLate > 0 ? '#C0392B' : '#0F6E56' },
                  inLate > 0
                    ? { type: 'text', text: 'สาย ' + inLate + ' นาที', size: 'xxs', color: '#C0392B', align: 'center', weight: 'bold' }
                    : { type: 'text', text: 'ตรงเวลา', size: 'xxs', color: '#0F6E56', align: 'center' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#e6f0fd', cornerRadius: '8px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'ออกงาน', size: 'xxs', color: '#888888', align: 'center' },
                  { type: 'text', text: time + ' น.', size: 'md', weight: 'bold', align: 'center', color: '#185FA5' },
                  { type: 'text', text: 'เรียบร้อย', size: 'xxs', color: '#185FA5', align: 'center' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: '#f0f7ff',
        contents: [{ type: 'text', text: '\uD83D\uDC4B เดินทางกลับบ้านปลอดภัยนะครับ', size: 'xs', color: '#185FA5', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// ประวัติวันนี้
// ═══════════════════════════════════════════
function createTodayHistory(name, logs) {
  const rows = logs.map(function(l) {
    const lateMin = l.type === 'in' ? calcLateMinutes(l.time) : 0;
    const isLate = lateMin > 0;
    return {
      type: 'box', layout: 'horizontal', paddingAll: '10px',
      backgroundColor: l.type === 'in' ? (isLate ? '#fff5f5' : '#f0fdf9') : '#f0f7ff',
      cornerRadius: '8px',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1, justifyContent: 'center',
          contents: [{ type: 'text', text: l.type === 'in' ? '\u2705 เข้างาน' : '\uD83D\uDEAA ออกงาน', size: 'sm', weight: 'bold',
            color: l.type === 'in' ? (isLate ? '#C0392B' : '#0F6E56') : '#185FA5' }]
        },
        {
          type: 'box', layout: 'vertical', flex: 1, alignItems: 'flex-end', justifyContent: 'center',
          contents: [
            { type: 'text', text: l.time + ' น.', size: 'md', weight: 'bold', align: 'end',
              color: l.type === 'in' ? (isLate ? '#C0392B' : '#0F6E56') : '#185FA5' },
            l.type === 'in'
              ? (isLate
                  ? { type: 'text', text: '\u26A0\uFE0F สาย ' + lateMin + ' นาที', size: 'xxs', color: '#C0392B', align: 'end', weight: 'bold' }
                  : { type: 'text', text: '\u2713 ตรงเวลา', size: 'xxs', color: '#0F6E56', align: 'end' })
              : { type: 'text', text: '— ออกงาน', size: 'xxs', color: '#888888', align: 'end' }
          ]
        }
      ]
    };
  });

  const totalLateToday = logs.filter(function(l){ return l.type === 'in'; }).reduce(function(s, l){ return s + calcLateMinutes(l.time); }, 0);

  return {
    type: 'flex',
    altText: '\uD83D\uDCCB ประวัติวันนี้ของ ' + name,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#185FA5',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDCCB', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'ประวัติวันนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: name + ' · ' + getDateLabelBKK(), size: 'xxs', color: '#B5D4F4', wrap: true }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: rows.length > 0 ? rows.concat([
          { type: 'separator', margin: 'md', color: totalLateToday > 0 ? '#ffcccc' : '#b3e8d8' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            backgroundColor: totalLateToday > 0 ? '#fff0f0' : '#e6faf3',
            cornerRadius: '8px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายวันนี้', size: 'xs', color: totalLateToday > 0 ? '#C0392B' : '#0F6E56', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLateToday > 0 ? (totalLateToday + ' นาที') : '0 นาที (ตรงเวลา)', size: 'xs', weight: 'bold', align: 'end', color: totalLateToday > 0 ? '#C0392B' : '#0F6E56' }
            ]
          }
        ]) : [{ type: 'text', text: 'ยังไม่มีการลงเวลาวันนี้', color: '#aaaaaa', align: 'center', size: 'sm' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// สรุปเดือนนี้ — สายตัวใหญ่แดง + รวมนาทีแดงเล็ก
// ═══════════════════════════════════════════
function createMonthlySummary(name, logs) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthLogs = logs.filter(function(l) {
    const parts = l.date.split('/');
    return parts[1] === month && l.type === 'in';
  });
  const totalDays = monthLogs.length;
  const lateDays = monthLogs.filter(function(l){ return calcLateMinutes(l.time) > 0; }).length;
  const totalLateMin = monthLogs.reduce(function(s, l){ return s + calcLateMinutes(l.time); }, 0);
  const onTimeDays = totalDays - lateDays;
  const monthName = now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long', year: 'numeric' });

  return {
    type: 'flex',
    altText: '\uD83D\uDCCA ' + name + ' สาย ' + lateDays + ' วัน รวม ' + totalLateMin + ' นาที',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#4A2EAB',
        contents: [{
          type: 'box', layout: 'horizontal', alignItems: 'center', spacing: 'sm',
          contents: [
            { type: 'text', text: '\uD83D\uDCCA', size: 'xl' },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'สรุปเดือนนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: name + ' · ' + monthName, size: 'xxs', color: '#CECBF6', wrap: true }
            ]}
          ]
        }]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#E1F5EE', cornerRadius: '12px', paddingAll: '14px',
                contents: [
                  { type: 'text', text: String(totalDays), size: '3xl', weight: 'bold', color: '#0F6E56', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#0F6E56', align: 'center' },
                  { type: 'text', text: 'ทำงานทั้งหมด', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#EAF3DE', cornerRadius: '12px', paddingAll: '14px',
                contents: [
                  { type: 'text', text: String(onTimeDays), size: '3xl', weight: 'bold', color: '#3B6D11', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#3B6D11', align: 'center' },
                  { type: 'text', text: 'มาตรงเวลา', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#fff0f0', cornerRadius: '12px', paddingAll: '14px',
                contents: [
                  { type: 'text', text: String(lateDays), size: '3xl', weight: 'bold', color: '#C0392B', align: 'center' },
                  { type: 'text', text: 'วัน', size: 'xxs', color: '#C0392B', align: 'center' },
                  { type: 'text', text: 'มาสาย', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' },
                  lateDays > 0
                    ? { type: 'text', text: '\u26A0\uFE0F ' + lateDays + ' วัน', size: 'xxs', color: '#C0392B', align: 'center', weight: 'bold' }
                    : { type: 'text', text: '\uD83C\uDF89 ไม่มีสาย', size: 'xxs', color: '#3B6D11', align: 'center' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: '#fff5f5', cornerRadius: '12px', paddingAll: '14px',
                contents: [
                  { type: 'text', text: String(totalLateMin), size: '3xl', weight: 'bold', color: '#C0392B', align: 'center' },
                  { type: 'text', text: 'นาที', size: 'xxs', color: '#C0392B', align: 'center' },
                  { type: 'text', text: 'รวมสายทั้งหมด', size: 'xxs', color: '#888888', align: 'center', margin: 'sm' },
                  totalLateMin > 0
                    ? { type: 'text', text: '\uD83D\uDD34 รวม ' + totalLateMin + ' นาที', size: 'xxs', color: '#C0392B', align: 'center', weight: 'bold' }
                    : { type: 'text', text: '\u2705 ไม่มีสาย', size: 'xxs', color: '#3B6D11', align: 'center' }
                ]
              }
            ]
          },
          {
            type: 'box', layout: 'vertical', margin: 'sm',
            backgroundColor: totalLateMin > 0 ? '#fff0f0' : '#e6faf3',
            cornerRadius: '10px', paddingAll: '12px',
            contents: [
              {
                type: 'box', layout: 'horizontal',
                contents: [
                  { type: 'text', text: '\uD83D\uDD34 รวมสายเดือนนี้', size: 'sm', color: '#C0392B', flex: 1, weight: 'bold' },
                  { type: 'text', text: totalLateMin + ' นาที', size: 'sm', color: '#C0392B', align: 'end', weight: 'bold' }
                ]
              },
              totalLateMin > 0
                ? { type: 'text', text: 'คิดเป็น ' + Math.floor(totalLateMin/60) + ' ชั่วโมง ' + (totalLateMin%60) + ' นาที', size: 'xxs', color: '#E24B4A', align: 'end', margin: 'xs' }
                : { type: 'text', text: 'ยอดเยี่ยม! ไม่มีการมาสายเลย \uD83C\uDF89', size: 'xs', color: '#0F6E56', align: 'center', margin: 'xs' }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px',
        backgroundColor: '#f5f0ff',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE · YD HR System', size: 'xxs', color: '#9999cc', align: 'center' }]
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
    attendanceData[userId] = { name: userName, logs: [] };
  } else {
    attendanceData[userId].name = userName;
  }

  const today = getTodayBKK();
  const now = getTimeBKK();
  const todayLogs = getTodayLogs(userId);
  const lastLog = todayLogs[todayLogs.length - 1];

  if (['เมนู', 'menu', 'hr', 'HR', 'สวัสดี'].includes(text)) {
    await client.replyMessage({ replyToken, messages: [createMainMenu(userName)] });
    return;
  }

  if (text === 'เข้างาน') {
    if (lastLog && lastLog.type === 'in') {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '\u26A0\uFE0F คุณลงเวลาเข้างานแล้ว\nเวลา ' + lastLog.time + ' น.\n\nหากต้องการออกงาน กด "ออกงาน"' }] });
      return;
    }
    const lateMin = calcLateMinutes(now);
    attendanceData[userId].logs.push({ type: 'in', time: now, date: today });
    await client.replyMessage({ replyToken, messages: [createCheckInResult(userName, now, lateMin)] });
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
    attendanceData[userId].logs.push({ type: 'out', time: now, date: today });
    await client.replyMessage({ replyToken, messages: [createCheckOutResult(userName, now, inLog.time)] });
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
    { type: 'text', text: 'สวัสดีครับ ' + userName + ' \uD83D\uDC4B\nกดปุ่มด้านล่างเพื่อลงเวลาได้เลยครับ' },
    createMainMenu(userName)
  ]});
}

app.get('/', (req, res) => res.send('YD HR Bot is running! \uD83D\uDFE2'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('YD HR Bot running on port ' + PORT));
