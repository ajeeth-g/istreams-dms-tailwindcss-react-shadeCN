import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FilePen,
  SquarePenIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PacmanLoader } from "react-spinners";
import { useAuth } from "../contexts/AuthContext";
import { deleteDMSMaster, getDocMasterList } from "../services/dmsService";
import DocumentFormModal from "./dialog/DocumentFormModal";
import DocumentUploadModal from "./dialog/DocumentUploadModal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const DocumentTable = ({ fetchDataRef, globalFilter, setGlobalFilter }) => {
  const { userData } = useAuth();
  const CURRENT_USER_LOGIN = userData.currentUserLogin;

  const { toast } = useToast();
  const modalRefForm = useRef(null);
  const modalRefUpload = useRef(null);

  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const fetchDocsMasterList = useCallback(async () => {
    setLoading(true);
    try {
      const payload = {
        WhereCondition: "",
        Orderby: "REF_SEQ_NO DESC",
        IncludeEmpImage: false,
      };

      const response = await getDocMasterList(
        payload,
        CURRENT_USER_LOGIN,
        userData.clientURL
      );

      const enriched = (Array.isArray(response) ? response : []).map((doc) => ({
        ...doc,
        uploadedDocs: Array.isArray(doc.uploadedDocs) ? doc.uploadedDocs : [],
        IsPrimaryDocument: "",
      }));

      setMasterData(enriched);
      setError(null);
      return enriched;
    } catch (err) {
      console.error("Error fetching master data:", err);
      setError(err.message || "Error fetching data");
      return [];
    } finally {
      setLoading(false);
    }
  }, [CURRENT_USER_LOGIN, userData.clientURL]);

  // Initial data load
  useEffect(() => {
    fetchDocsMasterList();
  }, [fetchDocsMasterList]);

  // Expose fetch function to parent via ref for external refresh
  useEffect(() => {
    if (fetchDataRef) {
      fetchDataRef.current = fetchDocsMasterList;
    }
  }, [fetchDataRef, fetchDocsMasterList]);

  const onUploadSuccess = () => {
    fetchDocsMasterList();
    if (modalRefUpload?.current) {
      modalRefUpload.current.close();
    } else {
      console.error("Upload modal element not found");
    }
  };

  const canCurrentUserEdit = (doc) => {
    if (doc?.USER_NAME !== userData.currentUserName)
      return "Access Denied: This document is created by another user.";

    const status = doc?.DOCUMENT_STATUS?.toUpperCase();
    if (status === "VERIFIED")
      return "Access Denied: This document has been verified and approved for processing.";
    if (status === "AWAITING FOR USER ACCEPTANCE")
      return `Access Denied: This document has been assigned to ${doc.ASSIGNED_USER}.`;
    if (status === "IN PROGRESS")
      return "Access Denied: This document is in progress status.";
    if (status === "COMPLETED")
      return "Access Denied: This document has been processed and completed.";
    return "";
  };

  const handleOpenUpload = useCallback((doc) => {
    setSelectedDocument(doc);
    if (modalRefUpload?.current) {
      modalRefUpload.current.showModal();
    } else {
      console.error("Form modal element not found");
    }
  }, []);

  const handleOpenForm = useCallback((doc) => {
    setSelectedDocument(doc);
    if (modalRefForm?.current) {
      modalRefForm.current.showModal();
    } else {
      console.error("Form modal element not found");
    }
  }, []);

  const handleDelete = useCallback(
    async (doc) => {
      const errorMsg = canCurrentUserEdit(doc);
      if (errorMsg) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: errorMsg,
        });
        return;
      }

      if (!window.confirm("Are you sure you want to delete this document?"))
        return;

      try {
        const payload = {
          USER_NAME: doc.USER_NAME,
          REF_SEQ_NO: doc.REF_SEQ_NO,
        };
        const response = await deleteDMSMaster(
          payload,
          CURRENT_USER_LOGIN,
          userData.clientURL
        );

        setMasterData((prevData) =>
          prevData.filter((item) => item.REF_SEQ_NO !== doc.REF_SEQ_NO)
        );

        toast({
          variant: "destructive",
          title: "Document deleted successfully.",
          description:
            typeof response === "string" ? response : "Document deleted.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: error?.message || "Unknown error occurred.",
        });
      }
    },
    [CURRENT_USER_LOGIN, userData.clientURL, toast]
  );

  const columns = useMemo(
    () => [
      {
        header: () => <p className="truncate w-full">Ref No</p>,
        size: 80,
        accessorKey: "REF_SEQ_NO",
        cell: (info) => info.getValue() || "-",
      },
      {
        header: () => <p className="truncate w-full">Document Name</p>,
        size: 300,
        accessorKey: "DOCUMENT_DESCRIPTION",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <div>
              <p className="text-[10px] font-semibold text-gray-500">
                {row.original.DOCUMENT_NO}
              </p>
              <p className="text-xs font-semibold">
                {row.getValue("DOCUMENT_DESCRIPTION")}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: () => <p className="truncate w-full">Uploader</p>,
        size: 150,
        accessorKey: "USER_NAME",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <div>
              <p className="text-xs font-semibold">
                {row.getValue("USER_NAME")}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: () => <p className="truncate w-full">Channel Source</p>,
        size: 100,
        accessorKey: "CHANNEL_SOURCE",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <div>
              <p className="text-xs font-semibold">
                {(row.getValue("CHANNEL_SOURCE") || "").trim() === ""
                  ? userData.organization
                  : row.getValue("CHANNEL_SOURCE")}
              </p>
            </div>
          </div>
        ),
      },
      {
        header: () => <p className="truncate w-full">Related to</p>,
        size: 100,
        accessorKey: "DOC_RELATED_TO",
        cell: (info) => info.getValue() || "-",
      },
      {
        header: () => <p className="truncate w-full">Category</p>,
        size: 200,
        accessorKey: "DOC_RELATED_CATEGORY",
        cell: ({ row }) => (
          <p className="truncate hover:text-clip">
            {row.getValue("DOC_RELATED_CATEGORY") || "-"}
          </p>
        ),
      },

      {
        header: () => <p className="truncate w-full">Status</p>,
        size: 100,
        accessorKey: "DOCUMENT_STATUS",
        cell: (info) => (info.getValue() ? info.getValue() : <span>-</span>),
      },
      {
        header: () => <p className="truncate w-full">Assigned to</p>,
        size: 100,
        accessorKey: "ASSIGNED_USER",
        cell: (info) => (info.getValue() ? info.getValue() : <span>-</span>),
      },
      {
        header: () => (
          <p className="text-xs font-semibold text-gray-600 text-right w-full">
            Docs
          </p>
        ),
        accessorKey: "NO_OF_DOCUMENTS",
        size: 50,
        cell: (info) => {
          const value = info.getValue();
          const rowData = info.row.original;

          return (
            <div className="flex items-center justify-end gap-1">
              {value > 0 ? (
                <button
                  onClick={() => handleOpenUpload(rowData)}
                  className="flex items-center gap-1"
                  title="Upload/View Documents"
                >
                  <Badge className="bg-green-500 text-white rounded-full text-[10px] font-bold px-2 py-[2px]">
                    {value}
                  </Badge>
                  <FilePen className="h-4 w-4" />
                </button>
              ) : (
                <Button
                  onClick={() => handleOpenUpload(rowData)}
                  variant="ghost"
                  size="icon"
                  title="Upload Document"
                  className="h-6 w-6"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
      {
        header: () => <p className="truncate w-full">Action</p>,
        id: "actions",
        size: 50,
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div className="flex items-center gap-2">
              <button onClick={() => handleOpenForm(doc)}>
                <SquarePenIcon className="h-4 w-4" />
              </button>
              <button
                className="text-red-600"
                onClick={() => handleDelete(doc)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [handleDelete, handleOpenUpload, handleOpenForm]
  );

  // Global filter function
  const globalFilterFn = useCallback((row, columnId, filterValue) => {
    return Object.values(row.original)
      .filter((val) => typeof val === "string" || typeof val === "number")
      .some((val) =>
        String(val).toLowerCase().includes(String(filterValue).toLowerCase())
      );
  }, []);

  // Initialize TanStack table
  const table = useReactTable({
    data: masterData,
    columns,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    getExpandedRowModel: getExpandedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-100 transition-colors dark:bg-slate-950 ">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.column.getSize() }}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {!header.isPlaceholder &&
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-slate-100 transition-colors dark:bg-slate-950 divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="12" className="text-center py-4">
                  <PacmanLoader color="#6366f1" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="12"
                  className="text-center text-sm text-red-500 py-4"
                >
                  Error: {error}
                </td>
              </tr>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.original.REF_SEQ_NO}
                  className="hover:bg-slate-200 cursor-pointer dark:hover:bg-slate-900"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={`${row.original.REF_SEQ_NO}-${cell.column.id}`}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="12"
                  className="text-sm text-center py-4 text-gray-500"
                >
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded border hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            className="p-2 rounded border hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-4 text-sm text-gray-700">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <button
            className="p-2 rounded border hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            className="p-2 rounded border hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Go to page:</span>
          <Input
            type="number"
            placeholder="Page"
            className="w-16 px-2 py-1 border rounded text-sm"
            min="1"
            max={table.getPageCount()}
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0;
              table.setPageIndex(page);
            }}
          />

          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(val) => table.setPageSize(Number(val))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Rows per page</SelectLabel>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={String(pageSize)}>
                    Show {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DocumentFormModal
        modalRefForm={modalRefForm}
        selectedDocument={selectedDocument}
        onUploadSuccess={fetchDocsMasterList}
      />

      {/* Modal for Document Upload */}
      <DocumentUploadModal
        modalRefUpload={modalRefUpload}
        selectedDocument={selectedDocument}
        onUploadSuccess={fetchDocsMasterList}
      />
    </>
  );
};

export default DocumentTable;
