import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRandomGeekName() {
  const names = [
    "Ada Lovelace", "Grace Hopper", "Alan Turing", "Seymour Cray",
    "HPC Wizard", "Cluster Commander", "Node Ninja", "Petaflop Pilot",
    "Kernel Panic", "Sudo User", "Bit Flipper", "Packet Packet",
    "Data Drifter", "Cache Miss", "Stack Overflow", "Null Pointer",
    "Race Condition", "Deadlock", "Zombie Process", "Daemon",
    "Linus Torvalds", "Dennis Ritchie", "Ken Thompson", "Margaret Hamilton",
    "Katherine Johnson", "Gordon Moore", "Teraflop Traveler", "Giga Hertz",
    "Root Access"
  ];
  return names[Math.floor(Math.random() * names.length)];
}
