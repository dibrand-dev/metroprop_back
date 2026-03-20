import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TokkoSyncService } from './tokko-sync.service';

@ApiExcludeController()
@Controller('tokko-sync')
export class TokkoSyncController {
  constructor(private readonly tokkoSyncService: TokkoSyncService) {}

  /**
   * POST /tokko-sync/trigger
   * Manually trigger one sync batch (useful for testing without waiting for cron)
   */
  @Post('trigger')
  trigger() {
    return this.tokkoSyncService.triggerManualSync();
  }

  /**
   * POST /tokko-sync/sync-one
   * Body: { "publication_id": "12345" }
   * Fetches and upserts a single property by its Tokko publication_id.
   */
  @Post('sync-one')
  syncOne(@Body() body: { publication_id: string }) {
    if (!body?.publication_id) {
      throw new BadRequestException('publication_id is required');
    }
    return this.tokkoSyncService.syncSingleProperty(String(body.publication_id));
  }

  /**
   * POST /tokko-sync/sync-organization
   * Body: { "api_key": "xxx", "organization_id": "12345", "limit": 500, "offset": 0 }
   * Fetches and upserts properties for a given Tokko organization_id.
   * Returns a summary with processed / total / pending counts.
   */
  @Post('sync-organization')
  syncOrganization(
    @Body() body: { api_key: string; organization_id: string; limit?: number; offset?: number },
  ) {
    if (!body?.organization_id) {
      throw new BadRequestException('organization_id is required');
    }
    if (!body?.api_key) {
      throw new BadRequestException('api_key is required');
    }
    return this.tokkoSyncService.syncOrganization(
      body.api_key,
      String(body.organization_id),
      body.limit ?? 500,
      body.offset ?? 0,
    );
  }


}
