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
  PaginationItem,
  PaginationLink,
} from "../ui/pagination";
import { Input } from "../ui/input";

type Module = {
  name: any;
  loads: any;
  description: any;
};

export const ModuleTable = ({
  results,
  filterType,
}: {
  results: Module[];
  filterType: string;
  handleDelete: any;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const itemsPerPage = 20;

  const filteredResults = results.filter(
    (module) =>
      (filterType === "All" || module.name === filterType) &&
      module.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate the number of pages
  let pageCount = Math.ceil(filteredResults.length / itemsPerPage);

  // Calculate the slice of data to display
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  let currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);

  // Change page handler
  const paginate = (pageNumber: React.SetStateAction<number>) =>
    setCurrentPage(pageNumber);

  // Create pageNumbers Array
  const pageNumbers: any = [];
  for (let i = 1; i <= pageCount; i++) {
    pageNumbers.push(i);
  }

  const TablePagination = () => {
    return (
      <div className="mt-2">
        <Pagination>
          <PaginationContent>
            {pageNumbers.map((number: any, index: any) => (
              <PaginationItem key={index}>
                <button onClick={() => paginate(number)}>
                  {number === currentPage ? (
                    <PaginationLink isActive>{number}</PaginationLink>
                  ) : (
                    <PaginationLink>{number}</PaginationLink>
                  )}
                </button>
              </PaginationItem>
            ))}
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className="mt-5">
      <Input
        type="text"
        placeholder="Search for Module"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 p-2 border rounded"
      />
      <Table className="bg-black/30 rounded-md mx-auto">
        <TableHeader className="bg-gray-600/10">
          <TableRow>
            <TableHead className="w-[200px]">Module Name</TableHead>
            <TableHead className="w-[100px]">Loads</TableHead>
            <TableHead className="">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems
            .filter(
              (module) => filterType === "All" || module.name === filterType
            )
            .map((module, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium uppercase">
                  {module.name}
                </TableCell>
                <TableCell>{module.loads}</TableCell>
                <TableCell className="truncate max-w-[40px]">
                  {module.description}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        <TableFooter className="bg-gray-600/10">
          <TableRow>
            <TableCell colSpan={2}>Total Number of Results</TableCell>
            <TableCell className="text-right">{results.length}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <TablePagination />
    </div>
  );
};
