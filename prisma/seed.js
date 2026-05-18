const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      { email: "admin@erp.local", name: "Admin User", role: "ADMIN" },
      { email: "manager@erp.local", name: "Manager User", role: "MANAGER" }
    ],
    skipDuplicates: true,
  });

  const customer = await prisma.customer.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "บริษัท ตัวอย่าง จำกัด",
      email: "customer@example.com",
      phone: "0812345678",
      address: "กรุงเทพมหานคร",
    },
  });

  await prisma.product.createMany({
    data: [
      { name: "คอมพิวเตอร์สำนักงาน", sku: "ERP-PC-001", price: 17800, stock: 20 },
      { name: "โมเด็มไวไฟ", sku: "ERP-WIFI-002", price: 1250, stock: 35 },
      { name: "จอภาพ 24 นิ้ว", sku: "ERP-MON-003", price: 4200, stock: 12 }
    ],
    skipDuplicates: true,
  });

  const product = await prisma.product.findUnique({ where: { sku: "ERP-PC-001" } });
  if (product) {
    await prisma.order.create({
      data: {
        customerId: customer.id,
        status: "CONFIRMED",
        total: product.price * 2,
        items: {
          create: [{ productId: product.id, quantity: 2, price: product.price }],
        },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
