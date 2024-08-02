"use client";
import { useState } from "react";
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
} from "../ui/pagination";
import { Input } from "../ui/input";

type Item = {
  package: string;
  versions: [
    {
      help: string;
    }
  ];
};

export const ModuleTable = ({ results }: { results: Item[] }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const itemsPerPage = 15;

  // Filter results based on searchTerm
  const filteredResults = results.filter((item) =>
    item.package.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate the number of pages
  const pageCount = Math.ceil(filteredResults.length / itemsPerPage);

  // Calculate the slice of data to display
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);

  // Change page handler
  const paginate = (pageNumber: React.SetStateAction<number>) =>
    setCurrentPage(pageNumber);

  // Create pageNumbers Array
  const pageNumbers = [];
  for (let i = 1; i <= pageCount; i++) {
    pageNumbers.push(i);
  }

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
        placeholder="Search for Module"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1); // Reset to first page on search
        }}
        className="mb-4 p-2 border rounded"
      />
      <Table className="bg-black/30 rounded-md mx-auto">
        <TableHeader className="bg-gray-600/10">
          <TableRow>
            <TableHead className="w-[250px]">Module Name</TableHead>
            <TableHead className="">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems.map((module, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium uppercase w-[250px]">
                {module.package}
              </TableCell>
              <TableCell className="">{module.versions[0].help}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-gray-600/10">
          <TableRow>
            <TableCell className="w-[250px]" colSpan={1}>
              Total Number of Results
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
