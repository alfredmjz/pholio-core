import { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import googleSheetSrc from "@/public/gsheets-icon48x48.svg";

export const NetflixIcon = ({ className, ...props }: LucideProps) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-6 h-6", className)}
    {...props}
  >
    <title>Netflix</title>
    <rect width="24" height="24" rx="4" fill="black" />
    <path
      fill="#E50914"
      d="m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z"
    />
  </svg>
);

export const SpotifyIcon = ({ className, ...props }: LucideProps) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-6 h-6", className)}
    {...props}
  >
    <title>Spotify</title>
    <path
      fill="#1DB954"
      d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
    />
  </svg>
);

export const AmazonIcon = ({ className, ...props }: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={cn("w-6 h-6", className)}
    {...props}
  >
    <g
      fill="none"
      fillRule="nonzero"
      stroke="none"
      strokeWidth="1"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeMiterlimit="10"
      strokeDasharray=""
      strokeDashoffset="0"
      style={{ mixBlendMode: "normal" }}
    >
      <g transform="scale(5.33333,5.33333)">
        <path
          d="M39.6,39c-4.2,3.1 -10.5,5 -15.6,5c-7.3,0 -13.8,-2.9 -18.8,-7.4c-0.4,-0.4 0,-0.8 0.4,-0.6c5.4,3.1 11.5,4.9 18.3,4.9c4.6,0 10.4,-1 15.1,-3c0.7,-0.2 1.3,0.6 0.6,1.1zM41.1,36.9c-0.5,-0.7 -3.5,-0.3 -4.8,-0.2c-0.4,0 -0.5,-0.3 -0.1,-0.6c2.3,-1.7 6.2,-1.2 6.6,-0.6c0.4,0.6 -0.1,4.5 -2.3,6.3c-0.3,0.3 -0.7,0.1 -0.5,-0.2c0.5,-1.2 1.6,-4 1.1,-4.7z"
          fill="#ffb300"
        />
        <path
          d="M36.9,29.8c-1,-1.3 -2,-2.4 -2,-4.9v-8.3c0,-3.5 0,-6.6 -2.5,-9c-2,-1.9 -5.3,-2.6 -7.9,-2.6c-5.5,0 -10.3,2.2 -11.5,8.4c-0.1,0.7 0.4,1 0.8,1.1l5.1,0.6c0.5,0 0.8,-0.5 0.9,-1c0.4,-2.1 2.1,-3.1 4.1,-3.1c1.1,0 3.2,0.6 3.2,3v3c-3.2,0 -6.6,0 -9.4,1.2c-3.3,1.4 -5.6,4.3 -5.6,8.6c0,5.5 3.4,8.2 7.8,8.2c3.7,0 5.9,-0.9 8.8,-3.8c0.9,1.4 1.3,2.2 3,3.7c0.4,0.2 0.9,0.2 1.2,-0.1v0c1,-0.9 2.9,-2.6 4,-3.5c0.5,-0.4 0.4,-1 0,-1.5zM27,22.1v0c0,2 -0.1,6.9 -5,6.9c-3,0 -3,-3 -3,-3c0,-4.5 4.2,-5 8,-5z"
          fill="#000000"
        />
      </g>
    </g>
  </svg>
);
