"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const ReportLoading: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Skeleton Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`stat-${i}`}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skeleton Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-6 w-48 mb-5" />
            <Skeleton className="h-[300px] w-full rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-6 w-48 mb-5" />
            <Skeleton className="h-[300px] w-full rounded-md" />
          </CardContent>
        </Card>
      </div>

      {/* Skeleton Alert */}
      <Skeleton className="h-20 w-full rounded-md" />

      {/* Skeleton Table */}
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-6 w-48 mb-5" />
          <Skeleton className="h-[300px] w-full rounded-md" />
          <Skeleton className="h-4 w-96 mt-4" />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportLoading;
