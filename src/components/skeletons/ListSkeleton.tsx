import { Skeleton } from "@/components/ui/skeleton"

interface ListSkeletonProps {
  rows?: number
}

export function ListSkeleton({ rows = 10 }: ListSkeletonProps) {
  return (
    <div className="w-full space-y-6 p-4">
      {/* Header-like section */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>

      {/* Divider/Gap */}
      <div className="h-4" />

      {/* List items */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-6 w-6 rounded-md" /> {/* Checkbox/Icon placeholder */}
            <Skeleton className="h-4 flex-1" /> {/* Text line */}
          </div>
        ))}
      </div>
    </div>
  )
}
