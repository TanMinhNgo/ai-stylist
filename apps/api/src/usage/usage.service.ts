import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class UsageService {
  // shortcut: BE-03 is internal only; implement quotas and ledger in BE-05.
  reserve(
    _tx: Prisma.TransactionClient,
    _userId: string,
    _jobId: string,
  ): void {
    void _tx;
    void _userId;
    void _jobId;
  }
  refund(_tx: Prisma.TransactionClient, _userId: string, _jobId: string): void {
    void _tx;
    void _userId;
    void _jobId;
  }
}
