import type { ModuleMetadata } from '@nestjs/common';
import type { DragonPayConfig } from 'dragonpay-ph';

export interface DragonPayModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: unknown[]) => DragonPayConfig | Promise<DragonPayConfig>;
  inject?: unknown[];
}
