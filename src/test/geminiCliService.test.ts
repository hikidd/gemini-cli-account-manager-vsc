import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GeminiCliService } from '../services/GeminiCliService';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function runGeminiCliServiceTests(): Promise<void> {
  testRepairCopiesSessionToProjectHashDirectory();
  testRepairSkipsInvalidSessionAndContinues();
  testRepairSkipsUnsafeProjectHash();
  testRepairSkipsSymlinkedTargetDirectory();
  testRepairSkipsSymlinkedTmpDirectory();
  await testUpdateCredentialsInvokesRepairFallback();
  await testUpdateCredentialsSwallowsRepairErrors();
}

function testRepairCopiesSessionToProjectHashDirectory(): void {
  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    const tmpDir = path.join(geminiDir, 'tmp');
    const sourceProject = 'gemini-cli';
    const targetProjectHash = 'abc123realhash';

    const sourceChatsDir = path.join(tmpDir, sourceProject, 'chats');
    fs.mkdirSync(sourceChatsDir, { recursive: true });

    const sessionFile = 'session-2026-02-25T01-30-8795af1b.json';
    const sourceSessionPath = path.join(sourceChatsDir, sessionFile);
    const sourcePayload = {
      sessionId: '8795af1b-91f6-4993-8176-7e6f1103b3f5',
      projectHash: targetProjectHash,
      messages: []
    };
    fs.writeFileSync(sourceSessionPath, JSON.stringify(sourcePayload, null, 2), 'utf8');

    const service = new GeminiCliService(geminiDir);

    service.repairHistorySessionDirs();

    const repairedPath = path.join(tmpDir, targetProjectHash, 'chats', sessionFile);
    assert.ok(fs.existsSync(repairedPath), 'Expected session file to be rebuilt under projectHash/chats');

    const repairedPayload = JSON.parse(fs.readFileSync(repairedPath, 'utf8'));
    assert.strictEqual(repairedPayload.projectHash, targetProjectHash);
  } finally {
    removeDir(tempHome);
  }
}

function testRepairSkipsInvalidSessionAndContinues(): void {
  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    const tmpDir = path.join(geminiDir, 'tmp');
    const sourceProject = 'gemini-cli';
    const targetProjectHash = 'def456realhash';

    const sourceChatsDir = path.join(tmpDir, sourceProject, 'chats');
    fs.mkdirSync(sourceChatsDir, { recursive: true });

    fs.writeFileSync(path.join(sourceChatsDir, 'broken.json'), '{invalid json', 'utf8');

    const validFile = 'session-valid.json';
    fs.writeFileSync(
      path.join(sourceChatsDir, validFile),
      JSON.stringify({ sessionId: 'id', projectHash: targetProjectHash, messages: [] }, null, 2),
      'utf8'
    );

    const service = new GeminiCliService(geminiDir);

    assert.doesNotThrow(() => service.repairHistorySessionDirs());

    const repairedPath = path.join(tmpDir, targetProjectHash, 'chats', validFile);
    assert.ok(fs.existsSync(repairedPath), 'Expected valid session to still be copied even if one file is invalid');
  } finally {
    removeDir(tempHome);
  }
}

function testRepairSkipsUnsafeProjectHash(): void {
  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    const tmpDir = path.join(geminiDir, 'tmp');
    const sourceProject = 'gemini-cli';

    const sourceChatsDir = path.join(tmpDir, sourceProject, 'chats');
    fs.mkdirSync(sourceChatsDir, { recursive: true });

    const validFile = 'session-malicious.json';
    fs.writeFileSync(
      path.join(sourceChatsDir, validFile),
      JSON.stringify({ sessionId: 'id', projectHash: '../evil', messages: [] }, null, 2),
      'utf8'
    );

    const service = new GeminiCliService(geminiDir);

    service.repairHistorySessionDirs();

    const escapedTarget = path.resolve(tmpDir, '../evil/chats', validFile);
    assert.ok(!fs.existsSync(escapedTarget), 'Expected unsafe projectHash to be ignored to prevent path traversal');
  } finally {
    removeDir(tempHome);
  }
}

function testRepairSkipsSymlinkedTargetDirectory(): void {
  if (process.platform === 'win32') {
    return;
  }

  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    const tmpDir = path.join(geminiDir, 'tmp');
    const sourceProject = 'gemini-cli';
    const targetProjectHash = 'symlinktesthash';

    const sourceChatsDir = path.join(tmpDir, sourceProject, 'chats');
    fs.mkdirSync(sourceChatsDir, { recursive: true });

    const sessionFile = 'session-symlink.json';
    fs.writeFileSync(
      path.join(sourceChatsDir, sessionFile),
      JSON.stringify({ sessionId: 'id', projectHash: targetProjectHash, messages: [] }, null, 2),
      'utf8'
    );

    const outsideDir = path.join(tempHome, 'outside-target');
    fs.mkdirSync(outsideDir, { recursive: true });

    const symlinkPath = path.join(tmpDir, targetProjectHash);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.symlinkSync(outsideDir, symlinkPath, 'dir');

    const service = new GeminiCliService(geminiDir);
    service.repairHistorySessionDirs();

    const outsideWrittenFile = path.join(outsideDir, 'chats', sessionFile);
    assert.ok(!fs.existsSync(outsideWrittenFile), 'Expected symlinked target directory to be ignored');
  } finally {
    removeDir(tempHome);
  }
}

function testRepairSkipsSymlinkedTmpDirectory(): void {
  if (process.platform === 'win32') {
    return;
  }

  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    const configuredTmpDir = path.join(geminiDir, 'tmp');
    const sourceProject = 'gemini-cli';
    const targetProjectHash = 'tmpsymlinkhash';

    const realTmpDir = path.join(tempHome, 'actual-tmp');
    const sourceChatsDir = path.join(realTmpDir, sourceProject, 'chats');
    fs.mkdirSync(sourceChatsDir, { recursive: true });

    const sessionFile = 'session-tmp-symlink.json';
    fs.writeFileSync(
      path.join(sourceChatsDir, sessionFile),
      JSON.stringify({ sessionId: 'id', projectHash: targetProjectHash, messages: [] }, null, 2),
      'utf8'
    );

    fs.mkdirSync(geminiDir, { recursive: true });
    fs.symlinkSync(realTmpDir, configuredTmpDir, 'dir');

    const service = new GeminiCliService(geminiDir);
    service.repairHistorySessionDirs();

    const createdViaRepair = path.join(realTmpDir, targetProjectHash, 'chats', sessionFile);
    assert.ok(!fs.existsSync(createdViaRepair), 'Expected repair to skip when configured tmp directory is a symlink');
  } finally {
    removeDir(tempHome);
  }
}

async function testUpdateCredentialsInvokesRepairFallback(): Promise<void> {
  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    fs.mkdirSync(geminiDir, { recursive: true });

    const service = new GeminiCliService(geminiDir) as any;

    let invoked = false;
    service.repairHistorySessionDirs = () => {
      invoked = true;
    };

    const account = {
      id: '1',
      email: 'test@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'idtoken',
      expiresAt: Date.now() + 3600 * 1000
    };

    await service.updateCredentials(account);

    assert.ok(invoked, 'Expected updateCredentials to invoke history/session repair fallback');
  } finally {
    removeDir(tempHome);
  }
}

async function testUpdateCredentialsSwallowsRepairErrors(): Promise<void> {
  const tempHome = createTempDir('gemini-cli-service-test-');

  try {
    const geminiDir = path.join(tempHome, '.gemini');
    fs.mkdirSync(geminiDir, { recursive: true });

    const service = new GeminiCliService(geminiDir) as any;

    service.repairHistorySessionDirs = () => {
      throw new Error('mock repair failure');
    };

    const account = {
      id: '2',
      email: 'repair-fail@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'idtoken',
      expiresAt: Date.now() + 3600 * 1000
    };

    let warned = false;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (String(args[0]).includes('Failed to repair history/session dirs during credential update')) {
        warned = true;
      }
    };

    try {
      await assert.doesNotReject(
        service.updateCredentials(account),
        'Expected updateCredentials not to fail when repairHistorySessionDirs throws'
      );
    } finally {
      console.warn = originalWarn;
    }

    assert.ok(warned, 'Expected repair failure to be logged during credential update');
  } finally {
    removeDir(tempHome);
  }
}
