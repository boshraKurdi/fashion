import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
  ShopStatus,
  ShopBranchStatus,
  ProductStatus,
  OfferDiscountType,
  OfferStatus,
  ReviewStatus,
  ShopSubscriptionStatus,
  CartStatus,
  OrderStatus,
  PaymentStatus,
  OrderPaymentStatus,
  SubscriptionPlanDurationUnit,
} from "@prisma/client";

function getMariaDbConfig(connectionString: string) {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL");
  }

  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// protocol");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL must include a MySQL host and database name");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 10,
  };
}

const adapter = new PrismaMariaDb(getMariaDbConfig(process.env.DATABASE_URL ?? "mysql://root@localhost:3306/fashion_marketplace"));
const prisma = new PrismaClient({ adapter });

const money = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(String(value));
};

async function upsertUser(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone ?? null,
      password: input.password,
      role: input.role,
      status: input.status,
    },
    create: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      password: input.password,
      role: input.role,
      status: input.status,
    },
  });
}

async function upsertCategory(input: {
  name: string;
  slug: string;
  parentSlug?: string;
  image?: string;
  status?: number;
}) {
  const parent = input.parentSlug
    ? await prisma.category.findUnique({ where: { slug: input.parentSlug } })
    : null;

  return prisma.category.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      parent_id: parent?.id ?? null,
      image: input.image ?? null,
      status: input.status ?? 1,
    },
    create: {
      name: input.name,
      slug: input.slug,
      parent_id: parent?.id ?? null,
      image: input.image ?? null,
      status: input.status ?? 1,
    },
  });
}

async function upsertBrand(input: { name: string; logo?: string; status?: number }) {
  return prisma.brand.upsert({
    where: { name: input.name },
    update: {
      logo: input.logo ?? null,
      status: input.status ?? 1,
    },
    create: {
      name: input.name,
      logo: input.logo ?? null,
      status: input.status ?? 1,
    },
  });
}

async function upsertColor(input: { name: string; hex_code?: string }) {
  return prisma.color.upsert({
    where: { name: input.name },
    update: { hex_code: input.hex_code ?? null },
    create: { name: input.name, hex_code: input.hex_code ?? null },
  });
}

async function upsertSize(input: { name: string; type?: string | null }) {
  return prisma.size.upsert({
    where: {
      name_type: {
        name: input.name,
        type: input.type ?? null,
      },
    },
    update: {},
    create: {
      name: input.name,
      type: input.type ?? null,
    },
  });
}

async function upsertShop(input: {
  ownerEmail: string;
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  phone?: string;
  email?: string;
  status: ShopStatus;
}) {
  const owner = await prisma.user.findUnique({ where: { email: input.ownerEmail } });

  if (!owner) {
    throw new Error(`Owner not found: ${input.ownerEmail}`);
  }

  const existing = await prisma.shop.findFirst({
    where: {
      owner_id: owner.id,
      name: input.name,
    },
  });

  if (existing) {
    return prisma.shop.update({
      where: { id: existing.id },
      data: {
        description: input.description ?? existing.description,
        logo: input.logo ?? existing.logo,
        cover_image: input.coverImage ?? existing.cover_image,
        phone: input.phone ?? existing.phone,
        email: input.email ?? existing.email,
        status: input.status,
      },
    });
  }

  return prisma.shop.create({
    data: {
      owner_id: owner.id,
      name: input.name,
      description: input.description ?? null,
      logo: input.logo ?? null,
      cover_image: input.coverImage ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      status: input.status,
    },
  });
}

async function upsertBranch(input: {
  shopName: string;
  ownerEmail: string;
  name: string;
  address: string;
  phone?: string;
  city: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  status: ShopBranchStatus;
}) {
  const shop = await prisma.shop.findFirst({
    where: {
      owner: { email: input.ownerEmail },
      name: input.shopName,
    },
  });

  if (!shop) {
    throw new Error(`Shop not found: ${input.shopName}`);
  }

  return prisma.shopBranch.upsert({
    where: {
      id: (await prisma.shopBranch.findFirst({
        where: { shop_id: shop.id, name: input.name, address: input.address },
        select: { id: true },
      }))?.id ?? -1,
    },
    update: {
      phone: input.phone ?? null,
      city: input.city,
      area: input.area ?? null,
      latitude: input.latitude !== undefined ? new Prisma.Decimal(input.latitude.toString()) : null,
      longitude: input.longitude !== undefined ? new Prisma.Decimal(input.longitude.toString()) : null,
      status: input.status,
    },
    create: {
      shop_id: shop.id,
      name: input.name,
      address: input.address,
      phone: input.phone ?? null,
      city: input.city,
      area: input.area ?? null,
      latitude: input.latitude !== undefined ? new Prisma.Decimal(input.latitude.toString()) : null,
      longitude: input.longitude !== undefined ? new Prisma.Decimal(input.longitude.toString()) : null,
      status: input.status,
    },
  });
}

async function upsertProduct(input: {
  shopName: string;
  ownerEmail: string;
  categorySlug: string;
  brandName?: string;
  name: string;
  description?: string;
  price: string | number;
  salePrice?: string | number;
  status: ProductStatus;
}) {
  const shop = await prisma.shop.findFirst({
    where: {
      owner: { email: input.ownerEmail },
      name: input.shopName,
    },
  });

  if (!shop) {
    throw new Error(`Shop not found: ${input.shopName}`);
  }

  const category = await prisma.category.findUnique({ where: { slug: input.categorySlug } });

  if (!category) {
    throw new Error(`Category not found: ${input.categorySlug}`);
  }

  const brand = input.brandName ? await upsertBrand({ name: input.brandName }) : null;

  return prisma.product.upsert({
    where: {
      id: (await prisma.product.findFirst({
        where: { shop_id: shop.id, name: input.name, category_id: category.id },
        select: { id: true },
      }))?.id ?? -1,
    },
    update: {
      description: input.description ?? null,
      price: money(input.price),
      sale_price: input.salePrice !== undefined ? money(input.salePrice) : null,
      status: input.status,
      brand_id: brand?.id ?? null,
    },
    create: {
      shop_id: shop.id,
      category_id: category.id,
      brand_id: brand?.id ?? null,
      name: input.name,
      description: input.description ?? null,
      price: money(input.price),
      sale_price: input.salePrice !== undefined ? money(input.salePrice) : null,
      status: input.status,
    },
  });
}

async function upsertImage(productName: string, shopName: string, ownerEmail: string, image: string, isPrimary = false, sortOrder = 0) {
  const product = await prisma.product.findFirst({
    where: {
      shop: { owner: { email: ownerEmail }, name: shopName },
      name: productName,
    },
    select: { id: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productName}`);
  }

  return prisma.productImage.create({
    data: {
      product_id: product.id,
      image,
      is_primary: isPrimary,
      sort_order: sortOrder,
    },
  });
}

async function upsertVariant(input: {
  productName: string;
  shopName: string;
  ownerEmail: string;
  colorName?: string;
  sizeName?: string;
  sizeType?: string | null;
  price?: string | number;
  salePrice?: string | number;
  sku?: string;
}) {
  const product = await prisma.product.findFirst({
    where: {
      shop: { owner: { email: input.ownerEmail }, name: input.shopName },
      name: input.productName,
    },
    select: { id: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productName}`);
  }

  const color = input.colorName ? await upsertColor({ name: input.colorName }) : null;
  const size = input.sizeName ? await upsertSize({ name: input.sizeName, type: input.sizeType ?? null }) : null;

  return prisma.productVariant.upsert({
    where: {
      sku: input.sku ?? "__seed_no_sku__",
    },
    update: {
      color_id: color?.id ?? null,
      size_id: size?.id ?? null,
      price: input.price !== undefined ? money(input.price) : null,
      sale_price: input.salePrice !== undefined ? money(input.salePrice) : null,
    },
    create: {
      product_id: product.id,
      color_id: color?.id ?? null,
      size_id: size?.id ?? null,
      price: input.price !== undefined ? money(input.price) : null,
      sale_price: input.salePrice !== undefined ? money(input.salePrice) : null,
      sku: input.sku ?? null,
    },
  });
}

async function upsertOffer(input: {
  shopName: string;
  ownerEmail: string;
  title: string;
  description?: string;
  image?: string;
  discountType: OfferDiscountType;
  discountValue: string | number;
  startAt: Date;
  endAt: Date;
  status: OfferStatus;
}) {
  const shop = await prisma.shop.findFirst({
    where: {
      owner: { email: input.ownerEmail },
      name: input.shopName,
    },
  });

  if (!shop) {
    throw new Error(`Shop not found: ${input.shopName}`);
  }

  return prisma.offer.upsert({
    where: {
      id: (await prisma.offer.findFirst({
        where: { shop_id: shop.id, title: input.title },
        select: { id: true },
      }))?.id ?? -1,
    },
    update: {
      description: input.description ?? null,
      image: input.image ?? null,
      discount_type: input.discountType,
      discount_value: money(input.discountValue),
      start_at: input.startAt,
      end_at: input.endAt,
      status: input.status,
    },
    create: {
      shop_id: shop.id,
      title: input.title,
      description: input.description ?? null,
      image: input.image ?? null,
      discount_type: input.discountType,
      discount_value: money(input.discountValue),
      start_at: input.startAt,
      end_at: input.endAt,
      status: input.status,
    },
  });
}

async function attachOfferProduct(offerTitle: string, shopName: string, ownerEmail: string, productName: string) {
  const offer = await prisma.offer.findFirst({
    where: { shop: { owner: { email: ownerEmail }, name: shopName }, title: offerTitle },
    select: { id: true },
  });

  const product = await prisma.product.findFirst({
    where: {
      shop: { owner: { email: ownerEmail }, name: shopName },
      name: productName,
    },
    select: { id: true },
  });

  if (!offer || !product) {
    throw new Error(`Offer/product not found: ${offerTitle}/${productName}`);
  }

  return prisma.offerProduct.upsert({
    where: {
      offer_id_product_id: { offer_id: offer.id, product_id: product.id },
    },
    update: {},
    create: {
      offer_id: offer.id,
      product_id: product.id,
    },
  });
}

async function createReview(input: {
  customerEmail: string;
  shopName: string;
  rating: number;
  comment?: string;
  status: ReviewStatus;
}) {
  const user = await prisma.user.findUnique({ where: { email: input.customerEmail } });
  const shop = await prisma.shop.findFirst({ where: { name: input.shopName } });

  if (!user || !shop) {
    throw new Error(`User or shop not found for review: ${input.customerEmail}/${input.shopName}`);
  }

  const order = await prisma.order.findFirst({
    where: {
      user_id: user.id,
      shop_id: shop.id,
    },
    orderBy: { created_at: "desc" },
  });

  if (!order) {
    throw new Error(`Order not found for review: ${input.customerEmail}/${input.shopName}`);
  }

  return prisma.shopReview.upsert({
    where: {
      user_id_order_id: {
        user_id: user.id,
        order_id: order.id,
      },
    },
    update: {
      rating: input.rating,
      comment: input.comment ?? null,
      status: input.status,
    },
    create: {
      user_id: user.id,
      shop_id: shop.id,
      order_id: order.id,
      rating: input.rating,
      comment: input.comment ?? null,
      status: input.status,
    },
  });
}

async function main() {
  const now = new Date();

  const users = [
    { name: "Admin User", email: "admin@fashionmarket.test", password: "AdminPass1!", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    { name: "Omar Shop Owner", email: "omar@fashionmarket.test", password: "ShopPass1!", role: UserRole.SHOP_OWNER, status: UserStatus.ACTIVE },
    { name: "Lina Shop Owner", email: "lina@fashionmarket.test", password: "ShopPass1!", role: UserRole.SHOP_OWNER, status: UserStatus.ACTIVE },
    { name: "Noura Customer", email: "noura@fashionmarket.test", password: "CustomerPass1!", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    { name: "Salem Customer", email: "salem@fashionmarket.test", password: "CustomerPass1!", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
  ] as const;

  for (const user of users) {
    await upsertUser({ ...user, password: user.password });
  }

  const categories = [
    { name: "Women", slug: "women" },
    { name: "Men", slug: "men" },
    { name: "Accessories", slug: "accessories" },
    { name: "Dresses", slug: "dresses", parentSlug: "women" },
    { name: "Jackets", slug: "jackets", parentSlug: "women" },
    { name: "Shoes", slug: "shoes", parentSlug: "women" },
    { name: "Formal", slug: "formal", parentSlug: "men" },
    { name: "Casual", slug: "casual", parentSlug: "men" },
    { name: "Bags", slug: "bags", parentSlug: "accessories" },
  ];

  for (const category of categories) {
    await upsertCategory(category);
  }

  const brands = [
    { name: "Aurelia", logo: "https://example.com/logos/aurelia.png" },
    { name: "Urban Thread", logo: "https://example.com/logos/urban-thread.png" },
    { name: "Veloura", logo: "https://example.com/logos/veloura.png" },
    { name: "Nexa", logo: "https://example.com/logos/nexa.png" },
    { name: "Horizon", logo: "https://example.com/logos/horizon.png" },
  ];

  for (const brand of brands) {
    await upsertBrand(brand);
  }

  const colors = [
    { name: "Black", hex_code: "#111111" },
    { name: "White", hex_code: "#FFFFFF" },
    { name: "Navy", hex_code: "#1F3A5F" },
    { name: "Beige", hex_code: "#D9C8A9" },
    { name: "Red", hex_code: "#D62828" },
  ];

  for (const color of colors) {
    await upsertColor(color);
  }

  const sizes = [
    { name: "S", type: "Clothing" },
    { name: "M", type: "Clothing" },
    { name: "L", type: "Clothing" },
    { name: "XL", type: "Clothing" },
    { name: "36", type: "Shoes" },
    { name: "38", type: "Shoes" },
    { name: "40", type: "Shoes" },
    { name: "42", type: "Shoes" },
  ];

  for (const size of sizes) {
    await upsertSize(size);
  }

  const shops = [
    {
      ownerEmail: "omar@fashionmarket.test",
      name: "Aurelia Studio",
      description: "Modern luxury fashion for everyday elegance.",
      logo: "https://example.com/shops/aurelia-logo.png",
      coverImage: "https://example.com/shops/aurelia-cover.jpg",
      phone: "+966500112233",
      email: "hello@aurelia.test",
      status: ShopStatus.APPROVED,
    },
    {
      ownerEmail: "lina@fashionmarket.test",
      name: "Veloura House",
      description: "Streetwear essentials designed for movement.",
      logo: "https://example.com/shops/veloura-logo.png",
      coverImage: "https://example.com/shops/veloura-cover.jpg",
      phone: "+966500445566",
      email: "hello@veloura.test",
      status: ShopStatus.APPROVED,
    },
  ] as const;

  for (const shop of shops) {
    await upsertShop(shop);
  }

  const branches = [
    {
      shopName: "Aurelia Studio",
      ownerEmail: "omar@fashionmarket.test",
      name: "Aurelia Riyadh",
      address: "King Fahad Road, Riyadh",
      phone: "+966500112233",
      city: "Riyadh",
      area: "Al Olaya",
      latitude: 24.6877,
      longitude: 46.7219,
      status: ShopBranchStatus.ACTIVE,
    },
    {
      shopName: "Veloura House",
      ownerEmail: "lina@fashionmarket.test",
      name: "Veloura Jeddah",
      address: "Tahlia Street, Jeddah",
      phone: "+966500445566",
      city: "Jeddah",
      area: "Tahlia",
      latitude: 21.5424,
      longitude: 39.1721,
      status: ShopBranchStatus.ACTIVE,
    },
  ] as const;

  for (const branch of branches) {
    await upsertBranch(branch);
  }

  const products = [
    {
      shopName: "Aurelia Studio",
      ownerEmail: "omar@fashionmarket.test",
      categorySlug: "dresses",
      brandName: "Aurelia",
      name: "Silk Evening Dress",
      description: "Lightweight silk dress for evening events.",
      price: 420,
      salePrice: 350,
      status: ProductStatus.ACTIVE,
    },
    {
      shopName: "Aurelia Studio",
      ownerEmail: "omar@fashionmarket.test",
      categorySlug: "jackets",
      brandName: "Aurelia",
      name: "Structured Blazer",
      description: "Tailored blazer with soft lining and premium finish.",
      price: 390,
      salePrice: 320,
      status: ProductStatus.ACTIVE,
    },
    {
      shopName: "Veloura House",
      ownerEmail: "lina@fashionmarket.test",
      categorySlug: "casual",
      brandName: "Urban Thread",
      name: "City Core Hoodie",
      description: "Relaxed everyday hoodie in heavyweight cotton blend.",
      price: 250,
      salePrice: 210,
      status: ProductStatus.ACTIVE,
    },
    {
      shopName: "Veloura House",
      ownerEmail: "lina@fashionmarket.test",
      categorySlug: "shoes",
      brandName: "Nexa",
      name: "Everyday Runner",
      description: "Comfort-focused running shoe with flexible cushioning.",
      price: 320,
      salePrice: 280,
      status: ProductStatus.ACTIVE,
    },
    {
      shopName: "Aurelia Studio",
      ownerEmail: "omar@fashionmarket.test",
      categorySlug: "bags",
      brandName: "Veloura",
      name: "Classic Leather Tote",
      description: "Structured tote for office and travel needs.",
      price: 470,
      salePrice: null,
      status: ProductStatus.ACTIVE,
    },
  ] as const;

  for (const product of products) {
    await upsertProduct(product as any);
  }

  const productImages = [
    { shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", productName: "Silk Evening Dress", image: "https://example.com/products/dress-1.jpg", primary: true, sortOrder: 1 },
    { shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", productName: "Silk Evening Dress", image: "https://example.com/products/dress-2.jpg", primary: false, sortOrder: 2 },
    { shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", productName: "Structured Blazer", image: "https://example.com/products/blazer-1.jpg", primary: true, sortOrder: 1 },
    { shopName: "Veloura House", ownerEmail: "lina@fashionmarket.test", productName: "City Core Hoodie", image: "https://example.com/products/hoodie-1.jpg", primary: true, sortOrder: 1 },
    { shopName: "Veloura House", ownerEmail: "lina@fashionmarket.test", productName: "Everyday Runner", image: "https://example.com/products/runner-1.jpg", primary: true, sortOrder: 1 },
    { shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", productName: "Classic Leather Tote", image: "https://example.com/products/tote-1.jpg", primary: true, sortOrder: 1 },
  ] as const;

  for (const item of productImages) {
    await upsertImage(item.productName, item.shopName, item.ownerEmail, item.image, item.primary, item.sortOrder);
  }

  const productVariants = [
    { productName: "Silk Evening Dress", shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", colorName: "Black", sizeName: "S", sizeType: "Clothing", price: 420, salePrice: 350, sku: "AED-001-BLK-S" },
    { productName: "Silk Evening Dress", shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", colorName: "Navy", sizeName: "M", sizeType: "Clothing", price: 420, salePrice: 350, sku: "AED-001-NVY-M" },
    { productName: "Structured Blazer", shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", colorName: "Beige", sizeName: "L", sizeType: "Clothing", price: 390, salePrice: 320, sku: "ABZ-010-BEI-L" },
    { productName: "City Core Hoodie", shopName: "Veloura House", ownerEmail: "lina@fashionmarket.test", colorName: "Black", sizeName: "M", sizeType: "Clothing", price: 250, salePrice: 210, sku: "VCH-220-BLK-M" },
    { productName: "Everyday Runner", shopName: "Veloura House", ownerEmail: "lina@fashionmarket.test", colorName: "White", sizeName: "40", sizeType: "Shoes", price: 320, salePrice: 280, sku: "VER-330-WHT-40" },
  ] as const;

  for (const variant of productVariants) {
    await upsertVariant(variant as any);
  }

  const subscriptionPlans = [
    {
      name: "Starter Plan",
      description: "Great for new shops launching online.",
      price: 149,
      duration: 1,
      duration_unit: SubscriptionPlanDurationUnit.MONTH,
      features: ["Store listing", "Basic analytics", "Support access"],
      status: 1,
    },
    {
      name: "Growth Plan",
      description: "For growing storefronts and promotions.",
      price: 349,
      duration: 3,
      duration_unit: SubscriptionPlanDurationUnit.MONTH,
      features: ["Priority placement", "Campaign tools", "Advanced analytics"],
      status: 1,
    },
  ] as const;

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: (await prisma.subscriptionPlan.findFirst({ where: { name: plan.name }, select: { id: true } }))?.id ?? -1 },
      update: {
        description: plan.description,
        price: money(plan.price),
        duration: plan.duration,
        duration_unit: plan.duration_unit,
        features: plan.features as Prisma.InputJsonValue,
        status: plan.status,
      },
      create: {
        name: plan.name,
        description: plan.description,
        price: money(plan.price),
        duration: plan.duration,
        duration_unit: plan.duration_unit,
        features: plan.features as Prisma.InputJsonValue,
        status: plan.status,
      },
    });
  }

  const offers = [
    {
      shopName: "Aurelia Studio",
      ownerEmail: "omar@fashionmarket.test",
      title: "Weekend Luxe",
      description: "Save extra on selected premium pieces.",
      image: "https://example.com/offers/weekend-luxe.jpg",
      discountType: OfferDiscountType.PERCENTAGE,
      discountValue: 15,
      startAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
      endAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 20),
      status: OfferStatus.ACTIVE,
    },
    {
      shopName: "Veloura House",
      ownerEmail: "lina@fashionmarket.test",
      title: "Spring Moves",
      description: "Fresh styles for everyday comfort.",
      image: "https://example.com/offers/spring-moves.jpg",
      discountType: OfferDiscountType.FIXED_AMOUNT,
      discountValue: 35,
      startAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      endAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
      status: OfferStatus.ACTIVE,
    },
  ] as const;

  for (const offer of offers) {
    await upsertOffer(offer as any);
  }

  await attachOfferProduct("Weekend Luxe", "Aurelia Studio", "omar@fashionmarket.test", "Silk Evening Dress");
  await attachOfferProduct("Weekend Luxe", "Aurelia Studio", "omar@fashionmarket.test", "Structured Blazer");
  await attachOfferProduct("Spring Moves", "Veloura House", "lina@fashionmarket.test", "City Core Hoodie");

  const addresses = [
    { userEmail: "noura@fashionmarket.test", title: "Home", recipient_name: "Noura", phone: "+966500123456", city: "Riyadh", area: "Al Malqa", address: "Street 12, House 4" },
    { userEmail: "salem@fashionmarket.test", title: "Work", recipient_name: "Salem", phone: "+966500654321", city: "Jeddah", area: "Al Andalus", address: "King Road, Office Block" },
  ] as const;

  for (const address of addresses) {
    const user = await prisma.user.findUnique({ where: { email: address.userEmail } });
    if (!user) continue;

    await prisma.address.upsert({
      where: { id: (await prisma.address.findFirst({ where: { user_id: user.id, recipient_name: address.recipient_name }, select: { id: true } }))?.id ?? -1 },
      update: {
        title: address.title,
        phone: address.phone,
        city: address.city,
        area: address.area,
        address: address.address,
        is_default: true,
      },
      create: {
        user_id: user.id,
        title: address.title,
        recipient_name: address.recipient_name,
        phone: address.phone,
        city: address.city,
        area: address.area,
        address: address.address,
        is_default: true,
      },
    });
  }

  const customerUser = await prisma.user.findUnique({ where: { email: "noura@fashionmarket.test" } });
  const shopForOrders = await prisma.shop.findFirst({ where: { name: "Aurelia Studio" } });
  const velouraShop = await prisma.shop.findFirst({ where: { name: "Veloura House" } });
  const salemUser = await prisma.user.findUnique({ where: { email: "salem@fashionmarket.test" } });

  if (customerUser && shopForOrders) {
    const orderNumber = "ORD-10001";
    const existingOrder = await prisma.order.findUnique({ where: { order_number: orderNumber } });

    if (!existingOrder) {
      const order = await prisma.order.create({
        data: {
          user_id: customerUser.id,
          shop_id: shopForOrders.id,
          order_number: orderNumber,
          subtotal: money(420),
          delivery_fee: money(20),
          discount: money(35),
          total: money(405),
          status: OrderStatus.DELIVERED,
          payment_status: OrderPaymentStatus.PAID,
          shipping_recipient_name: "Noura",
          shipping_phone: "+966500123456",
          shipping_city: "Riyadh",
          shipping_area: "Al Malqa",
          shipping_address: "Street 12, House 4",
        },
      });

      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: (await prisma.product.findFirst({ where: { name: "Silk Evening Dress", shop_id: shopForOrders.id }, select: { id: true } }))?.id,
          product_name: "Silk Evening Dress",
          product_image: "https://example.com/products/dress-1.jpg",
          variant_description: "Black / S",
          quantity: 1,
          unit_price: money(420),
          total: money(420),
        },
      });

      await prisma.payment.create({
        data: {
          order_id: order.id,
          amount: money(405),
          method: "CARD",
          transaction_id: "txn_test_1001",
          status: PaymentStatus.COMPLETED,
          paid_at: new Date(),
        },
      });
    }
  }

  if (salemUser && velouraShop) {
    const orderNumber = "ORD-10002";
    const existingOrder = await prisma.order.findUnique({ where: { order_number: orderNumber } });

    if (!existingOrder) {
      const order = await prisma.order.create({
        data: {
          user_id: salemUser.id,
          shop_id: velouraShop.id,
          order_number: orderNumber,
          subtotal: money(250),
          delivery_fee: money(15),
          discount: money(20),
          total: money(245),
          status: OrderStatus.DELIVERED,
          payment_status: OrderPaymentStatus.PAID,
          shipping_recipient_name: "Salem",
          shipping_phone: "+966500654321",
          shipping_city: "Jeddah",
          shipping_area: "Al Andalus",
          shipping_address: "King Road, Office Block",
        },
      });

      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: (await prisma.product.findFirst({ where: { name: "City Core Hoodie", shop_id: velouraShop.id }, select: { id: true } }))?.id,
          product_name: "City Core Hoodie",
          product_image: "https://example.com/products/hoodie-1.jpg",
          variant_description: "Black / M",
          quantity: 1,
          unit_price: money(250),
          total: money(250),
        },
      });

      await prisma.payment.create({
        data: {
          order_id: order.id,
          amount: money(245),
          method: "CARD",
          transaction_id: "txn_test_1002",
          status: PaymentStatus.COMPLETED,
          paid_at: new Date(),
        },
      });
    }
  }

  await createReview({ customerEmail: "noura@fashionmarket.test", shopName: "Aurelia Studio", rating: 5, comment: "Beautiful packaging and excellent service.", status: ReviewStatus.APPROVED });
  await createReview({ customerEmail: "salem@fashionmarket.test", shopName: "Veloura House", rating: 4, comment: "Quality is good and delivery was fast.", status: ReviewStatus.APPROVED });

  const shopSubscriptionOwner = await prisma.user.findUnique({ where: { email: "omar@fashionmarket.test" } });
  const starterPlan = await prisma.subscriptionPlan.findFirst({ where: { name: "Starter Plan" } });
  const shopToSubscribe = await prisma.shop.findFirst({ where: { owner_id: shopSubscriptionOwner!.id, name: "Aurelia Studio" } });

  if (shopSubscriptionOwner && starterPlan && shopToSubscribe) {
    await prisma.shopSubscription.upsert({
      where: { id: (await prisma.shopSubscription.findFirst({ where: { shop_id: shopToSubscribe.id, plan_id: starterPlan.id }, select: { id: true } }))?.id ?? -1 },
      update: {
        start_at: new Date(),
        end_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        price: money(149),
        status: ShopSubscriptionStatus.ACTIVE,
      },
      create: {
        shop_id: shopToSubscribe.id,
        plan_id: starterPlan.id,
        start_at: new Date(),
        end_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        price: money(149),
        status: ShopSubscriptionStatus.ACTIVE,
      },
    });
  }

  const favoriteProducts = [
    { productName: "Silk Evening Dress", shopName: "Aurelia Studio", ownerEmail: "omar@fashionmarket.test", userEmail: "noura@fashionmarket.test" },
    { productName: "Everyday Runner", shopName: "Veloura House", ownerEmail: "lina@fashionmarket.test", userEmail: "salem@fashionmarket.test" },
  ] as const;

  for (const favorite of favoriteProducts) {
    const user = await prisma.user.findUnique({ where: { email: favorite.userEmail } });
    const product = await prisma.product.findFirst({
      where: {
        shop: { owner: { email: favorite.ownerEmail }, name: favorite.shopName },
        name: favorite.productName,
      },
      select: { id: true },
    });

    if (user && product) {
      await prisma.favorite.upsert({
        where: {
          user_id_product_id: { user_id: user.id, product_id: product.id },
        },
        update: {},
        create: {
          user_id: user.id,
          product_id: product.id,
        },
      });
    }
  }

  const carts = [
    { userEmail: "noura@fashionmarket.test", status: CartStatus.ACTIVE },
    { userEmail: "salem@fashionmarket.test", status: CartStatus.ACTIVE },
  ] as const;

  for (const cartItem of carts) {
    const user = await prisma.user.findUnique({ where: { email: cartItem.userEmail } });
    if (!user) continue;

    const cart = await prisma.cart.upsert({
      where: { id: (await prisma.cart.findFirst({ where: { user_id: user.id }, select: { id: true } }))?.id ?? -1 },
      update: { status: cartItem.status },
      create: {
        user_id: user.id,
        status: cartItem.status,
      },
    });

    const product = await prisma.product.findFirst({ where: { name: "Silk Evening Dress", shop: { owner: { email: "omar@fashionmarket.test" } } } });
    if (product) {
      await prisma.cartItem.upsert({
        where: { id: (await prisma.cartItem.findFirst({ where: { cart_id: cart.id, product_id: product.id }, select: { id: true } }))?.id ?? -1 },
        update: { quantity: 1, price: product.price },
        create: {
          cart_id: cart.id,
          product_id: product.id,
          quantity: 1,
          price: product.price,
        },
      });
    }
  }

  console.log("Database seeded successfully with sample data.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
