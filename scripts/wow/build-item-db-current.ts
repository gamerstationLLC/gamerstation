// scripts/wow/build-item-db-current.ts
// Convenience wrapper for "Current Content Mode A" item DB build.

process.env.WOW_MODE = process.env.WOW_MODE || "current_a";
process.env.WOW_MIN_REQUIRED_LEVEL = process.env.WOW_MIN_REQUIRED_LEVEL || "70";
process.env.WOW_MIN_ILVL = process.env.WOW_MIN_ILVL || "400";
process.env.WOW_PACK_SIZE = process.env.WOW_PACK_SIZE || "2000";

// Run the real builder
import "./build-item-db";
