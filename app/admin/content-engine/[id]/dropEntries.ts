// Files from a drag-and-drop, including the images inside dropped folders.
// webkitGetAsEntry() only works synchronously inside the drop event, so the
// caller captures entries before its first await and hands them here.

// readEntries() returns at most ~100 entries per call; drain until empty.
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        step();
      }, reject);
    step();
  });
}

export async function filesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file((file) => resolve([file]), reject),
    );
  }
  if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    return (await Promise.all(children.map(filesFromEntry))).flat();
  }
  return [];
}
