const fs = require("fs");
const path = require("path");

const commands = new Map();

function register(command) {
  if (!command || !command.pattern || typeof command.handler !== "function") {
    throw new Error("Invalid command plugin");
  }

  const names = [command.pattern, ...(command.aliases || [])]
    .map((x) => String(x).toLowerCase().trim())
    .filter(Boolean);

  for (const name of names) commands.set(name, command);
}

function loadPlugins() {
  const dir = path.join(__dirname, "..", "plugins");
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;
    const plugin = require(path.join(dir, file));
    register(plugin);
  }
}

function getCommand(name) {
  return commands.get(String(name || "").toLowerCase());
}

function listCommands() {
  return [...new Set([...commands.values()].map((c) => c.pattern))];
}

module.exports = { register, loadPlugins, getCommand, listCommands };
