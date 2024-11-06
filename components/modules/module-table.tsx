"use client";
import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type Version = {
  versionName?: string;
  help?: string;
};

type Module = {
  package?: string;
  versions?: Version | Version[];
};

export const ModuleTable = ({ results }: { results: Module[] }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // Helper function to ensure versions is always an array
  const ensureVersionsArray = (
    versions: Version | Version[] | undefined
  ): Version[] => {
    if (!versions) return [];
    return Array.isArray(versions) ? versions : [versions];
  };

  // Filter results based on searchTerm
  const filteredResults = results.filter((module) => {
    if (!module) return false;
    const packageMatch =
      module.package?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
    const versions = ensureVersionsArray(module.versions);
    const versionMatch = versions.some((version) => {
      if (!version) return false;
      const versionNameMatch =
        version.versionName?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false;
      const helpMatch =
        version.help?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
      return versionNameMatch || helpMatch;
    });
    return packageMatch || versionMatch;
  });

  // Calculate the number of pages
  const pageCount = Math.ceil(filteredResults.length / resultsPerPage);

  // Calculate the slice of data to display
  const indexOfLastItem = currentPage * resultsPerPage;
  const indexOfFirstItem = indexOfLastItem - resultsPerPage;
  const currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);

  // Change page handler
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const TablePagination = () => {
    const renderPageNumbers = () => {
      const maxPagesToShow = 10;
      const paginationItems = [];

      // If there are fewer than or equal to maxPagesToShow pages, show all
      if (pageCount <= maxPagesToShow) {
        for (let number = 1; number <= pageCount; number++) {
          paginationItems.push(
            <PaginationItem key={number}>
              <button onClick={() => paginate(number)}>
                {number === currentPage ? (
                  <PaginationLink isActive>{number}</PaginationLink>
                ) : (
                  <PaginationLink>{number}</PaginationLink>
                )}
              </button>
            </PaginationItem>
          );
        }
      } else {
        // If there are more than maxPagesToShow pages
        // Always show the first page
        paginationItems.push(
          <PaginationItem key={1}>
            <button onClick={() => paginate(1)}>
              {1 === currentPage ? (
                <PaginationLink isActive>{1}</PaginationLink>
              ) : (
                <PaginationLink>{1}</PaginationLink>
              )}
            </button>
          </PaginationItem>
        );

        // Determine start and end pages for the current range
        let startPage, endPage;
        if (currentPage <= 6) {
          // Show first 10 pages
          startPage = 2;
          endPage = 9;
        } else if (currentPage + 4 >= pageCount) {
          // Show last 10 pages
          startPage = pageCount - 8;
          endPage = pageCount - 1;
        } else {
          // Show current page in the middle
          startPage = currentPage - 4;
          endPage = currentPage + 4;
        }

        // Add ellipsis after the first page if needed
        if (startPage > 2) {
          paginationItems.push(
            <PaginationItem key="start-ellipsis">
              <PaginationEllipsis />
            </PaginationItem>
          );
        }

        // Add the page numbers in the calculated range
        for (let number = startPage; number <= endPage; number++) {
          paginationItems.push(
            <PaginationItem key={number}>
              <button onClick={() => paginate(number)}>
                {number === currentPage ? (
                  <PaginationLink isActive>{number}</PaginationLink>
                ) : (
                  <PaginationLink>{number}</PaginationLink>
                )}
              </button>
            </PaginationItem>
          );
        }

        // Add ellipsis before the last page if needed
        if (endPage < pageCount - 1) {
          paginationItems.push(
            <PaginationItem key="end-ellipsis">
              <PaginationEllipsis />
            </PaginationItem>
          );
        }

        // Always show the last page
        paginationItems.push(
          <PaginationItem key={pageCount}>
            <button onClick={() => paginate(pageCount)}>
              {pageCount === currentPage ? (
                <PaginationLink isActive>{pageCount}</PaginationLink>
              ) : (
                <PaginationLink>{pageCount}</PaginationLink>
              )}
            </button>
          </PaginationItem>
        );
      }

      return paginationItems;
    };

    return (
      <div className="mt-2 mb-14">
        <Pagination>
          <PaginationContent>{renderPageNumbers()}</PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className="mt-5 w-[90%] mx-auto max-w-[1200px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Input
          type="text"
          placeholder="Search for Module or Version"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="border rounded-md"
        />
        <Select
          onValueChange={(value: any) => {
            setResultsPerPage(value);
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder={resultsPerPage} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={"10"}>10</SelectItem>
              <SelectItem value={"25"}>25</SelectItem>
              <SelectItem value={"50"}>50</SelectItem>
              <SelectItem value={"100"}>100</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Table className="bg-black/30 rounded-md mx-auto">
        <TableHeader className="bg-card">
          <TableRow>
            <TableHead className="w-[200px]">Module Name</TableHead>
            <TableHead className="w-[150px]">Versions</TableHead>
            <TableHead className="w-[400px]">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems.map((module, index) => {
            const versions = ensureVersionsArray(module.versions);
            return (
              <HoverCard key={index}>
                <HoverCardTrigger asChild>
                  <TableRow>
                    <TableCell className="font-medium uppercase">
                      {module.package || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {versions.length > 0 ? (
                          versions.map((version, vIndex) => (
                            <Badge key={vIndex} variant="secondary">
                              {version.versionName || ""}
                            </Badge>
                          ))
                        ) : (
                          <span>No versions available</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="truncate max-w-[400px]">
                      {versions[0]?.help || "No description available"}
                    </TableCell>
                  </TableRow>
                </HoverCardTrigger>
                <HoverCardContent className="w-full max-w-[500px]">
                  <div className="p-4">
                    <div className="text-lg font-medium mb-2">
                      {module.package || "N/A"}
                    </div>
                    <div className="text-sm mb-2">
                      {versions[0]?.help || "No description available"}
                    </div>
                    <div className="text-sm font-medium mt-2">
                      Available Versions:
                    </div>
                    <ul className="list-disc list-inside">
                      {versions.length > 0 ? (
                        versions.map((version, vIndex) => (
                          <li key={vIndex}>{version.versionName || ""}</li>
                        ))
                      ) : (
                        <li>No versions available</li>
                      )}
                    </ul>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </TableBody>
        <TableFooter className="bg-card">
          <TableRow>
            <TableCell className="w-[200px]" colSpan={2}>
              Total Number of Modules
            </TableCell>
            <TableCell className="text-right">
              {filteredResults.length}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <TablePagination />
    </div>
  );
};

export default ModuleTable;
