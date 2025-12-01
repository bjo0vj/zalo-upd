const fs = require("fs");
const path = require("path");

const moneyFile = path.join(__dirname, "../../data/money.json");

function getMoneyData() {
    if (!fs.existsSync(moneyFile)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(moneyFile, "utf8"));
}

function saveMoneyData(data) {
    fs.writeFileSync(moneyFile, JSON.stringify(data, null, 2), "utf8");
}

function formatMoney(amount) {
    return amount.toLocaleString("vi-VN") + " VNĐ";
}

module.exports.config = {
    name: "wallet",
    aliases: ["vi", "money"],
    version: "1.3.0",
    role: 0,
    author: "TDF-2803",
    description: "Hệ thống ví tiền",
    category: "Game",
    usage: "/makemoneyfile, /nap, /napall, /clearmoney, /laylai, /checksodu",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, messageID, type } = event;
    const senderID = event.senderID || event.data.uidFrom;
    const command = args[0];
    const config = global.config;
    const admin = config.admin_bot || [];
    const isAdmin = admin.some(id => String(id) === String(senderID)) || String(senderID) === "126026046603679910";

    if (!command) {
        return api.sendMessage("Vui lòng nhập lệnh cụ thể.", threadId, type);
    }

    // 1. /makemoneyfile (Admin only)
    if (command === "makemoneyfile") {
        if (!isAdmin) return api.sendMessage("⚠️ Bạn không có quyền Admin để dùng lệnh này.", threadId, type);
        if (!fs.existsSync(moneyFile)) {
            saveMoneyData({});
            return api.sendMessage("Đã tạo file money.json thành công.", threadId, type);
        } else {
            return api.sendMessage("File money.json đã tồn tại.", threadId, type);
        }
    }

    // 2. /nap @tag <amount> (Open to all users)
    if (command === "nap") {
        // Removed admin check - now accessible to everyone

        const target = args[1];
        const amount = parseInt(args[args.length - 1]);

        // Handle /nap @All <amount>
        if (target && (target.toLowerCase() === "@all" || target.toLowerCase() === "all")) {
            if (isNaN(amount) || amount <= 0) {
                return api.sendMessage("Cú pháp: /wallet nap @All <số tiền>", threadId, type);
            }

            try {
                const groupInfo = await api.getGroupInfo(threadId);
                const details = groupInfo.gridInfoMap?.[threadId] || {};

                let participantIDs = [];
                // Try to get from memVerList (e.g., "UID_0")
                if (details.memVerList && Array.isArray(details.memVerList)) {
                    participantIDs = details.memVerList.map(item => item.split('_')[0]);
                }
                // Fallback to other methods
                if (participantIDs.length === 0) {
                    participantIDs = event.participantIDs;
                }
                if (!participantIDs || participantIDs.length === 0) {
                    participantIDs = details.participantIDs || details.members;
                }
                if ((!participantIDs || participantIDs.length === 0) && details.userInfoMap) {
                    participantIDs = Object.keys(details.userInfoMap);
                }
                if (!participantIDs || participantIDs.length === 0) {
                    const admins = details.adminIds || [];
                    const creator = details.creatorId;
                    participantIDs = [...admins];
                    if (creator && !participantIDs.includes(creator)) participantIDs.push(creator);
                    const senderID = event.senderID || event.data?.uidFrom;
                    if (senderID && !participantIDs.includes(senderID)) participantIDs.push(senderID);
                }

                // Deduplicate
                participantIDs = [...new Set(participantIDs)];

                console.log("DEBUG wallet nap @All IDs:", participantIDs); // Debug log

                if (!participantIDs || participantIDs.length === 0) {
                    return api.sendMessage("Không thể lấy danh sách thành viên nhóm.", threadId, type);
                }

                let data = getMoneyData();
                let count = 0;

                participantIDs.forEach(uid => {
                    const strUid = String(uid); // Ensure string
                    if (!data[strUid]) data[strUid] = 0;
                    data[strUid] += amount;
                    count++;
                });

                console.log("DEBUG wallet data before save:", JSON.stringify(data, null, 2)); // Debug log
                saveMoneyData(data);
                return api.sendMessage(`✅ Đã nạp ${formatMoney(amount)} cho tất cả ${count} thành viên trong nhóm.`, threadId, type);
            } catch (err) {
                console.error(err);
                return api.sendMessage("❌ Đã xảy ra lỗi khi lấy thông tin nhóm.", threadId, type);
            }
        }

        if (!event.mentions || Object.keys(event.mentions).length === 0 || isNaN(amount)) {
            return api.sendMessage("Cú pháp: /wallet nap @tag <số tiền> hoặc /wallet nap @All <số tiền>", threadId, type);
        }

        const mention = Object.keys(event.mentions)[0];
        let data = getMoneyData();
        if (!data[mention]) data[mention] = 0;
        data[mention] += amount;
        saveMoneyData(data);

        return api.sendMessage(`Đã nạp ${formatMoney(amount)} cho ${event.mentions[mention].replace("@", "")}.`, threadId, type);
    }

    // 3. /clearmoney @tag (Admin only)
    if (command === "clearmoney") {
        if (!isAdmin) return api.sendMessage("⚠️ Bạn không có quyền Admin để dùng lệnh này.", threadId, type);

        if (!event.mentions || Object.keys(event.mentions).length === 0) {
            return api.sendMessage("Cú pháp: /wallet clearmoney @tag", threadId, type);
        }

        const mention = Object.keys(event.mentions)[0];
        let data = getMoneyData();
        data[mention] = 0;
        saveMoneyData(data);

        return api.sendMessage(`Đã xóa tiền của ${event.mentions[mention].replace("@", "")} về 0.`, threadId, type);
    }

    // 3.5. /clearall - Clear all wallets (TDF Admin only)
    if (command === "clearall") {
        const tdfID = "126026046603679910";
        if (String(senderID) !== tdfID) {
            return api.sendMessage("⚠️ Chỉ TDF mới có quyền dùng lệnh này.", threadId, type);
        }

        saveMoneyData({});
        return api.sendMessage("✅ Đã xóa sạch ví tiền của tất cả mọi người!", threadId, type);
    }

    // 4. /laylai @tag <amount> (Admin only)
    if (command === "laylai") {
        if (!isAdmin) return api.sendMessage("⚠️ Bạn không có quyền Admin để dùng lệnh này.", threadId, type);

        if (!event.mentions || Object.keys(event.mentions).length === 0) {
            return api.sendMessage("Cú pháp: /wallet laylai @tag <số tiền>", threadId, type);
        }

        const mention = Object.keys(event.mentions)[0];
        const amount = parseInt(args[args.length - 1]);

        if (!mention || isNaN(amount)) {
            return api.sendMessage("Cú pháp: /wallet laylai @tag <số tiền>", threadId, type);
        }

        let data = getMoneyData();
        if (!data[mention]) data[mention] = 0;
        data[mention] -= amount;
        if (data[mention] < 0) data[mention] = 0;
        saveMoneyData(data);

        return api.sendMessage(`Đã trừ ${formatMoney(amount)} của ${event.mentions[mention].replace("@", "")}.`, threadId, type);
    }

    // 5. /checksodu (All users) or /adchecksodu @tag (Admin)
    if (command === "checksodu" || command === "adchecksodu") {
        let targetID = senderID;
        if (command === "adchecksodu") {
            if (!isAdmin) return api.sendMessage("⚠️ Bạn không có quyền Admin để dùng lệnh này.", threadId, type);
            if (event.mentions && Object.keys(event.mentions).length > 0) {
                const mention = Object.keys(event.mentions)[0];
                if (mention) targetID = mention;
            }
        }

        let data = getMoneyData();
        const balance = data[targetID] || 0;

        const msg = {
            body: `💰 Số dư của bạn: ${formatMoney(balance)}`
        };

        // Auto delete after 3 minutes (180000ms)
        api.sendMessage(msg, threadId, type, (err, info) => {
            if (!err) {
                setTimeout(() => {
                    api.deleteMessage(info.messageID);
                }, 180000);
            }
        });
    }

    // 6. /napall <amount> (Admin only)
    if (command === "napall") {
        if (!isAdmin) return api.sendMessage("⚠️ Bạn không có quyền Admin để dùng lệnh này.", threadId, type);
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) {
            return api.sendMessage("Cú pháp: /wallet napall <số tiền>", threadId, type);
        }

        // Get group info to list members
        api.getThreadInfo(threadId, (err, info) => {
            if (err) return api.sendMessage("Không thể lấy thông tin nhóm.", threadId, type);

            let data = getMoneyData();
            const participantIDs = info.participantIDs;
            let count = 0;

            participantIDs.forEach(uid => {
                // Skip bot ID if needed, but usually fine to add
                if (!data[uid]) data[uid] = 0;
                data[uid] += amount;
                count++;
            });

            saveMoneyData(data);
            return api.sendMessage(`✅ Đã nạp ${formatMoney(amount)} cho tất cả ${count} thành viên trong nhóm.`, threadId, type);
        });
    }
};
