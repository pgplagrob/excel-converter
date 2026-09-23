import { spawn } from "node:child_process";

const script = process.argv[2];
if (!new Set(["dev", "start"]).has(script)) {
  console.error("Usage: node run-apps.mjs <dev|start>");
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this command through npm (npm run dev or npm start).");
  process.exit(1);
}

const packageManager = npmCli.endsWith(".js") ? process.execPath : npmCli;
const packageManagerArgs = npmCli.endsWith(".js") ? [npmCli] : [];
const usesBun = /(?:^|[\\/])bun(?:\.exe)?$/i.test(npmCli);

const workspaces = ["backend", "frontend"];
const children = workspaces.map((workspace) => {
  const args = usesBun
    ? ["run", script]
    : [...packageManagerArgs, "run", script, "--workspace", workspace];

  return spawn(packageManager, args, {
    cwd: usesBun ? workspace : undefined,
    stdio: "inherit",
    windowsHide: true,
  });
});

let shuttingDown = false;
function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) stopAll(signal ? 1 : (code ?? 0));
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
