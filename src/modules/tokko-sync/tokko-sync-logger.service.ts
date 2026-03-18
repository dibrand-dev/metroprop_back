import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File-based logger for the Tokko freeportals sync process.
 *
 * Writes to two separate files (rotated daily):
 *   logs/tokko-sync-YYYY-MM-DD.log        — all events (received, created, updated, skipped)
 *   logs/tokko-sync-errors-YYYY-MM-DD.log — only failures
 */
@Injectable()
export class TokkoSyncLoggerService {
  private readonly logsDir = path.join(process.cwd(), 'logs');

  private get dateStamp(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private get mainLogPath(): string {
    return path.join(this.logsDir, `tokko-sync-${this.dateStamp}.log`);
  }

  private get errorLogPath(): string {
    return path.join(this.logsDir, `tokko-sync-errors-${this.dateStamp}.log`);
  }

  private write(filePath: string, line: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${line}\n`;
    fs.appendFileSync(filePath, entry, 'utf8');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  info(msg: string): void {
    this.write(this.mainLogPath, `INFO  ${msg}`);
  }

  warn(msg: string): void {
    this.write(this.mainLogPath, `WARN  ${msg}`);
  }

  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error
      ? `${err.message}${err.stack ? `\n       Stack: ${err.stack.split('\n').slice(0, 4).join(' | ')}` : ''}`
      : err != null ? String(err) : '';
    const line = detail ? `${msg} — ${detail}` : msg;
    this.write(this.mainLogPath, `ERROR ${line}`);
    this.write(this.errorLogPath, `ERROR ${line}`);
  }

  // ─── Batch-level helpers ─────────────────────────────────────────────────────

  logBatchStart(offset: number, total: number, dateFrom: string): void {
    this.info(`===== BATCH START offset=${offset} total=${total} from=${dateFrom} =====`);
  }

  logBatchEnd(stats: BatchStats): void {
    this.info(
      `===== BATCH END — created=${stats.created} updated=${stats.updated} ` +
      `skipped=${stats.skipped} failed=${stats.failed} ` +
      `total_received=${stats.totalReceived} =====`,
    );
  }

  // ─── Property-level helpers ──────────────────────────────────────────────────

  logItemReceived(item: any): void {
    const seller = item.seller || {};
    this.info(
      `RECEIVED pub_id=${item.publication_id ?? 'N/A'} ` +
      `tokko_id=${item.id ?? 'N/A'} ` +
      `ref=${item.reference_code ?? 'N/A'} ` +
      `title="${(item.publication_title ?? item.title ?? '').substring(0, 60)}" ` +
      `company="${seller.company_name ?? 'N/A'}" ` +
      `company_id=${seller.company_id ?? 'N/A'} ` +
      `branch_id=${seller.branch_id ?? 'N/A'} ` +
      `op_types=${JSON.stringify((item.operations ?? []).map((o: any) => o.operation_type))} ` +
      `photos=${(item.photos ?? []).length} ` +
      `tags=${JSON.stringify(Object.keys(item.tags ?? {}))}`,
    );
  }

  logItemCreated(publicationId: string, internalId: number, orgId: number, branchId: number): void {
    this.info(
      `CREATED pub_id=${publicationId} internal_id=${internalId} ` +
      `org_id=${orgId} branch_id=${branchId}`,
    );
  }

  logItemUpdated(publicationId: string, internalId: number): void {
    this.info(`UPDATED pub_id=${publicationId} internal_id=${internalId}`);
  }

  logItemSkipped(reason: string, item: any): void {
    this.warn(
      `SKIPPED pub_id=${item.publication_id ?? 'N/A'} tokko_id=${item.id ?? 'N/A'} reason="${reason}"`,
    );
  }

  logItemFailed(item: any, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    const header =
      `FAILED pub_id=${item.publication_id ?? 'N/A'} tokko_id=${item.id ?? 'N/A'} ` +
      `ref=${item.reference_code ?? 'N/A'} error="${msg}"`;

    // Serialize the full item so the raw payload is visible in the error log
    let fullPayload: string;
    try {
      fullPayload = JSON.stringify(item, null, 2);
    } catch (_) {
      fullPayload = String(item);
    }

    const stack = err instanceof Error && err.stack
      ? `\n--- Stack ---\n${err.stack}`
      : '';

    const fullLine = `${header}\n--- Payload ---\n${fullPayload}${stack}\n--- End ---`;
    this.write(this.mainLogPath, `ERROR ${fullLine}`);
    this.write(this.errorLogPath, `ERROR ${fullLine}`);
  }

  logOrgCreated(companyId: string, orgId: number, email: string): void {
    this.info(`ORG_CREATED ext_ref=${companyId} internal_id=${orgId} email=${email}`);
  }

  logBranchCreated(extRef: string | null, branchId: number, orgId: number): void {
    this.info(`BRANCH_CREATED ext_ref=${extRef ?? 'N/A'} internal_id=${branchId} org_id=${orgId}`);
  }

  logImagesSync(propertyId: number, added: number, removed: number, unchanged: number): void {
    this.info(
      `IMAGES property_id=${propertyId} added=${added} removed=${removed} unchanged=${unchanged}`,
    );
  }
}

export interface BatchStats {
  totalReceived: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}
