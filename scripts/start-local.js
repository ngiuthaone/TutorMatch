const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const localDiscoverDir = path.resolve(root, "discover");
const discoverDir = process.env.DISCOVER_APP_DIR
  ? path.resolve(process.env.DISCOVER_APP_DIR)
  : fs.existsSync(path.join(localDiscoverDir, "package.json"))
    ? localDiscoverDir
    : path.resolve(root, "..", "New OpenCode Project", "dis");

const profilePort = process.env.PORT || "4173";
const discoverPort = process.env.DISCOVER_PORT || "3456";
const host = process.env.HOST || "127.0.0.1";
const children = [];

function run(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    env: { ...process.env, ...options.env },
    stdio: "inherit"
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && !shuttingDown) {
      console.error(`${label} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 150);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (!fs.existsSync(path.join(discoverDir, "package.json"))) {
  console.warn(`Discover app not found at ${discoverDir}`);
  console.warn("Starting the profile preview only.");
} else {
  run("Discover", "npm", ["run", "dev", "--", "--hostname", host, "--port", discoverPort], {
    cwd: discoverDir,
    env: { PORT: discoverPort }
  });
}

run("TutorMatch", "node", ["server.js"], {
  cwd: root,
  env: { PORT: profilePort, HOST: host }
});

console.log(`Profile preview: http://${host}:${profilePort}`);
console.log(`Discover: http://${host}:${discoverPort}/discover`);
