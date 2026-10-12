import "dotenv/config";
import { SYSTEM_ROLES } from "../src/shared/permissions";
import { slugify } from "../src/shared/slug";
import { LEGAL_PAGE_TEMPLATES } from "./legal-pages";
import {
  createPrismaClient,
  type PrismaClient,
} from "../src/shared/prisma-client";

async function seedRoles(db: PrismaClient): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    const saved = await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    await db.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await db.rolePermission.createMany({
      data: role.permissions.map((permission) => ({
        roleId: saved.id,
        permission,
      })),
    });
  }
}

async function seedCustomerGroups(db: PrismaClient): Promise<void> {
  const groups = [
    { name: "Bayi", slug: "bayi", discountPercent: 20 },
    { name: "Toptan", slug: "toptan", discountPercent: 30 },
  ];

  for (const group of groups) {
    await db.customerGroup.upsert({
      where: { slug: group.slug },
      update: {},
      create: group,
    });
  }
}

interface DemoProduct {
  name: string;
  slug: string;
  category: string;
  brand: string;
  description: string;
  basePrice: number;
  featured?: boolean;
  fabric?: string;
  season?: string;
  colors?: string[];
  sizes?: string[];
  compareAtPrice?: number;
}

const DEMO_CATEGORIES = [
  { name: "Giyim", slug: "giyim", parent: null },
  { name: "Erkek", slug: "erkek-giyim", parent: "giyim" },
  { name: "Kadın", slug: "kadin-giyim", parent: "giyim" },
  { name: "Ayakkabı", slug: "ayakkabi", parent: null },
  { name: "Aksesuar", slug: "aksesuar", parent: null },
] as const;

const DEMO_BRANDS = ["Demo Marka", "Nordik", "Atlas"];

const DEMO_ATTRIBUTES = [
  {
    name: "Kumaş",
    slug: "kumas",
    values: ["Pamuk", "Keten", "Yün", "Polyester"],
  },
  { name: "Sezon", slug: "sezon", values: ["Yaz", "Kış", "Dört mevsim"] },
];

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "Basic Tişört",
    slug: "basic-tisort",
    category: "erkek-giyim",
    brand: "Demo Marka",
    description: "Günlük kullanım için yumuşak dokulu basic tişört.",
    basePrice: 299.9,
    featured: true,
    fabric: "pamuk",
    season: "yaz",
    colors: ["Siyah", "Beyaz"],
    sizes: ["S", "M", "L"],
  },
  {
    name: "Keten Gömlek",
    slug: "keten-gomlek",
    category: "erkek-giyim",
    brand: "Nordik",
    description: "Nefes alan keten kumaştan uzun kollu gömlek.",
    basePrice: 649.9,
    featured: true,
    fabric: "keten",
    season: "yaz",
    colors: ["Bej", "Mavi"],
    sizes: ["M", "L", "XL"],
    compareAtPrice: 799.9,
  },
  {
    name: "Yün Kazak",
    slug: "yun-kazak",
    category: "kadin-giyim",
    brand: "Atlas",
    description: "Kış aylarında sıcak tutan yün karışımlı kazak.",
    basePrice: 899.9,
    featured: true,
    fabric: "yun",
    season: "kis",
    colors: ["Gri", "Bordo"],
    sizes: ["S", "M"],
  },
  {
    name: "Pamuklu Elbise",
    slug: "pamuklu-elbise",
    category: "kadin-giyim",
    brand: "Nordik",
    description: "Yazlık, rahat kesim pamuklu elbise.",
    basePrice: 749.9,
    fabric: "pamuk",
    season: "yaz",
    colors: ["Beyaz", "Lacivert"],
    sizes: ["S", "M", "L"],
  },
  {
    name: "Polar Sweatshirt",
    slug: "polar-sweatshirt",
    category: "erkek-giyim",
    brand: "Atlas",
    description: "İçi polar astarlı kapüşonlu sweatshirt.",
    basePrice: 549.9,
    fabric: "polyester",
    season: "kis",
    colors: ["Siyah", "Gri"],
    sizes: ["M", "L", "XL"],
  },
  {
    name: "Deri Sneaker",
    slug: "deri-sneaker",
    category: "ayakkabi",
    brand: "Demo Marka",
    description: "Hakiki deri, şık günlük spor ayakkabı.",
    basePrice: 1499.9,
    featured: true,
    season: "dort-mevsim",
    colors: ["Beyaz", "Siyah"],
    sizes: ["40", "41", "42", "43"],
    compareAtPrice: 1799.9,
  },
  {
    name: "Kanvas Ayakkabı",
    slug: "kanvas-ayakkabi",
    category: "ayakkabi",
    brand: "Nordik",
    description: "Hafif kanvas yapıda bağcıklı ayakkabı.",
    basePrice: 599.9,
    fabric: "pamuk",
    season: "yaz",
    colors: ["Lacivert"],
    sizes: ["39", "40", "41", "42"],
  },
  {
    name: "Deri Cüzdan",
    slug: "deri-cuzdan",
    category: "aksesuar",
    brand: "Atlas",
    description: "Kartlık bölmeli, kompakt deri cüzdan.",
    basePrice: 399.9,
    season: "dort-mevsim",
    colors: ["Kahve", "Siyah"],
  },
  {
    name: "Yün Atkı",
    slug: "yun-atki",
    category: "aksesuar",
    brand: "Nordik",
    description: "Uzun, yumuşak dokulu yün atkı.",
    basePrice: 249.9,
    fabric: "yun",
    season: "kis",
    colors: ["Gri", "Kırmızı"],
  },
  {
    name: "Güneş Gözlüğü",
    slug: "gunes-gozlugu",
    category: "aksesuar",
    brand: "Demo Marka",
    description: "UV korumalı, klasik çerçeveli güneş gözlüğü.",
    basePrice: 459.9,
    season: "yaz",
    colors: ["Siyah"],
  },
];

async function seedDemoCatalog(db: PrismaClient): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const [index, category] of DEMO_CATEGORIES.entries()) {
    const saved = await db.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: index,
        parentId: category.parent ? categoryIds.get(category.parent) : null,
      },
    });
    categoryIds.set(category.slug, saved.id);
  }

  const brandIds = new Map<string, string>();
  for (const name of DEMO_BRANDS) {
    const saved = await db.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brandIds.set(name, saved.id);
  }

  const attributeValueIds = new Map<string, string>();
  for (const [position, attribute] of DEMO_ATTRIBUTES.entries()) {
    const saved = await db.attribute.upsert({
      where: { slug: attribute.slug },
      update: {},
      create: { name: attribute.name, slug: attribute.slug, position },
    });
    for (const [valuePosition, value] of attribute.values.entries()) {
      const valueSlug = slugify(value);
      const savedValue = await db.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: saved.id, slug: valueSlug } },
        update: {},
        create: {
          attributeId: saved.id,
          value,
          slug: valueSlug,
          position: valuePosition,
        },
      });
      attributeValueIds.set(`${attribute.slug}:${valueSlug}`, savedValue.id);
    }
  }

  for (const demo of DEMO_PRODUCTS) {
    const exists = await db.product.findUnique({ where: { slug: demo.slug } });
    if (exists) continue;

    const attributeLinks = [
      demo.fabric ? attributeValueIds.get(`kumas:${demo.fabric}`) : undefined,
      demo.season ? attributeValueIds.get(`sezon:${demo.season}`) : undefined,
    ].filter((id): id is string => id !== undefined);

    const options = [
      demo.colors ? { name: "Renk", values: demo.colors } : null,
      demo.sizes ? { name: "Beden", values: demo.sizes } : null,
    ].filter(
      (option): option is { name: string; values: string[] } => option !== null,
    );

    const product = await db.product.create({
      data: {
        name: demo.name,
        slug: demo.slug,
        description: demo.description,
        status: "ACTIVE",
        isFeatured: demo.featured ?? false,
        categoryId: categoryIds.get(demo.category)!,
        brandId: brandIds.get(demo.brand)!,
        attributes: {
          create: attributeLinks.map((attributeValueId) => ({
            attributeValueId,
          })),
        },
        options: {
          create: options.map((option, position) => ({
            name: option.name,
            position,
            values: {
              create: option.values.map((value, valuePosition) => ({
                value,
                position: valuePosition,
              })),
            },
          })),
        },
      },
      include: { options: { include: { values: true } } },
    });

    const axes = product.options
      .sort((a, b) => a.position - b.position)
      .map((option) => option.values.sort((a, b) => a.position - b.position));

    const combinations = axes.reduce<{ id: string; value: string }[][]>(
      (acc, values) =>
        acc.flatMap((prefix) => values.map((v) => [...prefix, v])),
      [[]],
    );

    for (const [index, combination] of combinations.entries()) {
      const label = combination.map((v) => v.value).join("-");
      await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `${demo.slug}-${slugify(label) || "std"}`.toUpperCase(),
          price: demo.basePrice.toFixed(2),
          compareAtPrice: demo.compareAtPrice?.toFixed(2),
          stockQuantity: index % 5 === 4 ? 0 : 20,
          optionValues: {
            create: combination.map((v) => ({ optionValueId: v.id })),
          },
        },
      });
    }
  }
}

async function seedLegalPages(db: PrismaClient): Promise<void> {
  for (const page of LEGAL_PAGE_TEMPLATES) {
    await db.page.upsert({
      where: { slug: page.slug },
      // Mevcut (düzenlenmiş) içerik asla ezilmez.
      update: {},
      create: { ...page, isPublished: false },
    });
  }
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil");
  }

  const db = createPrismaClient(connectionString);
  try {
    await seedRoles(db);
    await seedCustomerGroups(db);
    await seedDemoCatalog(db);
    await seedLegalPages(db);
    console.log("Seed tamamlandı.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
