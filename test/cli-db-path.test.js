/**
 * Regression test for the `--db` / `--database` flags being silently ignored.
 *
 * The CLI wrapper parsed the flag and then assigned process.env.SQLITE_DB_PATH,
 * but index.ts captured that variable in a module-level const. ESM imports are
 * evaluated before the CLI body runs, so DEFAULT_DB_PATH was frozen to
 * "./database.db" and the server opened an empty ./database.db instead of the
 * requested file -- with no error and an empty schema.
 *
 * better-sqlite3 is stubbed: it is a native addon built against V8 internals,
 * and the behaviour under test is purely "which path reached the Database
 * constructor", so the stub records the path instead of opening a file. The
 * suite then runs on any Node without a native build.
 */

import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { after, before, beforeEach, describe, it } from "node:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(repoRoot, "dist")

/** Minimal better-sqlite3 stand-in that records the path it was constructed with. */
function writeStub(nodeModulesDir) {
  const dir = path.join(nodeModulesDir, "better-sqlite3")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "better-sqlite3", version: "0.0.0-stub", main: "index.cjs" }),
  )
  fs.writeFileSync(
    path.join(dir, "index.cjs"),
    `const fs = require("node:fs")
class Database {
  constructor(dbPath) {
    this.dbPath = dbPath
    fs.appendFileSync(process.env.STUB_RECORD, dbPath + "\\n")
    this.open = true
  }
  prepare() {
    return { all: () => [], get: () => undefined, run: () => ({ changes: 0 }) }
  }
  pragma() { return [] }
  transaction(fn) { return fn }
  exec() {}
  close() { this.open = false }
}
module.exports = Database
module.exports.default = Database
`,
  )
}

/**
 * Spawn the server, complete the MCP handshake and invoke `list-tables` so the
 * database is genuinely opened. Resolves with the path the Database constructor
 * was handed, or null if it was never constructed.
 */
function openDatabase({ appDir, args, env, recordPath }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(appDir, "dist", "cli.js"), ...args], {
      cwd: appDir,
      env: {
        ...process.env,
        SQLITE_DB_PATH: env.SQLITE_DB_PATH ?? "",
        STUB_RECORD: recordPath,
      },
      stdio: ["pipe", "pipe", "pipe"],
    })

    const pending = new Map()
    let buffer = ""
    let stderr = ""
    let settled = false

    const settle = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout.off("data", onData)
      fn(value)
    }

    const onData = (chunk) => {
      buffer += chunk.toString()
      let index
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (!line) continue
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        const done = pending.get(message.id)
        if (!done) continue
        pending.delete(message.id)
        done(message)
      }
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      settle(reject, new Error(`server did not respond in time. stderr: ${stderr}`))
    }, 20_000)

    const request = (message) =>
      new Promise((res) => {
        pending.set(message.id, res)
        child.stdin.write(JSON.stringify(message) + "\n")
      })

    child.stdout.on("data", onData)
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    child.on("error", (error) => {
      child.kill("SIGKILL")
      settle(reject, error)
    })

    ;(async () => {
      await request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "db-path-test", version: "1.0.0" },
        },
      })
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
      await request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list-tables", arguments: {} },
      })
      await new Promise((res) => setTimeout(res, 150))
      const recorded = fs.existsSync(recordPath) ? fs.readFileSync(recordPath, "utf8").trim() : null
      child.stdin.end()
      child.kill("SIGTERM")
      settle(resolve, recorded)
    })().catch((error) => {
      child.kill("SIGKILL")
      settle(reject, error)
    })
  })
}

describe("CLI database path resolution", () => {
  let tmp
  let appDir
  let recordPath

  before(() => {
    assert.ok(fs.existsSync(path.join(distDir, "cli.js")), "dist/cli.js is missing - run `npm run build` first")
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sqlite-dbpath-"))
    appDir = path.join(tmp, "app")
    recordPath = path.join(tmp, "opened.txt")
    fs.mkdirSync(appDir, { recursive: true })
    // Real dependencies, except better-sqlite3 which is stubbed. The spawned
    // process resolves everything from appDir/node_modules, so the stub has to
    // sit next to the genuine @modelcontextprotocol/sdk and zod.
    const appModules = path.join(appDir, "node_modules")
    fs.mkdirSync(appModules, { recursive: true })
    for (const entry of fs.readdirSync(path.join(repoRoot, "node_modules"), { withFileTypes: true })) {
      if (entry.name === "better-sqlite3" || entry.name === ".bin") continue
      fs.symlinkSync(
        path.join(repoRoot, "node_modules", entry.name),
        path.join(appModules, entry.name),
        entry.isDirectory() ? "dir" : "file",
      )
    }
    writeStub(appModules)
    fs.cpSync(distDir, path.join(appDir, "dist"), { recursive: true })
    // The decoy the buggy build would have opened: empty, and the wrong file.
    fs.writeFileSync(path.join(appDir, "database.db"), "")
  })

  after(() => fs.rmSync(tmp, { recursive: true, force: true }))

  beforeEach(() => fs.rmSync(recordPath, { force: true }))

  const target = (name) => {
    const file = path.join(tmp, `${name}.db`)
    fs.writeFileSync(file, "")
    return file
  }

  it("honours --db", async () => {
    const expected = target("from-dash-dash-db")
    assert.equal(await openDatabase({ appDir, args: ["--db", expected], env: {}, recordPath }), expected)
  })

  it("honours --database", async () => {
    const expected = target("from-dash-dash-database")
    assert.equal(await openDatabase({ appDir, args: ["--database", expected], env: {}, recordPath }), expected)
  })

  it("honours --db=<path>", async () => {
    const expected = target("from-inline-equals")
    assert.equal(await openDatabase({ appDir, args: [`--db=${expected}`], env: {}, recordPath }), expected)
  })

  it("still honours SQLITE_DB_PATH when no flag is passed", async () => {
    const expected = target("from-env")
    assert.equal(await openDatabase({ appDir, args: [], env: { SQLITE_DB_PATH: expected }, recordPath }), expected)
  })

  it("lets an explicit flag win over SQLITE_DB_PATH", async () => {
    const flagWins = target("flag-wins")
    const envLoses = target("env-loses")
    const opened = await openDatabase({
      appDir,
      args: ["--db", flagWins],
      env: { SQLITE_DB_PATH: envLoses },
      recordPath,
    })
    assert.equal(opened, flagWins)
  })
})
