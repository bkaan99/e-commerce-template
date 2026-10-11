import "dotenv/config";
import { SYSTEM_ROLES } from "../src/shared/permissions";
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

async function seedDemoCatalog(db: PrismaClient): Promise<void> {
  const category = await db.category.upsert({
    where: { slug: "giyim" },
    update: {},
    create: { name: "Giyim", slug: "giyim" },
  });

  const brand = await db.brand.upsert({
    where: { slug: "demo-marka" },
    update: {},
    create: { name: "Demo Marka", slug: "demo-marka" },
  });

  const fabric = await db.attribute.upsert({
    where: { slug: "kumas" },
    update: {},
    create: { name: "Kumaş", slug: "kumas" },
  });

  const cotton = await db.attributeValue.upsert({
    where: { attributeId_slug: { attributeId: fabric.id, slug: "pamuk" } },
    update: {},
    create: { attributeId: fabric.id, value: "Pamuk", slug: "pamuk" },
  });

  const existing = await db.product.findUnique({
    where: { slug: "basic-tisort" },
  });
  if (existing) return;

  const product = await db.product.create({
    data: {
      name: "Basic Tişört",
      slug: "basic-tisort",
      description: "Demo ürün: çoklu eksenli varyant örneği.",
      status: "ACTIVE",
      categoryId: category.id,
      brandId: brand.id,
      attributes: { create: [{ attributeValueId: cotton.id }] },
      options: {
        create: [
          {
            name: "Renk",
            position: 0,
            values: {
              create: [
                { value: "Siyah", position: 0 },
                { value: "Beyaz", position: 1 },
              ],
            },
          },
          {
            name: "Beden",
            position: 1,
            values: {
              create: [
                { value: "S", position: 0 },
                { value: "M", position: 1 },
              ],
            },
          },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });

  const [color, size] = product.options.sort((a, b) => a.position - b.position);

  for (const colorValue of color.values) {
    for (const sizeValue of size.values) {
      await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `TSHIRT-${colorValue.value}-${sizeValue.value}`.toUpperCase(),
          price: "299.90",
          stockQuantity: 25,
          optionValues: {
            create: [
              { optionValueId: colorValue.id },
              { optionValueId: sizeValue.id },
            ],
          },
        },
      });
    }
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
    console.log("Seed tamamlandı.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
