export type ProductImage = {
  id: bigint;
  image: string;
  is_primary: boolean;
  sort_order: number;
};

export type DefaultProductImage = {
  id: null;
  image: string;
  is_primary: true;
  sort_order: 0;
  is_placeholder: true;
};

export function withDefaultProductImages<T extends { images: ProductImage[] }>(
  products: T[],
  defaultImageUrl: string,
): Array<Omit<T, "images"> & { images: Array<ProductImage | DefaultProductImage> }> {
  return products.map((product) => {
    const images = product.images.filter((image) => image.image.trim().length > 0);

    return {
      ...product,
      images: images.length > 0
        ? images
        : [{
            id: null,
            image: defaultImageUrl,
            is_primary: true,
            sort_order: 0,
            is_placeholder: true,
          }],
    };
  });
}
