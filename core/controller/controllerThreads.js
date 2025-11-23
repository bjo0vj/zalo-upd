const { getData, saveData, db } = require('../../utils/db');
const logger = require('../../utils/logger');

module.exports = {
  getAll: () => {
    const rows = db.prepare('SELECT * FROM Threads').all();
    return rows.map(row => ({
      threadId: row.threadId,
      data: JSON.parse(row.data || '{}')
    }));
  },

  getData: async (threadId) => {
    const existing = db.prepare('SELECT 1 FROM Threads WHERE threadId = ?').get(threadId);
    if (!existing) {
      module.exports.createData(threadId, { ban: false, admin_only: false, support_only: false, box_only: false, prefix: global.config.prefix });
      logger.log("Đã tạo database cho nhóm: " + threadId, "info");
    }
    return getData('Threads', 'threadId', threadId);
  },

  setData: (threadId, data) => {
    saveData('Threads', 'threadId', threadId, data);
  },

  delData: (threadId) => {
    const exists = db.prepare('SELECT 1 FROM Threads WHERE threadId = ?').get(threadId);
    if (exists) {
      db.prepare('DELETE FROM Threads WHERE threadId = ?').run(threadId);
    }
  },


  createData: (threadId, defaultData = {}) => {
    const existing = db.prepare('SELECT 1 FROM Threads WHERE threadId = ?').get(threadId);
    if (!existing) {
      saveData('Threads', 'threadId', threadId, defaultData);
    }
  }
};
