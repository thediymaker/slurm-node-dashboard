import { CardSkeletonProps } from "@/types/types";
import { Skeleton } from "../ui/skeleton";

export function CardSkeleton({ qty, size }: CardSkeletonProps) {
  return (
    <div className="flex flex-wrap p-3 uppercase">
      {Array.from({ length: qty }).map((_, index) => (
        <Skeleton
          key={index}
          className={`p-3 border-2 rounded-lg m-1 animate-pulse`}
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      ))}
    </div>
  );
}

export default CardSkeleton;
