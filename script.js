// --- CONFIGURATION ---
const SHEET_ID = "1uY2EGP7UkzMKTlhFr4vlO70ovk3yCpv4Rbo3SA7UJFk";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const BUDGET_LIMIT = 1500;

document.addEventListener("DOMContentLoaded", async () => {
    Chart.defaults.font.family = "'Prompt', sans-serif";
    Chart.defaults.color = '#888888';

    const hasDashboard = document.getElementById('display-amount');
    const hasUsageChart = document.getElementById('usageChart');
    const hasWarningChart = document.getElementById('warningChart');
    const hasPieChart = document.getElementById('pieChart');

    try {
        const rawData = await fetchCSV();
        const data = parseCSV(rawData);

        if (data.length === 0) throw new Error("ไม่พบข้อมูลใน Google Sheet");

        // Log ดูข้อมูลแถวล่าสุด เพื่อเช็คว่าดึงมาครบไหม (กด F12 ดู Console)
        console.log("ข้อมูลแถวล่าสุด:", data[data.length - 1]);

        if (hasDashboard) renderDashboard(data);
        if (hasUsageChart) renderUsagePage(data);
        if (hasWarningChart) renderWarningPage(data);
        if (hasPieChart) renderBreakdownPage(data);

    } catch (error) {
        console.error("Critical Error:", error);
        if (hasDashboard) {
            safeSetText('display-amount', "Error");
            safeSetText('last-update', "Error: " + error.message);
        }
    }
});

// --- 1. DATA FETCHING & PARSING (แก้ไข: แก้ปัญหาคอลัมน์ซ้ำ) ---
async function fetchCSV() {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error("เชื่อมต่อ Google Sheet ไม่สำเร็จ");
    return await response.text();
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Clean Headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^[\uFEFF\uFFFE]/, '').toLowerCase());
    
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentline = lines[i].split(',');
        const obj = {};
        let hasData = false;

        for (let j = 0; j < headers.length; j++) {
            let headerName = headers[j];
            let val = (currentline[j] || "").trim();

            // [แก้ไขสำคัญ] ถ้ามีค่าใน obj แล้ว (แปลว่าเจอคอลัมน์ชื่อซ้ำไปแล้ว) ให้ข้าม
            // เพื่อยึดข้อมูลจากคอลัมน์แรกสุดเป็นหลัก
            if (!obj.hasOwnProperty(headerName)) {
                obj[headerName] = val;
            }
            
            if (val !== "") hasData = true;
        }

        if (hasData && obj.timestamp) {
            data.push(obj);
        }
    }
    return data;
}

// --- HELPER FUNCTIONS ---
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        // ถ้าค่าเป็น undefined หรือ null ให้แสดง -
        el.innerText = (text === undefined || text === null || text === "") ? "-" : text;
    }
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

// --- 2. DASHBOARD LOGIC ---
function renderDashboard(data) {
    const validData = data.filter(row => parseDate(row.timestamp) !== null);
    if (validData.length === 0) return;

    validData.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp));

    let totalCost = 0;
    validData.forEach(row => {
        totalCost += parseFloat(row.cost_baht || 0);
    });

    const lastRow = validData[validData.length - 1];
    const lastDate = lastRow.timestamp;

    animateValue("display-amount", 0, totalCost, 1000);

    const percent = (totalCost / BUDGET_LIMIT) * 100;
    safeSetStyle('progress-fill', 'width', `${Math.min(percent, 100)}%`);
    safeSetText('progress-text', `${Math.floor(totalCost)} ฿ / ${BUDGET_LIMIT} ฿`);

    if (lastDate) safeSetText('last-update', `อัปเดตล่าสุด: ${lastDate}`);

    // Logic สี
    const sheetLevel = (lastRow.level || "normal").toLowerCase().trim();
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
    
}

// --- 3. USAGE CHART (แก้ไข: แสดงข้อมูล Insight) ---
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
        new Chart(ctx, {
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

    // Insight Data
    const lastRow = validData[validData.length - 1];
    
    // Debug: ดูว่าค่ามาไหม
    console.log("Last Row for Insight:", lastRow);

    safeSetText('insight-room', lastRow.room_number);
    safeSetText('insight-meter', lastRow.kwh_reading ? lastRow.kwh_reading + " kWh" : "-");
    safeSetText('insight-power', lastRow.power_watts ? lastRow.power_watts + " W" : "-");
    safeSetText('insight-cost', lastRow.cost_baht ? parseFloat(lastRow.cost_baht).toFixed(2) + " ฿" : "-");
}

// --- 4. WARNING CHART (แก้ไข: คำนวณเงินทุกแถว ไม่ให้ยอดหาย) ---
function renderWarningPage(data) {
    // 1. กรองและเรียงข้อมูล
    const validData = data.filter(row => parseDate(row.timestamp) !== null);
    validData.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp));

    let cumulativeCost = 0;
    const costData = [];
    const budgetData = [];
    const labels = [];

    // 2. วนลูปข้อมูล
    validData.forEach((row, index) => {
        // [จุดที่แก้ไข] บวกเงิน "ทุกแถว" (ห้ามข้าม)
        cumulativeCost += parseFloat(row.cost_baht || 0);

        // 3. การลดจำนวนจุดกราฟ (Sampling) เพื่อไม่ให้กราฟรก
        // จะทำ "หลังจาก" บวกเงินเสร็จแล้วเท่านั้น
        // (โชว์ทุกๆ 5 จุด หรือจุดสุดท้ายต้องโชว์เสมอ)
        if (validData.length > 50 && index % 5 !== 0 && index !== validData.length - 1) {
            return; 
        }

        // 4. เก็บข้อมูลลงกราฟ
        costData.push(cumulativeCost);
        budgetData.push(BUDGET_LIMIT);

        // สร้าง Label วันที่ (เช่น 07/12)
        const dateObj = parseDate(row.timestamp);
        const dateShort = dateObj ? 
            `${dateObj.getDate()}/${dateObj.getMonth() + 1}` : 
            row.timestamp.split(' ')[0];
            
        labels.push(dateShort);
    });

    // 5. วาดกราฟ
    const ctx = document.getElementById('warningChart');
    if (ctx) {
        const ctx2d = ctx.getContext('2d');
        
        // Gradient สีแดงสวยๆ
        const gradient = ctx2d.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 82, 82, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 82, 82, 0.0)');

        new Chart(ctx2d, {
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
                        pointRadius: 0, // ซ่อนจุดเล็กๆ
                        pointHoverRadius: 6
                    },
                    {
                        label: `งบประมาณ (${BUDGET_LIMIT} บ.)`,
                        data: budgetData,
                        borderColor: '#333',
                        borderDash: [5, 5], // เส้นประ
                        pointRadius: 0,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + Math.floor(context.raw) + ' บาท';
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { display: false }, 
                        ticks: { maxTicksLimit: 6 } // จำกัดจำนวนวันที่โชว์แกน X
                    },
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#f5f5f5' }
                    }
                }
            }
        });
    }
}

// --- 5. BREAKDOWN ---
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
        new Chart(ctx, {
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

// --- UTILS ---
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