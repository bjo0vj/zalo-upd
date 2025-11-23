const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

module.exports.config = {
    name: "addadmin",
    version: "1.0.0",
    role: 0,
    author: "TDF-2803",
    description: "Thêm admin bằng API key",
    category: "Hệ thống",
    usage: "/addadmin <API_KEY>",
    cooldowns: 5
};

const VALID_API_KEYS = ["19082008", "28030209", "04041000"];

module.exports.run = async function ({ api, event, args }) {
    const { threadId, type } = event;
    const senderID = event.senderID || event.data?.uidFrom;

    // Check if API key provided
    if (args.length === 0) {
        return api.sendMessage("⚠️ Vui lòng nhập API key.\n📌 Cách dùng: /addadmin <API_KEY>", threadId, type);
    }

    const apiKey = args[0];

    // Validate API key
    if (!VALID_API_KEYS.includes(apiKey)) {
        return api.sendMessage("❌ API key không hợp lệ!", threadId, type);
    }

    // Check if already admin
    const admins = global.config.admin_bot || [];
    if (admins.includes(senderID)) {
        return api.sendMessage("⚠️ Bạn đã là admin rồi!", threadId, type);
    }

    try {
        // Read config.yml
        const configPath = path.join(__dirname, "../../config.yml");
        const configContent = fs.readFileSync(configPath, "utf8");
        const config = yaml.parse(configContent);

        // Add user to admin list
        if (!Array.isArray(config.admin_bot)) {
            config.admin_bot = [];
        }
        config.admin_bot.push(senderID);

        // Write back to config.yml
        const newConfigContent = yaml.stringify(config);
        fs.writeFileSync(configPath, newConfigContent, "utf8");

        // Update global config
        global.config.admin_bot = config.admin_bot;

        // Get user name
        let name = "Bạn";
        try {
            const info = await api.getUserInfo(senderID);
            if (info && info[senderID]) {
                name = info[senderID].name || info[senderID].displayName || "Bạn";
            }
        } catch (e) {
            // Ignore error
        }

        return api.sendMessage(
            `✅ Thành công!\n👤 ${name} đã được thêm vào danh sách admin.\n🆔 ID: ${senderID}\n\n⚠️ Lưu ý: Cần khởi động lại bot để áp dụng đầy đủ quyền admin.`,
            threadId,
            type
        );
    } catch (error) {
        console.error("Error adding admin:", error);
        return api.sendMessage(`❌ Lỗi khi thêm admin: ${error.message}`, threadId, type);
    }
};
