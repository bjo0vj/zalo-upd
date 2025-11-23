const logger = require("../../utils/logger");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

const { ThreadType } = require("zca-js");

async function handleCommand(messageText, event = null, api = null, threadInfo = null, prefix = null) {
  const config = global.config;

  if (!messageText || typeof messageText !== "string") return;

  const threadId = event?.threadId;
  const type = event?.type;
  const UIDUsage = event?.data?.uidFrom;

  // Check bot suspension state
  if (global.botState && global.botState.suspended) {
    // Only allow resume command when suspended
    if (!messageText.includes("/admin.Api.log<resume>")) {
      return; // Silently ignore all other commands
    }
  }

  // Check if user is banned
  try {
    const bannedUsers = require("../../modules/banned_users.json");
    if (bannedUsers.some(u => u.uid === UIDUsage)) {
      return; // Silently ignore banned users
    }
  } catch (e) {
    // Ignore error if file doesn't exist or is invalid
  }

  if (type == ThreadType.User && config.allow_private_command === false) {
    return;
  }

  const args = messageText.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  let command = global.client.commands.get(commandName);
  if (!command) {
    for (const [, cmd] of global.client.commands) {
      if (Array.isArray(cmd.config.aliases) && cmd.config.aliases.includes(commandName)) {
        command = cmd;
        break;
      }
    }
  }

  if (!command) {
    if (api && threadId && type) {
      api.sendMessage({
        msg: "⚠️ Lệnh không tồn tại!",
        ttl: 20000  // Tự xóa sau 20 giây
      }, threadId, type);
    }
    return;
  }

  const role = command.config.role || 0;
  const isBotAdmin = global.users?.admin?.includes(UIDUsage);
  const isSupport = global.users?.support?.includes(UIDUsage);

  let isGroupAdmin = false;

  if (type == 1) {
    if (threadInfo.box_only) {
      try {
        const info = await api.getGroupInfo(threadId);
        const groupInfo = info.gridInfoMap[threadId];

        const isCreator = groupInfo.creatorId == UIDUsage;
        const isDeputy = Array.isArray(groupInfo.adminIds) && groupInfo.adminIds.includes(UIDUsage);

        isGroupAdmin = isCreator || isDeputy;
      } catch (err) {
        logger.log("⚠️ Không thể lấy thông tin nhóm từ API: " + err.message, "warn");
      }
    }

    if (threadInfo.admin_only && !isBotAdmin) {
      return api.sendMessage({
        msg: "❌ Nhóm đã bật chế độ chỉ admin bot đùng được lệnh.",
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
    }

    if (threadInfo.support_only && !isSupport && !isBotAdmin) {
      return api.sendMessage({
        msg: "❌ Nhóm đã bật chế độ chỉ support bot hoặc admin bot đùng được lệnh.",
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
    }

    if (threadInfo.box_only && !isGroupAdmin && !isBotAdmin) {
      return api.sendMessage({
        msg: "❌ Nhóm đã bật chế độ chỉ trưởng nhóm hoặc phó nhóm đùng được lệnh.",
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
    }
  }

  if ((role === 2 && !isBotAdmin) || (role === 1 && !isBotAdmin && !isSupport)) {
    return api.sendMessage({
      msg: "🚫 Bạn không có quyền sử dụng lệnh này.",
      ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
  }

  const cdTime = (command.config.cooldowns || 0) * 1000;

  if (!global.client.cooldowns.has(commandName)) {
    global.client.cooldowns.set(commandName, new Map());
  }

  const cdMap = global.client.cooldowns.get(commandName);
  const lastUsed = cdMap.get(UIDUsage);

  if (lastUsed && Date.now() - lastUsed < cdTime) {
    const timeLeft = ((cdTime - (Date.now() - lastUsed)) / 1000).toFixed(1);
    return api.sendMessage({
      msg: `⏳ Vui lòng chờ ${timeLeft}s để dùng lại lệnh '${commandName}'`,
      ttl: 15000  // Tự xóa sau 15 giây (cooldown message)
    }, threadId, type);
  }

  cdMap.set(UIDUsage, Date.now());

  try {
    const replyData = { content: event.data.content, msgType: event.data.msgType, propertyExt: event.data.propertyExt, uidFrom: event.data.uidFrom, msgId: event.data.msgId, cliMsgId: event.data.cliMsgId, ts: event.data.ts, ttl: event.data.ttl }
    command.run({ args, event, api, Users, Threads, replyData });
  } catch (err) {
    logger.log("❌ Lỗi khi xử lý lệnh: " + err.message, "error");
    return api.sendMessage({
      msg: "❌ Đã xảy ra lỗi khi xử lý lệnh!",
      ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
  }
}


module.exports = handleCommand;
