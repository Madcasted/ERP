const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // เข้ารหัสรหัสผ่าน
  const adminPassword = await bcrypt.hash("123456", 10);
  const managerPassword = await bcrypt.hash("123456", 10);

  // ===========================
  // Users
  // ===========================
  await prisma.user.upsert({
    where: {
      email: "admin@erp.local",
    },
    update: {},
    create: {
      email: "admin@erp.local",
      name: "Admin User",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: {
      email: "manager@erp.local",
    },
    update: {},
    create: {
      email: "manager@erp.local",
      name: "Manager User",
      password: managerPassword,
      role: "MANAGER",
    },
  });

  // ===========================
  // Customer
  // ===========================
  const customer = await prisma.customer.upsert({
    where: {
      email: "customer@example.com",
    },
    update: {},
    create: {
      name: "บริษัท ตัวอย่าง จำกัด",
      email: "customer@example.com",
      role: "EMPLOYEE",
      phone: "0812345678",
      address: "กรุงเทพมหานคร",
    },
  });
// ===========================
// Warehouses
// ===========================

let warehouse1 = await prisma.warehouse.findFirst({
  where: {
    name: "คลังหลัก",
  },
});

if (!warehouse1) {
  warehouse1 = await prisma.warehouse.create({
    data: {
      name: "คลังหลัก",
      location: "กรุงเทพมหานคร",
    },
  });
}

let warehouse2 = await prisma.warehouse.findFirst({
  where: {
    name: "คลังสาขา",
  },
});

if (!warehouse2) {
  warehouse2 = await prisma.warehouse.create({
    data: {
      name: "คลังสาขา",
      location: "นนทบุรี",
    },
  });
}
  // ===========================
  // Products
  // ===========================
  await prisma.product.upsert({
    where: {
      sku: "ERP-PC-001",
    },
    update: {},
    create: {
      name: "คอมพิวเตอร์สำนักงาน",
      sku: "ERP-PC-001",
      price: 17800,
      stock: 20,
      warehouseId: warehouse1.id,
      qrCode: "ERP-PC-001",
      description: "คอมพิวเตอร์สำหรับใช้งานทั่วไปในสำนักงาน",
    },
  });

  await prisma.product.upsert({
    where: {
      sku: "ERP-WIFI-002",
    },
    update: {},
    create: {
      name: "โมเด็มไวไฟ",
      sku: "ERP-WIFI-002",
      price: 1250,
      stock: 35,
      warehouseId: warehouse1.id,
      qrCode: "ERP-WIFI-002",
      description: "อุปกรณ์เชื่อมต่ออินเทอร์เน็ตสำหรับสำนักงาน",
    },
  });

  await prisma.product.upsert({
    where: {
      sku: "ERP-MON-003",
    },
    update: {},
    create: {
      name: "จอภาพ 24 นิ้ว",
      sku: "ERP-MON-003",
      price: 4200,
      stock: 12,
      warehouseId: warehouse2.id,
      qrCode: "ERP-MON-003",
      description: "จอแสดงผลความละเอียดสูง 24 นิ้ว",
    },
  });

  // ===========================
  // Materials
  // ===========================
  await prisma.material.createMany({
    data: [
      {
        name: "เหล็กแผ่น",
        unit: "kg",
        unitPrice: 45,
      },
      {
        name: "พลาสติก ABS",
        unit: "kg",
        unitPrice: 120,
      },
      {
        name: "สกรู",
        unit: "pcs",
        unitPrice: 2,
      },
    ],
    skipDuplicates: true,
  });

  // ===========================
  // Sample Order
  // ===========================
  const product = await prisma.product.findUnique({
    where: {
      sku: "ERP-PC-001",
    },
  });

  if (product) {
    await prisma.order.create({
      data: {
        customerId: customer.id,
        status: "CONFIRMED",
        total: product.price * 2,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 2,
              price: product.price,
            },
          ],
        },
      },
    });
  }

  console.log("================================");
  console.log("Seed completed successfully");
  console.log("================================");
  console.log("Admin");
  console.log("Email    : admin@erp.local");
  console.log("Password : 123456");
  console.log("");
  console.log("Manager");
  console.log("Email    : manager@erp.local");
  console.log("Password : 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });