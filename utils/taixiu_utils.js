const fs = require("fs");
const path = require("path");

const taixiuHistoryFile = path.join(__dirname, "../data/taixiu_history.json");
const moneyFile = path.join(__dirname, "../data/money.json");

// --- Money Management ---
function getMoneyData() {
    if (!fs.existsSync(moneyFile)) return {};
    return JSON.parse(fs.readFileSync(moneyFile, "utf8"));
}

function saveMoneyData(data) {
    fs.writeFileSync(moneyFile, JSON.stringify(data, null, 2), "utf8");
}

function getUserMoney(uid) {
    const data = getMoneyData();
    return data[uid] || 0;
}

function updateUserMoney(uid, amount) {
    const data = getMoneyData();
    if (!data[uid]) data[uid] = 0;
    data[uid] += amount;
    if (data[uid] < 0) data[uid] = 0;
    saveMoneyData(data);
    return data[uid];
}

// --- Game History ---
function getHistory() {
    if (!fs.existsSync(taixiuHistoryFile)) return [];
    return JSON.parse(fs.readFileSync(taixiuHistoryFile, "utf8"));
}

function saveHistory(result) {
    let history = getHistory();
    history.unshift(result);
    if (history.length > 10) history.pop(); // Keep last 10
    fs.writeFileSync(taixiuHistoryFile, JSON.stringify(history, null, 2), "utf8");
}

// --- Game Logic ---
function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2 + d3;
    const result = (total >= 3 && total <= 10) ? "Xỉu" : "Tài";
    return { d1, d2, d3, total, result };
}

// --- Global Session Counter ---
const sessionFile = path.join(__dirname, "../data/taixiu_sessions.json");

function getGlobalSessionCount() {
    if (!fs.existsSync(sessionFile)) {
        fs.writeFileSync(sessionFile, JSON.stringify({ globalSessionCount: 0 }, null, 2), "utf8");
        return 0;
    }
    const data = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    return data.globalSessionCount || 0;
}

function incrementGlobalSessionCount() {
    const currentCount = getGlobalSessionCount();
    const newCount = currentCount + 1;
    fs.writeFileSync(sessionFile, JSON.stringify({ globalSessionCount: newCount }, null, 2), "utf8");
    return newCount;
}

module.exports = {
    getUserMoney,
    updateUserMoney,
    getHistory,
    saveHistory,
    rollDice,
    getGlobalSessionCount,
    incrementGlobalSessionCount,
    getMoneyData
};
