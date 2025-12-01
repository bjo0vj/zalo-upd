
const { updateUserMoney, getUserMoney, getHistory, getMoneyData } = require("../../utils/taixiu_utils");

module.exports.config = {
    name: "taixiu_player",
    aliases: ["taixiu", "soicau", "menutaixiu", "xemvi", "xemallvi"],
    version: "1.1.0",
    role: 0,
    author: "TDF-2803",
    description: "Lệnh người chơi Tài Xỉu",
    category: "Game",
    usage: "/taixiu cuoc, /soicau, /menutaixiu",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, messageID, type } = event;
    const senderID = event.senderID || event.data.uidFrom;
    const command = args[0];
    const body = event.body || event.data?.content || "";
    const alias = body.split(" ")[0].slice(1).toLowerCase();

    // 1. /menutaixiu (Hidden Menu) - Allow this to run even if game is not enabled
    if (alias === "menutaixiu") {
        const balance = getUserMoney(senderID);
        // if (balance <= 0) {
        //    return api.sendMessage("🚫 Bạn chưa có tài khoản hoặc số dư bằng 0. Vui lòng liên hệ Admin để nạp tiền.", threadId, type);
        // }

        let msg = "🎰 MENU TÀI XỈU 🎰\n\n";
        msg += "1. /taixiu cuoc <tai/xiu> <tiền|allin> - Đặt cược\n";
        msg += "2. /soicau - Xem lịch sử 10 ván gần nhất\n";
        msg += "3. /xemvi - Xem số dư ví của bạn\n";
        msg += "4. /xemallvi - Xem ví tiền tất cả người trong nhóm\n";
        msg += "5. /wallet nap @tên <số tiền> - Nạp tiền cho người chơi\n";
        msg += "6. /wallet nap @All <số tiền> - Nạp tiền cho tất cả\n";
        msg += "7. /taixiugamestart=\"19082803\" - Bắt đầu game\n";
        msg += "8. /taixiu stop=True - Dừng game\n";

        if (!global.taixiu || !global.taixiu.sessions || !global.taixiu.sessions[threadId] || !global.taixiu.sessions[threadId].enabled) {
            msg += "\n⚠️ Game chưa được kích hoạt ở nhóm này.\nDùng lệnh: /taixiugamestart=\"19082803\" để kích hoạt.";
        }

        return api.sendMessage({ msg: msg, ttl: 180000 }, threadId, type);
    }

    // Check session for other commands
    if (!global.taixiu || !global.taixiu.sessions || !global.taixiu.sessions[threadId] || !global.taixiu.sessions[threadId].enabled) {
        return;
    }

    const session = global.taixiu.sessions[threadId];

    // 2. /xemvi - Check balance
    if (alias === "xemvi") {
        const balance = getUserMoney(senderID);
        return api.sendMessage({ msg: `💰 Số dư của bạn: ${balance.toLocaleString()} VNĐ`, ttl: 180000 }, threadId, type);
    }

    // 2.5. /xemallvi - Check all balances in group
    if (alias === "xemallvi") {
        try {
            const groupInfo = await api.getGroupInfo(threadId);
            const details = groupInfo.gridInfoMap?.[threadId] || {};

            let participantIDs = [];
            // Try to get from memVerList
            if (details.memVerList && Array.isArray(details.memVerList)) {
                participantIDs = details.memVerList.map(item => item.split('_')[0]);
            }
            // Fallback methods
            if (participantIDs.length === 0) {
                participantIDs = event.participantIDs;
            }
            if (!participantIDs || participantIDs.length === 0) {
                participantIDs = details.participantIDs || details.members;
            }
            if ((!participantIDs || participantIDs.length === 0) && details.userInfoMap) {
                participantIDs = Object.keys(details.userInfoMap);
            }

            // Deduplicate
            participantIDs = [...new Set(participantIDs)];

            if (!participantIDs || participantIDs.length === 0) {
                return api.sendMessage("❌ Không thể lấy danh sách thành viên nhóm.", threadId, type);
            }

            const moneyData = getMoneyData();
            let msg = "💰 VÍ TIỀN TẤT CẢ THÀNH VIÊN 💰\n\n";

            // Get user info for names
            const userInfo = await api.getUserInfo(participantIDs);

            let walletList = [];
            for (const uid of participantIDs) {
                const balance = moneyData[uid] || 0;
                let userName = "Unknown";

                // Try to get name from userInfo
                if (userInfo && userInfo.changed_profiles && userInfo.changed_profiles[uid]) {
                    userName = userInfo.changed_profiles[uid].displayName || userInfo.changed_profiles[uid].name;
                } else if (userInfo && userInfo[uid]) {
                    userName = userInfo[uid].name || userInfo[uid].displayName || userInfo[uid].fullName;
                }

                walletList.push({ name: userName, balance: balance });
            }

            // Sort by balance descending
            walletList.sort((a, b) => b.balance - a.balance);

            // Format output
            walletList.forEach((item, index) => {
                msg += `${index + 1}. ${item.name}: ${item.balance.toLocaleString()} VNĐ\n`;
            });

            msg += `\n📊 Tổng số thành viên: ${walletList.length}`;

            return api.sendMessage({ msg: msg, ttl: 180000 }, threadId, type);
        } catch (err) {
            console.error("Error in /xemallvi:", err);
            return api.sendMessage("❌ Đã xảy ra lỗi khi lấy thông tin ví.", threadId, type);
        }
    }

    // 3. /soicau
    if (alias === "soicau") {
        const history = getHistory();
        if (history.length === 0) {
            return api.sendMessage("📭 Chưa có dữ liệu lịch sử.", threadId, type);
        }

        let msg = "📊 LỊCH SỬ 10 PHIÊN GẦN NHẤT:\n\n";
        history.forEach((h, i) => {
            msg += `#${i + 1}: ${h.d1}-${h.d2}-${h.d3} (Tổng: ${h.total}) => ${h.result.toUpperCase()}\n`;
        });

        return api.sendMessage({ msg: msg, ttl: 180000 }, threadId, type);
    }

    // 3.5. /taixiu stop=True - Stop game
    if (alias === "taixiu" && args[0] && args[0].toLowerCase().includes("stop=true")) {
        if (session.timer) {
            clearInterval(session.timer);
            session.timer = null;
        }
        session.isRunning = false;
        session.enabled = false;
        session.bets = {};

        return api.sendMessage("🛑 Đã dừng game Tài Xỉu!", threadId, type);
    }

    // 4. /taixiu cuoc <tai/xiu> <amount|allin>
    if (alias === "taixiu" && command === "cuoc") {
        if (!session.isRunning) {
            return api.sendMessage("⚠️ Game chưa bắt đầu hoặc đã kết thúc.", threadId, type);
        }

        const choice = args[1];
        let amount;

        // Check if user wants to bet all-in
        if (args[2] && args[2].toLowerCase() === "allin") {
            amount = getUserMoney(senderID);
            if (amount <= 0) {
                return api.sendMessage("🚫 Bạn không có tiền để cược!", threadId, type);
            }
        } else {
            amount = parseInt(args[2]);
        }

        if (!choice || !["tai", "xiu"].includes(choice.toLowerCase()) || isNaN(amount) || amount <= 0) {
            return api.sendMessage("Cú pháp: /taixiu cuoc <tai/xiu> <số tiền|allin>", threadId, type);
        }

        const currentMoney = getUserMoney(senderID);
        if (currentMoney < amount) {
            return api.sendMessage(`🚫 Số dư không đủ! Bạn còn ${currentMoney.toLocaleString()} VNĐ.`, threadId, type);
        }

        // Get user name - try multiple methods to ensure we get real name
        let userName = null;
        try {
            const info = await api.getUserInfo(senderID);
            // Method 1: Try changed_profiles
            if (info && info.changed_profiles && info.changed_profiles[senderID]) {
                userName = info.changed_profiles[senderID].displayName || info.changed_profiles[senderID].name;
            }
            // Method 2: Try direct UID lookup
            if (!userName && info && info[senderID]) {
                userName = info[senderID].name || info[senderID].displayName || info[senderID].fullName;
            }
        } catch (err) {
            console.error("Error getting user info:", err);
        }

        // Fallback: Use UID if we still don't have a name
        if (!userName) {
            userName = `User_${senderID}`;
        }

        // Deduct money immediately
        updateUserMoney(senderID, -amount);

        // Record bet with userName
        session.bets[senderID] = {
            choice: choice.toLowerCase(),
            amount: amount,
            name: userName
        };

        const newBalance = currentMoney - amount;
        const msg = `@${userName} đã đặt cược ${choice.toUpperCase()} với số tiền ${amount.toLocaleString()} VNĐ. Số dư của bạn là ${newBalance.toLocaleString()} VNĐ.`;

        return api.sendMessage({
            msg: msg,
            mentions: [{
                tag: `@${userName}`,
                id: senderID,
                fromIndex: msg.indexOf(`@${userName}`)
            }]
        }, threadId, type);
    }
};
