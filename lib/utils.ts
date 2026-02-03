import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRandomGeekName() {
  const names = [
    "Ada Lovelace", "Grace Hopper", "Alan Turing", "Seymour Cray",
    "HPC Wizard", "Cluster Commander", "Node Ninja", "Petaflop Pilot",
    "Kernel Panic", "Bit Flipper", "Packet Packet",
    "Data Drifter", "Cache Miss", "Stack Overflow", "Null Pointer",
    "Race Condition", "Deadlock", "Zombie Process",
    "Linus Torvalds", "Dennis Ritchie", "Ken Thompson", "Margaret Hamilton",
    "Katherine Johnson", "Gordon Moore", "Teraflop Traveler", "Giga Hertz"
  ];
  return names[Math.floor(Math.random() * names.length)];
}

export function getHierarchyLabels() {
  return {
    level1: process.env.NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL || "College",
    level2: process.env.NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL || "Department",
  };
}

