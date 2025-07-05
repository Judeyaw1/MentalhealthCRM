import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  X, 
  RefreshCw,
  Download,
  MoreHorizontal,
  Settings,
  Grid3X3,
  List,
  Eye,
  Edit,
  Trash2,
  Copy,
  Star,
  Calendar,
  User,
  Phone,
  Mail
} from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearch?: (query: string) => void;
  onFilter?: (filter: { key: string; value: string }) => void;
  searchPlaceholder?: string;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  isLoading?: boolean;
  onSelectAll?: (checked: boolean) => void;
  selectAllChecked?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onBulkAction?: (action: string) => void;
  selectedCount?: number;
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  showQuickActions?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onSearch,
  onFilter,
  searchPlaceholder = "Search...",
  filters = [],
  isLoading = false,
  onSelectAll,
  selectAllChecked = false,
  onRefresh,
  onExport,
  onBulkAction,
  selectedCount = 0,
  viewMode = "list",
  onViewModeChange,
  showQuickActions = true,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const totalPages = Math.ceil(totalItems / pageSize);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    onFilter?.({ key: filterKey, value });
  };

  const clearSearch = () => {
    setSearchQuery("");
    onSearch?.("");
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  const handleExport = () => {
    onExport?.();
  };

  const handleBulkAction = (action: string) => {
    onBulkAction?.(action);
  };

  const getSearchSuggestions = () => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const suggestions = [];
    const query = searchQuery.toLowerCase();
    
    // Add common search suggestions based on the data
    if (data.length > 0) {
      const firstRow = data[0] as any;
      if (firstRow.firstName && query.includes('name')) {
        suggestions.push('Search by first name');
      }
      if (firstRow.email && query.includes('email')) {
        suggestions.push('Search by email');
      }
      if (firstRow.phone && query.includes('phone')) {
        suggestions.push('Search by phone');
      }
      if (firstRow.status && query.includes('status')) {
        suggestions.push('Filter by status');
      }
    }
    
    return suggestions.slice(0, 3);
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Search and Actions Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search Section */}
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              
              {/* Search Suggestions */}
              {searchFocused && searchQuery && getSearchSuggestions().length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-1">
                  {getSearchSuggestions().map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-600"
                      onClick={() => handleSearch(suggestion)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {showQuickActions && (
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              {onViewModeChange && (
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => onViewModeChange("list")}
                          className="h-8 w-8 p-0"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>List view</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => onViewModeChange("grid")}
                          className="h-8 w-8 p-0"
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Grid view</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* Filter Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="h-8 w-8 p-0"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle filters</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Refresh */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Export */}
              {onExport && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export data</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Settings */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Table settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Filters Section */}
        {showFilters && filters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              {filters.map((filter) => (
                <Select key={filter.key} onValueChange={(value) => handleFilterChange(filter.key, value)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
        )}

        {/* Selected Items Actions */}
        {selectedCount > 0 && onBulkAction && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("export")}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("delete")}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                      More Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkAction("copy")}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction("star")}>
                      <Star className="h-4 w-4 mr-2" />
                      Mark as Important
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkAction("schedule")}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction("assign")}>
                      <User className="h-4 w-4 mr-2" />
                      Assign Therapist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.key === "select" ? "w-12" : ""}>
                  {column.key === "select" && onSelectAll ? (
                    <Checkbox
                      checked={selectAllChecked}
                      onCheckedChange={(checked: boolean) => onSelectAll(checked)}
                    />
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center space-y-2">
                    <Search className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500">No results found</p>
                    {searchQuery && (
                      <Button variant="outline" size="sm" onClick={clearSearch}>
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={index} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render((row as any)[column.key], row)
                        : String((row as any)[column.key] || "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Enhanced Pagination */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm text-gray-700">
          Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{" "}
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
