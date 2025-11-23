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
    name: "unmute",
    version: "1.0.0",
    role: 2,
    author: "TDF-2803",
    description: "Bỏ cấm chat người dùng",
    category: "Quản lý",
    usage: "/unmute <uid>",
    cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, type } = event;

    if (args.length < 1) {
        return api.sendMessage(
            "⚠️ Vui lòng nhập UID\n📌 Cách dùng: /unmute <uid>\n📌 Ví dụ: /unmute 123456789",
            threadId,
            type
        );
    }

    const targetUid = args[0];

    try {
        const mutedUsers = loadMutedUsers();

        if (!mutedUsers[targetUid]) {
            return api.sendMessage("⚠️ Người dùng này không bị cấm chat!", threadId, type);
        }

        delete mutedUsers[targetUid];
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

        const msg = `✅ Đã bỏ cấm chat @${name}\n🆔 UID: ${targetUid}`;
        return api.sendMessage({
            msg: msg,
            mentions: [{ pos: 21, uid: targetUid, len: name.length + 1 }]
        }, threadId, type);

    } catch (error) {
        console.error("Error in unmute:", error);
        return api.sendMessage(`❌ Lỗi: ${error.message}`, threadId, type);
    }
};
