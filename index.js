const { spawn } = require("child_process");
const logger = require("./utils/logger");
const semver = require("semver");

(async () => {
    await logger.printBanner();

    const nodeVersion = semver.parse(process.version);
    if (nodeVersion.major < 20) {
        logger.log(`Phiên bản Node.js ${process.version} không hỗ trợ. Vui lòng sử dụng Node.js 20 trở lên.`, "error");
        return process.exit(1);
    }


    function startProject() {
        const child = spawn("node", ["Zeid.js"], {
            cwd: __dirname,
            stdio: "inherit"
        });

        child.on("close", (code) => {
            if (code === 2) {
                logger.log(`Khởi động lại...`, "warn");
                startProject();
            }
        });
    }

    startProject();
})();
