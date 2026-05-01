/* eslint-disable no-plusplus */

interface Unit {
  code: string;
  title: string;
  statusOfCompletion: string;
}

// Convert units array to placeholder format for a specific chunk

export const chunkUnitsToPlaceholders = (
  units: Unit[],
  startIndex: number,
  maxUnitsPerPage: number
): Record<string, string> => {
  const placeholders: Record<string, string> = {};

  // Get the chunk of units for this page
  const endIndex = Math.min(startIndex + maxUnitsPerPage, units.length);
  const unitsChunk = units.slice(startIndex, endIndex);

  // Fill placeholders for this chunk
  for (let i = 0; i < maxUnitsPerPage; i++) {
    const unit = unitsChunk[i];
    const position = i + 1; // 1-based index

    if (unit) {
      placeholders[`U${position}`] = unit.code || "";
      placeholders[`UNAME${position}`] = unit.title || "";
      placeholders[`URES${position}`] = unit.statusOfCompletion || "";
    } else {
      // Fill empty placeholders for remaining slots
      placeholders[`U${position}`] = "";
      placeholders[`UNAME${position}`] = "";
      placeholders[`URES${position}`] = "";
    }
  }

  return placeholders;
};

//  Calculate how many pages needed for given units
export const calculatePagesNeeded = (totalUnits: number, unitsPerPage: number): number => {
  return Math.ceil(totalUnits / unitsPerPage);
};

// Split units into chunks for multi-page generation
export const splitUnitsIntoChunks = (units: Unit[], unitsPerPage: number): Unit[][] => {
  const chunks: Unit[][] = [];

  for (let i = 0; i < units.length; i += unitsPerPage) {
    chunks.push(units.slice(i, i + unitsPerPage));
  }

  return chunks;
};
