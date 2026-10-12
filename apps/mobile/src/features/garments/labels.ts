import type { GarmentCategory, GarmentTags, GarmentType, ModelPhotoAnalysis } from '@stylist/shared';

// Vietnamese labels for the shared enums. Records keyed by the enum make tsc flag any new value.
export const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  top: 'Áo', outerwear: 'Áo khoác', pants: 'Quần', skirt: 'Chân váy', dress: 'Đầm', one_piece: 'Liền thân',
  traditional: 'Truyền thống', shoes: 'Giày', bag: 'Túi', accessory: 'Phụ kiện',
};

export const TYPE_LABEL: Record<GarmentType, string> = {
  shirt: 'Sơ mi', t_shirt: 'Áo thun', blouse: 'Blouse', polo: 'Polo', tank_top: 'Áo ba lỗ', sweater: 'Áo len', hoodie: 'Hoodie', other_top: 'Áo',
  blazer: 'Blazer', jacket: 'Áo khoác', coat: 'Áo măng tô', cardigan: 'Cardigan', vest: 'Gile', other_outerwear: 'Áo khoác',
  jeans: 'Jeans', trousers: 'Quần âu', shorts: 'Quần short', wide_leg: 'Quần ống rộng', leggings: 'Legging', other_pants: 'Quần',
  mini_skirt: 'Chân váy mini', midi_skirt: 'Chân váy midi', maxi_skirt: 'Chân váy maxi', other_skirt: 'Chân váy',
  mini_dress: 'Đầm mini', midi_dress: 'Đầm midi', maxi_dress: 'Đầm maxi', other_dress: 'Đầm',
  jumpsuit: 'Jumpsuit', romper: 'Playsuit', underwear: 'Đồ lót', swimwear: 'Đồ bơi', sleepwear: 'Đồ ngủ', other_one_piece: 'Đồ liền thân',
  ao_dai: 'Áo dài', kimono: 'Kimono', other_traditional: 'Trang phục truyền thống',
  sneakers: 'Sneaker', boots: 'Boots', sandals: 'Sandal', heels: 'Giày cao gót', loafers: 'Loafer', other_shoes: 'Giày',
  crossbody: 'Túi đeo chéo', tote: 'Túi tote', backpack: 'Ba lô', clutch: 'Clutch', other_bag: 'Túi',
  fedora: 'Mũ fedora', cap: 'Mũ lưỡi trai', beanie: 'Mũ len', sunglasses: 'Kính râm', glasses: 'Kính', scarf: 'Khăn', tie: 'Cà vạt',
  belt: 'Thắt lưng', necklace: 'Dây chuyền', earrings: 'Khuyên tai', bracelet: 'Vòng tay', ring: 'Nhẫn', watch: 'Đồng hồ',
};

export const PATTERN_LABEL: Record<GarmentTags['pattern'], string> = {
  solid: 'Trơn', striped: 'Kẻ sọc', checked: 'Ca rô', floral: 'Hoa', graphic: 'Hình in', animal: 'Da thú', other: 'Khác', unknown: 'Chưa rõ',
};
export const FIT_LABEL: Record<GarmentTags['fit'], string> = { slim: 'Ôm', regular: 'Vừa', loose: 'Suông', oversized: 'Rộng', unknown: 'Chưa rõ' };
export const LENGTH_LABEL: Record<NonNullable<GarmentTags['length']>, string> = {
  cropped: 'Crop', short: 'Ngắn', regular: 'Vừa', midi: 'Midi', long: 'Dài', maxi: 'Maxi', unknown: 'Chưa rõ',
};
export const SLEEVE_LABEL: Record<NonNullable<GarmentTags['sleeve']>, string> = {
  sleeveless: 'Không tay', short: 'Tay ngắn', three_quarter: 'Tay lửng', long: 'Tay dài', unknown: 'Chưa rõ',
};
export const RISE_LABEL: Record<NonNullable<GarmentTags['rise']>, string> = { low: 'Cạp thấp', mid: 'Cạp vừa', high: 'Cạp cao', unknown: 'Chưa rõ' };
export const SEASON_LABEL: Record<GarmentTags['season'][number], string> = { spring: 'Xuân', summer: 'Hè', autumn: 'Thu', winter: 'Đông', all: 'Quanh năm' };
export const FORMALITY_LABEL = ['', 'Thể thao, ở nhà', 'Thường ngày', 'Smart casual', 'Công sở', 'Dạ tiệc'];

export const BODY_SHAPE_LABEL: Record<ModelPhotoAnalysis['bodyShape'], string> = {
  hourglass: 'Đồng hồ cát', pear: 'Quả lê', inverted_triangle: 'Tam giác ngược', rectangle: 'Chữ nhật', oval: 'Tròn', unknown: 'Chưa rõ',
};
export const SKIN_TONE_LABEL: Record<ModelPhotoAnalysis['skinTone'], string> = { light: 'Sáng', medium: 'Trung bình', dark: 'Ngăm', unknown: 'Chưa rõ' };
