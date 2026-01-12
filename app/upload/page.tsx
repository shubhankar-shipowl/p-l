"use client";

import React, { useState, DragEvent, ChangeEvent } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Database,
  Package,
  Truck,
  Download,
  Eye,
} from "lucide-react";

type UploadType = "orders" | "shipping";

interface UploadedFile {
  file: File | null;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  progress?: number;
}

const uploadCards = [
  {
    id: "orders",
    title: "Orders Data",
    description: "",
    icon: Package,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    endpoint: "/api/upload/orders",
    requiredColumns: [
      "Channel Order Date",
      "Fulfilled By",
      "Delivered Date",
      "Product Name",
      "Order Amount",
      "Pickup Warehouse",
      "Order Account",
      "WayBill Number",
      "Product Value",
      "Mode",
      "Status"
    ],
  },
  {
    id: "shipping",
    title: "Shipping Costs",
    description: "",
    icon: Truck,
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    endpoint: "/api/upload/shipping-costs",
    requiredColumns: [
      "Fulfilled By",
      "Shipping Cost"
    ],
  },
];

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<Record<UploadType, UploadedFile>>({
    orders: { file: null, status: "idle" },
    shipping: { file: null, status: "idle" },
  });
  const [dragActive, setDragActive] = useState<Record<UploadType, boolean>>({
    orders: false,
    shipping: false,
  });

  const allFilesUploaded =
    uploadedFiles.orders.status === "success" &&
    uploadedFiles.shipping.status === "success";

  const handleDrag = (e: DragEvent, type: UploadType) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive({ ...dragActive, [type]: true });
    } else if (e.type === "dragleave") {
      setDragActive({ ...dragActive, [type]: false });
    }
  };

  const validateFile = (file: File) => {
    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
    const fileName = file.name.toLowerCase();
    const isValidType = 
      file.type === "text/csv" || 
      fileName.endsWith(".csv") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";
    
    if (!isValidType) {
      return "Please upload a CSV or Excel file (.csv, .xlsx, .xls)";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 200 MB";
    }
    return null;
  };

  const handleFile = (file: File, type: UploadType) => {
    const error = validateFile(file);
    if (error) {
      setUploadedFiles({
        ...uploadedFiles,
        [type]: { file: null, status: "error", message: error },
      });
      return;
    }
    setUploadedFiles({
      ...uploadedFiles,
      [type]: { file, status: "idle", message: undefined },
    });
  };

  const handleDrop = (e: DragEvent, type: UploadType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive({ ...dragActive, [type]: false });
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0], type);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>, type: UploadType) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0], type);
    }
  };

  const removeFile = (type: UploadType) => {
    setUploadedFiles({
      ...uploadedFiles,
      [type]: { file: null, status: "idle", message: undefined },
    });
  };

  const uploadFile = async (type: UploadType) => {
    const config = uploadCards.find((c) => c.id === type);
    const selected = uploadedFiles[type];
    if (!config || !selected.file) return;

    setUploadedFiles({
      ...uploadedFiles,
      [type]: { ...selected, status: "uploading", message: "Uploading...", progress: 0 },
    });

    const formData = new FormData();
    formData.append("file", selected.file);

    try {
      // Simulate progress for large files
      const progressInterval = setInterval(() => {
        setUploadedFiles((prev) => {
          const current = prev[type];
          if (current.status === "uploading" && current.progress !== undefined) {
            const newProgress = Math.min(current.progress + 10, 90);
            return {
              ...prev,
              [type]: { ...current, progress: newProgress },
            };
          }
          return prev;
        });
      }, 200);

      const res = await fetch(config.endpoint, { method: "POST", body: formData });
      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || "Upload failed");
      }

      const result = await res.json();
      
      // Set progress to 100% on success
      setUploadedFiles((prev) => ({
        ...prev,
        [type]: { 
          ...prev[type], 
          status: "success", 
          message: result.message || "Uploaded successfully",
          progress: 100,
        },
      }));
    } catch (err: any) {
      setUploadedFiles({
        ...uploadedFiles,
        [type]: { 
          ...selected, 
          status: "error", 
          message: err.message || "Upload failed",
          progress: 0,
        },
      });
    }
  };

  const uploadAll = async () => {
    for (const type of ["orders", "shipping"] as UploadType[]) {
      const selected = uploadedFiles[type];
      if (selected.file && selected.status !== "success") {
        // eslint-disable-next-line no-await-in-loop
        await uploadFile(type);
      }
    }
  };

  const completedCount = ["orders", "shipping"].filter(
    (t) => uploadedFiles[t as UploadType].status === "success"
  ).length;

  const fileSizeKb = (file?: File | null) =>
    file ? `${(file.size / 1024).toFixed(2)} KB` : "";

  const handleDownloadTemplate = (type: UploadType) => {
    const config = uploadCards.find((c) => c.id === type);
    if (!config || !config.requiredColumns) return;

    const csvContent = config.requiredColumns.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${config.title.toLowerCase().replace(/\s+/g, "_")}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-10">
      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Header */}
        <div className="sticky top-0 z-40 -mx-6 px-6 pb-4 bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Upload Data
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Upload your CSV files to populate the dashboard
              </p>
            </div>
            <button
              onClick={uploadAll}
              disabled={!completedCount}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Database className="w-4 h-4" />
              Process Data
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {completedCount} of 2 files uploaded
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploadCards.map((card) => {
              const status = uploadedFiles[card.id as UploadType].status;
              const isDone = status === "success";
              return (
                <div key={card.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDone ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{card.title}</p>
                      <p className="text-xs text-gray-500">
                        {isDone ? "Uploaded" : "Pending"}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isDone ? "bg-gradient-to-r from-green-500 to-green-600 w-full" : "w-0"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {uploadCards.map((card) => {
            const current = uploadedFiles[card.id as UploadType];
            const Icon = card.icon;
            const isDrag = dragActive[card.id as UploadType];
            const hasFile = !!current.file;

            return (
              <div
                key={card.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${card.color} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-semibold">{card.title}</h3>
                    </div>
                    <button
                      onClick={() => handleDownloadTemplate(card.id as UploadType)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors border border-white/20 backdrop-blur-sm"
                      title="Download CSV Template"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Template
                    </button>
                  </div>
                </div>

                {/* Upload Area */}
                <div className="p-4 flex flex-col gap-4 flex-1">
                  {!hasFile ? (
                    <div
                      onDragEnter={(e) => handleDrag(e, card.id as UploadType)}
                      onDragLeave={(e) => handleDrag(e, card.id as UploadType)}
                      onDragOver={(e) => handleDrag(e, card.id as UploadType)}
                      onDrop={(e) => handleDrop(e, card.id as UploadType)}
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                        isDrag
                          ? `${card.bgColor} ${card.borderColor}`
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center ${card.iconBg} ${card.iconColor}`}
                        >
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-gray-700 font-semibold">
                          Drag & drop your CSV file
                        </div>
                        <div className="text-sm text-gray-500">or</div>
                        <label
                          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r ${card.color} rounded-lg shadow hover:shadow-md cursor-pointer transition-all`}
                        >
                          <Upload className="w-4 h-4" />
                          Choose CSV File
                          <input
                            aria-label={`${card.title} file input`}
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            className="hidden"
                            onChange={(e) => handleFileInput(e, card.id as UploadType)}
                          />
                        </label>
                        <p className="text-xs text-gray-500">Max size: 200 MB. CSV, XLS, XLSX files.</p>
                        {current.message && current.status === "error" && (
                          <div className="text-xs text-red-600 flex items-center gap-2 justify-center">
                            <AlertCircle className="w-4 h-4" />
                            {current.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`${card.bgColor} ${card.borderColor} border rounded-xl p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full ${card.iconBg} ${card.iconColor} flex items-center justify-center`}
                          >
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {current.file?.name}
                            </p>
                            <p className="text-xs text-gray-600">{fileSizeKb(current.file)}</p>
                            {current.status === "success" && (
                              <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                <CheckCircle className="w-4 h-4" />
                                Uploaded successfully
                              </div>
                            )}
                            {current.status === "error" && (
                              <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-4 h-4" />
                                {current.message || "Upload failed"}
                              </div>
                            )}
                            {current.status === "uploading" && (
                              <div className="w-full mt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-blue-600">Uploading...</span>
                                  <span className="text-xs text-blue-600 font-medium">{current.progress || 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${current.progress || 0}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(card.id as UploadType)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          disabled={current.status === "uploading"}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <button
                          onClick={() => uploadFile(card.id as UploadType)}
                          disabled={current.status === "uploading"}
                          className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
                        >
                          {current.status === "uploading" ? "Uploading..." : "Upload"}
                        </button>
                        <label className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                          Replace
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            className="hidden"
                            onChange={(e) => handleFileInput(e, card.id as UploadType)}
                          />
                        </label>
                        <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Required Columns */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Required Columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {card.requiredColumns?.map((col, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-white border border-gray-300 rounded text-gray-700 font-medium"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Requirements */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">File Requirements</h3>
                <p className="text-sm text-gray-600">Ensure your files meet these rules</p>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                "Files must be in CSV format (.csv)",
                "Column names must match exactly as specified",
                "Date format should be YYYY-MM-DD (e.g., 2024-01-15)",
                "Numeric values should not include currency symbols",
                "Maximum file size: 200 MB per file",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Status */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 shadow-md text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Ready to Process?</h3>
                <p className="text-sm text-blue-100">Upload all files to continue</p>
              </div>
              <Database className="w-6 h-6 text-white/80" />
            </div>
            <div className="space-y-2">
              {uploadCards.map((card) => {
                const done = uploadedFiles[card.id as UploadType].status === "success";
                return (
                  <div
                    key={card.id}
                    className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full border ${
                          done ? "bg-green-500 border-green-500" : "border-white/50"
                        } flex items-center justify-center`}
                      >
                        {done && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm">{card.title}</span>
                    </div>
                    <span className="text-xs text-white/80">{done ? "Ready" : "Pending"}</span>
                  </div>
                );
              })}
            </div>
            {allFilesUploaded && (
              <div className="mt-4 bg-green-500/20 border border-green-400/60 text-green-50 rounded-lg p-3 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                All files ready! Click Process Data to continue.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

