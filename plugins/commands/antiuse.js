const fs = require("fs").promises;
const path = require("path");

const BANNED_USERS_FILE = path.join(__dirname, "../../modules/banned_users.json");

module.exports.config = {
    name: "antiuse",
    version: "1.0.0",
    role: 0, // 0 for everyone, permissions checked inside
    author: "TDF-2803",
    description: "Cấm người dùng sử dụng bot",
    category: "Admin",
    usage: "/antiuse <uid> | /accpectuse <uid> | /antiuselist",
    cooldowns: 2,
    aliases: ["accpectuse", "antiuselist"]
};

async function getBannedUsers() {
    try {
        const data = await fs.readFile(BANNED_USERS_FILE, "utf8");
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveBannedUsers(users) {
    await fs.writeFile(BANNED_USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

module.exports.run = async function ({ api, event, args, Users }) {
    const { threadId, type, data } = event;
    const commandName = data.content.split(" ")[0].slice(1).toLowerCase(); // Get command name without prefix

    // /antiuselist - Available to everyone (technically role 2 prevents this, so we need to handle it manually or change role)
    // Wait, if role is 2, handleCommand blocks it for non-admins. 
    // The user said "/antiuselist thì ai cũng dùng đc".
    // So I should set role to 0 and handle permissions inside.

    if (commandName === "antiuselist") {
        const bannedUsers = await getBannedUsers();
        if (bannedUsers.length === 0) {
            return api.sendMessage("✅ Hiện tại không có người dùng nào bị cấm.", threadId, type);
        }
        let msg = "🚫 Danh sách người dùng bị cấm:\n\n";
        bannedUsers.forEach((user, index) => {
            msg += `${index + 1}. ${user.name} (${user.uid})\n   ⏰ ${user.time}\n`;
        });
        return api.sendMessage(msg, threadId, type);
    }

    // Check admin permission for other commands
    const config = global.config;
    const admin = config.admin_bot || [];
    const senderId = data.uidFrom;

    if (!admin.includes(senderId)) {
        return api.sendMessage("⚠️ Bạn không có quyền sử dụng lệnh này.", threadId, type);
    }

    if (commandName === "antiuse") {
        const targetId = args[0];
        if (!targetId) {
            return api.sendMessage("⚠️ Vui lòng nhập UID người cần cấm.\n📌 Ví dụ: /antiuse 123456789", threadId, type);
        }

        let bannedUsers = await getBannedUsers();
        if (bannedUsers.some(u => u.uid === targetId)) {
            return api.sendMessage("⚠️ Người dùng này đã bị cấm từ trước.", threadId, type);
        }

        // Get user name
        let name = "Không rõ";
        try {
            const userInfo = await api.getUserInfo(targetId);
            name = userInfo.changed_profiles[targetId]?.displayName || userInfo.name || "Không rõ";
        } catch (e) {
            // Ignore error
        }

        bannedUsers.push({
            uid: targetId,
            name: name,
            time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        });

        await saveBannedUsers(bannedUsers);
        return api.sendMessage(`🚫 Đã cấm người dùng sử dụng bot.\n👤 Tên: ${name}\n🆔 UID: ${targetId}`, threadId, type);
    }

    if (commandName === "accpectuse") {
        const targetId = args[0];
        if (!targetId) {
            return api.sendMessage("⚠️ Vui lòng nhập UID người cần mở cấm.\n📌 Ví dụ: /accpectuse 123456789", threadId, type);
        }

        let bannedUsers = await getBannedUsers();
        const index = bannedUsers.findIndex(u => u.uid === targetId);

        if (index === -1) {
            return api.sendMessage("⚠️ Người dùng này không có trong danh sách cấm.", threadId, type);
        }

        const removedUser = bannedUsers[index];
        bannedUsers.splice(index, 1);
        await saveBannedUsers(bannedUsers);

        return api.sendMessage(`✅ Đã mở khóa cho người dùng.\n👤 Tên: ${removedUser.name}\n🆔 UID: ${targetId}`, threadId, type);
    }
};
