const fs = require("fs");
const path = require("path");
const axios = require("axios");

const trackingDir = path.join(__dirname, "../../data/tracking_data");
const autoSendDir = path.join(__dirname, "../../data/autosendimge");

if (!fs.existsSync(autoSendDir)) {
    fs.mkdirSync(autoSendDir, { recursive: true });
}

// Helper to load/save data
function getFilePath(threadId) {
    if (!fs.existsSync(trackingDir)) {
        fs.mkdirSync(trackingDir, { recursive: true });
    }
    return path.join(trackingDir, `${threadId}.json`);
}

function loadData(threadId) {
    const filePath = getFilePath(threadId);
    if (!fs.existsSync(filePath)) {
        const defaultData = {
            target: 0,
            isRunning: false,
            sosanh: [], // List of { uid, name }
            dagui: [],  // List of uids
            ranks: [],  // List of { name, uid, count }
            firstSenderRecorded: false, // Flag for current session
            autoSendTarget: null // UID to auto send images to
        };
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        // Ensure properties exist
        if (!data.sosanh) data.sosanh = [];
        if (!data.dagui) data.dagui = [];
        if (!data.ranks) data.ranks = [];
        if (typeof data.firstSenderRecorded === 'undefined') data.firstSenderRecorded = false;
        if (typeof data.autoSendTarget === 'undefined') data.autoSendTarget = null;
        return data;
    } catch (e) {
        return {
            target: 0,
            isRunning: false,
            sosanh: [],
            dagui: [],
            ranks: [],
            firstSenderRecorded: false,
            autoSendTarget: null
        };
    }
}

function saveData(threadId, data) {
    const filePath = getFilePath(threadId);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}


module.exports.config = {
    name: "tracking",
    version: "1.5.0",
    role: 0,
    author: "TDF-2803",
    description: "Quản lý điểm danh gửi ảnh",
    category: "Tiện ích",
    usage: "/addten, /setnguoi <số lượng>, /start, /check, /stop, /check history <giờ>, /send <uid>, /sendoff",
    cooldowns: 5,
    aliases: ["addten", "setnguoi", "start", "check", "stop", "checkdagui", "checknguoidagui", "checksosanh", "cleardagui", "clearsosanh", "send", "sendoff"]
};

// Helper to find history files for a thread
function findHistoryFiles(threadId) {
    const historyDir = path.join(__dirname, "../../data/history_data");
    if (!fs.existsSync(historyDir)) return [];

    const files = fs.readdirSync(historyDir);
    // Find all files ending with _threadId.txt
    return files.filter(f => f.endsWith(`_${threadId}.txt`)).map(f => path.join(historyDir, f));
}

module.exports.run = async function ({ api, event, args, Threads }) {
    const { threadId, type } = event;
    const senderID = event.senderID || event.data?.uidFrom;
    const body = event.body || event.data?.content || "";

    let data = loadData(threadId);

    // Helper to get group name
    const getGroupName = async () => {
        try {
            const groupInfo = await api.getGroupInfo(threadId);
            return groupInfo.gridInfoMap?.[threadId]?.name || "Nhóm chưa đặt tên";
        } catch (e) {
            return "Không thể lấy tên nhóm";
        }
    };

    // Helper to check admin
    const isAdmin = () => {
        const admins = global.config.admin_bot || [];
        return admins.includes(senderID);
    };

    // /send <uid> (Admin only)
    if (body.startsWith("/send") && !body.startsWith("/sendoff") && !body.startsWith("/sendall")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }

        const targetUID = args[0];
        if (!targetUID) {
            return api.sendMessage({ msg: "⚠️ Vui lòng nhập UID người nhận. Ví dụ: /send 123456789", ttl: 300000 }, threadId, type);
        }

        data.autoSendTarget = targetUID;
        saveData(threadId, data);

        return api.sendMessage({ msg: `✅ Đã thiết lập tự động gửi ảnh tới UID: ${targetUID}`, ttl: 300000 }, threadId, type);
    }

    // /sendoff (Admin only)
    if (body.startsWith("/sendoff")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }

        data.autoSendTarget = null;
        saveData(threadId, data);

        return api.sendMessage({ msg: "✅ Đã tắt chế độ tự động gửi ảnh.", ttl: 300000 }, threadId, type);
    }

    // /addten
    if (body.startsWith("/addten")) {
        try {
            if (!senderID) {
                return api.sendMessage({ msg: "⚠️ Không tìm thấy ID người dùng.", ttl: 300000 }, threadId, type);
            }

            let name = "Người dùng";
            try {
                const info = await api.getUserInfo(senderID);
                if (info && info.changed_profiles && info.changed_profiles[senderID]) {
                    name = info.changed_profiles[senderID].displayName || name;
                } else if (info && info[senderID]) {
                    name = info[senderID].name || info[senderID].displayName || name;
                }
            } catch (err) {
                console.error("Error getting user info:", err);
            }

            const exists = data.sosanh.some(u => u.uid === senderID);
            if (exists) {
                return api.sendMessage({ msg: `⚠️ Bạn (${name}) đã có trong danh sách so sánh rồi!`, ttl: 300000 }, threadId, type);
            }

            data.sosanh.push({ uid: senderID, name: name });
            saveData(threadId, data);

            const groupName = await getGroupName();
            return api.sendMessage({ msg: `✅ Đã thêm ${name} vào danh sách so sánh.\n📂 Tên nhóm: ${groupName}\n🆔 ID nhóm: ${threadId}`, ttl: 300000 }, threadId, type);
        } catch (e) {
            console.error(e);
            return api.sendMessage({ msg: "⚠️ Đã xảy ra lỗi khi thêm tên.", ttl: 300000 }, threadId, type);
        }
    }

    // /setnguoi <number> (Admin only)
    if (body.startsWith("/setnguoi")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        const target = parseInt(args[0]);
        if (isNaN(target) || target <= 0) {
            return api.sendMessage({ msg: "⚠️ Vui lòng nhập số lượng người hợp lệ. Ví dụ: /setnguoi 10", ttl: 300000 }, threadId, type);
        }
        data.target = target;
        data.dagui = []; // Reset current session
        saveData(threadId, data);

        const groupName = await getGroupName();
        return api.sendMessage({ msg: `✅ Đã thiết lập giới hạn là: ${target} người.\nDanh sách đã gửi đã được reset.\n📂 Tên nhóm: ${groupName}\n🆔 ID nhóm: ${threadId}`, ttl: 300000 }, threadId, type);
    }

    // /start (Admin only)
    if (body.startsWith("/start")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        if (data.isRunning) {
            return api.sendMessage({ msg: "⚠️ Phiên điểm danh đang chạy rồi!", ttl: 300000 }, threadId, type);
        }
        data.isRunning = true;
        data.dagui = [];
        data.firstSenderRecorded = false; // Reset flag for new session
        saveData(threadId, data);

        // Enable history recording in Threads database
        try {
            const threadData = (await Threads.getData(threadId)).data || {};
            threadData.record_history = true;
            await Threads.setData(threadId, threadData);
        } catch (e) {
            console.error('[tracking] Error enabling record_history:', e);
        }

        let msg = "🚀 Bắt đầu phiên điểm danh! Mọi người hãy gửi ảnh nhé.";
        if (data.autoSendTarget) {
            msg += `\n📸 Ảnh sẽ được tự động gửi tới UID: ${data.autoSendTarget}`;
        }

        return api.sendMessage({ msg: msg, ttl: 300000 }, threadId, type);
    }

    // /stop (Admin only)
    if (body.startsWith("/stop")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        if (!data.isRunning) {
            return api.sendMessage({ msg: "⚠️ Hiện không có phiên điểm danh nào đang chạy.", ttl: 300000 }, threadId, type);
        }

        const count = data.dagui.length;
        data.isRunning = false;
        data.dagui = [];
        // data.autoSendTarget = null; // Optional: clear target on stop? User didn't specify. Keeping it might be useful.
        saveData(threadId, data);

        // Disable history recording in Threads database
        try {
            const threadData = (await Threads.getData(threadId)).data || {};
            threadData.record_history = false;
            await Threads.setData(threadId, threadData);
        } catch (e) {
            console.error('[tracking] Error disabling record_history:', e);
        }

        return api.sendMessage({ msg: `🛑 Đã kết thúc phiên điểm danh. Tổng cộng có ${count} người đã gửi.`, ttl: 300000 }, threadId, type);
    }

    // /clear history (Admin only)
    if (body.startsWith("/clear history")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        const historyFiles = findHistoryFiles(threadId);
        try {
            if (historyFiles.length > 0) {
                historyFiles.forEach(file => {
                    if (fs.existsSync(file)) fs.unlinkSync(file);
                });
                return api.sendMessage({ msg: "✅ Đã xóa hoàn toàn các file lịch sử ghi nhận (history). File mới sẽ được tạo khi có ảnh mới.", ttl: 300000 }, threadId, type);
            } else {
                return api.sendMessage({ msg: "⚠️ Chưa có dữ liệu lịch sử để xóa.", ttl: 300000 }, threadId, type);
            }
        } catch (e) {
            console.error(e);
            return api.sendMessage({ msg: "⚠️ Lỗi khi xóa lịch sử.", ttl: 300000 }, threadId, type);
        }
    }

    // /check history <hours> (All users)
    if (body.startsWith("/check history")) {
        const hours = parseInt(args[1]);
        if (isNaN(hours) || hours <= 0) {
            return api.sendMessage({ msg: "⚠️ Vui lòng nhập số giờ hợp lệ. Ví dụ: /check history 24", ttl: 300000 }, threadId, type);
        }

        const historyFiles = findHistoryFiles(threadId);
        if (historyFiles.length === 0) {
            return api.sendMessage({ msg: "⚠️ Chưa có dữ liệu lịch sử.", ttl: 300000 }, threadId, type);
        }

        try {
            const now = Date.now();
            const startTime = now - (hours * 3600 * 1000);
            const sentMap = {}; // uid -> { count, name }

            for (const historyPath of historyFiles) {
                if (!fs.existsSync(historyPath)) continue;
                const fileContent = fs.readFileSync(historyPath, "utf8");
                const lines = fileContent.split("\n").filter(line => line.trim() !== "");

                lines.forEach(line => {
                    // Try new format: timeString | name | uid | count | timestamp
                    if (line.includes(" | ")) {
                        const parts = line.split(" | ");
                        if (parts.length >= 5) {
                            const name = parts[1];
                            const uid = parts[2];
                            const count = parseInt(parts[3]);
                            const timestamp = parseInt(parts[4]);

                            if (timestamp >= startTime) {
                                if (!sentMap[uid]) sentMap[uid] = { count: 0, name: name };
                                sentMap[uid].count += count;
                                if (name && name !== "Người dùng") sentMap[uid].name = name;
                            }
                        }
                    }
                    // Try old format: timestamp:uid:count:name:timeString
                    else if (line.includes(":")) {
                        const parts = line.split(":");
                        if (parts.length >= 3) {
                            const timestamp = parseInt(parts[0]);
                            const uid = parts[1];
                            const count = parseInt(parts[2]);
                            let name = null;
                            if (parts.length >= 4) name = parts[3];

                            if (timestamp >= startTime) {
                                if (!sentMap[uid]) sentMap[uid] = { count: 0, name: name || "Người dùng" };
                                sentMap[uid].count += count;
                                if (name && name !== "Người dùng") sentMap[uid].name = name;
                            }
                        }
                    }
                });
            }

            const sentUIDs = Object.keys(sentMap);

            if (sentUIDs.length === 0) {
                return api.sendMessage({ msg: `📭 Trong ${hours} giờ qua, chưa có ai gửi ảnh.`, ttl: 300000 }, threadId, type);
            }

            let msgReport = `📊 TỔNG HỢP LỊCH SỬ (${hours} GIỜ QUA)\n`;
            msgReport += `Tổng số người gửi: ${sentUIDs.length}\n\n`;
            msgReport += `Danh sách chi tiết:\n`;

            // Get names for report
            const userPromises = sentUIDs.map(async (uid) => {
                let name = sentMap[uid].name || "Người dùng";

                if (!name || name === "Người dùng") {
                    const userInSosanh = data.sosanh.find(u => u.uid === uid);
                    if (userInSosanh) {
                        name = userInSosanh.name;
                    } else {
                        try {
                            const info = await api.getUserInfo(uid);
                            if (info && info.changed_profiles && info.changed_profiles[uid]) {
                                name = info.changed_profiles[uid].displayName || name;
                            } else if (info && info[uid]) {
                                name = info[uid].name || info[uid].displayName || name;
                            }
                        } catch (e) { }
                    }
                }
                return { name, count: sentMap[uid].count };
            });

            const users = await Promise.all(userPromises);
            users.sort((a, b) => b.count - a.count); // Sort by count desc

            users.forEach((u, i) => {
                msgReport += `${i + 1}. ${u.name} (${u.count} ảnh)\n`;
            });

            return api.sendMessage({ msg: msgReport, ttl: 300000 }, threadId, type);

        } catch (e) {
            console.error(e);
            return api.sendMessage({ msg: "⚠️ Lỗi khi đọc dữ liệu lịch sử.", ttl: 300000 }, threadId, type);
        }
    }

    // /check
    if (body.startsWith("/check") && !body.startsWith("/checkdagui") && !body.startsWith("/checksosanh") && !body.startsWith("/cleardagui") && !body.startsWith("/clearsosanh")) {

        // Handle /check 2 <hours>
        if (args[0] === "2") {
            const hours = parseInt(args[1]);
            if (isNaN(hours) || hours <= 0) {
                return api.sendMessage({ msg: "⚠️ Vui lòng nhập số giờ hợp lệ. Ví dụ: /check 2 24", ttl: 300000 }, threadId, type);
            }

            const historyFiles = findHistoryFiles(threadId);
            if (historyFiles.length === 0) {
                return api.sendMessage({ msg: "⚠️ Chưa có dữ liệu lịch sử.", ttl: 300000 }, threadId, type);
            }

            try {
                const now = Date.now();
                const startTime = now - (hours * 3600 * 1000);
                const sentMap = {}; // uid -> count

                for (const historyPath of historyFiles) {
                    if (!fs.existsSync(historyPath)) continue;
                    const fileContent = fs.readFileSync(historyPath, "utf8");
                    const lines = fileContent.split("\n").filter(line => line.trim() !== "");

                    lines.forEach(line => {
                        // Support both formats for check 2 as well
                        let timestamp, uid, count;

                        if (line.includes(" | ")) {
                            const parts = line.split(" | ");
                            if (parts.length >= 5) {
                                uid = parts[2];
                                count = parseInt(parts[3]);
                                timestamp = parseInt(parts[4]);
                            }
                        } else if (line.includes(":")) {
                            const parts = line.split(":");
                            if (parts.length >= 3) {
                                timestamp = parseInt(parts[0]);
                                uid = parts[1];
                                count = parseInt(parts[2]);
                            }
                        }

                        if (timestamp && uid && count) {
                            if (timestamp >= startTime) {
                                if (!sentMap[uid]) sentMap[uid] = 0;
                                sentMap[uid] += count;
                            }
                        }
                    });
                }

                const sentUIDs = Object.keys(sentMap);
                const sosanh = data.sosanh || [];

                // Identify who sent and who didn't (based on sosanh list)
                const notSentList = sosanh.filter(u => !sentUIDs.includes(u.uid));

                let msgReport = `Trong số (${hours} giờ) có những thông tin sau:\n`;
                msgReport += `1: Tổng số người gửi (số người gửi là): ${sentUIDs.length}\n`;
                msgReport += `2: Số người chưa gửi là: ${notSentList.length} (Tổng chưa gửi)\n`;

                if (notSentList.length > 0) {
                    msgReport += `\nDanh sách chưa gửi:\n`;
                    const mentions = [];
                    notSentList.forEach((u, i) => {
                        msgReport += `${i + 1}. @${u.name}\n`;
                        mentions.push({
                            tag: `@${u.name}`,
                            id: u.uid,
                            fromIndex: msgReport.lastIndexOf(`@${u.name}`)
                        });
                    });
                    return api.sendMessage({ msg: msgReport, mentions: mentions }, threadId, type);
                } else {
                    msgReport += `\n🎉 Tất cả mọi người trong danh sách so sánh đã gửi ảnh!`;
                    return api.sendMessage({ msg: msgReport }, threadId, type);
                }

            } catch (e) {
                console.error(e);
                return api.sendMessage({ msg: "⚠️ Lỗi khi đọc dữ liệu lịch sử.", ttl: 300000 }, threadId, type);
            }
        }

        // Existing /check (default) logic
        const target = data.target || 0;
        const dagui = data.dagui || [];
        const isRunning = data.isRunning || false;

        // Build status message
        let statusMsg = "📊 TRẠNG THÁI TRACKING\n\n";
        statusMsg += `🔹 Trạng thái: ${isRunning ? "🟢 ĐANG CHẠY" : "🔴 TẮT"}\n`;
        statusMsg += `🔹 Mục tiêu: ${target > 0 ? target + " người" : "Chưa đặt"}\n`;
        statusMsg += `🔹 Đã gửi: ${dagui.length} người\n`;

        if (isRunning && target > 0) {
            const percent = Math.round((dagui.length / target) * 100);
            statusMsg += `🔹 Tiến độ: ${percent}%\n`;
        }

        if (data.autoSendTarget) {
            statusMsg += `🔹 Auto Send: ${data.autoSendTarget}\n`;
        }

        statusMsg += `\n`;

        if (!isRunning) {
            statusMsg += "⏸️ Phiên tracking chưa bắt đầu.\n";
            statusMsg += "💡 Admin dùng /start để bắt đầu.";
            return api.sendMessage({ msg: statusMsg, ttl: 300000 }, threadId, type);
        }

        if (dagui.length === 0) {
            statusMsg += "📭 Chưa có ai gửi ảnh trong phiên này.";
            return api.sendMessage({ msg: statusMsg, ttl: 300000 }, threadId, type);
        }

        // Removed list display from /check
        statusMsg += "\n💡 Dùng /checkdagui để xem danh sách người đã gửi.";
        statusMsg += "\n💡 Dùng /checksosanh để xem danh sách người cần gửi.";

        return api.sendMessage({ msg: statusMsg, ttl: 300000 }, threadId, type);
    }

    // /checkdagui or /checknguoidagui
    if (body.startsWith("/checkdagui") || body.startsWith("/checknguoidagui")) {
        let data = loadData(threadId);
        const dagui = data.dagui || [];
        const sosanh = data.sosanh || [];

        if (dagui.length === 0) {
            return api.sendMessage({ msg: "📭 Chưa có ai gửi ảnh.", ttl: 300000 }, threadId, type);
        }

        let msg = "📝 DANH SÁCH ĐÃ GỬI:\n";
        dagui.forEach((uid, i) => {
            const userInSosanh = sosanh.find(u => u.uid === uid);
            const name = userInSosanh ? userInSosanh.name : "Người dùng";
            msg += `${i + 1}. ${name}\n`;
        });

        return api.sendMessage({ msg: msg, ttl: 300000 }, threadId, type);
    }

    // /checksosanh
    if (body.startsWith("/checksosanh")) {
        let data = loadData(threadId);
        const sosanh = data.sosanh || [];

        if (sosanh.length === 0) {
            return api.sendMessage({ msg: "📭 Danh sách so sánh đang trống.", ttl: 300000 }, threadId, type);
        }

        let msg = "📋 DANH SÁCH CẦN GỬI (SO SÁNH):\n";
        sosanh.forEach((u, i) => {
            msg += `${i + 1}. ${u.name}\n`;
        });

        return api.sendMessage({ msg: msg, ttl: 300000 }, threadId, type);
    }

    // /cleardagui (Admin only)
    if (body.startsWith("/cleardagui")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        data.dagui = [];
        saveData(threadId, data);
        return api.sendMessage({ msg: "✅ Đã xóa toàn bộ danh sách đã gửi (dagui).", ttl: 300000 }, threadId, type);
    }

    // /clearsosanh (Admin only)
    if (body.startsWith("/clearsosanh")) {
        if (!isAdmin()) {
            return api.sendMessage({ msg: "⚠️ Bạn không có quyền sử dụng lệnh này.", ttl: 300000 }, threadId, type);
        }
        data.sosanh = [];
        saveData(threadId, data);
        return api.sendMessage({ msg: "✅ Đã xóa toàn bộ danh sách so sánh (sosanh).", ttl: 300000 }, threadId, type);
    }
};

module.exports.handleEvent = async function ({ api, event, Threads }) {
    const { threadId, type } = event;
    const senderID = event.senderID || event.data?.uidFrom;

    // Check if message has images
    const msgType = event.data?.msgType;
    const hasImage = (event.attachments && event.attachments.some(att =>
        att.type === "photo" || att.type === "image" || (att.url && att.url.includes(".jpg")) || (att.url && att.url.includes(".png"))
    )) || (msgType === "chat.photo");

    if (!hasImage) return;

    // Load data for this specific thread
    let data = loadData(threadId);

    // Check if session is running
    if (!data.isRunning) return;

    // Get user name first
    let name = "Bạn";
    try {
        const info = await api.getUserInfo(senderID);
        if (info && info.changed_profiles && info.changed_profiles[senderID]) {
            name = info.changed_profiles[senderID].displayName || name;
        } else if (info && info[senderID]) {
            name = info[senderID].name || info[senderID].displayName || name;
        }
    } catch (e) {
        // Ignore error
    }

    // AUTO SEND LOGIC
    if (data.autoSendTarget) {
        try {
            const imageUrls = [];

            // 1. Check attachments
            if (event.attachments && event.attachments.length > 0) {
                event.attachments.forEach(att => {
                    if (att.type === "photo" || att.type === "image" || (att.url && (att.url.includes(".jpg") || att.url.includes(".png")))) {
                        imageUrls.push(att.url);
                    }
                });
            }

            // 2. Check chat.photo specific fields
            if (msgType === "chat.photo") {
                if (event.url) imageUrls.push(event.url);
                if (event.data && event.data.url) imageUrls.push(event.data.url);
                if (event.data && event.data.content && event.data.content.href) imageUrls.push(event.data.content.href);
            }

            // Remove duplicates
            const uniqueUrls = [...new Set(imageUrls)];

            for (const imageUrl of uniqueUrls) {
                const timestamp = Date.now();
                // Sanitize name for filename
                const safeName = name.replace(/[^a-zA-Z0-9_\-\s\u00C0-\u1EF9]/g, '_');
                const fileName = `${safeName}_${senderID}_${timestamp}.jpg`;
                const filePath = path.join(autoSendDir, fileName);

                // Download image
                const response = await axios({
                    url: imageUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                // Send to target UID
                await api.sendMessage({
                    msg: `📸 Ảnh từ: ${name}\nUID: ${senderID}\nThời gian: ${new Date(timestamp).toLocaleString("vi-VN")}`,
                    attachment: fs.createReadStream(filePath)
                }, data.autoSendTarget);

                // Delete file
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error("[tracking] Error in auto send:", e);
        }
    }

    // Check if user already submitted
    if (data.dagui.includes(senderID)) {
        // User already submitted, send warning with mention
        const msg = `⚠️ @${name} đã gửi ảnh rồi!`;
        return api.sendMessage({
            msg: msg,
            mentions: [{ pos: 4, uid: senderID, len: name.length + 1 }],
            ttl: 300000
        }, threadId, type);
    }

    // Record first sender if not yet recorded this session
    if (!data.firstSenderRecorded) {
        // Find existing rank entry for this user
        const existingRank = data.ranks.find(r => r.uid === senderID);

        if (existingRank) {
            // Increment count
            existingRank.count++;
            existingRank.name = name; // Update name in case it changed
        } else {
            // Add new rank entry
            data.ranks.push({ name: name, uid: senderID, count: 1 });
        }

        data.firstSenderRecorded = true;
    }

    // Add to dagui (first time submission)
    data.dagui.push(senderID);
    saveData(threadId, data);

    // Check if target reached
    const currentCount = data.dagui.length;
    const target = data.target;

    if (target > 0 && currentCount >= target) {
        // Use @All mention for completion message
        const completeMsg = `🎉 @All ĐÃ XONG! Đã đủ ${target} người gửi ảnh!\n📊 Tổng quan:\n- Tổng cần: ${target}\n- Đã gửi: ${currentCount}\n\n✅ Phiên điểm danh đã kết thúc!\n⏸️ Sử dụng /start để bắt đầu phiên mới.`;
        api.sendMessage({
            msg: completeMsg,
            mentions: [{ pos: 4, uid: "0", len: 4 }],
            ttl: 300000
        }, threadId, type);

        // Auto-stop the session and clear dagui
        data.isRunning = false;
        data.dagui = [];
        // data.autoSendTarget = null; // Keep it? Or clear? Usually auto-stop clears session data but config might persist.
        saveData(threadId, data);

        // Disable history recording in Threads database
        try {
            const threadData = (await Threads.getData(threadId)).data || {};
            threadData.record_history = false;
            await Threads.setData(threadId, threadData);
        } catch (e) {
            console.error('[tracking] Error disabling record_history:', e);
        }
    }
};
