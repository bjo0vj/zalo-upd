const fs = require("fs");
const path = require("path");

module.exports.config = {
    name: "cleardata",
    version: "1.0.0",
    role: 2, // Admin only
    author: "TDF-2803",
    description: "Xóa file message_cache.json và thông báo dung lượng giải phóng",
    category: "Admin",
    usage: "/cleardata",
    cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
    const { threadId, type } = event;
    const messageCachePath = path.join(__dirname, "../../data/message_cache.json");

    try {
        // Check if file exists
        if (!fs.existsSync(messageCachePath)) {
            return api.sendMessage("⚠️ File message_cache.json không tồn tại.", threadId, type);
        }

        // Get file size before deletion
        const stats = fs.statSync(messageCachePath);
        const fileSizeInBytes = stats.size;
        const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

        // Clear the file by writing empty object
        fs.writeFileSync(messageCachePath, "{}", "utf-8");

        // Format size display
        let sizeDisplay;
        if (fileSizeInBytes < 1024) {
            sizeDisplay = `${fileSizeInBytes} bytes`;
        } else if (fileSizeInBytes < 1024 * 1024) {
            sizeDisplay = `${fileSizeInKB} KB`;
        } else {
            sizeDisplay = `${fileSizeInMB} MB`;
        }

        // Send notification with 10-minute TTL
        return api.sendMessage(
            {
                msg: `✅ Đã xóa message_cache.json thành công!\n📊 Dung lượng giải phóng: ${sizeDisplay}`,
                ttl: 600000 // 10 minutes in milliseconds
            },
            threadId,
            type
        );
    } catch (error) {
        return api.sendMessage(
            {
                msg: `❌ Lỗi khi xóa file: ${error.message}`,
                ttl: 600000 // 10 minutes
            },
            threadId,
            type
        );
    }
};
