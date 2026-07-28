import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';

// Load .env before anything else — must happen before PrismaClient import
// because PrismaClient reads DATABASE_URL at module init time
config({ path: resolve(process.cwd(), '.env') });

const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────

function randHash(len: number): string {
  return randomBytes(len).toString('hex').slice(0, len);
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400_000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600_000);
}

const STATUSES = ['completed', 'in_progress', 'failed', 'aborted', 'paused'] as const;
const PHASES = [
  { phase: 1, step: 0, name: 'init' },
  { phase: 2, step: 1, name: 'plan' },
  { phase: 3, step: 2, name: 'develop' },
  { phase: 4, step: 3, name: 'review' },
  { phase: 5, step: 4, name: 'test' },
  { phase: 6, step: 5, name: 'verify' },
  { phase: 7, step: 6, name: 'deliver' },
] as const;

const DEVELOPERS = [
  { email: 'alice@example.com', displayName: 'Alice Zhang', role: 'admin' },
  { email: 'bob@example.com', displayName: 'Bob Li', role: 'member' },
  { email: 'carol@example.com', displayName: 'Carol Wang', role: 'member' },
  { email: 'dave@example.com', displayName: 'Dave Chen', role: 'member' },
  { email: 'eve@example.com', displayName: 'Eve Liu', role: 'member' },
  { email: 'frank@example.com', displayName: 'Frank Wu', role: 'member' },
];

const CHANGE_NAMES = [
  'feat: add user authentication',
  'fix: resolve pagination bug',
  'refactor: extract common utilities',
  'feat: implement search endpoint',
  'fix: correct date formatting',
  'feat: add team management page',
  'chore: update dependencies',
  'feat: implement metrics dashboard',
  'fix: handle null pointer in parser',
  'refactor: migrate to new API format',
  'feat: add notification system',
  'fix: resolve race condition',
  'feat: implement CSV export',
  'fix: correct timezone handling',
  'feat: add dark mode support',
  'chore: improve test coverage',
  'feat: implement pipeline hooks',
  'fix: resolve memory leak',
  'feat: add audit logging',
  'refactor: simplify state machine',
];

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Clean existing test data ──────────────────────────────────
  console.log('Cleaning existing data...');
  await prisma.pipelineRun.deleteMany({ where: { repo: { name: { startsWith: 'demo-' } } } });
  await prisma.collectionLog.deleteMany({ where: { repo: { name: { startsWith: 'demo-' } } } });
  await prisma.repo.deleteMany({ where: { name: { startsWith: 'demo-' } } });
  await prisma.developer.deleteMany({ where: { email: { in: DEVELOPERS.map((d) => d.email) } } });
  await prisma.team.deleteMany({ where: { slug: { in: ['engineering', 'platform', 'ai-lab', 'infra'] } } });
  console.log('  Done.\n');

  // ── 2. Teams ─────────────────────────────────────────────────────
  console.log('Creating teams...');
  const engineering = await prisma.team.create({
    data: { name: 'Engineering', slug: 'engineering', isActive: true },
  });
  const platform = await prisma.team.create({
    data: { name: 'Platform', slug: 'platform', parentId: engineering.id, isActive: true },
  });
  const aiLab = await prisma.team.create({
    data: { name: 'AI Lab', slug: 'ai-lab', parentId: engineering.id, isActive: true },
  });
  const infra = await prisma.team.create({
    data: { name: 'Infrastructure', slug: 'infra', parentId: engineering.id, isActive: true },
  });
  const teams = [engineering, platform, aiLab, infra];
  console.log(`  Created ${teams.length} teams.\n`);

  // ── 3. Developers ────────────────────────────────────────────────
  console.log('Creating developers...');
  const devRecords: Record<string, { id: number; email: string }> = {};
  const teamIds = [platform.id, aiLab.id, infra.id, null];

  for (const [i, dev] of DEVELOPERS.entries()) {
    const created = await prisma.developer.create({
      data: {
        email: dev.email,
        displayName: dev.displayName,
        role: dev.role,
        teamId: i < 4 ? teamIds[i] : null,
        isActive: true,
        firstSeenAt: daysAgo(90),
        lastSeenAt: hoursAgo(randomInt(1, 48)),
        tokenVersion: 0,
      },
    });
    devRecords[dev.email] = { id: created.id, email: created.email };
    console.log(`  ${dev.displayName} (${dev.email}) id=${created.id} team=${teamIds[i] ?? 'none'}`);
  }

  // Ensure developer id=451 exists for DEV_IMPERSONATE_DEVELOPER_ID
  // But with autoincrement we can't force id=451 — check if it exists
  const impersonateId = Number(process.env.DEV_IMPERSONATE_DEVELOPER_ID);
  if (impersonateId) {
    const existing = await prisma.developer.findUnique({ where: { id: impersonateId } });
    if (existing) {
      console.log(`  ⚡ Impersonation developer id=${impersonateId} already exists: ${existing.email}`);
    } else {
      // Create one that matches the impersonation email pattern
      const impDev = await prisma.developer.create({
        data: {
          email: `dev-${impersonateId}@opsx.local`,
          displayName: `Developer ${impersonateId}`,
          role: 'admin',
          teamId: platform.id,
          isActive: true,
          firstSeenAt: daysAgo(90),
          lastSeenAt: hoursAgo(1),
          tokenVersion: 0,
        },
      });
      console.log(`  ⚠️  Created developer id=${impDev.id} for impersonation, but autoincrement may not match ${impersonateId}.`);
      console.log(`     If id mismatch, update .env DEV_IMPERSONATE_DEVELOPER_ID=${impDev.id} or manually in DB.`);
    }
  }
  console.log();

  // ── 4. Repos ─────────────────────────────────────────────────────
  console.log('Creating repos...');
  const repos = [];
  for (const name of ['demo-backend', 'demo-frontend']) {
    const repo = await prisma.repo.create({
      data: {
        name,
        gitUrl: `https://github.com/opsx-demo/${name}.git`,
        gitBranch: 'main',
        collectSince: daysAgo(90),
        lastFetchedCommit: randHash(40),
        scanFromCommit: randHash(40),
        scanToCommit: randHash(40),
        collectionStatus: 'idle',
        isActive: true,
        retentionDays: 365,
      },
    });
    repos.push(repo);
    console.log(`  ${repo.name} id=${repo.id}`);
  }
  console.log();

  // ── 5. PipelineRuns ──────────────────────────────────────────────
  console.log('Creating pipeline runs...');
  const allDevs = Object.values(devRecords);

  let runCount = 0;
  for (const repo of repos) {
    for (let i = 0; i < 25; i++) {
      const dev = pick(allDevs);
      const status = pick(STATUSES);
      const changeName = CHANGE_NAMES[i % CHANGE_NAMES.length];
      const createdAtSource = daysAgo(randomInt(0, 90));
      const completedAt = status === 'completed'
        ? new Date(createdAtSource.getTime() + randomInt(1, 72) * 3600_000)
        : null;
      const durationSeconds = completedAt
        ? Math.round((completedAt.getTime() - createdAtSource.getTime()) / 1000)
        : null;

      const fingerprintId = `fp1.${randHash(128)}`;
      // Make most runs verified (like production data after collection)
      const fingerprintVerified = Math.random() > 0.1;

      const run = await prisma.pipelineRun.create({
        data: {
          repoId: repo.id,
          developerId: dev.id,
          changeName,
          schemaVersion: 3,
          stateVersion: randomInt(1, 20),
          sourceBranch: `feature/${changeName.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
          targetBranch: 'main',
          currentPhase: status === 'in_progress' ? pick(PHASES).phase : PHASES[PHASES.length - 1].phase,
          currentStep: status === 'in_progress' ? pick(PHASES).step : PHASES[PHASES.length - 1].step,
          status,
          executionMode: pick(['automatic', 'manual']),
          isLatest: true,
          isLatestHistorical: false,
          snapshotSource: 'collector',
          fingerprintId,
          fingerprintNonce: randHash(8),
          fingerprintVerified,
          fingerprintKeyVersion: fingerprintVerified ? 'fp1' : null,
          createdByEmail: dev.email,
          createdBy: dev.email.split('@')[0],
          createdAtSource,
          machinePlatform: pick(['darwin', 'linux', 'win32']),
          machineHostname: `dev-${dev.email.split('@')[0]}-mbp.local`,
          machineOsRelease: pick(['14.5', '22.04', '11']),
          machineNodeVersion: pick(['v20.11.0', 'v21.6.1', 'v22.3.0']),
          machineArch: pick(['arm64', 'x64']),
          featureId: `FEAT-${randomInt(1000, 9999)}`,
          featureUrl: `https://linear.app/opsx/issue/FEAT-${randomInt(1000, 9999)}`,
          pauseReason: status === 'paused' ? pick(['waiting for review', 'blocked by dependency', 'on hold']) : null,
          deliveryCommitSha: status === 'completed' ? randHash(40) : null,
          deliveryMergeCommitSha: status === 'completed' ? randHash(40) : null,
          deliverySourcePushed: status === 'completed',
          deliveryTargetPushed: status === 'completed',
          deliveryTag: status === 'completed' ? `v1.${randomInt(0, 9)}.${randomInt(0, 99)}` : null,
          reviewStatus: pick(['approved', 'pending', 'rejected']),
          reviewCurrentRound: randomInt(0, 3),
          testsCommand: 'npm test',
          testsAttempts: randomInt(0, 3),
          testsStatus: pick(['passed', 'failed', 'pending']),
          testsDetail: Math.random() > 0.5 ? 'All 42 tests passed' : null,
          verifyCommand: 'npm run verify',
          verifyAttempts: randomInt(0, 2),
          verifyStatus: pick(['passed', 'pending', 'skipped']),
          verifyDetail: Math.random() > 0.5 ? 'Verification successful' : null,
          createdAtPipeline: createdAtSource,
          updatedAtPipeline: completedAt ?? daysAgo(randomInt(0, 1)),
          completedAtPipeline: completedAt,
          changeDurationSeconds: durationSeconds,
          contentHash: randHash(32),
          rawStateJson: { changeName, status, createdAtSource: createdAtSource.toISOString() },
          commitSha: randHash(40),
          commitTimestamp: createdAtSource,
        },
      });

      // ── Phase history ───────────────────────────────────────────
      const phasesToCreate = status === 'completed'
        ? PHASES
        : PHASES.slice(0, randomInt(1, PHASES.length + 1));

      for (let pi = 0; pi < phasesToCreate.length; pi++) {
        const p = phasesToCreate[pi];
        const phaseStartedAt = new Date(createdAtSource.getTime() + pi * randomInt(1, 8) * 3600_000);
        const phaseCompletedAt = pi < phasesToCreate.length - 1 || status === 'completed'
          ? new Date(phaseStartedAt.getTime() + randomInt(1, 24) * 3600_000)
          : null;
        const phaseDuration = phaseCompletedAt
          ? Math.round((phaseCompletedAt.getTime() - phaseStartedAt.getTime()) / 1000)
          : null;

        await prisma.phaseHistoryEntry.create({
          data: {
            runId: run.id,
            phase: p.phase,
            step: p.step,
            executedBy: dev.email.split('@')[0],
            status: phaseCompletedAt ? 'completed' : pick(['in_progress', 'failed']),
            startedAt: phaseStartedAt,
            completedAt: phaseCompletedAt,
            durationSeconds: phaseDuration,
          },
        });
      }

      // ── Review rounds ───────────────────────────────────────────
      const rounds = randomInt(0, 3);
      for (let r = 1; r <= rounds; r++) {
        await prisma.reviewRound.create({
          data: {
            runId: run.id,
            roundNumber: r,
            reportPath: r === rounds ? null : `/reports/${run.changeName}-round${r}.md`,
            status: r === rounds ? 'approved' : 'rejected',
            recordedAt: new Date(createdAtSource.getTime() + r * 8 * 3600_000),
          },
        });
      }

      // ── Gate bypasses ──────────────────────────────────────────
      if (Math.random() > 0.7) {
        await prisma.pipelineGateBypassed.create({
          data: {
            runId: run.id,
            gateName: pick(['security-scan', 'performance-benchmark', 'dependency-check', 'changelog']),
          },
        });
      }

      runCount++;
    }
  }
  console.log(`  Created ${runCount} pipeline runs with phases, reviews, and gates.\n`);

  // ── 6. Collection logs ───────────────────────────────────────────
  console.log('Creating collection logs...');
  for (const repo of repos) {
    for (let i = 0; i < 5; i++) {
      const startedAt = daysAgo(i * 7);
      const status = i === 0 ? 'completed' : pick(['completed', 'completed', 'completed', 'failed']);
      await prisma.collectionLog.create({
        data: {
          repoId: repo.id,
          queuedAt: new Date(startedAt.getTime() - 60_000),
          startedAt,
          finishedAt: new Date(startedAt.getTime() + randomInt(1, 30) * 60_000),
          status,
          mode: 'trusted',
          triggerSource: i === 0 ? 'manual' : 'scheduled',
          workerId: randHash(16),
          attempt: 1,
          scanFromCommit: randHash(40),
          scanToCommit: randHash(40),
          batchSize: 100,
          batchesTotal: randomInt(1, 10),
          batchesCompleted: status === 'completed' ? randomInt(1, 10) : randomInt(0, 5),
          commitsScanned: randomInt(10, 200),
          filesFound: randomInt(0, 50),
          runsUpserted: randomInt(5, 25),
          runsSkipped: randomInt(0, 10),
          fingerprintsRejected: randomInt(0, 3),
          rejectionDetails: status === 'failed' ? { reason: 'connection timeout' } : undefined,
          errorMessage: status === 'failed' ? 'Connection to git remote timed out after 30s' : undefined,
        },
      });
    }
  }
  console.log(`  Created 10 collection logs.\n`);

  // ── Summary ───────────────────────────────────────────────────────
  console.log('✅ Seed complete!');
  console.log(`   Teams:       ${teams.length}`);
  console.log(`   Developers:  ${Object.keys(devRecords).length}`);
  console.log(`   Repos:       ${repos.length}`);
  console.log(`   Runs:        ${runCount}`);
  console.log(`   ColLogs:     10`);
  console.log(`\n   Run "npm run dev" and visit http://localhost:3000 to see the data.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
