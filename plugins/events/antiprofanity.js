const fs = require("fs");
const path = require("path");

const badwordsPath = path.join(__dirname, "../../assets/badwords.txt");
const mutedUsersPath = path.join(__dirname, "../../data/muted_users.json");

// Load badwords
let badwords = [];
try {
    const content = fs.readFileSync(badwordsPath, "utf8");
    badwords = content.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
} catch (e) {
    console.error("Error loading badwords:", e);
}

// Load muted users
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

// Check if user is muted
function isMuted(userId) {
    const mutedUsers = loadMutedUsers();
    if (mutedUsers[userId]) {
        const now = Date.now();
        if (now < mutedUsers[userId]) {
            return true;
        } else {
            // Unmute expired
            delete mutedUsers[userId];
            saveMutedUsers(mutedUsers);
            return false;
        }
    }
    return false;
}

// Mute user
function muteUser(userId, minutes) {
    const mutedUsers = loadMutedUsers();
    const muteUntil = Date.now() + (minutes * 60 * 1000);
    mutedUsers[userId] = muteUntil;
    saveMutedUsers(mutedUsers);
    return muteUntil;
}

// Check if message contains badwords
function containsBadword(message) {
    const normalized = message.toLowerCase()
        .replace(/[.,!?;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const word of badwords) {
        if (normalized.includes(word)) {
            return word;
        }
    }
    return null;
}

module.exports.config = {
    name: "antiprofanity",
    event_type: ["message"],
    version: "1.0.0",
    author: "TDF-2803",
    description: "Tự động mute người chửi bậy"
};

module.exports.handleEvent = async function ({ api, event }) {
    const { threadId, type } = event;
    const senderID = event.senderID || event.data?.uidFrom;
    const message = event.body || event.data?.content || "";

    if (!message || !senderID) return;

    // Check if user is muted
    if (isMuted(senderID)) {
        const mutedUsers = loadMutedUsers();
        const muteUntil = mutedUsers[senderID];
        const remainingMs = muteUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);

        try {
            // Get user name
            let name = "Bạn";
            try {
                const info = await api.getUserInfo(senderID);
                if (info && info[senderID]) {
                    name = info[senderID].name || info[senderID].displayName || "Bạn";
                }
            } catch (e) {
                // Ignore
            }

            const msg = `🔇 @${name} đang bị cấm chat!\n⏱️ Còn lại: ${remainingMin} phút`;
            await api.sendMessage({
                msg: msg,
                mentions: [{ pos: 4, uid: senderID, len: name.length + 1 }],
                ttl: 30000
            }, threadId, type);
        } catch (e) {
            console.error("Error sending mute warning:", e);
        }
        return;
    }

    // Check for badwords
    const badword = containsBadword(message);
    if (badword) {
        // Mute for 3 minutes
        muteUser(senderID, 3);

        try {
            // Get user name
            let name = "Bạn";
            try {
                const info = await api.getUserInfo(senderID);
                if (info && info[senderID]) {
                    name = info[senderID].name || info[senderID].displayName || "Bạn";
                }
            } catch (e) {
                // Ignore
            }

            const msg = `⚠️ @${name} đã bị cấm chat 3 phút vì chửi bậy!\n🚫 Từ vi phạm: "${badword}"`;
            await api.sendMessage({
                msg: msg,
                mentions: [{ pos: 4, uid: senderID, len: name.length + 1 }],
                ttl: 60000
            }, threadId, type);
        } catch (e) {
            console.error("Error sending profanity warning:", e);
        }
    }
};

module.exports.run = async function () {
    // This event doesn't need a run function
};
