const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const logger = require("../../utils/logger");

const Users = require("../controller/controllerUsers");
const Threads = require("../controller/controllerThreads");

function extractDependencies(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/dependencies\s*:\s*{([^}]*)}/);
    if (!match) return {};

    const depString = `{${match[1]}}`;
    return eval(`(${depString})`);
  } catch (err) {
    logger.log(`Lỗi khi đọc dependencies từ ${filePath}: ${err.message}`, "error");
    return {};
  }
}

function loadEvents(dir = path.join(__dirname, "../..", "plugins", "events")) {
  const files = fs.readdirSync(dir).filter(file => file.endsWith(".js"));
  let shouldRestart = false;

  for (const file of files) {
    const filePath = path.join(dir, file);

    const dependencies = extractDependencies(filePath);

    for (const [pkgName, version] of Object.entries(dependencies)) {
      try {
        require.resolve(pkgName);
      } catch {
        logger.log(`Cài đặt package: ${pkgName}@${version || "latest"}`, "info");
        try {
          execSync(`npm install ${pkgName}@${version || "latest"}`, {
            stdio: "inherit",
            cwd: path.join(__dirname, "../../")
          });
          logger.log(`Đã cài xong ${pkgName}`, "info");
          shouldRestart = true;
        } catch (err) {
          logger.log(`Lỗi khi cài ${pkgName}: ${err.message}`, "error");
        }
      }
    }

    if (shouldRestart) continue;

    let event;
    try {
      event = require(filePath);
    } catch (err) {
      logger.log(`Không thể require file ${file}: ${err.message}`, "error");
      continue;
    }

    if (
      !event.config ||
      !Array.isArray(event.config.event_type) ||
      typeof event.run !== "function"
    ) {
      logger.log(`Event ${file} không hợp lệ`, "warn");
      continue;
    }

    const eventName = event.config.name?.toLowerCase() || file.replace(/\.js$/, "");
    global.client.events.set(eventName, event);

    if (typeof event.onLoad === "function") {
      try {
        event.onLoad({ api: global.api, Users, Threads });
      } catch (e) {
        logger.log(`Lỗi trong onLoad của event ${eventName}: ${e.message}`, "error");
      }
    }
  }

  logger.log(`Đã tải ${global.client.events.size} event module`, "info");

  if (shouldRestart) {
    logger.log("Đã cài thêm package mới, đang khởi động lại bot...", "warn");
    process.exit(1);
  }
}

module.exports = loadEvents;
