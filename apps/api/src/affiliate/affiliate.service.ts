import { Injectable } from '@nestjs/common';
import {
  AffiliateProductsResponse,
  type AffiliateProductsQuery,
} from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { AffiliateRepository } from './affiliate.repository';
@Injectable()
export class AffiliateService {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly repo: AffiliateRepository,
  ) {}
  products(query: AffiliateProductsQuery) {
    const catalog = this.config.values.AFFILIATE_PRODUCTS_JSON ?? [];
    const q = query.q?.toLocaleLowerCase('vi');
    return AffiliateProductsResponse.parse({
      status: catalog.length ? 'available' : 'not_configured',
      disclosure:
        'Liên kết tiếp thị liên kết: ứng dụng có thể nhận hoa hồng khi bạn mua hàng. Giá và tồn kho do cửa hàng quyết định.',
      items: catalog
        .filter(
          (p) =>
            (!query.type || p.type === query.type) &&
            (!q ||
              `${p.name} ${p.merchant} ${p.type}`
                .toLocaleLowerCase('vi')
                .includes(q)),
        )
        .slice(0, 50),
    });
  }
  click(userId: string, id: string, productId: string) {
    return this.repo.record(
      userId,
      id,
      productId,
      (this.config.values.AFFILIATE_PRODUCTS_JSON ?? []).some(
        (p) => p.id === productId,
      ),
    );
  }
}
