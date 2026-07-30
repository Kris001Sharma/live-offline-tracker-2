import fs from 'fs';

const path = 'modules/sync/sync.service.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Immutable pipeline & Architectural Comments
code = code.replace(
  'const UPLOAD_PIPELINE: SyncStage[] = [',
  `/**
 * Architectural Responsibilities:
 * - Sync Engine owns orchestration only.
 * - Upload implementations remain delegated.
 * - Retry belongs exclusively to Slice 8D.
 * - Conflict handling belongs exclusively to Slice 8E.
 * - Scheduling belongs to future phases.
 * - SQL remains repository owned.
 * - HTTP remains upload provider owned.
 */
const UPLOAD_PIPELINE: readonly SyncStage[] = deepCloneAndFreeze([`
);
code = code.replace(
  '    }  }\n];',
  '    }\n  }\n]);'
);

// 2. executePipeline
code = code.replace(
  `      // Sequential deterministic upload order
      for (const stage of UPLOAD_PIPELINE) {
        lastSyncedModule = stage.name;
        try {
          const result = await stage.execute();
          totalUploaded += result.uploaded;
          totalRemaining += result.remaining;
        } catch (stageError: any) {
          // Stop the pipeline immediately on failure
          currentState = SyncState.STOPPED;
          isRunning = false;
          lastFailedSyncAt = new Date().toISOString();
          consecutiveFailures += 1;
          commitState();

          return freezeResult({
            success: false,
            state: currentState,
            error: \`Sync Pipeline failed at stage: \${stage.name}. \${stageError.message || String(stageError)}\`,
            errorCode: SyncErrorCode.PIPELINE_STAGE_FAILED
          });
        }
      }`,
  `      const pipelineResult = await executePipeline();
      if (!pipelineResult.success) {
        // executePipeline has already handled rollback/state update if needed,
        // but to meet atomic rollback requirement on unexpected errors, we rollback on stage failure if we didn't already
        return freezeResult(pipelineResult.result!);
      }
      totalUploaded = pipelineResult.totalUploaded!;
      totalRemaining = pipelineResult.totalRemaining!;`
);

// wait, the prompt says "Unexpected exceptions must invoke: rollbackSync()".
// if pipeline fails normally (e.g. stage error), do we rollback?
// The prompt says: "Unexpected exceptions must invoke: rollbackSync() Restoring: lifecycle state ... to their exact pre-execution snapshot."
// Wait, for `executePipeline`, we should extract the loop.
