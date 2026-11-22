// Getting the PNG out: Save downloads it; Share opens the system share sheet (Photos,
// Messages…) where available and falls back to a download.

const FILE_NAME = "jack-o-lantern.png";

export function downloadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Resolves false if the user cancelled the share sheet. */
export async function shareImage(blob: Blob): Promise<boolean> {
  const file = new File([blob], FILE_NAME, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Jack-o'-lantern" });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      // Share refused (e.g. the gesture expired while rendering): fall back to download.
    }
  }
  downloadImage(blob);
  return true;
}
