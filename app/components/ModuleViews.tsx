"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import ReportChart from "./ReportChart";

type Product = {
  id: string;
  name: string;
  sku: string;
  qrCode?: string | null;
  image?: string | null;
  type: string;
  stock: number;
  price: number;
  description?: string | null;
  details?: string | null;
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
  materials?: ProductMaterialDetail[];
  createdAt?: string;
  updatedAt: string;
};

type ProductMaterialDetail = {
  id: string;
  material: Material;
  quantity: number;
  unitPrice: number;
};

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  customer?: { name: string };
  items?: Array<{ product?: { name: string }; quantity: number; price: number }>;
};

type TransactionType = "TRANSFER" | "SHIP";

type TransactionHistoryItem = {
  id: string;
  type: TransactionType;
  productName: string;
  sku: string;
  quantity: number;
  from: string;
  to: string;
  timestamp: string;
  note: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Material = {
  id: string;
  name: string;
  unit: string | null;
  unitPrice: number;
  description?: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  location?: string | null;
  image?: string | null;
};

type ProductForm = {
  id?: string;
  name: string;
  sku: string;
  type: string;
  stock: number;
  price: number;
  warehouseId: string;
  qrCode: string;
  image: string | null;
  description: string;
  details: string;
};

type MaterialForm = {
  id?: string;
  name: string;
  unit: string;
  unitPrice: number;
  description: string;
};

type WarehouseForm = {
  id?: string;
  name: string;
  location: string;
  image: string | null;
};

export function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "materials" | "warehouses">("products");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: "",
    sku: "",
    type: "SINGLE",
    stock: 0,
    price: 0,
    warehouseId: "",
    qrCode: "",
    image: null,
    description: "",
    details: "",
  });
  const [materialForm, setMaterialForm] = useState<MaterialForm>({
    name: "",
    unit: "",
    unitPrice: 0,
    description: "",
  });
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>({ name: "", location: "", image: null });
  const [editingProduct, setEditingProduct] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(false);
  const [selectedProductMaterials, setSelectedProductMaterials] = useState<Array<{ materialId: string; quantity: number; unitPrice: number }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      try {
        const [productsRes, warehousesRes, materialsRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/warehouses"),
          fetch("/api/materials"),
        ]);
        const [productData, warehouseData, materialData] = await Promise.all([
          productsRes.json(),
          warehousesRes.json(),
          materialsRes.json(),
        ]);
        if (active) {
          setProducts(productData);
          setWarehouses(warehouseData);
          setMaterials(materialData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      product.qrCode?.toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  }

  async function refreshData() {
    setLoading(true);
    try {
      const [productsRes, warehousesRes, materialsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/warehouses"),
        fetch("/api/materials"),
      ]);
      const [productData, warehouseData, materialData] = await Promise.all([
        productsRes.json(),
        warehousesRes.json(),
        materialsRes.json(),
      ]);
      setProducts(productData);
      setWarehouses(warehouseData);
      setMaterials(materialData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: productForm.name,
      sku: productForm.sku,
      type: productForm.type,
      price: productForm.price,
      stock: productForm.stock,
      warehouseId: productForm.warehouseId || null,
      qrCode: productForm.qrCode,
      image: productForm.image,
      description: productForm.description,
      details: productForm.details,
      materials: productForm.type === "COMPOSITE" ? selectedProductMaterials : [],
    };

    const method = editingProduct ? "PUT" : "POST";
    const url = editingProduct && productForm.id ? `/api/products/${productForm.id}` : "/api/products";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await refreshData();
      showMessage(editingProduct ? "แก้ไขสินค้าสำเร็จแล้ว" : "เพิ่มสินค้าสำเร็จแล้ว");
      setEditingProduct(false);
      setSelectedProductMaterials([]);
      setProductForm({
        name: "",
        sku: "",
        type: "SINGLE",
        stock: 0,
        price: 0,
        warehouseId: "",
        qrCode: "",
        image: null,
        description: "",
        details: "",
      });
    }
  }

  async function handleProductDelete(id: string) {
    if (!confirm("ยืนยันลบสินค้านี้?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((current) => current.filter((item) => item.id !== id));
      showMessage("ลบสินค้าเรียบร้อยแล้ว");
    }
  }

  function handleProductEdit(product: Product) {
    setEditingProduct(true);
    setActiveTab("products");
    setProductForm({
      id: product.id,
      name: product.name,
      sku: product.sku,
      type: product.type,
      stock: product.stock,
      price: product.price || 0,
      warehouseId: product.warehouseId || "",
      qrCode: product.qrCode || "",
      image: product.image || null,
      description: product.description || "",
      details: product.details || "",
    });
    
    if (product.materials && product.materials.length > 0) {
      setSelectedProductMaterials(
        product.materials.map((m) => ({
          materialId: m.material.id,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
        }))
      );
    } else {
      setSelectedProductMaterials([]);
    }
  }

  function resetProductForm() {
    setEditingProduct(false);
    setSelectedProductMaterials([]);
    setProductForm({
      name: "",
      sku: "",
      type: "SINGLE",
      stock: 0,
      price: 0,
      warehouseId: "",
      qrCode: "",
      image: null,
      description: "",
      details: "",
    });
  }

  function handleProductImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setProductForm({ ...productForm, image: base64 });
      };
      reader.readAsDataURL(file);
    }
  }

  function openProductModal(product: Product) {
    setSelectedProduct(product);
    setShowProductModal(true);
  }

  function closeProductModal() {
    setShowProductModal(false);
    setSelectedProduct(null);
  }

  function addMaterialToProduct(materialId: string) {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
    
    const exists = selectedProductMaterials.find((m) => m.materialId === materialId);
    if (exists) {
      showMessage("วัตถุดิบนี้มีในรายการแล้ว");
      return;
    }

    setSelectedProductMaterials([
      ...selectedProductMaterials,
      { materialId, quantity: 1, unitPrice: material.unitPrice },
    ]);
  }

  function removeMaterialFromProduct(materialId: string) {
    setSelectedProductMaterials((current) => current.filter((m) => m.materialId !== materialId));
  }

  function updateMaterialQuantity(materialId: string, quantity: number) {
    setSelectedProductMaterials((current) =>
      current.map((m) =>
        m.materialId === materialId ? { ...m, quantity: Math.max(0.1, quantity) } : m
      )
    );
  }

  async function handleMaterialSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: materialForm.name,
      unit: materialForm.unit,
      unitPrice: materialForm.unitPrice,
      description: materialForm.description,
    };

    const method = editingMaterial ? "PUT" : "POST";
    const url = editingMaterial && materialForm.id ? `/api/materials/${materialForm.id}` : "/api/materials";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await refreshData();
      showMessage(editingMaterial ? "แก้ไขวัตถุดิบสำเร็จแล้ว" : "เพิ่มวัตถุดิบสำเร็จแล้ว");
      setEditingMaterial(false);
      setMaterialForm({ name: "", unit: "", unitPrice: 0, description: "" });
    }
  }

  async function handleMaterialDelete(id: string) {
    if (!confirm("ยืนยันลบวัตถุดิบนี้?")) return;
    const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMaterials((current) => current.filter((item) => item.id !== id));
      showMessage("ลบวัตถุดิบเรียบร้อยแล้ว");
    }
  }

  function handleMaterialEdit(material: Material) {
    setEditingMaterial(true);
    setActiveTab("materials");
    setMaterialForm({
      id: material.id,
      name: material.name,
      unit: material.unit || "",
      unitPrice: material.unitPrice,
      description: material.description || "",
    });
  }

  async function handleWarehouseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: warehouseForm.name,
      location: warehouseForm.location,
      image: warehouseForm.image,
    };
    
    const method = editingWarehouse ? "PUT" : "POST";
    const url = editingWarehouse && warehouseForm.id ? `/api/warehouses/${warehouseForm.id}` : "/api/warehouses";
    
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await refreshData();
      showMessage(editingWarehouse ? "แก้ไขคลังสำเร็จแล้ว" : "เพิ่มคลังสำเร็จแล้ว");
      setEditingWarehouse(false);
      setWarehouseForm({ name: "", location: "", image: null });
    }
  }

  async function handleWarehouseDelete(id: string) {
    if (!confirm("ยืนยันลบคลังนี้?")) return;
    const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setWarehouses((current) => current.filter((item) => item.id !== id));
      showMessage("ลบคลังเรียบร้อยแล้ว");
    }
  }

  function handleWarehouseEdit(warehouse: Warehouse) {
    setEditingWarehouse(true);
    setActiveTab("warehouses");
    setWarehouseForm({
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location || "",
      image: warehouse.image || null,
    });
  }

  function handleWarehouseImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setWarehouseForm({ ...warehouseForm, image: base64 });
      };
      reader.readAsDataURL(file);
    }
  }

  const warehouseOptions = [{ id: "", name: "- เลือกคลัง -" }, ...warehouses];

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>คลังสินค้า</h2>
          <p>จัดการสินค้า วัสดุ และคลังเก็บ</p>
        </div>
      </div>

      <div className="module-tabs">
        <button type="button" className={activeTab === "products" ? "tab active" : "tab"} onClick={() => setActiveTab("products")}>สินค้า</button>
        <button type="button" className={activeTab === "materials" ? "tab active" : "tab"} onClick={() => setActiveTab("materials")}>วัตถุดิบ</button>
        <button type="button" className={activeTab === "warehouses" ? "tab active" : "tab"} onClick={() => setActiveTab("warehouses")}>คลัง</button>
      </div>

      {message && <div className="alert success">{message}</div>}

      {activeTab === "products" && (
        <>
          <div className="form-grid">
            <form className="card form-card" onSubmit={handleProductSubmit}>
              <h3>{editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
              <div className="field-group">
                <label>ชื่อสินค้า</label>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>SKU</label>
                <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>ประเภท</label>
                <select value={productForm.type} onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}>
                  <option value="SINGLE">สินค้าเดี่ยว</option>
                  <option value="COMPOSITE">สินค้าประกอบ</option>
                </select>
              </div>
              <div className="field-group">
                <label>คลัง</label>
                <select value={productForm.warehouseId} onChange={(e) => setProductForm({ ...productForm, warehouseId: e.target.value })}>
                  {warehouseOptions.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>สต็อก</label>
                <input type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} />
              </div>
              <div className="field-group">
                <label>ราคา</label>
                <input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} />
              </div>
              <div className="field-group">
                <label>ภาพสินค้า</label>
                <input type="file" accept="image/*" onChange={handleProductImageChange} />
                {productForm.image && (
                  <img src={productForm.image} alt="Product preview" style={{ maxWidth: "150px", marginTop: "10px", borderRadius: "4px" }} />
                )}
              </div>
              <div className="field-group">
                <label>QR Code</label>
                <input value={productForm.qrCode} onChange={(e) => setProductForm({ ...productForm, qrCode: e.target.value })} placeholder="จะสร้างอัตโนมัติจาก SKU" />
                <small className="sub-text">หมายเหตุ: QR Code จะสร้างอัตโนมัติจาก SKU เมื่อบันทึก</small>
              </div>

              {productForm.type === "COMPOSITE" && (
                <div className="field-group full-width">
                  <label>วัตถุดิบที่ใช้</label>
                  <div style={{ marginBottom: "10px" }}>
                    <select onChange={(e) => { addMaterialToProduct(e.target.value); e.target.value = ""; }} defaultValue="">
                      <option value="">- เลือกวัตถุดิบ -</option>
                      {materials.map((mat) => (
                        <option key={mat.id} value={mat.id}>
                          {mat.name} ({mat.unit}) - {mat.unitPrice} บาท
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedProductMaterials.length > 0 && (
                    <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                      <h4 style={{ marginTop: 0 }}>รายการวัตถุดิบ:</h4>
                      {selectedProductMaterials.map((pm) => {
                        const material = materials.find((m) => m.id === pm.materialId);
                        return (
                          <div key={pm.materialId} style={{ marginBottom: "8px", padding: "8px", backgroundColor: "white", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong>{material?.name}</strong> ({material?.unit})
                            </div>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={pm.quantity}
                                onChange={(e) => updateMaterialQuantity(pm.materialId, Number(e.target.value))}
                                style={{ width: "60px", padding: "4px" }}
                              />
                              <span>{material?.unit}</span>
                              <button
                                type="button"
                                onClick={() => removeMaterialFromProduct(pm.materialId)}
                                style={{ padding: "4px 8px", backgroundColor: "#ff6b6b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                ลบ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="field-group full-width">
                <label>คำอธิบาย</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={3} />
              </div>
              <div className="field-group full-width">
                <label>รายละเอียดเพิ่มเติม</label>
                <textarea value={productForm.details} onChange={(e) => setProductForm({ ...productForm, details: e.target.value })} rows={3} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">{editingProduct ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}</button>
                <button type="button" className="btn btn-secondary" onClick={resetProductForm}>รีเซ็ต</button>
              </div>
            </form>

            <div className="card">
              <div className="section-header">
                <h3>สินค้าทั้งหมด</h3>
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า, SKU หรือ QR" />
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>ภาพ</th>
                      <th>ชื่อ</th>
                      <th>SKU / QR Code</th>
                      <th>ประเภท</th>
                      <th>คลัง</th>
                      <th>สต็อก</th>
                      <th>ราคา</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={8} className="text-center">กำลังโหลดข้อมูล...</td>
                      </tr>
                    )}
                    {!loading && filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center">ไม่พบสินค้า</td>
                      </tr>
                    )}
                    {!loading && filteredProducts.map((product) => (
                      <tr key={product.id} style={{ cursor: "pointer" }} onClick={() => openProductModal(product)}>
                        <td>
                          {product.image ? (
                            <img src={product.image} alt={product.name} style={{ maxWidth: "60px", maxHeight: "60px", borderRadius: "4px" }} />
                          ) : (
                            <span className="text-muted">ไม่มีภาพ</span>
                          )}
                        </td>
                        <td>{product.name}</td>
                        <td>
                          <div>{product.sku}</div>
                          {product.qrCode && (
                            <img src={product.qrCode} alt="QR" style={{ maxWidth: "60px", marginTop: "5px", borderRadius: "2px" }} />
                          )}
                          {!product.qrCode && <small className="sub-text">-</small>}
                        </td>
                        <td>{product.type === "COMPOSITE" ? "ประกอบ" : "เดี่ยว"}</td>
                        <td>{product.warehouse?.name || "-"}</td>
                        <td>{product.stock}</td>
                        <td>{product.price?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</td>
                        <td className="table-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-small" type="button" onClick={() => handleProductEdit(product)}>แก้ไข</button>
                          <button className="btn btn-small btn-danger" type="button" onClick={() => handleProductDelete(product.id)}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "materials" && (
        <div className="form-grid">
          <form className="card form-card" onSubmit={handleMaterialSubmit}>
            <h3>{editingMaterial ? "แก้ไขวัตถุดิบ" : "เพิ่มวัตถุดิบใหม่"}</h3>
            <div className="field-group">
              <label>ชื่อวัตถุดิบ</label>
              <input value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>หน่วย</label>
              <input value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} placeholder="เช่น กก., ชิ้น" />
            </div>
            <div className="field-group">
              <label>ราคาต่อหน่วย</label>
              <input type="number" min="0" step="0.01" value={materialForm.unitPrice} onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: Number(e.target.value) })} required />
            </div>
            <div className="field-group full-width">
              <label>คำอธิบาย</label>
              <textarea value={materialForm.description} onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })} rows={3} />
            </div>
            <div className="form-actions">
              <button className="btn">{editingMaterial ? "บันทึก" : "เพิ่มวัตถุดิบ"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditingMaterial(false); setMaterialForm({ name: "", unit: "", unitPrice: 0, description: "" }); }}>ยกเลิก</button>
            </div>
          </form>

          <div className="card">
            <div className="section-header">
              <h3>รายการวัตถุดิบ</h3>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>หน่วย</th>
                    <th>ราคาต่อหน่วย</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="text-center">กำลังโหลดข้อมูล...</td>
                    </tr>
                  )}
                  {!loading && materials.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center">ยังไม่มีวัตถุดิบ</td>
                    </tr>
                  )}
                  {!loading && materials.map((material) => (
                    <tr key={material.id}>
                      <td>{material.name}</td>
                      <td>{material.unit || "-"}</td>
                      <td>{material.unitPrice.toLocaleString("th-TH", { style: "currency", currency: "THB" })}</td>
                      <td className="table-actions">
                        <button className="btn btn-small" type="button" onClick={() => handleMaterialEdit(material)}>แก้ไข</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => handleMaterialDelete(material.id)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "warehouses" && (
        <div className="form-grid">
          <form className="card form-card" onSubmit={handleWarehouseSubmit}>
            <h3>{editingWarehouse ? "แก้ไขคลัง" : "เพิ่มคลังใหม่"}</h3>
            <div className="field-group">
              <label>ชื่อคลัง</label>
              <input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>ตำแหน่ง</label>
              <input value={warehouseForm.location} onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })} placeholder="เช่น อาคาร A ชั้น 2" />
            </div>
            <div className="field-group">
              <label>ภาพคลัง</label>
              <input type="file" accept="image/*" onChange={handleWarehouseImageChange} />
              {warehouseForm.image && (
                <img src={warehouseForm.image} alt="Warehouse preview" style={{ maxWidth: "150px", marginTop: "10px", borderRadius: "4px" }} />
              )}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">{editingWarehouse ? "บันทึกการแก้ไข" : "บันทึกคลัง"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditingWarehouse(false); setWarehouseForm({ name: "", location: "", image: null }); }}>รีเซ็ต</button>
            </div>
          </form>

          <div className="card">
            <div className="section-header">
              <h3>คลังทั้งหมด</h3>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ภาพ</th>
                    <th>ชื่อคลัง</th>
                    <th>ตำแหน่ง</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="text-center">กำลังโหลดข้อมูล...</td>
                    </tr>
                  )}
                  {!loading && warehouses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center">ยังไม่มีคลัง</td>
                    </tr>
                  )}
                  {!loading && warehouses.map((warehouse) => (
                    <tr key={warehouse.id}>
                      <td>
                        {warehouse.image ? (
                          <img src={warehouse.image} alt={warehouse.name} style={{ maxWidth: "60px", maxHeight: "60px", borderRadius: "4px" }} />
                        ) : (
                          <span className="text-muted">ไม่มีภาพ</span>
                        )}
                      </td>
                      <td>{warehouse.name}</td>
                      <td>{warehouse.location || "-"}</td>
                      <td className="table-actions">
                        <button className="btn btn-small" type="button" onClick={() => handleWarehouseEdit(warehouse)}>แก้ไข</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => handleWarehouseDelete(warehouse.id)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showProductModal && selectedProduct && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "8px",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflow: "auto",
            padding: "30px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>{selectedProduct.name}</h2>
              <button
                onClick={closeProductModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                ✕
              </button>
            </div>

            {selectedProduct.image && (
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                style={{
                  width: "100%",
                  maxHeight: "300px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              />
            )}

            <div style={{ marginBottom: "15px" }}>
              <strong>SKU:</strong> {selectedProduct.sku}
            </div>

            {selectedProduct.qrCode && (
              <div style={{ marginBottom: "15px" }}>
                <strong>QR Code:</strong>
                <br />
                <img src={selectedProduct.qrCode} alt="QR" style={{ maxWidth: "150px", marginTop: "10px", borderRadius: "4px" }} />
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <strong>ประเภท:</strong> {selectedProduct.type === "COMPOSITE" ? "สินค้าประกอบ" : "สินค้าเดี่ยว"}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <strong>คลัง:</strong> {selectedProduct.warehouse?.name || "-"}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <strong>สต็อก:</strong> {selectedProduct.stock} ชิ้น
            </div>

            <div style={{ marginBottom: "15px" }}>
              <strong>ราคา:</strong> {selectedProduct.price?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}
            </div>

            {selectedProduct.description && (
              <div style={{ marginBottom: "15px" }}>
                <strong>คำอธิบาย:</strong>
                <p style={{ margin: "5px 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{selectedProduct.description}</p>
              </div>
            )}

            {selectedProduct.details && (
              <div style={{ marginBottom: "15px" }}>
                <strong>รายละเอียดเพิ่มเติม:</strong>
                <p style={{ margin: "5px 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{selectedProduct.details}</p>
              </div>
            )}

            {selectedProduct.type === "COMPOSITE" && selectedProduct.materials && selectedProduct.materials.length > 0 && (
              <div style={{ marginBottom: "15px" }}>
                <strong>วัตถุดิบที่ใช้:</strong>
                <table style={{
                  width: "100%",
                  marginTop: "10px",
                  borderCollapse: "collapse",
                }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>ชื่อวัตถุดิบ</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>ปริมาณ</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>ราคา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.materials.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px" }}>
                          {m.material.name} ({m.material.unit})
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          {m.quantity}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          {m.unitPrice.toLocaleString("th-TH", { style: "currency", currency: "THB" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => handleProductEdit(selectedProduct)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                แก้ไข
              </button>
              <button
                onClick={closeProductModal}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function TransactionView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [transactionType, setTransactionType] = useState<TransactionType>("TRANSFER");
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scanResult, setScanResult] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [history, setHistory] = useState<TransactionHistoryItem[]>([]);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // ✅ FIX: Keep a ref that always has the latest products list
  // so scan callbacks (which capture a stale closure) can read fresh data
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasCamera = !!navigator.mediaDevices?.getUserMedia;
      const hasBarcodeDetector = "BarcodeDetector" in window;
      setCameraSupported(hasCamera);
      setScannerSupported(hasBarcodeDetector);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [ordersRes, warehousesRes, productsRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/warehouses"),
          fetch("/api/products"),
        ]);
        const [ordersData, warehousesData, productsData] = await Promise.all([
          ordersRes.json(),
          warehousesRes.json(),
          productsRes.json(),
        ]);
        if (active) {
          setOrders(ordersData);
          setWarehouses(warehousesData);
          setProducts(productsData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedProduct?.warehouseId) {
      setSourceWarehouseId(selectedProduct.warehouseId);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (mode !== "scan") {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode]);

  function stopCamera() {
    if (scanLoopRef.current !== null) {
      window.cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setIsCameraActive(false);
  }

  // ✅ FIX: Use productsRef.current instead of products state to avoid stale closure
  function findProductByCodeFromRef(code: string): Product | undefined {
    return productsRef.current.find((product) =>
      product.sku.toLowerCase() === code.toLowerCase() ||
      product.qrCode?.toLowerCase() === code.toLowerCase() ||
      product.qrCode?.toLowerCase().includes(code.toLowerCase())
    );
  }

  // ✅ FIX: Scan handlers call this version which reads from ref
  function handleScannedCode(raw: string) {
    setScanResult(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setFormError("กรุณากรอกรหัสสินค้า หรือสแกน QR ก่อน");
      setFormMessage(null);
      return;
    }
    const product = findProductByCodeFromRef(trimmed);
    if (!product) {
      setFormError("ไม่พบสินค้าจากรหัสนี้ กรุณาลองใหม่");
      setFormMessage(null);
      setSelectedProduct(null);
      return;
    }
    setSelectedProduct(product);
    setFormError(null);
    setFormMessage(`เลือกสินค้า ${product.name} เรียบร้อยแล้ว`);
  }

  function scanWithCanvas() {
    if (!videoRef.current) {
      scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas);
      return;
    }
    const video = videoRef.current;
    if (video.readyState < 2) {
      scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas);
      return;
    }
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("ไม่สามารถประมวลผลภาพจากกล้องได้");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      stopCamera();
      handleScannedCode(code.data); // ✅ use ref-based lookup
      return;
    }
    scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas);
  }

  function scanFrame(detector: any) {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector));
      return;
    }

    detector.detect(videoRef.current).then((codes: any[]) => {
      if (codes && codes.length > 0) {
        const raw = codes[0].rawValue || codes[0].displayValue || "";
        if (raw) {
          stopCamera();
          handleScannedCode(raw); // ✅ use ref-based lookup
          return;
        }
      }
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector));
    }).catch((error: any) => {
      console.error(error);
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector));
    });
  }

  async function startCamera() {
    setFormError(null);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("ไม่สามารถเข้าถึงกล้องได้บนอุปกรณ์หรือเบราว์เซอร์นี้");
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanFrame(detector);
      } else {
        scanWithCanvas();
      }
    } catch (error) {
      console.error(error);
      setCameraError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้เว็บนี้ใช้กล้อง");
    }
  }

  function resetTransactionForm() {
    setMode("scan");
    setScanResult("");
    setManualCode("");
    setSelectedProduct(null);
    setSourceWarehouseId("");
    setDestinationWarehouseId("");
    setCustomerName("");
    setQuantity(1);
    setFormMessage(null);
    setFormError(null);
    setCameraError(null);
    stopCamera();
  }

  function showFormMessage(text: string) {
    setFormMessage(text);
    setFormError(null);
    window.setTimeout(() => setFormMessage(null), 4000);
  }

  function showFormError(text: string) {
    setFormError(text);
    setFormMessage(null);
  }

  // ✅ Used by manual input — reads from state directly (no stale closure issue here)
  function findProductByCode(code: string) {
    return products.find((product) =>
      product.sku.toLowerCase() === code.toLowerCase() ||
      product.qrCode?.toLowerCase() === code.toLowerCase() ||
      product.qrCode?.toLowerCase().includes(code.toLowerCase())
    );
  }

  async function handleProductCodeLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      showFormError("กรุณากรอกรหัสสินค้า หรือสแกน QR ก่อน");
      return;
    }
    const product = findProductByCode(trimmed);
    if (!product) {
      showFormError("ไม่พบสินค้าจากรหัสนี้ กรุณาลองใหม่");
      setSelectedProduct(null);
      return;
    }
    setSelectedProduct(product);
    setScanResult(trimmed);
    setFormMessage(`เลือกสินค้า ${product.name} เรียบร้อยแล้ว`);
  }

  async function handleConfirmTransaction() {
    if (!selectedProduct) {
      showFormError("กรุณาเลือกสินค้าก่อนดำเนินการ");
      return;
    }
    if (quantity < 1) {
      showFormError("ปริมาณต้องมากกว่า 0");
      return;
    }

    if (transactionType === "TRANSFER") {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        showFormError("กรุณาเลือกทั้งคลังต้นทางและปลายทาง");
        return;
      }
      if (sourceWarehouseId === destinationWarehouseId) {
        showFormError("ไม่สามารถเลือกคลังต้นทางและปลายทางเหมือนกันได้");
        return;
      }
      if (selectedProduct.warehouseId && selectedProduct.warehouseId !== sourceWarehouseId) {
        showFormError("สินค้าไม่อยู่ในคลังต้นทางที่เลือก กรุณาตรวจสอบ");
        return;
      }
      try {
        const res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedProduct,
            stock: selectedProduct.stock,
            warehouseId: destinationWarehouseId,
          }),
        });
        if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
        const updated = await res.json();
        setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        const sourceName = warehouses.find((w) => w.id === sourceWarehouseId)?.name || "คลังต้นทาง";
        const destinationName = warehouses.find((w) => w.id === destinationWarehouseId)?.name || "คลังปลายทาง";
        setHistory((current) => [
          {
            id: `${Date.now()}`,
            type: "TRANSFER",
            productName: updated.name,
            sku: updated.sku,
            quantity,
            from: sourceName,
            to: destinationName,
            timestamp: new Date().toLocaleString("th-TH"),
            note: "โอนสินค้าไปยังคลังปลายทาง",
          },
          ...current,
        ]);
        showFormMessage("โอนสินค้าข้ามคลังเรียบร้อยแล้ว");
        resetTransactionForm();
      } catch (error) {
        console.error(error);
        showFormError("เกิดข้อผิดพลาดขณะโอนสินค้า");
      }
      return;
    }

    if (transactionType === "SHIP") {
      if (!sourceWarehouseId) {
        showFormError("กรุณาเลือกคลังต้นทาง");
        return;
      }
      if (!customerName.trim()) {
        showFormError("กรุณาระบุชื่อลูกค้า");
        return;
      }
      if (selectedProduct.stock < quantity) {
        showFormError("สต็อกไม่เพียงพอ");
        return;
      }
      if (selectedProduct.warehouseId && selectedProduct.warehouseId !== sourceWarehouseId) {
        showFormError("สินค้าไม่อยู่ในคลังต้นทางที่เลือก กรุณาตรวจสอบ");
        return;
      }
      try {
        const res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedProduct,
            stock: selectedProduct.stock - quantity,
            warehouseId: sourceWarehouseId,
          }),
        });
        if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
        const updated = await res.json();
        setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        const sourceName = warehouses.find((w) => w.id === sourceWarehouseId)?.name || "คลังต้นทาง";
        setHistory((current) => [
          {
            id: `${Date.now()}`,
            type: "SHIP",
            productName: updated.name,
            sku: updated.sku,
            quantity,
            from: sourceName,
            to: customerName,
            timestamp: new Date().toLocaleString("th-TH"),
            note: "ส่งสินค้าให้ลูกค้า",
          },
          ...current,
        ]);
        showFormMessage("ส่งสินค้าถึงลูกค้าเรียบร้อยแล้ว");
        resetTransactionForm();
      } catch (error) {
        console.error(error);
        showFormError("เกิดข้อผิดพลาดขณะส่งสินค้า");
      }
      return;
    }
  }

  const destinationOptions = warehouses.filter((warehouse) => warehouse.id !== sourceWarehouseId);

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>ระบบรับเข้า-ส่งสินค้า</h2>
          <p>สแกน QR บนมือถือหรือพิมพ์รหัสสินค้าในคอม เพื่อโอนคลังหรือส่งให้ลูกค้า</p>
        </div>
      </div>

      <div className="module-tabs" style={{ marginBottom: 18 }}>
        <button type="button" className={mode === "scan" ? "tab active" : "tab"} onClick={() => setMode("scan")}>สแกน QR</button>
        <button type="button" className={mode === "manual" ? "tab active" : "tab"} onClick={() => setMode("manual")}>พิมพ์รหัส</button>
      </div>

      <div className="module-tabs" style={{ marginBottom: 18 }}>
        <button type="button" className={transactionType === "TRANSFER" ? "tab active" : "tab"} onClick={() => setTransactionType("TRANSFER")}>โอนข้ามคลัง</button>
        <button type="button" className={transactionType === "SHIP" ? "tab active" : "tab"} onClick={() => setTransactionType("SHIP")}>ส่งลูกค้า</button>
      </div>

      {(formMessage || formError) && (
        <div className={`alert ${formError ? "" : "success"}`}>
          {formError || formMessage}
        </div>
      )}

      <div className="form-grid">
        <div className="card form-card">
          <h3 style={{ marginTop: 0 }}>เลือกสินค้า</h3>
          <div className="field-group">
            <label>โหมด</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className={mode === "scan" ? "btn" : "btn btn-secondary"} onClick={() => setMode("scan")}>สแกน QR</button>
              <button type="button" className={mode === "manual" ? "btn" : "btn btn-secondary"} onClick={() => setMode("manual")}>พิมพ์รหัส</button>
            </div>
          </div>

          {mode === "scan" && (
            <div className="field-group">
              <label>สแกน QR ด้วยกล้อง</label>
              {cameraError && <div className="alert">{cameraError}</div>}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className={isCameraActive ? "btn btn-secondary" : "btn"} onClick={startCamera} disabled={isCameraActive}>
                  เริ่มสแกน
                </button>
                {isCameraActive && (
                  <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                    หยุดสแกน
                  </button>
                )}
              </div>
              <small className="sub-text">เล็งกล้องไปที่ QR code เพื่อสแกน</small>
              {cameraSupported ? (
                scannerSupported ? (
                  <small className="sub-text">หากเบราว์เซอร์รองรับ ระบบจะสแกน QR อัตโนมัติ</small>
                ) : (
                  <small className="sub-text">ใช้โหมดสแกนสำรองด้วยภาพจากกล้อง</small>
                )
              ) : (
                <small className="sub-text">อุปกรณ์นี้ไม่รองรับกล้องเพื่อสแกน QR</small>
              )}
              <div style={{ marginTop: 16, borderRadius: 18, overflow: "hidden", background: "#000" }}>
                <video
                  ref={videoRef}
                  style={{ width: "100%", minHeight: 220, objectFit: "cover" }}
                  muted
                  playsInline
                />
              </div>
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          )}

          {mode === "manual" && (
            <div className="field-group">
              <label>ป้อน SKU / รหัสสินค้า</label>
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="เช่น ERP-PC-001"
              />
              <div className="form-actions" style={{ padding: 0, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => handleProductCodeLookup(manualCode)}>ค้นหา</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setManualCode(""); setSelectedProduct(null); setFormError(null); setFormMessage(null); }}>ล้าง</button>
              </div>
            </div>
          )}

          <div className="field-group">
            <label>รหัสที่อ่านได้</label>
            <input value={scanResult || manualCode} disabled />
          </div>

          {selectedProduct ? (
            <div style={{ padding: 18, borderRadius: 22, background: "#f8fff7", border: "1px solid #d8efda" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 14 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 14, background: "#e7f0e3", display: "flex", alignItems: "center", justifyContent: "center", color: "#66776b" }}>รูป</div>
                )}
                <div>
                  <strong>{selectedProduct.name}</strong>
                  <p style={{ margin: "6px 0 0 0", color: "#5f6f63" }}>{selectedProduct.sku}</p>
                  <p style={{ margin: "4px 0 0 0", color: "#5f6f63" }}>สต็อก {selectedProduct.stock} ชิ้น</p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 18, borderRadius: 22, background: "#fff7f5", border: "1px solid #f2d8d4", color: "#8a4f45" }}>
              กรุณาสแกน QR หรือป้อนรหัสสินค้าเพื่อเริ่มต้น
            </div>
          )}
        </div>

        <div className="card form-card">
          <h3 style={{ marginTop: 0 }}>{transactionType === "TRANSFER" ? "โอนข้ามคลัง" : "ส่งสินค้าให้ลูกค้า"}</h3>

          <div className="field-group">
            <label>คลังต้นทาง</label>
            <select value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>
              <option value="">- เลือกคลังต้นทาง -</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>

          {transactionType === "TRANSFER" && (
            <div className="field-group">
              <label>คลังปลายทาง</label>
              <select value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>
                <option value="">- เลือกคลังปลายทาง -</option>
                {destinationOptions.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          )}

          {transactionType === "SHIP" && (
            <div className="field-group">
              <label>ชื่อลูกค้า</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="เช่น บริษัท ลูกค้า จำกัด" />
            </div>
          )}

          <div className="field-group">
            <label>จำนวน</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={handleConfirmTransaction}>บันทึกการเคลื่อนย้าย</button>
            <button type="button" className="btn btn-secondary" onClick={resetTransactionForm}>รีเซ็ต</button>
          </div>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: 24 }}>
        <h3>ประวัติการเคลื่อนย้ายล่าสุด</h3>
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>สินค้า</th>
              <th>ประเภท</th>
              <th>จำนวน</th>
              <th>จาก</th>
              <th>ถึง</th>
              <th>บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center">ยังไม่มีรายการเคลื่อนย้าย</td>
              </tr>
            )}
            {history.map((item) => (
              <tr key={item.id}>
                <td>{item.timestamp}</td>
                <td>{item.productName}</td>
                <td>{item.type === "TRANSFER" ? "โอนคลัง" : "ส่งลูกค้า"}</td>
                <td>{item.quantity}</td>
                <td>{item.from}</td>
                <td>{item.to}</td>
                <td>{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-responsive" style={{ marginTop: 24 }}>
        <h3>รายการคำสั่งซื้อ</h3>
        <table>
          <thead>
            <tr>
              <th>รหัสคำสั่งซื้อ</th>
              <th>ลูกค้า</th>
              <th>วันที่</th>
              <th>สถานะ</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center">กำลังโหลดคำสั่งซื้อ...</td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center">ไม่มีรายการคำสั่งซื้อ</td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer?.name ?? "ลูกค้า"}</td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                <td>{order.status}</td>
                <td>{order.total?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProductionView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      try {
        const [productRes, materialRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/materials"),
        ]);
        const [productData, materialData] = await Promise.all([productRes.json(), materialRes.json()]);
        if (active) {
          setProducts(productData);
          setMaterials(materialData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, []);

  const compositeProducts = products.filter((product) => product.type === "COMPOSITE");

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>การผลิต</h2>
          <p>วางแผน BOM และจัดการผลิตสินค้าประกอบ</p>
        </div>
      </div>

      <div className="card-grid">
        <div className="card small-card">
          <h3>สินค้าเชิงประกอบ</h3>
          <p>{compositeProducts.length} รายการ</p>
        </div>
        <div className="card small-card">
          <h3>วัสดุที่มีอยู่</h3>
          <p>{materials.length} รายการ</p>
        </div>
      </div>

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ชื่อสินค้า</th>
              <th>SKU</th>
              <th>สต็อก</th>
              <th>วัตถุดิบที่เกี่ยวข้อง</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="text-center">กำลังโหลดข้อมูลการผลิต...</td>
              </tr>
            )}
            {!loading && compositeProducts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center">ยังไม่มีสินค้าประกอบในระบบ</td>
              </tr>
            )}
            {compositeProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.stock}</td>
                <td>{materials.length} รายการ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MachineView() {
  const machines = [
    { id: "MC-001", name: "เครื่องพิมพ์อิงค์เจ็ต", status: "พร้อมใช้งาน", mode: "Auto", lastActive: "2026-05-20" },
    { id: "MC-002", name: "เครื่องตัดเลเซอร์", status: "รอซ่อม", mode: "Manual", lastActive: "2026-05-19" },
    { id: "MC-003", name: "หุ่นยนต์ประกอบ", status: "กำลังทำงาน", mode: "Auto", lastActive: "2026-05-21" },
  ];

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>เครื่องจักร</h2>
          <p>ตรวจสอบสถานะและบันทึกการทำงานของเครื่องจักร</p>
        </div>
      </div>

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>รหัสเครื่อง</th>
              <th>ชื่อเครื่อง</th>
              <th>สถานะ</th>
              <th>โหมด</th>
              <th>วันที่ใช้งานล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((machine) => (
              <tr key={machine.id}>
                <td>{machine.id}</td>
                <td>{machine.name}</td>
                <td>{machine.status}</td>
                <td>{machine.mode}</td>
                <td>{machine.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReportView() {
  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>รายงาน</h2>
          <p>ดูภาพรวมสถิติ รายงานสินค้าคงคลัง และผลการผลิต</p>
        </div>
      </div>

      <ReportChart />
    </section>
  );
}

export function SystemView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchUsers() {
      setLoading(true);
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (active) setUsers(data);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchUsers();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h2>ระบบ</h2>
          <p>จัดการผู้ใช้งาน สิทธิ์ และตั้งค่าระบบพื้นฐาน</p>
        </div>
      </div>

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>อีเมล</th>
              <th>บทบาท</th>
              <th>วันที่สร้าง</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="text-center">กำลังโหลดข้อมูลผู้ใช้...</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center">ยังไม่มีผู้ใช้งานในระบบ</td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>---</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}