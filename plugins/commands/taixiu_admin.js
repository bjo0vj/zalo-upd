const { rollDice, saveHistory, updateUserMoney, getUserMoney, incrementGlobalSessionCount } = require("../../utils/taixiu_utils");

// Global game state
if (!global.taixiu) {
    global.taixiu = {
        sessions: {} // { threadId: { enabled: bool, isRunning: bool, bets: {}, timer: null, sessionCount: 0 } }
    };
}

function getSession(threadId) {
    if (!global.taixiu.sessions[threadId]) {
        global.taixiu.sessions[threadId] = {
            enabled: false,
            isRunning: false,
            bets: {},
            timer: null,
            sessionCount: 0
        };
    }
    return global.taixiu.sessions[threadId];
}

module.exports.config = {
    name: "taixiugamestart",
    aliases: ['taixiugamestart="19082803"'],
    version: "2.1.0",
    role: 0, // Everyone can uses
    author: "TDF-2803",
    description: "Bắt đầu game Tài Xỉu tự động",
    category: "Game",
    usage: "/taixiugamestart=\"19082803\"",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, messageID, type } = event;
    const session = getSession(threadId);

    // If game is already running, notify
    if (session.isRunning) {
        return api.sendMessage("⚠️ Game Tài Xỉu đang chạy rồi!", threadId, type);
    }

    // Enable and Start
    session.enabled = true;

    const startGameSession = () => {
        session.isRunning = true;
        session.bets = {};
        const sessionID = incrementGlobalSessionCount(); // Use global session counter
        let countdown = 90; // 90s for betting

        // Initial Message - No auto delete
        api.sendMessage(`🎲 PHIÊN TÀI XỈU #${sessionID} BẮT ĐẦU!\n⏳ Thời gian đặt cược: 90s\n💰 Đặt cược: /taixiu cuoc <tai/xiu> <số tiền>`, threadId, type);

        // Countdown Loop
        session.timer = setInterval(async () => {
            if (!session.isRunning) {
                clearInterval(session.timer);
                return;
            }

            countdown--;

            // Send countdown message every 30s, and every 1s for the last 5s
            if ((countdown % 30 === 0 || countdown <= 5) && countdown > 0) {
                api.sendMessage(`⏳ Còn lại ${countdown}s...`, threadId, type, (err, info) => {
                    if (err) return;
                    const ttl = countdown <= 5 ? 2000 : 30000;
                    setTimeout(() => {
                        api.deleteMessage(info.messageID).catch(e => { });
                    }, ttl);
                });
            }

            if (countdown <= 0) {
                clearInterval(session.timer);
                session.isRunning = false;

                // Roll Dice
                const result = rollDice();
                saveHistory(result);

                // Announce Result
                let msg = `🎲 KẾT QUẢ PHIÊN #${sessionID}\n`;
                msg += `🎲 Xúc xắc: ${result.d1} - ${result.d2} - ${result.d3}\n`;
                msg += `📊 Tổng: ${result.total} - ${result.result.toUpperCase()}\n`;
                msg += `━━━━━━━━━━━━━━━━━━\n`;

                // Process Bets
                let winners = [];
                let losers = [];

                for (const [uid, bet] of Object.entries(session.bets)) {
                    // Use saved name from bet time, fallback to "Người chơi"
                    const name = bet.name || "Người chơi";

                    if (bet.choice.toLowerCase() === result.result.toLowerCase()) {
                        const winAmount = Math.floor(bet.amount * 1.98); // Rate 1.98
                        updateUserMoney(uid, winAmount);
                        winners.push({ name, bet: bet.amount, win: winAmount });
                    } else {
                        losers.push({ name, amount: bet.amount });
                    }
                }

                if (winners.length > 0) {
                    msg += `🏆 THẮNG:\n`;
                    winners.forEach((w, i) => {
                        msg += `Thắng: ${w.name}: ${w.win.toLocaleString()} VNĐ\n`;
                    });
                }

                if (losers.length > 0) {
                    msg += `💸 THUA:\n`;
                    losers.forEach((l, i) => {
                        msg += `${l.name}: ${l.amount.toLocaleString()} VNĐ\n`;
                    });
                }

                if (winners.length === 0 && losers.length === 0) msg += `👻 Không có ai chơi phiên này.`;

                msg += `\n⏳ Phiên mới sẽ bắt đầu sau 10s...`;

                // Result Message - No auto delete
                api.sendMessage(msg, threadId, type);

                // Auto restart after 10 seconds
                if (session.enabled) {
                    setTimeout(() => {
                        if (session.enabled) startGameSession();
                    }, 10000);
                }
            }
        }, 1000);
    };

    startGameSession();
    return api.sendMessage("✅ Đã kích hoạt chế độ Game Tài Xỉu tự động!\nGame sẽ tự động lặp lại các phiên.", threadId, type);
};
