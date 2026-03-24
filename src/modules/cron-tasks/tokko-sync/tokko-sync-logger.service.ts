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

	private orgLogPath(orgId: string): string {
		return path.join(this.logsDir, `tokko-sync-organization-${orgId}-${this.dateStamp}.log`);
	}

	private ensureLogsDir(): void {
		if (!fs.existsSync(this.logsDir)) {
			fs.mkdirSync(this.logsDir, { recursive: true });
		}
	}

	private write(filePath: string, line: string): void {
		try {
			this.ensureLogsDir();
			const timestamp = new Date().toISOString();
			const entry = `[${timestamp}] ${line}\n`;
			fs.appendFileSync(filePath, entry, 'utf8');
		} catch (err) {
			// Fallback to stdout so errors are never lost
			console.error(`[TokkoSyncLogger] Failed to write log to ${filePath}: ${(err as Error).message}`);
			console.error(`[TokkoSyncLogger] Log entry: ${line}`);
		}
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

	/** Writes to the main log AND to the per-organization log file. */
	orgInfo(orgId: string, msg: string): void {
		this.write(this.mainLogPath, `INFO  [org=${orgId}] ${msg}`);
		this.write(this.orgLogPath(orgId), `INFO  ${msg}`);
	}

	/** Writes to the main log, error log AND the per-organization log file. */
	orgError(orgId: string, msg: string, err?: unknown): void {
		const detail = err instanceof Error
			? `${err.message}${err.stack ? `\n       Stack: ${err.stack.split('\n').slice(0, 4).join(' | ')}` : ''}`
			: err != null ? String(err) : '';
		const line = detail ? `${msg} — ${detail}` : msg;
		this.write(this.mainLogPath, `ERROR [org=${orgId}] ${line}`);
		this.write(this.errorLogPath, `ERROR [org=${orgId}] ${line}`);
		this.write(this.orgLogPath(orgId), `ERROR ${line}`);
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
		const safeItem = item ?? {};
		const seller = safeItem.seller || {};
		this.info(
			`RECEIVED pub_id=${safeItem.publication_id ?? 'N/A'} ` +
			`tokko_id=${safeItem.id ?? 'N/A'} ` +
			`ref=${safeItem.reference_code ?? 'N/A'} ` +
			`title=\"${(safeItem.publication_title ?? safeItem.title ?? '').substring(0, 60)}\" ` +
			`company=\"${seller.company_name ?? 'N/A'}\" ` +
			`company_id=${seller.company_id ?? 'N/A'} ` +
			`branch_id=${seller.branch_id ?? 'N/A'} ` +
			`op_types=${JSON.stringify((safeItem.operations ?? []).map((o: any) => o.operation_type))} ` +
			`photos=${(safeItem.photos ?? []).length} ` +
			`tags=${JSON.stringify(Object.keys(safeItem.tags ?? {}))}`,
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
		const safeItem = item ?? {};
		this.warn(
			`SKIPPED pub_id=${safeItem.publication_id ?? 'N/A'} tokko_id=${safeItem.id ?? 'N/A'} reason=\"${reason}\"`,
		);
	}

	logItemFailed(item: any, err: unknown): void {
		const safeItem = item ?? {};
		const msg = err instanceof Error ? err.message : String(err);
		const header =
			`FAILED pub_id=${safeItem.publication_id ?? 'N/A'} tokko_id=${safeItem.id ?? 'N/A'} ` +
			`ref=${safeItem.reference_code ?? 'N/A'} error=\"${msg}\"`;

		// Serialize the full item so the raw payload is visible in the error log
		let fullPayload: string;
		try {
			fullPayload = JSON.stringify(safeItem, null, 2);
		} catch (_) {
			fullPayload = String(safeItem);
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
