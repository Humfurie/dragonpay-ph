import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from '@nestjs/common';
import type { DragonPayConfig } from 'dragonpay-ph';

export interface DragonPayModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => DragonPayConfig | Promise<DragonPayConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}
