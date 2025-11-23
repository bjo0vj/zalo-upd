const logger = require("../../utils/logger");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

function handleEvent(eventType, eventData, api) {
  // Safety check: ensure eventData and eventData.data exist
  if (!eventData || !eventData.data) {
    logger.log(`Event data is missing for event type ${eventType}`, "warn");
    return;
  }

  for (const [name, eventModule] of global.client.events) {
    const targetEvents = eventModule.config.event_type;
    if (Array.isArray(targetEvents) && targetEvents.includes(eventType)) {
      try {
        if (typeof eventModule.run === "function") {
          // Safely construct replyData with null-safe access
          const data = eventData.data || {};
          const replyData = {
            content: data.content || null,
            msgType: data.msgType || null,
            propertyExt: data.propertyExt || null,
            uidFrom: data.uidFrom || null,
            msgId: data.msgId || null,
            cliMsgId: data.cliMsgId || null,
            ts: data.ts || null,
            ttl: data.ttl || null
          };
          eventModule.run({ api, event: eventData, eventType, Users, Threads, replyData });
        }
      } catch (err) {
        logger.log(`Lỗi khi xử lý event ${eventType} tại module ${name}: ${err.message}`, "error");
      }
    }
  }

  for (const [name, commandModule] of global.client.commands) {
    if (typeof commandModule.handleEvent === "function") {
      try {
        // Safely construct replyData with null-safe access
        const data = eventData.data || {};
        const replyData = {
          content: data.content || null,
          msgType: data.msgType || null,
          propertyExt: data.propertyExt || null,
          uidFrom: data.uidFrom || null,
          msgId: data.msgId || null,
          cliMsgId: data.cliMsgId || null,
          ts: data.ts || null,
          ttl: data.ttl || null
        };
        commandModule.handleEvent({ api, event: eventData, eventType, Users, Threads, replyData });
      } catch (err) {
        logger.log(`Lỗi khi xử lý handleEvent trong command ${name}: ${err.message}`, "error");
      }
    }
  }
}

module.exports = handleEvent;