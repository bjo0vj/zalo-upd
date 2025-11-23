module.exports.config = {
    name: "getid",
    version: "1.0.0",
    role: 0,
    author: "TDF-2803",
    description: "Lấy UID của người dùng",
    category: "Tiện ích",
    usage: "/getid @tên",
    cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
    const { threadId, type, data } = event;
    const mentions = data.mentions;

    try {
        // Check if there are mentions
        if (mentions && mentions.length > 0) {
            let msg = "✅ Tìm thấy ID người dùng:\n\n";

            for (let i = 0; i < mentions.length; i++) {
                let user = mentions[i];
                let name = user.name || "Không rõ tên";

                // If name is missing or generic, try to fetch it
                if (!user.name || user.name === "Không rõ tên") {
                    try {
                        const userInfo = await api.getUserInfo(user.uid);
                        name = userInfo.changed_profiles[user.uid]?.displayName || userInfo.name || "Không rõ tên";
                    } catch (e) {
                        // Keep default
                    }
                }

                msg += `${i + 1}. ${name}\n   🆔 UID: ${user.uid}\n\n`;
            }
            return api.sendMessage(msg, threadId, type);
        }

        // If no mentions, check if user wants their own ID (no args)
        if (args.length === 0) {
            const senderId = event.senderID || event.uidFrom; // Fallback for safety
            return api.sendMessage(`🆔 UID của bạn: ${senderId}`, threadId, type);
        }

        // If args are present but no mentions (e.g. user typed name without @ or just text)
        return api.sendMessage("⚠️ Vui lòng tag (@) người dùng để lấy UID.\n📌 Ví dụ: /getid @Tên", threadId, type);

    } catch (error) {
        console.error("Error in getid:", error);
        return api.sendMessage(`❌ Lỗi: ${error.message}`, threadId, type);
    }
};
