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

type Version = {
  versionName: string;
  help: string;
};

type Module = {
  package: string;
  versions: Version[];
};

export const ModuleTable = ({ results }: { results: Module[] }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const itemsPerPage = 25;

  // Flatten the results array to include each version as a separate item
  const flattenedResults = results.flatMap((module) => {
    if (!Array.isArray(module.versions)) {
      console.error(
        `module.versions is not an array for module: ${module.package}`,
        module.versions
      );
      return [];
    }

    return module.versions.map((version) => ({
      package: module.package,
      version: version.versionName,
      help: version.help,
    }));
  });

  // Filter results based on searchTerm
  const filteredResults = flattenedResults.filter(
    (item) =>
      item.package.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.help.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate the number of pages
  const pageCount = Math.ceil(filteredResults.length / itemsPerPage);

  // Calculate the slice of data to display
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
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
      <Input
        type="text"
        placeholder="Search for Module or Version"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1); // Reset to first page on search
        }}
        className="mb-4 p-2 border rounded"
      />
      <Table className="bg-black/30 rounded-md mx-auto">
        <TableHeader className="bg-card">
          <TableRow>
            <TableHead className="w-[150px]">Module Name</TableHead>
            <TableHead className="w-[100px]">Version</TableHead>
            <TableHead className="w-[450px]">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems.map((item, index) => (
            <HoverCard key={index}>
              <HoverCardTrigger asChild>
                <TableRow>
                  <TableCell className="truncate max-w-[150px] uppercase">
                    {item.package}
                  </TableCell>
                  <TableCell className="truncate max-w-[100px]">
                    {item.version}
                  </TableCell>
                  <TableCell className="truncate max-w-[450px]">
                    {item.help}
                  </TableCell>
                </TableRow>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="p-4">
                  <div className="text-lg font-medium mb-2">
                    {item.package} ({item.version})
                  </div>
                  <div className="text-sm">{item.help}</div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </TableBody>
        <TableFooter className="bg-card">
          <TableRow>
            <TableCell className="w-[200px]" colSpan={2}>
              Total Number of Module Versions
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
