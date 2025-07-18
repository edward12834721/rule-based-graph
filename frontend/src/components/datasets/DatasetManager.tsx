"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { io } from "socket.io-client"; // Socket.IO client
import { useRouter } from 'next/navigation';
const backendUrl = process.env.NEXT_PUBLIC_API_URL;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DatasetManager: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [datasets, setDatasets] = useState<any>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [filtered, setFiltered] = useState<any>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDataset, setNewDataset] = useState({
    tableName: '',
    characterSet: '',
    rowData: ''
  });
  const router = useRouter();
  // Fetch initial data on mount
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/');
    }
    fetchData();
  }, []);

  // Real-time Socket.IO updates
  useEffect(() => {
    const user = localStorage.getItem('user')
    const stored = JSON.parse(user || '{}');
    if (!stored || stored.role === "Viewer") {
      router.push('/');
    }

    const socket = io("http://localhost:5000");

    socket.on("graphUpdated", () => {
      console.log("Received graphUpdated event");
      fetchData(); // Refresh dataset list
    });

    return () => {
      socket.disconnect(); // Clean up on unmount
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const res = await axios.get(`${backendUrl}//api/datasets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDatasets(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearch(term);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredResults = datasets.filter((d: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(d.rowData || {}).some((v: any) =>
        v.toString().toLowerCase().includes(term.toLowerCase())
      )
    );
    setFiltered(filteredResults);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginatedData = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleAddDataset = async () => {
    try {
      const payload = {
        tableName: newDataset.tableName,
        rowData: JSON.parse(newDataset.rowData),
        characterSet: newDataset.characterSet || "utf-8", // optional fallback
      };

      const token = localStorage.getItem("token");

      const res = await axios.post(`${backendUrl}/api/datasets`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDatasets((prev: any[]) => [...prev, res.data]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFiltered((prev: any[]) => [...prev, res.data]);
      setShowAddModal(false);
      setNewDataset({ tableName: "", characterSet: "", rowData: "" });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        alert("Failed to add dataset: " + err.response?.data?.message);
      } else {
        alert("Failed to add dataset");
      }
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const parsedRowData = JSON.parse(editRowData || "{}");

      // OPTIONAL: Auto-update characterSet based on new rowData
      const newCharacterSet = Object.values(parsedRowData)
        .map((v) => v?.toString().trim())
        .filter(Boolean);

      const token = localStorage.getItem("token"); // Or however you store the token

      const res = await axios.put(`${backendUrl}/api/datasets/${id}`, {
        rowData: parsedRowData,
        characterSet: newCharacterSet,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      // Optionally: Trigger relationship recalculation here if you have such a backend
      // await axios.post('/api/relationships/recalculate', { datasetId: id });

      // Update local state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDatasets((prev: any) => prev.map((d: any) => (d._id === id ? res.data : d)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFiltered((prev: any) => prev.map((d: any) => (d._id === id ? res.data : d)));

      setEditRow(null);
      setEditRowData("");
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    let confirmed = true;
    if (typeof window !== "undefined") {
      confirmed = window.confirm("Are you sure you want to delete this dataset?");
    }
    if (!confirmed) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${backendUrl}/api/datasets/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDatasets((prev: any) => prev.filter((d: any) => d._id !== id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFiltered((prev: any) => prev.filter((d: any) => d._id !== id));
    } catch (err) {
      alert("Failed to delete dataset" + err);
    }
  };
  // Pagination numbers logic (max 5 numbers + ... if needed)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (currentPage >= totalPages - 2) {
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="p-4 border-t border-gray-100 sm:p-6">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-xl bg-white">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Show</span>
              <div className="relative z-20 bg-transparent">
                <select
                  className="w-full py-2 pl-3 pr-8 text-sm text-gray-800 bg-transparent border border-gray-300 rounded-lg appearance-none h-9 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10"
                  value={rowsPerPage}
                  onChange={e => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="text-gray-500">
                      {opt}
                    </option>
                  ))}
                </select>
                <span className="absolute z-30 text-gray-500 -translate-y-1/2 right-2 top-1/2">
                  <svg className="stroke-current" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3.8335 5.9165L8.00016 10.0832L12.1668 5.9165" stroke="" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </span>
              </div>
              <span className="text-gray-500">entries</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <button className="absolute text-gray-500 -translate-y-1/2 left-4 top-1/2">
                  <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.04199 9.37363C3.04199 5.87693 5.87735 3.04199 9.37533 3.04199C12.8733 3.04199 15.7087 5.87693 15.7087 9.37363C15.7087 12.8703 12.8733 15.7053 9.37533 15.7053C5.87735 15.7053 3.04199 12.8703 3.04199 9.37363ZM9.37533 1.54199C5.04926 1.54199 1.54199 5.04817 1.54199 9.37363C1.54199 13.6991 5.04926 17.2053 9.37533 17.2053C11.2676 17.2053 13.0032 16.5344 14.3572 15.4176L17.1773 18.238C17.4702 18.5309 17.945 18.5309 18.2379 18.238C18.5308 17.9451 18.5309 17.4703 18.238 17.1773L15.4182 14.3573C16.5367 13.0033 17.2087 11.2669 17.2087 9.37363C17.2087 5.04817 13.7014 1.54199 9.37533 1.54199Z" fill=""></path>
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="Search..."
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-11 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 xl:w-[300px]"
                  value={search}
                  onChange={handleSearch}
                />
              </div>
              <button
                className="inline-flex items-center justify-center font-medium gap-2 rounded-lg transition px-4 py-3 text-sm bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={fetchData}
              >
                Refresh
              </button>
              <button
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                onClick={() => setShowAddModal(true)}
              >
                + Add Dataset
              </button>
            </div>
          </div>
          {/* Table */}
          <div className="max-w-full overflow-x-auto custom-scrollbar">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 border border-gray-100">
                    <span className="font-medium text-gray-700">Table Name</span>
                  </th>
                  <th className="px-4 py-3 border border-gray-100">
                    <span className="font-medium text-gray-700">Character Set</span>
                  </th>
                  <th className="px-4 py-3 border border-gray-100">
                    <span className="font-medium text-gray-700">Data Preview</span>
                  </th>
                  <th className="px-4 py-3 border border-gray-100 text-right">
                    <span className="font-medium text-gray-700">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 border border-gray-100 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 border border-gray-100 text-center">
                      No datasets found.
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  paginatedData.map((d: any) => (
                    <tr key={d._id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 border border-gray-100 whitespace-nowrap font-medium text-gray-900">
                        {d.tableName}
                      </td>
                      <td className="px-4 py-4 border border-gray-100 text-gray-600 text-sm max-w-xs">
                        {d.characterSet?.join(", ")}

                      </td>

                      <td className="px-4 py-4 border border-gray-100 text-sm max-w-xs">
                        {editRow === d._id ? (
                          <div className="space-y-2">
                            {Object.entries(JSON.parse(editRowData || "{}")).map(([key, value], index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={key}
                                  onChange={(e) => {
                                    const newData = JSON.parse(editRowData || "{}");
                                    const val = newData[key];
                                    delete newData[key];
                                    newData[e.target.value] = val;
                                    setEditRowData(JSON.stringify(newData, null, 2));
                                  }}
                                  placeholder="Key"
                                  className="w-1/3 border rounded px-2 py-1 text-sm"
                                />

                                <input
                                  type="text"
                                  value={value as string}
                                  onChange={(e) => {
                                    const newData = JSON.parse(editRowData || "{}");
                                    newData[key] = e.target.value;
                                    setEditRowData(JSON.stringify(newData, null, 2));
                                  }}
                                  placeholder="Value"
                                  className="w-1/2 border rounded px-2 py-1 text-sm"
                                />
                                <button
                                  onClick={() => {
                                    const newData = JSON.parse(editRowData || "{}");
                                    delete newData[key];
                                    setEditRowData(JSON.stringify(newData, null, 2));
                                  }}
                                  className="text-error-500 hover:text-red-700"
                                  title="Delete"
                                >
                                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8a2..." />
                                  </svg>
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newData = JSON.parse(editRowData || "{}");
                                let newKey = "newKey";
                                let counter = 1;
                                while (newKey in newData) {
                                  newKey = `newKey${counter++}`;
                                }
                                newData[newKey] = "";
                                setEditRowData(JSON.stringify(newData, null, 2));
                              }}
                              className="mt-2 text-sm text-blue-600 hover:underline"
                            >
                              + Add Field
                            </button>
                          </div>
                        ) : (
                          Object.entries(d.rowData || {})
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        )}
                      </td>

                      <td className="px-4 py-4 font-normal text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm dark:text-white/90 whitespace-nowrap">
                        <AnimatePresence mode="wait">
                          {editRow === d._id ? (
                            <motion.div
                              key="editing"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="flex items-center w-full gap-2"
                            >
                              {/* Save Button */}
                              <button
                                onClick={() => handleSaveEdit(d._id)}
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
                                  <path
                                    fill="currentColor"
                                    d="M10 18.333A8.333 8.333 0 1 0 10 1.667a8.333 8.333 0 0 0 0 16.666zm3.958-9.791a.625.625 0 1 0-.916-.85L9.063 13.21 6.958 11.125a.625.625 0 1 0-.916.85l2.5 2.5a.625.625 0 0 0 .916 0l4.5-4.5z"
                                  />
                                </svg>
                              </button>

                              {/* Cancel Button */}
                              <button
                                onClick={() => setEditRow(null)}
                                className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
                                  <path
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    d="M10 1.667a8.333 8.333 0 1 0 0 16.666A8.333 8.333 0 0 0 10 1.667zM6.813 6.813a.625.625 0 0 1 .884 0L10 9.116l2.302-2.303a.625.625 0 1 1 .884.884L10.884 10l2.302 2.302a.625.625 0 1 1-.884.884L10 10.884l-2.303 2.302a.625.625 0 1 1-.884-.884L9.116 10 6.813 7.697a.625.625 0 0 1 0-.884z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </motion.div>
                          ) : (
                            // Default view with Delete & Edit buttons...
                            <motion.div
                              key="default"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="flex items-center w-full gap-2"
                            >
                              {/* Delete Button */}
                              <button
                                onClick={() => handleDelete(d._id)}
                                className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
                                  <path
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    d="M6.541 3.792a2.25 2.25 0 0 1 2.25-2.25h2.417a2.25 2.25 0 0 1 2.25 2.25v.25h3.208a.75.75 0 0 1 0 1.5h-.29v10.666a2.25 2.25 0 0 1-2.25 2.25h-8.25a2.25 2.25 0 0 1-2.25-2.25V5.541h-.292a.75.75 0 1 1 0-1.5H6.54zm8.334 9.454V5.541h-9.75v10.667c0 .414.336.75.75.75h8.25a.75.75 0 0 0 .75-.75zM8.041 4.041h3.917v-.25a.75.75 0 0 0-.75-.75H8.791a.75.75 0 0 0-.75.75zM8.334 8a.75.75 0 0 1 .75.75v5a.75.75 0 1 1-1.5 0v-5a.75.75 0 0 1 .75-.75m4.083.75a.75.75 0 0 0-1.5 0v5a.75.75 0 1 0 1.5 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setEditRow(d._id);
                                  setEditRowData(JSON.stringify(d.rowData || {}, null, 2));
                                }}
                                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" fill="none">
                                  <path
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    d="M17.091 3.532a2.25 2.25 0 0 0-3.182 0l-8.302 8.302c-.308.308-.52.7-.61 1.126l-.735 3.485a.75.75 0 0 0 .888.889l3.485-.735a2.25 2.25 0 0 0 1.127-.611l8.301-8.302a2.25 2.25 0 0 0 0-3.182zm-2.121 1.06a.75.75 0 0 1 1.06 0l.973.973a.75.75 0 0 1 0 1.06l-.899.899-2.033-2.033zm-1.96 1.96-6.342 6.342a.75.75 0 0 0-.203.376l-.498 2.358 2.358-.497a.75.75 0 0 0 .376-.204l6.343-6.342z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
              <div className="pb-3 xl:pb-0">
                <p className="pb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-100 xl:border-b-0 xl:pb-0 xl:text-left">
                  Showing {filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length} entries
                </p>
              </div>
              <div className="flex flex-col gap-2 items-center justify-center xl:flex-row xl:gap-4">
                <div className="flex items-center">
                  <button
                    disabled={currentPage === 1}
                    className="mr-2.5 flex items-center h-10 justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 text-sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    {pageNumbers[0] > 1 && (
                      <>
                        <button
                          className={`px-4 py-2 rounded flex w-10 items-center justify-center h-10 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-500/[0.08] hover:text-blue-500`}
                          onClick={() => setCurrentPage(1)}
                        >
                          1
                        </button>
                        <span className="px-2">...</span>
                      </>
                    )}
                    {pageNumbers.map((num) => (
                      <button
                        key={num}
                        className={`px-4 py-2 rounded flex w-10 items-center justify-center h-10 rounded-lg text-sm font-medium ${currentPage === num
                          ? "bg-blue-500 text-white"
                          : "text-gray-700 hover:bg-blue-500/[0.08] hover:text-blue-500"
                          }`}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    ))}
                    {pageNumbers[pageNumbers.length - 1] < totalPages && (
                      <>
                        <span className="px-2">...</span>
                        <button
                          className={`px-4 py-2 rounded flex w-10 items-center justify-center h-10 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-500/[0.08] hover:text-blue-500`}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="ml-2.5 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-700 shadow-theme-xs text-sm hover:bg-gray-50 h-10 disabled:opacity-50"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Next
                  </button>
                </div>
                {/* Go to page input */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pageInput = (e.target as any).page.value;
                    const pageNum = Number(pageInput);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                      setCurrentPage(pageNum);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <label htmlFor="page" className="text-sm text-gray-600">
                    Go to page:
                  </label>
                  <input
                    id="page"
                    name="page"
                    type="number"
                    min={1}
                    max={totalPages}
                    defaultValue={currentPage}
                    className="w-16 px-2 py-1 border rounded text-sm"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Add Dataset Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-[90%] max-w-md shadow-xl">
                <h2 className="text-lg font-semibold mb-4">Add New Dataset</h2>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Table Name"
                    value={newDataset.tableName}
                    onChange={e => setNewDataset({ ...newDataset, tableName: e.target.value })}
                    className="w-full p-2 border rounded"
                  />

                  <div className="space-y-2">
                    {Object.entries(JSON.parse(newDataset.rowData || '{}')).map(([key, value], index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newData = JSON.parse(newDataset.rowData || '{}');
                            const val = newData[key];
                            delete newData[key];
                            newData[e.target.value] = val;
                            setNewDataset({ ...newDataset, rowData: JSON.stringify(newData, null, 2) });
                          }}
                          placeholder="Key"
                          className="w-1/3 border rounded px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          value={value as string}
                          onChange={(e) => {
                            const newData = JSON.parse(newDataset.rowData || '{}');
                            newData[key] = e.target.value;
                            setNewDataset({ ...newDataset, rowData: JSON.stringify(newData, null, 2) });
                          }}
                          placeholder="Value"
                          className="w-1/2 border rounded px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            const newData = JSON.parse(newDataset.rowData || '{}');
                            delete newData[key];
                            setNewDataset({ ...newDataset, rowData: JSON.stringify(newData, null, 2) });
                          }}
                          className="text-error-500 hover:text-red-700"
                          title="Delete"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8a2..." />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const newData = JSON.parse(newDataset.rowData || '{}');
                        let newKey = "newKey";
                        let counter = 1;
                        while (newData.hasOwnProperty(newKey)) {
                          newKey = `newKey${counter++}`;
                        }
                        newData[newKey] = "";
                        setNewDataset({ ...newDataset, rowData: JSON.stringify(newData, null, 2) });
                      }}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      + Add Field
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                  <button onClick={handleAddDataset} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default DatasetManager;