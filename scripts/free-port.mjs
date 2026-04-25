import { execSync } from 'node:child_process';

const port = process.argv[2];

if (!port) {
  console.error('Usage: node scripts/free-port.mjs <port>');
  process.exit(1);
}

function killPid(pid) {
  if (!pid || pid === '0' || Number.isNaN(Number(pid))) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    console.log(`Freed port ${port} by stopping PID ${pid}`);
  } catch (error) {
    console.warn(`Could not stop PID ${pid} on port ${port}`);
  }
}

function freePortOnWindows(targetPort) {
  const output = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
  const lines = output.split(/\r?\n/);
  const pids = new Set();

  for (const line of lines) {
    if (!line.includes(`:${targetPort}`) || !line.includes('LISTENING')) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    const pid = parts.at(-1);
    if (pid) {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    killPid(pid);
  }
}

function freePortOnUnix(targetPort) {
  try {
    const output = execSync(`lsof -ti tcp:${targetPort}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const pid of new Set(pids)) {
      killPid(pid);
    }
  } catch {
    // No listener or lsof unavailable.
  }
}

if (process.platform === 'win32') {
  freePortOnWindows(port);
} else {
  freePortOnUnix(port);
}
