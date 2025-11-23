const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const logger = require("./logger");

const dbPath = path.join(__dirname, '..', 'data', 'sqlite.db');

  const createThreadsTable = `
    CREATE TABLE IF NOT EXISTS Threads (
      threadId TEXT PRIMARY KEY,
      data TEXT
    );
  `;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS Users (
      userId TEXT PRIMARY KEY,
      data TEXT
    );
  `;

  const createCurrenciesTable = `
    CREATE TABLE IF NOT EXISTS Currencies (
      userId TEXT PRIMARY KEY,
      data TEXT
    );
  `;

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(dbPath);

  db.exec(createThreadsTable);
  db.exec(createUsersTable);
  db.exec(createCurrenciesTable);
  logger.log("Đã tải thành công database sqlite", "info");

function getData(table, idField, id) {
  let row = db.prepare(`SELECT * FROM ${table} WHERE ${idField} = ?`).get(id);
  return {
    ...row,
    data: row.data ? JSON.parse(row.data) : {}
  };
}

function saveData(table, idField, id, dataObj, extra = {}) {
  const json = JSON.stringify(dataObj);
  const fields = Object.keys(extra).concat(["data"]);
  const values = Object.values(extra).concat([json]);
  const placeholders = fields.map(() => '?').join(', ');

  const updateSet = fields.map(f => `${f} = ?`).join(', ');

  db.prepare(
    `INSERT INTO ${table} (${idField}, ${fields.join(', ')}) VALUES (?, ${placeholders})
     ON CONFLICT(${idField}) DO UPDATE SET ${updateSet}`
  ).run(id, ...values, ...values);
}

module.exports = {
  getData,
  saveData,
  db
};
