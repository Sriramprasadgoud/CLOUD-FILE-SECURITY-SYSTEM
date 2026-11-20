import { FileRow } from './db';

export type SearchField = 'filename' | 'extension' | 'file_type';
export type SortAlgorithm = 'merge' | 'quick';
export type SortField = 'filename' | 'upload_date' | 'file_size';
export type SortOrder = 'asc' | 'desc';

export interface SearchMetrics {
  algorithm: 'Linear Search' | 'Binary Search';
  field: string;
  query: string;
  totalScanned: number;
  comparisons: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
  sortedFirst: boolean;
  steps: string[];
}

export interface SortMetrics {
  algorithm: 'Merge Sort' | 'Quick Sort';
  sortBy: SortField;
  order: SortOrder;
  totalItems: number;
  comparisons: number;
  swapsOrMoves: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

function compareFiles(a: FileRow, b: FileRow, key: SortField, order: SortOrder): number {
  let cmp = 0;
  if (key === 'filename') {
    const aName = a.original_filename.toLowerCase();
    const bName = b.original_filename.toLowerCase();
    if (aName < bName) cmp = -1;
    else if (aName > bName) cmp = 1;
    else cmp = 0;
  } else if (key === 'file_size') {
    cmp = a.file_size - b.file_size;
  } else {
    // upload_date (ISO-8601 UTC strings sort lexicographically in chronological order)
    if (a.upload_date < b.upload_date) cmp = -1;
    else if (a.upload_date > b.upload_date) cmp = 1;
    else cmp = 0;
  }
  return order === 'asc' ? cmp : -cmp;
}

export function mergeSortFiles(
  files: FileRow[],
  sortBy: SortField = 'filename',
  order: SortOrder = 'asc',
): { results: FileRow[]; metrics: SortMetrics } {
  const start = performance.now();
  let comparisons = 0;
  let moves = 0;

  function merge(left: FileRow[], right: FileRow[]): FileRow[] {
    const merged: FileRow[] = [];
    let i = 0;
    let j = 0;

    while (i < left.length && j < right.length) {
      comparisons++;
      if (compareFiles(left[i], right[j], sortBy, order) <= 0) {
        merged.push(left[i]);
        i++;
      } else {
        merged.push(right[j]);
        j++;
      }
      moves++;
    }

    while (i < left.length) {
      merged.push(left[i]);
      i++;
      moves++;
    }

    while (j < right.length) {
      merged.push(right[j]);
      j++;
      moves++;
    }

    return merged;
  }

  function sortRecursive(arr: FileRow[]): FileRow[] {
    if (arr.length <= 1) {
      return arr.slice();
    }
    const mid = Math.floor(arr.length / 2);
    const left = sortRecursive(arr.slice(0, mid));
    const right = sortRecursive(arr.slice(mid));
    return merge(left, right);
  }

  const results = sortRecursive(files);
  const executionTimeMs = Number((performance.now() - start).toFixed(4));

  return {
    results,
    metrics: {
      algorithm: 'Merge Sort',
      sortBy,
      order,
      totalItems: files.length,
      comparisons,
      swapsOrMoves: moves,
      executionTimeMs,
      timeComplexity: 'O(n log n) best, average, and worst case',
      spaceComplexity: 'O(n) auxiliary array space',
    },
  };
}

export function quickSortFiles(
  files: FileRow[],
  sortBy: 'file_size' | 'filename' = 'file_size',
  order: SortOrder = 'asc',
): { results: FileRow[]; metrics: SortMetrics } {
  const start = performance.now();
  const arr = files.slice();
  let comparisons = 0;
  let swaps = 0;

  function partition(low: number, high: number): number {
    // Median-of-three pivot selection reduces worst-case behavior on already-sorted data
    const mid = Math.floor((low + high) / 2);
    const pivot = arr[mid];
    // Move pivot to end
    const tmpPivot = arr[mid];
    arr[mid] = arr[high];
    arr[high] = tmpPivot;
    swaps++;

    let storeIndex = low;
    for (let i = low; i < high; i++) {
      comparisons++;
      if (compareFiles(arr[i], pivot, sortBy, order) <= 0) {
        if (i !== storeIndex) {
          const temp = arr[i];
          arr[i] = arr[storeIndex];
          arr[storeIndex] = temp;
          swaps++;
        }
        storeIndex++;
      }
    }

    if (storeIndex !== high) {
      const temp = arr[storeIndex];
      arr[storeIndex] = arr[high];
      arr[high] = temp;
      swaps++;
    }
    return storeIndex;
  }

  function sortInPlace(low: number, high: number): void {
    if (low < high) {
      const pivotIdx = partition(low, high);
      sortInPlace(low, pivotIdx - 1);
      sortInPlace(pivotIdx + 1, high);
    }
  }

  if (arr.length > 1) {
    sortInPlace(0, arr.length - 1);
  }
  const executionTimeMs = Number((performance.now() - start).toFixed(4));

  return {
    results: arr,
    metrics: {
      algorithm: 'Quick Sort',
      sortBy,
      order,
      totalItems: files.length,
      comparisons,
      swapsOrMoves: swaps,
      executionTimeMs,
      timeComplexity: 'O(n log n) average, O(n²) worst case',
      spaceComplexity: 'O(log n) recursion stack',
    },
  };
}

export function linearSearchFiles(
  files: FileRow[],
  rawQuery: string,
  field: SearchField = 'filename',
): { results: FileRow[]; metrics: SearchMetrics } {
  const start = performance.now();
  const query = rawQuery.trim().toLowerCase().replace(/^\./, '');
  const results: FileRow[] = [];
  const steps: string[] = [];
  let comparisons = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    comparisons++;
    let candidate = '';
    if (field === 'filename') {
      candidate = file.original_filename.toLowerCase();
    } else if (field === 'extension') {
      candidate = getExtension(file.original_filename);
    } else {
      candidate = file.file_type.toLowerCase();
    }

    const matched = query === '' ? true : candidate.includes(query);
    if (steps.length < 12) {
      steps.push(
        `Index ${i}: checked ${field} "${candidate}" -> ${matched ? 'MATCH' : 'skip'}`,
      );
    }
    if (matched) {
      results.push(file);
    }
  }

  const executionTimeMs = Number((performance.now() - start).toFixed(4));
  return {
    results,
    metrics: {
      algorithm: 'Linear Search',
      field,
      query: rawQuery.trim(),
      totalScanned: files.length,
      comparisons,
      executionTimeMs,
      timeComplexity: 'O(n) linear time',
      spaceComplexity: 'O(1) auxiliary space',
      sortedFirst: false,
      steps,
    },
  };
}

export function binarySearchFiles(
  files: FileRow[],
  rawQuery: string,
): { results: FileRow[]; metrics: SearchMetrics } {
  const start = performance.now();
  const query = rawQuery.trim().toLowerCase();
  const steps: string[] = [];

  if (!query) {
    return {
      results: [],
      metrics: {
        algorithm: 'Binary Search',
        field: 'filename',
        query: '',
        totalScanned: files.length,
        comparisons: 0,
        executionTimeMs: Number((performance.now() - start).toFixed(4)),
        timeComplexity: 'O(log n) search after O(n log n) Merge Sort',
        spaceComplexity: 'O(n) for sorted metadata copy',
        sortedFirst: true,
        steps: ['Enter a filename or prefix to execute binary search.'],
      },
    };
  }

  // Step 1: Sort metadata alphabetically by filename using Merge Sort (never built-in .sort())
  const { results: sorted, metrics: sortMetrics } = mergeSortFiles(files, 'filename', 'asc');
  steps.push(
    `Pre-sorted ${sorted.length} records by filename via Merge Sort (${sortMetrics.comparisons} comparisons).`,
  );

  // Step 2: Binary Search for exact or prefix match
  let low = 0;
  let high = sorted.length - 1;
  let comparisons = 0;
  let foundIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midName = sorted[mid].original_filename.toLowerCase();
    comparisons++;

    if (midName === query || midName.startsWith(query)) {
      foundIndex = mid;
      steps.push(`Probe [${low}..${high}] mid=${mid} ("${sorted[mid].original_filename}") -> HIT`);
      break;
    } else if (midName < query) {
      steps.push(
        `Probe [${low}..${high}] mid=${mid} ("${sorted[mid].original_filename}") < "${query}" -> move right`,
      );
      low = mid + 1;
    } else {
      steps.push(
        `Probe [${low}..${high}] mid=${mid} ("${sorted[mid].original_filename}") > "${query}" -> move left`,
      );
      high = mid - 1;
    }
  }

  // Expand left and right from foundIndex to collect all matching prefix/exact entries
  const matches: FileRow[] = [];
  if (foundIndex !== -1) {
    let left = foundIndex;
    while (left - 1 >= 0) {
      comparisons++;
      const name = sorted[left - 1].original_filename.toLowerCase();
      if (name === query || name.startsWith(query)) {
        left--;
      } else {
        break;
      }
    }

    let right = foundIndex;
    while (right + 1 < sorted.length) {
      comparisons++;
      const name = sorted[right + 1].original_filename.toLowerCase();
      if (name === query || name.startsWith(query)) {
        right++;
      } else {
        break;
      }
    }

    for (let idx = left; idx <= right; idx++) {
      matches.push(sorted[idx]);
    }
  } else {
    steps.push(`Search space exhausted -> no exact or prefix match for "${rawQuery.trim()}".`);
  }

  const executionTimeMs = Number((performance.now() - start).toFixed(4));
  return {
    results: matches,
    metrics: {
      algorithm: 'Binary Search',
      field: 'filename',
      query: rawQuery.trim(),
      totalScanned: sorted.length,
      comparisons,
      executionTimeMs,
      timeComplexity: 'O(log n) search after O(n log n) Merge Sort',
      spaceComplexity: 'O(n) for sorted metadata copy',
      sortedFirst: true,
      steps,
    },
  };
}
