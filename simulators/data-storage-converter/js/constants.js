// constants.js — Data Storage Converter
// All factors are "1 unit = X bytes". Byte (B) is the base unit.
// Includes both decimal (SI, base-1000: KB/MB/GB/TB/PB) and binary
// (IEC, base-1024: KiB/MiB/GiB/TiB/PiB) prefixes, since confusing the
// two is one of the most common real-world mistakes in this space.

export const UNITS = {
  bit:  { label: 'Bit',       symbol: 'bit', group: 'Base',   toByte: 0.125,                decimals: 3 },
  byte: { label: 'Byte',      symbol: 'B',   group: 'Base',   toByte: 1,                    decimals: 4 },

  kb:   { label: 'Kilobyte',  symbol: 'KB',  group: 'Decimal (1000)', toByte: 1e3,           decimals: 6 },
  mb:   { label: 'Megabyte',  symbol: 'MB',  group: 'Decimal (1000)', toByte: 1e6,           decimals: 9 },
  gb:   { label: 'Gigabyte',  symbol: 'GB',  group: 'Decimal (1000)', toByte: 1e9,           decimals: 9 },
  tb:   { label: 'Terabyte',  symbol: 'TB',  group: 'Decimal (1000)', toByte: 1e12,          decimals: 9 },
  pb:   { label: 'Petabyte',  symbol: 'PB',  group: 'Decimal (1000)', toByte: 1e15,          decimals: 9 },

  kib:  { label: 'Kibibyte',  symbol: 'KiB', group: 'Binary (1024)', toByte: 1024,           decimals: 6 },
  mib:  { label: 'Mebibyte',  symbol: 'MiB', group: 'Binary (1024)', toByte: 1024 ** 2,      decimals: 9 },
  gib:  { label: 'Gibibyte',  symbol: 'GiB', group: 'Binary (1024)', toByte: 1024 ** 3,      decimals: 9 },
  tib:  { label: 'Tebibyte',  symbol: 'TiB', group: 'Binary (1024)', toByte: 1024 ** 4,      decimals: 9 },
  pib:  { label: 'Pebibyte',  symbol: 'PiB', group: 'Binary (1024)', toByte: 1024 ** 5,      decimals: 9 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['bit', 'byte', 'kb', 'mb', 'gb', 'tb', 'pb', 'kib', 'mib', 'gib', 'tib', 'pib'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'gb';
