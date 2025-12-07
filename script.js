// --- CONFIGURATION ---
const SHEET_ID = "1uY2EGP7UkzMKTlhFr4vlO70ovk3yCpv4Rbo3SA7UJFk";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const BUDGET_LIMIT = 1500;

let currentChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    Chart.defaults.font.family = "'Prompt', sans-serif";
    Chart.defaults.color = '#888888';

    const hasDashboard = document.getElementById('display-amount');
    const hasUsageChart = document.getElementById('usageChart');
    const hasWarningChart = document.getElementById('warningChart');
    const hasPieChart = document.getElementById('pieChart');

    try {
        const rawData = await fetchCSV();
        const allData = parseCSV(rawData);

        if (allData.length === 0) throw new Error("ไม่พบข้อมูลใน Google Sheet");

        // Debug: ดูว่าหัวตารางอ่านได้ว่าอะไรบ้าง
        console.log("Headers detected:", Object.keys(allData[0]));
        console.log("First Row Data:", allData[0]);

        // 1. จัดการเรื่องเลือกห้อง
        let savedRoom = 'all';
        try { savedRoom = localStorage.getItem('selectedRoom') || 'all'; } catch(e){}
        
        const roomSelector = document.getElementById('room-selector');
        if (roomSelector) {
            initRoomSelector(allData, roomSelector, savedRoom);
        }

        // 2. กรองข้อมูลตามห้อง
        const filteredData = filterDataByRoom(allData, savedRoom);

        // 3. แสดงผล
        if (hasDashboard) renderDashboard(filteredData);
        if (hasUsageChart) renderUsagePage(filteredData);
        if (hasWarningChart) renderWarningPage(filteredData);
        if (hasPieChart) renderBreakdownPage(filteredData);

    } catch (error) {
        console.error("Critical Error:", error);
        if (hasDashboard) {
            safeSetText('display-amount', "Error");
            safeSetText('last-update', "Error: " + error.message);
        }
    }
});

// --- HELPER: ตัวตัด CSV แบบฉลาด (รองรับ "1,000" และ "amount_paid") ---
function splitCSVLine(str) {
    const result = [];
    let current = '';
    let inQuote = false;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"') {
            inQuote = !inQuote; // เจอฟันหนู ให้สลับสถานะ
        } else if (char === ',' && !inQuote) {
            // เจอคอมม่า และไม่ได้อยู่ในฟันหนู -> ตัดคำ
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// --- HELPER: ล้างฟันหนูออกจากข้อความ ---
function cleanCSVValue(val) {
    if (!val) return "";
    let clean = val.trim();
    // ลบฟันหนูหัวท้าย ถ้ามี (เช่น "1,000" -> 1,000)
    if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.substring(1, clean.length - 1);
    }
    return clean;
}

// --- DATA FETCHING & PARSING ---
async function fetchCSV() {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error("เชื่อมต่อ Google Sheet ไม่สำเร็จ");
    return await response.text();
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // 1. แกะ Header ด้วยตัวตัดแบบฉลาด
    const headersRaw = splitCSVLine(lines[0]);
    const headers = headersRaw.map(h => cleanCSVValue(h).toLowerCase().replace(/^[\uFEFF\uFFFE]/, ''));
    
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        // 2. แกะข้อมูลแต่ละแถวด้วยตัวตัดแบบฉลาด
        const currentline = splitCSVLine(lines[i]);
        const obj = {};
        let hasData = false;

        for (let j = 0; j < headers.length; j++) {
            let headerName = headers[j];
            // ล้างค่าข้อมูล (เอาฟันหนูออก)
            let val = cleanCSVValue(currentline[j] || "");

            // Logic: ถ้าเจอคอลัมน์ชื่อ amount_paid ให้บันทึกทันที (ไม่สนว่าซ้ำไหม เอาตัวที่มีค่า)
            if (headerName === 'amount_paid') {
                 if (val !== "") obj[headerName] = val;
            } else {
                if (!obj.hasOwnProperty(headerName) || (obj[headerName] === "" && val !== "")) {
                    obj[headerName] = val;
                }
            }
            
            if (val !== "") hasData = true;
        }

        if (hasData && obj.timestamp) {
            data.push(obj);
        }
    }
    return data;
}

// --- ROOM LOGIC ---
function initRoomSelector(allData, selectorElement, currentRoom) {
    const rooms = [...new Set(allData.map(item => item.room_number).filter(r => r))];
    rooms.sort((a, b) => parseFloat(a) - parseFloat(b));

    let html = `<option value="all">ภาพรวมทุกห้อง (${rooms.length} ห้อง)</option>`;
    rooms.forEach(room => {
        const isSelected = room === currentRoom ? 'selected' : '';
        html += `<option value="${room}" ${isSelected}>ห้อง ${room}</option>`;
    });
    selectorElement.innerHTML = html;

    selectorElement.addEventListener('change', (e) => {
        const newRoom = e.target.value;
        try { localStorage.setItem('selectedRoom', newRoom); } catch(e){}
        window.location.reload();
    });
}

function filterDataByRoom(data, room) {
    if (!room || room === 'all') return data;
    return data.filter(row => row.room_number == room);
}

// --- HELPER FUNCTIONS ---
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = (text === undefined || text === null || text === "") ? "-" : text;
}

function safeSetStyle(id, property, value) {
    const el = document.getElementById(id);
    if (el) el.style[property] = value;
}

function parseDate(dateString) {
    if (!dateString) return null;
    const safeDateStr = dateString.replace(' ', 'T');
    const date = new Date(safeDateStr);
    return isNaN(date) ? null : date;
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// --- RENDER DASHBOARD ---
function renderDashboard(data) {
    const validData = data.filter(row => parseDate(row.timestamp) !== null);
    if (validData.length === 0) {
        safeSetText('display-amount', "0");
        safeSetText('last-update', "ไม่พบข้อมูล");
        return;
    }

    validData.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp));

    // หาแถวที่มี amount_paid ล่าสุด
    let targetRow = null;
    let displayAmount = 0;

    for (let i = validData.length - 1; i >= 0; i--) {
        let row = validData[i];
        if (row.amount_paid && row.amount_paid.trim() !== "") {
            // ลบลูกน้ำออกก่อนแปลงเป็นตัวเลข
            let val = parseFloat(row.amount_paid.replace(/,/g, ''));
            if (!isNaN(val)) {
                targetRow = row;
                displayAmount = val;
                break;
            }
        }
    }

    if (!targetRow) targetRow = validData[validData.length - 1];

    console.log("Dashboard Row:", targetRow);
    console.log("Amount to show:", displayAmount);

    animateValue("display-amount", 0, displayAmount, 1000);

    const percent = (displayAmount / BUDGET_LIMIT) * 100;
    safeSetStyle('progress-fill', 'width', `${Math.min(percent, 100)}%`);

    if (targetRow.timestamp) safeSetText('last-update', `อัปเดตล่าสุด: ${targetRow.timestamp}`);

    // Logic สี
    const sheetLevel = (targetRow.level || "normal").toLowerCase().trim();
    const warningCard = document.getElementById('warning-card-status');
    if (warningCard) warningCard.className = "card warning-card";

    let color = '#27AE60';

    if (sheetLevel === 'high') {
        if(warningCard) warningCard.classList.add('status-high');
        safeSetText('warning-title', "High");
        safeSetText('warning-desc', "สถานะ : ไฟสูงกว่าปกติ");
        safeSetText('level-text', "HIGH");
        safeSetStyle('level-text', 'color', '#FF5252');
        color = '#FF5252';
    } else if (sheetLevel === 'critical') {
        if(warningCard) warningCard.classList.add('status-critical');
        safeSetText('warning-title', "Critical");
        safeSetText('warning-desc', "สถานะ : ไฟกำลังพุ่งสูง");
        safeSetText('level-text', "CRITICAL");
        safeSetStyle('level-text', 'color', '#FF9800');
        color = '#FF9800';
    } else if (sheetLevel === 'warning') {
        if(warningCard) warningCard.classList.add('status-warning');
        safeSetText('warning-title', "Warning");
        safeSetText('warning-desc', "สถานะ : ไฟสูงกว่าปกติเล็กน้อย");
        safeSetText('level-text', "WARNING");
        safeSetStyle('level-text', 'color', '#F9A825');
        color = '#FFC107';
    } else {
        if(warningCard) warningCard.classList.add('status-normal');
        safeSetText('warning-title', "Normal");
        safeSetText('warning-desc', "สถานะ : ปกติ");
        safeSetText('level-text', "NORMAL");
        safeSetStyle('level-text', 'color', '#27AE60');
        color = '#27AE60';
    }
    safeSetStyle('progress-fill', 'backgroundColor', color);
}

// --- RENDER USAGE CHART ---
function renderUsagePage(data) {
    const validData = data.filter(row => parseDate(row.timestamp) !== null);
    validData.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp));
    
    const recentData = validData.slice(-20);

    const labels = recentData.map(row => {
        const parts = row.timestamp.split(' ');
        return parts.length > 1 ? parts[1].substring(0, 5) : row.timestamp;
    });
    const dataPoints = recentData.map(row => parseFloat(row.kwh_usage));

    const ctx = document.getElementById('usageChart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'การใช้ไฟ (kWh)',
                    data: dataPoints,
                    borderColor: '#333333',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
            }
        });
    }

    const lastRow = validData[validData.length - 1];
    if(lastRow) {
        safeSetText('insight-room', lastRow.room_number);
        safeSetText('insight-meter', lastRow.kwh_reading ? lastRow.kwh_reading + " หน่วย" : "-");
        safeSetText('insight-power', lastRow.power_watts ? lastRow.power_watts + " W" : "-");
        safeSetText('insight-cost', lastRow.cost_baht ? parseFloat(lastRow.cost_baht).toFixed(2) + " ฿" : "-");
    }
}

// --- RENDER WARNING CHART ---
function renderWarningPage(data) {
    const validData = data.filter(row => parseDate(row.timestamp) !== null);
    validData.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp));

    let cumulativeCost = 0;
    const costData = [];
    const budgetData = [];
    const labels = [];

    validData.forEach((row, index) => {
        cumulativeCost += parseFloat(row.cost_baht || 0);

        if (validData.length > 50 && index % 5 !== 0 && index !== validData.length - 1) {
            return; 
        }

        costData.push(cumulativeCost);
        budgetData.push(BUDGET_LIMIT);
        const dateObj = parseDate(row.timestamp);
        const dateShort = dateObj ? `${dateObj.getDate()}/${dateObj.getMonth() + 1}` : row.timestamp.split(' ')[0];
        labels.push(dateShort);
    });

    const ctx = document.getElementById('warningChart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        const ctx2d = ctx.getContext('2d');
        const gradient = ctx2d.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 82, 82, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 82, 82, 0.0)');

        currentChart = new Chart(ctx2d, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ค่าไฟสะสมจริง',
                        data: costData,
                        borderColor: '#FF5252',
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6
                    },
                    {
                        label: `งบประมาณ (${BUDGET_LIMIT} บ.)`,
                        data: budgetData,
                        borderColor: '#333',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                    y: { beginAtZero: true, grid: { color: '#f5f5f5' } }
                }
            }
        });
    }
}

// --- RENDER BREAKDOWN ---
function renderBreakdownPage(data) {
    let dayUsage = 0;
    let nightUsage = 0;

    data.forEach(row => {
        const date = parseDate(row.timestamp);
        if (!date) return;
        const hour = date.getHours();
        const kwh = parseFloat(row.kwh_usage);
        if (hour >= 9 && hour < 22) dayUsage += kwh;
        else nightUsage += kwh;
    });

    const total = dayUsage + nightUsage;
    const dayPercent = total > 0 ? ((dayUsage / total) * 100).toFixed(0) : 0;
    const nightPercent = total > 0 ? ((nightUsage / total) * 100).toFixed(0) : 0;

    safeSetText('legend-day', `กลางวัน ${dayPercent}% (Peak)`);
    safeSetText('legend-night', `กลางคืน ${nightPercent}% (Off-Peak)`);

    const ctx = document.getElementById('pieChart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['กลางวัน (Peak)', 'กลางคืน (Off-Peak)'],
                datasets: [{
                    data: [dayUsage, nightUsage],
                    backgroundColor: ['#E0E0E0', '#333333'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

// --- INTERACTION ---
function showPlanList() {
    const start = document.getElementById('step-start');
    const selection = document.getElementById('step-selection');
    if(start) start.style.display = 'none';
    if(selection) {
        selection.classList.remove('hidden');
        selection.classList.add('fade-in');
    }
}

function showPlanDetail(planType) {
    const resultSection = document.getElementById('step-result');
    const plans = {
        'lite': { title: 'แผน Lite', desc: 'ปิดไฟดวงที่ไม่ใช้', amount: '50-80 บาท' },
        'balance': { title: 'แผน Balance', desc: 'แอร์ 26°C + พัดลม', amount: '150-200 บาท' },
        'max': { title: 'แผน Max', desc: 'งดน้ำอุ่น + แอร์เฉพาะตอนนอน', amount: '300+ บาท' }
    };

    if (plans[planType]) {
        safeSetText('result-title', plans[planType].title);
        safeSetText('result-desc', plans[planType].desc);
        safeSetText('result-amount', plans[planType].amount);
        
        if(resultSection) {
            resultSection.classList.remove('hidden');
            resultSection.classList.add('fade-in');
            if (window.innerWidth < 768) {
                setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        }
    }
}