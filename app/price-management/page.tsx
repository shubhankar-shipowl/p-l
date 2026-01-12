"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  ArrowLeft,
  Tags,
  Upload,
  Download,
  Plus,
  Edit,
  Trash2,
  Database,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type PriceEntry = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  product_name: string;
  currency: string;
  price_before_gst: number;
  gst_rate: number;
  price_after_gst: number;
  hsn: string;
  effective_from: string;
  effective_to: string | null;
};

type Supplier = { id: number; name: string };

type MissingEntry = {
  supplier_name: string;
  product_name: string;
  order_count: number;
  latestOrderDate?: string | null;
  supplierId?: number | null;
  supplier_product_id?: string;
  needs_pricing?: boolean;
};

export default function PriceManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [missingEntries, setMissingEntries] = useState<MissingEntry[]>([]);
  const [pickupWarehouses, setPickupWarehouses] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [pricingBasis, setPricingBasis] = useState("delivered_date");
  const [showMissingBulkModal, setShowMissingBulkModal] = useState(false);
  const [bulkModalData, setBulkModalData] = useState<MissingEntry[]>([]); // Data specifically for the bulk modal
  // bulkEdits: keyed by supplierName_productName (as per documentation)
  const [bulkEdits, setBulkEdits] = useState<Record<
    string,
    {
      price_before_gst: string;
      gst_rate: string;
      price_after_gst: string;
      hsn_code: string;
      effective_from: string;
      effective_to: string;
    }
  >>({});
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PriceEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<string[]>([]);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    product_name: "",
    currency: "INR",
    price_before_gst: "",
    gst_rate: "18",
    price_after_gst: "",
    hsn_code: "",
    effective_from: "",
    effective_to: "",
  });

  // Fetch data
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplier]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [entriesRes, suppliersRes, missingRes, pickupsRes] = await Promise.all([
        fetch(`/api/price-entries?supplier=${selectedSupplier}`),
        fetch("/api/suppliers"),
        fetch("/api/price-entries/missing"),
        fetch("/api/pickup-warehouses?force_pickup_warehouse=true"),
      ]);

      const entries = await entriesRes.json();
      const suppliersData = await suppliersRes.json();
      const missing = await missingRes.json();
      const pickups = await pickupsRes.json();

      console.log("✅ API Responses:", {
        entries: entries?.length || 0,
        suppliers: suppliersData?.length || 0,
        missing: missing?.length || 0,
        pickups: pickups?.warehouses?.length || 0
      });

      setPriceEntries(Array.isArray(entries) ? entries : []);

      // pickup warehouses from orders
      const pickupList = Array.isArray(pickups?.warehouses)
        ? pickups.warehouses.filter(Boolean)
        : [];
      setPickupWarehouses(pickupList);

      // suppliers from DB (if any)
      const dbSuppliers = Array.isArray(suppliersData) ? suppliersData : [];

      // Build supplier options from pickup warehouses
      const pickupAsSuppliers = pickupList.map((name: string, idx: number) => ({
        id: -(idx + 1), // temporary negative id
        name,
      }));

      // Merge DB suppliers with pickup warehouses (avoid duplicates)
      const dbSupplierNames = new Set(dbSuppliers.map((s: Supplier) => s.name.toLowerCase().trim()));
      const uniquePickupSuppliers = pickupAsSuppliers.filter(
        (ps: { name: string }) => !dbSupplierNames.has(ps.name.toLowerCase().trim())
      );

      // Sort alphabetically by name
      const mergedSuppliers = [...dbSuppliers, ...uniquePickupSuppliers].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      console.log("👥 Merged suppliers:", {
        dbSuppliers: dbSuppliers.length,
        pickupSuppliers: uniquePickupSuppliers.length,
        total: mergedSuppliers.length
      });

      setSuppliers(mergedSuppliers);
      
      const missingData = Array.isArray(missing) ? missing : [];
      console.log("📊 Fetched missing entries:", missingData.length, "items");
      console.log("📊 Missing entries data:", missingData.slice(0, 2));
      setMissingEntries(missingData);
      console.log("✅ State updated with missing entries");
      
      return { missingData }; // Return the data
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
      return { missingData: [] };
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return priceEntries;
  }, [priceEntries]);

  // Active suppliers count from pickup warehouses (order data)
  const activeSuppliersCount = useMemo(() => {
    const set = new Set<string>();
    pickupWarehouses.forEach((w) => {
      if (w) set.add(w);
    });
    if (set.size === 0) {
      missingEntries.forEach((m) => {
        if (m.supplier_name) set.add(m.supplier_name);
      });
    }
    if (set.size === 0) {
      suppliers.forEach((s) => {
        if (s.name) set.add(s.name);
      });
    }
    return set.size;
  }, [pickupWarehouses, missingEntries, suppliers]);

  const handleOpenModal = async (entry?: PriceEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setForm({
        supplier_id: String(entry.supplier_id),
        product_name: entry.product_name,
        currency: entry.currency,
        price_before_gst: String(entry.price_before_gst),
        gst_rate: String(entry.gst_rate),
        price_after_gst: String(entry.price_after_gst),
        hsn_code: entry.hsn,
        effective_from: entry.effective_from,
        effective_to: entry.effective_to || "",
      });
      
      // Load products for the supplier
      const selectedSupplier = suppliers.find(s => s.id === entry.supplier_id);
      if (selectedSupplier) {
        try {
          const response = await fetch(`/api/products-by-supplier?supplier=${encodeURIComponent(selectedSupplier.name)}`);
          const data = await response.json();
          setSupplierProducts(data.products || []);
        } catch (error) {
          console.error("Failed to load products:", error);
          setSupplierProducts([]);
        }
      }
    } else {
      setEditingEntry(null);
      setSupplierProducts([]); // Reset products list
      setForm({
        supplier_id: "",
        product_name: "",
        currency: "INR",
        price_before_gst: "",
        gst_rate: "18",
        price_after_gst: "",
        hsn_code: "",
        effective_from: "",
        effective_to: "",
      });
    }
    setShowPriceModal(true);
  };

  const ensureSupplier = async (name: string) => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    
    // Check if we have a valid (positive ID) supplier already
    let supplier = suppliers.find((s) => s.name === trimmed && s.id > 0);
    if (supplier) return supplier;

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      const created = await res.json();
      const newSupplier = { id: created.id, name: trimmed };
      
      // Update state, replacing any temporary entry if it existed
      setSuppliers((prev) => {
        const others = prev.filter(s => s.name !== trimmed);
        return [...others, newSupplier];
      });
      
      return newSupplier;
    } catch (err: any) {
      console.error("Failed to create supplier", err);
      toast({
        title: "Error",
        description: "Supplier not found and could not be created.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleQuickAdd = async (missing: MissingEntry) => {
    const supplier = await ensureSupplier(missing.supplier_name || "Unknown");
    if (!supplier) return;
    
    // Load products for this supplier
    try {
      const response = await fetch(`/api/products-by-supplier?supplier=${encodeURIComponent(missing.supplier_name)}`);
      const data = await response.json();
      setSupplierProducts(data.products || []);
    } catch (error) {
      console.error("Failed to load products:", error);
      setSupplierProducts([]);
    }
    
    setForm({
      supplier_id: String(supplier.id),
      product_name: missing.product_name,
      currency: "INR",
      price_before_gst: "",
      gst_rate: "18",
      price_after_gst: "",
      hsn_code: "",
      effective_from: new Date().toISOString().split("T")[0],
      effective_to: "",
    });
    setEditingEntry(null);
    setShowPriceModal(true);
  };

  const closeMissingBulkModal = () => {
    setShowMissingBulkModal(false);
    setBulkModalData([]);
    setMissingSearch("");
    setMissingMinOrders("");
    setMissingMaxOrders("");
  };

  const openMissingBulkModal = async () => {
    // refresh missing list to ensure we have latest data before showing
    console.log("🚀 Opening bulk modal, fetching fresh data...");
    const result = await fetchData();
    const freshMissingData = result?.missingData || [];
    
    console.log("📋 Fresh missing data:", freshMissingData.length, "items");
    console.log("📋 Sample data:", freshMissingData[0]);
    
    if (!freshMissingData || freshMissingData.length === 0) {
      toast({
        title: "No missing products",
        description: "All products have prices/HSN. Nothing to add.",
      });
      return;
    }
    
    // Store the fresh data specifically for the modal
    setBulkModalData(freshMissingData);
    
    const today = new Date().toISOString().split("T")[0];
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split("T")[0];
    const initial: typeof bulkEdits = {};
    freshMissingData.slice(0, 200).forEach((m) => {
      // Key format: supplierName_productName (as per documentation)
      const key = `${m.supplier_name}_${m.product_name}`;
      initial[key] = {
        price_before_gst: "",
        gst_rate: "",
        price_after_gst: "",
        hsn_code: "",
        effective_from: today,
        effective_to: nextYear,
      } as any;
    });
    setBulkEdits(initial);
    console.log("✅ Opening modal with", Object.keys(initial).length, "rows");
    setShowMissingBulkModal(true);
  };

  const missingFilter = {
    search: "",
    minOrders: "",
    maxOrders: "",
  };
  const [missingSearch, setMissingSearch] = useState("");
  const [missingMinOrders, setMissingMinOrders] = useState("");
  const [missingMaxOrders, setMissingMaxOrders] = useState("");

  const updateBulkEdit = (
    key: string,
    field: keyof (typeof bulkEdits)[string],
    value: string
  ) => {
    setBulkEdits((prev) => {
      const next = { ...prev };
      const row = { ...(next[key] || {}) };
      row[field] = value;
      if (field === "price_before_gst" || field === "gst_rate") {
        const priceNum = parseFloat(row.price_before_gst) || 0;
        const gstNum = parseFloat(row.gst_rate) || 0;
        row.price_after_gst =
          row.price_before_gst && row.gst_rate
            ? (priceNum * (1 + gstNum / 100)).toFixed(2)
            : "";
      } else if (field === "price_after_gst") {
        // Reverse calculation: Price Before = Price After / (1 + GST/100)
        // Default GST to 18% if not set
        const priceAfter = parseFloat(value) || 0;
        const gstRate = parseFloat(row.gst_rate) || 18; 
        if (!row.gst_rate) row.gst_rate = "18"; // Set default visual
        
        row.price_before_gst = (priceAfter / (1 + gstRate / 100)).toFixed(2);
      }
      next[key] = row;
      return next;
    });
  };

  const filteredMissingEntries = useMemo(() => {
    console.log("🔍 Filtering missing entries:", {
      totalMissing: missingEntries.length,
      missingSearch,
      missingMinOrders,
      missingMaxOrders,
      sampleEntry: missingEntries[0]
    });
    
    const filtered = missingEntries
      .filter((entry) => {
        if (missingSearch) {
          const q = missingSearch.toLowerCase();
          return (
            entry.supplier_name.toLowerCase().includes(q) ||
            entry.product_name.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .filter((entry) => {
        const minVal = parseInt(missingMinOrders || "0");
        if (missingMinOrders && entry.order_count < minVal) return false;
        return true;
      })
      .filter((entry) => {
        if (missingMaxOrders) {
          const maxVal = parseInt(missingMaxOrders);
          if (entry.order_count > maxVal) return false;
        }
        return true;
      });
    
    console.log("✅ Filtered result:", filtered.length, "entries");
    return filtered;
  }, [missingEntries, missingSearch, missingMinOrders, missingMaxOrders]);

  // Filtered list specifically for the bulk modal (uses bulkModalData instead of missingEntries)
  const filteredBulkModalEntries = useMemo(() => {
    console.log("🔍 Filtering bulk modal entries:", {
      totalBulkModal: bulkModalData.length,
      missingSearch,
      missingMinOrders,
      missingMaxOrders,
      sampleEntry: bulkModalData[0]
    });
    
    const filtered = bulkModalData
      .filter((entry) => {
        if (missingSearch) {
          const q = missingSearch.toLowerCase();
          return (
            entry.supplier_name?.toLowerCase().includes(q) ||
            entry.product_name?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .filter((entry) => {
        const minVal = parseInt(missingMinOrders || "0");
        if (missingMinOrders && entry.order_count < minVal) return false;
        return true;
      })
      .filter((entry) => {
        if (missingMaxOrders) {
          const maxVal = parseInt(missingMaxOrders);
          if (entry.order_count > maxVal) return false;
        }
        return true;
      });
    
    console.log("✅ Bulk modal filtered result:", filtered.length, "entries");
    return filtered;
  }, [bulkModalData, missingSearch, missingMinOrders, missingMaxOrders]);

  /**
   * Bulk Save Missing Prices
   * 
   * Workflow (as per documentation):
   * 1. Iterate through bulkEdits entries that have required fields
   * 2. Find corresponding entry from bulkModalData using key: supplierName_productName
   * 3. Resolve supplierId from suppliers by supplierName
   * 4. Compute priceBeforeGst, priceAfterGst, gstRate
   * 5. Set currency='INR', effectiveFrom=today
   * 6. Post create-price calls to /api/price-entries
   * 7. After success, invalidate/refetch data
   */
  const saveAllMissingPrices = async () => {
    setIsSubmitting(true);
    let saved = 0;
    try {
      const today = new Date().toISOString().split("T")[0];
      console.log("💾 Saving prices for", bulkModalData.length, "products");
      
      // Iterate through bulkEdits entries
      for (const [key, row] of Object.entries(bulkEdits)) {
        // Flexible validation: We need at least ONE price (before or after)
        // If Price After GST is present, we can derive the rest
        const hasPrice = row.price_before_gst || row.price_after_gst;
        
        if (!row || !hasPrice) {
          continue; // skip truly empty rows
        }
        
        // Find the corresponding entry from bulkModalData
        const entry = bulkModalData.find(
          e => `${e.supplier_name}_${e.product_name}` === key
        );
        if (!entry) continue;
        
        // Resolve supplierId from suppliers by supplierName
        const supplier = await ensureSupplier(entry.supplier_name || "Unknown");
        if (!supplier) continue;

        // Smart Defaults
        const gst_rate = row.gst_rate ? parseFloat(row.gst_rate) : 18; // Default 18%
        let price_before_gst = row.price_before_gst ? parseFloat(row.price_before_gst) : 0;
        let price_after_gst = row.price_after_gst ? parseFloat(row.price_after_gst) : 0;

        // Calculate missing price
        if (price_after_gst && !price_before_gst) {
             price_before_gst = parseFloat((price_after_gst / (1 + gst_rate / 100)).toFixed(2));
        } else if (price_before_gst && !price_after_gst) {
             price_after_gst = parseFloat((price_before_gst * (1 + gst_rate / 100)).toFixed(2));
        }

        // HSN Default
        const hsn_code = row.hsn_code || "N/A";

        const payload = {
          supplier_id: supplier.id,
          product_name: entry.product_name,
          currency: "INR",
          price_before_gst,
          gst_rate,
          price_after_gst,
          hsn_code,
          effective_from: row.effective_from || today,
          effective_to: row.effective_to || null,
        };

        const response = await fetch("/api/price-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          saved += 1;
        }
      }
      toast({
        title: "Prices saved",
        description: `Saved ${saved} entries`,
      });
      closeMissingBulkModal();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save prices",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatePriceAfterGST = (price: string, gst: string) => {
    const priceNum = parseFloat(price) || 0;
    const gstNum = parseFloat(gst) || 0;
    return (priceNum * (1 + gstNum / 100)).toFixed(2);
  };

  const handleFormChange = async (field: string, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "price_before_gst" || field === "gst_rate") {
        updated.price_after_gst = calculatePriceAfterGST(
          updated.price_before_gst,
          updated.gst_rate
        );
      }
      return updated;
    });
    
    // When supplier is selected, load products for that supplier
    if (field === "supplier_id") {
      const selectedSupplier = suppliers.find(s => String(s.id) === value);
      if (selectedSupplier) {
        console.log("📦 Loading products for supplier:", selectedSupplier.name);
        setIsFetchingProducts(true);
        setSupplierProducts([]); // Clear strictly before fetch
        setForm(prev => ({ ...prev, product_name: "" })); // Clear selection

        try {
          // Fetch products from order data
          const response = await fetch(`/api/products-by-supplier?supplier=${encodeURIComponent(selectedSupplier.name)}`);
          if (!response.ok) throw new Error("Failed to fetch products");
          
          const data = await response.json();
          const products = data.products || [];
          
          console.log("✅ Loaded", products.length, "products");
          setSupplierProducts(products);
        } catch (error) {
          console.error("Failed to load products:", error);
          setSupplierProducts([]);
        } finally {
          setIsFetchingProducts(false);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingEntry
        ? `/api/price-entries/${editingEntry.id}`
        : "/api/price-entries";
      const method = editingEntry ? "PUT" : "POST";

      let supplierId = parseInt(form.supplier_id);
      
      // If using a temporary supplier ID (from pickup warehouses), ensure it exists in DB
      if (supplierId < 0) {
        const tempSupplier = suppliers.find(s => s.id === supplierId);
        if (!tempSupplier) {
           throw new Error("Selected supplier reference is invalid. Please select the supplier again.");
        }
        
        if (tempSupplier) {
          console.log("Creating/Ensuring supplier for:", tempSupplier.name);
          const realSupplier = await ensureSupplier(tempSupplier.name);
          if (realSupplier && realSupplier.id > 0) {
            supplierId = realSupplier.id;
          } else {
             throw new Error("Could not create supplier record. Please try again.");
          }
        }
      }
      
      if (supplierId < 0) {
         throw new Error("Invalid supplier ID. Please select a valid supplier.");
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          product_name: form.product_name,
          currency: form.currency,
          price_before_gst: parseFloat(form.price_before_gst),
          gst_rate: parseFloat(form.gst_rate),
          price_after_gst: parseFloat(form.price_after_gst),
          hsn_code: form.hsn_code,
          effective_from: form.effective_from || new Date().toISOString().split("T")[0],
          effective_to: form.effective_to || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save entry");
      }

      toast({
        title: "Success",
        description: editingEntry
          ? "Price entry updated successfully"
          : "Price entry created successfully",
      });

      setShowPriceModal(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save entry",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const response = await fetch(`/api/price-entries/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }

      toast({
        title: "Success",
        description: "Price entry deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Present";
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/price-entries/download-template");
      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "price-entries-template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: "Excel template downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handleDownloadProductDatabase = async () => {
    try {
      const response = await fetch("/api/price-entries/export");
      if (!response.ok) {
        throw new Error("Failed to download product database");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `product-database-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Database Downloaded",
        description: "Product database exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download product database",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsBulkUploading(true);
    setUploadProgress(0);
    setUploadStage("Preparing file...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setUploadProgress(20);
      setUploadStage("Uploading file...");

      const response = await fetch("/api/price-entries/bulk-import", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(60);
      setUploadStage("Processing data...");

      const data = await response.json();

      setUploadProgress(90);
      setUploadStage("Finalizing...");

      if (!response.ok) {
        throw new Error(data.error || "Failed to import file");
      }

      setUploadProgress(100);
      setUploadStage("Complete!");

      toast({
        title: "Import Successful",
        description: `Successfully imported ${data.successCount} price entries${data.errorCount > 0 ? ` (${data.errorCount} errors)` : ""}`,
      });

      // Refresh data
      await fetchData();

      // Close modal after a short delay
      setTimeout(() => {
        setShowBulkImportModal(false);
        setSelectedFile(null);
        setIsBulkUploading(false);
        setUploadProgress(0);
        setUploadStage("");
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import file",
        variant: "destructive",
      });
      setIsBulkUploading(false);
      setUploadProgress(0);
      setUploadStage("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Missing Prices Bulk Modal */}
      {showMissingBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 flex items-center justify-between border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Add Prices for Missing Products
                </h3>
                <p className="text-sm text-gray-600">
                  Fill Price, GST, HSN and save. Only rows with Price/GST/HSN filled will be saved.
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeMissingBulkModal}
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Summary pills and actions */}
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-4 py-2 text-sm font-medium shadow-sm">
                  {Math.min(200, filteredBulkModalEntries.length)} of {bulkModalData.length} products shown. Fill prices and HSN codes for products you want to save.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    onClick={handleDownloadTemplate}
                  >
                    Export ({bulkModalData.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      closeMissingBulkModal();
                      setShowBulkImportModal(true);
                    }}
                  >
                    Import Prices
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.7fr_1fr] items-end">
                  <div>
                    <p className="font-medium text-blue-900">
                      Showing up to {Math.min(200, filteredBulkModalEntries.length)} missing products.
                    </p>
                    <p className="text-xs text-blue-800">
                      Complete the required fields and click Save All.
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-700 mb-1">Min Orders</label>
                    <input
                      type="number"
                      placeholder="Min"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      value={missingMinOrders}
                      onChange={(e) => setMissingMinOrders(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-700 mb-1">Max Orders</label>
                    <input
                      type="number"
                      placeholder="Max"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      value={missingMaxOrders}
                      onChange={(e) => setMissingMaxOrders(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-700 mb-1">Search</label>
                    <input
                      type="text"
                      placeholder="Supplier or product"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      value={missingSearch}
                      onChange={(e) => setMissingSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Orders</th>
                      <th className="px-3 py-2 text-left">Price Before GST</th>
                      <th className="px-3 py-2 text-left">GST %</th>
                      <th className="px-3 py-2 text-left">Price After GST</th>
                      <th className="px-3 py-2 text-left">HSN</th>
                      <th className="px-3 py-2 text-left">Effective From</th>
                      <th className="px-3 py-2 text-left">Effective To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBulkModalEntries.slice(0, 200).map((entry, index) => {
                      // Key format: supplierName_productName (as per documentation)
                      const key = `${entry.supplier_name}_${entry.product_name}`;
                      const row = bulkEdits[key] || {};
                      return (
                        <tr key={`${key}-${index}`} className="border-t border-gray-100">
                          <td className="px-3 py-2 max-w-[180px] text-gray-900">{entry.supplier_name}</td>
                          <td className="px-3 py-2 max-w-[260px] text-gray-800">{entry.product_name}</td>
                          <td className="px-3 py-2 text-yellow-700 font-semibold">{entry.order_count}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full border border-gray-200 rounded px-2 py-1"
                              value={row.price_before_gst || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "price_before_gst", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full border border-gray-200 rounded px-2 py-1"
                              value={row.gst_rate || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "gst_rate", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full border border-gray-200 rounded px-2 py-1 bg-gray-50"
                              value={row.price_after_gst || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "price_after_gst", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              className="w-full border border-gray-200 rounded px-2 py-1"
                              value={row.hsn_code || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "hsn_code", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1"
                              value={row.effective_from || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "effective_from", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1"
                              value={row.effective_to || ""}
                              onChange={(e) =>
                                updateBulkEdit(key, "effective_to", e.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={closeMissingBulkModal}
                  className="text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAllMissingPrices}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? "Saving..." : "Save All"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-green-600">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Calculator className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Price & HSN Management
              </h1>
              <p className="text-green-600 font-medium">
                Manage Product Prices, HSN Codes & Bulk Operations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="border-2 border-green-200 rounded-lg shadow-xl overflow-hidden">
          <div className="bg-green-600 text-white p-6">
            <h2 className="text-xl font-semibold">Price & HSN Management</h2>
            <p className="text-green-100">
              Upload and manage product prices with HSN codes
            </p>
          </div>
          <div className="p-8 bg-white space-y-6">
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Tags className="text-green-600 text-xl" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Price/HSN Management
                </h2>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => setShowBulkImportModal(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Import CSV/Excel
                </Button>
                <Button
                  variant="outline"
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  onClick={handleDownloadProductDatabase}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Product Database
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleOpenModal()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Price/HSN Entry
                </Button>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      Total Price Entries
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {filteredEntries.length}
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">
                      Active Suppliers
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {activeSuppliersCount}
                    </p>
                  </div>
                  <Tags className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-700">
                      Pricing Basis
                    </p>
                    <Select
                      value={pricingBasis}
                      onValueChange={setPricingBasis}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivered_date">
                          Delivered Date
                        </SelectItem>
                        <SelectItem value="order_date">Order Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Missing entries alert */}
            {(() => {
              console.log("🎨 Rendering - Missing Entries Count:", missingEntries.length);
              return null;
            })()}
            {missingEntries.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="bg-yellow-100 rounded-full p-2">
                      <Tags className="h-5 w-5 text-yellow-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                      Missing Price/HSN Entries Found
                    </h3>
                    <p className="text-sm text-yellow-800 mb-4">
                      Aapke uploaded order data mein{" "}
                      <strong>{missingEntries.length}</strong> products hain jinke liye
                      price missing hai. Neeche jo products dikh rahe hain, unpe click
                      karke directly price entry kar sakte hain.
                    </p>
                    <p className="text-sm font-medium text-yellow-900 mb-3">
                      Click on any product to add its price:
                    </p>

                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {missingEntries.slice(0, 200).map((entry, index) => (
                          <div
                            key={`${entry.supplier_name}-${entry.product_name}-${index}`}
                            className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm hover:shadow transition-all w-full overflow-hidden"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              {/* Text content - stacked vertically */}
                              <div className="flex-1 min-w-0 max-w-full">
                                <p className="font-semibold text-gray-900 text-base truncate" title={entry.supplier_name}>
                                  {entry.supplier_name}
                                </p>
                                <p className="text-gray-700 text-sm truncate mt-1" title={entry.product_name}>
                                  {entry.product_name}
                                </p>
                                <p className="text-yellow-700 text-sm font-medium mt-1 truncate">
                                  {entry.order_count} orders pending
                                </p>
                              </div>
                              
                              {/* Buttons - always visible */}
                              <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap px-4"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({
                                    title: "Product details",
                                    description: `${entry.supplier_name} – ${entry.product_name}`,
                                  });
                                }}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap px-4"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAdd(entry);
                                }}
                              >
                                Add Price
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <Button
                        variant="outline"
                        className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        onClick={openMissingBulkModal}
                      >
                        Add All Prices
                      </Button>
                      <Button
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        onClick={() => handleOpenModal()}
                      >
                        Add Single Entry
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        onClick={handleDownloadTemplate}
                      >
                        Download CSV Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 gap-4">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="font-semibold">Filter by Supplier:</span>
                <Select
                  value={selectedSupplier}
                  onValueChange={setSelectedSupplier}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-600">
                Showing {filteredEntries.length} price entries
              </div>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Supplier</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Price Before GST (INR)</TableHead>
                    <TableHead>GST Rate (%)</TableHead>
                    <TableHead>Price After GST (INR)</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <p className="text-lg font-medium text-gray-600">
                          No Price/HSN Entries Found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {entry.supplier_name}
                        </TableCell>
                        <TableCell>{entry.product_name}</TableCell>
                        <TableCell>{entry.currency}</TableCell>
                        <TableCell className="font-medium">
                          ₹{parseFloat(String(entry.price_before_gst)).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium text-center">
                          {parseFloat(String(entry.gst_rate)).toFixed(1)}%
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{parseFloat(String(entry.price_after_gst)).toFixed(2)}
                        </TableCell>
                        <TableCell>{entry.hsn}</TableCell>
                        <TableCell className="text-gray-600">
                          {formatDate(entry.effective_from)} to{" "}
                          {formatDate(entry.effective_to)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenModal(entry)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showPriceModal} onOpenChange={setShowPriceModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Tags className="h-5 w-5 text-green-600" />
              <span>
                {editingEntry
                  ? "Edit Price/HSN Entry"
                  : "Add New Price/HSN Entry"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">
                Basic Information
              </h4>

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Supplier <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(value) => handleFormChange("supplier_id", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a supplier..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                {/* Product Name Field with Loading State */}
                <Label className="text-sm font-medium text-gray-700">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                {isFetchingProducts ? (
                   <div className="mt-1 flex items-center space-x-2 p-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500">
                     <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-sm">Loading products...</span>
                   </div>
                ) : supplierProducts.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={form.product_name}
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setSupplierProducts([]); // Switch to input mode
                        } else {
                          handleFormChange("product_name", value);
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a product..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]">
                        {supplierProducts.map((product, index) => (
                          <SelectItem key={index} value={product}>
                            <span className="truncate block max-w-[calc(var(--radix-select-trigger-width)-2rem)]" title={product}>
                              {product}
                            </span>
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="text-blue-600 font-medium">
                          ➕ Enter custom product name...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {supplierProducts.length} product(s) found for this supplier
                    </p>
                  </div>
                ) : (
                  <Input
                    value={form.product_name}
                    onChange={(e) =>
                      handleFormChange("product_name", e.target.value)
                    }
                    placeholder={form.supplier_id ? "Enter product name" : "Select a supplier first"}
                    className="mt-1"
                    required
                    disabled={!form.supplier_id}
                  />
                )}
              </div>
            </div>

            {/* Pricing Details */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">
                Pricing Details
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Currency
                  </Label>
                  <Select
                    value={form.currency}
                    onValueChange={(value) =>
                      handleFormChange("currency", value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">🇮🇳 INR (Indian Rupee)</SelectItem>
                      <SelectItem value="USD">🇺🇸 USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Price Before GST
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_before_gst}
                    onChange={(e) =>
                      handleFormChange("price_before_gst", e.target.value)
                    }
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    GST Rate (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.gst_rate}
                    onChange={(e) =>
                      handleFormChange("gst_rate", e.target.value)
                    }
                    placeholder="18"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Price After GST
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_after_gst}
                    onChange={(e) =>
                      handleFormChange("price_after_gst", e.target.value)
                    }
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  HSN Code
                </Label>
                <Input
                  value={form.hsn_code}
                  onChange={(e) => handleFormChange("hsn_code", e.target.value)}
                  placeholder="Enter HSN code (8 digits)"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Validity Period */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">
                Validity Period
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Effective From
                  </Label>
                  <Input
                    type="date"
                    value={form.effective_from}
                    onChange={(e) =>
                      handleFormChange("effective_from", e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Effective To (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={form.effective_to}
                    onChange={(e) =>
                      handleFormChange("effective_to", e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPriceModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Saving..."
                  : editingEntry
                  ? "Update Entry"
                  : "Save Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={showBulkImportModal} onOpenChange={setShowBulkImportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>Bulk Import CSV/Excel</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 overflow-x-hidden">
            {/* Download Excel Template */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 text-lg mb-1">Download Excel Template</h4>
                  <p className="text-sm text-gray-600">
                    Get Excel file with GST calculations and all missing products
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="bg-green-50 border-2 border-blue-500 text-green-700 hover:bg-green-100 rounded-full px-6 py-2 font-medium"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Excel (.xlsx)
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 overflow-hidden">
              <h4 className="font-medium text-blue-900 mb-2">How to Bulk Import:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside break-words">
                <li>Download the Excel template or prepare a CSV file</li>
                <li>Required columns: <strong>Supplier Name</strong>, <strong>Product Name</strong>, <strong>Price Before GST</strong>, <strong>GST Rate (%)</strong>, <strong>HSN Code</strong>, <strong>Effective From</strong></li>
                <li>Optional columns: <strong>Currency</strong> (default: INR), <strong>Effective To</strong></li>
                <li>Save as CSV format and upload</li>
              </ul>
            </div>

            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                  setSelectedFile(file);
                } else {
                  toast({
                    title: "Invalid File",
                    description: "Please upload a CSV or Excel file",
                    variant: "destructive",
                  });
                }
              }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                id="bulk-upload-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              <label htmlFor="bulk-upload-file" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {selectedFile ? selectedFile.name : 'Drop File Here or Click to Upload'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports CSV, XLS, XLSX files
                </p>
              </label>
            </div>

            {/* Progress Bar */}
            {isBulkUploading && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-blue-700">{uploadStage}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center">{uploadProgress}%</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowBulkImportModal(false);
                  setSelectedFile(null);
                  setIsBulkUploading(false);
                  setUploadProgress(0);
                  setUploadStage("");
                }}
                disabled={isBulkUploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleBulkUpload}
                disabled={!selectedFile || isBulkUploading}
              >
                {isBulkUploading ? "Uploading..." : "Upload & Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
