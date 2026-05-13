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
// ข้อมูล 3 สาขา + พิกัด GPS
// ═══════════════════════════════════════════
const BRANCHES = {
  '1': { name: 'สาขา 1', startH: 8, startM: 0, endH: 22, endM: 0, grace: 0, lat: 18.77536449021555, lng: 99.06397534033722 },
  '2': { name: 'สาขา 2', startH: 8, startM: 0, endH: 20, endM: 0, grace: 0, lat: 18.74173525488209, lng: 99.20807513931368 },
  '3': { name: 'สาขา 3', startH: 8, startM: 0, endH: 21, endM: 0, grace: 0, lat: 18.72614815677626, lng: 98.91718330556888 },
};

const MAX_DISTANCE_METERS = 500;

let attendanceData = {};

// ═══════════════════════════════════════════
// คำนวณระยะทาง GPS (Haversine formula)
// ═══════════════════════════════════════════
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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

// ═══════════════════════════════════════════
// เมนูหลัก
// ═══════════════════════════════════════════
function createMainMenu(name) {
  return {
    type: 'flex', altText: 'เมนู YD HR',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#003d99',
        contents: [
          { type: 'text', text: 'YD HR', weight: 'bold', size: 'xl', color: '#ffffff' },
          { type: 'text', text: 'ระบบบันทึกเวลาทำงาน', size: 'xs', color: '#99bbff' },
          { type: 'separator', margin: '12px', color: '#0057cc' },
          { type: 'text', text: '\uD83D\uDC64 ' + name, size: 'sm', color: '#cce0ff', margin: '10px' },
          { type: 'text', text: '\uD83D\uDCC5 ' + getDateLabelBKK(), size: 'xs', color: '#99bbff', wrap: true }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', backgroundColor: '#f0f5ff',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#003d99', cornerRadius: '12px',
                paddingAll: '14px', alignItems: 'center',
                action: { type: 'message', label: 'เข้างาน', text: 'เข้างาน' },
                contents: [
                  { type: 'text', text: '\u2705', size: 'xxl', align: 'center' },
                  { type: 'text', text: 'เข้างาน', weight: 'bold', color: '#ffffff', size: 'sm', align: 'center', margin: '6px' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#b91c1c', cornerRadius: '12px',
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
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#dbeafe', cornerRadius: '12px',
                paddingAll: '12px', alignItems: 'center',
                action: { type: 'message', label: 'ประวัติ', text: 'ประวัติวันนี้' },
                contents: [
                  { type: 'text', text: '\uD83D\uDCCB', size: 'xl', align: 'center' },
                  { type: 'text', text: 'ประวัติวันนี้', size: 'sm', color: '#1e3a8a', align: 'center', margin: '4px', weight: 'bold' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#e0e7ff', cornerRadius: '12px',
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

// ═══════════════════════════════════════════
// ขอ Location ก่อนเข้างาน/ออกงาน
// ═══════════════════════════════════════════
function createLocationRequest(action, branchId) {
  const branch = BRANCHES[branchId];
  const isIn = action === 'in';
  return {
    type: 'flex',
    altText: 'กรุณาแชร์ Location เพื่อยืนยันตำแหน่ง',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isIn ? '#003d99' : '#b91c1c',
        contents: [
          { type: 'text', text: '\uD83D\uDCCD ยืนยันตำแหน่ง', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#ccddff', margin: '4px' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'vertical', backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD ต้องยืนยันตำแหน่ง', weight: 'bold', color: '#003d99', size: 'md', align: 'center' },
              { type: 'text', text: 'ต้องอยู่ในรัศมี 500 เมตร\nจาก' + branch.name + 'เท่านั้น', size: 'sm', color: '#1e40af', align: 'center', wrap: true, margin: 'sm' }
            ]
          },
          { type: 'text', text: 'วิธีแชร์ Location:', size: 'sm', color: '#003d99', weight: 'bold' },
          { type: 'text', text: '1. กดปุ่ม + ในช่องแชท\n2. เลือก "Location"\n3. กด "Send your current location"', size: 'sm', color: '#444444', wrap: true, margin: 'sm' },
          {
            type: 'box', layout: 'vertical', backgroundColor: '#fee2e2', cornerRadius: '10px', paddingAll: '12px',
            contents: [
              { type: 'text', text: '\u26A0\uFE0F หากไม่ได้อยู่ที่สาขา\nระบบจะไม่บันทึกเวลาให้ครับ', size: 'xs', color: '#b91c1c', align: 'center', wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#f0f5ff',
        contents: [{ type: 'text', text: 'YADEE HEALTHCARE \u00B7 YD HR System', size: 'xxs', color: '#7799cc', align: 'center' }]
      }
    }
  };
}

// ═══════════════════════════════════════════
// เลือกสาขา
// ═══════════════════════════════════════════
function createBranchSelector(action) {
  const isIn = action === 'in';
  return {
    type: 'flex', altText: 'เลือกสาขา',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isIn ? '#003d99' : '#b91c1c',
        contents: [
          { type: 'text', text: (isIn ? '\u2705 เข้างาน' : '\uD83D\uDEAA ออกงาน') + ' \u2014 เลือกสาขา', weight: 'bold', color: '#ffffff', size: 'md' },
          { type: 'text', text: 'ระบบจะตรวจสอบ GPS ในรัศมี 500 เมตร', size: 'xs', color: '#ccddff', margin: '4px' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: '\uD83C\uDFE5  สาขา 1  |  08:00 - 22:00 น.', text: action + '_branch_1' },
            style: 'primary', color: '#003d99', height: 'sm'
          },
          {
            type: 'button',
            action: { type: 'message', label: '\uD83C\uDFE5  สาขา 2  |  08:00 - 20:00 น.', text: action + '_branch_2' },
            style: 'primary', color: '#0057cc', height: 'sm'
          },
          {
            type: 'button',
            action: { type: 'message', label: '\uD83C\uDFE5  สาขา 3  |  08:00 - 21:00 น.', text: action + '_branch_3' },
            style: 'primary', color: '#1d4ed8', height: 'sm'
          },
          {
            type: 'box', layout: 'vertical', backgroundColor: '#dbeafe', cornerRadius: '10px', paddingAll: '10px', margin: 'sm',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD หลังเลือกสาขา ระบบจะขอให้แชร์ Location\nเพื่อยืนยันว่าอยู่ที่สาขานั้นจริงครับ', size: 'xs', color: '#1e40af', wrap: true, align: 'center' }
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
function createCheckInResult(name, time, lateMin, branchId, distMeters) {
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
        contents: [
          { type: 'text', text: (isLate ? '\u26A0\uFE0F' : '\u2705') + ' บันทึกเข้างาน', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#ccddff', margin: '4px' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: name, weight: 'bold', size: 'lg', color: '#111111', align: 'center' },
          { type: 'text', text: getDateLabelBKK(), size: 'xxs', color: '#999999', align: 'center', margin: 'sm', wrap: true },
          {
            type: 'box', layout: 'vertical', margin: 'lg',
            backgroundColor: isLate ? '#fee2e2' : '#dbeafe', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: 'เวลาเข้างาน', size: 'xs', color: '#888888', align: 'center' },
              { type: 'text', text: time + ' น.', size: '4xl', weight: 'bold', align: 'center', margin: 'sm', color: isLate ? '#b91c1c' : '#003d99' }
            ]
          },
          isLate ? {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#fee2e2', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: '\u26A0\uFE0F มาสาย', size: 'sm', color: '#b91c1c', align: 'center', weight: 'bold' },
              { type: 'text', text: String(lateMin), size: '5xl', weight: 'bold', color: '#b91c1c', align: 'center' },
              { type: 'text', text: 'นาที', size: 'xl', weight: 'bold', color: '#b91c1c', align: 'center', margin: 'xs' },
              { type: 'text', text: 'สายจากเวลา 08:00 น.', size: 'xxs', color: '#dc2626', align: 'center', margin: 'sm' }
            ]
          } : {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
            contents: [
              { type: 'text', text: '\uD83C\uDF89 มาตรงเวลา', size: 'lg', weight: 'bold', color: '#003d99', align: 'center' },
              { type: 'text', text: 'ขอบคุณที่มาตรงเวลานะครับ', size: 'xs', color: '#1d4ed8', align: 'center', margin: 'sm' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md', alignItems: 'center',
            backgroundColor: '#dcfce7', cornerRadius: '8px', paddingAll: '8px',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD ยืนยัน GPS', size: 'xs', color: '#166534', flex: 1, weight: 'bold' },
              { type: 'text', text: Math.round(distMeters) + ' ม. จากสาขา', size: 'xs', color: '#166534', align: 'end' }
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

// ═══════════════════════════════════════════
// ผลออกงาน
// ═══════════════════════════════════════════
function createCheckOutResult(name, time, inTime, branchId, distMeters) {
  const branch = BRANCHES[branchId];
  const inLate = inTime ? calcLateMinutes(inTime, branchId) : 0;
  return {
    type: 'flex',
    altText: '\uD83D\uDEAA ออกงาน ' + time + ' น. \u2014 ' + branch.name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#003d99',
        contents: [
          { type: 'text', text: '\uD83D\uDEAA บันทึกออกงาน', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#99bbff', margin: '4px' }
        ]
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
            type: 'box', layout: 'horizontal', margin: 'md', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                backgroundColor: inLate > 0 ? '#fee2e2' : '#dbeafe', cornerRadius: '10px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: 'เข้างาน', size: 'xxs', color: '#888888', align: 'center' },
                  { type: 'text', text: inTime ? inTime + ' น.' : '-', size: 'md', weight: 'bold', align: 'center', color: inLate > 0 ? '#b91c1c' : '#003d99' },
                  { type: 'text', text: inLate > 0 ? 'สาย ' + inLate + ' นาที' : 'ตรงเวลา', size: 'xxs', color: inLate > 0 ? '#b91c1c' : '#003d99', align: 'center', weight: 'bold' }
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
          },
          {
            type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center',
            backgroundColor: '#dcfce7', cornerRadius: '8px', paddingAll: '8px',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD ยืนยัน GPS', size: 'xs', color: '#166534', flex: 1, weight: 'bold' },
              { type: 'text', text: Math.round(distMeters) + ' ม. จากสาขา', size: 'xs', color: '#166534', align: 'end' }
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

// ═══════════════════════════════════════════
// ปฏิเสธเพราะ GPS ไกลเกิน
// ═══════════════════════════════════════════
function createLocationRejected(branchId, distMeters) {
  const branch = BRANCHES[branchId];
  return {
    type: 'flex', altText: '\u274C ไม่สามารถลงเวลาได้ อยู่ไกลจากสาขา',
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#7f1d1d',
        contents: [
          { type: 'text', text: '\u274C ไม่สามารถลงเวลาได้', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: 'YD HR \u00B7 ตรวจสอบ GPS', size: 'xs', color: '#fca5a5', margin: '4px' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'vertical', backgroundColor: '#fee2e2', cornerRadius: '12px', paddingAll: '16px',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD คุณอยู่ห่างจาก ' + branch.name, size: 'sm', color: '#b91c1c', align: 'center', weight: 'bold' },
              { type: 'text', text: String(Math.round(distMeters)) + ' เมตร', size: '4xl', weight: 'bold', color: '#b91c1c', align: 'center' },
              { type: 'text', text: 'เกินรัศมี 500 เมตรที่กำหนด', size: 'xs', color: '#dc2626', align: 'center', margin: 'sm' }
            ]
          },
          {
            type: 'box', layout: 'vertical', backgroundColor: '#fef9c3', cornerRadius: '10px', paddingAll: '12px',
            contents: [
              { type: 'text', text: '\uD83D\uDCA1 ต้องอยู่ในรัศมี 500 เมตร\nจาก' + branch.name + 'เท่านั้น\nกรุณาลองใหม่เมื่ออยู่ที่สาขาครับ', size: 'sm', color: '#854d0e', wrap: true, align: 'center' }
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '10px', backgroundColor: '#fee2e2',
        contents: [{ type: 'text', text: '\uD83D\uDEAB ไม่บันทึกเวลา', size: 'xs', color: '#b91c1c', align: 'center', weight: 'bold' }]
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
      type: 'box', layout: 'horizontal', alignItems: 'center',
      backgroundColor: l.type === 'in' ? (isLate ? '#fee2e2' : '#dbeafe') : '#e0e7ff',
      cornerRadius: '10px', paddingAll: '10px',
      contents: [
        { type: 'box', layout: 'vertical', flex: 1,
          contents: [
            { type: 'text', text: l.type === 'in' ? '\u2705 เข้างาน' : '\uD83D\uDEAA ออกงาน', size: 'sm', weight: 'bold', color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' },
            { type: 'text', text: '\uD83C\uDFE5 ' + branch.name, size: 'xxs', color: '#666666' }
          ]
        },
        { type: 'box', layout: 'vertical', alignItems: 'flex-end',
          contents: [
            { type: 'text', text: l.time + ' น.', size: 'md', weight: 'bold', color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#003d99' },
            { type: 'text', text: l.type === 'in' ? (isLate ? '\u26A0\uFE0F สาย ' + lateMin + ' นาที' : '\u2713 ตรงเวลา') : '\u2014 ออกงาน',
              size: 'xxs', color: l.type === 'in' ? (isLate ? '#b91c1c' : '#003d99') : '#888888', weight: isLate ? 'bold' : 'regular' }
          ]
        }
      ]
    };
  });

  const totalLate = logs.filter(function(l){ return l.type === 'in'; })
    .reduce(function(s,l){ return s + calcLateMinutes(l.time, l.branch); }, 0);

  return {
    type: 'flex', altText: '\uD83D\uDCCB ประวัติวันนี้ของ ' + name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#003d99',
        contents: [
          { type: 'text', text: '\uD83D\uDCCB ประวัติวันนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: name, size: 'xs', color: '#99bbff', margin: '4px' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: rows.length > 0 ? rows.concat([
          { type: 'separator', margin: 'md', color: '#93c5fd' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            backgroundColor: totalLate > 0 ? '#fee2e2' : '#dbeafe', cornerRadius: '8px', paddingAll: '10px',
            contents: [
              { type: 'text', text: '\uD83D\uDD34 รวมสายวันนี้', size: 'xs', color: totalLate > 0 ? '#b91c1c' : '#003d99', flex: 1, weight: 'bold' },
              { type: 'text', text: totalLate + ' นาที', size: 'xs', weight: 'bold', align: 'end', color: totalLate > 0 ? '#b91c1c' : '#003d99' }
            ]
          }
        ]) : [{ type: 'text', text: 'ยังไม่มีการลงเวลาวันนี้', color: '#aaaaaa', align: 'center', size: 'sm' }]
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
  const totalLateMin = monthLogs.reduce(function(s,l){ return s + calcLateMinutes(l.time, l.branch); }, 0);
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
        { type: 'text', text: bLate > 0 ? 'สาย ' + bLateMin + ' น.' : 'ตรงเวลา', size: 'xs', flex: 2, align: 'end', color: bLate > 0 ? '#b91c1c' : '#003d99', weight: 'bold' }
      ]
    };
  });

  return {
    type: 'flex', altText: '\uD83D\uDCCA สรุปเดือนนี้ ' + name,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#001f66',
        contents: [
          { type: 'text', text: '\uD83D\uDCCA สรุปเดือนนี้', weight: 'bold', color: '#ffffff', size: 'lg' },
          { type: 'text', text: name + ' \u00B7 ' + monthName, size: 'xxs', color: '#99bbff', margin: '4px', wrap: true }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '12px',
                contents: [{ type: 'text', text: String(totalDays), size: '3xl', weight: 'bold', color: '#003d99', align: 'center' }, { type: 'text', text: 'วันทำงาน', size: 'xxs', color: '#555555', align: 'center', margin: 'sm' }] },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#dcfce7', cornerRadius: '12px', paddingAll: '12px',
                contents: [{ type: 'text', text: String(onTimeDays), size: '3xl', weight: 'bold', color: '#166534', align: 'center' }, { type: 'text', text: 'ตรงเวลา', size: 'xxs', color: '#555555', align: 'center', margin: 'sm' }] }
            ]
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#fee2e2', cornerRadius: '12px', paddingAll: '12px',
                contents: [{ type: 'text', text: String(lateDays), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' }, { type: 'text', text: 'วันสาย', size: 'xxs', color: '#555555', align: 'center', margin: 'sm' }] },
              { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', backgroundColor: '#fef2f2', cornerRadius: '12px', paddingAll: '12px',
                contents: [{ type: 'text', text: String(totalLateMin), size: '3xl', weight: 'bold', color: '#b91c1c', align: 'center' }, { type: 'text', text: 'นาทีรวมสาย', size: 'xxs', color: '#555555', align: 'center', margin: 'sm' }] }
            ]
          },
          { type: 'separator', color: '#93c5fd' },
          { type: 'text', text: 'แยกตามสาขา', size: 'xs', color: '#003d99', weight: 'bold', margin: 'sm' },
          ...branchRows,
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            backgroundColor: totalLateMin > 0 ? '#fee2e2' : '#dbeafe', cornerRadius: '10px', paddingAll: '10px',
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
  const replyToken = event.replyToken;

  // รับ Location message
  if (event.type === 'message' && event.message.type === 'location') {
    const userId = event.source.userId;
    const userLat = event.message.latitude;
    const userLng = event.message.longitude;

    if (!attendanceData[userId] || !attendanceData[userId].pendingAction) {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: 'กรุณากด "เข้างาน" หรือ "ออกงาน" ก่อนแชร์ตำแหน่งครับ' }] });
      return;
    }

    const { action, branchId } = attendanceData[userId].pendingAction;
    const branch = BRANCHES[branchId];
    const distance = calcDistance(userLat, userLng, branch.lat, branch.lng);

    let userName = attendanceData[userId].name || 'พนักงาน';

    if (distance > MAX_DISTANCE_METERS) {
      attendanceData[userId].pendingAction = null;
      await client.replyMessage({ replyToken, messages: [createLocationRejected(branchId, distance)] });
      return;
    }

    const today = getTodayBKK();
    const now = getTimeBKK();
    const todayLogs = getTodayLogs(userId);

    if (action === 'in') {
      const lateMin = calcLateMinutes(now, branchId);
      attendanceData[userId].logs.push({ type: 'in', time: now, date: today, branch: branchId, dist: Math.round(distance) });
      attendanceData[userId].pendingAction = null;
      await client.replyMessage({ replyToken, messages: [createCheckInResult(userName, now, lateMin, branchId, distance)] });
    } else {
      const inLog = todayLogs.find(function(l){ return l.type === 'in'; });
      attendanceData[userId].logs.push({ type: 'out', time: now, date: today, branch: branchId, dist: Math.round(distance) });
      attendanceData[userId].pendingAction = null;
      await client.replyMessage({ replyToken, messages: [createCheckOutResult(userName, now, inLog ? inLog.time : null, branchId, distance)] });
    }
    return;
  }

  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

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

  const todayLogs = getTodayLogs(userId);
  const lastLog = todayLogs[todayLogs.length - 1];

  if (['เมนู', 'menu', 'hr', 'HR', 'ยาดีเชียงใหม่', 'yadee'].includes(text)) {
    attendanceData[userId].pendingAction = null;
    await client.replyMessage({ replyToken, messages: [createMainMenu(userName)] });
    return;
  }

  if (text === 'เข้างาน') {
    if (lastLog && lastLog.type === 'in') {
      await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '\u26A0\uFE0F คุณลงเวลาเข้างานแล้ว\nเวลา ' + lastLog.time + ' น.\n\nหากต้องการออกงาน กด "ออกงาน"' }] });
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
    attendanceData[userId].pendingAction = { action, branchId };
    const branch = BRANCHES[branchId];
    const isIn = action === 'in';
    await client.replyMessage({ replyToken, messages: [
      {
        type: 'flex', altText: '\uD83D\uDCCD กรุณาแชร์ตำแหน่งเพื่อยืนยัน ' + branch.name,
        contents: {
          type: 'bubble', size: 'kilo',
          header: {
            type: 'box', layout: 'vertical', paddingAll: '16px',
            backgroundColor: isIn ? '#003d99' : '#b91c1c',
            contents: [
              { type: 'text', text: '\uD83D\uDCCD ยืนยันตำแหน่ง', weight: 'bold', color: '#ffffff', size: 'lg' },
              { type: 'text', text: 'YD HR \u00B7 ' + branch.name, size: 'xs', color: '#ccddff', margin: '4px' }
            ]
          },
          body: {
            type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
            contents: [
              {
                type: 'box', layout: 'vertical', backgroundColor: '#dbeafe', cornerRadius: '12px', paddingAll: '14px',
                contents: [
                  { type: 'text', text: '\uD83D\uDCCD ต้องอยู่ในรัศมี 500 เมตร', weight: 'bold', color: '#003d99', size: 'sm', align: 'center' },
                  { type: 'text', text: 'จาก ' + branch.name + ' เท่านั้น', size: 'xs', color: '#1e40af', align: 'center', margin: 'xs' }
                ]
              },
              {
                type: 'button',
                action: { type: 'location', label: '\uD83D\uDCCD กดที่นี่เพื่อแชร์ตำแหน่ง' },
                style: 'primary', color: '#003d99', height: 'sm'
              },
              {
                type: 'box', layout: 'vertical', backgroundColor: '#fee2e2', cornerRadius: '8px', paddingAll: '10px',
                contents: [
                  { type: 'text', text: '\u26A0\uFE0F หากไม่ได้อยู่ที่สาขาจริง\nระบบจะไม่บันทึกเวลาให้ครับ', size: 'xs', color: '#b91c1c', align: 'center', wrap: true }
                ]
              }
            ]
          }
        }
      }
    ]});
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
    { type: 'text', text: 'สวัสดีครับ ' + userName + ' \uD83D\uDC4B\n\nพิมพ์ว่า "ยาดีเชียงใหม่" เพื่อเริ่มใช้งานระบบลงเวลาได้เลยครับ' }
  ]});
}

app.get('/', (req, res) => res.send('YD HR Bot is running! \uD83D\uDFE2'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('YD HR Bot running on port ' + PORT));
