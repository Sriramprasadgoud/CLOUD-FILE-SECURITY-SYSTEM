document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("cfss-dropzone");
  const fileInput = document.getElementById("cfss-file-input");
  const fileMeta = document.getElementById("cfss-file-meta");

  if (dropzone && fileInput && fileMeta) {
    const updateMeta = (file) => {
      if (!file) return;
      const sizeKb = (file.size / 1024).toFixed(2);
      fileMeta.classList.remove("d-none");
      fileMeta.textContent = `${file.name} · ${sizeKb} KB · ${file.type || "application/octet-stream"}`;
    };

    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        fileInput.files = event.dataTransfer.files;
        updateMeta(event.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        updateMeta(fileInput.files[0]);
      }
    });
  }
});
