const fs = require("fs");
const path = require("path");

const mutedUsersPath = path.join(__dirname, "../../data/muted_users.json");

function loadMutedUsers() {
    try {
        if (fs.existsSync(mutedUsersPath)) {
            return JSON.parse(fs.readFileSync(mutedUsersPath, "utf8"));
        }
    } catch (e) {
        console.error("Error loading muted users:", e);
    }
    return {};
}

function saveMutedUsers(data) {
    try {
        const dataDir = path.dirname(mutedUsersPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(mutedUsersPath, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
        console.error("Error saving muted users:", e);
    }
}

module.exports.config = {
    name: "mute",
    version: "1.0.0",
    role: 2,
    author: "TDF-2803",
    description: "Cấm chat người dùng",
    category: "Quản lý",
    usage: "/mute <uid> <phút>",
    cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, type } = event;

    if (args.length < 2) {
        return api.sendMessage(
            "⚠️ Vui lòng nhập đủ thông tin\n📌 Cách dùng: /mute <uid> <phút>\n📌 Ví dụ: /mute 123456789 10",
            threadId,
            type
        );
    }

    const targetUid = args[0];
    const minutes = parseInt(args[1]);

    if (isNaN(minutes) || minutes <= 0) {
        return api.sendMessage("⚠️ Số phút phải là số nguyên dương!", threadId, type);
    }

    try {
        // Mute user
        const mutedUsers = loadMutedUsers();
        const muteUntil = Date.now() + (minutes * 60 * 1000);
        mutedUsers[targetUid] = muteUntil;
        saveMutedUsers(mutedUsers);

        // Get user name
        let name = "Người dùng";
        try {
            const info = await api.getUserInfo(targetUid);
            if (info && info[targetUid]) {
                name = info[targetUid].name || info[targetUid].displayName || "Người dùng";
            }
        } catch (e) {
            // Ignore
        }

        const msg = `🔇 Đã cấm chat @${name}\n⏱️ Thời gian: ${minutes} phút\n🆔 UID: ${targetUid}`;
        return api.sendMessage({
            msg: msg,
            mentions: [{ pos: 17, uid: targetUid, len: name.length + 1 }]
        }, threadId, type);

    } catch (error) {
        console.error("Error in mute:", error);
        return api.sendMessage(`❌ Lỗi: ${error.message}`, threadId, type);
    }
};
